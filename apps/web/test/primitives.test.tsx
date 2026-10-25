// @vitest-environment jsdom

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ButtonLink, buttonLook, Checkbox, FileButton } from '../components/ui';

/**
 * The shared primitives (A2-18): one Button look, reached through `Button`, `ButtonLink` and
 * `FileButton`, so a fix to it reaches every copy. Synthetic labels throughout.
 */

afterEach(cleanup);

// A string, not `new URL(...)`: under jsdom, `URL` is jsdom's and `fileURLToPath` refuses it.
const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(tsx|ts)$/.test(entry.name) ? [path] : [];
  });
}

/** Every quoted or template string literal in a file. */
const literals = (text: string) =>
  [...text.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n])*?)\1/g)].map((m) => m[2] ?? '');

/** The primary button's signature: a rounded block in the brand colour. */
const primaryLook = (s: string) => /\brounded-md\b/.test(s) && /(^|\s)bg-brand(\s|$)/.test(s);

describe('one primary-button look (A2-18)', () => {
  it('only components/ui.tsx spells out the primary button; everything else uses the primitives', () => {
    const offenders = ['app', 'components']
      .flatMap((dir) => sources(join(WEB, dir)))
      .filter((file) => relative(WEB, file).split(sep).join('/') !== 'components/ui.tsx')
      .filter((file) => literals(readFileSync(file, 'utf8')).some(primaryLook))
      .map((file) => relative(WEB, file).split(sep).join('/'));
    expect(offenders).toEqual([]);
  });

  it('the guard sees a hand-rolled copy (proven on a broken example)', () => {
    const broken = `<a className="inline-flex min-h-11 items-center rounded-md bg-brand px-4">x</a>`;
    expect(literals(broken).some(primaryLook)).toBe(true);
    expect(literals(`cx('rounded-lg', on ? 'bg-brand text-on-brand' : '')`).some(primaryLook)).toBe(
      false,
    );
  });
});

/**
 * The outline button's signature (A2-22): a rounded block with a thick brand or neutral edge and
 * a button's side padding (`px-4`, `px-5`). A field shares the edge with a field's padding
 * (`px-3`); a pill (`rounded-full`) or a card (`rounded-lg`) with that edge is another shape.
 */
const outlineLook = (s: string) =>
  /\brounded-md\b/.test(s) &&
  /(^|\s)border-thick(\s|$)/.test(s) &&
  /(^|\s)border-(brand|line-strong)(\s|$)/.test(s) &&
  /(^|\s)px-[45](\s|$)/.test(s);

describe('one outline-button look (A2-22)', () => {
  it('only components/ui.tsx spells out the outline button; everything else uses the primitives', () => {
    const offenders = ['app', 'components']
      .flatMap((dir) => sources(join(WEB, dir)))
      .filter((file) => relative(WEB, file).split(sep).join('/') !== 'components/ui.tsx')
      .filter((file) => literals(readFileSync(file, 'utf8')).some(outlineLook))
      .map((file) => relative(WEB, file).split(sep).join('/'));
    expect(offenders).toEqual([]);
  });

  it('the guard sees both copies A2-22 found (proven on broken examples)', () => {
    // About me's "Download my data": the old mauve outline.
    expect(
      outlineLook(
        'inline-flex min-h-11 items-center rounded-md border-thick border-brand px-5 font-medium',
      ),
    ).toBe(true);
    // The home's "Start".
    expect(
      outlineLook(
        'inline-flex min-h-11 items-center gap-2 rounded-md border-thick border-line-strong px-4',
      ),
    ).toBe(true);
    // The ask bar is a pill, the composer a card: other shapes.
    expect(outlineLook('rounded-full border-thick border-line-strong px-5')).toBe(false);
    expect(outlineLook('rounded-lg border-thick border-line-strong p-2')).toBe(false);
    // A mark field on the confirm screen.
    expect(outlineLook('min-h-11 rounded-md border-thick border-line-strong bg-surface px-3')).toBe(
      false,
    );
  });

  it('buttonLook is exported for an <a> that must stay plain (a download from an API route)', () => {
    expect(buttonLook('secondary')).toContain('border-line-strong');
    expect(buttonLook('secondary')).toContain('text-ink');
    // Calm: the mauve edge only on hover, focus and a pressed or current state.
    expect(buttonLook('secondary')).not.toMatch(/(^|\s)border-brand(\s|$)/);
  });
});

