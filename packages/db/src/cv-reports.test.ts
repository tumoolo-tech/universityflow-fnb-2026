import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Database, rowsOf } from './client';
import type { CvAccess } from './cv';
import { ConsentRequiredError, CvBusyError, InvalidStateError, NotFoundError } from './errors';
import { signIn, syntheticPhone, testDatabase, testStore } from './testing';

/**
 * Wave 5 (2026-10-24), My CV:
 * - A10-58 "Report this CV" (migration 0039, design §11, A10-35's pattern): a learner reports a
 *   fitted CV, which an AI wrote, for a person to look at. Ids and a reason from a fixed list, no
 *   CV text copied (hard rule 4); once per CV; behind row-level security and the consent gate;
 *   exported with the account and deleted with it.
 * - A11-38 deleting one CV (D13: "the CVs until the learner deletes them"): its row, its share
 *   links and its report go; the PDF's key comes back for the caller to delete the file. Never a
 *   CV still being made (its job holds the id), never another learner's.
 * Synthetic learners only.
 */

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(async () => {
  await database.close();
});

const LIVE: CvAccess = { preview: false };
const PURPOSES = ['cv.draft', 'cv.tailor', 'cv.ats', 'cv.share'] as const;

async function optedInAdult() {
  const { store } = testStore(database);
  const { studentId } = await signIn(store, syntheticPhone());
  await store.setDateOfBirth(studentId, '2000-01-15');
  await store.consentAsAdult(studentId, 'adult-v3-test');
  const student = store.forStudent(studentId);
  await student.cvOptIn({ version: 'cv-optin-v1', purposes: [...PURPOSES] }, LIVE);
  return { store, studentId, student };
}

type Learner = Awaited<ReturnType<typeof optedInAdult>>;

/** A queued CV of `kind`; a ready one when `ready`, written the way the collect job writes it. */
async function cv(learner: Learner, kind: 'draft' | 'tailored', ready = true) {
  const doc = await learner.student.requestCvDocument(
    kind === 'draft'
      ? { kind }
      : { kind, advert: { title: 'Junior developer', company: null, text: 'Python.' } },
    LIVE,
  );
  if (!ready) return { id: doc.id, fileKey: null };
  await learner.student.markCvSubmitted(doc.id, `job-${crypto.randomUUID()}`, LIVE);
  const fileKey = `cv-${crypto.randomUUID().replaceAll('-', '')}`;
  await learner.student.storeCvResult(
    doc.id,
    {
      markdown: '# Thandi Example\n',
      gaps: [],
      ats: null,
      fileKey,
      sha256: 'a'.repeat(64),
      bytes: 100,
    },
    LIVE,
  );
  return { id: doc.id, fileKey };
}

async function count(table: string, where: string) {
  const [row] = rowsOf<{ n: number }>(
    await database.db.execute(sql.raw(`select count(*)::int as n from ${table} where ${where}`)),
  );
  return row?.n ?? 0;
}

describe('reporting a fitted CV (A10-58)', () => {
  it('records a report of the learner’s own fitted CV once, and says so the second time', async () => {
    const learner = await optedInAdult();
    const { id } = await cv(learner, 'tailored');
    expect(await learner.student.reportCvDocument(id, 'untrue')).toEqual({ status: 'reported' });
    expect(await learner.student.reportCvDocument(id, 'harmful')).toEqual({
      status: 'already-reported',
    });
    expect(await learner.student.reportedCvDocuments()).toEqual([id]);
    const [row] = rowsOf<{ reason: string }>(
      await database.db.execute(sql`select reason from cv_reports where document_id = ${id}::uuid`),
    );
    expect(row?.reason).toBe('untrue');
  });

  it('holds ids and the reason only: no CV text, no advert', async () => {
    const columns = rowsOf<{ column_name: string }>(
      await database.db.execute(
        sql`select column_name from information_schema.columns where table_name = 'cv_reports' order by column_name`,
      ),
    ).map((c) => c.column_name);
    expect(columns).toEqual(['created_at', 'document_id', 'id', 'reason', 'student_id']);
  });

  it('logs the report by id and reason only', async () => {
    const learner = await optedInAdult();
    const { id } = await cv(learner, 'tailored');
    await learner.student.reportCvDocument(id, 'other');
    const audit = rowsOf<{ action: string; reason: string | null }>(
      await database.db.execute(
        sql`select action, reason from audit_log where student_id = ${learner.studentId}::uuid and action = 'cv.reported'`,
      ),
    );
    expect(audit).toEqual([{ action: 'cv.reported', reason: 'other' }]);
  });

  it('refuses a base CV (no AI wrote it), one still being made, an unknown reason and a malformed id', async () => {
    const learner = await optedInAdult();
    const base = await cv(learner, 'draft');
    await expect(learner.student.reportCvDocument(base.id, 'untrue')).rejects.toThrow(
      InvalidStateError,
    );
    const fitted = await cv(learner, 'tailored');
    await expect(learner.student.reportCvDocument(fitted.id, 'rude' as never)).rejects.toThrow(
      InvalidStateError,
    );
    await expect(learner.student.reportCvDocument('not-an-id', 'untrue')).rejects.toThrow(
      NotFoundError,
    );
    const busy = await cv(learner, 'tailored', false);
    await expect(learner.student.reportCvDocument(busy.id, 'untrue')).rejects.toThrow(
      InvalidStateError,
    );
    expect(await count('cv_reports', `student_id = '${learner.studentId}'`)).toBe(0);
  });

  it('never reaches another learner’s CV, in the store or the database', async () => {
    const owner = await optedInAdult();
    const { id } = await cv(owner, 'tailored');
    const other = await optedInAdult();
    await expect(other.student.reportCvDocument(id, 'untrue')).rejects.toThrow(NotFoundError);
    expect(await count('cv_reports', `document_id = '${id}'`)).toBe(0);
    // As the learner's role, a row naming someone else's CV is refused (row-level security).
    await expect(
      database.db.transaction(async (tx) => {
        await tx.execute(
          sql`select set_config('uf.student_id', ${other.studentId}, true), set_config('uf.today', '2026-10-24', true)`,
        );
        await tx.execute(sql`set local role uf_app`);
        await tx.execute(
          sql`insert into cv_reports (student_id, document_id, reason) values (${owner.studentId}::uuid, ${id}::uuid, 'untrue')`,
        );
      }),
    ).rejects.toThrow();
  });

  it('holds nothing for a minor before a guardian agrees (hard rule 5)', async () => {
    const { store } = testStore(database);
    const { studentId } = await signIn(store, syntheticPhone());
    await store.setDateOfBirth(studentId, '2010-03-03');
    await expect(
      store
        .forStudent(studentId)
        .reportCvDocument('00000000-0000-4000-8000-000000000001', 'untrue'),
    ).rejects.toThrow(ConsentRequiredError);
  });

  it('goes with the export, and is deleted with the account', async () => {
    const learner = await optedInAdult();
    const { id } = await cv(learner, 'tailored');
    await learner.student.reportCvDocument(id, 'harmful');
    const exported = await learner.student.exportAll();
    expect(exported.personal?.cv.reports).toEqual([
      expect.objectContaining({ documentId: id, reason: 'harmful' }),
    ]);
    await learner.student.deleteAccount();
    expect(await count('cv_reports', `student_id = '${learner.studentId}'`)).toBe(0);
  });
});

