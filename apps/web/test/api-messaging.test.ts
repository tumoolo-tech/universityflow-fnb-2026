import { randomUUID } from 'node:crypto';
import { en, messageText } from '@universityflow/content';
import {
  isGsm7,
  SIGNATURE_HEADER,
  signWebhook,
  smsSegments,
  toGsm7Typography,
} from '@universityflow/messaging';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { agreeAsAdult } from './adult-consent';
import { Browser, chunkedRequest } from './harness';
import { expectNoPhoneNumber } from './no-phone';

/**
 * Phase 4a over the real route handlers, an embedded database and the local stand-ins: channel
 * opt-in, reminders through the dev runner to the outbox, signed inbound webhooks (STOP),
 * deletion purging scheduled reminders, and export.
 *
 * The clock is pinned (Date only) to a Wednesday at 18:00 in South Africa, so quiet hours never
 * decide a test by the time of day it happens to run. Not 10:00: that is inside an NSC paper
 * session (Information Technology P1), which holds every message to a learner whose subjects we
 * don't know (A12-03).
 */

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);
vi.useFakeTimers({ toFake: ['Date'] });
const PINNED = new Date('2026-10-14T16:00:00Z'); // 18:00 SAST, after every paper that day
vi.setSystemTime(PINNED);
afterAll(() => {
  vi.useRealTimers();
});

const { getServices } = await import('../lib/server/services');

const routes = {
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  me: await import('../app/api/me/route'),
  dob: (await import('../app/api/me/date-of-birth/route')).POST,
  exportData: (await import('../app/api/me/export/route')).GET,
  messaging: await import('../app/api/me/messaging/route'),
  reminders: await import('../app/api/me/reminders/route'),
  inbound: (await import('../app/api/messaging/[channel]/inbound/route')).POST,
  runJobs: (await import('../app/api/dev/jobs/run/route')).POST,
  outbox: (await import('../app/api/dev/outbox/route')).GET,
};

/** What a reply says on SMS: the same words, typography made GSM-7 (A1-14). */
const smsText = toGsm7Typography;
/** The no-verified-helplines crisis reply on SMS, in GSM-7 segments. */
const CRISIS_FALLBACK_SMS_SEGMENTS = 2;

let n = 6_000_000;
/** A synthetic number, built at runtime (hard rule 4). */
const phone = () => `082${String(n++).padStart(7, '0')}`;
const e164 = (local: string) => `+27${local.slice(1)}`;

async function outbox(browser = new Browser()) {
  const { body } = await browser.json<{
    messages: Array<{ to: string; body: string }>;
    channels: Array<{ channel: string; to: string; body: string }>;
  }>(routes.outbox, '/api/dev/outbox');
  return body;
}

async function smsTo(local: string) {
  return (await outbox()).messages.filter((m) => m.to === e164(local)).map((m) => m.body);
}

async function signedIn(number = phone()) {
  const browser = new Browser();
  await browser.json(routes.requestPin, '/api/auth/request-pin', { json: { phone: number } });
  const pin = (await smsTo(number))[0]?.match(/\b(\d{6})\b/)?.[1];
  await browser.json(routes.verifyPin, '/api/auth/verify-pin', { json: { phone: number, pin } });
  return { browser, number };
}

/** An adult learner, opted in to SMS. */
async function optedIn(channels: string[] = ['sms']) {
  const session = await signedIn();
  await session.browser.json(routes.dob, '/api/me/date-of-birth', {
    json: { dateOfBirth: '2000-02-02' },
  });
  await agreeAsAdult(session.browser);
  for (const channel of channels) {
    const res = await session.browser.json(routes.messaging.PUT, '/api/me/messaging', {
      method: 'PUT',
      json: { channel, optedIn: true },
    });
    expect(res.status).toBe(200);
  }
  return session;
}

async function remind(browser: Browser, at = new Date(), channel = 'sms') {
  return browser.json<{ id: string }>(routes.reminders.POST, '/api/me/reminders', {
    json: { templateId: 'reminder.check-in', channel, at: at.toISOString() },
  });
}

const runJobs = () =>
  new Browser().json<{ completed: number }>(routes.runJobs, '/api/dev/jobs/run', {
    method: 'POST',
  });

