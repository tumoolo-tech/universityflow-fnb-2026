import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Signed inbound webhooks for the stand-ins (planning.md §11, Phase 4a): a provider tells us a
 * learner wrote (STOP, or a reply that opens WhatsApp's 24-hour window) or what became of a
 * message. Anyone can POST to a public URL, so a request counts only if it carries a valid
 * signature: an HMAC-SHA256 of the timestamp, the channel and the exact body, with a secret only
 * we and the provider hold. The timestamp bounds replay to a few minutes, and the route refuses a
 * signature it has already seen inside that window (A5-06). The channel is signed too (A5-06), so
 * a request for SMS can't be posted to WhatsApp.
 *
 * Header: `x-uf-signature: t=<unix seconds>,v1=<hex HMAC of "<t>.<channel>.<body>">`. Each live
 * provider signs its own way (Meta: X-Hub-Signature-256; most SMS gateways: their own header), and
 * its adapter brings an `InboundVerifier` (inbound.ts) held to the same contract
 * (`@universityflow/messaging/inbound-contract`): forged, unsigned, stale, altered, replayed or
 * for another channel → refused.
 */

export const SIGNATURE_HEADER = 'x-uf-signature';
export const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;
export const MIN_WEBHOOK_SECRET_LENGTH = 32;

function hmac(secret: string, timestamp: string, channel: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${channel}.${body}`).digest('hex');
}

/** The header a provider (or a test, or the dev tools) sends with `body` to `channel`. */
export function signWebhook(
  secret: string,
  channel: string,
  body: string,
  at: Date = new Date(),
): string {
  const timestamp = String(Math.floor(at.getTime() / 1000));
  return `t=${timestamp},v1=${hmac(secret, timestamp, channel, body)}`;
}

/**
 * True only for a well-formed, fresh signature over exactly this body, for this channel.
 * Constant-time compare.
 */
export function verifyWebhook(
  secret: string,
  channel: string,
  header: string | null | undefined,
  body: string,
  now: Date = new Date(),
): boolean {
  if (secret.length < MIN_WEBHOOK_SECRET_LENGTH || !header || header.length > 300) return false;
  const match = /^t=(\d{1,12}),v1=([0-9a-f]{64})$/.exec(header.trim());
  if (!match) return false;
  const [, timestamp, signature] = match as unknown as [string, string, string];
  if (Math.abs(now.getTime() - Number(timestamp) * 1000) > SIGNATURE_TOLERANCE_MS) return false;
  const expected = Buffer.from(hmac(secret, timestamp, channel, body), 'hex');
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