describe('ButtonLink', () => {
  it('an app path is a link that looks like the primary button, without the link underline', () => {
    render(<ButtonLink href="/sign-in">Synthetic start</ButtonLink>);
    const link = screen.getByRole('link', { name: 'Synthetic start' });
    expect(link.getAttribute('href')).toBe('/sign-in');
    for (const c of ['min-h-11', 'rounded-md', 'px-5', 'bg-brand', 'hover:bg-brand-hover']) {
      expect(link.className).toContain(c);
    }
    expect(link.className).toContain('no-underline');
  });

  it('a tel: link keeps its href and accessible name', () => {
    render(
      <ButtonLink href="tel:0000000000" aria-label="Call 000 000 0000: Synthetic clinic">
        Call 000 000 0000
      </ButtonLink>,
    );
    const link = screen.getByRole('link', { name: 'Call 000 000 0000: Synthetic clinic' });
    expect(link.getAttribute('href')).toBe('tel:0000000000');
  });

  it('secondary looks like the secondary button: surface fill, a calm outline, the accent on hover', () => {
    render(
      <ButtonLink href="/campus?university=synthetic" variant="secondary">
        Synthetic choice
      </ButtonLink>,
    );
    const link = screen.getByRole('link', { name: 'Synthetic choice' });
    for (const c of [
      'border-thick',
      'border-line-strong',
      'hover:border-brand',
      'focus-visible:border-brand',
      'bg-surface',
      'hover:bg-sunk',
    ]) {
      expect(link.className).toContain(c);
    }
    expect(link.className).not.toMatch(/(^|\s)bg-brand(\s|$)/);
  });
});

describe('FileButton', () => {
  it('is a file input named by its label, which looks and hovers like the primary button', () => {
    render(<FileButton label="Choose a synthetic file" accept="application/pdf" />);
    const input = screen.getByLabelText('Choose a synthetic file') as HTMLInputElement;
    expect(input.type).toBe('file');
    expect(input.accept).toBe('application/pdf');
    const label = input.closest('label');
    expect(label).not.toBeNull();
    for (const c of ['min-h-11', 'rounded-md', 'px-5', 'bg-brand', 'hover:bg-brand-hover']) {
      expect(label?.className).toContain(c);
    }
  });

  it('looks busy while its input is disabled or aria-disabled, and keeps the input focusable when aria-disabled', () => {
    render(<FileButton label="Reading synthetic" aria-disabled />);
    const input = screen.getByLabelText('Reading synthetic') as HTMLInputElement;
    expect(input.getAttribute('aria-disabled')).toBe('true');
    expect(input.disabled).toBe(false);
    const label = input.closest('label');
    expect(label?.className).toContain('has-[[aria-disabled=true]]:opacity-60');
    expect(label?.className).toContain('has-[:disabled]:opacity-60');
    expect(label?.className).toContain('has-[:disabled]:cursor-not-allowed');
  });

  it('shows the focus ring with the global 2px offset when its hidden input has keyboard focus', () => {
    render(<FileButton label="Synthetic focus" />);
    const label = screen.getByLabelText('Synthetic focus').closest('label');
    expect(label?.className).toContain('has-[:focus-visible]:outline-focus');
    expect(label?.className).toContain('has-[:focus-visible]:outline-offset-2');
  });
});

describe('Checkbox', () => {
  it('a brand-coloured box at the size goals and messages use, keeping its size in a narrow row', () => {
    render(
      <label htmlFor="synthetic-step">
        <Checkbox id="synthetic-step" checked={false} onChange={() => undefined} />
        Synthetic step
      </label>,
    );
    const box = screen.getByRole('checkbox', { name: 'Synthetic step' });
    for (const c of ['accent-brand', 'size-5', 'shrink-0', 'aria-disabled:opacity-60']) {
      expect(box.className).toContain(c);
    }
  });
});
