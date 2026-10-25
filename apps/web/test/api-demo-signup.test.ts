import { en } from '@universityflow/content';
import type { Store } from '@universityflow/db';
import { describe, expect, it, vi } from 'vitest';
import { mintFakeIdToken } from '../lib/demo-signup';
import { Browser } from './harness';

/**
 * The judge demo's real sign-up (a hackathon exception the owner approved on 2026-10-23,
 * docs/deploy/demo.md), through the route handlers with a real embedded database, on the fake
 * verifier (UF_DEMO_SIGNUP=fake: the Firebase verifier has its own tests). The server verifies the
 * token, finds or makes the account and opens the same session as every sign-in; the account is
 * adults only, and "Switch learner" or a made-up learner never deletes it.
 */

process.env['UF_DEPLOYMENT'] = 'demo';
process.env['UF_DEMO_PROJECT'] = '1';
process.env['UF_DEMO_SIGNUP'] = 'fake';
process.env['AUTH_SECRET'] = 'demo-test-secret-that-is-long-enough-0123456789';

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

let n = 7_300_000;
const phone = () => `+2782${String(n++).padStart(7, '0')}`;

vi.mock('../lib/server/demo/personas', async () => {
  const { en: content } = await import('@universityflow/content');
  const { DEMO_PERSONA_IDS } = await import('../lib/server/demo/types');
  return {
    DEMO_PERSONAS: DEMO_PERSONA_IDS.map((id) => ({ id, ...content.demoPersonas.personas[id] })),
    cloneDemoPersona: async (store: Store) => {
      const number = phone();
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
  signUp: (await import('../app/api/demo/sign-up/route')).POST,
  start: (await import('../app/api/demo/start/route')).POST,
  switch: (await import('../app/api/demo/switch/route')).POST,
  me: (await import('../app/api/me/route')).GET,
  dateOfBirth: (await import('../app/api/me/date-of-birth/route')).POST,
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
};
const { getServices } = await import('../lib/server/services');
const { DEMO_SIGNUPS_PER_IP_PER_HOUR } = await import('../lib/server/demo/core');

let ip = 1;
const fresh = () => ({ 'x-forwarded-for': `203.0.113.${ip++}` });
let who = 1;
const identity = () => {
  who += 1;
  return { uid: `fake-uid-${who}-${Date.now()}`, email: `judge-${who}@example.com` };
};

async function signUp(browser: Browser, idToken: string, headers = fresh()) {
  return browser.json<{ ok?: boolean; next?: string; error?: string; detail?: string }>(
    routes.signUp,
    '/api/demo/sign-up',
    { json: { idToken }, headers },
  );
}

async function accountId(browser: Browser): Promise<string> {
  const me = await browser.json<{ account: { id: string } }>(routes.me, '/api/me');
  expect(me.status).toBe(200);
  return me.body.account.id;
}

describe('POST /api/demo/sign-up', () => {
  it('a verified identity gets a new account and a session, starting at onboarding', async () => {
    const browser = new Browser();
    const { status, body } = await signUp(browser, mintFakeIdToken(identity()));
    expect(status).toBe(200);
    expect(body).toMatchObject({ ok: true, next: '/onboarding' });
    const me = await browser.json<{ account: { consentStatus: string } }>(routes.me, '/api/me');
    expect(me.body.account.consentStatus).toBe('unknown');
  });

  it('the same person signing in again gets the same account', async () => {
    const person = identity();
    const first = new Browser();
    await signUp(first, mintFakeIdToken(person));
    const second = new Browser();
    await signUp(second, mintFakeIdToken(person));
    expect(await accountId(second)).toBe(await accountId(first));
  });

  it('refuses a token the verifier refuses, and signs nobody in', async () => {
    const browser = new Browser();
    const { status, body } = await signUp(browser, 'not-a-token');
    expect(status).toBe(401);
    expect(body.error).toBe('signed-out');
    expect((await browser.call(routes.me, '/api/me')).status).toBe(401);
  });

  it('refuses another site (CSRF)', async () => {
    const browser = new Browser();
    const response = await browser.call(routes.signUp, '/api/demo/sign-up', {
      json: { idToken: mintFakeIdToken(identity()) },
      origin: 'https://evil.example',
      headers: fresh(),
    });
    expect(response.status).toBe(403);
  });

  it(`allows ${30} sign-ins an hour from one address, then 429`, async () => {
    expect(DEMO_SIGNUPS_PER_IP_PER_HOUR).toBe(30);
    const headers = { 'x-forwarded-for': '198.51.100.88' };
    for (let i = 0; i < DEMO_SIGNUPS_PER_IP_PER_HOUR; i++) {
      expect((await signUp(new Browser(), mintFakeIdToken(identity()), headers)).status).toBe(200);
    }
    expect((await signUp(new Browser(), mintFakeIdToken(identity()), headers)).status).toBe(429);
  }, 120_000);

  it('sweeps sign-ups older than 30 days (and copies older than a day) as it signs in', async () => {
    const { store } = await getServices();
    const signups = vi.spyOn(store, 'sweepDemoSignups');
    const copies = vi.spyOn(store, 'sweepDemoStudents');
    await signUp(new Browser(), mintFakeIdToken(identity()));
    expect(signups).toHaveBeenCalled();
    expect(copies).toHaveBeenCalled();
    signups.mockRestore();
    copies.mockRestore();
  });

  it('a made-up learner’s start sweeps old sign-ups too', async () => {
    const { store } = await getServices();
    const signups = vi.spyOn(store, 'sweepDemoSignups');
    await new Browser().json(routes.start, '/api/demo/start', {
      json: { persona: 'demo-grade-11' },
      headers: fresh(),
    });
    expect(signups).toHaveBeenCalled();
    signups.mockRestore();
  });

  it('phone PIN sign-in stays off', async () => {
    const response = await new Browser().call(routes.requestPin, '/api/auth/request-pin', {
      json: { phone: phone() },
    });
    expect(response.status).toBe(404);
  });
});

describe('adults only', () => {
  it('a date of birth under 18 is refused, the account deleted and the browser signed out', async () => {
    const browser = new Browser();
    await signUp(browser, mintFakeIdToken(identity()));
    const id = await accountId(browser);
    const refused = await browser.json<{ error: string; detail: string }>(
      routes.dateOfBirth,
      '/api/me/date-of-birth',
      { json: { dateOfBirth: '2010-01-01' } },
    );
    expect(refused.status).toBe(409);
    expect(refused.body).toEqual({ error: 'state', detail: 'adults-only' });
    expect((await browser.call(routes.me, '/api/me')).status).toBe(401);
    const { store } = await getServices();
    await expect(store.account(id)).rejects.toThrow();
  });

  it('under 13 keeps its own refusal, and the sign-up account goes too', async () => {
    const browser = new Browser();
    await signUp(browser, mintFakeIdToken(identity()));
    const refused = await browser.json<{ detail: string }>(
      routes.dateOfBirth,
      '/api/me/date-of-birth',
      { json: { dateOfBirth: '2018-01-01' } },
    );
    expect(refused.body.detail).toBe('too-young');
    expect((await browser.call(routes.me, '/api/me')).status).toBe(401);
  });

  it('an adult goes on to the adult agreement', async () => {
    const browser = new Browser();
    await signUp(browser, mintFakeIdToken(identity()));
    const ok = await browser.json<{ consentStatus: string }>(
      routes.dateOfBirth,
      '/api/me/date-of-birth',
      { json: { dateOfBirth: '1990-05-05' } },
    );
    expect(ok.body.consentStatus).toBe('not-required');
  });
});

describe('a judge’s own account is never deleted by the made-up learners’ buttons', () => {
  it('"Switch learner" signs out and goes to the picker, keeping the account', async () => {
    const browser = new Browser();
    await signUp(browser, mintFakeIdToken(identity()));
    const id = await accountId(browser);
    const response = await browser.call(routes.switch, '/api/demo/switch', {
      method: 'POST',
      body: '',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toMatch(/\/demo$/);
    expect((await browser.call(routes.me, '/api/me')).status).toBe(401);
    const { store } = await getServices();
    expect((await store.account(id)).id).toBe(id);
  });

  it('starting as a made-up learner signs out of it, keeping the account', async () => {
    const browser = new Browser();
    await signUp(browser, mintFakeIdToken(identity()));
    const id = await accountId(browser);
    await browser.json(routes.start, '/api/demo/start', {
      json: { persona: 'demo-grade-11' },
      headers: fresh(),
    });
    expect(await accountId(browser)).not.toBe(id);
    const { store } = await getServices();
    expect((await store.account(id)).id).toBe(id);
  });
});
