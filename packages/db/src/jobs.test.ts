import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineJobKind, entityId, handle } from '@universityflow/jobs';
import { jobSchedulerContract } from '@universityflow/jobs/contract';
import { type SQL, sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Database, migrate, openDatabase, rowsOf } from './client';
import { PostgresJobScheduler } from './jobs';
import { adultStudent, postgresJobHarness, testDatabase, testStore } from './testing';

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(async () => {
  await database.close();
});

describe('PostgresJobScheduler meets the job scheduler contract (embedded Postgres)', () => {
  jobSchedulerContract(() => postgresJobHarness(database)());
});

const REMINDER = defineJobKind('reminder.send', ['reminderId']);

describe('the jobs table', () => {
  const insert = (payload: string) =>
    database.exec(
      `insert into jobs (kind, payload, run_at, created_at) values ('reminder.send', '${payload}'::jsonb, now(), now())`,
    );

  it('refuses a payload holding anything but IDs, even written around the scheduler (hard rule 4)', async () => {
    const id = randomUUID();
    await expect(insert(`{"reminderId":"${id}"}`)).resolves.toBeUndefined();
    for (const bad of [
      `{"reminderId":"Thandi Synthetic"}`,
      `{"reminderId":"${id.toUpperCase()}"}`,
      `{"reminderId":"${id}","phone":"${id}"}`,
      `{"reminderId":{"id":"${id}"}}`,
      `{"reminderId":42}`,
      '{}',
      `["${id}"]`,
      `"${id}"`,
      'null',
    ]) {
      await expect(insert(bad), bad).rejects.toThrow();
    }
  });

  it('is out of reach of the per-request role', async () => {
    const h = testStore(database);
    const { studentId } = await adultStudent(h.store);
    const error = await database.db
      .transaction(async (tx) => {
        await tx.execute(sql`select set_config('uf.student_id', ${studentId}, true)`);
        await tx.execute(sql`set local role uf_app`);
        await tx.execute(sql`select * from jobs`);
      })
      .then(
        () => '',
        (e: { cause?: { message?: string }; message: string }) => e.cause?.message ?? e.message,
      );
    expect(error).toMatch(/permission denied/);
  });
});

describe('A4-08: claiming a due job', () => {
  const NOW = new Date('2026-10-13T08:00:00Z');
  const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60 * 1000).toISOString();
  /** A job written straight into the table, in whatever state the test needs. */
  async function row(
    state: { status: 'pending' } | { status: 'running'; leaseUntil: string; attempts: number },
    runAt: string,
  ): Promise<string> {
    const reminderId = randomUUID();
    const lease = state.status === 'running' ? state.leaseUntil : null;
    const attempts = state.status === 'running' ? state.attempts : 0;
    await database.db.execute(sql`
      insert into jobs (kind, payload, run_at, status, attempts, lease_until, created_at)
      values ('reminder.send', ${JSON.stringify({ reminderId })}::jsonb, ${runAt}::timestamptz,
        ${state.status}, ${attempts}, ${lease}::timestamptz, ${runAt}::timestamptz)`);
    return reminderId;
  }

  it('takes a pending job before an expired lease, and still takes the expired one after', async () => {
    await database.exec('delete from jobs');
    // The expired lease is older, so one query ordering both by run_at would take it first.
    const expired = await row({ status: 'running', leaseUntil: at(-1), attempts: 1 }, at(-180));
    const pending = await row({ status: 'pending' }, at(-60));
    // A lease still running, and a job not due yet: neither is taken.
    await row({ status: 'running', leaseUntil: at(5), attempts: 1 }, at(-240));
    await row({ status: 'pending' }, at(60));
    const seen: string[] = [];
    const report = await new PostgresJobScheduler(database, { clock: () => NOW }).runDue([
      handle(REMINDER, async ({ reminderId }) => void seen.push(reminderId)),
    ]);
    expect(seen).toEqual([pending, expired]);
    expect(report.completed).toHaveLength(2);
  });

  it('claims a pending job through the jobs_due index, in order, not by scanning every due job', async () => {
    await database.exec('delete from jobs');
    for (let i = 0; i < 20; i += 1) await row({ status: 'pending' }, at(-i));
    await row({ status: 'running', leaseUntil: at(-1), attempts: 1 }, at(-30));
    // Every statement the scheduler sends, so the claim itself is what gets explained.
    const statements: SQL[] = [];
    const watched: Database = {
      ...database,
      db: new Proxy(database.db, {
        get(target, key) {
          const value = Reflect.get(target, key, target) as unknown;
          if (key === 'execute') {
            return (query: SQL) => {
              statements.push(query);
              return target.execute(query);
            };
          }
          return typeof value === 'function' ? value.bind(target) : value;
        },
      }),
    };
    await new PostgresJobScheduler(watched, { clock: () => NOW }).runDue(
      [handle(REMINDER, async () => undefined)],
      { limit: 1 },
    );
    const dialect = new PgDialect();
    const claims = statements.filter((s) =>
      /set status = 'running'/.test(dialect.sqlToQuery(s).sql),
    );
    expect(claims.length).toBeGreaterThan(0);
    const [first] = claims as [SQL];
    // With sequential scans priced out, the plan shows what the indexes allow: an ordered scan of
    // jobs_due that stops at the first row, never a bitmap of every due job sorted afterwards.
    const plan = await database.db.transaction(async (tx) => {
      await tx.execute(sql`set local enable_seqscan = off`);
      return rowsOf<{ 'QUERY PLAN': string }>(await tx.execute(sql`explain ${first}`))
        .map((r) => r['QUERY PLAN'])
        .join('\n');
    });
    expect(plan).toMatch(/Index Scan using jobs_due/);
    expect(plan).not.toMatch(/Bitmap/);
  });
});

describe('PostgresJobScheduler across a restart', () => {
  const root = mkdtempSync(join(tmpdir(), 'uf-jobs-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('keeps a scheduled job when the server stops, and runs it after', async () => {
    const url = `pglite:${join(root, 'db')}`;
    let now = new Date('2026-10-13T08:00:00Z');
    const reminderId = entityId(randomUUID());

    const before = openDatabase(url);
    await migrate(before);
    const { id } = await new PostgresJobScheduler(before, { clock: () => now }).schedule({
      kind: REMINDER,
      payload: { reminderId },
      delayMs: 3 * 24 * 60 * 60 * 1000,
    });
    await before.close();

    now = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const after = openDatabase(url);
    const seen: string[] = [];
    const report = await new PostgresJobScheduler(after, { clock: () => now }).runDue([
      handle(REMINDER, async (payload) => void seen.push(payload.reminderId)),
    ]);
    expect(report.completed).toEqual([id]);
    expect(seen).toEqual([reminderId]);
    const rows = rowsOf<{ status: string }>(
      await after.db.execute(sql`select status from jobs where id = ${id}::uuid`),
    );
    expect(rows).toEqual([{ status: 'done' }]);
    await after.close();
    // Two on-disk databases started and migrated in one test: slow when the whole gate runs.
  }, 120_000);
});
