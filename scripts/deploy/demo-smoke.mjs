#!/usr/bin/env node
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

/**
 * `pnpm demo:smoke -- --url https://universityflow.vercel.app`: after a deploy, checks the live
 * judge demo end to end the way a judge walks it, with plain HTTP (and a real Chromium with
 * `--browser`, when Playwright is installed):
 *
 *  /api/health → the landing page (the front-door pictures, the "Demo for judges" entry) → /demo,
 *  the picker → each of its made-up learners: start, home, and still signed in three pages later
 *  (what a missing shared database breaks: each server instance its own sessions) → the judges'
 *  sign-up page when on → phone sign-in off (404), or, with the on-screen phone sign-up on, an
 *  080 number's PIN on screen reaching onboarding and a cellphone number refused → the sample
 *  profile photo (and a real upload only when that switch is on) → a sample report → one chat
 *  message → the hackathon exceptions of 2026-10-24 (My CV made on the stand-in, plan-map words
 *  saved, Read aloud on or off) → sign out.
 *
 * Prints a pass/fail table and exits non-zero on any failure. Uses only the demo's made-up
 * learners and generated pictures; prints no cookie, token or personal data.
 */

export function parseSmokeArgs(argv) {
  const options = {
    url: null,
    browser: false,
    expectLogos: false,
    expectSignup: false,
    expectRealPhotos: false,
    expectRealAi: false,
    // The hackathon exceptions of 2026-10-24: My CV (stand-in), plan-map words, Read aloud.
    expectCv: false,
    expectPlanWords: false,
    expectReadAloud: false,
    expectPhoneSignup: false,
    timeoutMs: 90_000,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') continue;
    else if (arg === '--url') options.url = argv[++i] ?? null;
    else if (arg.startsWith('--url=')) options.url = arg.slice('--url='.length);
    else if (arg === '--browser') options.browser = true;
    else if (arg === '--logos') options.expectLogos = true;
    else if (arg === '--signup') options.expectSignup = true;
    else if (arg === '--real-photos') options.expectRealPhotos = true;
    else if (arg === '--real-ai') options.expectRealAi = true;
    else if (arg === '--cv') options.expectCv = true;
    else if (arg === '--plan-words') options.expectPlanWords = true;
    else if (arg === '--read-aloud') options.expectReadAloud = true;
    else if (arg === '--phone-signup') options.expectPhoneSignup = true;
    else throw new Error(`Unknown option ${arg}`);
  }
  if (!options.url)
    throw new Error('Give the demo’s address: --url https://universityflow.vercel.app');
  let url;
  try {
    url = new URL(options.url);
  } catch {
    throw new Error('--url must be an address such as https://universityflow.vercel.app');
  }
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new Error('--url must be https (http only for localhost)');
  }
  options.url = url.origin;
  return options;
}

/** One browser's cookies, as a judge's browser keeps them (name=value only; enough here). */
export class CookieJar {
  #cookies = new Map();
  store(response) {
    const lines =
      typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie()
        : [response.headers.get('set-cookie')].filter(Boolean);
    for (const line of lines) {
      const [pair, ...attributes] = line.split(';');
      const eq = pair.indexOf('=');
      if (eq < 1) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      const expired = attributes.some(
        (a) => /^\s*max-age=0\s*$/i.test(a) || /^\s*expires=Thu, 01 Jan 1970/i.test(a),
      );
      if (expired || value === '') this.#cookies.delete(name);
      else this.#cookies.set(name, value);
    }
  }
  has(name) {
    return this.#cookies.has(name);
  }
  header() {
    return [...this.#cookies].map(([n, v]) => `${n}=${v}`).join('; ');
  }
}

/** A tiny synthetic picture (a grey square PNG), made here: never anyone's photo. */
export function syntheticPng(size = 16) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 0; // greyscale
  const rows = Buffer.alloc((size + 1) * size, 0x80);
  for (let y = 0; y < size; y++) rows[y * (size + 1)] = 0; // filter: none
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A multipart body with a known length (the photo route reads content-length first). */
export function multipart(fields) {
  const boundary = `----uf-smoke-${Date.now().toString(36)}`;
  const parts = [];
  for (const field of fields) {
    let head = `--${boundary}\r\nContent-Disposition: form-data; name="${field.name}"`;
    if (field.filename) head += `; filename="${field.filename}"\r\nContent-Type: ${field.type}`;
    parts.push(Buffer.from(`${head}\r\n\r\n`), Buffer.from(field.value), Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(parts), type: `multipart/form-data; boundary=${boundary}` };
}

/** The persona ids the picker offers, from its forms (never a copied list). */
export function personaIdsFrom(html) {
  const ids = [];
  for (const m of html.matchAll(/<input[^>]*\bname="persona"[^>]*>/g)) {
    const value = m[0].match(/\bvalue="([^"]+)"/)?.[1];
    if (value && !ids.includes(value)) ids.push(value);
  }
  return ids;
}

/** The first picture in the front door's picture column, or null. */
export function frontDoorPicture(html) {
  const at = html.indexOf('data-testid="stage-people"');
  if (at < 0) return null;
  const src = html.slice(at, at + 6000).match(/<img[^>]*\bsrc="([^"]+)"/);
  return src ? src[1].replace(/&amp;/g, '&') : null;
}

