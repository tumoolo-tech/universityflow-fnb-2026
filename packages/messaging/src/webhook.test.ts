import { describe, expect, it } from 'vitest';
import { SIGNATURE_TOLERANCE_MS, signWebhook, verifyWebhook } from './webhook';

const SECRET = 'test-webhook-secret-that-is-long-enough';
const NOW = new Date('2026-10-13T08:00:00Z');
const BODY = JSON.stringify({ from: 'synthetic', text: 'STOP' });

describe('webhook signatures', () => {
  it('accepts a fresh signature over exactly this body', () => {
    expect(verifyWebhook(SECRET, 'sms', signWebhook(SECRET, 'sms', BODY, NOW), BODY, NOW)).toBe(
      true,
    );
    const nearlyStale = new Date(NOW.getTime() + SIGNATURE_TOLERANCE_MS);
    expect(
      verifyWebhook(SECRET, 'sms', signWebhook(SECRET, 'sms', BODY, NOW), BODY, nearlyStale),
    ).toBe(true);
  });

  it('refuses an unsigned, malformed, forged, altered or stale request', () => {
    const good = signWebhook(SECRET, 'sms', BODY, NOW);
    const verify = (header: string | null, body = BODY, now = NOW) =>
      verifyWebhook(SECRET, 'sms', header, body, now);
    expect(verify(null)).toBe(false);
    expect(verify('')).toBe(false);
    expect(verify('sha256=abc')).toBe(false);
    expect(verify(`${good}x`)).toBe(false);
    expect(verify('x'.repeat(400))).toBe(false);
    // Signed with another secret.
    expect(verify(signWebhook(`${SECRET}-other`, 'sms', BODY, NOW))).toBe(false);
    // The body changed after signing.
    expect(verify(good, BODY.replace('STOP', 'HELLO'))).toBe(false);
    // The timestamp changed after signing.
    const shifted = good.replace(/^t=(\d+)/, (_, t) => `t=${Number(t) + 1}`);
    expect(verify(shifted)).toBe(false);
    // Replayed too late, or signed too far in the future.
    expect(verify(good, BODY, new Date(NOW.getTime() + SIGNATURE_TOLERANCE_MS + 1000))).toBe(false);
    expect(verify(good, BODY, new Date(NOW.getTime() - SIGNATURE_TOLERANCE_MS - 1000))).toBe(false);
  });

  it('A5-06: binds the channel, so a request signed for SMS is refused on WhatsApp', () => {
    const forSms = signWebhook(SECRET, 'sms', BODY, NOW);
    expect(verifyWebhook(SECRET, 'whatsapp', forSms, BODY, NOW)).toBe(false);
    expect(verifyWebhook(SECRET, 'sms', forSms, BODY, NOW)).toBe(true);
    expect(forSms).not.toBe(signWebhook(SECRET, 'whatsapp', BODY, NOW));
  });

  it('never verifies with a short secret', () => {
    expect(verifyWebhook('short', 'sms', signWebhook('short', 'sms', BODY, NOW), BODY, NOW)).toBe(
      false,
    );
  });
});
