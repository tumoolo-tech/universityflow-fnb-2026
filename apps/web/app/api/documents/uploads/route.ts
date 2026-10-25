import {
  MAX_UPLOAD_BYTES,
  UPLOAD_TICKET_TTL_SECONDS,
  UPLOAD_TYPES,
  type UploadType,
} from '@universityflow/documents';
import { z } from 'zod';
import { HttpError, handler, json, parseBody, QUOTAS, requireReady } from '@/lib/server/http';
import { newIncomingKey } from '@/lib/server/keys';
import { getServices } from '@/lib/server/services';

const Body = z.object({
  contentType: z.string().max(100),
  size: z.number().int().positive(),
});

/** How long after its ticket expires an upload can still be completed (a slow last request). */
const COMPLETE_GRACE_MS = 10 * 60 * 1000;

const isUploadType = (value: string): value is UploadType =>
  (UPLOAD_TYPES as ReadonlyArray<string>).includes(value);

/**
 * Starts a direct upload (open finding 3): a short-lived ticket that lets the browser post one
 * file of the declared type and size straight to storage, at a key the server chose. The same
 * sign-in, consent (hard rule 5), same-origin check and daily quota as an upload through our
 * server. Not found when storage takes uploads only through our server (local mode).
 */
export const POST = handler(async (request: Request) => {
  const { student, studentId } = await requireReady(request);
  const { store, uploads } = await getServices();
  if (!uploads) throw new HttpError(404, 'not-found');
  const { contentType, size } = await parseBody(request, Body);
  if (!isUploadType(contentType)) throw new HttpError(400, 'upload', 'unsupported-type');
  if (size > MAX_UPLOAD_BYTES) throw new HttpError(400, 'upload', 'too-large');
  if (!(await store.allow('upload', studentId, QUOTAS.upload.max, QUOTAS.upload.windowMs))) {
    throw new HttpError(429, 'rate-limited');
  }

  const storageKey = newIncomingKey();
  const ticket = await uploads.ticket(storageKey, {
    contentType,
    maxBytes: size,
    expiresInSeconds: UPLOAD_TICKET_TTL_SECONDS,
  });
  const { id } = await student.createUploadIntent({
    storageKey,
    mimeType: contentType,
    expiresAt: new Date(ticket.expiresAt.getTime() + COMPLETE_GRACE_MS),
  });
  return json({
    uploadId: id,
    url: ticket.url,
    fields: ticket.fields,
    expiresAt: ticket.expiresAt.toISOString(),
  });
});
