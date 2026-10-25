import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Read aloud's key never reaches a browser (owner's choice of 2026-10-22: the ElevenLabs key
 * lives on the server only). `scripts/ci/client-chunks.mjs` checks the built chunks after a
 * build; this checks the source, without one: it follows every import the browser's Read aloud
 * code makes inside this app and fails if any file it reaches names an ElevenLabs variable, its
 * API, its key header, or the server-side voice.
 */

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRIES = [
  'components/wayfinding.tsx',
  'components/read-aloud.tsx',
  'components/campus.tsx',
  'lib/client/speech.ts',
];
const FORBIDDEN = /ELEVENLABS_|elevenlabs\.io|xi-api-key|lib\/server\/voice|server\/read-aloud/;

function resolveImport(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) base = join(APP, specifier.slice(2));
  else if (specifier.startsWith('.')) base = resolve(dirname(from), specifier);
  else return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && candidate.match(/\.tsx?$/)) return candidate;
  }
  return null;
}

/** Every file in this app the browser code reaches, from `entries`. */
function reachedFiles(entries: ReadonlyArray<string>): Map<string, string> {
  const seen = new Map<string, string>();
  const queue = entries.map((e) => join(APP, e));
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    const source = readFileSync(file, 'utf8');
    seen.set(file, source);
    for (const match of source.matchAll(/(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g)) {
      const next = resolveImport(file, match[1] as string);
      if (next) queue.push(next);
    }
  }
  return seen;
}

describe('Read aloud in the browser carries no ElevenLabs key', () => {
  it('no file the browser’s Read aloud reaches names a key, the API or the server voice', () => {
    const files = reachedFiles(ENTRIES);
    expect(files.size).toBeGreaterThanOrEqual(ENTRIES.length);
    const offending = [...files]
      .filter(([, source]) => FORBIDDEN.test(source))
      .map(([file]) => file.slice(APP.length + 1));
    expect(offending).toEqual([]);
  });

  it('every one of them is client code: none imports server-only', () => {
    for (const [file, source] of reachedFiles(ENTRIES)) {
      expect(source, file).not.toMatch(/['"]server-only['"]/);
    }
  });

  it('the walk finds a forbidden name when there is one (the check can fail)', () => {
    const files = reachedFiles(['lib/server/read-aloud.ts']);
    expect([...files.values()].some((source) => FORBIDDEN.test(source))).toBe(true);
  });
});
