import { scheduleReminderJob } from '@universityflow/messaging';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Database, rowsOf } from './client';
import { PostgresJobScheduler } from './jobs';
import { sql as oneWaitingRecheck } from './migrations/0016_one_waiting_recheck';
import { adultStudent, testDatabase, testStore } from './testing';

/**
 * At most one waiting `recheck.changed` reminder per learner (audit A1-12, migration 0016). A
 * learner re-confirming June reports with alternating marks used to add a reminder and a job each
 * time. Now a newer re-check replaces the waiting one, the store hands back its job for the caller
 * to cancel, and a partial unique index holds the database to it whatever the code above does.
 */

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(async () => {
  await database.close();
});

const AT = new Date('2026-10-13T16:00:00Z');
const RECHECK = { templateId: 'recheck.changed', channel: 'sms', desiredAt: AT } as const;

async function learner() {
  const { store } = testStore(database);
  const { studentId } = await adultStudent(store);
  return { store, studentId, student: store.forStudent(studentId) };
}

async function statusOf(id: string) {
  const [row] = rowsOf<{ status: string; outcome_reason: string | null }>(
    await database.db.execute(
      sql`select status, outcome_reason from reminders where id = ${id}::uuid`,
    ),
  );
  return row;
}

describe('one waiting re-check per learner (A1-12)', () => {
  it('a newer re-check replaces the waiting one and hands back its job', async () => {
    const { student } = await learner();
    const first = await student.replaceWaitingReminder(RECHECK);
    expect(first.replacedJobIds).toEqual([]);
    const jobId = '00000000-0000-4000-8000-0000000000a1';
    await student.setReminderJob(first.id, jobId);

    const second = await student.replaceWaitingReminder(RECHECK);
    expect(second.id).not.toBe(first.id);
    expect(second.replacedJobIds).toEqual([jobId]);
    expect(await statusOf(first.id)).toEqual({ status: 'dropped', outcome_reason: 'replaced' });
    expect(await statusOf(second.id)).toEqual({ status: 'scheduled', outcome_reason: null });
    const waiting = (await student.reminders()).filter(
      (r) => r.templateId === 'recheck.changed' && r.status === 'scheduled',
    );
    expect(waiting.map((r) => r.id)).toEqual([second.id]);
  });

  it('leaves a sent re-check, other templates and other learners alone', async () => {
    const a = await learner();
    const b = await learner();
    const sent = await a.student.replaceWaitingReminder(RECHECK);
    await database.exec(
      `update reminders set status = 'sent', sent_at = now() where id = '${sent.id}'`,
    );
    const checkIn = await a.student.createReminder({ ...RECHECK, templateId: 'reminder.check-in' });
    const other = await b.student.replaceWaitingReminder(RECHECK);

    const next = await a.student.replaceWaitingReminder(RECHECK);
    expect(next.replacedJobIds).toEqual([]);
    expect((await statusOf(sent.id))?.status).toBe('sent');
    expect((await statusOf(checkIn))?.status).toBe('scheduled');
    expect((await statusOf(other.id))?.status).toBe('scheduled');
    expect((await statusOf(next.id))?.status).toBe('scheduled');
  });

  it('parallel re-checks still leave one waiting', async () => {
    const { student } = await learner();
    await Promise.all(Array.from({ length: 5 }, () => student.replaceWaitingReminder(RECHECK)));
    const waiting = (await student.reminders()).filter(
      (r) => r.templateId === 'recheck.changed' && r.status === 'scheduled',
    );
    expect(waiting).toHaveLength(1);
  });

  it('the database refuses a second waiting re-check for the same learner', async () => {
    const { student } = await learner();
    await student.createReminder(RECHECK);
    await expect(student.createReminder(RECHECK)).rejects.toThrow();
    // Not for other templates: a learner may set several reminders of their own.
    await student.createReminder({ ...RECHECK, templateId: 'reminder.check-in' });
    await student.createReminder({ ...RECHECK, templateId: 'reminder.check-in' });
  });

  it('the migration keeps a learner’s newest waiting re-check and cancels the others’ jobs', async () => {
    // As a database from before 0016 would be: several waiting for one learner.
    await database.exec('drop index reminders_one_waiting_recheck');
    const { student } = await learner();
    const scheduler = new PostgresJobScheduler(database);
    const older = await student.createReminder(RECHECK);
    const olderJob = await scheduleReminderJob(scheduler, older, AT, 0);
    await student.setReminderJob(older, olderJob);
    await database.exec(
      `update reminders set created_at = created_at - interval '1 hour' where id = '${older}'`,
    );
    const newer = await student.createReminder(RECHECK);

    await database.exec(oneWaitingRecheck);
    expect(await statusOf(older)).toEqual({ status: 'dropped', outcome_reason: 'replaced' });
    expect((await statusOf(newer))?.status).toBe('scheduled');
    expect((await scheduler.get(olderJob))?.status).toBe('cancelled');
    await expect(student.createReminder(RECHECK)).rejects.toThrow();
  });
});
