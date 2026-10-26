import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  DEMO_COLLEGE_LOGOS,
  DEMO_FUNDER_LOGOS,
  DEMO_UNIVERSITY_LOGOS,
  type DemoLogo,
} from '../lib/demo-logos';

/**
 * Audit A4-22: every demo logo was an eager `<img>` with no size, so React preloaded all 37 on
 * /results (569–601 KB) and the chip could not reserve its width before the file arrived. Each
 * logo now carries its file's own width and height, so the browser knows its shape from the HTML.
 */

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const ALL: ReadonlyArray<readonly [string, DemoLogo]> = [
  ...new Map(Object.entries(DEMO_UNIVERSITY_LOGOS).map(([, l]) => [l.src, l] as const)),
  ...Object.entries(DEMO_COLLEGE_LOGOS).map(([, l]) => [l.src, l] as const),
  ...Object.entries(DEMO_FUNDER_LOGOS).map(([, l]) => [l.src, l] as const),
];

describe('the demo logos carry their own size', () => {
  it.each(ALL)('%s is listed at the size of its file', async (src, logo) => {
    const meta = await sharp(resolve(WEB, `public${src}`)).metadata();
    expect(logo.width).toBeGreaterThan(0);
    expect(logo.height).toBeGreaterThan(0);
    expect([logo.width, logo.height]).toEqual([meta.width, meta.height]);
  });
});
