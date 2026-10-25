// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DemoBanner } from '../components/demo-banner';
import { SiteFooter } from '../components/site-footer';
import { Card, Page, PublicPage, titleLook } from '../components/ui';

/**
 * The public pages and the shell, polished for consistency (polish-shell, 2026-10-24; the owner:
 * "consistency in the application and things are aligned well"). Before: the pages without the
 * sidebar each had their own gutter (16 or 20px), top space (32, 40 or 48px), brand line (a pink
 * paragraph, an ink link, or none), title size (30px or 36px at the same width), gap under the
 * title (12, 16, 20, 24 or 32px) and hand-made cards; the guardian's consent box was a raw
 * checkbox squeezed to 14px wide at 360px. Now `PublicPage` owns the frame, `Page` the title and
 * its gap, `Card` every card, `Checkbox` every box. Synthetic text throughout.
 */

afterEach(cleanup);

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(WEB, path), 'utf8');

/** The public routes' files (polish-shell's patch). */
const PUBLIC = [
  'app/help/page.tsx',
  'app/privacy/page.tsx',
  'app/consent/[token]/page.tsx',
  'app/consent/[token]/consent-form.tsx',
  'app/onboarding/page.tsx',
  'app/onboarding/steps.tsx',
  'app/demo/page.tsx',
  'app/demo/guide/page.tsx',
  'app/demo/new-learner/page.tsx',
  'app/demo/sign-up/page.tsx',
  'app/demo/sign-up/signup-form.tsx',
  'app/sign-in/page.tsx',
  'components/demo-picker.tsx',
];

const lines = (file: string) =>
  read(file)
    .split('\n')
    .map((line, i) => ({ at: `${file}:${i + 1}`, line }));

/** A frame made by hand: a `<main>` of the page's own (the split stage has its own, by design). */
const HANDMADE_FRAME = /<main\b/;
/** A title made by hand: an `<h1>` outside `Page` (the sign-in card's heading is the form's own). */
const HANDMADE_TITLE = /<h1\b/;
/** A card made by hand: a rounded block with an edge and a ground of its own. */
const HANDMADE_CARD = /\brounded-lg\b[^"'`]*\bborder\b[^"'`]*\b(?:bg-surface|bg-warning-soft)\b/;
/** A raw checkbox, not `Checkbox` (brand colour, its size kept in a narrow row). */
const RAW_CHECKBOX = /type="checkbox"/;

function offending(re: RegExp): string[] {
  return PUBLIC.flatMap(lines)
    .filter(({ line }) => re.test(line))
    .map(({ at }) => at);
}

describe('the public pages share one frame', () => {
  it('no public page makes its own <main>: PublicPage (or the split stage) is the frame', () => {
    expect(offending(HANDMADE_FRAME)).toEqual([]);
  });

  it('every public title goes through Page, so its size and the gap under it are the same', () => {
    expect(offending(HANDMADE_TITLE)).toEqual([]);
  });

  it('every card is Card', () => {
    expect(offending(HANDMADE_CARD)).toEqual([]);
  });

  it('every checkbox is Checkbox', () => {
    expect(offending(RAW_CHECKBOX)).toEqual([]);
  });

  it('the checks are proven on broken examples', () => {
    expect(HANDMADE_FRAME.test('<main id="main" className="mx-auto max-w-prose px-5 py-10">')).toBe(
      true,
    );
    expect(HANDMADE_TITLE.test('<h1 className="text-2xl">{t.title}</h1>')).toBe(true);
    expect(
      HANDMADE_CARD.test(
        'className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5"',
      ),
    ).toBe(true);
    expect(
      HANDMADE_CARD.test(
        'className="rounded-lg border border-warning bg-warning-soft p-5 text-ink"',
      ),
    ).toBe(true);
    expect(HANDMADE_CARD.test('className="rounded-lg"')).toBe(false);
    expect(RAW_CHECKBOX.test('<input type="checkbox" className="mt-1 size-5" />')).toBe(true);
  });
});

describe('PublicPage', () => {
  it('is the main landmark: one gutter, one top space, the Page gap, centred at a token width', () => {
    render(
      <PublicPage width="wide" brand={{ name: 'Synthetic app', href: '/' }}>
        <p>A part</p>
      </PublicPage>,
    );
    const main = screen.getByRole('main');
    expect(main.id).toBe('main');
    for (const c of ['mx-auto', 'max-w-wide', 'px-4', 'sm:px-6', 'py-8', 'sm:py-12', 'gap-6']) {
      expect(main.className.split(' ')).toContain(c);
    }
    // The brand line: ink, like the sidebar's and the stage's, never the link colour on plain text.
    const brand = screen.getByRole('link', { name: 'Synthetic app' });
    expect(brand.getAttribute('href')).toBe('/');
    expect(brand.className).toContain('text-ink');
    expect(brand.className).toContain('no-underline');
  });

  it('defaults to the reading width, and a brand without an address is plain ink text', () => {
    render(
      <PublicPage brand={{ name: 'Synthetic app' }}>
        <p>A part</p>
      </PublicPage>,
    );
    expect(screen.getByRole('main').className.split(' ')).toContain('max-w-prose');
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Synthetic app').className).toContain('text-ink');
  });
});

describe('Page and Card, added to (nothing renamed)', () => {
  it('Page can give its title an id, for a section labelled by it; the title has the one look', () => {
    render(
      <section aria-labelledby="synthetic-title">
        <Page title="A synthetic title" titleId="synthetic-title">
          <p>A part</p>
        </Page>
      </section>,
    );
    const heading = screen.getByRole('heading', { level: 1, name: 'A synthetic title' });
    expect(heading.id).toBe('synthetic-title');
    expect(heading.className).toBe(titleLook);
    expect(screen.getByRole('region', { name: 'A synthetic title' })).toBeTruthy();
  });

  it('Card has a warning tone for a notice with a heading, with the same radius and padding', () => {
    render(
      <Card tone="warning" aria-labelledby="w">
        <h2 id="w">Synthetic notice</h2>
      </Card>,
    );
    const card = screen.getByRole('region', { name: 'Synthetic notice' });
    for (const c of ['rounded-lg', 'border', 'border-warning', 'bg-warning-soft', 'p-5']) {
      expect(card.className.split(' ')).toContain(c);
    }
    expect(card.className).not.toContain('bg-surface');
  });
});

describe('the footer lines up with the page above it', () => {
  it('takes the page’s width, and the same gutter', () => {
    const { container } = render(<SiteFooter width="prose" />);
    const inner = container.querySelector('footer > div');
    expect(inner?.className.split(' ')).toContain('max-w-prose');
    expect(inner?.className.split(' ')).toContain('mx-auto');
    cleanup();
    const wide = render(<SiteFooter />).container.querySelector('footer > div');
    expect(wide?.className.split(' ')).toContain('max-w-page');
  });

  it('the gutter sits inside the width, as PublicPage’s does, so both edges line up', () => {
    // The footer used to pad outside its width box: at 1280px its text started 24px left of a
    // wide page's (128px against 152px), and at 360px 8px right of a 16px-gutter page's.
    const inner = render(<SiteFooter width="wide" />).container.querySelector('footer > div');
    for (const c of ['px-4', 'sm:px-6', 'max-w-wide']) {
      expect(inner?.className.split(' ')).toContain(c);
    }
    const css = read('app/globals.css');
    const rules = [...css.matchAll(/\.uf-site-footer\s*\{([^}]*)\}/g)].map((m) => m[1] ?? '');
    expect(rules.join('\n')).not.toMatch(/padding-inline|padding:/);
  });
});

