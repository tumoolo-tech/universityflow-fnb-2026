import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Database, rowsOf } from './client';
import { PostgresJobScheduler } from './jobs';
import {
  nextSessionSweepAt,
  SESSION_SWEEP,
  SESSION_SWEEP_ID,
  scheduleSessionSweep,
  sessionSweepHandler,
} from './session-sweep';
import { type ReviewSignIn, reviewPinHash, SESSION_TTL_MS } from './store';
import {
  adultStudent,
  signIn,
  syntheticPhone,
  TEST_SECRET,
  testDatabase,
  testStore,
} from './testing';

/**
 * The daily sweep of expired sessions (audit A11-03). A push token hangs off the session that
 * registered it, so a learner who simply stops using the app must not keep a device identifier
 * on file forever: the sweep deletes expired sessions, and their tokens go with them.
 */

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(async () => {
  await database.close();
});
beforeEach(async () => {
  await database.exec('delete from jobs');
});

const DAY = 24 * 60 * 60 * 1000;
const START = new Date('2026-10-13T08:00:00Z');
let nextToken = 1;
const pushToken = () => `ExponentPushToken[sweep${String(nextToken++).padStart(10, '0')}]`;

function harness(options: { review?: ReviewSignIn | null } = {}, start = START) {
  const h = testStore(database, start, options);
  let now = start;
  const clock = () => now;
  return {
    ...h,
    clock,
    advance(ms: number) {
      now = new Date(now.getTime() + ms);
      h.advance(ms);
    },
  };
}

async function count(table: 'sessions' | 'push_tokens', studentId: string): Promise<number> {
  const [row] = rowsOf<{ n: number }>(
    await database.db.execute(
      sql`select count(*)::int as n from ${sql.raw(table)} where student_id = ${studentId}::uuid`,
    ),
  );
  return Number(row?.n);
}

describe('the session sweep (A11-03)', () => {
  it('31 days after sign-in the daily sweep leaves no session, no push token, and none in the export', async () => {
    const h = harness();
    const a = await adultStudent(h.store);
    const student = h.store.forStudent(a.studentId);
    await student.registerPushToken({ token: pushToken(), platform: 'ios', sessionToken: a.token });
    const scheduler = new PostgresJobScheduler(database, { clock: h.clock });
    const handler = sessionSweepHandler({ store: h.store, scheduler, clock: h.clock });
    await scheduleSessionSweep(scheduler, h.clock());

    // A learner who signs in later still has a live session when the sweep runs.
    h.advance(10 * DAY);
    const b = await signIn(h.store, syntheticPhone());

    h.advance(21 * DAY);
    const report = await scheduler.runDue([handler]);
    expect(report.completed).toHaveLength(1);
    expect(await count('sessions', a.studentId)).toBe(0);
    expect(await count('push_tokens', a.studentId)).toBe(0);
    const exported = await student.exportAll();
    expect(exported.personal?.messaging.pushTokens).toEqual([]);
    expect(await count('sessions', b.studentId)).toBe(1);
    expect(await h.store.sessionStudent(b.token)).toBe(b.studentId);
  });

  it('runs daily: each run puts the next on the schedule, once, carrying no personal data', async () => {
    const h = harness();
    const scheduler = new PostgresJobScheduler(database, { clock: h.clock });
    const handler = sessionSweepHandler({ store: h.store, scheduler, clock: h.clock });
    const first = await scheduleSessionSweep(scheduler, h.clock());
    // Seeding again (another server starting) finds the same job.
    expect((await scheduleSessionSweep(scheduler, h.clock())).id).toBe(first.id);
    expect(first.runAt).toEqual(nextSessionSweepAt(h.clock()));
    const job = await scheduler.get(first.id);
    expect(job).toMatchObject({ kind: SESSION_SWEEP.name, payload: { sweepId: SESSION_SWEEP_ID } });

    h.advance(first.runAt.getTime() - h.clock().getTime());
    expect((await scheduler.runDue([handler])).completed).toEqual([first.id]);
    const next = await scheduleSessionSweep(scheduler, h.clock());
    expect(next.created).toBe(false);
    expect(next.runAt.getTime() - first.runAt.getTime()).toBe(DAY);
  });

  it('the next sweep is at 01:00 SAST, always in the future', () => {
    expect(nextSessionSweepAt(new Date('2026-10-13T08:00:00Z'))).toEqual(
      new Date('2026-10-13T23:00:00Z'),
    );
    expect(nextSessionSweepAt(new Date('2026-10-13T23:00:00Z'))).toEqual(
      new Date('2026-10-14T23:00:00Z'),
    );
    expect(nextSessionSweepAt(new Date('2026-10-13T23:30:00Z'))).toEqual(
      new Date('2026-10-14T23:00:00Z'),
    );
  });

  it('a session that ends exactly now is expired; one a moment from now is not', async () => {
    const h = harness();
    const a = await signIn(h.store, syntheticPhone());
    h.advance(SESSION_TTL_MS - 1);
    await h.store.sweepExpiredSessions();
    expect(await count('sessions', a.studentId)).toBe(1);
    h.advance(1);
    await h.store.sweepExpiredSessions();
    expect(await count('sessions', a.studentId)).toBe(0);
  });

  it('the store-review account’s sessions are sessions too: swept once its review window has closed', async () => {
    const phone = syntheticPhone(8_500_000);
    const pin = '246810';
    const until = new Date('2026-10-20T23:59:59.999+02:00');
    const review: ReviewSignIn = { phone, pinHash: reviewPinHash(phone, pin, TEST_SECRET), until };
    const open = harness({ review });
    const { studentId } = await open.store.seedReviewAccount(phone);
    await open.store.requestOtp(phone);
    await open.store.verifyOtp(phone, pin);
    // While the window is open, the sweep leaves the review session alone.
    await open.store.sweepExpiredSessions();
    expect(await count('sessions', studentId)).toBe(1);
    // The owner closes the review sign-in (no configuration any more): the session can no
    // longer be used, so the sweep removes it, though its own end date is still ahead.
    await harness({ review: null }).store.sweepExpiredSessions();
    expect(await count('sessions', studentId)).toBe(0);
  });
});
