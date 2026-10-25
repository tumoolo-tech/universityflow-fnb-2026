import { renderMessage } from '@universityflow/content';
import { toGsm7Typography } from '@universityflow/messaging';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { agreeAsAdult } from './adult-consent';
import { Browser } from './harness';

/**
 * Phase 4c over the real route handlers, an embedded database and the local stand-ins:
 * "what I need" from the latest confirmed report, and re-checks after a June or September
 * report, with the `recheck.changed` reminder going through 4a's pipeline.
 *
 * The clock is pinned (Date only) to a Wednesday at 18:00 in South Africa, so quiet hours never
 * decide a test by the time of day it happens to run. Not 10:00: that is inside an NSC paper
 * session (Information Technology P1), which holds every message to a learner whose subjects we
 * don't know yet (A12-03).
 */

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-10-14T16:00:00Z')); // 18:00 SAST, after every paper that day
afterAll(() => {
  vi.useRealTimers();
});

const { getServices } = await import('../lib/server/services');

const routes = {
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  dob: (await import('../app/api/me/date-of-birth/route')).POST,
  guardian: (await import('../app/api/me/guardian/route')).POST,
  exportData: (await import('../app/api/me/export/route')).GET,
  me: await import('../app/api/me/route'),
  messaging: await import('../app/api/me/messaging/route'),
  reminders: await import('../app/api/me/reminders/route'),
  documents: await import('../app/api/documents/route'),
  reports: (await import('../app/api/reports/route')).POST,
  rechecks: (await import('../app/api/rechecks/route')).GET,
  whatINeed: (await import('../app/api/what-i-need/[programmeId]/route')).GET,
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

async function signedIn(number = phone()) {
  const browser = new Browser();
  await browser.json(routes.requestPin, '/api/auth/request-pin', { json: { phone: number } });
  const pin = (await smsTo(number))[0]?.match(/\b(\d{6})\b/)?.[1];
  await browser.json(routes.verifyPin, '/api/auth/verify-pin', { json: { phone: number, pin } });
  return { browser, number };
}

async function adult(options: { sms?: boolean; perWeek?: number } = {}) {
  const session = await signedIn();
  await session.browser.json(routes.dob, '/api/me/date-of-birth', {
    json: { dateOfBirth: '2000-02-02' },
  });
  await agreeAsAdult(session.browser);
  if (options.sms) {
    await session.browser.json(routes.messaging.PUT, '/api/me/messaging', {
      method: 'PUT',
      json: { channel: 'sms', optedIn: true },
    });
  }
  if (options.perWeek) {
    await session.browser.json(routes.messaging.PUT, '/api/me/messaging', {
      method: 'PUT',
      json: { maxPerWeek: options.perWeek },
    });
  }
  return session;
}

const marks = (entries: Record<string, number>) =>
  Object.entries(entries).map(([subject, percent]) => ({ subject, percent }));

const GRADE_11 = marks({
  'english-fal': 62,
  'isizulu-hl': 74,
  mathematics: 58,
  'physical-sciences': 55,
  'life-sciences': 66,
  geography: 61,
  'life-orientation': 80,
});
const JUNE = marks({
  'english-fal': 72,
  'isizulu-hl': 80,
  mathematics: 71,
  'physical-sciences': 68,
  'life-sciences': 74,
  geography: 70,
  'life-orientation': 80,
});

async function confirm(browser: Browser, kind: string, m = GRADE_11) {
  return browser.json<{ reportId: string; recheck: string }>(routes.reports, '/api/reports', {
    json: { kind, marks: m },
  });
}

interface RecheckBody {
  recheck: null | {
    reportKind: string;
    previousKind: string;
    moves: Array<{
      programmeId: string;
      name: string;
      from: string;
      to: string;
      direction: string;
    }>;
    counts: { qualifyNow: { before: number; after: number } };
  };
}

interface ReminderRow {
  id: string;
  templateId: string;
  status: string;
  outcomeReason: string | null;
}

/** The learner's `recheck.changed` reminders, newest first. */
async function recheckReminders(browser: Browser) {
  const { body } = await browser.json<{ reminders: ReminderRow[] }>(
    routes.reminders.GET,
    '/api/me/reminders',
  );
  return body.reminders.filter((r) => r.templateId === 'recheck.changed');
}

const waitingRechecks = async (browser: Browser) =>
  (await recheckReminders(browser)).filter((r) => r.status === 'scheduled');

/** Report confirmations a learner may make in an hour (A1-12). */
const REPORTS_PER_HOUR = 10;

const runJobs = () =>
  new Browser().json<{ completed: number }>(routes.runJobs, '/api/dev/jobs/run', {
    method: 'POST',
  });

describe('what I need (Phase 4c)', () => {
  it('works from the latest confirmed report, for the web and the app', async () => {
    const { browser } = await adult();
    const none = await browser.json(routes.whatINeed, '/api/what-i-need/wits-bsceng-civil', {
      params: { programmeId: 'wits-bsceng-civil' },
    });
    expect(none.body).toEqual({ report: null, result: null });

    await confirm(browser, 'grade-11-final');
    const res = await browser.json<{
      report: { kind: string };
      result: { programmeId: string; draft: boolean; plan: { status: string } };
    }>(routes.whatINeed, '/api/what-i-need/wits-bsceng-civil', {
      params: { programmeId: 'wits-bsceng-civil' },
    });
    expect(res.status).toBe(200);
    expect(res.body.report.kind).toBe('grade-11-final');
    expect(res.body.result.programmeId).toBe('wits-bsceng-civil');
    expect(res.body.result.draft).toBe(true);
    expect(['qualifies', 'reachable', 'unreachable']).toContain(res.body.result.plan.status);

    for (const programmeId of ['nope-nope', 'BAD ID', 'x']) {
      const missing = await browser.json(routes.whatINeed, `/api/what-i-need/x`, {
        params: { programmeId },
      });
      expect(missing.status).toBe(404);
    }
  });

  it('never works from an unconfirmed upload (hard rule 6)', async () => {
    const { browser } = await adult();
    const form = new FormData();
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
    form.append('file', new Blob([jpeg], { type: 'image/jpeg' }), 'report.jpg');
    const upload = await browser.json(routes.documents.POST, '/api/documents', {
      body: form,
      method: 'POST',
    });
    expect(upload.status).toBe(200);
    const res = await browser.json(routes.whatINeed, '/api/what-i-need/wits-bsceng-civil', {
      params: { programmeId: 'wits-bsceng-civil' },
    });
    expect(res.body).toEqual({ report: null, result: null });
  });

  it('refuses a minor waiting for a guardian (hard rule 5)', async () => {
    const { browser } = await signedIn();
    await browser.json(routes.dob, '/api/me/date-of-birth', {
      json: { dateOfBirth: '2010-05-05' },
    });
    const res = await browser.json(routes.whatINeed, '/api/what-i-need/wits-bsceng-civil', {
      params: { programmeId: 'wits-bsceng-civil' },
    });
    expect(res.status).toBe(403);
  });
});

describe('re-checks after the June and September reports (Phase 4c)', () => {
  it('a confirmed June report after a Grade 11 report records the moves, and says so', async () => {
    const { browser } = await adult();
    expect((await confirm(browser, 'grade-11-final')).body.recheck).toBe('not-a-recheck');
    expect((await browser.json<RecheckBody>(routes.rechecks, '/api/rechecks')).body.recheck).toBe(
      null,
    );

    expect((await confirm(browser, 'grade-12-june', JUNE)).body.recheck).toBe('recorded');
    const { body } = await browser.json<RecheckBody>(routes.rechecks, '/api/rechecks');
    expect(body.recheck?.reportKind).toBe('grade-12-june');
    expect(body.recheck?.previousKind).toBe('grade-11-final');
    expect(body.recheck?.counts.qualifyNow.after).toBeGreaterThan(
      body.recheck?.counts.qualifyNow.before ?? Infinity,
    );
    const moves = body.recheck?.moves ?? [];
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((m) => m.direction === 'up' && m.name.length > 0)).toBe(true);
    expect(moves.some((m) => m.from === 'close' && m.to === 'qualify-now')).toBe(true);
  });

  it('a September report is compared with the June one before it', async () => {
    const { browser } = await adult();
    await confirm(browser, 'grade-12-june', JUNE);
    expect((await confirm(browser, 'grade-12-september', GRADE_11)).body.recheck).toBe('recorded');
    const { body } = await browser.json<RecheckBody>(routes.rechecks, '/api/rechecks');
    expect(body.recheck?.previousKind).toBe('grade-12-june');
    expect(body.recheck?.moves.every((m) => m.direction === 'down')).toBe(true);
  });

  it('only June and September reports, and only with a report before them', async () => {
    const { browser } = await adult();
    expect((await confirm(browser, 'grade-12-june')).body.recheck).toBe('no-previous-report');
    expect((await confirm(browser, 'grade-12-final', JUNE)).body.recheck).toBe('not-a-recheck');
    // The re-check shown belongs to the current report only: the final report has none.
    expect((await browser.json<RecheckBody>(routes.rechecks, '/api/rechecks')).body.recheck).toBe(
      null,
    );
  });

  it('an unconfirmed extraction never triggers one (hard rule 6)', async () => {
    const { browser } = await adult({ sms: true });
    await confirm(browser, 'grade-11-final');
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])], { type: 'image/jpeg' }),
      'june.jpg',
    );
    const upload = await browser.json(routes.documents.POST, '/api/documents', {
      body: form,
      method: 'POST',
    });
    expect(upload.status).toBe(200);
    expect((await browser.json<RecheckBody>(routes.rechecks, '/api/rechecks')).body.recheck).toBe(
      null,
    );
    const reminders = await browser.json<{ reminders: Array<{ templateId: string }> }>(
      routes.reminders.GET,
      '/api/me/reminders',
    );
    expect(reminders.body.reminders).toEqual([]);
  });

  it('the same marks again: recorded, nothing moved, no message', async () => {
    const { browser } = await adult({ sms: true });
    await confirm(browser, 'grade-11-final');
    await confirm(browser, 'grade-12-june');
    const { body } = await browser.json<RecheckBody>(routes.rechecks, '/api/rechecks');
    expect(body.recheck?.moves).toEqual([]);
    const reminders = await browser.json<{ reminders: unknown[] }>(
      routes.reminders.GET,
      '/api/me/reminders',
    );
    expect(reminders.body.reminders).toEqual([]);
  });

  it('a minor without consent can confirm nothing, so gets nothing (hard rule 5)', async () => {
    const { browser } = await signedIn();
    await browser.json(routes.dob, '/api/me/date-of-birth', {
      json: { dateOfBirth: '2010-05-05' },
    });
    await browser.json(routes.guardian, '/api/me/guardian', {
      json: { name: 'Test Guardian', phone: phone(), relationship: 'parent' },
    });
    expect((await confirm(browser, 'grade-12-june', JUNE)).status).toBe(403);
    expect((await browser.json(routes.rechecks, '/api/rechecks')).status).toBe(403);
  });

  it('is in the export, and goes with the account', async () => {
    const { browser } = await adult();
    await confirm(browser, 'grade-11-final');
    await confirm(browser, 'grade-12-june', JUNE);
    const exported = await browser.json<{ personal: { rechecks: unknown[] } }>(
      routes.exportData,
      '/api/me/export',
    );
    expect(exported.body.personal.rechecks).toHaveLength(1);
    const deleted = await browser.json(routes.me.DELETE, '/api/me', { method: 'DELETE' });
    expect(deleted.status).toBe(200);
  });
});

