import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Secrets the database never stores in the clear: session tokens, consent-link tokens and
 * one-time PINs are kept as hashes, so a leaked table can't be replayed.
 */

/** A 256-bit random token, URL-safe. */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** A six-digit one-time PIN. */
export function newOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Keyed so a stolen table can't be brute-forced offline without the server secret. */
export function hashOtp(phone: string, code: string, secret: string): string {
  return createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex');
}

/**
 * A phone number as the suppression list keeps it (audit A12-04): an HMAC under the server
 * secret, keyed the same way as the rate limits (`action:key`), never the number itself (hard
 * rule 4). `phone` is E.164.
 */
export function suppressionHash(secret: string, phone: string): string {
  return createHmac('sha256', secret).update(`messaging-suppression:${phone}`).digest('hex');
}

export function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}
