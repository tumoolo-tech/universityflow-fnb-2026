import { describe, expect, it, vi } from 'vitest';
import { agreeAsAdult } from './adult-consent';
import { Browser, type CallOptions } from './harness';

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

/**
 * The app's push token (Phase 4d) over the real handlers and the embedded database: the app
 * registers its phone with its bearer token, a minor waiting for a guardian is refused, a token
 * belongs to one learner (it moves only once its holder has signed out, A5-05), removal works for
 * the owner only, and
 * signing out takes the phone off. Then a push reminder reaches the phone, with nothing personal
 * in it.
 */

const routes = {
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  signOut: (await import('../app/api/auth/sign-out/route')).POST,
  dob: (await import('../app/api/me/date-of-birth/route')).POST,
  pushToken: await import('../app/api/me/push-token/route'),
  messaging: await import('../app/api/me/messaging/route'),
  reminders: (await import('../app/api/me/reminders/route')).POST,
  outbox: (await import('../app/api/dev/outbox/route')).GET,
  runJobs: (await import('../app/api/dev/jobs/run/route')).POST,
};
const { getServices } = await import('../lib/server/services');

let n = 4_100_000;
const phone = () => `082${String(n++).padStart(7, '0')}`;
let t = 1;
const pushToken = () => `ExponentPushToken[web${String(t++).padStart(10, '0')}]`;
const NATIVE: CallOptions = { origin: null, headers: { 'x-uf-client': 'native' } };

async function pinFor(to: string) {
  const { body } = await new Browser().json<{ messages: Array<{ to: string; body: string }> }>(
    routes.outbox,
    '/api/dev/outbox',
  );
  const e164 = `+27${to.slice(1)}`;
  return (
    body.messages
      .filter((m) => m.to === e164)
      .at(-1)
      ?.body.match(/\b(\d{6})\b/)?.[1] ?? ''
  );
}

/** Signs in as the app does, sets a date of birth, and returns the bearer token. */
async function appLearner(dateOfBirth = '2000-02-02') {
  const number = phone();
  const app = new Browser();
  await app.json(routes.requestPin, '/api/auth/request-pin', {
    ...NATIVE,
    json: { phone: number },
  });
  const verified = await app.json<{ token: string }>(routes.verifyPin, '/api/auth/verify-pin', {
    ...NATIVE,
    json: { phone: number, pin: await pinFor(number) },
  });
  const bearer = verified.body.token;
  await app.json(routes.dob, '/api/me/date-of-birth', {
    bearer,
    origin: null,
    json: { dateOfBirth },
  });
  if (dateOfBirth < '2008') await agreeAsAdult(app, { bearer, origin: null });
  return { app, bearer };
}

const register = (bearer: string, token: string, platform = 'android') =>
  new Browser().json(routes.pushToken.POST, '/api/me/push-token', {
    bearer,
    origin: null,
    json: { token, platform },
  });
const remove = (bearer: string, token: string) =>
  new Browser().json<{ removed: boolean }>(routes.pushToken.DELETE, '/api/me/push-token', {
    bearer,
    origin: null,
    method: 'DELETE',
    json: { token },
  });

