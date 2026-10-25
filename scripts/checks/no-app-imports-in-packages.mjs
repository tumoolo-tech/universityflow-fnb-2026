import { join } from 'node:path';
import { readLines, rel, walk } from './lib/walk.mjs';

/**
 * Guard: `packages/*` never import from `apps/*` (hard rule 1).
 *
 * The packages are the parts that must never be wrong; if one reached into an app it would
 * start depending on UI code, and the pure calculators would stop being testable on their own.
 */

const IMPORT = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/;

function pointsIntoApps(specifier) {
  return /^@universityflow\/web(\/|$)/.test(specifier) || /(^|\/)apps\//.test(specifier);
}

export function run(root) {
  const findings = [];

  for (const file of walk(join(root, 'packages'), ['.ts', '.tsx', '.mjs', '.js'])) {
    readLines(file).forEach((line, index) => {
      const match = IMPORT.exec(line);
      if (match?.[1] && pointsIntoApps(match[1])) {
        findings.push({
          file: rel(root, file),
          line: index + 1,
          message: `imports from an app (${match[1]}). Packages must not depend on apps`,
          snippet: line.trim(),
        });
      }
    });
  }

  return findings;
}

export const meta = {
  id: 'no-app-imports-in-packages',
  description: 'packages/* never import from apps/* (CLAUDE.md rule 1)',
};
