import { en, messageText } from '@universityflow/content';
import { SIGNATURE_HEADER, signWebhook, toGsm7Typography } from '@universityflow/messaging';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { ApiError, errorMessage } from '../lib/client/api';
import { Browser } from './harness';

/**
 * Audit A12-04 over the real routes: a STOP from a number with no account (a guardian's) is
 * honoured, so the guardian consent SMS never reaches that number again and the learner is told
 * why; and a guardian is never sent the SMS at night: it waits for 07:00.
 *
 * The clock is pinned (Date only), so quiet hours never decide a test by when it happens to run.
 */

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);
vi.useFakeTimers({ toFake: ['Date'] });
const DAYTIME = new Date('2026-10-14T16:00:00Z'); // 18:00 SAST
const NIGHT = new Date('2026-10-14T20:00:00Z'); // 22:00 SAST
const MORNING = new Date('2026-10-15T05:00:00Z'); // 07:00 SAST the next day
vi.setSystemTime(DAYTIME);
afterAll(() => {
  vi.useRealTimers();
});

const { getServices } = await import('../lib/server/services');

const routes = {
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  me: await import('../app/api/me/route'),
  dob: (await import('../app/api/me/date-of-birth/route')).POST,
  guardian: (await import('../app/api/me/guardian/route')).POST,
  consent: (await import('../app/api/consent/[token]/route')).POST,
  inbound: (await import('../app/api/messaging/[channel]/inbound/route')).POST,
  runJobs: (await import('../app/api/dev/jobs/run/route')).POST,
  outbox: (await import('../app/api/dev/outbox/route')).GET,
};

let n = 7_000_000;
/** A synthetic number, built at runtime (hard rule 4). */
const phone = () => `082${String(n++).padStart(7, '0')}`;
const e164 = (local: string) => `+27${local.slice(1)}`;

async function smsTo(local: string) {
  const { body } = await new Browser().json<{ messages: Array<{ to: string; body: string }> }>(
    routes.outbox,
    '/api/dev/outbox',
  );
  return body.messages.filter((m) => m.to === e164(local)).map((m) => m.body);
}

/** A signed-in minor waiting for a guardian. */
async function minor() {
  const number = phone();
  const browser = new Browser();
  await browser.json(routes.requestPin, '/api/auth/request-pin', { json: { phone: number } });
  const pin = (await smsTo(number))[0]?.match(/\b(\d{6})\b/)?.[1];
  await browser.json(routes.verifyPin, '/api/auth/verify-pin', { json: { phone: number, pin } });
  await browser.json(routes.dob, '/api/me/date-of-birth', { json: { dateOfBirth: '2010-05-05' } });
  return browser;
}

const askGuardian = (browser: Browser, guardianPhone: string) =>
  browser.json<{ ok?: boolean; queuedUntil?: string; error?: string; detail?: string | null }>(
    routes.guardian,
    '/api/me/guardian',
    { json: { name: 'Test Guardian', phone: guardianPhone, relationship: 'parent' } },
  );

/** A signed message on SMS (STOP unless told otherwise), the way a provider would post it. */
async function stopFrom(local: string, text = 'STOP') {
  const { config } = await getServices();
  // A provider message id, so two identical messages aren't taken for a replay (A5-06).
  const id = `msg-${Math.random().toString(36).slice(2)}`;
  const body = JSON.stringify({ type: 'message', from: e164(local), text, id });
  const secret = config.messagingWebhookSecret as string;
  return new Browser().json<{ ok: boolean; reply: string | null }>(
    routes.inbound,
    '/api/messaging/sms/inbound',
    {
      method: 'POST',
      body,
      headers: {
        'content-type': 'application/json',
        [SIGNATURE_HEADER]: signWebhook(secret, 'sms', body, new Date()),
      },
      origin: null,
      params: { channel: 'sms' },
    },
  );
}

const runAt = (at: Date) =>
  new Browser().json(routes.runJobs, '/api/dev/jobs/run', { json: { at: at.toISOString() } });