describe('one transition everywhere', () => {
  const css = read('app/globals.css');

  it('every hover eases by the tokens, on the properties a state changes, in the base layer', () => {
    const base = /@layer base\s*\{\s*\*,\s*::before,\s*::after\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(base).toContain('transition-duration: var(--uf-duration-normal);');
    expect(base).toContain('transition-timing-function: var(--uf-easing-in-out);');
    expect(base).toMatch(/transition-property:[^;]*background-color[^;]*border-color[^;]*;/);
    expect(base).not.toMatch(/transition-property:\s*all/);
    // No unlayered `*` rule: it beat every component's own duration and easing.
    expect(css).not.toMatch(/(^|\n)\*\s*\{\s*transition/);
  });

  it('Tailwind’s transition utilities take the same tokens (0ms under reduced motion)', () => {
    const theme = /@theme inline\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(theme).toContain('--default-transition-duration: var(--uf-duration-normal);');
    expect(theme).toContain('--default-transition-timing-function: var(--uf-easing-in-out);');
  });
});

describe('the shell', () => {
  it('the demo banner’s two actions look alike (one was ink, the other the link pink)', () => {
    render(<DemoBanner demo learner mainUrl={null} logos={false} />);
    const link = screen.getByRole('link');
    const button = screen.getByRole('button');
    expect(link.className).toBe(button.className);
    expect(link.className).toContain('text-ink');
  });

  it('the sidebar’s name starts where its links’ icons and group names do (28px in)', () => {
    const css = read('app/globals.css');
    const head = /@media \(min-width: 64rem\)\s*\{\s*\.uf-sidebar-head\s*\{([^}]*)\}/.exec(
      css,
    )?.[1];
    // The nav's own inset (space-3) plus a link's (space-4): the brand was 32px in, the rest 28.
    expect(head).toContain('padding-inline: calc(var(--uf-space-3) + var(--uf-space-4));');
  });

  it('a disclosure opens smoothly: the phone menu and the preview notice reveal by the tokens', () => {
    const css = read('app/globals.css');
    const reveal = /\.uf-reveal\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(reveal).toContain(
      'animation: uf-reveal var(--uf-duration-normal) var(--uf-easing-enter)',
    );
    expect(css).toMatch(/@keyframes uf-reveal\s*\{\s*from\s*\{\s*opacity: 0;/);
    // Off under reduced motion (on top of the tokens' 0ms).
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.uf-reveal\s*\{\s*animation: none;/,
    );
    const nav = read('app/(app)/nav.tsx');
    expect(nav).toMatch(/uf-nav-panel uf-reveal/);
    expect(read('components/preview-notice.tsx')).toContain('uf-reveal');
  });
});
