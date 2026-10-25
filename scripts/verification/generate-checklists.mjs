#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { carryTicks, renderChecklists, withoutTicks } from './checklists.mjs';
import { loadCatalogue, ROOT } from './load-catalogue.mjs';

/**
 * `pnpm verification:checklists`: regenerates docs/verification/<university>.md, nsfas.md and
 * helplines.md from the catalogue, keeping the owner's ticks on rows that haven't changed.
 *
 * `--check` writes nothing and exits 1 if any checklist is out of date with the data (ticks
 * ignored), so a data change can't leave the checklists behind.
 *
 * Reads packages/catalogue; writes only under docs/verification/.
 */

const OUT = resolve(ROOT, 'docs/verification');
const check = process.argv.includes('--check');

const files = renderChecklists(await loadCatalogue());
const stale = [];

if (!check) mkdirSync(OUT, { recursive: true });

for (const [name, generated] of Object.entries(files)) {
  const path = resolve(OUT, name);
  const previous = existsSync(path) ? readFileSync(path, 'utf8').replace(/\r\n/g, '\n') : null;
  if (check) {
    if (previous === null || withoutTicks(previous) !== withoutTicks(generated)) stale.push(name);
    continue;
  }
  const next = carryTicks(generated, previous);
  if (next !== previous) {
    writeFileSync(path, next, 'utf8');
    console.log(`wrote docs/verification/${name}`);
  }
}

if (check) {
  if (stale.length > 0) {
    console.error(
      `Out of date: ${stale.join(', ')}. Run \`pnpm verification:checklists\` and commit the result.`,
    );
    process.exit(1);
  }
  console.log(`Verification checklists are up to date (${Object.keys(files).length} files).`);
} else {
  console.log(`Checklists generated: ${Object.keys(files).length} files in docs/verification/.`);
}
