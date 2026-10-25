import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { config } from '../proxy';

/**
 * A4-09: every first visit asked for /favicon.ico and got a 404 (a wasted round trip and the one
 * console error between Best Practices and 100). Next serves `app/favicon.ico` at /favicon.ico and
 * `app/icon.png` at /icon.png, and links both from every page. The E2E run fetches them too.
 */

const app = (name: string) => fileURLToPath(new URL(`../app/${name}`, import.meta.url));

describe('the site icon (A4-09)', () => {
  it('has a favicon.ico Next serves at /favicon.ico: an icon file holding a PNG', () => {
    expect(existsSync(app('favicon.ico'))).toBe(true);
    const ico = readFileSync(app('favicon.ico'));
    // ICONDIR: reserved 0, type 1 (icon), at least one image.
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBeGreaterThan(0);
    const offset = ico.readUInt32LE(18);
    expect(ico.subarray(offset, offset + 8).toString('hex')).toBe('89504e470d0a1a0a');
    // A PNG inside an ICO must be RGBA (IHDR colour type 6), or decoders (and Next's build) refuse it.
    expect(ico.readUInt8(offset + 25)).toBe(6);
  });

  it('has an icon.png for browsers that want a larger one', () => {
    expect(existsSync(app('icon.png'))).toBe(true);
    expect(readFileSync(app('icon.png')).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  });

  it('the proxy (per-request CSP) leaves both files alone', () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);
    expect(matcher.test('/favicon.ico')).toBe(false);
    expect(matcher.test('/icon.png')).toBe(false);
    expect(matcher.test('/goals')).toBe(true);
  });
});
