import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { isExempt, readLines, rel, walk } from './lib/walk.mjs';

/**
 * Guard: every environment variable the code reads is documented in `.env.example` (audit
 * A1-17). `UF_EAS_PROJECT_ID` was read by `apps/native/app.config.ts` but documented only in
 * status.md, so a store build could silently ship without push notifications.
 *
 * It finds `process.env.NAME`, `process.env['NAME']`, and the same reads through a variable
 * called `env` (`env['NAME']`, `env.NAME`: how `apps/web/lib/server/config.ts` reads), in the
 * source under `apps/` and `packages/`. A name counts as documented when `.env.example` has a
 * `NAME=` line, commented out or not. Names built at run time (`env[`${prefix}_PER_DAY`]`) are
 * not seen: document those by hand.
 *
 * Tests, end-to-end tooling and generated output are skipped: they set variables for themselves.
 */

/**
 * Set by the platform, never by the owner, so `.env.example` has nothing to say about them.
 * Keep this list short: anything the owner sets belongs in `.env.example`, not here.
 */
export const PLATFORM_PROVIDED = [
  'NODE_ENV', // set by Node tooling (next build / next dev, Jest, Vitest)
  'CI', // set by GitHub Actions
  'VERCEL', // set to 1 by Vercel on every build and function
  'VERCEL_ENV', // set by Vercel on every deployment
  'VERCEL_REGION', // set by Vercel in each function
  'EAS_BUILD_PROFILE', // set by EAS Build from the profile in eas.json
];

const EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.mts', '.cts'];

/** Tests, end-to-end tooling and generated folders the shared walker doesn't already skip. */
const EXEMPT_PATHS = [
  /\.(test|spec)\.[cm]?[jt]sx?$/,
  /(^|\/)(__tests__|test|tests|e2e)\//,
  /(^|\/)playwright\.config\.[cm]?[jt]s$/,
  /(^|\/)vitest\.(config|setup)\.[cm]?[jt]s$/,
  /(^|\/)jest\.(config|setup)\.[cm]?[jt]s$/,
  /(^|\/)(\.expo|android|ios|generated)\//,
];

const NAME = '([A-Z][A-Z0-9_]*)';
const READS = [
  new RegExp(`\\bprocess\\.env\\.${NAME}\\b`, 'g'),
  new RegExp(`\\bprocess\\.env\\[\\s*['"\`]${NAME}['"\`]\\s*\\]`, 'g'),
  new RegExp(`(?<![.\\w])env\\.${NAME}\\b`, 'g'),
  new RegExp(`(?<![.\\w])env\\[\\s*['"\`]${NAME}['"\`]\\s*\\]`, 'g'),
];

/** Every name `.env.example` documents: `NAME=` or `# NAME=` at the start of a line. */
export function documentedNames(lines) {
  const names = new Set();
  for (const line of lines) {
    const match = line.match(/^\s*#?\s*([A-Z][A-Z0-9_]*)=/);
    if (match) names.add(match[1]);
  }
  return names;
}

/** The environment variable names one line of source reads. */
export function namesRead(line) {
  const names = [];
  for (const pattern of READS) {
    for (const match of line.matchAll(pattern)) names.push(match[1]);
  }
  return names;
}

export function run(root) {
  const example = join(root, '.env.example');
  const documented = existsSync(example) ? documentedNames(readLines(example)) : new Set();
  const findings = [];
  const reported = new Set();

  for (const top of ['apps', 'packages']) {
    for (const file of walk(join(root, top), EXTENSIONS)) {
      const relative = rel(root, file);
      if (relative.includes('/node_modules/')) continue;
      if (EXEMPT_PATHS.some((pattern) => pattern.test(relative))) continue;

      readLines(file).forEach((line, index) => {
        if (isExempt(line)) return;
        for (const name of namesRead(line)) {
          if (documented.has(name) || PLATFORM_PROVIDED.includes(name)) continue;
          const key = `${relative}:${name}`;
          if (reported.has(key)) continue;
          reported.add(key);
          findings.push({
            file: relative,
            line: index + 1,
            message: `${name} is read here but not documented in .env.example`,
            snippet: line.trim(),
          });
        }
      });
    }
  }

  return findings;
}

export const meta = {
  id: 'env-documented',
  description: 'every environment variable the code reads is in .env.example (A1-17)',
};
