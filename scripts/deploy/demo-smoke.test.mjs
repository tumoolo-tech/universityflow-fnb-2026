import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CookieJar,
  exitCode,
  FURTHER_PAGES,
  formatTable,
  frontDoorPicture,
  parseNdjson,
  parseSmokeArgs,
  personaIdsFrom,
  runSmoke,
  syntheticPng,
} from './demo-smoke.mjs';

const BASE = 'https://uf-demo.example.test';
const PERSONAS = [
  'demo-grade-10',
  'demo-grade-11',
  'demo-grade-12',
  'demo-first-year',
  'demo-second-year',
  'demo-final-year',
];

/**
 * A fake judge demo, answering the routes the smoke walks. `faults` breaks one thing at a time:
 * - forgetAfter: a session works for this many requests, then is unknown (the missing shared
 *   database: each server instance its own sessions);
 * - noPictures, noLogos, signup, realPhotos, sampleAi, chatError, busy, health;
 * - the hackathon exceptions of 2026-10-24: cvOff (UF_CV unset), cvStuck (a CV never finishes),
 *   wordsOff (UF_MINDMAP_WORDS unset), readAloud (the ElevenLabs key set).
 */
function fakeDemo(faults = {}) {
  const sessions = new Map(); // token -> { uses, persona }
  let next = 0;
  let cvMade = false;
  const calls = [];
  const html = (body, status = 200) =>
    new Response(`<!doctype html><html><body>${body}</body></html>`, {
      status,
      headers: { 'content-type': 'text/html' },
    });
  const json = (data, status = 200) => Response.json(data, { status });
  const redirect = (to, cookie) => {
    const headers = new Headers({ location: `${BASE}${to}` });
    if (cookie) headers.append('set-cookie', cookie);
    return new Response(null, { status: 303, headers });
  };
  const session = (init) => {
    const token = /uf_session=([^;]+)/.exec(init.headers?.cookie ?? '')?.[1];
    const s = token ? sessions.get(token) : null;
    if (!s) return null;
    s.uses += 1;
    if (faults.forgetAfter !== undefined && s.uses > faults.forgetAfter) return null;
    return s;
  };
  const banner = '<form action="/api/demo/switch" method="post"><button>Switch</button></form>';
  const fetchImpl = async (url, init = {}) => {
    const { pathname } = new URL(url);
    const method = init.method ?? 'GET';
    calls.push(`${method} ${pathname}`);
    if (method !== 'GET') assert.equal(init.headers.origin, BASE, `${pathname} carries Origin`);
    assert.equal(init.redirect, 'manual');
    if (pathname === '/api/health') {
      return faults.health ? json({ status: 'unavailable' }, 503) : json({ status: 'ok' });
    }
    if (pathname === '/') {
      const pics = faults.noPictures
        ? ''
        : '<div class="uf-stage-people" aria-hidden="true" data-testid="stage-people"><img alt="" loading="lazy" src="/landing/grade-10-720.webp"/></div>';
      return html(
        `${pics}<nav aria-label="Demo for judges"><a href="/demo">Demo for judges</a></nav>`,
      );
    }
    if (pathname.startsWith('/landing/')) {
      return new Response('img', { headers: { 'content-type': 'image/webp' } });
    }
    if (pathname === '/demo') {
      const forms = PERSONAS.map(
        (id) =>
          `<form action="/api/demo/start" method="post"><input type="hidden" name="persona" value="${id}"/><button type="submit">Try</button></form>`,
      ).join('');
      const signup = faults.signup ? '<a href="/demo/sign-up">Sign up</a>' : '';
      const phone = faults.phoneSignup ? '<a href="/demo/new-learner">New learner</a>' : '';
      return html(`${banner}${forms}${signup}${phone}`);
    }
    if (pathname === '/demo/sign-up') {
      return faults.signup
        ? html('<h1>Sign up</h1><form><button>Go</button></form>')
        : html('', 404);
    }
    if (pathname === '/demo/new-learner') {
      return faults.phoneSignup
        ? html(
            '<h1>Sign up as a new learner</h1><form><input type="tel"/><button>Go</button></form>',
          )
        : html('', 404);
    }
    if (pathname === '/api/auth/request-pin') {
      if (!faults.phoneSignup) return json({ error: 'not-found' }, 404);
      const { phone } = JSON.parse(init.body);
      const tollFree = /^080\d{7}$/.test(phone);
      if (!tollFree && !faults.acceptsCellphone) {
        return json({ error: 'phone', detail: 'demo-080-only' }, 400);
      }
      return json({
        ok: true,
        phoneMasked: '•••• ••• 123',
        ...(faults.pinNotShown ? {} : { demoPin: '123456' }),
      });
    }
    if (pathname === '/api/auth/verify-pin') {
      if (!faults.phoneSignup) return json({ error: 'not-found' }, 404);
      const { phone, pin } = JSON.parse(init.body);
      assert.match(phone, /^080\d{7}$/, 'only the 080 number signs in');
      if (pin !== '123456') return json({ error: 'pin' }, 400);
      const token = `p${++next}`;
      sessions.set(token, { uses: 0, persona: null });
      return new Response('{"ok":true,"isNewStudent":true}', {
        headers: { 'set-cookie': `uf_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax` },
      });
    }
    if (pathname === '/onboarding') {
      return session(init)
        ? html('<main><h1>When were you born?</h1><form><input type="date"/></form></main>')
        : new Response(null, { status: 307, headers: { location: `${BASE}/sign-in` } });
    }
    if (pathname === '/api/demo/start') {
      const persona = new URLSearchParams(init.body).get('persona');
      if (faults.busy) return redirect('/demo?demo=busy');
      const token = `t${++next}`;
      sessions.set(token, { uses: 0, persona });
      return redirect('/home', `uf_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax`);
    }
    if (['/home', ...FURTHER_PAGES].includes(pathname)) {
      const s = session(init);
      if (!s) return new Response(null, { status: 307, headers: { location: `${BASE}/sign-in` } });
      const logo =
        !faults.noLogos && s.persona === 'demo-second-year'
          ? '<img src="/demo-logos/wits.svg"/>'
          : '';
      return html(`${banner}<main>${logo}</main>`);
    }
    if (pathname === '/api/me') {
      return session(init) ? json({ account: {} }) : json({ error: 'signed-out' }, 401);
    }
    if (pathname === '/api/demo/switch') {
      return new Response('{"ok":true}', {
        headers: { 'set-cookie': 'uf_session=; Path=/; Max-Age=0' },
      });
    }
    if (pathname.startsWith('/api/demo/sample-photos/')) {
      return new Response('png', { headers: { 'content-type': 'image/png' } });
    }
    if (pathname === '/api/me/photo') {
      if (!session(init)) return json({ error: 'signed-out' }, 401);
      if (method === 'GET')
        return new Response('jpg', { headers: { 'content-type': 'image/jpeg' } });
      const body = Buffer.from(init.body).toString('latin1');
      if (body.includes('name="file"')) {
        return faults.realPhotos
          ? json({ photo: { version: 'v2' } })
          : json({ error: 'upload', detail: 'demo-sample-photo-only' }, 400);
      }
      assert.match(init.headers['content-type'], /^multipart\/form-data; boundary=/);
      return json({ photo: { version: 'v1' } });
    }
    if (pathname === '/api/demo/sample-report') {
      return session(init) ? json({ document: { id: 'd1' } }, 201) : json({}, 401);
    }
    if (pathname === '/api/chat') {
      if (!session(init)) return json({ error: 'signed-out' }, 401);
      if (method === 'GET') return json({ sample: Boolean(faults.sampleAi), messages: [] });
      const lines = faults.chatError
        ? ['{"type":"error"}']
        : [
            '{"type":"text","delta":"I can help you plan."}',
            '{"type":"done","crisis":false,"messageId":"m1"}',
          ];
      return new Response(`${lines.join('\n')}\n`, {
        headers: { 'content-type': 'application/x-ndjson' },
      });
    }
    // The hackathon exceptions of 2026-10-24: My CV on the stand-in, plan-map words, Read aloud.
    if (pathname === '/cv') {
      if (!session(init)) return new Response(null, { status: 307, headers: { location: '/' } });
      return faults.cvOff ? html('', 404) : html(`${banner}<h1>My CV</h1>`);
    }
    if (pathname.startsWith('/api/me/cv/')) {
      if (!session(init)) return json({ error: 'signed-out' }, 401);
      if (faults.cvOff) return json({ error: 'not-found' }, 404);
      if (pathname === '/api/me/cv/opt-in') return json({ optIn: { version: 'cv-v1' } });
      if (pathname === '/api/me/cv/selection') {
        assert.equal(method, 'PUT');
        assert.equal(JSON.parse(init.body).includeSchool, true);
        return json({ ready: true, missing: [] });
      }
      if (pathname === '/api/me/cv/drafts') {
        cvMade = true;
        return json({ document: { id: 'cv1', status: 'queued' } }, 202);
      }
      if (pathname === '/api/me/cv/documents') {
        const status = faults.cvStuck ? 'queued' : 'ready';
        return json({ documents: cvMade ? [{ id: 'cv1', status, hasPdf: !faults.cvStuck }] : [] });
      }
    }
    if (pathname === '/api/me/plan-maps') {
      if (!session(init)) return json({ error: 'signed-out' }, 401);
      return json({ maps: [{ id: 'm1' }], wordsAllowed: !faults.wordsOff });
    }
    if (pathname === '/api/me/plan-maps/m1') {
      return json({
        map: {
          id: 'm1',
          wordsAllowed: !faults.wordsOff,
          nodes: [
            { id: 'c1', parentId: null },
            { id: 'n1', parentId: 'c1' },
          ],
        },
      });
    }
    if (pathname === '/api/me/plan-maps/m1/nodes/n1') {
      assert.equal(method, 'PUT');
      if (faults.wordsOff) return json({ error: 'state', detail: 'words' }, 409);
      return json({ node: { id: 'n1', text: JSON.parse(init.body).text }, care: null });
    }
    if (pathname === '/api/speech') {
      if (!session(init)) return json({ error: 'signed-out' }, 401);
      return json({ available: Boolean(faults.readAloud) });
    }
    if (pathname === '/api/auth/sign-out') {
      const token = /uf_session=([^;]+)/.exec(init.headers?.cookie ?? '')?.[1];
      sessions.delete(token);
      return new Response('{"ok":true}', {
        headers: { 'set-cookie': 'uf_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT' },
      });
    }
    return html('', 404);
  };
  return { fetchImpl, calls };
}

