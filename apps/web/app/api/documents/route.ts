import { checkUpload, isGeneratedSamplePdf, MAX_UPLOAD_BYTES } from '@universityflow/documents';
import { readableKind, readersOf, recordAndRead } from '@/lib/server/documents';
import { HttpError, handler, json, QUOTAS, requireReady } from '@/lib/server/http';
import { newStorageKey } from '@/lib/server/keys';
import { getServices } from '@/lib/server/services';

export const maxDuration = 60;

/** The learner's documents, newest first, without storage keys. */
export const GET = handler(async (request: Request) => {
  const { student } = await requireReady(request);
  const documents = await student.documents();
  return json({
    documents: documents.map(({ storageKey: _key, extraction: _e, ...d }) => d),
  });
});

/**
 * Uploads a report (or, with `kind=acceptance-letter`, an offer letter; with
 * `kind=proof-of-registration`, a proof of registration; with `kind=module-outline`, a module
 * outline) through our own server and
 * reads it into a draft. Used locally; with S3
 * connected, the browser uploads straight to storage instead (./uploads), because Vercel caps
 * request bodies at 4.5 MB.
 */
export const POST = handler(async (request: Request) => {
  const { student, studentId } = await requireReady(request);
  // The size is checked before the body is read: a request without a length could otherwise
  // make the server buffer any amount (audit 2026-10-13, finding 6).
  const length = Number(request.headers.get('content-length'));
  if (!Number.isFinite(length) || length <= 0) throw new HttpError(411, 'invalid');
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) throw new HttpError(400, 'upload', 'too-large');
  const { store } = await getServices();
  if (!(await store.allow('upload', studentId, QUOTAS.upload.max, QUOTAS.upload.windowMs))) {
    throw new HttpError(429, 'rate-limited');
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof Blob)) throw new HttpError(400, 'invalid');
  const kind = readableKind(form.get('kind'));
  const bytes = new Uint8Array(await file.arrayBuffer());
  const services = await getServices();
  const { files, catalogue, config } = services;
  // Judge demo mode takes only the results generator's SAMPLE statements, as reports, and its
  // SAMPLE module outlines (Phase 6b): never a real document or photo, refused before anything is
  // stored or read (docs/deploy/demo.md).
  const demoKinds: ReadonlyArray<string> = ['grade-11-report', 'module-outline'];
  if (config.demo && (!demoKinds.includes(kind) || !isGeneratedSamplePdf(bytes))) {
    throw new HttpError(400, 'upload', 'demo-sample-only');
  }
  const mimeType = checkUpload(bytes);

  const storageKey = newStorageKey();
  await files.put(storageKey, { bytes, mimeType });
  return recordAndRead(
    student,
    readersOf(services),
    { storageKey, mimeType, bytes },
    kind,
    catalogue,
    files,
  );
});
