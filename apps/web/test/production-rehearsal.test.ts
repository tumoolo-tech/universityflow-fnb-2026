import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { en } from '@universityflow/content';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { BLANK_IN_PRODUCTION, rehearsalEnv } from '../e2e/production-rehearsal-env';
import { Browser } from './harness';

/**
 * The production rehearsal (docs/deploy/production.md): the real learner's journey through the
 * route handlers, under the environment the rehearsal E2E (e2e/production-rehearsal.spec.ts) runs
 * its production build with. Phone sign-up with a PIN by SMS, a minor's guardian agreeing through
 * the SMS link, an adult agreeing in their own name, signing out and in again, and deleting the
 * account. The SMS company is the stand-in outbox: the one difference from real production, which
 * the first block pins down.
 */

const PORT = 3102;
const ENV = rehearsalEnv(PORT, 0);

// The rehearsal's environment, but the database in memory and the files in the harness's folder.
for (const [name, value] of Object.entries(ENV)) {
  if (name === 'DATABASE_URL' || name === 'UF_FILE_STORE_DIR') continue;
  if (value === '') delete process.env[name];
  else process.env[name] = value;
}

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);
// 18:00 in South Africa: the guardian's SMS goes at once, never held for the morning (A12-04).
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-10-14T16:00:00Z'));
afterAll(() => {
  vi.useRealTimers();
});

const { readConfig } = await import('../lib/server/config');

describe('the rehearsal’s environment: production, but for the stand-ins', () => {
  /** The same variables on Vercel production, where the escape is ignored. */
  const onVercel = {
    ...ENV,
    NODE_ENV: 'production',
    VERCEL: '1',
    VERCEL_ENV: 'production',
    VERCEL_REGION: 'cpt1',
  };

  it('is refused on a host for one reason only: the stand-ins in place of the accounts', () => {
    expect(() => readConfig(onVercel)).toThrow(
      'Production must use live providers (UF_PROVIDERS=live)',
    );
  });

  it('with the owner’s accounts in their place (and nothing else changed), production starts', () => {
    const config = readConfig(
      {
        ...onVercel,
        UF_PROVIDERS: 'live',
        DATABASE_URL: 'postgres://universityflow@rds.example.invalid/universityflow',
        UF_PUBLIC_URL: 'https://universityflow.example',
        UF_S3_BUCKET: 'universityflow-files',
        UF_SMS_PROVIDER: 'owner-sms',
        UF_JOBS_PROVIDER: 'owner-jobs',
        ANTHROPIC_API_KEY: 'test-key-not-real',
      },
      { sms: ['owner-sms'], jobs: ['owner-jobs'], inbound: { sms: ['owner-sms'] } },
    );
    expect(config.production).toBe(true);
  });

  it('runs locally as production would: no drafts, no preview switch, nothing of the demo’s', () => {
    const config = readConfig({ ...ENV, NODE_ENV: 'production' });
    expect(config).toMatchObject({
      production: false,
      staging: false,
      demo: false,
      providers: 'local',
      catalogueDrafts: false,
      catalogueE2eFixtures: false,
      profilePhoto: false,
      mindmapWords: false,
      cv: false,
      demoSignup: null,
      demoUrl: null,
    });
    // The main E2E run's switches are each blanked, whatever the shell has set.
    for (const name of ['UF_CATALOGUE_PREVIEW', 'UF_CATALOGUE_E2E_FIXTURES', 'UF_CV']) {
      expect(BLANK_IN_PRODUCTION).toContain(name);
    }
  });
});

const { getServices } = await import('../lib/server/services');
const routes = {
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  signOut: (await import('../app/api/auth/sign-out/route')).POST,
  me: await import('../app/api/me/route'),
  dob: (await import('../app/api/me/date-of-birth/route')).POST,
  adultConsent: (await import('../app/api/me/adult-consent/route')).POST,
  guardian: (await import('../app/api/me/guardian/route')).POST,
  consent: (await import('../app/api/consent/[token]/route')).POST,
  outbox: (await import('../app/api/dev/outbox/route')).GET,
};

let n = 7_300_000;
/** A synthetic number, built at run time (hard rule 4). */
const phone = () => `082${String(n++).padStart(7, '0')}`;
let ip = 1;
/** Each sign-in from its own TEST-NET-3 address, as learners' are. */
const address = () => ({ 'x-forwarded-for': `203.0.113.${ip++}` });

async function smsTo(local: string): Promise<string[]> {
  const { body } = await new Browser().json<{ messages: Array<{ to: string; body: string }> }>(
    routes.outbox,
    '/api/dev/outbox',
  );
  return body.messages.filter((m) => m.to === `+27${local.slice(1)}`).map((m) => m.body);
}

/** Phone sign-in: a PIN by SMS, typed back. */
async function signIn(browser: Browser, number: string): Promise<void> {
  // A minute on, past the per-number PIN cooldown (OTP_COOLDOWN_MS), as a learner would be.
  vi.setSystemTime(new Date(Date.now() + 61_000));
  const before = (await smsTo(number)).length;
  const headers = address();
  const asked = await browser.call(routes.requestPin, '/api/auth/request-pin', {
    json: { phone: number },
    headers,
  });
  expect(asked.status).toBe(200);
  const texts = await smsTo(number);
  expect(texts).toHaveLength(before + 1);
  // The outbox lists the newest first.
  const pin = texts[0]?.match(/\b(\d{6})\b/)?.[1];
  const verified = await browser.call(routes.verifyPin, '/api/auth/verify-pin', {
    json: { phone: number, pin },
    headers,
  });
  expect(verified.status).toBe(200);
}

