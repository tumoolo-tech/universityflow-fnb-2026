import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  COURSE_ART_PAIRS,
  colorDistance,
  composite,
  contrastRatio,
  GLASS_PAIRS,
  luminance,
  MAP_TONE_PAIRS,
  NON_TEXT_PAIRS,
  PROFILE_THEME_PAIRS,
  TEXT_PAIRS,
  toCss,
  tokens,
} from './index';

/** ΔE 20: two colours anyone can tell apart at a glance (the proposal's Coral was 10 from danger). */
const PROFILE_MIN_DISTANCE = 20;
const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

describe('tokens', () => {
  it('holds the WCAG 2.2 AA contrast minimums', () => {
    expect(tokens.contrast).toEqual({ text: 4.5, largeText: 3, nonText: 3 });
  });

  it('computes contrast the WCAG way', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
    expect(luminance('#FFFFFF')).toBe(1);
    expect(() => luminance('red')).toThrow(RangeError);
  });

  it.each(TEXT_PAIRS)('%s on %s meets AA for text (4.5:1)', (fg, bg) => {
    expect(contrastRatio(tokens.color[fg], tokens.color[bg])).toBeGreaterThanOrEqual(
      tokens.contrast.text,
    );
  });

  it('holds the pairs the danger button and native radios use (A2-03, A2-04)', () => {
    // A white label on a red, irreversible button: web `bg-danger text-on-brand`, native `danger`.
    expect(TEXT_PAIRS).toContainEqual(['onBrand', 'danger']);
    // A selected radio dot or a ticked box: brand on a white card.
    expect(NON_TEXT_PAIRS).toContainEqual(['brand', 'surface']);
  });

  it('holds brand links on a sunk panel (A2-06, A3-08)', () => {
    // Free practice: brand link text inside a surfaceSunk panel, web and native.
    expect(TEXT_PAIRS).toContainEqual(['brand', 'surfaceSunk']);
  });

  it('holds muted text and an unticked or ticked box on a sunk panel (A3-21, A2-19)', () => {
    // Web "Done on…" in a first-week step box: `text-muted` inside `bg-sunk`.
    expect(TEXT_PAIRS).toContainEqual(['inkMuted', 'surfaceSunk']);
    // Native first-week Checkbox in a sunk step panel: the box's border, unticked then ticked.
    expect(NON_TEXT_PAIRS).toContainEqual(['lineStrong', 'surfaceSunk']);
    expect(NON_TEXT_PAIRS).toContainEqual(['brand', 'surfaceSunk']);
  });

  it('names every border width, and gives each to the web as a custom property (A2-05)', () => {
    expect(tokens.border).toEqual({ thin: '1px', thick: '2px', rule: '4px' });
    const css = toCss();
    for (const [key, value] of Object.entries(tokens.border)) {
      expect(css).toContain(`--uf-border-${key}: ${value};`);
    }
  });

  it.each(NON_TEXT_PAIRS)('%s on %s meets AA for controls (3:1)', (fg, bg) => {
    expect(contrastRatio(tokens.color[fg], tokens.color[bg])).toBeGreaterThanOrEqual(
      tokens.contrast.nonText,
    );
  });

  it('switches every duration off for reduced motion (hard rule 9)', () => {
    const css = toCss();
    for (const key of Object.keys(tokens.duration)) {
      expect(css).toContain(`--uf-duration-${key}: 0ms;`);
    }
  });

  it('composites a translucent colour over a backdrop the way a browser paints it', () => {
    expect(composite('rgba(0, 0, 0, 0.5)', '#FFFFFF')).toBe('#808080');
    expect(composite('rgba(255, 255, 255, 1)', '#1B1B1F')).toBe('#FFFFFF');
    expect(composite('rgba(8, 69, 57, 0)', '#F7F4EC')).toBe('#F7F4EC');
    expect(() => composite('#FFFFFF', '#000000')).toThrow(RangeError);
  });

  it('names every backdrop the stage glass may sit over, darkest and lightest included', () => {
    const lums = tokens.glass.backdrops.tint.map((b) => luminance(tokens.color[b]));
    // The stage's charcoal top is the darkest thing behind the glass; the mauve shape the lightest.
    expect(Math.min(...lums)).toBe(luminance(tokens.color.stageTop));
    expect(Math.max(...lums)).toBe(luminance(tokens.color.brand));
    // The card may also cross the sharp half and the page itself.
    expect(tokens.glass.backdrops.card).toEqual(
      expect.arrayContaining([...tokens.glass.backdrops.tint, 'canvas']),
    );
  });

  it('is one dark theme: light ink on a near-black canvas', () => {
    expect(luminance(tokens.color.canvas)).toBeLessThan(0.01);
    expect(luminance(tokens.color.surface)).toBeGreaterThan(luminance(tokens.color.canvas));
    expect(luminance(tokens.color.ink)).toBeGreaterThan(0.85);
  });

  it('keeps the four statuses apart from each other and from the accent', () => {
    const hues = ['success', 'warning', 'danger', 'info', 'brand'] as const;
    for (const a of hues)
      for (const b of hues)
        if (a !== b) expect(tokens.color[a], `${a} vs ${b}`).not.toBe(tokens.color[b]);
    for (const status of ['success', 'warning', 'danger', 'info'] as const) {
      expect(TEXT_PAIRS).toContainEqual([status, `${status}Soft`]);
      expect(TEXT_PAIRS).toContainEqual(['ink', `${status}Soft`]);
    }
  });

  /**
   * Text on glass (the split stage, design note docs/design/README.md): the glass is translucent,
   * and a blur only averages what is behind it, so the worst case is the glass composited over
   * each backdrop in turn. Every pair must pass over every one of them, and over the solid
   * fallback (`@supports not (backdrop-filter)`).
   */
  describe.each(GLASS_PAIRS)('%s on glass %s', (fg, glass, minimum) => {
    it.each(tokens.glass.backdrops[glass])(`meets ${minimum} over %s`, (backdrop) => {
      const painted = composite(tokens.glass[glass], tokens.color[backdrop]);
      expect(contrastRatio(tokens.color[fg], painted)).toBeGreaterThanOrEqual(
        tokens.contrast[minimum],
      );
    });

    it(`meets ${minimum} on the solid fallback`, () => {
      expect(
        contrastRatio(tokens.color[fg], tokens.color[tokens.glass.fallback[glass]]),
      ).toBeGreaterThanOrEqual(tokens.contrast[minimum]);
    });
  });

  it('holds the stage’s text and focus ring on the dark glass, and form text on the glass card', () => {
    expect(GLASS_PAIRS).toContainEqual(['onGlass', 'tint', 'text']);
    expect(GLASS_PAIRS).toContainEqual(['ink', 'pill', 'text']);
    expect(GLASS_PAIRS).toContainEqual(['inkMuted', 'haze', 'text']);
    expect(GLASS_PAIRS).toContainEqual(['onGlassMuted', 'tint', 'text']);
    // The focus ring on the dark glass is the light ink: the blue one fails there.
    expect(GLASS_PAIRS).toContainEqual(['onGlass', 'tint', 'nonText']);
    expect(GLASS_PAIRS).toContainEqual(['ink', 'card', 'text']);
    expect(GLASS_PAIRS).toContainEqual(['inkMuted', 'card', 'text']);
    expect(GLASS_PAIRS).toContainEqual(['focus', 'card', 'nonText']);
  });

  it('gives the web the glass, the display sizes and the tracking as custom properties', () => {
    const css = toCss();
    expect(css).toContain(`--uf-glass-tint: ${tokens.glass.tint};`);
    expect(css).toContain(`--uf-glass-card: ${tokens.glass.card};`);
    expect(css).toContain(`--uf-glass-haze: ${tokens.glass.haze};`);
    expect(css).toContain(`--uf-glass-pill: ${tokens.glass.pill};`);
    expect(css).toContain(`--uf-glass-blur: ${tokens.glass.blur};`);
    for (const [key, value] of Object.entries(tokens.display)) {
      expect(css).toContain(`--uf-display-${key}: ${value};`);
    }
    for (const [key, value] of Object.entries(tokens.tracking)) {
      expect(css).toContain(`--uf-tracking-${key}: ${value};`);
    }
  });

  it('holds the wordmark’s two copies to the large-text minimum: light on the charcoal, pink on the glass', () => {
    // Decoration (aria-hidden), but it must be seen: 3:1, the large-text minimum.
    expect(TEXT_PAIRS).toContainEqual(['ink', 'stageBottom']);
    expect(GLASS_PAIRS).toContainEqual(['accent', 'tint', 'largeText']);
  });

  it('gives a mouse a smaller target than a thumb, never under WCAG 2.5.8’s 24px', () => {
    const px = (rem: string) => Number.parseFloat(rem) * 16;
    expect(px(tokens.target)).toBe(44);
    expect(px(tokens.targetPointer)).toBeGreaterThanOrEqual(24);
    expect(px(tokens.targetDense)).toBeGreaterThanOrEqual(24);
    expect(px(tokens.targetDense)).toBeLessThanOrEqual(px(tokens.targetPointer));
    const css = toCss();
    expect(css).toContain(`--uf-target-pointer: ${tokens.targetPointer};`);
    expect(css).toContain(`--uf-target-dense: ${tokens.targetDense};`);
  });

  it('gives the web the chat column, the form card, the wide page and the sidebar as widths (A2-24)', () => {
    expect(tokens.maxWidth).toMatchObject({ chat: '48rem', form: '28rem', sidebar: '15rem' });
    const css = toCss();
    for (const [key, value] of Object.entries(tokens.maxWidth)) {
      expect(css).toContain(`--uf-width-${key}: ${value};`);
    }
  });

  it('names the entrance’s rise, a hover’s lift and the easing, and stills them for reduced motion (A2-25)', () => {
    const css = toCss();
    for (const [key, value] of Object.entries(tokens.motion)) {
      expect(css).toContain(`--uf-motion-${kebab(key)}: ${value};`);
    }
    for (const [key, value] of Object.entries(tokens.easing)) {
      expect(css).toContain(`--uf-easing-${kebab(key)}: ${value};`);
    }
    expect(css).toContain('--uf-easing-enter: ');
    expect(css).toContain('--uf-motion-rise: ');
    // Under reduced motion nothing rises or lifts, whatever a rule forgets (hard rule 9).
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    for (const key of Object.keys(tokens.motion)) {
      expect(reduced).toContain(`--uf-motion-${kebab(key)}: 0;`);
    }
  });

  it('gives the web the haze’s shapes and the stage’s least height as custom properties (A2-25)', () => {
    const css = toCss();
    for (const [key, value] of Object.entries(tokens.shape)) {
      expect(css).toContain(`--uf-shape-${kebab(key)}: ${value};`);
    }
  });

  it('documents the two breakpoints the sidebar’s targets switch at (A2-25)', () => {
    // CSS can't read a variable in a media query: these are constants globals.css is held to
    // (apps/web/test/css-rules.test.ts), from a laptop's width and on a short screen.
    expect(tokens.breakpoint).toEqual({ laptop: '64rem', shortScreen: '50rem' });
  });

  it('puts the home’s glow card text on the haze over a card too', () => {
    expect(tokens.glass.backdrops.haze).toEqual(expect.arrayContaining(['canvas', 'surface']));
  });

  /**
   * The profile card's themes (docs/design/profile-look-proposal.md §3): each colours only the
   * card and the home avatar, so its pairs are generated from `tokens.profileThemes` and a new
   * theme cannot skip a test.
   */
  describe('profile themes', () => {
    const themes = Object.entries(tokens.profileThemes);

    it('offers seven, Mauve first, reusing the app’s accent, and Mono on the ink', () => {
      expect(Object.keys(tokens.profileThemes)).toEqual([
        'mauve',
        'ocean',
        'fynbos',
        'sunrise',
        'protea',
        'jacaranda',
        'mono',
      ]);
      expect(tokens.profileThemes.mauve.accent).toBe('accent');
      expect(tokens.profileThemes.mono.accent).toBe('ink');
    });

    it.each(PROFILE_THEME_PAIRS)('%s on %s meets %s', (fg, bg, minimum) => {
      expect(contrastRatio(tokens.color[fg], tokens.color[bg])).toBeGreaterThanOrEqual(
        tokens.contrast[minimum],
      );
    });

    it.each(themes)('%s has every pair the card uses', (_id, { accent, soft }) => {
      for (const pair of [
        [accent, 'surface', 'text'],
        [accent, 'canvas', 'text'],
        [accent, soft, 'text'],
        ['ink', soft, 'text'],
        ['inkMuted', soft, 'text'],
        ['onAccent', accent, 'text'],
        ['focus', soft, 'nonText'],
        ['lineStrong', soft, 'nonText'],
        // "Make it yours" sits on the card's ground: the quiet buttons (Cancel, Remove photo), a
        // ticked word's box and a focused or hovered outline button are `brand` on it (A2-30).
        ['brand', soft, 'text'],
      ]) {
        expect(PROFILE_THEME_PAIRS).toContainEqual(pair);
      }
    });

    it('measures colour distance as CIE76 ΔE', () => {
      expect(colorDistance('#000000', '#FFFFFF')).toBeCloseTo(100, 1);
      expect(colorDistance('#9CC2FF', '#9CC2FF')).toBe(0);
      expect(() => colorDistance('red', '#000000')).toThrow(RangeError);
    });

    // A learner's theme must never read as "you passed" or as focus: a clearly different colour.
    it.each(themes)('%s stays apart from focus and every status', (_id, { accent }) => {
      for (const other of ['focus', 'success', 'warning', 'danger', 'info'] as const) {
        expect(
          colorDistance(tokens.color[accent], tokens.color[other]),
          `${accent} vs ${other}`,
        ).toBeGreaterThanOrEqual(PROFILE_MIN_DISTANCE);
      }
    });

    it('keeps the seven apart from each other', () => {
      for (const [a, ta] of themes)
        for (const [b, tb] of themes)
          if (a < b)
            expect(
              colorDistance(tokens.color[ta.accent], tokens.color[tb.accent]),
              `${a} vs ${b}`,
            ).toBeGreaterThanOrEqual(PROFILE_MIN_DISTANCE);
    });

    it('gives the web every theme colour and the line-drawing duration', () => {
      const css = toCss();
      for (const { accent, soft } of Object.values(tokens.profileThemes)) {
        expect(css).toContain(`--uf-color-${kebab(accent)}: ${tokens.color[accent]};`);
        expect(css).toContain(`--uf-color-${kebab(soft)}: ${tokens.color[soft]};`);
      }
      expect(tokens.duration.draw).toBe('800ms');
      expect(css).toContain('--uf-duration-draw: 0ms;');
    });
  });

  /**
   * My plan maps' six branch tones (docs/design/plan-maps-proposal.md §8.3): an accent for a
   * branch's border, number and line, and a dark soft fill behind its words. A tone is never a
   * status: Achieved is `success` with a word and a tick, Not achieved is `inkMuted` (D7).
   */
  describe('plan map tones', () => {
    it('are six, each an accent and a soft fill', () => {
      expect(tokens.mapTones).toHaveLength(6);
      tokens.mapTones.forEach(({ accent, soft }, i) => {
        expect(accent).toBe(`mapTone${i + 1}`);
        expect(soft).toBe(`mapTone${i + 1}Soft`);
      });
    });

    it.each(MAP_TONE_PAIRS)('%s on %s meets %s', (fg, bg, minimum) => {
      expect(contrastRatio(tokens.color[fg], tokens.color[bg])).toBeGreaterThanOrEqual(
        tokens.contrast[minimum],
      );
    });

    it.each(tokens.mapTones)('$accent has every pair a branch uses', ({ accent, soft }) => {
      for (const pair of [
        ['ink', soft, 'text'],
        ['inkMuted', soft, 'text'],
        [accent, soft, 'text'],
        [accent, 'surface', 'text'],
        ['success', soft, 'text'],
        ['brand', soft, 'text'],
        ['focus', soft, 'nonText'],
        ['lineStrong', soft, 'nonText'],
        [accent, 'canvas', 'nonText'],
      ]) {
        expect(MAP_TONE_PAIRS).toContainEqual(pair);
      }
    });

    // A branch colour must never read as a status or as focus (§8.3).
    it.each(tokens.mapTones)('$accent stays apart from focus and every status', ({ accent }) => {
      for (const other of ['focus', 'success', 'warning', 'danger', 'info'] as const) {
        expect(
          colorDistance(tokens.color[accent], tokens.color[other]),
          `${accent} vs ${other}`,
        ).toBeGreaterThanOrEqual(PROFILE_MIN_DISTANCE);
      }
    });

    it('keeps the six apart from each other', () => {
      for (const a of tokens.mapTones)
        for (const b of tokens.mapTones)
          if (a.accent < b.accent)
            expect(
              colorDistance(tokens.color[a.accent], tokens.color[b.accent]),
              `${a.accent} vs ${b.accent}`,
            ).toBeGreaterThanOrEqual(PROFILE_MIN_DISTANCE);
    });

    it('gives the web every tone', () => {
      const css = toCss();
      for (const { accent, soft } of tokens.mapTones) {
        expect(css).toContain(`--uf-color-${kebab(accent)}: ${tokens.color[accent]};`);
        expect(css).toContain(`--uf-color-${kebab(soft)}: ${tokens.color[soft]};`);
      }
    });
  });

  /**
   * The course cards' pictures (cards8): a photo can hold any colour, so the worst case is its
   * brightest pixel, white. The scrim from the band down, composited over white, is the lightest
   * ground any word on the card can have ("the darkest-light point"); over black, the darkest.
   */
  describe('course art scrim', () => {
    const WHITE = '#FFFFFF';
    const BLACK = '#000000';
    const lightest = composite(tokens.courseArt.scrimText, WHITE);
    const darkest = composite(tokens.courseArt.scrimText, BLACK);

    it.each(COURSE_ART_PAIRS)('%s meets %s over the scrim on the lightest photo', (fg, minimum) => {
      expect(contrastRatio(tokens.color[fg], lightest)).toBeGreaterThanOrEqual(
        tokens.contrast[minimum],
      );
    });

    it.each(COURSE_ART_PAIRS)('%s meets %s over the scrim on the darkest photo', (fg, minimum) => {
      expect(contrastRatio(tokens.color[fg], darkest)).toBeGreaterThanOrEqual(
        tokens.contrast[minimum],
      );
    });

    it('holds every colour the card writes or draws straight on the scrim', () => {
      // The course name, its faculty, the links and the quiet "Details" button; the focus ring
      // and the outline button's edge. The badges and filled buttons have opaque grounds of their
      // own (TEXT_PAIRS).
      for (const fg of ['ink', 'inkMuted', 'brand'] as const)
        expect(COURSE_ART_PAIRS).toContainEqual([fg, 'text']);
      for (const fg of ['focus', 'lineStrong'] as const)
        expect(COURSE_ART_PAIRS).toContainEqual([fg, 'nonText']);
    });

    it('shows the picture in an empty band at the top and darkens it under the words', () => {
      const alpha = (rgba: string) => Number(/,\s*([\d.]+)\s*\)$/.exec(rgba)?.[1]);
      expect(alpha(tokens.courseArt.scrimTop)).toBeLessThan(alpha(tokens.courseArt.scrimText));
      expect(Number.parseFloat(tokens.courseArt.band)).toBeLessThan(
        Number.parseFloat(tokens.courseArt.height),
      );
    });

    it('gives the web the scrim, the band and the picture’s height', () => {
      const css = toCss();
      expect(css).toContain(`--uf-course-art-scrim-top: ${tokens.courseArt.scrimTop};`);
      expect(css).toContain(`--uf-course-art-scrim-text: ${tokens.courseArt.scrimText};`);
      expect(css).toContain(`--uf-course-art-band: ${tokens.courseArt.band};`);
      expect(css).toContain(`--uf-course-art-height: ${tokens.courseArt.height};`);
    });
  });

  it('keeps the committed tokens.css in step with the source', () => {
    const committed = readFileSync(new URL('../tokens.css', import.meta.url), 'utf8');
    expect(committed).toBe(toCss());
  });

  // The plan map's canvas (2026-10-24): a card you pan and zoom, from a 360px phone up.
  describe('plan map canvas', () => {
    const canvas: Readonly<Record<string, string>> = tokens.canvas;

    it('gives the web the card’s height, the dotted grid, the map widths and the mini-map', () => {
      const css = toCss();
      for (const key of [
        'height',
        'grid',
        'dot',
        'worldRing',
        'worldWide',
        'worldRoad',
        'minimap',
      ]) {
        expect(canvas).toHaveProperty(key);
      }
      for (const [key, value] of Object.entries(canvas)) {
        const name = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
        expect(css).toContain(`--uf-canvas-${name}: ${value};`);
      }
    });

    it('is wide enough inside the card for each picture to lay out', () => {
      // globals.css lays the picture out from 48rem (64rem for the life map) of the map's own
      // width, so each map width must be at least that.
      for (const width of [canvas['worldRing'], canvas['worldRoad']]) {
        expect(Number.parseFloat(width ?? '0')).toBeGreaterThanOrEqual(48);
      }
      expect(Number.parseFloat(canvas['worldWide'] ?? '0')).toBeGreaterThanOrEqual(64);
    });

    it('draws a path in over its own duration, stilled for reduced motion', () => {
      const css = toCss();
      const journey = tokens.duration.journey;
      expect(css).toContain(`--uf-duration-journey: ${journey};`);
      const reduced = css.slice(css.indexOf('prefers-reduced-motion'));
      expect(reduced).toContain('--uf-duration-journey: 0ms;');
    });
  });
});
