import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { agreeAsAdult } from './adult-consent';
import { Browser, type CallOptions } from './harness';
import { expectNoPhoneNumber } from './no-phone';

/**
 * The store-review sign-in (A7-01, docs/store/review-notes.md option A) over the real routes,
 * for the web page and the mobile app. The data layer's guards are proven in
 * packages/db/src/review.test.ts; these prove what the routes add: no SMS and no budget for the
 * review number, a response that doesn't say it is the review number, the alert, and the app's
 * token.
 */

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

const SECRET = 'review-route-test-secret-long-enough-for-hmac';
let n = 6_000_000;
/** Synthetic numbers, built at runtime (hard rule 4). */
const phone = () => `082${String(n++).padStart(7, '0')}`;
const e164 = (national: string) => `+27${national.slice(1)}`;
const REVIEW_PHONE = phone();
const PIN = '246810';
const inAWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

// Read when the services are first created, after the harness has set the rest. The hash is made
// exactly as review-notes.md tells the owner to make it.
process.env['AUTH_SECRET'] = SECRET;
process.env['UF_REVIEW_PHONE'] = REVIEW_PHONE;
process.env['UF_REVIEW_PIN_HASH'] = createHmac('sha256', SECRET)
  .update(`${e164(REVIEW_PHONE)}:${PIN}`)
  .digest('hex');
process.env['UF_REVIEW_UNTIL'] = inAWeek;
// A budget of one SMS: if the review number spent it, the next learner would be refused.
process.env['UF_SMS_BUDGET_PER_HOUR'] = '1';
process.env['UF_SMS_BUDGET_PER_DAY'] = '1';

const routes = {
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  me: (await import('../app/api/me/route')).GET,
  messaging: await import('../app/api/me/messaging/route'),
  outbox: (await import('../app/api/dev/outbox/route')).GET,
};
const { getServices } = await import('../lib/server/services');

const NATIVE: CallOptions = { origin: null, headers: { 'x-uf-client': 'native' } };

async function smsTo(national: string) {
  const { body } = await new Browser().json<{ messages: Array<{ to: string; body: string }> }>(
    routes.outbox,
    '/api/dev/outbox',
  );
  return body.messages.filter((m) => m.to === e164(national));
}

const learner = phone();
let token = '';

describe('the store-review sign-in over the real routes', () => {
  it('sends no SMS and spends no budget for the review number, and answers exactly like any request', async () => {
    await (await getServices()).store.seedReviewAccount(REVIEW_PHONE);

    const asked = await new Browser().json(routes.requestPin, '/api/auth/request-pin', {
      json: { phone: REVIEW_PHONE },
    });
    expect(asked).toEqual({
      status: 200,
      body: { ok: true, phoneMasked: `•••• ••• ${REVIEW_PHONE.slice(-3)}` },
    });
    expect(await smsTo(REVIEW_PHONE)).toEqual([]);

    // The one SMS the budget allows is still there for a learner.
    const normal = await new Browser().json(routes.requestPin, '/api/auth/request-pin', {
      json: { phone: learner },
    });
    expect(normal.status).toBe(200);
    expect(Object.keys(normal.body).sort()).toEqual(Object.keys(asked.body).sort());
    expect(await smsTo(learner)).toHaveLength(1);

    // And the budget really is one.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const spent = await new Browser().json(routes.requestPin, '/api/auth/request-pin', {
      json: { phone: phone() },
    });
    expect(spent.status).toBe(503);
    warn.mockRestore();
  });

  it('the app signs in with the fixed PIN, gets its token and no cookie, and an alert names IDs only', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const app = new Browser();
    // A1-19: a wrong review PIN is reported too, not only a success.
    const wrong = await app.json(routes.verifyPin, '/api/auth/verify-pin', {
      ...NATIVE,
      json: { phone: REVIEW_PHONE, pin: '135790' },
    });
    expect(wrong).toMatchObject({ status: 400, body: { error: 'pin' } });
    expect(warn.mock.calls.map((c) => c[0])).toEqual([
      'store-review wrong PIN: 1 of 10 in this window',
    ]);
    warn.mockClear();
    const verified = await app.json<{ ok: boolean; isNewStudent: boolean; token?: string }>(
      routes.verifyPin,
      '/api/auth/verify-pin',
      { ...NATIVE, json: { phone: REVIEW_PHONE, pin: PIN } },
    );
    expect(verified.status).toBe(200);
    expect(verified.body).toMatchObject({ ok: true, isNewStudent: false });
    // Nothing in the answer says this was the review sign-in.
    expect(Object.keys(verified.body).sort()).toEqual(['isNewStudent', 'ok', 'token']);
    expect(app.jar.size).toBe(0);
    token = verified.body.token ?? '';

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/^store-review sign-in: student [0-9a-f-]{36}$/);
    expectNoPhoneNumber(JSON.stringify(warn.mock.calls));
    warn.mockRestore();

    const me = await new Browser().json(routes.me, '/api/me', { bearer: token, origin: null });
    expect(me.status).toBe(200);
  });

  it('the fixed PIN does not open a normal number', async () => {
    const [sms] = await smsTo(learner);
    if (sms?.body.includes(PIN)) return; // one in a million: the learner's own PIN is the same
    const tried = await new Browser().json(routes.verifyPin, '/api/auth/verify-pin', {
      json: { phone: learner, pin: PIN },
    });
    expect(tried).toMatchObject({ status: 400, body: { error: 'pin' } });
  });

  it('offers the review account push only, and refuses SMS and WhatsApp', async () => {
    const app = new Browser();
    const bearer: CallOptions = { bearer: token, origin: null };
    await agreeAsAdult(app, bearer);
    const view = await app.json<{ offeredChannels: string[] }>(
      routes.messaging.GET,
      '/api/me/messaging',
      bearer,
    );
    expect(view.status).toBe(200);
    expect(view.body.offeredChannels).toEqual(['push']);
    for (const channel of ['sms', 'whatsapp']) {
      const refused = await app.json(routes.messaging.PUT, '/api/me/messaging', {
        ...bearer,
        method: 'PUT',
        json: { channel, optedIn: true },
      });
      expect(refused).toMatchObject({ status: 409, body: { error: 'state' } });
    }
  });
});
