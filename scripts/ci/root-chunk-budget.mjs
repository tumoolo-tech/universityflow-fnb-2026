#!/usr/bin/env node
/**
 * The JavaScript every web page loads before anything else (Next's `rootMainFiles`), checked
 * after `next build` (audit A4-01).
 *
 * Learners open the app on budget phones over prepaid data. `import { z } from 'zod'` in
 * instrumentation-client.ts once put all of zod and its ~40 locales into these chunks: 216 KB
 * gzipped, 89 KB of it zod. This fails when:
 *
 * - any root chunk carries a non-English zod locale (zod has crept back in whole), or
 * - the root chunks together exceed the budget, gzipped.
 *
 * The budget is a ceiling against regressions, not the suite's 120 KB target: Next 16 and
 * React 19 alone are about 127 KB. Lowering it is the owner's call (A4).
 *
 * Usage: node scripts/ci/root-chunk-budget.mjs [apps/web/.next]
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

export const BUDGET_KB = 150;

/** Error messages only zod's non-English locales contain (German, French, Spanish, Russian). */
export const LOCALE_MARKERS = [
  'Ungültige Eingabe',
  'Entrée invalide',
  'Entrada inválida',
  'Неверный ввод',
];

export function checkRootChunks(nextDir, budgetKb = BUDGET_KB) {
  const manifest = JSON.parse(readFileSync(join(nextDir, 'build-manifest.json'), 'utf8'));
  const files = manifest.rootMainFiles ?? [];
  const problems = [];
  let gzipBytes = 0;
  for (const file of files) {
    const source = readFileSync(join(nextDir, file));
    gzipBytes += gzipSync(source).length;
    const text = source.toString('utf8');
    const marker = LOCALE_MARKERS.find((m) => text.includes(m));
    if (marker)
      problems.push(`${file} carries zod's locales ("${marker}"): import only what you use`);
  }
  const gzipKb = Math.round((gzipBytes / 1024) * 10) / 10;
  if (gzipKb > budgetKb) {
    problems.push(`root chunks are ${gzipKb} KB gzipped, over the ${budgetKb} KB budget`);
  }
  return { files: files.length, gzipKb, problems };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const nextDir = process.argv[2] ?? 'apps/web/.next';
  const { files, gzipKb, problems } = checkRootChunks(nextDir);
  for (const problem of problems) console.error(`✗ ${problem}`);
  if (problems.length > 0) process.exit(1);
  console.log(
    `✓ ${files} root chunks, ${gzipKb} KB gzipped (budget ${BUDGET_KB} KB), no zod locales`,
  );
}
