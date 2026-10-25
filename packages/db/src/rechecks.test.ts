import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { type Database, rowsOf } from './client';
import { ConsentRequiredError } from './errors';
import type { RecheckCounts, RecheckMove } from './schema';
import { adultStudent, signIn, testDatabase, testStore } from './testing';

/**
 * Re-checks (Phase 4c, migration 0007) on real Postgres (PGlite): stored behind row-level
 * security and the consent gate, ids and group names only, in the export, gone with the account.
 */

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(async () => {
  await database.close();
});

const COUNTS: RecheckCounts = {
  qualifyNow: { before: 1, after: 2 },
  onTrack: { before: 0, after: 0 },
  close: { before: 2, after: 1 },
  planB: { before: 0, after: 0 },
};
const MOVES: RecheckMove[] = [
  { programmeId: 'uj-bcom-accounting', from: 'close', to: 'qualify-now', direction: 'up' },
];
const G11 = [{ subject: 'mathematics', percent: 58 }];
const JUNE = [{ subject: 'mathematics', percent: 66 }];

async function learnerWithTwoReports() {
  const { store } = testStore(database);
  const { studentId } = await adultStudent(store);
  const student = store.forStudent(studentId);
  const previous = await student.saveConfirmedReport({ kind: 'grade-11-final', marks: G11 });
  const latest = await student.saveConfirmedReport({ kind: 'grade-12-june', marks: JUNE });
  return { store, studentId, student, previous, latest };
}

describe('recentReports', () => {
  it('returns confirmed reports newest first, with their marks', async () => {
    const { student, previous, latest } = await learnerWithTwoReports();
    const reports = await student.recentReports(2);
    expect(reports.map((r) => r.id)).toEqual([latest, previous]);
    expect(reports[0]?.kind).toBe('grade-12-june');
    expect(reports[1]?.marks).toEqual(G11);
    expect((await student.latestReport())?.id).toBe(latest);
  });

  it('orders confirmations strictly, even within the same millisecond', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2027-07-01T08:00:00Z'));
    try {
      const { student, previous, latest } = await learnerWithTwoReports();
      const reports = await student.recentReports(2);
      expect(reports.map((r) => r.id)).toEqual([latest, previous]);
      expect(reports[0]?.confirmedAt.getTime()).toBeGreaterThan(
        reports[1]?.confirmedAt.getTime() ?? Infinity,
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('rechecks', () => {
  it('saves and reads back the newest re-check with both reports’ kinds, and audits it', async () => {
    const { student, studentId, previous, latest } = await learnerWithTwoReports();
    expect(await student.latestRecheck()).toBeNull();
    const id = await student.saveRecheck({
      reportId: latest,
      previousReportId: previous,
      moves: MOVES,
      counts: COUNTS,
      includesDrafts: true,
    });
    const view = await student.latestRecheck();
    expect(view).toMatchObject({
      id,
      reportId: latest,
      reportKind: 'grade-12-june',
      previousReportId: previous,
      previousKind: 'grade-11-final',
      moves: MOVES,
      counts: COUNTS,
      includesDrafts: true,
    });
    const audit = rowsOf<{ action: string }>(
      await database.db.execute(
        sql`select action from audit_log where student_id = ${studentId} order by id`,
      ),
    );
    expect(audit.map((a) => a.action)).toContain('report.rechecked');
  });

  it('keeps only the four fields of a move, whatever the caller passes', async () => {
    const { student, previous, latest } = await learnerWithTwoReports();
    await student.saveRecheck({
      reportId: latest,
      previousReportId: previous,
      moves: [{ ...MOVES[0], name: 'Somebody’s secret' } as unknown as RecheckMove],
      counts: COUNTS,
      includesDrafts: false,
    });
    expect((await student.latestRecheck())?.moves).toEqual(MOVES);
  });

  it('the database refuses anything but programme ids and group names (hard rule 4)', async () => {
    const { studentId, previous, latest } = await learnerWithTwoReports();
    const bad = [
      [{ ...MOVES[0], note: 'free text' }],
      [{ ...MOVES[0], programmeId: 'Thandi Nkosi' }],
      [{ ...MOVES[0], to: 'accepted' }],
      [{ ...MOVES[0], direction: 'sideways' }],
      [{ programmeId: 'x', from: 'close', to: 'close' }],
      { not: 'an array' },
    ];
    for (const moves of bad) {
      await expect(
        database.exec(`insert into rechecks (student_id, report_id, previous_report_id, moves, counts, includes_drafts, created_at)
          values ('${studentId}', '${latest}', '${previous}', '${JSON.stringify(moves)}', '{}', false, now())`),
      ).rejects.toThrow();
    }
  });

  it('keeps a move from Grade 10’s on track (0024, G10-3)', async () => {
    const { student, previous, latest } = await learnerWithTwoReports();
    const moves: RecheckMove[] = [
      { programmeId: 'uj-bcom-accounting', from: 'on-track', to: 'qualify-now', direction: 'up' },
    ];
    await student.saveRecheck({
      reportId: latest,
      previousReportId: previous,
      moves,
      counts: COUNTS,
      includesDrafts: false,
    });
    expect((await student.latestRecheck())?.moves).toEqual(moves);
  });

  it('compares only the learner’s own reports', async () => {
    const a = await learnerWithTwoReports();
    const b = await learnerWithTwoReports();
    await expect(
      a.student.saveRecheck({
        reportId: a.latest,
        previousReportId: b.previous,
        moves: [],
        counts: COUNTS,
        includesDrafts: false,
      }),
    ).rejects.toThrow();
  });

  it('is invisible to another learner (row-level security)', async () => {
    const a = await learnerWithTwoReports();
    await a.student.saveRecheck({
      reportId: a.latest,
      previousReportId: a.previous,
      moves: MOVES,
      counts: COUNTS,
      includesDrafts: false,
    });
    const b = await learnerWithTwoReports();
    expect(await b.student.latestRecheck()).toBeNull();
  });

  it('a minor without a guardian’s consent gets nothing written or read (hard rule 5)', async () => {
    const { store } = testStore(database);
    const { studentId } = await signIn(store);
    await store.setDateOfBirth(studentId, '2010-05-01');
    const minor = store.forStudent(studentId);
    await expect(minor.recentReports()).rejects.toThrow(ConsentRequiredError);
    await expect(minor.latestRecheck()).rejects.toThrow(ConsentRequiredError);
    await expect(
      minor.saveRecheck({
        reportId: '00000000-0000-4000-8000-000000000000',
        previousReportId: '00000000-0000-4000-8000-000000000001',
        moves: [],
        counts: COUNTS,
        includesDrafts: false,
      }),
    ).rejects.toThrow(ConsentRequiredError);
  });

  it('is in the learner’s export, and deleted with the account', async () => {
    const { student, studentId, previous, latest } = await learnerWithTwoReports();
    await student.saveRecheck({
      reportId: latest,
      previousReportId: previous,
      moves: MOVES,
      counts: COUNTS,
      includesDrafts: false,
    });
    const exported = await student.exportAll();
    expect(exported.personal?.rechecks).toHaveLength(1);
    expect(exported.personal?.rechecks[0]?.moves).toEqual(MOVES);

    await student.deleteAccount();
    const left = rowsOf<{ n: number }>(
      await database.db.execute(
        sql`select count(*)::int as n from rechecks where student_id = ${studentId}`,
      ),
    );
    expect(left[0]?.n).toBe(0);
  });
});
