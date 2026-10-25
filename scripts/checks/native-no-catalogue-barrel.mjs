import { join } from 'node:path';
import { readLines, rel, walk } from './lib/walk.mjs';

/**
 * Guard: the phone app imports `@universityflow/catalogue/client`, never the catalogue's main
 * entry (A4-13).
 *
 * The barrel builds zod schemas when it loads and holds every record: the whole catalogue
 * (191 KB minified at Phase 5) and zod with its locales would go into both the iOS and Android
 * bundles, downloaded on prepaid data (A4-04). Metro doesn't tree-shake, so one value import
 * is enough. `import type` and `export type` are erased and allowed. An inline
 * `import { type X }` is not: under verbatimModuleSyntax it leaves `import {}`, which loads the
 * module. Deep paths into the package and relative paths into packages/catalogue count too.
 * scripts/ci/native-bundle-budget.mjs checks the built bundles for the same thing.
 */

const CLIENT = '@universityflow/catalogue/client';

/** `import … from '…'` / `export … from '…'`, across lines; group 1 marks a type-only one. */
const FROM = /\b(?:import|export)\s+(type\s+)?[^'";]*?\bfrom\s*(['"])([^'"]+)\2/g;
/** `import '…'` (side effects only), `import('…')` and `require('…')`. */
const BARE = /\b(?:import\s*|import\s*\(\s*|require\s*\(\s*)(['"])([^'"]+)\1/g;

function isBarrel(specifier) {
  if (specifier === CLIENT) return false;
  if (/^@universityflow\/catalogue(\/|$)/.test(specifier)) return true;
  return (
    /(^|\/)packages\/catalogue(\/|$)/.test(specifier) &&
    !/packages\/catalogue\/src\/client(\.ts)?$/.test(specifier)
  );
}

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

const lineAt = (text, index) => text.slice(0, index).split('\n').length;

export function run(root) {
  const findings = [];

  for (const file of walk(join(root, 'apps/native'), EXTENSIONS)) {
    const lines = readLines(file);
    const text = lines.join('\n');
    const seen = new Set();

    const report = (start, specifierIndex, specifier) => {
      const first = lines[lineAt(text, start) - 1].trim();
      if (first.startsWith('//') || first.startsWith('*') || first.startsWith('/*')) return;
      const line = lineAt(text, specifierIndex);
      if (seen.has(line)) return;
      seen.add(line);
      findings.push({
        file: rel(root, file),
        line,
        message: `imports the catalogue barrel (${specifier}), which puts every record and zod into both bundles. Import from ${CLIENT}, or \`import type\``,
        snippet: lines[line - 1].trim(),
      });
    };

    for (const match of text.matchAll(FROM)) {
      const [whole, typeOnly, , specifier] = match;
      if (typeOnly || !isBarrel(specifier)) continue;
      report(match.index, match.index + whole.lastIndexOf(specifier), specifier);
    }
    for (const match of text.matchAll(BARE)) {
      const [whole, , specifier] = match;
      if (!isBarrel(specifier)) continue;
      report(match.index, match.index + whole.lastIndexOf(specifier), specifier);
    }
  }

  return findings;
}

export const meta = {
  id: 'native-no-catalogue-barrel',
  description: 'apps/native imports @universityflow/catalogue/client, never the barrel (A4-13)',
};
