import 'server-only';
import { createHash } from 'node:crypto';
import type { PhotoAccess, StudentStore } from '@universityflow/db';
import { type FileStore, SAMPLE_PHOTO_IDS, type SamplePhotoId } from '@universityflow/documents';

/**
 * The profile photo's server side (docs/design/profile-look-proposal.md §5.3;
 * docs/deploy/profile-photo.md). Behind the switch `UF_PROFILE_PHOTO` (config.ts), and in the data
 * layer behind consent wording that names it (A11-31, migration 0037: guardian v4, adult-v3). The
 * storage key never leaves the server: the web and the app are told only a `version`, a hash of
 * it, so a replaced photo is fetched anew.
 *
 * Used for nothing else (the owner's condition, 2026-10-23): shown to its learner alone, never to
 * the AI, a CV, a job, a log or a share page. apps/web/test/photo-used-for-nothing-else.test.ts
 * fails if code outside this file, /api/me/photo, /api/me, the About me page and the export reads it.
 */

/** A short tag that changes with the photo, from its key; the key itself stays here. */
export function photoVersion(key: string): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

/**
 * How a photo is chosen here, or null for no photo: `upload` behind `UF_PROFILE_PHOTO`, or
 * `samples` in every judge demo (owner's decision, 2026-10-23): made-up SAMPLE pictures only,
 * never a real photo. A demo refuses `UF_PROFILE_PHOTO` (config.ts), so the two never meet.
 */
export function photoMode(config: {
  readonly demo: boolean;
  readonly profilePhoto: boolean;
}): 'upload' | 'samples' | null {
  if (config.demo) return 'samples';
  return config.profilePhoto ? 'upload' : null;
}

/**
 * Whether something stands in for the wording that names the photo (migration 0037): the owner's
 * preview while the live wording is older, or the judge demo, whose copies are synthetic learners
 * and whose pictures are drawn SAMPLES (the route refuses any real photo there before reading it,
 * unless the demo-only hackathon switch UF_DEMO_REAL_PHOTOS lets a visitor add their own, kept in
 * their copy and deleted with it). Otherwise the learner's own recorded consent decides.
 */
export function photoAccess(config: {
  readonly demo: boolean;
  readonly profilePhotoPreview: boolean;
}): PhotoAccess {
  return { preview: config.demo || config.profilePhotoPreview };
}

export interface PhotoState {
  /** The current photo's version, or null for none. */
  readonly version: string | null;
  /** In a demo: the sample pictures to choose from (and no file input, unless `realUploads`). */
  readonly samples?: ReadonlyArray<SamplePhotoId>;
  /**
   * In a demo with `UF_DEMO_REAL_PHOTOS=1` (a hackathon exception): the visitor may also upload
   * their own photo, deleted with their `copy` (24 hours) or their sign-up `account` (30 days).
   */
  readonly realUploads?: DemoRealUploads;
}

/** How long a demo visitor's own photo is kept: with the 24-hour copy, or the 30-day sign-up account. */
export type DemoRealUploads = 'copy' | 'account';

/**
 * Whether this demo visitor may upload their own photo (`UF_DEMO_REAL_PHOTOS`, a hackathon
 * exception), and so which line they are shown: null outside a demo or with the switch off.
 */
export async function demoRealUploads(
  config: { readonly demo: boolean; readonly demoRealPhotos: boolean },
  store: { isDemoSignup(studentId: string): Promise<boolean> },
  studentId: string,
): Promise<DemoRealUploads | null> {
  if (!config.demo || !config.demoRealPhotos) return null;
  return (await store.isDemoSignup(studentId)) ? 'account' : 'copy';
}

/**
 * What GET /api/me says about the photo: null when no photo is offered (the switch is off, the
 * learner's data can't be processed yet, or their consent doesn't name the photo), otherwise the
 * current version or null for none, and in a demo the samples.
 */
export async function photoState(
  mode: 'upload' | 'samples' | null,
  ready: boolean,
  student: StudentStore,
  access: PhotoAccess,
  realUploads: DemoRealUploads | null = null,
): Promise<PhotoState | null> {
  if (!mode || !ready) return null;
  if (!(await student.photoAllowed(access))) return null;
  const key = await student.photoKey(access);
  const version = key ? photoVersion(key) : null;
  if (mode !== 'samples') return { version };
  return realUploads
    ? { version, samples: [...SAMPLE_PHOTO_IDS], realUploads }
    : { version, samples: [...SAMPLE_PHOTO_IDS] };
}

/**
 * The photo for the learner's own export (planning.md §8.1, POPIA s23): the image itself, never
 * its key. Whatever is held, also a photo kept under older wording that is no longer shown.
 */
export async function exportedPhoto(
  student: StudentStore,
  files: FileStore,
): Promise<{ mimeType: string; base64: string } | null> {
  const key = await student.heldPhotoKey();
  if (!key) return null;
  const file = await files.get(key);
  return file
    ? { mimeType: file.mimeType, base64: Buffer.from(file.bytes).toString('base64') }
    : null;
}
