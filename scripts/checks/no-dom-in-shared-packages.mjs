import { join } from 'node:path';
import { isExempt, readLines, rel, walk } from './lib/walk.mjs';

/**
 * Guard: the packages both apps use must run under React Native (hard rule 11). A DOM or Node
 * reference in any of them is a crash on a phone that no web test will ever catch. Ported
 * from tumo-olo, where the same rule kept its native app alive.
 *
 * Server-only packages (`agent`, `documents`, `db`, `jobs`, `messaging`, `evals`) are not listed:
 * they run in API routes and scheduled jobs, never on a device.
 */

export const SHARED_PACKAGES = ['admissions', 'catalogue', 'content', 'tokens', 'ui'];

const BANNED = [
  { pattern: /\bwindow\./, name: 'window' },
  { pattern: /\bdocument\./, name: 'document' },
  { pattern: /\bnavigator\./, name: 'navigator' },
  { pattern: /\blocalStorage\b/, name: 'localStorage' },
  { pattern: /\bsessionStorage\b/, name: 'sessionStorage' },
  { pattern: /from ['"]node:/, name: 'node: built-in import' },
  { pattern: /require\(['"]node:/, name: 'node: built-in require' },
  { pattern: /from ['"](fs|path|os|crypto|child_process)['"]/, name: 'Node built-in import' },
];

// Tests run in Node or jsdom on purpose; `scripts/` are build-time generators.
const EXEMPT_PATHS = [/\.test\.tsx?$/, /vitest\.(config|setup)\.ts$/, /packages\/[^/]+\/scripts\//];

export function run(root) {
  const findings = [];

  for (const pkg of SHARED_PACKAGES) {
    for (const file of walk(join(root, 'packages', pkg), ['.ts', '.tsx'])) {
      const relative = rel(root, file);
      if (EXEMPT_PATHS.some((pattern) => pattern.test(relative))) continue;

      readLines(file).forEach((line, index) => {
        if (isExempt(line)) return;
        for (const { pattern, name } of BANNED) {
          if (pattern.test(line)) {
            findings.push({
              file: relative,
              line: index + 1,
              message: `${name} is not available under React Native`,
              snippet: line.trim(),
            });
          }
        }
      });
    }
  }

  return findings;
}

export const meta = {
  id: 'no-dom-in-shared-packages',
  description: 'packages both apps use stay React-Native-safe (CLAUDE.md rule 11)',
};
