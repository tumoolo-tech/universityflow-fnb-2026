import { createHash } from 'node:crypto';
import { isWhatsAppCategory, type WhatsAppCategory } from '@universityflow/content';
import { SA_MOBILE } from './channel';
import {
  MIN_WEBHOOK_SECRET_LENGTH,
  SIGNATURE_HEADER,
  SIGNATURE_TOLERANCE_MS,
  verifyWebhook,
} from './webhook';

/**
 * The inbound half of a channel (A5-02): how a provider's webhook is checked and read. Every
 * channel a learner can be told "Reply STOP" on has one (SMS and WhatsApp), in local mode and in
 * live mode alike; a live adapter that can send but not receive never starts (readConfig in
 * apps/web). Push has none: it is turned off in the app or the phone's settings, never by reply.
 *
 * A verifier belongs to one channel. It decides whether a request really came from the provider,
 * for this channel, recently; the route then refuses a request it has already seen (by the
 * verifier's replay key) and reads it with `parse`, which maps the provider's shape to ours.
 * Every verifier passes the contract in `@universityflow/messaging/inbound-contract`: forged,
 * unsigned, stale, altered or for another channel → refused; the same request → the same replay
 * key; STOP and delivery reports → the shapes below.
 */

/** The channels a learner can write back on. */
export const INBOUND_CHANNELS = ['sms', 'whatsapp'] as const;
export type InboundChannel = (typeof INBOUND_CHANNELS)[number];

/** The longest message body we read. */
export const MAX_INBOUND_TEXT = 4096;

/** What a provider tells us: a learner wrote, or what became of a message. */
export type InboundEvent =
  | { readonly type: 'message'; readonly from: string; readonly text: string }
  | {
      readonly type: 'status';
      readonly receiptId: string;
      readonly status: 'delivered' | 'failed';
      /**
       * The category the provider billed the message as, when it says (Meta's status reports
       * carry `pricing.category`): `marketing` when Meta recategorised a template (A12-09).
       */
      readonly category?: WhatsAppCategory;
    };

/** A webhook as it arrived: nothing is read from it until it verifies. */
export interface InboundRequest {
  readonly url: string;
  readonly headers: { get(name: string): string | null };
  /** The raw body, exactly as received: signatures cover bytes, not parsed JSON. */
  readonly body: string;
}

export interface VerifiedInbound {
  /**
   * Identifies this request among every other the provider sends: the same request (a replay)
   * gives the same key, two different messages different keys. Not personal (hard rule 4): a
   * signature or the provider's message id, never a number or words.
   */
  readonly replayKey: string;
}

export interface InboundVerifier {
  readonly channel: InboundChannel;
  /**
   * How long a verified request stays accepted, end to end: a request verifies for at most this
   * long, so remembering its replay key for this long refuses every replay (A5-06).
   */
  readonly replayWindowMs: number;
  /** Null for anything the provider didn't send, for this channel, just now. Never throws. */
  verify(request: InboundRequest, now: Date): VerifiedInbound | null;
  /** The event in a verified body. Throws `InvalidInboundError` for anything else. */
  parse(body: string): InboundEvent;
}

/** A verified body we can't read. Never carries the body or a number (hard rule 4). */
export class InvalidInboundError extends Error {
  override readonly name = 'InvalidInboundError';
  constructor() {
    super('The inbound webhook body is not a message or a delivery report');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnly(value: Record<string, unknown>, keys: ReadonlyArray<string>): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

/**
 * The event, checked: an SA mobile number and text of at most `MAX_INBOUND_TEXT`, or a receipt
 * id and a known status (with, optionally, the billed category, A12-09), and nothing else. The route runs every adapter's `parse` result through
 * this too, so no adapter can hand it more than these fields.
 */
export function checkInboundEvent(value: unknown): InboundEvent {
  if (!isRecord(value)) throw new InvalidInboundError();
  if (value['type'] === 'message') {
    const { from, text } = value;
    if (
      hasOnly(value, ['type', 'from', 'text']) &&
      typeof from === 'string' &&
      SA_MOBILE.test(from) &&
      typeof text === 'string' &&
      text.length <= MAX_INBOUND_TEXT
    ) {
      return { type: 'message', from, text };
    }
  } else if (value['type'] === 'status') {
    const { receiptId, status, category } = value;
    if (
      hasOnly(value, ['type', 'receiptId', 'status', 'category']) &&
      typeof receiptId === 'string' &&
      receiptId.length >= 1 &&
      receiptId.length <= 200 &&
      (status === 'delivered' || status === 'failed') &&
      (category === undefined || isWhatsAppCategory(category))
    ) {
      return { type: 'status', receiptId, status, ...(category ? { category } : {}) };
    }
  }
  throw new InvalidInboundError();
}

/**
 * The stand-ins' inbound webhooks (local mode, and the dev tools): JSON, signed with
 * `signWebhook` (webhook.ts) for this channel. The body is the event, plus an optional `id`, the
 * provider's message id, as every real provider sends one: two identical messages sent in the same
 * second differ by it, so neither is taken for a replay of the other.
 */
export function signedWebhookInbound(secret: string, channel: InboundChannel): InboundVerifier {
  if (secret.length < MIN_WEBHOOK_SECRET_LENGTH) {
    throw new Error(`The webhook secret must be at least ${MIN_WEBHOOK_SECRET_LENGTH} characters`);
  }
  return {
    channel,
    // Accepted from `tolerance` before its timestamp to `tolerance` after.
    replayWindowMs: 2 * SIGNATURE_TOLERANCE_MS,
    verify(request, now) {
      const header = request.headers.get(SIGNATURE_HEADER);
      if (!verifyWebhook(secret, channel, header, request.body, now)) return null;
      // The signature covers the timestamp, the channel and the body: it is the request.
      return {
        replayKey: createHash('sha256')
          .update(header ?? '')
          .digest('hex'),
      };
    },
    parse(body) {
      let value: unknown;
      try {
        value = JSON.parse(body);
      } catch {
        throw new InvalidInboundError();
      }
      if (!isRecord(value)) throw new InvalidInboundError();
      const { id, ...event } = value;
      if (id !== undefined && (typeof id !== 'string' || !/^[\w.:-]{1,100}$/.test(id))) {
        throw new InvalidInboundError();
      }
      return checkInboundEvent(event);
    },
  };
}
