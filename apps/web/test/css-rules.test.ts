import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tokens } from '@universityflow/tokens';
import { describe, expect, it } from 'vitest';

/**
 * Rules for globals.css that a screenshot can't show.
 *
 * A4-14: a `background-attachment: fixed` background on the body can't be scrolled by the
 * compositor, so desktop Chrome and Edge repainted the whole screen on every scroll frame (1,359
 * paints scrolling /results against 31), and scrolling froze while any script ran (572–587 ms
 * between frames against 36–46). The haze lives on its own fixed layer (`body::before`) instead.
 */

const CSS = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');
const FIXED_BACKGROUND = /background-attachment\s*:\s*fixed/;
const HAZE_LAYER = /body::before\s*\{[^}]*position\s*:\s*fixed/;
const WEB = join(__dirname, '..');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/**
 * A Tailwind size from its own theme that the tokens don't define (A2-24). Numbered widths
 * (`w-60`, `min-w-60`) are spacing steps, not theme sizes: the spacing scale is A2-01's, parked.
 */
const UNTOKENED_SIZE =
  /(?:^|[\s"'`:])(?:text-(?:xs|[4-9]xl)|leading-(?:none|snug|relaxed|loose|\d+)|(?:max-|min-)?w-(?:3xs|2xs|xs|sm|md|lg|xl|[2-7]xl))(?=$|[\s"'`])/;
/** A move typed as a number rather than a motion token (A2-25). */
const MOVE_LITERAL = /translate[XY]?\(\s*-?\d/;
/** An easing keyword rather than an easing token (A2-25). */
const EASING_KEYWORD =
  /(?:^|[\s,:])(?:ease|ease-in|ease-out|ease-in-out|linear|cubic-bezier\()(?=[\s;,)]|$)/m;

describe('globals.css', () => {
  it('has no fixed-attachment background (A4-14)', () => {
    expect(FIXED_BACKGROUND.test(CSS)).toBe(false);
  });

  it('draws the haze on its own fixed layer, behind everything and never in the way', () => {
    expect(HAZE_LAYER.test(CSS)).toBe(true);
    const layer = /body::before\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(layer).toMatch(/pointer-events\s*:\s*none/);
    expect(layer).toMatch(/z-index\s*:\s*-1/);
  });

  // A2-60: a fieldset's default `min-inline-size: min-content` let the demo's sample-photo grid
  // (auto-fill columns) widen it to 488 px inside a 326 px card at 360 px: photos 4 and 5 and the
  // end of every line in the Photo group were cut off by the card's `overflow: hidden`.
  it('lets a fieldset shrink to its container (A2-60)', () => {
    expect(CSS).toMatch(/(^|[\s,}])fieldset\s*\{[^}]*min-inline-size\s*:\s*0/);
  });

  /*
   * A2-24: classes from Tailwind's own theme (`max-w-3xl`, `text-4xl`, `leading-relaxed`, `w-60`)
   * reached past the tokens, and `sm:text-4xl` did nothing (Tailwind's 4xl is the tokens' 3xl).
   * The theme now starts from nothing in those namespaces, so an unmapped class draws no value at
   * all, and every size, line height and width comes from packages/tokens.
   */
  it('resets Tailwind’s own sizes, line heights and widths, and maps the tokens’ (A2-24)', () => {
    const theme = /@theme inline\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    for (const space of ['text', 'container', 'leading']) {
      expect(theme).toMatch(new RegExp(`--${space}-\\*\\s*:\\s*initial;`));
    }
    for (const key of Object.keys(tokens.maxWidth)) {
      expect(theme).toContain(`--container-${key}: var(--uf-width-${key});`);
    }
    for (const key of Object.keys(tokens.font.lineHeight)) {
      expect(theme).toContain(`--leading-${key}: var(--uf-leading-${key});`);
    }
    for (const key of Object.keys(tokens.font.size)) {
      expect(theme).toContain(`--text-${key}: var(--uf-text-${key});`);
      expect(theme).toMatch(new RegExp(`--text-${key}--line-height: var\\(--uf-leading-\\w+\\);`));
    }
  });

  it('gives the sidebar its width from the tokens (A2-24)', () => {
    const layout = readFileSync(join(WEB, 'app', '(app)', 'layout.tsx'), 'utf8');
    expect(layout).toContain('lg:w-sidebar');
    expect(layout).not.toContain('lg:w-60');
  });

  it('uses no Tailwind size the tokens don’t have, anywhere in the web app (A2-24)', () => {
    const offenders = sources(join(WEB, 'app'))
      .concat(sources(join(WEB, 'components')))
      .flatMap((file) =>
        readFileSync(file, 'utf8')
          .split('\n')
          .flatMap((line, i) =>
            UNTOKENED_SIZE.test(line) ? [`${relative(WEB, file)}:${i + 1}`] : [],
          ),
      );
    expect(offenders).toEqual([]);
    // Proven on the classes A2-24 found.
    for (const broken of ['max-w-3xl', 'sm:text-4xl', 'leading-relaxed', 'max-w-md', 'max-w-5xl']) {
      expect(UNTOKENED_SIZE.test(`className="${broken}"`)).toBe(true);
    }
    for (const fine of ['max-w-chat', 'text-3xl', 'leading-normal', 'lg:w-sidebar', 'max-w-32']) {
      expect(UNTOKENED_SIZE.test(`className="${fine}"`)).toBe(false);
    }
  });

  /*
   * A2-25: the stage's look was typed into the CSS (the rise, the lift, the easing, the haze's
   * shapes, the stage's least height, the rule's width), so a second surface that wanted "the same
   * rise" would retype it. Now each is a token, and a motion distance drops to 0 under reduced
   * motion in tokens.css whatever a rule forgets.
   */
  it('moves things by the tokens’ distances and eases them by the tokens’ curves (A2-25)', () => {
    expect(CSS.match(new RegExp(MOVE_LITERAL, 'g'))).toBeNull();
    expect(CSS.match(new RegExp(EASING_KEYWORD, 'gm'))).toBeNull();
    expect(MOVE_LITERAL.test('to { transform: translateY(-2px); }')).toBe(true);
    expect(MOVE_LITERAL.test('from { transform: translateY(0.75rem); }')).toBe(true);
    expect(MOVE_LITERAL.test('from { transform: translateY(var(--uf-motion-rise)); }')).toBe(false);
    expect(EASING_KEYWORD.test('animation: uf-rise 1s ease-out both;')).toBe(true);
    expect(EASING_KEYWORD.test('background: linear-gradient(to right, red, blue);')).toBe(false);
  });

  it('draws the haze, the stage’s height and the rule from the tokens (A2-25)', () => {
    const haze = /body::before\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(haze).toContain('radial-gradient(var(--uf-shape-haze-page),');
    expect(/\.uf-glow-card\s*\{([^}]*)\}/.exec(CSS)?.[1]).toContain(
      'radial-gradient(var(--uf-shape-haze-card),',
    );
    expect(CSS).toContain('min-height: max(100dvh, var(--uf-shape-stage-min));');
    expect(/\.uf-rule\s*\{([^}]*)\}/.exec(CSS)?.[1]).toContain('width: var(--uf-space-7);');
  });

  it('switches the sidebar’s targets at the tokens’ breakpoints, Tailwind’s lg among them (A2-25)', () => {
    const { laptop, shortScreen } = tokens.breakpoint;
    const theme = /@theme inline\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(theme).toContain(`--breakpoint-lg: ${laptop};`);
    const sidebar = CSS.slice(CSS.indexOf('.uf-sidebar {'), CSS.indexOf('.uf-app:has(.uf-chat)'));
    const widths = [...sidebar.matchAll(/@media[^{]*\(min-width:\s*([\d.]+rem)\)/g)].map(
      (m) => m[1],
    );
    expect(widths.length).toBeGreaterThan(0);
    expect(new Set(widths)).toEqual(new Set([laptop]));
    const heights = [...CSS.matchAll(/@media[^{]*\(max-height:\s*([\d.]+rem)\)/g)].map((m) => m[1]);
    expect(heights).toEqual([shortScreen]);
  });

  it('would catch one (proven on the old rule)', () => {
    expect(
      FIXED_BACKGROUND.test('body { background: var(--x); background-attachment: fixed; }'),
    ).toBe(true);
  });
});
