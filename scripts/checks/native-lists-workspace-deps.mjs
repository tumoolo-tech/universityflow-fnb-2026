import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readLines, rel } from './lib/walk.mjs';

/**
 * Guard: the mobile app lists every workspace package it reaches (gotcha 14).
 *
 * Metro resolves imports from the app, not from the package doing the importing. When a shared
 * package gains a workspace dependency (`admissions` → `catalogue`), the web app keeps working
 * but the iOS and Android bundles fail, and only on a clean install: a local `node_modules`
 * left over from another branch hides it. That is how Phase 1's PR went red in CI.
 */

const SCOPE = '@universityflow/';

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** Every workspace package's runtime dependencies, by package name. */
function workspacePackages(root) {
  const packages = new Map();
  const dir = join(root, 'packages');
  if (!existsSync(dir)) return packages;
  for (const name of readdirSync(dir)) {
    const file = join(dir, name, 'package.json');
    if (!existsSync(file)) continue;
    const pkg = readJson(file);
    packages.set(pkg.name, {
      file,
      deps: Object.keys(pkg.dependencies ?? {}).filter((d) => d.startsWith(SCOPE)),
    });
  }
  return packages;
}

export function run(root) {
  const appFile = join(root, 'apps/native/package.json');
  if (!existsSync(appFile)) return [];

  const listed = new Set(
    Object.keys(readJson(appFile).dependencies ?? {}).filter((d) => d.startsWith(SCOPE)),
  );
  const packages = workspacePackages(root);
  const findings = [];
  const seen = new Set();

  // Walk outwards from what the app lists; remember who pulled each package in.
  const queue = [...listed].map((name) => ({ name, via: null }));
  while (queue.length) {
    const { name, via } = queue.shift();
    if (seen.has(name)) continue;
    seen.add(name);

    if (!listed.has(name) && via) {
      const viaFile = packages.get(via)?.file;
      const lines = viaFile ? readLines(viaFile) : [];
      const index = lines.findIndex((l) => l.includes(`"${name}"`));
      findings.push({
        file: viaFile ? rel(root, viaFile) : rel(root, appFile),
        line: index + 1,
        message: `${via} depends on ${name}, which apps/native/package.json doesn't list. Metro will fail to bundle`,
        snippet: index >= 0 ? lines[index].trim() : name,
      });
    }

    for (const dep of packages.get(name)?.deps ?? []) queue.push({ name: dep, via: name });
  }

  return findings;
}

export const meta = {
  id: 'native-lists-workspace-deps',
  description: 'apps/native lists every workspace package it reaches (gotcha 14)',
};
