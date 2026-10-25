import { sql } from 'drizzle-orm';
import { type Db, rowsOf } from './client';

/**
 * The profile photo's consent rule (A11-31, migration 0037; docs/legal/consent-v4-draft.md, C5).
 * A learner's photo is kept and served only while the consent that covers them names it: their
 * guardian's at `PHOTO_CONSENT_VERSION` or later for a minor, their own agreement at
 * `PHOTO_ADULT_CONSENT_VERSION` or later for an adult. Neither is live yet (owed legal review). The
 * owner's preview (`PhotoAccess.preview`: UF_PROFILE_PHOTO=1 while the live wording is older, or
 * the judge demo's SAMPLE pictures) stands in for the wording only, for one transaction
 * (`uf.profile_photo`); never for consent itself (hard rule 5). Removing is always allowed (A11-32).
 *
 * The photo is used for nothing else (the owner's condition, 2026-10-23): only the store's photo
 * methods read its key, and apps/web/test/photo-used-for-nothing-else.test.ts fails if any other
 * code starts to.
 */

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** The guardian consent wording that first names the profile photo (v4). Not live yet. */
export const PHOTO_CONSENT_VERSION = 4;
/** The adult agreement that first names it (adult-v3). Not live yet. */
export const PHOTO_ADULT_CONSENT_VERSION = 3;

/** Whether the owner's preview stands in for the wording (see above). */
export interface PhotoAccess {
  readonly preview: boolean;
}

/** No preview: the wording on record decides. */
export const PHOTO_LIVE: PhotoAccess = { preview: false };

/** Sets the preview's stand-in for this transaction only, when the caller has it. */
export async function photoPreview(tx: Tx, access: PhotoAccess): Promise<void> {
  if (access.preview) await tx.execute(sql`select set_config('uf.profile_photo', 'preview', true)`);
}

/** Whether this learner's consent names the photo now (asked as the learner, about themselves). */
export async function photoCovered(tx: Tx, studentId: string): Promise<boolean> {
  const [row] = rowsOf<{ ok: boolean }>(
    await tx.execute(sql`select uf_may_photo(${studentId}::uuid) as ok`),
  );
  return row?.ok === true;
}

/** The photo's key when the consent names it; null when there is none or it may not be served. */
export async function servablePhotoKey(tx: Tx, studentId: string): Promise<string | null> {
  const [row] = rowsOf<{ key: string | null }>(
    await tx.execute(
      sql`select case when uf_may_photo(${studentId}::uuid) then photo_key end as key
          from profiles where student_id = ${studentId}::uuid`,
    ),
  );
  return row?.key ?? null;
}
