import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  'dist',
  'build',
  'coverage',
  'playwright-report',
  'test-results',
]);

/** Recursively yields every file under `root` whose extension is in `extensions`. */
export function* walk(root, extensions) {
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      yield* walk(full, extensions);
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      yield full;
    }
  }
}

/** Reads a file and returns its lines, or an empty array if unreadable. */
export function readLines(file) {
  try {
    if (statSync(file).size > 2_000_000) return [];
    return readFileSync(file, 'utf8').split(/\r?\n/);
  } catch {
    return [];
  }
}

/** Repo-relative path with forward slashes, for stable output across platforms. */
export function rel(root, file) {
  return relative(root, file).split(sep).join('/');
}

/** True when the line is a comment or carries an explicit, reasoned opt-out. */
export function isExempt(line) {
  const trimmed = line.trim();
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*') ||
    line.includes('check-ignore')
  );
}