const failures = (rows) => rows.filter((r) => r.ok === false).map((r) => r.check);

test('a healthy demo passes every check, and exits 0', async () => {
  const { fetchImpl, calls } = fakeDemo();
  const rows = await runSmoke({ base: BASE, fetchImpl, options: {} });
  assert.deepEqual(failures(rows), []);
  assert.equal(exitCode(rows), 0);
  // All six learners started; five "Switch learner"s clean up, the sixth signs out.
  assert.equal(calls.filter((c) => c === 'POST /api/demo/start').length, 6);
  assert.equal(calls.filter((c) => c === 'POST /api/demo/switch').length, 5);
  assert.ok(calls.includes('POST /api/auth/sign-out'));
  assert.ok(calls.includes('POST /api/chat'));
  assert.ok(calls.includes('POST /api/demo/sample-report'));
});

test('a session that is lost between requests fails every learner (the shared-database bug)', async () => {
  const { fetchImpl } = fakeDemo({ forgetAfter: 2 });
  const rows = await runSmoke({ base: BASE, fetchImpl, options: {} });
  const starts = rows.filter((r) => r.check.startsWith('start '));
  assert.equal(starts.length, 6);
  for (const row of starts) {
    assert.equal(row.ok, false);
    assert.match(row.detail, /signed out at \/me/);
  }
  assert.equal(exitCode(rows), 1);
});