/** Posts to an inbound webhook the way a provider would, signed unless told otherwise. */
async function inbound(
  channel: string,
  payload: unknown,
  options: {
    secret?: string | null;
    at?: Date;
    tamper?: (body: string) => string;
    /** The channel the request is signed for; by default the one it is posted to (A5-06). */
    signedFor?: string;
    /** The provider's message id; by default a fresh one, so no two requests are the same. */
    id?: string | null;
  } = {},
) {
  const { config } = await getServices();
  const id = options.id === undefined ? randomUUID() : options.id;
  const body = JSON.stringify(id === null ? payload : { ...(payload as object), id });
  const secret = options.secret === undefined ? config.messagingWebhookSecret : options.secret;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (secret) {
    headers[SIGNATURE_HEADER] = signWebhook(
      secret,
      options.signedFor ?? channel,
      body,
      options.at ?? new Date(),
    );
  }
  return new Browser().json<{ ok?: boolean; reply?: string | null; error?: string }>(
    routes.inbound,
    `/api/messaging/${channel}/inbound`,
    {
      method: 'POST',
      body: options.tamper ? options.tamper(body) : body,
      headers,
      origin: null,
      params: { channel },
    },
  );
}

describe('channel opt-in (planning.md §7.1)', () => {
  it('starts with nothing opted in, two a week, and every channel on offer locally', async () => {
    const { browser } = await signedIn();
    await browser.json(routes.dob, '/api/me/date-of-birth', {
      json: { dateOfBirth: '2000-02-02' },
    });
    await agreeAsAdult(browser);
    const { status, body } = await browser.json<{
      channels: Array<{ channel: string; optedIn: boolean }>;
      maxPerWeek: number;
      offeredChannels: string[];
    }>(routes.messaging.GET, '/api/me/messaging');
    expect(status).toBe(200);
    expect(body.channels.map((c) => [c.channel, c.optedIn])).toEqual([
      ['sms', false],
      ['whatsapp', false],
      ['push', false],
    ]);
    expect(body.maxPerWeek).toBe(2);
    // Push too since Phase 4d (the local stand-in), turned on from the app's phone.
    expect(body.offeredChannels).toEqual(['sms', 'whatsapp', 'push']);
  });

  it('records an opt-in with its time, a cap, and an opt-out', async () => {
    const { browser } = await optedIn(['whatsapp']);
    let res = await browser.json<{ channels: Array<{ channel: string; optedInAt: string }> }>(
      routes.messaging.GET,
      '/api/me/messaging',
    );
    expect(res.body.channels[1]).toMatchObject({
      channel: 'whatsapp',
      optedInAt: PINNED.toISOString(),
    });
    res = await browser.json(routes.messaging.PUT, '/api/me/messaging', {
      method: 'PUT',
      json: { maxPerWeek: 5 },
    });
    expect(res.body).toMatchObject({ maxPerWeek: 5 });
    res = await browser.json(routes.messaging.PUT, '/api/me/messaging', {
      method: 'PUT',
      json: { channel: 'whatsapp', optedIn: false },
    });
    expect(res.body.channels[1]).toMatchObject({ optedIn: false, optOutSource: 'app' });
  });

  it('refuses push until a phone is registered, a bad cap, and a cross-site request', async () => {
    const { browser } = await optedIn([]);
    const put = (json: unknown, origin?: string) =>
      browser.json(routes.messaging.PUT, '/api/me/messaging', {
        method: 'PUT',
        json,
        ...(origin ? { origin } : {}),
      });
    expect((await put({ channel: 'push', optedIn: true })).status).toBe(409);
    // Opting out of a channel is always allowed.
    expect((await put({ channel: 'push', optedIn: false })).status).toBe(200);
    expect((await put({ maxPerWeek: 0 })).status).toBe(400);
    expect((await put({ maxPerWeek: 8 })).status).toBe(400);
    expect((await put({ channel: 'fax', optedIn: true })).status).toBe(400);
    expect((await put({ channel: 'sms', optedIn: true }, 'https://evil.example')).status).toBe(403);
  });

  it('refuses a minor waiting for a guardian (hard rule 5)', async () => {
    const { browser } = await signedIn();
    await browser.json(routes.dob, '/api/me/date-of-birth', {
      json: { dateOfBirth: '2010-05-05' },
    });
    expect((await browser.json(routes.messaging.GET, '/api/me/messaging')).status).toBe(403);
    const put = await browser.json(routes.messaging.PUT, '/api/me/messaging', {
      method: 'PUT',
      json: { channel: 'sms', optedIn: true },
    });
    expect(put.status).toBe(403);
    expect((await remind(browser)).status).toBe(403);
  });
});