/** Signed-in pages show the demo banner's "Switch learner" form. */
const SIGNED_IN_MARK = 'action="/api/demo/switch"';
/** Three pages after home, each read on its own request. */
export const FURTHER_PAGES = ['/goals', '/me', '/documents'];
const SAMPLE_PHOTO = 'sample-1';
/** "What goes on my CV": the made-up learner's school only (a hackathon exception's check). */
const CV_SELECTION = {
  surname: null,
  label: null,
  summary: null,
  email: null,
  phone: null,
  city: null,
  region: null,
  includeSchool: true,
  subjectIds: [],
  includeOffer: false,
  moduleCodes: [],
  entryIds: [],
};
/** Words the smoke writes in a plan map: plainly a check, nothing personal. */
const PLAN_WORDS = 'Smoke check: my own words';

/**
 * Every check, in order. `fetchImpl` is injected (tests pass a fake). Resolves rows:
 * { check, ok: true | false | null (skipped/info), detail }.
 */
export async function runSmoke({ base, fetchImpl = fetch, options = {}, log = () => {} }) {
  const rows = [];
  const add = (check, ok, detail = '') => {
    rows.push({ check, ok, detail });
    log(
      `${ok === true ? 'PASS' : ok === false ? 'FAIL' : 'INFO'}  ${check}${detail ? `: ${detail}` : ''}`,
    );
  };
  const timeoutMs = options.timeoutMs ?? 90_000;

  /** One request; follows nothing (redirects are checked, not followed). */
  async function request(jar, path, init = {}) {
    const headers = { ...(init.headers ?? {}) };
    const cookie = jar?.header();
    if (cookie) headers.cookie = cookie;
    if (init.method && init.method !== 'GET') headers.origin = base;
    const response = await fetchImpl(`${base}${path}`, {
      ...init,
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    jar?.store(response);
    return response;
  }
  const attempt = async (check, fn) => {
    try {
      await fn();
    } catch (error) {
      add(
        check,
        false,
        error?.name === 'TimeoutError' ? 'timed out' : String(error?.message ?? error),
      );
    }
  };
  const isRedirect = (status) => status >= 300 && status < 400;

  // 1. Health: the configuration was accepted.
  await attempt('/api/health answers 200', async () => {
    const r = await request(null, '/api/health');
    const body = await r.json().catch(() => null);
    // 503: the demo refused its configuration; the app's own check names the variable.
    const hint =
      r.status === 503
        ? ': the demo refused its configuration. Run `pnpm deploy:check --target demo` to see which variable, fix it in Vercel and redeploy'
        : '';
    add(
      '/api/health answers 200',
      r.status === 200 && body?.status === 'ok',
      `HTTP ${r.status}${hint}`,
    );
  });

  // 2. The landing page: the front-door pictures and the judges' entry.
  await attempt('landing page', async () => {
    const r = await request(null, '/');
    const html = await r.text();
    add('landing page loads', r.status === 200, `HTTP ${r.status}`);
    const picture = frontDoorPicture(html);
    if (!picture) {
      add('front-door pictures', false, 'no picture column (data-testid="stage-people")');
    } else {
      const img = await request(null, picture.startsWith('/') ? picture : `/${picture}`);
      const type = img.headers.get('content-type') ?? '';
      add(
        'front-door pictures',
        img.status === 200 && type.startsWith('image/'),
        `HTTP ${img.status}`,
      );
    }
    add('"Demo for judges" entry links to /demo', /href="\/demo"/.test(html));
  });

  // 3. The picker.
  let personas = [];
  let picker = '';
  await attempt('/demo picker', async () => {
    const r = await request(null, '/demo');
    picker = await r.text();
    personas = personaIdsFrom(picker);
    add(
      '/demo picker offers the made-up learners',
      r.status === 200 && personas.length === 6,
      `${personas.length} learner(s), HTTP ${r.status}`,
    );
  });

  // 4. The judges' sign-up, when on.
  const signupLinked = /href="\/demo\/sign-up"/.test(picker);
  if (signupLinked || options.expectSignup) {
    await attempt('judges’ sign-up page', async () => {
      const r = await request(null, '/demo/sign-up');
      const html = await r.text();
      const rendered = r.status === 200 && /<form|<button/.test(html);
      add(
        'judges’ sign-up page renders',
        rendered,
        `HTTP ${r.status}${signupLinked ? '' : ', not linked from /demo'}`,
      );
    });
  } else {
    add('judges’ sign-up page', null, 'off (not linked from /demo); --signup requires it');
  }

  // 5. Phone sign-in: off on a demo (404), unless its on-screen sign-up (a hackathon exception,
  // UF_DEMO_PHONE_SIGNUP=onscreen) is on and linked from the picker.
  const phoneLinked = /href="\/demo\/new-learner"/.test(picker);
  if (phoneLinked) {
    await checkPhoneSignup();
  } else {
    if (options.expectPhoneSignup) {
      add('on-screen phone sign-up linked from /demo (--phone-signup)', false, 'no link on /demo');
    } else {
      add(
        'on-screen phone sign-up',
        null,
        'off (not linked from /demo); --phone-signup requires it',
      );
    }
    await attempt('no phone PIN', async () => {
      const r = await request(null, '/api/auth/request-pin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      add('phone PIN sign-in is off (404)', r.status === 404, `HTTP ${r.status}`);
    });
  }

  /**
   * The on-screen sign-up: a made-up 080 number gets its PIN back on screen and reaches
   * onboarding; a cellphone-looking number is refused. Both numbers are random and built here
   * (never a real person's), nothing is printed but the result, and the account made is deleted at
   * once ("Switch learner").
   */
  async function checkPhoneSignup() {
    const digits = () => String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0');
    const tollFree = `080${digits()}`;
    const post = (jar, path, body) =>
      request(jar, path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    await attempt('on-screen phone sign-up page renders', async () => {
      const r = await request(null, '/demo/new-learner');
      const html = await r.text();
      add(
        'on-screen phone sign-up page renders',
        r.status === 200 && /<form/.test(html),
        `HTTP ${r.status}`,
      );
    });
    await attempt('a cellphone number is refused (080 only)', async () => {
      const r = await post(null, '/api/auth/request-pin', { phone: `082${digits()}` });
      const body = await r.json().catch(() => null);
      add(
        'a cellphone number is refused (080 only)',
        r.status === 400 && body?.detail === 'demo-080-only',
        `HTTP ${r.status}`,
      );
    });
    let pin = '';
    await attempt('a made-up 080 number gets its PIN on screen', async () => {
      const r = await post(null, '/api/auth/request-pin', { phone: tollFree });
      const body = await r.json().catch(() => null);
      pin = typeof body?.demoPin === 'string' && /^\d{6}$/.test(body.demoPin) ? body.demoPin : '';
      add(
        'a made-up 080 number gets its PIN on screen',
        r.status === 200 && pin !== '',
        r.status === 429
          ? 'HTTP 429: the per-address PIN limit (100 an hour on the demo)'
          : `HTTP ${r.status}`,
      );
    });
    if (!pin) return;
    await attempt('the PIN on screen signs in and reaches onboarding', async () => {
      const jar = new CookieJar();
      const verified = await post(jar, '/api/auth/verify-pin', { phone: tollFree, pin });
      const onboarding = await request(jar, '/onboarding');
      const html = await onboarding.text();
      add(
        'the PIN on screen signs in and reaches onboarding',
        verified.status === 200 &&
          jar.has('uf_session') &&
          onboarding.status === 200 &&
          /<form/.test(html),
        `verify HTTP ${verified.status}, /onboarding HTTP ${onboarding.status}`,
      );
      // The made-up account goes now, as a made-up learner's copy does.
      await post(jar, '/api/demo/switch', {});
    });
  }

  // 6. Each learner: start, home, and still signed in three pages later.
  let logosSeen = false;
  const main = personas.includes('demo-grade-11') ? 'demo-grade-11' : personas[0];
  let mainJar = null;
  for (const persona of personas) {
    const check = `start ${persona}, home + ${FURTHER_PAGES.length} pages signed in`;
    await attempt(check, async () => {
      const jar = new CookieJar();
      const start = await request(jar, '/api/demo/start', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ persona }).toString(),
      });
      const location = start.headers.get('location') ?? '';
      if (!isRedirect(start.status) || !/\/home$/.test(location)) {
        const why = /demo=busy/.test(location)
          ? 'refused as busy (the hourly start limit)'
          : /demo=unavailable/.test(location)
            ? 'the copy could not be made (the database?)'
            : `HTTP ${start.status}`;
        add(check, false, why);
        return;
      }
      if (!jar.has('uf_session')) {
        add(check, false, 'no session cookie after the start');
        return;
      }
      const visited = [];
      for (const path of ['/home', ...FURTHER_PAGES]) {
        const page = await request(jar, path);
        const html = await page.text();
        if (html.includes('/demo-logos/')) logosSeen = true;
        if (page.status !== 200 || !html.includes(SIGNED_IN_MARK)) {
          add(
            check,
            false,
            `signed out at ${path} after ${visited.join(', ') || 'the start'} (HTTP ${page.status}): a database every server shares?`,
          );
          return;
        }
        visited.push(path);
      }
      const me = await request(jar, '/api/me');
      if (me.status !== 200) {
        add(check, false, `/api/me answered ${me.status} after ${visited.join(', ')}`);
        return;
      }
      add(check, true, visited.join(' → '));
      if (persona === main) {
        mainJar = jar;
      } else {
        // "Switch learner": deletes this copy and signs out.
        await request(jar, '/api/demo/switch', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        });
      }
    });
  }

  // 7. Logos (a build-time switch): seen on the learners' pages.
  if (options.expectLogos)
    add(
      'university logos shown',
      logosSeen,
      logosSeen ? '' : 'no /demo-logos/ picture on the learners’ pages',
    );
  else add('university logos', null, logosSeen ? 'on' : 'off; --logos requires them');

  if (!mainJar) {
    add('sample photo, sample report, chat, sign out', false, 'no learner stayed signed in');
    return rows;
  }
  const jar = mainJar;

  // 8. The profile photo: a SAMPLE picture, and a real upload only with that switch.
  await attempt('sample profile photo', async () => {
    const preview = await request(jar, `/api/demo/sample-photos/${SAMPLE_PHOTO}`);
    const type = preview.headers.get('content-type') ?? '';
    add(
      'sample photos are offered',
      preview.status === 200 && type.startsWith('image/'),
      `HTTP ${preview.status}`,
    );
    const form = multipart([
      { name: 'crop', value: JSON.stringify({ x: 0, y: 0, size: 1 }) },
      { name: 'sample', value: SAMPLE_PHOTO },
    ]);
    const saved = await request(jar, '/api/me/photo', {
      method: 'POST',
      headers: { 'content-type': form.type },
      body: form.body,
    });
    const kept = await request(jar, '/api/me/photo');
    add(
      'a sample photo is kept',
      saved.status === 200 && kept.status === 200,
      `save HTTP ${saved.status}, read HTTP ${kept.status}`,
    );
  });
  await attempt('real photo upload', async () => {
    const form = multipart([
      { name: 'crop', value: JSON.stringify({ x: 0, y: 0, size: 1 }) },
      { name: 'file', value: syntheticPng(), filename: 'smoke.png', type: 'image/png' },
    ]);
    const r = await request(jar, '/api/me/photo', {
      method: 'POST',
      headers: { 'content-type': form.type },
      body: form.body,
    });
    const body = await r.json().catch(() => null);
    const refused = r.status === 400 && body?.detail === 'demo-sample-photo-only';
    if (options.expectRealPhotos) {
      add('a real photo upload is taken (--real-photos)', r.status === 200, `HTTP ${r.status}`);
    } else {
      add(
        'a real photo is refused (samples only)',
        refused,
        refused
          ? ''
          : `HTTP ${r.status}: was the real-photo switch turned on? Then pass --real-photos`,
      );
    }
  });

  // 9. A sample report, read like an upload.
  await attempt('sample report', async () => {
    const r = await request(jar, '/api/demo/sample-report', { method: 'POST' });
    add(
      'a sample report is attached and read',
      r.status >= 200 && r.status < 300,
      `HTTP ${r.status}`,
    );
  });

  // 10. The chat answers one message.
  await attempt('chat', async () => {
    const before = await request(jar, '/api/chat');
    const info = await before.json().catch(() => null);
    const r = await request(jar, '/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Hello! In one sentence, what can you help me with?' }),
    });
    const events = parseNdjson(await r.text());
    const text = events
      .filter((e) => e.type === 'text')
      .map((e) => e.delta ?? '')
      .join('');
    const done = events.some((e) => e.type === 'done');
    const errored = events.some((e) => e.type === 'error');
    add(
      'the chat answers a message',
      r.status === 200 && done && !errored && text.trim().length > 0,
      errored ? 'the reply failed (the AI key?)' : `HTTP ${r.status}`,
    );
    const real = info?.sample === false;
    if (options.expectRealAi)
      add(
        'the chat is the real AI (--real-ai)',
        real,
        real ? '' : 'the scripted stand-in answered: is the AI key set?',
      );
    else add('AI', null, real ? 'the real AI' : 'the scripted stand-in (no AI key)');
  });

  // 11–13. The hackathon exceptions of 2026-10-24 (docs/deploy/demo.md), each reported when off
  // and required with its flag: My CV on the built-in stand-in, plan-map words, Read aloud.
  const json = { 'content-type': 'application/json' };
  await attempt('My CV', async () => {
    const page = await request(jar, '/cv');
    if (page.status === 404) {
      if (options.expectCv)
        add('My CV page loads (--cv)', false, 'HTTP 404: is UF_CV=1 set (and redeployed)?');
      else add('My CV', null, 'off (/cv answers 404); --cv requires it');
      return;
    }
    add('My CV page loads', page.status === 200, `HTTP ${page.status}`);
    // The learner's own opt-in, their school ticked, "Make my CV": on the demo the stand-in
    // finishes it in the request, so the list says ready on the next read.
    const opted = await request(jar, '/api/me/cv/opt-in', {
      method: 'POST',
      headers: json,
      body: '{}',
    });
    const ticked = await request(jar, '/api/me/cv/selection', {
      method: 'PUT',
      headers: json,
      body: JSON.stringify(CV_SELECTION),
    });
    const made = await request(jar, '/api/me/cv/drafts', {
      method: 'POST',
      headers: json,
      body: '{}',
    });
    let status = 'none';
    for (let i = 0; i < 3 && status !== 'ready'; i++) {
      const list = await request(jar, '/api/me/cv/documents');
      const body = await list.json().catch(() => null);
      status = body?.documents?.[0]?.status ?? 'none';
    }
    add(
      'a CV is made on the stand-in',
      opted.status === 200 && ticked.status === 200 && made.status === 202 && status === 'ready',
      `opt-in HTTP ${opted.status}, ticks HTTP ${ticked.status}, make HTTP ${made.status}, then ${status}`,
    );
  });
  await attempt('plan-map words', async () => {
    const list = await request(jar, '/api/me/plan-maps');
    const maps = await list.json().catch(() => null);
    const id = maps?.maps?.[0]?.id;
    if (!maps?.wordsAllowed || !id) {
      if (options.expectPlanWords)
        add(
          'plan-map words save (--plan-words)',
          false,
          id ? 'words are off: is UF_MINDMAP_WORDS=1 set?' : `no plan map (HTTP ${list.status})`,
        );
      else add('plan-map words', null, 'off; --plan-words requires them');
      return;
    }
    const read = await request(jar, `/api/me/plan-maps/${id}`);
    const part = (await read.json().catch(() => null))?.map?.nodes?.find((n) => n.parentId);
    const saved = await request(jar, `/api/me/plan-maps/${id}/nodes/${part?.id}`, {
      method: 'PUT',
      headers: json,
      body: JSON.stringify({ text: PLAN_WORDS }),
    });
    const node = (await saved.json().catch(() => null))?.node;
    add(
      options.expectPlanWords ? 'plan-map words save (--plan-words)' : 'plan-map words save',
      saved.status === 200 && node?.text === PLAN_WORDS,
      `HTTP ${saved.status}`,
    );
  });
  await attempt('Read aloud', async () => {
    const r = await request(jar, '/api/speech');
    const on = (await r.json().catch(() => null))?.available === true;
    if (options.expectReadAloud)
      add(
        'Read aloud is on (--read-aloud)',
        on,
        on ? '' : 'off: are ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID set (and redeployed)?',
      );
    else add('Read aloud', null, on ? 'on (ElevenLabs)' : 'off (no ElevenLabs key)');
  });

  // 14. Sign out.
  await attempt('sign out', async () => {
    const out = await request(jar, '/api/auth/sign-out', { method: 'POST' });
    const me = await request(jar, '/api/me');
    const home = await request(jar, '/home');
    add(
      'sign out',
      out.status === 200 && me.status === 401 && isRedirect(home.status),
      `sign-out HTTP ${out.status}, then /api/me ${me.status}, /home ${home.status}`,
    );
  });

  return rows;
}