describe('the recheck.changed reminder goes through the 4a pipeline', () => {
  it('opted in to SMS: one message, saying only that something changed', async () => {
    const { browser, number } = await adult({ sms: true });
    await confirm(browser, 'grade-11-final');
    await confirm(browser, 'grade-12-june', JUNE);
    const reminders = await browser.json<{
      reminders: Array<{ templateId: string; channel: string; status: string }>;
    }>(routes.reminders.GET, '/api/me/reminders');
    expect(reminders.body.reminders).toMatchObject([
      { templateId: 'recheck.changed', channel: 'sms', status: 'scheduled' },
    ]);
    await runJobs();
    const sent = (await smsTo(number)).filter((b) => /checked your courses/.test(b));
    // The template's SMS words, "Reply STOP to stop." included (A12-10), with GSM-7 typography
    // on SMS (A1-14).
    expect(sent).toEqual([toGsm7Typography(renderMessage('recheck.changed', {}, 'sms'))]);
    expect(sent[0]).toMatch(/ Reply STOP to stop\.$/);
    // No course, university, mark or score rides along.
    expect(sent[0]).not.toMatch(/\d|wits|engineering|APS/i);
  });

  it('not opted in to any channel: the change is recorded, and no message is scheduled', async () => {
    const { browser } = await adult();
    await confirm(browser, 'grade-11-final');
    expect((await confirm(browser, 'grade-12-june', JUNE)).body.recheck).toBe('recorded');
    const reminders = await browser.json<{ reminders: unknown[] }>(
      routes.reminders.GET,
      '/api/me/reminders',
    );
    expect(reminders.body.reminders).toEqual([]);
  });

  it('respects the learner’s weekly cap: held back, not sent', async () => {
    const { browser, number } = await adult({ sms: true, perWeek: 1 });
    // The learner's one message this week goes first.
    await browser.json(routes.reminders.POST, '/api/me/reminders', {
      json: { templateId: 'reminder.check-in', channel: 'sms', at: new Date().toISOString() },
    });
    await runJobs();
    await confirm(browser, 'grade-11-final');
    await confirm(browser, 'grade-12-june', JUNE);
    await runJobs();
    expect((await smsTo(number)).filter((b) => /checked your courses/.test(b))).toEqual([]);
    const reminders = await browser.json<{
      reminders: Array<{ templateId: string; status: string }>;
    }>(routes.reminders.GET, '/api/me/reminders');
    expect(reminders.body.reminders.find((r) => r.templateId === 'recheck.changed')?.status).toBe(
      'scheduled',
    );
  });

  it('a newer re-check replaces the waiting one, and cancels its job (A1-12)', async () => {
    const { browser, number } = await adult({ sms: true });
    await confirm(browser, 'grade-11-final');
    await confirm(browser, 'grade-12-june', JUNE);
    const first = await waitingRechecks(browser);
    expect(first).toHaveLength(1);
    const { messaging, store, jobs } = await getServices();
    const studentId = (await messaging.reminder(first[0]?.id ?? ''))?.studentId ?? '';
    const [firstJob] = await store.forStudent(studentId).scheduledJobIds();

    // The learner corrects their June marks: a second re-check, still one waiting message.
    await confirm(browser, 'grade-12-june', GRADE_11);
    const now = await waitingRechecks(browser);
    expect(now).toHaveLength(1);
    expect(now[0]?.id).not.toBe(first[0]?.id);
    const all = await recheckReminders(browser);
    expect(all.find((r) => r.id === first[0]?.id)).toMatchObject({
      status: 'dropped',
      outcomeReason: 'replaced',
    });
    expect((await jobs.get(firstJob ?? ''))?.status).toBe('cancelled');
    expect(await store.forStudent(studentId).scheduledJobIds()).not.toContain(firstJob);

    await runJobs();
    expect((await smsTo(number)).filter((b) => /checked your courses/.test(b))).toHaveLength(1);
  });

  it('a genuine new report after the last re-check went still gets its message (A1-12)', async () => {
    const { browser, number } = await adult({ sms: true });
    await confirm(browser, 'grade-11-final');
    await confirm(browser, 'grade-12-june', JUNE);
    await runJobs();
    expect((await recheckReminders(browser)).map((r) => r.status)).toEqual(['sent']);
    expect((await smsTo(number)).filter((b) => /checked your courses/.test(b))).toHaveLength(1);

    expect((await confirm(browser, 'grade-12-september', GRADE_11)).body.recheck).toBe('recorded');
    expect(await waitingRechecks(browser)).toHaveLength(1);
    // The clock is pinned, so both were made in the same instant: compare as a set.
    expect((await recheckReminders(browser)).map((r) => r.status).sort()).toEqual([
      'scheduled',
      'sent',
    ]);
  });

  it('25 alternating June confirmations: one waiting re-check, and a 429 past the limit (A1-12)', async () => {
    const { browser } = await adult({ sms: true });
    const statuses: number[] = [(await confirm(browser, 'grade-11-final')).status];
    for (let i = 0; i < 25; i++) {
      statuses.push(
        (await confirm(browser, 'grade-12-june', i % 2 === 0 ? JUNE : GRADE_11)).status,
      );
    }
    expect(statuses.slice(0, REPORTS_PER_HOUR)).toEqual(Array(REPORTS_PER_HOUR).fill(200));
    expect(statuses.slice(REPORTS_PER_HOUR)).toEqual(
      Array(statuses.length - REPORTS_PER_HOUR).fill(429),
    );
    expect(await waitingRechecks(browser)).toHaveLength(1);
    // Every re-check that was replaced had its job taken off the schedule.
    const { messaging, store } = await getServices();
    const [waiting] = await waitingRechecks(browser);
    const studentId = (await messaging.reminder(waiting?.id ?? ''))?.studentId ?? '';
    expect(await store.forStudent(studentId).scheduledJobIds()).toHaveLength(1);
  });

  it('opted out after it was scheduled: nothing goes', async () => {
    const { browser, number } = await adult({ sms: true });
    await confirm(browser, 'grade-11-final');
    await confirm(browser, 'grade-12-june', JUNE);
    await browser.json(routes.messaging.PUT, '/api/me/messaging', {
      method: 'PUT',
      json: { channel: 'sms', optedIn: false },
    });
    await runJobs();
    expect((await smsTo(number)).filter((b) => /checked your courses/.test(b))).toEqual([]);
  });
});