describe('reminders: scheduled, run, delivered to the dev outbox', () => {
  it('a reminder the learner sets reaches the outbox when the runner runs', async () => {
    const { browser, number } = await optedIn();
    const created = await remind(browser);
    expect(created.status).toBe(201);
    expect(await smsTo(number)).toHaveLength(1); // the PIN only
    expect((await runJobs()).status).toBe(200);
    const texts = await smsTo(number);
    // On SMS, GSM-7 typography: one segment, not two (A1-14). Nothing personal (A11-02), and
    // how to stop (A12-10).
    expect(texts[0]).toBe(
      'UniversityFlow: this is the check-in reminder you set. Open the app to see your next step. Reply STOP to stop.',
    );
    const list = await browser.json<{ reminders: Array<{ id: string; status: string }> }>(
      routes.reminders.GET,
      '/api/me/reminders',
    );
    expect(list.body.reminders).toEqual([
      expect.objectContaining({ id: created.body.id, status: 'sent' }),
    ]);
  });

  it('a study reminder checks the subject in the catalogue, but never names it in the SMS (A11-02)', async () => {
    const { browser, number } = await optedIn();
    const res = await browser.json(routes.reminders.POST, '/api/me/reminders', {
      json: {
        templateId: 'reminder.study',
        channel: 'sms',
        at: new Date().toISOString(),
        subjectId: 'mathematics',
      },
    });
    expect(res.status).toBe(201);
    await runJobs();
    const [text] = await smsTo(number);
    expect(text).toMatch(/^UniversityFlow: this is the study reminder you asked for\./);
    expect(text).not.toMatch(/Mathematics/);
  });

  it('goes by WhatsApp to a learner opted in there', async () => {
    const { browser, number } = await optedIn(['whatsapp']);
    await remind(browser, new Date(), 'whatsapp');
    await runJobs();
    const sent = (await outbox()).channels.filter((m) => m.to === e164(number));
    expect(sent).toEqual([
      // The WhatsApp body has no STOP line: its template carries a "Stop" button (A12-10).
      expect.objectContaining({
        channel: 'whatsapp',
        body: 'UniversityFlow: this is the check-in reminder you set. Open the app to see your next step.',
      }),
    ]);
  });

  it('refuses what a learner may not schedule', async () => {
    const { browser } = await optedIn();
    const post = (json: unknown) =>
      browser.json(routes.reminders.POST, '/api/me/reminders', { json });
    const at = new Date().toISOString();
    // A template only code may schedule.
    expect((await post({ templateId: 'reminder.application', channel: 'sms', at })).status).toBe(
      400,
    );
    // A study reminder without a subject, a check-in with one, an unknown subject.
    expect((await post({ templateId: 'reminder.study', channel: 'sms', at })).status).toBe(400);
    expect(
      (
        await post({
          templateId: 'reminder.check-in',
          channel: 'sms',
          at,
          subjectId: 'mathematics',
        })
      ).status,
    ).toBe(400);
    expect(
      (await post({ templateId: 'reminder.study', channel: 'sms', at, subjectId: 'astrology' }))
        .status,
    ).toBe(400);
    // In the past, or too far ahead.
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const far = new Date(Date.now() + 61 * 24 * 60 * 60 * 1000).toISOString();
    expect((await post({ templateId: 'reminder.check-in', channel: 'sms', at: past })).status).toBe(
      400,
    );
    expect((await post({ templateId: 'reminder.check-in', channel: 'sms', at: far })).status).toBe(
      400,
    );
    // Push needs a phone with notifications on; extra fields aren't accepted.
    expect((await post({ templateId: 'reminder.check-in', channel: 'push', at })).status).toBe(409);
    expect(
      (await post({ templateId: 'reminder.check-in', channel: 'sms', at, note: 'call me' })).status,
    ).toBe(400);
  });

  it('limits how many reminders a learner can set in a day', async () => {
    const { browser } = await optedIn();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await remind(browser)).status);
    expect(statuses).toEqual([...Array(10).fill(201), 429]);
  });

  it('a reminder for a learner not opted in is dropped, and nothing is sent', async () => {
    const { browser, number } = await optedIn(['sms']);
    await browser.json(routes.messaging.PUT, '/api/me/messaging', {
      method: 'PUT',
      json: { channel: 'sms', optedIn: false },
    });
    const created = await remind(browser);
    expect(created.status).toBe(201);
    await runJobs();
    expect(await smsTo(number)).toHaveLength(1); // the PIN only
    const list = await browser.json<{
      reminders: Array<{ status: string; outcomeReason: string }>;
    }>(routes.reminders.GET, '/api/me/reminders');
    expect(list.body.reminders[0]).toMatchObject({
      status: 'dropped',
      outcomeReason: 'not-opted-in',
    });
  });
});

