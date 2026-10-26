import {
  type ConfirmedModuleOutline,
  confirmedModuleOutlineSchema,
} from '@universityflow/documents';
import { and, asc, eq, sql } from 'drizzle-orm';
import { type Db, rowsOf } from './client';
import {
  ConsentOutdatedError,
  InvalidStateError,
  NotFoundError,
  PersonalNumberError,
} from './errors';
import { documents, moduleOutlines, type StoredModuleOutline } from './schema';

/**
 * Confirmed module outlines (Phase 6b, migration 0040; docs/plans/phase-6-proposal.md). The
 * learner confirms an outline section by section (components, dates, books, people; "not in my
 * outline" for any) before anything uses it (hard rule 6). `StudentStore` runs each of these in the
 * learner's own transaction (row-level security and the consent gate, hard rule 5), so another
 * learner's outline is simply not there.
 *
 * An outline read from a document needs the consent wording that names module outlines (guardian
 * v4, adult-v3: D9, not live yet); one typed by hand needs only consent. The document's file goes
 * once the outline is confirmed (D10): its row is deleted here and its key handed back for the
 * caller to delete from storage. Audit rows carry fixed words and ids only (hard rule 4).
 */

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** The guardian consent wording that first names module outlines (v4, D9). Not live yet. */
export const MODULE_OUTLINES_CONSENT_VERSION = 4;
/** The adult agreement that first names them (adult-v3). Not live yet. */
export const MODULE_OUTLINES_ADULT_CONSENT_VERSION = 3;

/** The document kind of an uploaded module outline (packages/documents `documentType`). */
export const MODULE_OUTLINE_KIND = 'module-outline';

export interface ModuleOutlineRecord {
  readonly id: string;
  /** Upper-cased, as confirmed. */
  readonly moduleCode: string;
  readonly academicYear: number;
  readonly outline: StoredModuleOutline;
  /** Whether it was read from an uploaded outline (whose file is gone, D10) or typed in. */
  readonly fromDocument: boolean;
  readonly confirmedAt: Date;
  readonly updatedAt: Date;
}

export interface OutlineContext {
  readonly tx: Tx;
  readonly studentId: string;
  readonly now: Date;
  readonly audit: (action: string, reason?: string) => Promise<void>;
}

/** Whether this learner's consent names module outlines now (asked as the learner, about themselves). */
export async function outlinesCovered(tx: Tx, studentId: string): Promise<boolean> {
  const [row] = rowsOf<{ ok: boolean }>(
    await tx.execute(sql`select uf_may_process_module_outlines(${studentId}::uuid) as ok`),
  );
  return row?.ok === true;
}

/** Refuses with a reason the app can explain, before the database refuses without one. */
export async function assertOutlinesCovered(tx: Tx, studentId: string): Promise<void> {
  if (!(await outlinesCovered(tx, studentId))) throw new ConsentOutdatedError('module-outlines');
}

/**
 * The confirmed outline, checked again here whatever the route did. A text holding an ID or
 * student number is a `PersonalNumberError` (A11-17's reason); anything else not confirmed as the
 * schema says (weights that don't add up, a mobile number, an unknown field) is refused, never
 * repaired.
 */
export function checkModuleOutline(input: ConfirmedModuleOutline): ConfirmedModuleOutline {
  const parsed = confirmedModuleOutlineSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  if (parsed.error.issues.some((i) => i.message === 'personal-number')) {
    throw new PersonalNumberError();
  }
  throw new InvalidStateError('Not a confirmed module outline');
}

const record = (row: typeof moduleOutlines.$inferSelect): ModuleOutlineRecord => ({
  id: row.id,
  moduleCode: row.moduleCode,
  academicYear: row.academicYear,
  outline: row.outline,
  fromDocument: row.fromDocument,
  confirmedAt: row.confirmedAt,
  updatedAt: row.updatedAt,
});

/** The learner's outlines, by year and module. */
export async function readModuleOutlines(tx: Tx): Promise<ModuleOutlineRecord[]> {
  const rows = await tx
    .select()
    .from(moduleOutlines)
    .orderBy(asc(moduleOutlines.academicYear), asc(moduleOutlines.moduleCode));
  return rows.map(record);
}

/** What a save hands back: the outline's id and, when it was read from a document, its file. */
export interface SavedModuleOutline {
  readonly id: string;
  /** The storage key of the document's file, for the caller to delete now. */
  readonly fileKey: string | null;
  /**
   * The id under which that file is queued for deletion (migration 0042, A1-88): the caller
   * forgets it once the file is gone, or schedules the `file.delete` job with it (file-deletions.ts).
   */
  readonly fileDeletionId: string | null;
}

