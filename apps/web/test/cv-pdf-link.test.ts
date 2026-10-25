import { createHmac, hkdfSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CV_PDF_LINK_SECONDS, signedPdfLink, verifyPdfLink } from '../lib/server/cv';

/**
 * CV-A5 A5-22: the 60-second PDF links are signed with a key of their own, derived from
 * AUTH_SECRET by HKDF with a `cv-pdf` label, so the session secret's own HMACs and these never
 * share a key. A link signed the old way (HMAC keyed by AUTH_SECRET itself) is refused; such a
 * link lived 60 seconds, so none is left to break.
 */

const SECRET = 'cv-pdf-link-test-auth-secret-of-at-least-32-chars';
const ID = '3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b';
const NOW = new Date('2026-10-24T10:00:00Z');

function linkParts(url: string) {
  const parsed = new URL(url);
  return { exp: parsed.searchParams.get('exp'), sig: parsed.searchParams.get('sig') };
}

describe('signed PDF links (A5-22)', () => {
  it('signs with a key derived from AUTH_SECRET, never AUTH_SECRET itself', () => {
    const { exp, sig } = linkParts(signedPdfLink('https://example.org', SECRET, ID, NOW).url);
    const message = `cv-pdf:${ID}:${exp}`;
    const direct = createHmac('sha256', SECRET).update(message).digest('hex');
    expect(sig).not.toBe(direct);
    const key = Buffer.from(hkdfSync('sha256', SECRET, '', 'universityflow:cv-pdf-link:v1', 32));
    expect(sig).toBe(createHmac('sha256', key).update(message).digest('hex'));
    expect(verifyPdfLink(SECRET, ID, exp, sig, NOW)).toBe(true);
  });

  it('refuses a link signed with AUTH_SECRET directly (the old scheme)', () => {
    const exp = String(Math.floor(NOW.getTime() / 1000) + CV_PDF_LINK_SECONDS);
    const old = createHmac('sha256', SECRET).update(`cv-pdf:${ID}:${exp}`).digest('hex');
    expect(verifyPdfLink(SECRET, ID, exp, old, NOW)).toBe(false);
  });

  it('a link signed under one secret fails under another', () => {
    const { exp, sig } = linkParts(signedPdfLink('https://example.org', SECRET, ID, NOW).url);
    expect(verifyPdfLink(`${SECRET}-rotated`, ID, exp, sig, NOW)).toBe(false);
  });
});