describe('deleting one CV (A11-38, D13)', () => {
  it('deletes the learner’s CV with its share links and report, and gives back the PDF’s key', async () => {
    const learner = await optedInAdult();
    const kept = await cv(learner, 'draft');
    const gone = await cv(learner, 'tailored');
    await learner.student.confirmCvDocument(gone.id, LIVE);
    await learner.student.createCvShare(gone.id, 30, LIVE);
    await learner.student.reportCvDocument(gone.id, 'untrue');

    expect(await learner.student.deleteCvDocument(gone.id)).toEqual({ fileKey: gone.fileKey });

    expect((await learner.student.cvDocuments()).map((d) => d.id)).toEqual([kept.id]);
    expect(await count('cv_shares', `document_id = '${gone.id}'`)).toBe(0);
    expect(await count('cv_reports', `document_id = '${gone.id}'`)).toBe(0);
    expect(await learner.student.cvFile(kept.id)).not.toBeNull();
  });

  it('deletes a CV that couldn’t be made, which has no PDF', async () => {
    const learner = await optedInAdult();
    const failed = await cv(learner, 'tailored', false);
    await learner.store.cvJobs().closeDocument(failed.id, 'render_failed');
    expect(await learner.student.deleteCvDocument(failed.id)).toEqual({ fileKey: null });
    expect(await learner.student.cvDocuments()).toEqual([]);
  });

  it('logs the deletion by fixed words only', async () => {
    const learner = await optedInAdult();
    const { id } = await cv(learner, 'draft');
    await learner.student.deleteCvDocument(id);
    const audit = rowsOf<{ action: string; reason: string | null }>(
      await database.db.execute(
        sql`select action, reason from audit_log where student_id = ${learner.studentId}::uuid and action = 'cv.deleted'`,
      ),
    );
    expect(audit).toEqual([{ action: 'cv.deleted', reason: null }]);
  });

  it('refuses a CV still being made: its job holds the id (§11)', async () => {
    const learner = await optedInAdult();
    const busy = await cv(learner, 'draft', false);
    await expect(learner.student.deleteCvDocument(busy.id)).rejects.toThrow(CvBusyError);
    expect(await count('cv_documents', `id = '${busy.id}'`)).toBe(1);
  });

  it('never deletes another learner’s CV, and a malformed id is not found', async () => {
    const owner = await optedInAdult();
    const { id } = await cv(owner, 'draft');
    const other = await optedInAdult();
    await expect(other.student.deleteCvDocument(id)).rejects.toThrow(NotFoundError);
    await expect(other.student.deleteCvDocument('not-an-id')).rejects.toThrow(NotFoundError);
    expect(await count('cv_documents', `id = '${id}'`)).toBe(1);
  });

  it('works after consent has lapsed: a learner can always take their data back', async () => {
    const learner = await optedInAdult();
    const { id, fileKey } = await cv(learner, 'draft');
    // As if the agreement were withdrawn: row-level security now hides the CV from the learner.
    await database.exec(
      `update students set consent_status = 'withdrawn' where id = '${learner.studentId}'`,
    );
    expect(await learner.student.deleteCvDocument(id)).toEqual({ fileKey });
    expect(await count('cv_documents', `id = '${id}'`)).toBe(0);
  });
});
