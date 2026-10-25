import { createHash } from 'node:crypto';
import {
  MIN_WEBHOOK_SECRET_LENGTH,
  SIGNATURE_TOLERANCE_MS,
  signWebhook,
  verifyWebhook,
} from '@universityflow/messaging';
import { z } from 'zod';
import {
  type CvWebhookEvent,
  ENGINE_ID,
  type VerifiedCvWebhook,
  WEBHOOK_TYPES,
  type WebhookHeaders,
} from './engine';

/**
 * Mmereko's webhooks to UniversityFlow (docs/design/mmereko-api-proposal.md §4.1, §12 item 6),
 * signed the way our own stand-ins sign theirs (packages/messaging webhook.ts): an HMAC-SHA256 of
 * `<t>.mmereko.<body>` with a shared secret of at least 32 characters, in
 * `x-mmereko-signature: t=<unix seconds>,v1=<hex>`. The channel `mmereko` is signed in, so a
 * request signed for SMS or WhatsApp is refused here, and the same five-minute tolerance bounds
 * replay; the route also refuses a signature it has already seen inside that window (A5-06).
 *
 * Two secrets may be live during a rotation (§4.1): a signature from either is accepted.
 */

export const MMEREKO_CHANNEL = 'mmereko';
export const MMEREKO_SIGNATURE_HEADER = 'x-mmereko-signature';
/** A request verifies from `tolerance` before its timestamp to `tolerance` after. */
export const CV_WEBHOOK_REPLAY_WINDOW_MS = 2 * SIGNATURE_TOLERANCE_MS;
/** The longest webhook body read. Events carry ids only. */
export const MAX_CV_WEBHOOK_BYTES = 4 * 1024;

/** The header Mmereko (or the fake, or a test) sends with `body`. */
export function signCvWebhook(secret: string, body: string, at: Date = new Date()): string {
  return signWebhook(secret, MMEREKO_CHANNEL, body, at);
}

/** The event's own id and type, also in headers (they repeat the body's). */
export const MMEREKO_EVENT_ID_HEADER = 'x-mmereko-event-id';
export const MMEREKO_EVENT_TYPE_HEADER = 'x-mmereko-event-type';

const id = z.string().regex(ENGINE_ID);
/**
 * Mmereko's event body (contract README, "Webhooks"): compact JSON, keys sorted,
 * `{createdAt, data: {jobId, kind, learnerRef, status[, problemCode, retryable]} |
 * {deletionId, learnerRef, status}, id, type}`. Unknown fields are ignored.
 */
const eventSchema = z.object({
  id,
  type: z.enum(WEBHOOK_TYPES),
  createdAt: z.string().max(40),
  data: z.object({
    jobId: id.optional(),
    deletionId: id.optional(),
    learnerRef: z.string().max(64).optional(),
    status: z.string().max(40).optional(),
  }),
});

/** The event in a verified body, ids and states only (unknown fields are dropped), or null. */
export function parseCvWebhookEvent(body: string): CvWebhookEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return null;
  }
  const parsed = eventSchema.safeParse(value);
  if (!parsed.success) return null;
  const { id: eventId, type, createdAt, data } = parsed.data;
  const event: CvWebhookEvent = {
    id: eventId,
    type,
    createdAt,
    jobId: data.jobId ?? null,
    deletionId: data.deletionId ?? null,
    learnerRef: data.learnerRef ?? null,
    status: data.status ?? null,
  };
  if (type === 'learner.deleted' ? !event.deletionId : !event.jobId) return null;
  return event;
}

/** An event body as Mmereko writes it: compact JSON with its keys sorted, at every depth. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * A webhook, if it is a fresh, untampered request signed for `mmereko` with one of `secrets`;
 * otherwise null. Never throws.
 */
export function verifyCvWebhook(
  secrets: ReadonlyArray<string>,
  headers: WebhookHeaders,
  body: string,
  now: Date,
): VerifiedCvWebhook | null {
  try {
    if (Buffer.byteLength(body) > MAX_CV_WEBHOOK_BYTES) return null;
    const header = headers.get(MMEREKO_SIGNATURE_HEADER);
    const usable = secrets.filter((s) => s.length >= MIN_WEBHOOK_SECRET_LENGTH);
    if (!usable.some((secret) => verifyWebhook(secret, MMEREKO_CHANNEL, header, body, now))) {
      return null;
    }
    const event = parseCvWebhookEvent(body);
    if (!event) return null;
    return {
      event,
      replayKey: createHash('sha256')
        .update(header ?? '')
        .digest('hex'),
      replayWindowMs: CV_WEBHOOK_REPLAY_WINDOW_MS,
    };
  } catch {
    return null;
  }
}