test('each broken part fails its own check', async () => {
  const cases = [
    [{ health: true }, '/api/health answers 200'],
    [{ noPictures: true }, 'front-door pictures'],
    [{ busy: true }, `start demo-grade-10, home + ${FURTHER_PAGES.length} pages signed in`],
    [{ chatError: true }, 'the chat answers a message'],
    [{ realPhotos: true }, 'a real photo is refused (samples only)'],
  ];
  for (const [faults, check] of cases) {
    const { fetchImpl } = fakeDemo(faults);
    const rows = await runSmoke({ base: BASE, fetchImpl, options: {} });
    assert.ok(failures(rows).includes(check), `${JSON.stringify(faults)} fails "${check}"`);
  }
});

test('a 503 from /api/health points at pnpm deploy:check for the demo', async () => {
  const rows = await runSmoke({ base: BASE, fetchImpl: fakeDemo({ health: true }).fetchImpl });
  const health = rows.find((r) => r.check === '/api/health answers 200');
  assert.equal(health.ok, false);
  assert.match(health.detail, /HTTP 503/);
  assert.match(health.detail, /pnpm deploy:check --target demo/);
});

test('the switches: required with their flags, reported otherwise', async () => {
  const off = await runSmoke({
    base: BASE,
    fetchImpl: fakeDemo({ noLogos: true, sampleAi: true }).fetchImpl,
    options: {},
  });
  assert.deepEqual(failures(off), []);
  assert.equal(off.find((r) => r.check === 'judges’ sign-up page').ok, null);

  const required = await runSmoke({
    base: BASE,
    fetchImpl: fakeDemo({ noLogos: true, sampleAi: true }).fetchImpl,
    options: { expectLogos: true, expectSignup: true, expectRealAi: true },
  });
  assert.deepEqual(failures(required).sort(), [
    'judges’ sign-up page renders',
    'the chat is the real AI (--real-ai)',
    'university logos shown',
  ]);

  const on = await runSmoke({
    base: BASE,
    fetchImpl: fakeDemo({ signup: true, realPhotos: true }).fetchImpl,
    options: { expectLogos: true, expectSignup: true, expectRealAi: true, expectRealPhotos: true },
  });
  assert.deepEqual(failures(on), []);
});

