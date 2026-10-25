import { afterAll, describe, expect, it, vi } from 'vitest';
import { agreeAsAdult } from './adult-consent';
import { Browser } from './harness';
import { expectNoPhoneNumber } from './no-phone';

/**
 * A5-01 / A12-08 over the real routes: sign-in PINs and guardian links have an SMS budget of
 * their own, so reminders can never spend what sign-in needs. A reminder the reminder budget
 * refuses waits for the window to pass; it doesn't burn its retries and fail.
 *
 * The clock is pinned (Date only) to 18:00 in South Africa: no quiet hours, no paper.
 */

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);
vi.useFakeTimers({ toFake: ['Date'] });
const PINNED = new Date('2026-10-14T16:00:00Z');
vi.setSystemTime(PINNED);
afterAll(() => {
  vi.useRealTimers();
});

// Read when the services are first created. Sign-in: three. Reminders: one an hour.
process.env['UF_SMS_BUDGET_PER_HOUR'] = '3';
process.env['UF_SMS_BUDGET_PER_DAY'] = '3';
process.env['UF_SMS_REMINDER_BUDGET_PER_HOUR'] = '1';
process.env['UF_SMS_REMINDER_BUDGET_PER_DAY'] = '10';

const routes = {
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  dob: (await import('../app/api/me/date-of-birth/route')).POST,
  messaging: await import('../app/api/me/messaging/route'),
  reminders: await import('../app/api/me/reminders/route'),
  runJobs: (await import('../app/api/dev/jobs/run/route')).POST,
  outbox: (await import('../app/api/dev/outbox/route')).GET,
};

let n = 7_100_000;
/** A synthetic number, built at runtime (hard rule 4). */
const phone = () => `082${String(n++).padStart(7, '0')}`;
const e164 = (local: string) => `+27${local.slice(1)}`;

async function sms() {
  const { body } = await new Browser().json<{ messages: Array<{ to: string; body: string }> }>(
    routes.outbox,
    '/api/dev/outbox',
  );
  return body.messages;
}

/** An adult learner opted in to SMS, with an SMS reminder due now. One PIN spent. */
async function learnerWithReminder() {
  const browser = new Browser();
  const number = phone();
  const asked = await browser.json(routes.requestPin, '/api/auth/request-pin', {
    json: { phone: number },
  });
  expect(asked.status).toBe(200);
  const pin = (await sms()).find((m) => m.to === e164(number))?.body.match(/\b(\d{6})\b/)?.[1];
  await browser.json(routes.verifyPin, '/api/auth/verify-pin', { json: { phone: number, pin } });
  await browser.json(routes.dob, '/api/me/date-of-birth', { json: { dateOfBirth: '2000-02-02' } });
  await agreeAsAdult(browser);
  await browser.json(routes.messaging.PUT, '/api/me/messaging', {
    method: 'PUT',
    json: { channel: 'sms', optedIn: true },
  });
  const created = await browser.json(routes.reminders.POST, '/api/me/reminders', {
    json: { templateId: 'reminder.check-in', channel: 'sms', at: new Date().toISOString() },
  });
  expect(created.status).toBe(201);
  return { browser, number };
}

async function statusOf(browser: Browser) {
  const { body } = await browser.json<{ reminders: Array<{ status: string }> }>(
    routes.reminders.GET,
    '/api/me/reminders',
  );
  return body.reminders[0]?.status;
}

const runJobs = () => new Browser().json(routes.runJobs, '/api/dev/jobs/run', { method: 'POST' });

describe('A5-01 / A12-08: sign-in has its own SMS budget', () => {
  it('a spent reminder budget leaves sign-in working, and the refused reminder waits for the window', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const a = await learnerWithReminder();
    const b = await learnerWithReminder();
    await runJobs();
    // One reminder an hour: one went, the other was refused by the reminder budget.
    const reminders = (await sms()).filter((m) => m.body.startsWith('UniversityFlow: '));
    expect(reminders).toHaveLength(1);

    // Two PINs and a reminder: on one shared budget of three, this PIN would be refused.
    const third = await new Browser().json(routes.requestPin, '/api/auth/request-pin', {
      json: { phone: phone() },
    });
    expect(third.status).toBe(200);

    // The refused reminder is waiting, not failed, however often the runner comes by.
    const waiting = (await statusOf(a.browser)) === 'sent' ? b : a;
    for (let i = 1; i <= 4; i++) {
      vi.setSystemTime(new Date(PINNED.getTime() + i * 5 * 60 * 1000));
      await runJobs();
    }
    expect(await statusOf(waiting.browser)).toBe('scheduled');
    // After the hour: it goes.
    vi.setSystemTime(new Date(PINNED.getTime() + 61 * 60 * 1000));
    await runJobs();
    expect(await statusOf(waiting.browser)).toBe('sent');
    expect(warn).toHaveBeenCalledWith('sms-reminders budget exhausted: 1/1 in the last hour');
    expectNoPhoneNumber(JSON.stringify(warn.mock.calls));
    warn.mockRestore();
  });
});
