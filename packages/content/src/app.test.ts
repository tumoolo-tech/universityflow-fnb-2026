import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as app from './app';
import { en } from './en';

/**
 * `@universityflow/content/app`: the copy the phone app bundles (audit A4-18). Metro doesn't
 * tree-shake, so every module this entry reaches goes into both the iOS and Android bundles.
 * The guard `native-no-content-barrel` keeps the app (and the packages it bundles) on this
 * entry; this test keeps the entry itself off the web-only copy.
 */

const SRC = dirname(fileURLToPath(import.meta.url));

/** Modules only the web, the server or the agent read: never in the app's bundles. */
const WEB_ONLY = [
  'index.ts', // the barrel: every string
  'en.ts', // `en`, every section
  'sections.ts', // every section, one export each
  'en/privacy-page.ts', // the /privacy page (the app shows only its consent lines)
  'en/home.ts', // the web's landing page
  'en/consent.ts', // the guardian's consent page, on the web
  'en/agent.ts', // the agent's own words, used on the server
  'en/deploy.ts', // the staging site's banner
  'en/demo.ts', // the judges' demo mode
  'en/demo-personas.ts', // the judges' made-up learners
  'en/dev.ts', // the web's development pages
  'en/free-books.ts', // a module card's free books, worded on the server (A4-13, Phase 6c)
];

/** Every module `file` reaches through relative imports and re-exports, as paths under src. */
function reachable(file: string, seen = new Set<string>()): Set<string> {
  const path = relative(SRC, file).split('\\').join('/');
  if (seen.has(path)) return seen;
  seen.add(path);
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(
    /\b(?:import|export)\s+(type\s+)?[^'";]*?\bfrom\s*'(\.[^']+)'/g,
  )) {
    if (match[1]) continue; // `import type` is erased
    reachable(resolve(dirname(file), `${match[2]}.ts`), seen);
  }
  for (const match of text.matchAll(/\bimport\s*'(\.[^']+)'/g)) {
    reachable(resolve(dirname(file), `${match[1]}.ts`), seen);
  }
  return seen;
}

describe('the app entry (A4-18)', () => {
  const modules = reachable(join(SRC, 'app.ts'));

  it('reaches no web-only module', () => {
    expect(modules.has('app.ts')).toBe(true);
    expect([...modules].filter((m) => WEB_ONLY.includes(m))).toEqual([]);
  });

  it('gives the app the same section objects as `en`, so `en.x.y` reads the same in both', () => {
    const sections = Object.keys(app.en) as (keyof typeof app.en)[];
    expect(sections.length).toBeGreaterThan(30);
    for (const key of sections) {
      if (key === 'privacyPage') continue;
      expect(app.en[key], key).toBe(en[key]);
      expect((app as Record<string, unknown>)[key], key).toBe(en[key]);
    }
  });

  it('carries only the consent lines of the privacy page, word for word', () => {
    expect(Object.keys(app.en.privacyPage).length).toBeGreaterThan(0);
    for (const [key, value] of Object.entries(app.en.privacyPage)) {
      expect(value, key).toBe(en.privacyPage[key as keyof typeof en.privacyPage]);
    }
    expect(app.en.privacyPage).not.toHaveProperty('sections');
  });

  it('carries My CV, which the app shows as an outline (§10.5)', () => {
    expect((app.en as Record<string, unknown>)['cv']).toBe(en.cv);
  });

  it('leaves out the web-only sections', () => {
    for (const key of ['agent', 'deploy', 'demo', 'demoPersonas', 'dev']) {
      expect(app.en, key).not.toHaveProperty(key);
    }
  });
});