describe('inbound webhooks: signed, STOP, rate-limited', () => {
  it('STOP opts the learner out at once, confirms it, and nothing more is sent', async () => {
    const { browser, number } = await optedIn();
    await remind(browser, new Date(Date.now() + 60 * 60 * 1000));
    const res = await inbound('sms', { type: 'message', from: e164(number), text: 'Stop' });
    expect(res).toEqual({
      status: 200,
      body: { ok: true, reply: smsText(messageText.stopConfirmed) },
    });
    const prefs = await browser.json<{
      channels: Array<{ optedIn: boolean; optOutSource: string }>;
    }>(routes.messaging.GET, '/api/me/messaging');
    expect(prefs.body.channels[0]).toMatchObject({ optedIn: false, optOutSource: 'stop' });
    vi.setSystemTime(new Date(PINNED.getTime() + 2 * 60 * 60 * 1000));
    try {
      await runJobs();
    } finally {
      vi.setSystemTime(PINNED);
    }
    // The PIN and the STOP confirmation (A12-12), and no reminder.
    expect(await smsTo(number)).toHaveLength(2);
  });

  it('A12-12: STOP at 22:30 SAST gets exactly one confirmation on its own channel, and uses no cadence slot', async () => {
    const { browser, number } = await optedIn(['sms', 'whatsapp']);
    const waTo = async () =>
      (await outbox()).channels
        .filter((m) => m.channel === 'whatsapp' && m.to === e164(number))
        .map((m) => m.body);
    vi.setSystemTime(new Date('2026-10-14T20:30:00Z')); // 22:30 SAST: quiet hours
    try {
      const sms = await inbound('sms', { type: 'message', from: e164(number), text: 'STOP' });
      expect(sms.body.reply).toBe(smsText(messageText.stopConfirmed));
      // Sent on the channel, not only answered in the response: SMS here, GSM-7. The other
      // message is the sign-in PIN.
      const texts = await smsTo(number);
      expect(texts).toHaveLength(2);
      expect(texts).toContain(smsText(messageText.stopConfirmed));
      expect(await waTo()).toEqual([]);
      // WhatsApp's STOP is confirmed on WhatsApp.
      await inbound('whatsapp', { type: 'message', from: e164(number), text: 'STOP' });
      expect(await waTo()).toEqual([messageText.stopConfirmed]);
      expect(await smsTo(number)).toHaveLength(2); // the PIN, and the one SMS confirmation
    } finally {
      vi.setSystemTime(PINNED);
    }
    // Not a reminder: nothing recorded against the learner's weekly cap.
    const exported = (await (await browser.call(routes.exportData, '/api/me/export')).json()) as {
      personal: { messaging: { reminders: unknown[] } };
    };
    expect(exported.personal.messaging.reminders).toEqual([]);
  });

  it('A12-12: a STOP that shares its message with distress gets help as its one reply, on the channel', async () => {
    const { number } = await optedIn();
    const res = await inbound('sms', {
      type: 'message',
      from: e164(number),
      text: 'please stop, i want to die',
    });
    const reply = res.body.reply ?? '';
    expect(reply).toContain(smsText(messageText.crisis.reply));
    // The help went out on SMS, once, and no separate STOP confirmation with it (the other
    // message is the sign-in PIN).
    const texts = await smsTo(number);
    expect(texts).toHaveLength(2);
    expect(texts).toContain(reply);
    expect(texts).not.toContain(smsText(messageText.stopConfirmed));
  });

  it('STOP in another language works too (marked for first-language review)', async () => {
    const { browser, number } = await optedIn(['whatsapp']);
    const res = await inbound('whatsapp', { type: 'message', from: e164(number), text: 'Yeka' });
    expect(res.body.reply).toBe(messageText.stopConfirmed);
    const prefs = await browser.json<{ channels: Array<{ optedIn: boolean }> }>(
      routes.messaging.GET,
      '/api/me/messaging',
    );
    expect(prefs.body.channels[1]?.optedIn).toBe(false);
  });

  it('answers STOP from an unknown number the same way, so it reveals no account', async () => {
    const res = await inbound('sms', { type: 'message', from: e164(phone()), text: 'STOP' });
    expect(res).toEqual({
      status: 200,
      body: { ok: true, reply: smsText(messageText.stopConfirmed) },
    });
  });

  it('refuses a forged, unsigned, altered or replayed request, and changes nothing', async () => {
    const { browser, number } = await optedIn();
    const stop = { type: 'message', from: e164(number), text: 'STOP' };
    const forged = await inbound('sms', stop, { secret: 'x'.repeat(48) });
    const unsigned = await inbound('sms', stop, { secret: null });
    const altered = await inbound(
      'sms',
      { ...stop, text: 'Hello' },
      {
        tamper: (body) => body.replace('Hello', 'STOP'),
      },
    );
    const replayed = await inbound('sms', stop, { at: new Date(Date.now() - 10 * 60 * 1000) });
    for (const res of [forged, unsigned, altered, replayed]) {
      expect(res).toEqual({ status: 401, body: { error: 'forbidden', detail: null } });
    }
    const prefs = await browser.json<{ channels: Array<{ optedIn: boolean }> }>(
      routes.messaging.GET,
      '/api/me/messaging',
    );
    expect(prefs.body.channels[0]?.optedIn).toBe(true);
  });

  it('A5-06: refuses a signed request replayed on the same channel, or posted to the other one', async () => {
    const { browser, number } = await optedIn(['sms', 'whatsapp']);
    const { devChannels } = await getServices();
    const at = new Date();
    // A reply signed for SMS, posted to WhatsApp: it would open a 24-hour window never opened.
    const reply = { type: 'message', from: e164(number), text: 'Thanks!' };
    const crossed = await inbound('whatsapp', reply, { at, signedFor: 'sms' });
    expect(crossed).toEqual({ status: 401, body: { error: 'forbidden', detail: null } });
    expect(await devChannels?.whatsapp.freeFormAllowed(e164(number), new Date())).toBe(false);
    // An SMS STOP posted to WhatsApp would opt the learner out of a channel they kept.
    const stop = { type: 'message', from: e164(number), text: 'STOP' };
    expect((await inbound('whatsapp', stop, { at, signedFor: 'sms' })).status).toBe(401);
    // The same signed request twice: the first counts, the second is refused.
    const first = await inbound('sms', reply, { at, id: 'replay-test-1' });
    expect(first.status).toBe(200);
    const again = await inbound('sms', reply, { at, id: 'replay-test-1' });
    expect(again).toEqual({ status: 401, body: { error: 'forbidden', detail: null } });
    const prefs = await browser.json<{ channels: Array<{ channel: string; optedIn: boolean }> }>(
      routes.messaging.GET,
      '/api/me/messaging',
    );
    expect(prefs.body.channels.filter((c) => c.optedIn).map((c) => c.channel)).toEqual([
      'sms',
      'whatsapp',
    ]);
  });

  it('a reply on WhatsApp opens the 24-hour window for free-form text', async () => {
    const { number } = await optedIn(['whatsapp']);
    const { devChannels } = await getServices();
    expect(await devChannels?.whatsapp.freeFormAllowed(e164(number), new Date())).toBe(false);
    const res = await inbound('whatsapp', { type: 'message', from: e164(number), text: 'Thanks!' });
    expect(res.body).toEqual({ ok: true, reply: null });
    expect(await devChannels?.whatsapp.freeFormAllowed(e164(number), new Date())).toBe(true);
  });

  /** The verified helpline numbers the chat crisis card would show, or none (rule 3). */
  async function verifiedNumbers() {
    const { catalogue } = await getServices();
    return catalogue().helplines.flatMap((h) => h.numbers.map((x) => x.value));
  }

  /** The reply carries a verified helpline, or the "no verified numbers" fallback when none. */
  async function expectHelp(reply: string) {
    const numbers = await verifiedNumbers();
    if (numbers.length === 0) {
      expect(reply).toContain(en.crisis.noVerifiedNumbers);
    } else {
      expect(numbers.some((value) => reply.includes(value))).toBe(true);
    }
  }

  it('answers "i want to die" in reply to a reminder with crisis text and help (A10-05)', async () => {
    const { number } = await optedIn(['whatsapp']);
    const res = await inbound('whatsapp', {
      type: 'message',
      from: e164(number),
      text: 'I failed my trial, i want to die',
    });
    expect(res.status).toBe(200);
    const reply = res.body.reply ?? '';
    expect(reply).toContain(messageText.crisis.reply);
    await expectHelp(reply);
  });

  it('answers distress on SMS too, SMS-short, even from an unknown number', async () => {
    for (const from of [e164((await optedIn()).number), e164(phone())]) {
      const res = await inbound('sms', { type: 'message', from, text: 'i want to die' });
      const reply = res.body.reply ?? '';
      expect(reply).toContain(smsText(messageText.crisis.reply));
      await expectHelp(reply);
      // At most three SMS segments, so it isn't split into a wall of messages.
      expect(reply.length).toBeLessThanOrEqual(459);
    }
    const concern = await inbound('sms', {
      type: 'message',
      from: e164(phone()),
      text: 'I feel so hopeless about maths',
    });
    expect(concern.body.reply).toContain(smsText(messageText.crisis.concernReply));
    await expectHelp(concern.body.reply ?? '');
  });

  it('a crisis message gets help even from a sender over the rate limit', async () => {
    const { number } = await optedIn();
    for (let i = 0; i < 30; i++) {
      await inbound('sms', { type: 'message', from: e164(number), text: 'hi' });
    }
    expect((await inbound('sms', { type: 'message', from: e164(number), text: 'hi' })).status).toBe(
      429,
    );
    const res = await inbound('sms', {
      type: 'message',
      from: e164(number),
      text: 'i want to die',
    });
    expect(res.status).toBe(200);
    expect(res.body.reply).toContain(smsText(messageText.crisis.reply));
  });

  it('20 crisis messages in an hour: every one answered, then one SMS each, and one alert (A10-15)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const from = e164((await optedIn()).number);
      const replies: string[] = [];
      for (let i = 0; i < 20; i++) {
        const res = await inbound('sms', { type: 'message', from, text: 'secret i want to die' });
        expect(res.status).toBe(200);
        replies.push(res.body.reply ?? '');
      }
      // Never silent: every message gets help.
      for (const reply of replies) await expectHelp(reply);
      const full = replies[0] as string;
      expect(full).toContain(smsText(messageText.crisis.reply));
      expect(replies.slice(0, 3)).toEqual([full, full, full]);
      // After three full replies in the hour, the shortest version: one SMS segment each.
      expect(replies.slice(3).map(smsSegments)).toEqual(Array(17).fill(1));
      expect(replies[3]).not.toBe(full);
      // One alert for the sender's window, with no words and no number in it.
      const alerts = warn.mock.calls.filter((c) => String(c[0]).startsWith('crisis-reply'));
      expect(alerts).toHaveLength(1);
      expect(JSON.stringify(warn.mock.calls)).not.toMatch(/secret/);
      expectNoPhoneNumber(JSON.stringify(warn.mock.calls));

      // Another sender still gets the full reply.
      const other = await inbound('sms', {
        type: 'message',
        from: e164(phone()),
        text: 'i want to die',
      });
      expect(other.body.reply).toBe(full);

      // An hour later, the sender gets the full reply again.
      vi.setSystemTime(new Date(PINNED.getTime() + 61 * 60 * 1000));
      try {
        const later = await inbound('sms', { type: 'message', from, text: 'i want to die' });
        expect(later.body.reply).toBe(full);
      } finally {
        vi.setSystemTime(PINNED);
      }
    } finally {
      warn.mockRestore();
    }
  });

  it('an ordinary reply gets no crisis reply, and STOP is unchanged', async () => {
    const { number } = await optedIn();
    const ordinary = await inbound('sms', {
      type: 'message',
      from: e164(number),
      text: 'Thanks, I did my Life Orientation homework',
    });
    expect(ordinary.body).toEqual({ ok: true, reply: null });
    const stop = await inbound('sms', { type: 'message', from: e164(number), text: 'STOP' });
    expect(stop.body).toEqual({ ok: true, reply: smsText(messageText.stopConfirmed) });
  });

  it('A1-14: replies on SMS go out GSM-7, the reviewed words unchanged but for typography', async () => {
    const stop = await inbound('sms', { type: 'message', from: e164(phone()), text: 'STOP' });
    const stopReply = stop.body.reply ?? '';
    expect(isGsm7(stopReply)).toBe(true);
    expect(smsSegments(stopReply)).toBe(1);
    // With no helpline verified yet, the full crisis reply is the reviewed words and what to do.
    const crisis = await inbound('sms', {
      type: 'message',
      from: e164(phone()),
      text: 'i want to die',
    });
    const crisisText = crisis.body.reply ?? '';
    expect(isGsm7(crisisText)).toBe(true);
    if ((await verifiedNumbers()).length === 0) {
      expect(crisisText).toBe(
        toGsm7Typography(`${messageText.crisis.replyNoLines} ${en.crisis.noVerifiedNumbers}`),
      );
      expect(smsSegments(crisisText)).toBe(CRISIS_FALLBACK_SMS_SEGMENTS);
    }
    // WhatsApp keeps the typography as written.
    const wa = await inbound('whatsapp', { type: 'message', from: e164(phone()), text: 'STOP' });
    expect(wa.body.reply).toBe(messageText.stopConfirmed);
  });

  it('records a delivery report', async () => {
    const { browser } = await optedIn();
    await remind(browser);
    await runJobs();
    const exported = await browser.call(routes.exportData, '/api/me/export');
    const data = (await exported.json()) as {
      personal: { messaging: { reminders: Array<{ receiptId: string }> } };
    };
    const receiptId = data.personal.messaging.reminders[0]?.receiptId as string;
    const res = await inbound('sms', { type: 'status', receiptId, status: 'delivered' });
    expect(res).toEqual({ status: 200, body: { ok: true } });
    const again = (await (
      await browser.call(routes.exportData, '/api/me/export')
    ).json()) as typeof data;
    expect(again.personal.messaging.reminders[0]).toMatchObject({ deliveryStatus: 'delivered' });
  });

  it('A12-09: records the category WhatsApp billed, so a recategorisation to marketing shows', async () => {
    const { browser } = await optedIn(['whatsapp']);
    await remind(browser, new Date(), 'whatsapp');
    await runJobs();
    const read = async () =>
      (
        (await (await browser.call(routes.exportData, '/api/me/export')).json()) as {
          personal: {
            messaging: {
              reminders: Array<{ receiptId: string; billedCategory: string | null }>;
            };
          };
        }
      ).personal.messaging.reminders[0];
    const receiptId = (await read())?.receiptId as string;
    const res = await inbound('whatsapp', {
      type: 'status',
      receiptId,
      status: 'delivered',
      category: 'marketing',
    });
    expect(res).toEqual({ status: 200, body: { ok: true } });
    expect(await read()).toMatchObject({ billedCategory: 'marketing' });
  });

  it('rate-limits a sender, but never their STOP', async () => {
    const { number } = await optedIn();
    const statuses: number[] = [];
    for (let i = 0; i < 31; i++) {
      statuses.push(
        (await inbound('sms', { type: 'message', from: e164(number), text: 'hi' })).status,
      );
    }
    expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true);
    expect(statuses[30]).toBe(429);
    const stop = await inbound('sms', { type: 'message', from: e164(number), text: 'STOP' });
    expect(stop.status).toBe(200);
  });

  it('refuses an unknown channel, push, a malformed body and an oversized one', async () => {
    expect((await inbound('fax', { type: 'message', from: e164(phone()), text: 'x' })).status).toBe(
      404,
    );
    expect(
      (await inbound('push', { type: 'message', from: e164(phone()), text: 'x' })).status,
    ).toBe(404);
    expect(
      (await inbound('sms', { type: 'message', from: 'not-a-number', text: 'x' })).status,
    ).toBe(400);
    expect(
      (await inbound('sms', { type: 'message', from: e164(phone()), text: 'x'.repeat(9000) }))
        .status,
    ).toBe(400);
  });

  // CV-A5 A5-19: a body sent chunked (no content-length) is read only up to the 8 KB cap.
  it('stops reading a chunked body at the cap', async () => {
    const { request, read } = chunkedRequest('/api/messaging/sms/inbound', 1024 * 1024);
    const answer = await routes.inbound(request, { params: Promise.resolve({ channel: 'sms' }) });
    expect(answer.status).toBe(400);
    expect(read.bytes).toBeLessThanOrEqual(8 * 1024 + 64 * 1024);
  });

  it('logs no message body or phone number, even when it fails (hard rule 4)', async () => {
    const spies = (['log', 'info', 'warn', 'error'] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => undefined),
    );
    try {
      const { number } = await optedIn();
      await inbound('sms', { type: 'message', from: e164(number), text: 'secret words STOP' });
      await inbound(
        'sms',
        { type: 'message', from: e164(number), text: 'secret words' },
        { secret: null },
      );
      // A crisis message is answered, but its words are never logged either.
      await inbound('sms', { type: 'message', from: e164(number), text: 'secret i want to die' });
      await inbound(
        'sms',
        { type: 'message', from: e164(number), text: 'secret' },
        {
          tamper: () => '{not json',
        },
      );
      const logged = JSON.stringify(spies.map((s) => s.mock.calls));
      expect(logged).not.toContain('secret');
      expectNoPhoneNumber(logged);
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});

