import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readLines, rel, walk } from './lib/walk.mjs';

/**
 * Guard: the phone app reads its copy from `@universityflow/content/app`, never the content
 * package's main entry (A4-18).
 *
 * The main entry holds every string the product has, web-only pages included: the privacy
 * policy, the judges' demo, the staging banner, the agent's prompts and the SMS and WhatsApp
 * templates' neighbours. Metro doesn't tree-shake, so one value import puts all of it into both
 * the iOS and Android bundles, downloaded on prepaid data. The `/app` entry composes only the
 * sections the app shows (packages/content/src/app.ts; its own test fails if it reaches a
 * web-only module).
 *
 * Scanned: everything in apps/native, and the source (not the tests) of every workspace package
 * the app lists, because Metro bundles those too: `@universityflow/ui` importing the barrel is
 * the same leak. The content package itself is left to its test. `import type` and
 * `export type` are erased and allowed; an inline `import { type X }` is not (it leaves
 * `import {}`, which loads the module). Deep paths and relative paths into packages/content
 * count too.
 */

const APP = '@universityflow/content/app';
const SCOPE = '@universityflow/';
const CONTENT = '@universityflow/content';

/** `import … from '…'` / `export … from '…'`, across lines; group 1 marks a type-only one. */
const FROM = /\b(?:import|export)\s+(type\s+)?[^'";]*?\bfrom\s*(['"])([^'"]+)\2/g;
/** `import '…'` (side effects only), `import('…')` and `require('…')`. */
const BARE = /\b(?:import\s*|import\s*\(\s*|require\s*\(\s*)(['"])([^'"]+)\1/g;

function isBarrel(specifier) {
  if (specifier === APP) return false;
  if (/^@universityflow\/content(\/|$)/.test(specifier)) return true;
  return (
    /(^|\/)packages\/content(\/|$)/.test(specifier) &&
    !/packages\/content\/src\/app(\.ts)?$/.test(specifier)
  );
}

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const TEST = /\.test\.[cm]?[jt]sx?$|(^|\/)(__tests__|test)\//;

const lineAt = (text, index) => text.slice(0, index).split('\n').length;

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** The `src` folders of the workspace packages apps/native lists, except content itself. */
function bundledPackageSources(root) {
  const appFile = join(root, 'apps/native/package.json');
  if (!existsSync(appFile)) return [];
  const listed = new Set(
    Object.keys(readJson(appFile).dependencies ?? {}).filter(
      (d) => d.startsWith(SCOPE) && d !== CONTENT,
    ),
  );
  const dir = join(root, 'packages');
  if (!existsSync(dir)) return [];
  const sources = [];
  for (const name of readdirSync(dir)) {
    const file = join(dir, name, 'package.json');
    if (!existsSync(file)) continue;
    if (listed.has(readJson(file).name)) sources.push(join(dir, name, 'src'));
  }
  return sources;
}

function* scannedFiles(root) {
  yield* walk(join(root, 'apps/native'), EXTENSIONS);
  for (const src of bundledPackageSources(root)) {
    for (const file of walk(src, EXTENSIONS)) {
      if (!TEST.test(rel(root, file))) yield file;
    }
  }
}

export function run(root) {
  const findings = [];

  for (const file of scannedFiles(root)) {
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
        message: `imports the content barrel (${specifier}), which puts every string the product has, web-only pages too, into both app bundles. Import from ${APP}, or \`import type\``,
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
  id: 'native-no-content-barrel',
  description:
    'apps/native and the packages it bundles import @universityflow/content/app, never the barrel (A4-18)',
};
