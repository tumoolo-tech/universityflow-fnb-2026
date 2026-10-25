#!/usr/bin/env node
/**
 * The phone app's JavaScript, per platform, checked after `expo export` (audit A4-13).
 *
 * Learners download the app on prepaid data, from the stores and again with every OTA update.
 * The web has a root-chunk budget and a client-chunk data check; this is the phone's. It reads
 * each platform's Hermes bundle (`.hbc`) named in the export's metadata.json, prints its size
 * (raw and gzipped) so it is tracked release over release, and fails when:
 *
 * - a bundle is more than TOLERANCE_PERCENT over its committed baseline
 *   (apps/native/bundle-baseline.json), or a platform has no baseline;
 * - a bundle carries catalogue record data (the `@universityflow/catalogue` barrel came in:
 *   the whole catalogue and zod, in both bundles; A4-04), or zod's non-English locales.
 *
 * Why 5% (A4-13's figure): the bundles are about 2.8 MB (iOS) and 3.1 MB (Android), so 5% is
 * ~140-155 KB. One barrel import measured +908 KB (+30%) on each, so the size check catches it
 * even without the markers, and so would a dependency a sixth that size. One change that jumps
 * 5% should be looked at; ordinary feature work fits for a while. The
 * baseline never moves by itself: when growth is intended, re-record it on purpose and commit
 * the new file in the same PR, where the reviewer sees the size change:
 *
 *   pnpm --filter @universityflow/native build
 *   node scripts/ci/native-bundle-budget.mjs apps/native/dist --update-baseline
 *
 * A bundle that shrank passes; re-record then too, so the next regression is measured from it.
 * Raising TOLERANCE_PERCENT is the owner's call (A4), not a way to make a build pass.
 *
 * Usage: node scripts/ci/native-bundle-budget.mjs [apps/native/dist] [--update-baseline]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { LOCALE_MARKERS } from './root-chunk-budget.mjs';

export const TOLERANCE_PERCENT = 5;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const BASELINE_FILE = join(ROOT, 'apps/native/bundle-baseline.json');

/**
 * Text only the catalogue's records hold. Programme names start "Bachelor of"; the practice
 * records link to siyavula.com (lower case: the copy says "Siyavula"); every record carries
 * `verifiedBy` (hard rule 3), a key the app itself never reads.
 */
export const CATALOGUE_MARKERS = ['Bachelor of', 'siyavula', 'verifiedBy'];

/**
 * Hermes keeps an ASCII string as one byte per character and any string with a non-ASCII
 * character as UTF-16, so every marker is looked for in both encodings.
 */
function findMarker(bytes, markers) {
  return markers.find(
    (m) => bytes.includes(Buffer.from(m, 'utf8')) || bytes.includes(Buffer.from(m, 'utf16le')),
  );
}

const kb = (bytes) => Math.round((bytes / 1024) * 10) / 10;

/** Each exported platform's bundle: its size and any data that must not be in it. */
export function measureBundles(exportDir) {
  const metadata = JSON.parse(readFileSync(join(exportDir, 'metadata.json'), 'utf8'));
  return Object.entries(metadata.fileMetadata ?? {})
    .map(([platform, { bundle }]) => {
      const file = String(bundle).replace(/\\/g, '/');
      const bytes = readFileSync(join(exportDir, file));
      const problems = [];
      const data = findMarker(bytes, CATALOGUE_MARKERS);
      if (data) {
        problems.push(
          `${platform} bundle carries catalogue data ("${data}"): apps/native imports @universityflow/catalogue/client only`,
        );
      }
      const locale = findMarker(bytes, LOCALE_MARKERS);
      if (locale) problems.push(`${platform} bundle carries zod's locales ("${locale}")`);
      return { platform, file, bytes: bytes.length, gzipBytes: gzipSync(bytes).length, problems };
    })
    .sort((a, b) => a.platform.localeCompare(b.platform));
}

/** The bundles against the baseline's `{ [platform]: { bytes } }`. */
export function checkBundles(exportDir, baseline, tolerancePercent = TOLERANCE_PERCENT) {
  const sizes = measureBundles(exportDir);
  const problems = sizes.flatMap((s) => s.problems);
  for (const { platform, bytes } of sizes) {
    const base = baseline[platform]?.bytes;
    if (typeof base !== 'number') {
      problems.push(`no baseline for ${platform}: record one with --update-baseline`);
      continue;
    }
    const limit = Math.floor(base * (1 + tolerancePercent / 100));
    if (bytes > limit) {
      const growth = Math.round(((bytes - base) / base) * 1000) / 10;
      problems.push(
        `${platform} bundle is ${kb(bytes)} KB, ${growth}% over its baseline of ${kb(base)} KB (tolerance ${tolerancePercent}%)`,
      );
    }
  }
  for (const platform of Object.keys(baseline)) {
    if (!sizes.some((s) => s.platform === platform)) {
      problems.push(`${platform} is in the baseline but not in the export`);
    }
  }
  return { sizes, problems };
}

/** The committed baseline; none at all reads as empty, so every platform fails "no baseline". */
export function readBaseline(file = BASELINE_FILE) {
  if (!existsSync(file)) return {};
  return JSON.parse(readFileSync(file, 'utf8')).platforms ?? {};
}

/** Records the measured sizes as the new baseline. Refuses a bundle that carries markers. */
export function writeBaseline(file, sizes) {
  const problems = sizes.flatMap((s) => s.problems);
  if (problems.length > 0) {
    throw new Error(
      `not recording a baseline from a bundle that is wrong:\n  ${problems.join('\n  ')}`,
    );
  }
  const platforms = Object.fromEntries(sizes.map((s) => [s.platform, { bytes: s.bytes }]));
  const body = {
    $comment:
      'Hermes bundle bytes per platform (A4-13). Re-record only on purpose: see scripts/ci/native-bundle-budget.mjs',
    platforms,
  };
  writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const update = args.includes('--update-baseline');
  const exportDir = args.find((a) => !a.startsWith('--')) ?? 'apps/native/dist';

  if (update) {
    const sizes = measureBundles(exportDir);
    for (const s of sizes) console.log(`  ${s.platform.padEnd(8)} ${s.bytes} bytes`);
    try {
      writeBaseline(BASELINE_FILE, sizes);
    } catch (error) {
      console.error(`✗ ${error.message}`);
      process.exit(1);
    }
    console.log(`✓ baseline recorded in apps/native/bundle-baseline.json: commit it`);
  } else {
    const baseline = readBaseline();
    const { sizes, problems } = checkBundles(exportDir, baseline);
    for (const { platform, bytes, gzipBytes } of sizes) {
      const base = baseline[platform]?.bytes;
      const change =
        typeof base === 'number'
          ? ` (baseline ${kb(base)} KB, ${bytes - base >= 0 ? '+' : ''}${kb(bytes - base)} KB)`
          : '';
      console.log(`  ${platform.padEnd(8)} ${kb(bytes)} KB, ${kb(gzipBytes)} KB gz${change}`);
    }
    for (const problem of problems) console.error(`✗ ${problem}`);
    if (problems.length > 0) process.exit(1);
    console.log(
      `✓ ${sizes.length} native bundles within ${TOLERANCE_PERCENT}% of the baseline, none with catalogue data or zod's locales`,
    );
  }
}