test('the hackathon exceptions: My CV on the stand-in, plan-map words, Read aloud', async () => {
  const { fetchImpl, calls } = fakeDemo();
  const rows = await runSmoke({ base: BASE, fetchImpl, options: {} });
  assert.deepEqual(failures(rows), []);
  const ok = (check) => rows.find((r) => r.check === check)?.ok;
  assert.equal(ok('My CV page loads'), true);
  assert.equal(ok('a CV is made on the stand-in'), true);
  assert.equal(ok('plan-map words save'), true);
  assert.ok(calls.includes('POST /api/me/cv/drafts'));
  assert.ok(calls.includes('PUT /api/me/plan-maps/m1/nodes/n1'));
  // Read aloud is reported, like the AI line: off without the key.
  const voice = rows.find((r) => r.check === 'Read aloud');
  assert.equal(voice.ok, null);
  assert.match(voice.detail, /off/);
  // Everything after them still runs: the learner signs out last.
  assert.equal(calls.at(-3), 'POST /api/auth/sign-out');

  const broken = await runSmoke({ base: BASE, fetchImpl: fakeDemo({ cvStuck: true }).fetchImpl });
  assert.deepEqual(failures(broken), ['a CV is made on the stand-in']);
});

test('the hackathon switches: reported when off, required with their flags', async () => {
  const faults = { cvOff: true, wordsOff: true };
  const off = await runSmoke({ base: BASE, fetchImpl: fakeDemo(faults).fetchImpl, options: {} });
  assert.deepEqual(failures(off), []);
  assert.equal(off.find((r) => r.check === 'My CV').ok, null);
  assert.equal(off.find((r) => r.check === 'plan-map words').ok, null);

  const required = await runSmoke({
    base: BASE,
    fetchImpl: fakeDemo(faults).fetchImpl,
    options: { expectCv: true, expectPlanWords: true, expectReadAloud: true },
  });
  assert.deepEqual(failures(required).sort(), [
    'My CV page loads (--cv)',
    'Read aloud is on (--read-aloud)',
    'plan-map words save (--plan-words)',
  ]);

  const on = await runSmoke({
    base: BASE,
    fetchImpl: fakeDemo({ readAloud: true }).fetchImpl,
    options: { expectCv: true, expectPlanWords: true, expectReadAloud: true },
  });
  assert.deepEqual(failures(on), []);
  assert.equal(on.find((r) => r.check === 'Read aloud is on (--read-aloud)').ok, true);
});

test('the on-screen phone sign-up, off: phone sign-in must answer 404', async () => {
  const { fetchImpl, calls } = fakeDemo();
  const rows = await runSmoke({ base: BASE, fetchImpl, options: {} });
  assert.equal(rows.find((r) => r.check === 'phone PIN sign-in is off (404)').ok, true);
  assert.equal(rows.find((r) => r.check === 'on-screen phone sign-up').ok, null);
  assert.ok(!calls.includes('POST /api/auth/verify-pin'));
});

test('the on-screen phone sign-up, on: an 080 number gets its PIN on screen and reaches onboarding; a cellphone is refused', async () => {
  const { fetchImpl, calls } = fakeDemo({ phoneSignup: true });
  const rows = await runSmoke({ base: BASE, fetchImpl, options: { expectPhoneSignup: true } });
  assert.deepEqual(failures(rows), []);
  for (const check of [
    'on-screen phone sign-up page renders',
    'a made-up 080 number gets its PIN on screen',
    'a cellphone number is refused (080 only)',
    'the PIN on screen signs in and reaches onboarding',
  ]) {
    assert.equal(rows.find((r) => r.check === check)?.ok, true, check);
  }
  assert.equal(
    rows.find((r) => r.check === 'phone PIN sign-in is off (404)'),
    undefined,
  );
  // The made-up account is deleted at once ("Switch learner"), as the learners' copies are.
  assert.equal(calls.filter((c) => c === 'POST /api/demo/switch').length, 6);
});