describe('POST /api/me/push-token', () => {
  it('registers the phone for a ready learner, with the app’s bearer token', async () => {
    const { bearer } = await appLearner();
    const token = pushToken();
    expect(await register(bearer, token)).toEqual({ status: 200, body: { ok: true } });
    // Opted in to push, the gate lets a message through to that phone.
    await new Browser().json(routes.messaging.PUT, '/api/me/messaging', {
      bearer,
      origin: null,
      method: 'PUT',
      json: { channel: 'push', optedIn: true },
    });
    expect(await (await getServices()).messaging.mayMessage('push', token)).toBe(true);
  });

  it('refuses a minor waiting for a guardian (hard rule 5), and records nothing', async () => {
    const { bearer } = await appLearner('2011-05-05');
    const token = pushToken();
    expect(await register(bearer, token)).toMatchObject({
      status: 403,
      body: { error: 'consent' },
    });
    expect(await (await getServices()).messaging.mayMessage('push', token)).toBe(false);
    expect(await remove(bearer, token)).toEqual({ status: 200, body: { removed: false } });
  });

  it('refuses signed out, a cookie session, a malformed token or platform, and extra fields', async () => {
    expect(
      await new Browser().json(routes.pushToken.POST, '/api/me/push-token', {
        origin: null,
        json: { token: pushToken(), platform: 'ios' },
      }),
    ).toMatchObject({ status: 403 });
    expect(
      await new Browser().json(routes.pushToken.POST, '/api/me/push-token', {
        bearer: 'not-a-session',
        origin: null,
        json: { token: pushToken(), platform: 'ios' },
      }),
    ).toMatchObject({ status: 401, body: { error: 'signed-out' } });

    // A learner signed in on the web: a cookie, from our own origin. Push is the app's.
    const web = new Browser();
    const number = phone();
    await web.json(routes.requestPin, '/api/auth/request-pin', { json: { phone: number } });
    await web.json(routes.verifyPin, '/api/auth/verify-pin', {
      json: { phone: number, pin: await pinFor(number) },
    });
    await web.json(routes.dob, '/api/me/date-of-birth', { json: { dateOfBirth: '2000-01-01' } });
    await agreeAsAdult(web);
    expect(
      await web.json(routes.pushToken.POST, '/api/me/push-token', {
        json: { token: pushToken(), platform: 'ios' },
      }),
    ).toMatchObject({ status: 403, body: { error: 'forbidden' } });

    const { bearer } = await appLearner();
    for (const json of [
      { token: 'nope', platform: 'ios' },
      { token: pushToken(), platform: 'windows' },
      { token: pushToken() },
      { token: pushToken(), platform: 'ios', studentId: 'someone-else' },
    ]) {
      expect(
        await new Browser().json(routes.pushToken.POST, '/api/me/push-token', {
          bearer,
          origin: null,
          json,
        }),
      ).toMatchObject({ status: 400, body: { error: 'invalid' } });
    }
  });

  it('A5-05: refuses to take a token its holder is still signed in with; after they sign out, it moves', async () => {
    const a = await appLearner();
    const b = await appLearner();
    const shared = pushToken();
    expect((await register(a.bearer, shared)).status).toBe(200);
    await new Browser().json(routes.messaging.PUT, '/api/me/messaging', {
      bearer: a.bearer,
      origin: null,
      method: 'PUT',
      json: { channel: 'push', optedIn: true },
    });
    // b learned a's token somehow: b can't take it while a's session is live.
    expect(await register(b.bearer, shared)).toMatchObject({
      status: 409,
      body: { error: 'state' },
    });
    expect(await remove(b.bearer, shared)).toEqual({ status: 200, body: { removed: false } });
    // a still gets a's own reminders on that phone.
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    tomorrow.setUTCHours(16, 0, 0, 0); // 18:00 SAST, after any paper that day
    const at = tomorrow.toISOString();
    const created = await new Browser().json(routes.reminders, '/api/me/reminders', {
      bearer: a.bearer,
      origin: null,
      json: { templateId: 'reminder.check-in', channel: 'push', at },
    });
    expect(created.status).toBe(201);
    await new Browser().json(routes.runJobs, '/api/dev/jobs/run', { json: { at } });
    expect((await getServices()).devChannels?.push.to(shared)).toHaveLength(1);

    // The shared phone: a signs out (which takes the token off a), then b can register it.
    await new Browser().json(routes.signOut, '/api/auth/sign-out', {
      bearer: a.bearer,
      origin: null,
      method: 'POST',
    });
    expect(await register(b.bearer, shared)).toEqual({ status: 200, body: { ok: true } });
    expect(await remove(b.bearer, shared)).toEqual({ status: 200, body: { removed: true } });
  });
});

describe('DELETE /api/me/push-token and sign-out', () => {
  it('removes only the learner’s own token, and refuses a cross-site cookie request', async () => {
    const a = await appLearner();
    const b = await appLearner();
    const token = pushToken();
    await register(a.bearer, token);
    expect(await remove(b.bearer, token)).toEqual({ status: 200, body: { removed: false } });
    expect(
      await new Browser().json(routes.pushToken.DELETE, '/api/me/push-token', {
        origin: 'https://evil.example',
        method: 'DELETE',
        headers: { cookie: 'uf_session=anything' },
        json: { token },
      }),
    ).toMatchObject({ status: 403, body: { error: 'forbidden' } });
    expect(await remove(a.bearer, token)).toEqual({ status: 200, body: { removed: true } });
  });

  it('signing out takes the phone off the account, even if the app never said so', async () => {
    const { bearer } = await appLearner();
    const token = pushToken();
    await register(bearer, token);
    await new Browser().json(routes.signOut, '/api/auth/sign-out', {
      bearer,
      origin: null,
      method: 'POST',
    });
    // Signed in again on the same phone: the old token is gone, so removing it finds nothing.
    const again = await appLearner();
    expect(await remove(again.bearer, token)).toEqual({ status: 200, body: { removed: false } });
    expect(await (await getServices()).messaging.mayMessage('push', token)).toBe(false);
  });
});

describe('a push reminder end to end (local stand-in)', () => {
  it('reaches the phone with the template’s lock-screen text: no name, nothing personal', async () => {
    const { bearer } = await appLearner();
    const token = pushToken();
    await register(bearer, token, 'ios');
    const put = (json: unknown) =>
      new Browser().json(routes.messaging.PUT, '/api/me/messaging', {
        bearer,
        origin: null,
        method: 'PUT',
        json,
      });
    expect((await put({ channel: 'push', optedIn: true })).status).toBe(200);
    // Tomorrow at 18:00 SAST: outside quiet hours, and after any NSC paper session that day
    // (which would hold the message for a learner whose subjects we don't know, A12-03).
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    tomorrow.setUTCHours(16, 0, 0, 0);
    const at = tomorrow.toISOString();
    const created = await new Browser().json(routes.reminders, '/api/me/reminders', {
      bearer,
      origin: null,
      json: { templateId: 'reminder.check-in', channel: 'push', at },
    });
    expect(created.status).toBe(201);
    await new Browser().json(routes.runJobs, '/api/dev/jobs/run', { json: { at } });
    const push = (await getServices()).devChannels?.push;
    const [message] = push?.to(token) ?? [];
    expect(message?.text).toBe('Your plan has a next step waiting. Tap to see it.');

    // Turning push off removes the phone too.
    expect((await put({ channel: 'push', optedIn: false })).status).toBe(200);
    expect(await remove(bearer, token)).toEqual({ status: 200, body: { removed: false } });
  });
});
