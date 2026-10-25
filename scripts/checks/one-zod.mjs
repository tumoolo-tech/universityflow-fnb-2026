import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readLines } from './lib/walk.mjs';

/**
 * Guard: one zod resolves for everything the apps bundle (audit A4-02).
 *
 * `catalogue` asked for `zod@^4.4.3` while `web` asked for `^4.6.7`, so pnpm resolved two
 * copies (4.6.5 and 4.6.7) and the browser downloaded both: about 60 KB gzipped of the same
 * library, twice. This reads pnpm-lock.yaml and fails when more than one zod version is reached
 * by a workspace package or by a library that could end up in a bundle.
 *
 * Build tools that never ship to a learner may keep their own zod: `@expo/cli` (the Expo
 * command line) depends on zod 3 for its config files.
 */

/** Dependents allowed their own zod: command-line tools that run on a developer's machine. */
export const TOOL_ONLY = ['@expo/cli'];

const LOCKFILE = 'pnpm-lock.yaml';

/** The package name of a lockfile key: `'@expo/cli@57.0.27(…)':` → `@expo/cli`. */
function nameOf(key) {
  const bare = key.trim().replace(/^'|':?$|:$/g, '');
  const at = bare.indexOf('@', 1);
  return at === -1 ? bare : bare.slice(0, at);
}

/**
 * Every zod version in the lockfile, with who depends on it and the line that says so.
 * Importers (workspace packages) are `importers:` → `  path:` → `      zod:` → `version: x`.
 * Libraries are `snapshots:` → `  'name@ver':` → `      zod: x`.
 */
export function zodVersions(lines) {
  const versions = new Map();
  const add = (version, dependent, line) => {
    if (!versions.has(version)) versions.set(version, []);
    versions.get(version).push({ dependent, line });
  };
  let section = '';
  let owner = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\S/.test(line)) {
      section = line.replace(/:.*$/, '');
      continue;
    }
    if (/^ {2}\S/.test(line)) {
      owner = line.trim().replace(/:$/, '');
      continue;
    }
    if (section === 'importers' && /^ {6}zod:\s*$/.test(line)) {
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        const match = lines[j].match(/^ {8}version: (\S+)/);
        if (match) add(match[1].replace(/\(.*$/, ''), owner, j + 1);
      }
    }
    if (section === 'snapshots') {
      const match = line.match(/^ {6}zod: (\S+)/);
      if (match) add(match[1].replace(/\(.*$/, ''), nameOf(owner), i + 1);
    }
  }
  return versions;
}

export function run(root) {
  const file = join(root, LOCKFILE);
  if (!existsSync(file)) return [];
  const lines = readLines(file);
  const bundled = [...zodVersions(lines)]
    .map(([version, uses]) => ({
      version,
      uses: uses.filter((use) => !TOOL_ONLY.includes(use.dependent)),
    }))
    .filter(({ uses }) => uses.length > 0);
  if (bundled.length <= 1) return [];
  return bundled.map(({ version, uses }) => ({
    file: LOCKFILE,
    line: uses[0].line,
    message: `zod ${version} resolves for ${uses.map((u) => u.dependent).join(', ')}; ${bundled.length} zod versions in all. Give every package the same zod specifier`,
    snippet: lines[uses[0].line - 1]?.trim() ?? `zod ${version}`,
  }));
}

export const meta = {
  id: 'one-zod',
  description: 'one zod version resolves for everything the apps bundle (A4-02)',
};