interface Me {
  account: { id: string; dateOfBirth: string | null; consentStatus: string };
  profile: { displayName: string | null; grade: number | null } | null;
  ready: boolean;
  photo: unknown;
}
const me = (browser: Browser) => browser.json<Me>(routes.me.GET, '/api/me');

describe('the real journey, with the SMS company as the stand-in', () => {
  it('a minor signs up by PIN, a guardian agrees by the SMS link, signs out and in, and deletes the account', async () => {
    const learner = phone();
    const browser = new Browser();
    await signIn(browser, learner);
    expect((await me(browser)).body).toMatchObject({
      ready: false,
      account: { dateOfBirth: null },
    });

    await browser.json(routes.dob, '/api/me/date-of-birth', {
      json: { dateOfBirth: '2010-06-06' },
    });
    expect((await me(browser)).body).toMatchObject({
      ready: false,
      account: { consentStatus: 'pending' },
    });
    // Hard rule 5: nothing about the minor is processed before the guardian agrees.
    expect(
      (
        await browser.call(routes.me.PATCH, '/api/me', {
          method: 'PATCH',
          json: { displayName: 'Lindi' },
        })
      ).status,
    ).not.toBe(200);

    const guardianPhone = phone();
    const asked = await browser.json(routes.guardian, '/api/me/guardian', {
      json: { name: 'Test Guardian', phone: guardianPhone, relationship: 'parent' },
    });
    expect(asked).toEqual({ status: 200, body: { ok: true } });
    const [text] = await smsTo(guardianPhone);
    // The link is on this deployment's own address (A1-50 holds production to https).
    const link = text?.match(/https?:\/\/\S+\/consent\/([\w-]+)/);
    expect(link?.[0].startsWith(`http://localhost:${PORT}/consent/`)).toBe(true);

    const agreed = await new Browser().json(routes.consent, `/api/consent/${link?.[1]}`, {
      json: { action: 'grant' },
      params: { token: link?.[1] ?? '' },
    });
    expect(agreed).toEqual({ status: 200, body: { ok: true, status: 'granted' } });
    expect((await me(browser)).body).toMatchObject({
      ready: true,
      account: { consentStatus: 'granted' },
    });
    const saved = await browser.call(routes.me.PATCH, '/api/me', {
      method: 'PATCH',
      json: { displayName: 'Lindi', grade: 11 },
    });
    expect(saved.status).toBe(200);
    const accountId = (await me(browser)).body.account.id;

    // Sign out: the session is gone.
    expect(
      (await browser.call(routes.signOut, '/api/auth/sign-out', { method: 'POST' })).status,
    ).toBe(200);
    expect((await browser.call(routes.me.GET, '/api/me')).status).toBe(401);

    // Sign in again: the same account, consent and profile kept.
    await signIn(browser, learner);
    expect((await me(browser)).body).toMatchObject({
      ready: true,
      account: { id: accountId, consentStatus: 'granted' },
      profile: { displayName: 'Lindi', grade: 11 },
    });

    // Delete the account: signed out, and the number starts again from nothing.
    expect((await browser.call(routes.me.DELETE, '/api/me', { method: 'DELETE' })).status).toBe(
      200,
    );
    expect((await browser.call(routes.me.GET, '/api/me')).status).toBe(401);
    await signIn(browser, learner);
    const fresh = (await me(browser)).body;
    expect(fresh.account.id).not.toBe(accountId);
    expect(fresh).toMatchObject({ ready: false, account: { dateOfBirth: null } });
  });

  it('an adult agrees in their own name, signs out and in again, and is still in', async () => {
    const learner = phone();
    const browser = new Browser();
    await signIn(browser, learner);
    await browser.json(routes.dob, '/api/me/date-of-birth', {
      json: { dateOfBirth: '2000-03-15' },
    });
    expect((await me(browser)).body.ready).toBe(false);
    const agreed = await browser.call(routes.adultConsent, '/api/me/adult-consent', {
      json: { version: en.adultConsent.version },
    });
    expect(agreed.status).toBe(200);
    expect((await me(browser)).body).toMatchObject({
      ready: true,
      account: { consentStatus: 'not-required' },
      // No photo for anyone in production until consent v4 names it; no demo samples either.
      photo: null,
    });
    await browser.call(routes.signOut, '/api/auth/sign-out', { method: 'POST' });
    await signIn(browser, learner);
    expect((await me(browser)).body.ready).toBe(true);
    const { config } = await getServices();
    expect(config.demo).toBe(false);
  });
});

/** Every route handler under a folder, as [path, method, handler]. */
async function routesUnder(dir: string) {
  const found: Array<[string, string, (r: Request, c: unknown) => Promise<Response>]> = [];
  const walk = async (at: string) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = join(at, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.name === 'route.ts') {
        const module = (await import(/* @vite-ignore */ pathToFileURL(path).href)) as Record<
          string,
          unknown
        >;
        for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
          const handler = module[method];
          if (typeof handler === 'function') {
            found.push([relative(dir, path), method, handler as never]);
          }
        }
      }
    }
  };
  await walk(dir);
  return found;
}

describe('production shows nothing of the demo', () => {
  it('every route under /api/demo answers 404, the judges’ sign-up and sample photos included', async () => {
    const dir = join(import.meta.dirname, '../app/api/demo');
    const found = await routesUnder(dir);
    // start, switch, sample-report, sign-up and the sample photos, at least.
    expect(found.length).toBeGreaterThanOrEqual(5);
    for (const [path, method, handler] of found) {
      const browser = new Browser();
      const response = await browser.call(handler, `/api/demo/${path}`, {
        method,
        ...(method === 'GET' ? {} : { json: { persona: 'demo-grade-11' } }),
        params: { id: 'sample-1' },
      });
      expect(response.status, `${method} ${path}`).toBe(404);
    }
  });
});