export function parseNdjson(text) {
  const events = [];
  for (const line of String(text).split('\n')) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      events.push({ type: 'unparseable' });
    }
  }
  return events;
}

/** A plain table: result, check, detail. */
export function formatTable(rows) {
  const label = (ok) => (ok === true ? 'PASS' : ok === false ? 'FAIL' : 'INFO');
  const width = Math.max(5, ...rows.map((r) => r.check.length));
  const lines = [`${'RESULT'.padEnd(6)}  ${'CHECK'.padEnd(width)}  DETAIL`];
  lines.push(`${'-'.repeat(6)}  ${'-'.repeat(width)}  ${'-'.repeat(6)}`);
  for (const row of rows)
    lines.push(`${label(row.ok).padEnd(6)}  ${row.check.padEnd(width)}  ${row.detail}`.trimEnd());
  const failed = rows.filter((r) => r.ok === false).length;
  const passed = rows.filter((r) => r.ok === true).length;
  lines.push('');
  lines.push(
    failed === 0
      ? `All ${passed} checks passed.`
      : `${failed} of ${passed + failed} checks FAILED.`,
  );
  return lines.join('\n');
}

export const exitCode = (rows) => (rows.some((r) => r.ok === false) ? 1 : 0);

/**
 * The same walk in a real Chromium (`--browser`): the landing page's judges' entry, a learner's
 * start button, home and three pages, "Switch learner". Playwright comes from apps/web.
 */
