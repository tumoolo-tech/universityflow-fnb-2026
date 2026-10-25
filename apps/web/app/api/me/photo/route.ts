import { PhotoConsentError } from '@universityflow/db';
import {
  isSamplePhotoId,
  MAX_PHOTO_BYTES,
  type PreparedPhoto,
  prepareProfilePhoto,
  prepareSamplePhoto,
} from '@universityflow/documents';
import { z } from 'zod';
import { HttpError, handler, json, QUOTAS, requireReady, requireSignedIn } from '@/lib/server/http';
import { newPhotoKey } from '@/lib/server/keys';
import { photoAccess, photoMode, photoVersion } from '@/lib/server/profile-photo';
import { getServices } from '@/lib/server/services';

/**
 * The learner's profile photo (docs/design/profile-look-proposal.md §5.3): shown to them alone,
 * black and white, on their About me card. Behind the server switch `UF_PROFILE_PHOTO`: off, GET
 * and POST answer 404 (DELETE still works: a learner can always take their data back). Consent
 * first (hard rule 5), and consent wording that names the photo (guardian v4, adult-v3; A11-31,
 * migration 0037), or the owner's preview standing in for it; the same CSRF rule as every write
 * (requireReady). Used for nothing else: never given to the AI, never logged, never shared.
 *
 * In a judge demo (UF_DEPLOYMENT=demo) the photo is on with no switch, but for made-up SAMPLE
 * pictures only (owner's decision, 2026-10-23): no real photo is ever received there.
 */

export const maxDuration = 30;

/**
 * The services, how a photo is chosen here, and what stands in for the consent wording (A11-31):
 * 404 when no photo is offered.
 */
async function switchedOn() {
  const services = await getServices();
  const mode = photoMode(services.config);
  if (!mode) throw new HttpError(404, 'not-found');
  return { ...services, mode, access: photoAccess(services.config) };
}

/**
 * A demo's whole form (`crop` and `sample`) is a few hundred bytes. Anything larger is a file, so
 * it is refused before the body is read: a real photo is never even received.
 */
const DEMO_FORM_BYTES = 4 * 1024;

/** The demo's refusal of anything but a sample (owner's decision, 2026-10-23). */
const demoSampleOnly = () => new HttpError(400, 'upload', 'demo-sample-photo-only');

/** The photo, to its owner only: never cached by anything between, never embedded elsewhere. */
export const GET = handler(async (request: Request) => {
  const { files, access } = await switchedOn();
  const { student } = await requireReady(request);
  // Null under consent wording that doesn't name the photo (A11-31): never served then.
  const key = await student.photoKey(access);
  const file = key ? await files.get(key) : null;
  if (!file) throw new HttpError(404, 'not-found');
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      'content-type': 'image/jpeg',
      'content-disposition': 'inline',
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'cross-origin-resource-policy': 'same-origin',
    },
  });
});

/** The square the learner chose (packages/ui photo-crop.ts), in fractions of the photo. */
const Crop = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  size: z.number().gt(0).max(1),
});

function readCrop(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') throw new HttpError(400, 'invalid');
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new HttpError(400, 'invalid');
  }
  const crop = Crop.safeParse(parsed);
  if (!crop.success) throw new HttpError(400, 'invalid');
  return crop.data;
}

/**
 * A new photo (multipart: `crop`, then `file`), as chosen: the server crops it, makes it 512 × 512
 * black and white and drops its metadata (packages/documents profile-photo.ts). The old one, if
 * any, is deleted once the new one is kept.
 *
 * In a judge demo: `crop` and `sample` (a SAMPLE picture's id) only, and any file is refused
 * (`demo-sample-photo-only`). The sample goes through the same pipeline and is stored the same
 * way, so it is deleted with the judge's copy like any photo. With `UF_DEMO_REAL_PHOTOS=1` (a
 * hackathon exception, demo only), the visitor may send their own `file` instead, with the same
 * limits and pipeline as anywhere; it is kept in their demo copy and deleted with it.
 */
export const POST = handler(async (request: Request) => {
  const { files, store, mode, access, config } = await switchedOn();
  const samplesOnly = mode === 'samples' && !config.demoRealPhotos;
  const { student, studentId } = await requireReady(request);
  // Consent wording that names the photo first (A11-31): refused before a byte is read or kept.
  if (!(await student.photoAllowed(access))) throw new PhotoConsentError();
  // The size before the body is read (audit 2026-10-13, finding 6): 2 MB and the form around it.
  const length = Number(request.headers.get('content-length'));
  if (!Number.isFinite(length) || length <= 0) throw new HttpError(411, 'invalid');
  if (samplesOnly && length > DEMO_FORM_BYTES) throw demoSampleOnly();
  if (length > MAX_PHOTO_BYTES + 16 * 1024) throw new HttpError(400, 'upload', 'too-large');
  if (!(await store.allow('photo', studentId, QUOTAS.photo.max, QUOTAS.photo.windowMs))) {
    throw new HttpError(429, 'rate-limited');
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new HttpError(400, 'invalid');
  }
  if (samplesOnly && form.has('file')) throw demoSampleOnly();
  // One or the other: a sample, or the visitor's own file (UF_DEMO_REAL_PHOTOS).
  if (form.has('file') && form.has('sample')) throw new HttpError(400, 'invalid');
  const crop = readCrop(form.get('crop'));
  let prepared: PreparedPhoto;
  if (mode === 'samples' && !form.has('file')) {
    const sample = form.get('sample');
    if (!isSamplePhotoId(sample)) throw new HttpError(400, 'invalid');
    prepared = await prepareSamplePhoto(sample, crop);
  } else {
    const file = form.get('file');
    if (!(file instanceof Blob)) throw new HttpError(400, 'invalid');
    prepared = await prepareProfilePhoto(new Uint8Array(await file.arrayBuffer()), crop);
  }

  const key = newPhotoKey();
  await files.put(key, prepared);
  let replaced: string | null;
  try {
    replaced = await student.setPhoto(key, access);
  } catch (error) {
    await files.delete(key);
    throw error;
  }
  if (replaced) await files.delete(replaced);
  return json({ photo: { version: photoVersion(key) } });
});

/**
 * "Remove photo": the record and the file, in one call. For any signed-in learner, with or without
 * consent (A11-32): one whose consent was withdrawn or lapsed at 18 can always take their photo
 * back. The same CSRF rule as every write (requireSignedIn).
 */
export const DELETE = handler(async (request: Request) => {
  const { student } = await requireSignedIn(request);
  const key = await student.removePhoto();
  if (key) await (await getServices()).files.delete(key);
  return json({ photo: null });
});
