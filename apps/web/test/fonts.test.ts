import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { toCss, tokens } from '@universityflow/tokens';
import { describe, expect, it } from 'vitest';
import { buildCsp } from '../lib/csp';

/**
 * The launch standard: fonts are self-hosted, with no font CDN, so no font company sees a visit
 * (the privacy page says so). Outfit is one woff2 in app/fonts loaded by `next/font/local`;
 * `next/font/google` or a font host anywhere in the web app's code or CSS fails this, and the
 * CSP allows fonts from our own origin only.
 */

const WEB = join(__dirname, '..');
const FONT_CDN =
  /next\/font\/google|fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|fonts\.bunny\.net|cdn\.jsdelivr\.net\/npm\/@fontsource|fontawesome\.com/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (['node_modules', '.next', 'test', 'e2e', 'coverage', '.turbo'].includes(name)) return [];
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(tsx?|css|mjs)$/.test(name) ? [path] : [];
  });
}

describe('fonts are self-hosted', () => {
  it('finds the code', () => {
    expect(sources(WEB).length).toBeGreaterThan(50);
  });

  it('no font CDN anywhere in the web app', () => {
    const hits = sources(WEB).filter((file) => FONT_CDN.test(readFileSync(file, 'utf8')));
    expect(hits.map((file) => relative(WEB, file))).toEqual([]);
  });

  it('would catch one (the check is proven on broken examples)', () => {
    expect(FONT_CDN.test("import { Outfit } from 'next/font/google';")).toBe(true);
    expect(FONT_CDN.test('@import url("https://fonts.googleapis.com/css2?family=Outfit");')).toBe(
      true,
    );
    expect(FONT_CDN.test("import localFont from 'next/font/local';")).toBe(false);
  });

  it('loads Outfit from our own file with next/font/local', () => {
    const layout = readFileSync(join(WEB, 'app', 'layout.tsx'), 'utf8');
    expect(layout).toMatch(/from 'next\/font\/local'/);
    expect(layout).toMatch(/src: '\.\/fonts\/Outfit-latin\.woff2'/);
    expect(statSync(join(WEB, 'app', 'fonts', 'Outfit-latin.woff2')).size).toBeGreaterThan(10_000);
  });

  /*
   * A2-26: the fallback list was typed into `localFont({ fallback })`, so next/font put it inside
   * `--font-outfit`, ending in `sans-serif`, and the tokens' stack after it was never reached.
   * next/font takes only literals, so the layout names no fallback: `--font-outfit` is Outfit and
   * its size-matched fallback, and the system stack behind it is `tokens.font.family`.
   */
  it('falls back to the tokens’ system stack, never one typed in the layout (A2-26)', () => {
    const layout = readFileSync(join(WEB, 'app', 'layout.tsx'), 'utf8');
    expect(layout).not.toMatch(/\bfallback\s*:/);
    // The family the tokens name is the one the layout loads.
    expect(layout).toMatch(new RegExp(`src: '\\./fonts/${tokens.font.brand}-latin\\.woff2'`));
    const css = readFileSync(join(WEB, 'app', 'globals.css'), 'utf8');
    expect(css).toContain('--font-sans: var(--font-outfit), var(--uf-font);');
    expect(css).toMatch(/html\s*\{[^}]*font-family: var\(--font-outfit\), var\(--uf-font\);/);
    expect(toCss()).toContain(`--uf-font: ${tokens.font.family};`);
  });

  it('lets the browser load fonts from our own origin only', () => {
    const fontSrc = buildCsp({ nonce: 'n', dev: false })
      .split(';')
      .map((d) => d.trim())
      .find((d) => d.startsWith('font-src'));
    expect(fontSrc).toBe("font-src 'self'");
  });
});