describe('STOP from a number with no account (A12-04)', () => {
  it('is honoured: the guardian consent SMS is never sent there, and the learner is told why', async () => {
    const guardianPhone = phone();
    const stop = await stopFrom(guardianPhone);
    expect(stop.body).toEqual({ ok: true, reply: toGsm7Typography(messageText.stopConfirmed) });

    const browser = await minor();
    const asked = await askGuardian(browser, guardianPhone);
    expect(asked).toEqual({ status: 409, body: { error: 'guardian-opted-out', detail: null } });
    // Only the STOP confirmation, sent on SMS as the reply to their STOP (A12-12): no consent SMS.
    expect(await smsTo(guardianPhone)).toEqual([toGsm7Typography(messageText.stopConfirmed)]);
    // What the learner reads: plain, from packages/content.
    const sentence = errorMessage(new ApiError(409, 'guardian-opted-out', null));
    expect(sentence).toBe(en.errors.guardianOptedOut);
    expect(sentence).not.toBe(en.errors.generic);

    // Another guardian's number still works.
    const other = phone();
    expect((await askGuardian(browser, other)).status).toBe(200);
    expect(await smsTo(other)).toHaveLength(1);
  });
});

describe('STOP in plain words (A12-05)', () => {
  it('"Please stop" from a guardian is honoured like STOP', async () => {
    const guardianPhone = phone();
    const res = await stopFrom(guardianPhone, 'Please stop');
    expect(res.body).toEqual({ ok: true, reply: toGsm7Typography(messageText.stopConfirmed) });
    const asked = await askGuardian(await minor(), guardianPhone);
    expect(asked.status).toBe(409);
  });

  it('a STOP that shares a short message with distress still gets help, and still holds', async () => {
    const guardianPhone = phone();
    const res = await stopFrom(guardianPhone, 'please stop, i want to die');
    expect(res.status).toBe(200);
    expect(res.body.reply).toContain(toGsm7Typography(messageText.crisis.reply));
    expect((await askGuardian(await minor(), guardianPhone)).status).toBe(409);
  });
});

describe('the guardian consent SMS keeps quiet hours (A12-04)', () => {
  it('asked at 22:00 SAST: queued, and sent at 07:00 with a link that works', async () => {
    const browser = await minor();
    const guardianPhone = phone();
    vi.setSystemTime(NIGHT);
    try {
      const asked = await askGuardian(browser, guardianPhone);
      expect(asked).toEqual({
        status: 200,
        body: { ok: true, queuedUntil: MORNING.toISOString() },
      });
      expect(await smsTo(guardianPhone)).toEqual([]);
    } finally {
      vi.setSystemTime(DAYTIME);
    }
    // Still night: nothing.
    await runAt(new Date(MORNING.getTime() - 60_000));
    expect(await smsTo(guardianPhone)).toEqual([]);
    // 07:00: the SMS goes, once.
    await runAt(MORNING);
    await runAt(new Date(MORNING.getTime() + 60_000));
    const sent = await smsTo(guardianPhone);
    expect(sent).toHaveLength(1);
    // The same sender as a link sent at once, so GSM-7 typography too (A1-14).
    expect(sent[0]).toBe(toGsm7Typography(sent[0] ?? ''));
    const link = sent[0]?.match(/\/consent\/([\w-]+)/)?.[1] ?? '';
    expect(link).not.toBe('');
    const granted = await new Browser().json(routes.consent, `/api/consent/${link}`, {
      json: { action: 'grant' },
      params: { token: link },
    });
    expect(granted.body).toMatchObject({ status: 'granted' });
  });

  it('a queued SMS is not sent if the number says STOP before morning', async () => {
    const browser = await minor();
    const guardianPhone = phone();
    vi.setSystemTime(NIGHT);
    try {
      expect((await askGuardian(browser, guardianPhone)).status).toBe(200);
    } finally {
      vi.setSystemTime(DAYTIME);
    }
    await stopFrom(guardianPhone);
    await runAt(MORNING);
    // Only the reply to their STOP (A12-12); the queued consent SMS never goes.
    expect(await smsTo(guardianPhone)).toEqual([toGsm7Typography(messageText.stopConfirmed)]);
  });

  it('deleting the account takes the queued SMS with it', async () => {
    const browser = await minor();
    const guardianPhone = phone();
    vi.setSystemTime(NIGHT);
    try {
      expect((await askGuardian(browser, guardianPhone)).status).toBe(200);
    } finally {
      vi.setSystemTime(DAYTIME);
    }
    expect((await browser.json(routes.me.DELETE, '/api/me', { method: 'DELETE' })).status).toBe(
      200,
    );
    await runAt(MORNING);
    expect(await smsTo(guardianPhone)).toEqual([]);
  });
});
