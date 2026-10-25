import { randomInt } from 'node:crypto';
import { en } from '@universityflow/content';
import type { Store } from '@universityflow/db';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Browser } from './harness';

/**
 * The judge demo's on-screen phone sign-up (a HACKATHON EXCEPTION the owner approved on
 * 2026-10-24, docs/deploy/demo.md), through the route handlers with a real embedded database:
 * a judge signs up as a new learner with a made-up 080 number. Nothing is sent: the PIN comes back
 * to the screen that asked for it, and so does a minor's guardian link. Any number that isn't a
 * toll-free 080 one is refused, the learner's and the guardian's. A minor's data waits for the
 * made-up guardian's yes (hard rule 5); the account is a demo learner, deleted with "Switch
 * learner" or by the 24-hour sweep. The PIN is never logged (hard rule 4).
 */

process.env['UF_DEPLOYMENT'] = 'demo';
process.env['UF_DEMO_PROJECT'] = '1';
process.env['UF_DEMO_PHONE_SIGNUP'] = 'onscreen';
process.env['AUTH_SECRET'] = 'demo-test-secret-that-is-long-enough-0123456789';

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

vi.mock('../lib/server/demo/personas', async () => {
  const { en: content } = await import('@universityflow/content');
  const { DEMO_PERSONA_IDS } = await import('../lib/server/demo/types');
  return {
    DEMO_PERSONAS: DEMO_PERSONA_IDS.map((id) => ({ id, ...content.demoPersonas.personas[id] })),
    cloneDemoPersona: async (store: Store) => {
      const number = `+2782${String(randomInt(0, 10_000_000)).padStart(7, '0')}`;
      const challenge = await store.requestOtp(number);
      if (challenge.review) throw new Error('unexpected');
      const { studentId } = await store.verifyOtp(number, challenge.code);
      await store.setDateOfBirth(studentId, '2006-03-14');
      await store.consentAsAdult(studentId, en.adultConsent.version);
      return studentId;
    },
  };
});

const routes = {
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  me: (await import('../app/api/me/route')).GET,
  patchMe: (await import('../app/api/me/route')).PATCH,
  dateOfBirth: (await import('../app/api/me/date-of-birth/route')).POST,
  adultConsent: (await import('../app/api/me/adult-consent/route')).POST,
  guardian: (await import('../app/api/me/guardian/route')).POST,
  consent: (await import('../app/api/consent/[token]/route')).POST,
  switch: (await import('../app/api/demo/switch/route')).POST,
  start: (await import('../app/api/demo/start/route')).POST,
};
const { getServices } = await import('../lib/server/services');

/** A made-up toll-free number, built at runtime (hard rule 4). */
const tollFree = () => `080${String(randomInt(0, 10_000_000)).padStart(7, '0')}`;
/** A cellphone-looking number, built at runtime: the demo must refuse it. */
const cellphone = () => `082${String(randomInt(0, 10_000_000)).padStart(7, '0')}`;

let ip = 1;
const fresh = () => ({ 'x-forwarded-for': `203.0.113.${ip++}` });

type PinBody = {
  ok?: boolean;
  phoneMasked?: string;
  demoPin?: string;
  error?: string;
  detail?: string;
};

async function requestPin(browser: Browser, phone: string, headers = fresh()) {
  return browser.json<PinBody>(routes.requestPin, '/api/auth/request-pin', {
    json: { phone },
    headers,
  });
}

/** Signs up with a fresh 080 number; returns the number. */
async function signUp(browser: Browser): Promise<string> {
  const phone = tollFree();
  const asked = await requestPin(browser, phone);
  expect(asked.status).toBe(200);
  const verified = await browser.json<{ ok: boolean; isNewStudent: boolean }>(
    routes.verifyPin,
    '/api/auth/verify-pin',
    { json: { phone, pin: asked.body.demoPin } },
  );
  expect(verified.status).toBe(200);
  return phone;
}

async function accountId(browser: Browser): Promise<string> {
  const me = await browser.json<{ account: { id: string } }>(routes.me, '/api/me');
  expect(me.status).toBe(200);
  return me.body.account.id;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** Moves the clock (Date only) past a number's one-minute PIN cooldown. */
function pastCooldown() {
  const now = Date.now();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now + 61_000);
}