/**
 * Records an outline the learner confirmed: one per module and year, so confirming again replaces
 * it. Read from a document, the document must be one of theirs and an outline, and their consent
 * must name outlines; the document is then deleted (D10) and its file queued for deletion, in the
 * same transaction (A1-88), with its storage key returned.
 */
export async function saveModuleOutline(
  ctx: OutlineContext,
  input: ConfirmedModuleOutline,
): Promise<SavedModuleOutline> {
  const { moduleCode, academicYear, documentId, ...outline } = checkModuleOutline(input);
  const { tx, now } = ctx;
  let fileKey: string | null = null;
  if (documentId) {
    await assertOutlinesCovered(tx, ctx.studentId);
    const [document] = await tx
      .select({ kind: documents.kind, storageKey: documents.storageKey })
      .from(documents)
      .where(eq(documents.id, documentId));
    if (!document) throw new NotFoundError('No such document');
    if (document.kind !== MODULE_OUTLINE_KIND) {
      throw new InvalidStateError('That document is not a module outline');
    }
    fileKey = document.storageKey;
  }
  const values = { outline, fromDocument: documentId != null, confirmedAt: now, updatedAt: now };
  const [existing] = await tx
    .select({ id: moduleOutlines.id })
    .from(moduleOutlines)
    .where(
      and(eq(moduleOutlines.academicYear, academicYear), eq(moduleOutlines.moduleCode, moduleCode)),
    );
  let id: string;
  if (existing) {
    await tx.update(moduleOutlines).set(values).where(eq(moduleOutlines.id, existing.id));
    id = existing.id;
  } else {
    const [row] = await tx
      .insert(moduleOutlines)
      .values({ studentId: ctx.studentId, moduleCode, academicYear, ...values })
      .returning({ id: moduleOutlines.id });
    if (!row) throw new Error('Could not save the module outline');
    id = row.id;
  }
  // D10: the outline's file goes once it is confirmed; the confirmed fields stay. The document's
  // row goes and its file is queued (0042), so a failed storage delete is retried, never lost.
  let fileDeletionId: string | null = null;
  if (documentId) {
    const [queued] = rowsOf<{ id: string }>(
      await tx.execute(sql`select uf_queue_outline_file_deletion(${documentId}::uuid) as id`),
    );
    fileDeletionId = queued?.id ?? null;
  }
  await ctx.audit('module-outline.confirmed', documentId ? 'outline' : 'learner');
  return { id, fileKey, fileDeletionId };
}

/** D10: deletes every learner's outlines past the academic year plus one. The owner's, for the sweep. */
export async function deleteExpiredModuleOutlines(db: Db, today: string): Promise<number> {
  const [row] = rowsOf<{ n: number }>(
    await db.execute(sql`select uf_delete_expired_module_outlines(${today}::date) as n`),
  );
  return Number(row?.n ?? 0);
}

/** The storage key queued under `id` (migration 0042), or null once it is forgotten. The owner's. */
export async function queuedFileDeletion(db: Db, id: string): Promise<string | null> {
  const [row] = rowsOf<{ key: string }>(
    await db.execute(sql`select storage_key as key from file_deletions where id = ${id}::uuid`),
  );
  return row?.key ?? null;
}

/** Forgets a queued file once storage has deleted it. The owner's. */
export async function forgetFileDeletion(db: Db, id: string): Promise<void> {
  await db.execute(sql`delete from file_deletions where id = ${id}::uuid`);
}

/**
 * The ids of the files still queued, oldest first, at most `limit` (A11-61: a judge demo has no
 * job runner, so its scheduled sweep reads the queue itself and deletes each as the job would).
 * Ids only: a queue row's id names a storage key and nothing else. The owner's.
 */
export async function listQueuedFileDeletions(db: Db, limit: number): Promise<string[]> {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('A queue page is at least one row');
  return rowsOf<{ id: string }>(
    await db.execute(
      sql`select id from file_deletions order by created_at asc, id asc limit ${limit}`,
    ),
  ).map((row) => row.id);
}

export async function deleteModuleOutline(ctx: OutlineContext, id: string): Promise<void> {
  const [row] = await ctx.tx
    .delete(moduleOutlines)
    .where(eq(moduleOutlines.id, id))
    .returning({ id: moduleOutlines.id });
  if (!row) throw new NotFoundError('No such module outline');
  await ctx.audit('module-outline.deleted');
}
