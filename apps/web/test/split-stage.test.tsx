// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/react';
import { en } from '@universityflow/content';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The split stage (docs/design/README.md): the front door and sign-in. Its landmarks and headings,
 * tiles that are real links named by their captions, the wordmark read once (as the headline),
 * and an entrance that reduced motion switches off.
 */

vi.mock('@/lib/server/session', () => ({ currentStudent: async () => null }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`redirect ${to}`);
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const FrontDoor = (await import('../app/page')).default;
const SignIn = (await import('../app/sign-in/page')).default;

afterEach(cleanup);

describe('the front door', () => {
  it('has one main landmark and the headline as its only h1', async () => {
    render(await FrontDoor());
    expect(screen.getAllByRole('main')).toHaveLength(1);
    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1.map((h) => h.textContent)).toEqual([en.home.headline]);
  });

  it('shows the product facts as a list, each value with its label', async () => {
    render(await FrontDoor());
    const facts = screen.getByRole('region', { name: en.home.numbersLabel });
    const items = within(facts).getAllByRole('listitem');
    expect(items.map((i) => i.textContent)).toEqual(
      en.home.numbers.map((n) => `${n.value}${n.label}`),
    );
  });

  it('makes every tile one link to sign-in, captioned by its feature, with its icon hidden', async () => {
    const { container } = render(await FrontDoor());
    const tiles = screen.getByRole('region', { name: en.home.tilesTitle });
    const links = within(tiles).getAllByRole('link');
    expect(links.map((l) => l.querySelector('.uf-caps')?.textContent)).toEqual(
      Object.values(en.home.tiles),
    );
    for (const link of links) expect(link.getAttribute('href')).toBe('/sign-in');
    for (const svg of container.querySelectorAll('svg')) {
      expect(svg.getAttribute('aria-hidden')).toBe('true');
    }
  });

  // A3-27 (2.4.4): four links named "Your results", "Funding"… that all opened sign-in. Each keeps
  // its caption (the label in its name, 2.5.3) and says where it goes, as the bar's button does.
  it('names each tile for where it leads, not only for the feature it shows (A3-27)', async () => {
    render(await FrontDoor());
    const tiles = screen.getByRole('region', { name: en.home.tilesTitle });
    expect(
      within(tiles)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(Object.values(en.home.tiles).map((caption) => `${caption}: ${en.home.start}`));
  });

  // A2-25: a tile lifted on hover even under reduced motion, where it jumped instead.
  it('lifts a tile on hover by the tokens’ distance, and never under reduced motion (A2-25)', async () => {
    const { container } = render(await FrontDoor());
    const boxes = container.querySelectorAll(
      '[aria-labelledby="stage-tiles"] li a > span:first-child',
    );
    expect(boxes).toHaveLength(4);
    for (const box of boxes) {
      expect(box.className).toContain('group-hover:-translate-y-(--uf-motion-lift)');
      expect(box.className).toContain('motion-reduce:group-hover:translate-y-0');
    }
  });

  it('draws the wordmark twice for the crossing, both hidden: a screen reader hears the headline once', async () => {
    render(await FrontDoor());
    const wordmark = screen.getByTestId('wordmark');
    expect(wordmark.getAttribute('aria-hidden')).toBe('true');
    expect(wordmark.querySelectorAll('.uf-wordmark-word')).toHaveLength(2);
    expect(within(wordmark).getAllByText(en.home.wordmark)).toHaveLength(2);
    // Nothing outside the decoration repeats the wordmark's own words as a heading or text.
    expect(screen.queryByRole('heading', { name: en.home.wordmark })).toBeNull();
    for (const el of screen.getAllByText(en.home.strapline))
      expect(wordmark.contains(el)).toBe(true);
  });

  it('shows the three quiet words and the bar with both ways in', async () => {
    render(await FrontDoor());
    for (const word of en.home.quietWords) expect(screen.getByText(word)).toBeTruthy();
    const bar = screen.getByRole('region', { name: en.home.barLabel });
    expect(within(bar).getByRole('link', { name: en.home.start }).getAttribute('href')).toBe(
      '/sign-in',
    );
    expect(within(bar).getByRole('link', { name: en.home.signIn })).toBeTruthy();
    expect(within(bar).getByText(en.home.barHere)).toBeTruthy();
  });

  it('marks the entrance with the classes reduced motion switches off', async () => {
    const { container } = render(await FrontDoor());
    expect(container.querySelector('.uf-headline.uf-rise')).not.toBeNull();
    expect(container.querySelectorAll('.uf-fade-rise').length).toBeGreaterThan(0);
  });

  it('shows the journey in pictures, bottom to top, as decoration with nothing to read', async () => {
    render(await FrontDoor());
    const people = screen.getByTestId('stage-people');
    expect(people.getAttribute('aria-hidden')).toBe('true');
    const pictures = [...people.querySelectorAll('img')];
    expect(pictures.map((p) => p.getAttribute('src'))).toEqual([
      '/stage/grade-10.webp',
      '/stage/university.webp',
      '/stage/graduation.webp',
    ]);
    for (const p of pictures) {
      expect(p.getAttribute('alt')).toBe('');
      // Its entrance is the stage's own, which reduced motion switches off.
      expect(p.classList.contains('uf-fade-rise')).toBe(true);
      // Width and height set, so the page doesn't jump when a picture arrives.
      expect(Number(p.getAttribute('width'))).toBeGreaterThan(0);
      expect(Number(p.getAttribute('height'))).toBeGreaterThan(0);
      const file = resolve(__dirname, '../public', `.${p.getAttribute('src')}`);
      expect(readFileSync(file).byteLength).toBeGreaterThan(0);
      // Light to load: never fetched on a phone (hidden there), behind the words elsewhere, and
      // only as large as the screen needs, from copies that exist.
      expect(p.getAttribute('loading')).toBe('lazy');
      expect(p.getAttribute('fetchpriority')).toBe('low');
      expect(p.getAttribute('sizes')).toBeTruthy();
      const copies = (p.getAttribute('srcset') ?? '').split(',').map((c) => c.trim().split(' '));
      expect(copies.map(([, w]) => w)).toEqual(['360w', '540w', '720w']);
      for (const [url] of copies) {
        expect(readFileSync(resolve(__dirname, '../public', `.${url}`)).byteLength).toBeGreaterThan(
          0,
        );
      }
    }
  });
});

describe('sign-in on the stage', () => {
  it('keeps the form’s heading as the only h1, the headline as text, the form in a glass card', async () => {
    const { container } = render(await SignIn());
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual([
      en.auth.title,
    ]);
    expect(screen.getByText(en.home.headline).tagName).toBe('P');
    const card = container.querySelector('.uf-glass-card');
    expect(card?.querySelector('form')).not.toBeNull();
    expect(screen.getByLabelText(en.auth.phoneLabel)).toBeTruthy();
    // The journey's pictures are the front door's alone.
    expect(screen.queryByTestId('stage-people')).toBeNull();
  });
});

describe('the stage’s CSS (globals.css)', () => {
  const css = readFileSync(resolve(__dirname, '../app/globals.css'), 'utf8');

  it('switches the entrance off under reduced motion', () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.uf-rise,\s*\.uf-fade-rise \{\s*animation: none;/,
    );
  });

  it('has a solid fallback without backdrop-filter, and a visible edge in forced colours', () => {
    expect(css).toMatch(/@supports not \(\(backdrop-filter: blur\(1px\)\)/);
    expect(css).toMatch(
      /@media \(forced-colors: active\)[\s\S]*border: var\(--uf-border-thin\) solid CanvasText/,
    );
  });

  it('turns the focus ring light on the dark glass, and back to blue on the glass card', () => {
    expect(css).toMatch(
      /\.uf-on-glass :focus-visible \{\s*outline-color: var\(--uf-color-on-glass\);/,
    );
    expect(css).toMatch(
      /\.uf-glass-card :focus-visible \{\s*outline-color: var\(--uf-color-focus\);/,
    );
    // The card's rule comes after, so it wins inside a card on the glass.
    expect(css.indexOf('.uf-glass-card :focus-visible')).toBeGreaterThan(
      css.indexOf('.uf-on-glass :focus-visible'),
    );
  });
});
