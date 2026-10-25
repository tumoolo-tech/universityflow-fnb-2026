#!/usr/bin/env node
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as actionsPinned from './actions-pinned.mjs';
import * as envDocumented from './env-documented.mjs';
import * as nativeListsWorkspaceDeps from './native-lists-workspace-deps.mjs';
import * as nativeNoCatalogueBarrel from './native-no-catalogue-barrel.mjs';
import * as nativeNoContentBarrel from './native-no-content-barrel.mjs';
import * as noAppImportsInPackages from './no-app-imports-in-packages.mjs';
import * as noDomInSharedPackages from './no-dom-in-shared-packages.mjs';
import * as noRawDesignValues from './no-raw-design-values.mjs';
import * as noRealPii from './no-real-pii.mjs';
import * as oneZod from './one-zod.mjs';
import * as toolsStayPrivate from './tools-stay-private.mjs';

/**
 * Project-specific guards, run by `pnpm check`, the pre-commit hook and CI. Biome catches
 * general problems; these catch the ways this project specifically degrades. Each one is
 * proven to fail on a broken example in checks.test.mjs.
 *
 * Hard rules 3 (provenance) and 6 (confirmed extraction) are enforced by schemas and tests in
 * their packages, not by text scanning.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CHECKS = [
  noAppImportsInPackages,
  noDomInSharedPackages,
  noRawDesignValues,
  noRealPii,
  nativeListsWorkspaceDeps,
  nativeNoCatalogueBarrel,
  nativeNoContentBarrel,
  oneZod,
  envDocumented,
  actionsPinned,
  toolsStayPrivate,
];

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

let failed = false;

for (const { meta, run } of CHECKS) {
  const findings = run(ROOT);

  if (findings.length === 0) {
    console.log(`${GREEN}✓${RESET} ${meta.id} ${DIM}— ${meta.description}${RESET}`);
    continue;
  }

  failed = true;
  console.log(`${RED}✗ FAIL${RESET} ${meta.id} ${DIM}— ${meta.description}${RESET}`);
  for (const finding of findings) {
    console.log(`    ${finding.file}:${finding.line}  ${finding.message}`);
    console.log(`      ${DIM}${finding.snippet}${RESET}`);
  }
  console.log('');
}

if (failed) {
  console.log(`${RED}Checks failed.${RESET} See CLAUDE.md for the rules these enforce.`);
  process.exit(1);
}

console.log(`${GREEN}All checks passed.${RESET}`);
