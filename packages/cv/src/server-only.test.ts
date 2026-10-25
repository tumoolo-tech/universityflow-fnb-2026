import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The mobile app never imports this package (docs/design/mmereko-api-proposal.md §10.1; CLAUDE.md
 * locked decisions: the app calls the web app's API routes and never holds keys or calls a
 * provider). It isn't in the app's dependencies, and no app source file names it.
 */

const NATIVE = join(import.meta.dirname, '..', '..', '..', 'apps', 'native');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name.startsWith('.')) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx|js|jsx|json)$/.test(name) ? [path] : [];
  });
}

describe('packages/cv stays off the phone', () => {
  it('is not a dependency of apps/native', () => {
    const manifest = JSON.parse(readFileSync(join(NATIVE, 'package.json'), 'utf8'));
    const all = { ...manifest.dependencies, ...manifest.devDependencies };
    expect(Object.keys(all)).not.toContain('@universityflow/cv');
  });

  it('is imported by no file in apps/native', () => {
    const importers = sources(NATIVE).filter((file) =>
      readFileSync(file, 'utf8').includes('@universityflow/cv'),
    );
    expect(importers).toEqual([]);
  });
});
