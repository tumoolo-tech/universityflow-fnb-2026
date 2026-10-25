import { MAX_LINK_LENGTH, redirectSystemPath } from '../app/+native-intent';

/**
 * A8-02: expo-router parses every incoming `universityflow://` link with query-string@7, whose
 * decode-uri-component@0.2.2 takes exponential time on a link it can't decode
 * (GHSA-vcc3-ghjq-m6fr). Anyone can send a student such a link by WhatsApp or SMS. The app's
 * native intent sends it home before the router ever parses it.
 */

/** Each case must be answered well inside this, however long or broken the link. */
const BUDGET_MS = 50;

function timed(path: string): { result: string | null; ms: number } {
  const start = Date.now();
  const result = redirectSystemPath({ path, initial: false }) as string | null;
  return { result, ms: Date.now() - start };
}

describe('incoming links (+native-intent)', () => {
  it('passes an ordinary link through untouched', () => {
    for (const path of [
      '/',
      '/results',
      '/what-i-need?programme=wits-bsc-cs',
      'universityflow://results?tab=marks%20one&x=%C3%A9',
    ]) {
      expect(redirectSystemPath({ path, initial: true })).toBe(path);
    }
  });

  it('sends a long link of malformed percent-encoding home, at once', () => {
    const crafted = `/results?q=${'%E0%A4%A'.repeat(1_000)}`;
    const { result, ms } = timed(crafted);
    expect(result).toBe('/');
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it('sends home a short link that only looks encoded: a stray % or bytes that are not UTF-8', () => {
    for (const path of ['/results?q=%', '/results?q=%zz', `/results?q=${'%C0'.repeat(30)}`]) {
      const { result, ms } = timed(path);
      expect(result).toBe('/');
      expect(ms).toBeLessThan(BUDGET_MS);
    }
  });

  it('sends home any link over the length cap, even a well-formed one', () => {
    expect(redirectSystemPath({ path: `/${'a'.repeat(MAX_LINK_LENGTH)}`, initial: false })).toBe(
      '/',
    );
    const atCap = `/${'a'.repeat(MAX_LINK_LENGTH - 1)}`;
    expect(redirectSystemPath({ path: atCap, initial: false })).toBe(atCap);
  });
});
