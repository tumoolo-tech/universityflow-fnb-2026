import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * What a judge demo may and may not be given, read from the app's own sources so the morning
 * setup (demo-setup.mjs) can never drift from what the deployed demo enforces:
 *
 * - the names a demo refuses: `NOT_ON_DEMO` (with its `MMEREKO_VARIABLES`) in
 *   apps/web/lib/server/config.ts, and any `UF_S3_*`, exactly as `checkDemo` reads them;
 * - the names `.env.example` documents (every variable the app reads is there: guard
 *   env-documented), so a prompt for an undocumented name is a test failure, and a switch another
 *   agent documents later (a real-photo switch, a second database URL) is offered without a code
 *   change here;
 * - the judges' sign-up and https-URL rules: apps/web/lib/demo-signup.ts itself, which has no
 *   imports and loads with Node's own TypeScript support.
 *
 * Reads only; never writes a file.
 */

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const CONFIG = 'apps/web/lib/server/config.ts';
const SIGNUP = 'apps/web/lib/demo-signup.ts';

/** The string literals of `const <name> = [ … ] as const;` in a TypeScript source, and its spreads. */
export function readConstList(source, name) {
  const match = source.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\] as const;`));
  if (!match)
    throw new Error(`${name} was not found in ${CONFIG}: update scripts/deploy/demo-rules.mjs`);
  const body = match[1].replace(/\/\/.*$/gm, '');
  const names = [...body.matchAll(/'([A-Z][A-Z0-9_]*)'/g)].map((m) => m[1]);
  const spreads = [...body.matchAll(/\.\.\.([A-Z][A-Z0-9_]*)/g)].map((m) => m[1]);
  return { names, spreads };
}

/** Every name the demo refuses to start with (config.ts `NOT_ON_DEMO`, spreads resolved). */
export function readRefusedOnDemo(configSource) {
  const seen = new Set();
  const walk = (name) => {
    const { names, spreads } = readConstList(configSource, name);
    for (const n of names) seen.add(n);
    for (const s of spreads) walk(s);
  };
  walk('NOT_ON_DEMO');
  if (seen.size === 0) throw new Error(`NOT_ON_DEMO in ${CONFIG} is empty: update demo-rules.mjs`);
  return [...seen];
}

/** Whether config.ts still refuses every `UF_S3_*` on a demo (the prefix rule in `checkDemo`). */
export function refusesS3Prefix(configSource) {
  return /name\.startsWith\('UF_S3_'\)/.test(configSource);
}

/** Every name `.env.example` documents with a `NAME=` line, commented out or not. */
export function readDocumentedNames(envExampleSource) {
  const names = new Set();
  for (const line of envExampleSource.split(/\r?\n/)) {
    const m = line.match(/^#?\s*([A-Z][A-Z0-9_]*)=/);
    if (m) names.add(m[1]);
  }
  return names;
}

/** The documented names in `.env.example`'s judge-demo section (its header to the next header). */
export function readDemoSectionNames(envExampleSource) {
  const lines = envExampleSource.split(/\r?\n/);
  const start = lines.findIndex((l) => /^# ─+ Judge demo mode/.test(l));
  if (start < 0) return new Set();
  const names = new Set();
  for (const line of lines.slice(start + 1)) {
    if (/^# ─+ /.test(line)) break;
    const m = line.match(/^#?\s*([A-Z][A-Z0-9_]*)=/);
    if (m) names.add(m[1]);
  }
  return names;
}

/** The rules, from this checkout's sources. `root` is for tests. */
export async function loadDemoRules(root = ROOT) {
  const configSource = readFileSync(resolve(root, CONFIG), 'utf8');
  const envExample = readFileSync(resolve(root, '.env.example'), 'utf8');
  const signup = await import(pathToFileURL(resolve(root, SIGNUP)).href);
  return {
    refused: new Set(readRefusedOnDemo(configSource)),
    refusesS3Prefix: refusesS3Prefix(configSource),
    // Vercel's Supabase integration's names (the Supabase work), once config.ts has them.
    integrationDatabase: configSource.includes('const INTEGRATION_DATABASE_VARIABLES')
      ? readConstList(configSource, 'INTEGRATION_DATABASE_VARIABLES').names
      : null,
    documented: readDocumentedNames(envExample),
    demoSection: readDemoSectionNames(envExample),
    readDemoSignup: signup.readDemoSignup,
    readHttpsUrl: signup.readHttpsUrl,
  };
}
