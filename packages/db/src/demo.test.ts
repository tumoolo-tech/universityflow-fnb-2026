import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Database, rowsOf } from './client';
import { DEMO_STUDENT_TTL_MS, Store } from './store';
import { adultStudent, TEST_SECRET, testDatabase } from './testing';

/**
 * Judge demo mode (UF_DEPLOYMENT=demo, docs/deploy/demo.md): a judge picks a made-up learner and
 * gets a private copy with a session, no phone and no PIN; the copy is deleted after 24 hours.
 * Both operations exist only on a store built for a demo deployment, so production code can never
 * open a session without a PIN or sweep learners away.
 */

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(async () => {
  await database.close();
});

const START = new Date('2026-10-23T08:00:00Z');
const HOUR = 60 * 60 * 1000;

function stores(start = START) {
  let now = start;
  const clock = () => now;
  return {
    demo: new Store(database, { secret: TEST_SECRET, clock, demo: true }),
    ordinary: new Store(database, { secret: TEST_SECRET, clock }),
    advance(ms: number) {
      now = new Date(now.getTime() + ms);
    },
  };
}

async function studentExists(id: string): Promise<boolean> {
  const [row] = rowsOf<{ n: number }>(
    await database.db.execute(sql`select count(*)::int as n from students where id = ${id}::uuid`),
  );
  return Number(row?.n) === 1;
}

async function auditActions(id: string): Promise<string[]> {
  return rowsOf<{ action: string }>(
    await database.db.execute(
      sql`select action from audit_log where student_id = ${id}::uuid order by at`,
    ),
  ).map((r) => r.action);
}

describe('demo sessions', () => {
  it('a demo store opens a session for a student, without a PIN, that lasts 24 hours', async () => {
    const s = stores();
    const { studentId } = await adultStudent(s.ordinary);
    const token = await s.demo.openDemoSession(studentId);
    expect(token).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    expect(await s.demo.sessionStudent(token)).toBe(studentId);
    expect(await auditActions(studentId)).toContain('auth.demo-signed-in');
    s.advance(DEMO_STUDENT_TTL_MS + 1);
    expect(await s.demo.sessionStudent(token)).toBeNull();
  });

  it('an ordinary store refuses to open one', async () => {
    const s = stores();
    const { studentId } = await adultStudent(s.ordinary);
    await expect(s.ordinary.openDemoSession(studentId)).rejects.toThrow(/demo/);
  });

  it('refuses a student that does not exist', async () => {
    const s = stores();
    await expect(s.demo.openDemoSession('00000000-0000-4000-8000-000000000000')).rejects.toThrow();
  });
});

describe('the demo sweep', () => {
  it('deletes students older than 24 hours, with everything they had, and keeps newer ones', async () => {
    const s = stores();
    const old = await adultStudent(s.ordinary);
    await s.ordinary.forStudent(old.studentId).addDocument({
      kind: 'grade-11-report',
      storageKey: 'demo-old-key',
      mimeType: 'application/pdf',
      sizeBytes: 10,
    });
    const young = await adultStudent(s.ordinary);
    // A row's created_at is the database's own time, so the ages are set outright.
    const createdAt = async (id: string, hoursAgo: number) =>
      database.db.execute(
        sql`update students set created_at = ${new Date(START.getTime() - hoursAgo * HOUR).toISOString()}::timestamptz where id = ${id}::uuid`,
      );
    await createdAt(old.studentId, 24.01);
    await createdAt(young.studentId, 23.9);
    const swept = await s.demo.sweepDemoStudents();
    expect(swept.students).toBeGreaterThanOrEqual(1);
    expect(swept.fileKeys).toContain('demo-old-key');
    expect(await studentExists(old.studentId)).toBe(false);
    expect(await studentExists(young.studentId)).toBe(true);
    // The session went with the student.
    expect(await s.demo.sessionStudent(old.token)).toBeNull();
  });

  it('an ordinary store refuses to sweep', async () => {
    const s = stores();
    await expect(s.ordinary.sweepDemoStudents()).rejects.toThrow(/demo/);
  });
});
