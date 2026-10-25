import { describe, expect, it, vi } from 'vitest';
import { agreeAsAdult } from './adult-consent';
import { Browser, type CallOptions } from './harness';

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

/**
 * The mobile app's sign-in, over the real handlers. The app has no Origin and no cookies: it
 * says who it is with `x-uf-client: native`, and gets a bearer token back. The negative cases
 * are the security half: each one is refused only because of the rule in `assertSameOrigin`,
 * and each would pass (and so fail this test) if that rule were looser.
 */

const routes = {
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  signOut: (await import('../app/api/auth/sign-out/route')).POST,
  me: await import('../app/api/me/route'),
  dob: (await import('../app/api/me/date-of-birth/route')).POST,
  outbox: (await import('../app/api/dev/outbox/route')).GET,
};

let n = 3_000_000;
/** A synthetic number, built at runtime (hard rule 4). */
const phone = () => `082${String(n++).padStart(7, '0')}`;

/** What the app sends: no Origin, no Cookie, the client header. */
const NATIVE: CallOptions = { origin: null, headers: { 'x-uf-client': 'native' } };

async function smsTo(to: string) {
  const { body } = await new Browser().json<{ messages: Array<{ to: string; body: string }> }>(
    routes.outbox,
    '/api/dev/outbox',
  );
  const e164 = `+27${to.slice(1)}`;
  return body.messages.filter((m) => m.to === e164);
}

async function pinFor(to: string) {
  return (await smsTo(to)).at(-1)?.body.match(/\b(\d{6})\b/)?.[1] ?? '';
}

/** Signs in the way the app does and returns the token. */
async function nativeSignIn(number = phone()) {
  const app = new Browser();
  const requested = await app.json(routes.requestPin, '/api/auth/request-pin', {
    ...NATIVE,
    json: { phone: number },
  });
  expect(requested.status).toBe(200);
  const verified = await app.json<{ ok: boolean; isNewStudent: boolean; token?: string }>(
    routes.verifyPin,
    '/api/auth/verify-pin',
    { ...NATIVE, json: { phone: number, pin: await pinFor(number) } },
  );
  return { app, verified, number };
}

describe('the mobile app signs in (no Origin, no Cookie, x-uf-client: native)', () => {
  it('requests a PIN and verifies it, getting a token and no cookie', async () => {
    const { app, verified } = await nativeSignIn();
    expect(verified.status).toBe(200);
    expect(verified.body).toMatchObject({ ok: true, isNewStudent: true });
    expect(verified.body.token).toEqual(expect.any(String));
    expect(verified.body.token?.length).toBeGreaterThan(20);
    // A cookie would sit in the phone's native jar and break the next sign-in.
    expect(app.jar.size).toBe(0);
  });

  it('uses the token as a bearer on GET /api/me and on writes', async () => {
    const { verified } = await nativeSignIn();
    const bearer = verified.body.token ?? '';
    const app = new Browser();
    const me = await app.json<{ account: { consentStatus: string }; ready: boolean }>(
      routes.me.GET,
      '/api/me',
      { bearer, origin: null },
    );
    expect(me.status).toBe(200);
    expect(me.body.ready).toBe(false);

    const dob = await app.json(routes.dob, '/api/me/date-of-birth', {
      bearer,
      origin: null,
      json: { dateOfBirth: '2000-02-02' },
    });
    expect(dob).toMatchObject({ status: 200, body: { consentStatus: 'not-required' } });

    // An adult agrees in their own name before using the app (A7-04), with the same bearer.
    await agreeAsAdult(app, { bearer, origin: null });
    const ready = await app.json<{ ready: boolean }>(routes.me.GET, '/api/me', {
      bearer,
      origin: null,
    });
    expect(ready.body.ready).toBe(true);
  });

  it('signing out revokes the token on the server', async () => {
    const { verified } = await nativeSignIn();
    const bearer = verified.body.token ?? '';
    const app = new Browser();
    const out = await app.json(routes.signOut, '/api/auth/sign-out', {
      bearer,
      origin: null,
      method: 'POST',
    });
    expect(out.status).toBe(200);
    expect((await app.json(routes.me.GET, '/api/me', { bearer, origin: null })).status).toBe(401);
  });
});

describe('what the native exemption does not cover', () => {
  const forbidden = { status: 403, body: { error: 'forbidden' } };

  it('refuses x-uf-client: native with a foreign Origin (a page script can set the header)', async () => {
    const number = phone();
    const result = await new Browser().json(routes.requestPin, '/api/auth/request-pin', {
      origin: 'https://evil.example',
      headers: { 'x-uf-client': 'native' },
      json: { phone: number },
    });
    expect(result).toMatchObject(forbidden);
    expect(await smsTo(number)).toHaveLength(0);
  });

  it('refuses verify-pin with x-uf-client: native and a foreign Origin, issuing no token', async () => {
    const number = phone();
    const app = new Browser();
    await app.json(routes.requestPin, '/api/auth/request-pin', {
      ...NATIVE,
      json: { phone: number },
    });
    const result = await app.json<{ token?: string }>(routes.verifyPin, '/api/auth/verify-pin', {
      origin: 'https://evil.example',
      headers: { 'x-uf-client': 'native' },
      json: { phone: number, pin: await pinFor(number) },
    });
    expect(result).toMatchObject(forbidden);
    expect(result.body.token).toBeUndefined();
  });

  it('refuses x-uf-client: native with a Cookie and no Origin', async () => {
    const number = phone();
    const result = await new Browser().json(routes.requestPin, '/api/auth/request-pin', {
      origin: null,
      headers: { 'x-uf-client': 'native', cookie: 'uf_session=anything' },
      json: { phone: number },
    });
    expect(result).toMatchObject(forbidden);
    expect(await smsTo(number)).toHaveLength(0);
  });

  it('refuses a cookie-authenticated write dressed up as the app (CSRF through the exemption)', async () => {
    // A learner signed in on the web: their browser holds a real session cookie.
    const browser = new Browser();
    const number = phone();
    await browser.json(routes.requestPin, '/api/auth/request-pin', { json: { phone: number } });
    await browser.json(routes.verifyPin, '/api/auth/verify-pin', {
      json: { phone: number, pin: await pinFor(number) },
    });
    expect(browser.jar.get('uf_session')).toBeTruthy();

    const forged = await browser.json(routes.dob, '/api/me/date-of-birth', {
      origin: null,
      headers: { 'x-uf-client': 'native' },
      json: { dateOfBirth: '2000-02-02' },
    });
    expect(forged).toMatchObject(forbidden);
    const me = await browser.json<{ account: { dateOfBirth: string | null } }>(
      routes.me.GET,
      '/api/me',
    );
    expect(me.body.account.dateOfBirth).toBeNull();
  });

  it('still refuses a POST with no Origin and no client header', async () => {
    const number = phone();
    const result = await new Browser().json(routes.requestPin, '/api/auth/request-pin', {
      origin: null,
      json: { phone: number },
    });
    expect(result).toMatchObject(forbidden);
    expect(await smsTo(number)).toHaveLength(0);
  });

  it('refuses any other value of the client header', async () => {
    for (const value of ['web', 'Native', 'native-app', '']) {
      const result = await new Browser().json(routes.requestPin, '/api/auth/request-pin', {
        origin: null,
        headers: { 'x-uf-client': value },
        json: { phone: phone() },
      });
      expect(result, value).toMatchObject(forbidden);
    }
  });
});