test('the on-screen phone sign-up: each broken part fails its own check', async () => {
  const cases = [
    [{ phoneSignup: true, acceptsCellphone: true }, 'a cellphone number is refused (080 only)'],
    [{ phoneSignup: true, pinNotShown: true }, 'a made-up 080 number gets its PIN on screen'],
    [{}, 'on-screen phone sign-up linked from /demo (--phone-signup)'],
  ];
  for (const [faults, check] of cases) {
    const { fetchImpl } = fakeDemo(faults);
    const rows = await runSmoke({ base: BASE, fetchImpl, options: { expectPhoneSignup: true } });
    assert.ok(failures(rows).includes(check), `${JSON.stringify(faults)} fails "${check}"`);
  }
  assert.equal(parseSmokeArgs(['--url', BASE, '--phone-signup']).expectPhoneSignup, true);
});

test('the table names each check and says how many failed', () => {
  const table = formatTable([
    { check: '/api/health answers 200', ok: true, detail: 'HTTP 200' },
    { check: 'sign out', ok: false, detail: 'HTTP 500' },
    { check: 'AI', ok: null, detail: 'the scripted stand-in' },
  ]);
  assert.match(table, /^RESULT +CHECK +DETAIL/);
  assert.match(table, /\nPASS +\/api\/health answers 200 +HTTP 200\n/);
  assert.match(table, /\nFAIL +sign out +HTTP 500\n/);
  assert.match(table, /\nINFO +AI +the scripted stand-in\n/);
  assert.match(table, /1 of 2 checks FAILED\.$/);
  assert.match(formatTable([{ check: 'x', ok: true, detail: '' }]), /All 1 checks passed\.$/);
});

test('arguments: an https URL is required; http only for localhost', () => {
  assert.throws(() => parseSmokeArgs([]), /--url/);
  assert.throws(() => parseSmokeArgs(['--url', 'http://universityflow.vercel.app']), /https/);
  assert.throws(() => parseSmokeArgs(['--url', 'not a url']), /address/);
  assert.throws(() => parseSmokeArgs(['--url', BASE, '--nope']), /Unknown option/);
  const options = parseSmokeArgs([
    '--',
    '--url',
    `${BASE}/some/path`,
    '--browser',
    '--logos',
    '--signup',
    '--real-ai',
    '--real-photos',
    '--cv',
    '--plan-words',
    '--read-aloud',
  ]);
  assert.equal(options.url, BASE);
  assert.ok(
    options.browser &&
      options.expectLogos &&
      options.expectSignup &&
      options.expectRealAi &&
      options.expectRealPhotos &&
      options.expectCv &&
      options.expectPlanWords &&
      options.expectReadAloud,
  );
  assert.equal(parseSmokeArgs(['--url=http://localhost:3999']).url, 'http://localhost:3999');
});

test('parsing: personas from the picker, the front-door picture, NDJSON, cookies', () => {
  assert.deepEqual(
    personaIdsFrom(
      '<input type="hidden" name="persona" value="demo-grade-10"/><input name="persona" value="demo-final-year" type="hidden">',
    ),
    ['demo-grade-10', 'demo-final-year'],
  );
  assert.equal(frontDoorPicture('<p>none</p>'), null);
  assert.equal(
    frontDoorPicture(
      '<div data-testid="stage-people"><img alt="" src="/landing/a.webp?x=1&amp;y=2"/></div>',
    ),
    '/landing/a.webp?x=1&y=2',
  );
  assert.deepEqual(parseNdjson('{"type":"text"}\n\nnope\n'), [
    { type: 'text' },
    { type: 'unparseable' },
  ]);

  const jar = new CookieJar();
  jar.store(new Response(null, { headers: { 'set-cookie': 'uf_session=abc; Path=/; HttpOnly' } }));
  assert.equal(jar.header(), 'uf_session=abc');
  jar.store(new Response(null, { headers: { 'set-cookie': 'uf_session=; Path=/; Max-Age=0' } }));
  assert.equal(jar.has('uf_session'), false);
});

test('the synthetic upload picture is a real PNG, made here', () => {
  const png = syntheticPng();
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(png.subarray(12, 16).toString('ascii'), 'IHDR');
  assert.ok(png.length < 4096);
});