describe('POST /api/auth/request-pin on the demo, with the on-screen sign-up', () => {
  it('an 080 number gets its PIN back on screen, and no SMS is sent', async () => {
    const { sms } = await getServices();
    const send = vi.spyOn(sms, 'send');
    const { status, body } = await requestPin(new Browser(), tollFree());
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.demoPin).toMatch(/^\d{6}$/);
    expect(body.phoneMasked).toMatch(/\d{3}$/);
    expect(send).not.toHaveBeenCalled();
  });

  it('refuses a cellphone number, saying to use a made-up 080 number', async () => {
    const { status, body } = await requestPin(new Browser(), cellphone());
    expect(status).toBe(400);
    expect(body).toMatchObject({ error: 'phone', detail: 'demo-080-only' });
    expect(body.demoPin).toBeUndefined();
  });

  it('refuses any other number too (a landline, a sharecall)', async () => {
    for (const phone of ['0115550000', '0860000000']) {
      const { status, body } = await requestPin(new Browser(), phone);
      expect(status, phone).toBe(400);
      expect(body.detail).toBe('demo-080-only');
    }
  });

  it('never logs the PIN or the number (hard rule 4)', async () => {
    const lines: string[] = [];
    for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        lines.push(args.map(String).join(' '));
      });
    }
    const phone = tollFree();
    const { body } = await requestPin(new Browser(), phone);
    const pin = body.demoPin ?? 'missing';
    expect(pin).toMatch(/^\d{6}$/);
    for (const line of lines) {
      expect(line).not.toContain(pin);
      expect(line).not.toContain(phone.slice(1));
    }
  });

  it('allows 100 PIN requests an hour from one address (a judging room), then 429', async () => {
    const headers = { 'x-forwarded-for': '198.51.100.77' };
    const statuses: number[] = [];
    for (let i = 0; i < 101; i++)
      statuses.push((await requestPin(new Browser(), tollFree(), headers)).status);
    expect(statuses.slice(0, 100).every((s) => s === 200)).toBe(true);
    expect(statuses[100]).toBe(429);
  }, 120_000);

  it('sweeps the demo’s old learners as it goes', async () => {
    const { store } = await getServices();
    const sweep = vi.spyOn(store, 'sweepDemoStudents');
    await requestPin(new Browser(), tollFree());
    expect(sweep).toHaveBeenCalled();
  });
});

describe('a number already taken (two judges picking the same easy number)', () => {
  it('another browser gets no PIN for it, and is told to pick another made-up number', async () => {
    const phone = await signUp(new Browser());
    const other = await requestPin(new Browser(), phone);
    expect(other.status).toBe(409);
    expect(other.body).toMatchObject({ error: 'phone', detail: 'demo-080-taken' });
    expect(other.body.demoPin).toBeUndefined();
  });

  it('another browser can’t sign in to it either, even holding a PIN', async () => {
    const owner = new Browser();
    const phone = await signUp(owner);
    // The owner, later, without its session: asks again (allowed) and gets a fresh PIN.
    owner.jar.delete('uf_session');
    pastCooldown();
    const again = await requestPin(owner, phone);
    expect(again.status).toBe(200);
    const intruder = new Browser();
    const refused = await intruder.json<PinBody>(routes.verifyPin, '/api/auth/verify-pin', {
      json: { phone, pin: again.body.demoPin },
    });
    expect(refused.status).toBe(409);
    expect(refused.body.detail).toBe('demo-080-taken');
    expect((await intruder.call(routes.me, '/api/me')).status).toBe(401);
  });

  it('the browser that made the account can sign back in to it', async () => {
    const owner = new Browser();
    const phone = await signUp(owner);
    const id = await accountId(owner);
    owner.jar.delete('uf_session');
    pastCooldown();
    const again = await requestPin(owner, phone);
    expect(again.status).toBe(200);
    const back = await owner.json<{ isNewStudent: boolean }>(
      routes.verifyPin,
      '/api/auth/verify-pin',
      { json: { phone, pin: again.body.demoPin } },
    );
    expect(back.status).toBe(200);
    expect(back.body.isNewStudent).toBe(false);
    expect(await accountId(owner)).toBe(id);
  });

  it('the browser’s mark is a keyed hash, never the number', async () => {
    const owner = new Browser();
    const phone = await signUp(owner);
    const marks = [...owner.jar].filter(([name]) => name !== 'uf_session');
    expect(marks).toHaveLength(1);
    const [, value] = marks[0] ?? ['', ''];
    expect(value).toMatch(/^[0-9a-f]{64}$/);
    expect(value).not.toContain(phone.slice(1));
  });

  it('a new number still works', async () => {
    await signUp(new Browser());
    await signUp(new Browser());
  });
});