export async function runBrowser({ base, options = {} }) {
  const rows = [];
  const add = (check, ok, detail = '') => rows.push({ check, ok, detail });
  let chromium;
  try {
    const require = createRequire(
      resolve(fileURLToPath(import.meta.url), '../../../apps/web/package.json'),
    );
    ({ chromium } = require('@playwright/test'));
  } catch {
    add('browser', false, 'Playwright is not installed (pnpm install at the repo root)');
    return rows;
  }
  let browser;
  try {
    browser = await chromium.launch();
  } catch {
    add(
      'browser',
      false,
      'Chromium is missing: pnpm --filter @universityflow/web exec playwright install chromium',
    );
    return rows;
  }
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
    page.setDefaultTimeout(options.timeoutMs ?? 90_000);
    await page.goto(`${base}/`);
    await page.locator('a[href="/demo"]').first().click();
    await page.waitForURL(/\/demo$/);
    add('browser: "Demo for judges" opens the picker', true);
    await page.locator('form[action="/api/demo/start"] button[type="submit"]').first().click();
    await page.waitForURL(/\/home$/);
    const pages = [];
    for (const path of FURTHER_PAGES) {
      await page.goto(`${base}${path}`);
      const signed = await page.locator('form[action="/api/demo/switch"]').count();
      if (!signed) throw new Error(`signed out at ${path}`);
      pages.push(path);
    }
    const sideways = await page.evaluate(
      () => (document.scrollingElement?.scrollWidth ?? 0) - window.innerWidth,
    );
    add(
      'browser: a learner starts and stays signed in (360 px)',
      true,
      ['/home', ...pages].join(' → '),
    );
    add(
      'browser: no sideways scroll at 360 px',
      sideways <= 0,
      sideways > 0 ? `${sideways}px too wide` : '',
    );
    await page.locator('form[action="/api/demo/switch"] button').first().click();
    await page.waitForURL(/\/demo$/);
    add('browser: "Switch learner" goes back to the picker', true);
  } catch (error) {
    add('browser walk', false, String(error?.message ?? error).split('\n')[0]);
  } finally {
    await browser.close();
  }
  return rows;
}

async function main() {
  let options;
  try {
    options = parseSmokeArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  console.log(`Checking the judge demo at ${options.url} …`);
  const rows = await runSmoke({ base: options.url, options, log: (line) => console.log(line) });
  if (options.browser) rows.push(...(await runBrowser({ base: options.url, options })));
  console.log('');
  console.log(formatTable(rows));
  process.exit(exitCode(rows));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`demo:smoke stopped: ${error?.message ?? 'unknown error'}`);
    process.exit(1);
  });
}
