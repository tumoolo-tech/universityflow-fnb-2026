import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The CV code the web server bundles must not read the disk: inside a Next build (and on Vercel)
 * the vendored contract folder isn't there, and `import.meta.dirname` is undefined, so a module
 * that reads it on load breaks the build ("Failed to collect page data … path … undefined",
 * 2026-10-23). Only the test helpers (fixtures.ts, *.contract.ts) and tests may.
 */
const SRC = import.meta.dirname;
const TEST_ONLY = /(\.test\.ts|\.contract\.ts|^fixtures\.ts)$/;

describe('the CV code the server bundles', () => {
  const runtime = readdirSync(SRC).filter((f) => f.endsWith('.ts') && !TEST_ONLY.test(f));

  it.each(runtime)('%s neither reads the disk nor imports the test fixtures', (file) => {
    const source = readFileSync(join(SRC, file), 'utf8');
    expect(source).not.toMatch(/from '\.\/fixtures'/);
    expect(source).not.toMatch(/from 'node:fs'/);
  });
});