describe('POST /api/auth/verify-pin on the demo', () => {
  it('the PIN shown signs the new learner in, at the start of onboarding', async () => {
    const browser = new Browser();
    await signUp(browser);
    const me = await browser.json<{ account: { consentStatus: string } }>(routes.me, '/api/me');
    expect(me.status).toBe(200);
    expect(me.body.account.consentStatus).toBe('unknown');
  });

  it('refuses a cellphone number there too', async () => {
    const { status, body } = await new Browser().json<PinBody>(
      routes.verifyPin,
      '/api/auth/verify-pin',
      { json: { phone: cellphone(), pin: '123456' } },
    );
    expect(status).toBe(400);
    expect(body.detail).toBe('demo-080-only');
  });

  it('a browser on a made-up learner leaves that copy (deleted) for the new account', async () => {
    const browser = new Browser();
    await browser.json(routes.start, '/api/demo/start', {
      json: { persona: 'demo-grade-11' },
      headers: fresh(),
    });
    const copy = await accountId(browser);
    await signUp(browser);
    expect(await accountId(browser)).not.toBe(copy);
    const { store } = await getServices();
    await expect(store.account(copy)).rejects.toThrow();
  });
});

describe('an adult agrees in their own name', () => {
  it('date of birth, then the adult agreement, then the profile', async () => {
    const browser = new Browser();
    await signUp(browser);
    const dob = await browser.json<{ consentStatus: string }>(
      routes.dateOfBirth,
      '/api/me/date-of-birth',
      { json: { dateOfBirth: '1990-05-05' } },
    );
    expect(dob.body.consentStatus).toBe('not-required');
    const agreed = await browser.call(routes.adultConsent, '/api/me/adult-consent', {
      json: { version: en.adultConsent.version },
    });
    expect(agreed.status).toBe(200);
    const saved = await browser.call(routes.patchMe, '/api/me', {
      method: 'PATCH',
      json: { grade: 12, displayName: 'Made-up judge' },
    });
    expect(saved.status).toBe(200);
  });
});

describe('an under-18: the made-up guardian agrees through the on-screen link', () => {
  async function minor(browser: Browser) {
    await signUp(browser);
    const dob = await browser.json<{ consentStatus: string }>(
      routes.dateOfBirth,
      '/api/me/date-of-birth',
      { json: { dateOfBirth: '2011-05-05' } },
    );
    expect(dob.body.consentStatus).toBe('pending');
  }

  it('the guardian’s link comes back on screen, no SMS is sent, and the yes lets the learner in', async () => {
    const browser = new Browser();
    await minor(browser);
    // Nothing about the minor is processed before the guardian agrees (hard rule 5).
    const early = await browser.call(routes.patchMe, '/api/me', {
      method: 'PATCH',
      json: { grade: 11 },
    });
    expect(early.status).toBe(403);

    const { sms } = await getServices();
    const send = vi.spyOn(sms, 'send');
    const asked = await browser.json<{ ok: boolean; demoConsentLink?: string }>(
      routes.guardian,
      '/api/me/guardian',
      { json: { name: 'Made-up Guardian', phone: tollFree(), relationship: 'parent' } },
    );
    expect(asked.status).toBe(200);
    expect(send).not.toHaveBeenCalled();
    const link = asked.body.demoConsentLink ?? '';
    expect(link).toMatch(/^\/consent\/[A-Za-z0-9_-]{20,}$/);

    const token = link.slice('/consent/'.length);
    const granted = await new Browser().json<{ status: string }>(
      routes.consent,
      `/api/consent/${token}`,
      { json: { action: 'grant' }, params: { token } },
    );
    expect(granted.body.status).toBe('granted');

    const later = await browser.call(routes.patchMe, '/api/me', {
      method: 'PATCH',
      json: { grade: 11 },
    });
    expect(later.status).toBe(200);
  });

  it('refuses a guardian’s cellphone number, saying to use a made-up 080 number', async () => {
    const browser = new Browser();
    await minor(browser);
    const refused = await browser.json<{ error: string; detail: string }>(
      routes.guardian,
      '/api/me/guardian',
      { json: { name: 'Made-up Guardian', phone: cellphone(), relationship: 'parent' } },
    );
    expect(refused.status).toBe(400);
    expect(refused.body).toMatchObject({ error: 'phone', detail: 'demo-080-only' });
  });
});

describe('the account is a demo learner', () => {
  it('"Switch learner" deletes it, as it deletes a made-up learner’s copy', async () => {
    const browser = new Browser();
    await signUp(browser);
    const id = await accountId(browser);
    const response = await browser.call(routes.switch, '/api/demo/switch', {
      method: 'POST',
      body: '',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(response.status).toBe(303);
    const { store } = await getServices();
    await expect(store.account(id)).rejects.toThrow();
  });
});