describe('the dev runner and deletion', () => {
  it('can run as if it were another time, and quiet hours still hold', async () => {
    const { browser, number } = await optedIn();
    await remind(browser);
    const run = (at: string) =>
      new Browser().json<{ completed: number }>(routes.runJobs, '/api/dev/jobs/run', {
        json: { at },
      });
    // 22:00 in South Africa: the reminder waits for the morning.
    expect((await run('2026-10-14T20:00:00Z')).status).toBe(200);
    expect(await smsTo(number)).toHaveLength(1); // the PIN only
    // 07:00 the next day: it goes.
    await run('2026-10-15T05:00:00Z');
    expect(await smsTo(number)).toHaveLength(2);
    expect((await run('not a time')).status).toBe(400);
  });

  it('runs only for a same-origin request', async () => {
    const res = await new Browser().json(routes.runJobs, '/api/dev/jobs/run', {
      method: 'POST',
      origin: 'https://evil.example',
    });
    expect(res.status).toBe(403);
  });

  it('deleting the account cancels and purges its scheduled reminders: nothing is sent', async () => {
    const { browser, number } = await optedIn();
    expect((await remind(browser, new Date(Date.now() + 60 * 60 * 1000))).status).toBe(201);
    const { store, jobs } = await getServices();
    const me = await browser.json<{ account: { id: string } }>(routes.me.GET, '/api/me');
    const [jobId] = await store.forStudent(me.body.account.id).scheduledJobIds();
    expect((await jobs.get(jobId as string))?.status).toBe('pending');

    const deleted = await browser.json(routes.me.DELETE, '/api/me', { method: 'DELETE' });
    expect(deleted.status).toBe(200);
    expect(await jobs.get(jobId as string)).toBeNull();
    vi.setSystemTime(new Date(PINNED.getTime() + 2 * 60 * 60 * 1000));
    try {
      const run = await runJobs();
      expect(run.body.completed).toBe(0);
    } finally {
      vi.setSystemTime(PINNED);
    }
    expect(await smsTo(number)).toHaveLength(1); // the PIN only
  });

  it('exports the messaging choices', async () => {
    const { browser } = await optedIn(['sms', 'whatsapp']);
    const res = await browser.call(routes.exportData, '/api/me/export');
    const data = (await res.json()) as {
      personal: { messaging: { channels: Array<{ channel: string; optedIn: boolean }> } };
    };
    expect(data.personal.messaging.channels.map((c) => [c.channel, c.optedIn])).toEqual([
      ['sms', true],
      ['whatsapp', true],
    ]);
  });
});
