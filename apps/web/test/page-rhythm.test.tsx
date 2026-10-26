// @vitest-environment jsdom

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EmptyState, Page, StatusLine } from '../components/ui';

/**
 * One rhythm on every titled page (docs/design/README.md, "One rhythm"; the owner's review,
 * 2026-10-20): the gap under the title was 24, 48 or 72px depending on the page (a header margin
 * stacked on each page's own gap, and an empty status line taking a gap of its own), and an empty
 * page said so four different ways (a bare sentence, a sentence and a link, a loose sentence
 * above a card). Now `Page` owns the title and the gap, `StatusLine` takes no space while silent,
 * and `EmptyState` is the one way to say "nothing yet". Synthetic text throughout.
 */

afterEach(cleanup);

// A string, not `new URL(...)`: under jsdom, `URL` is jsdom's and `fileURLToPath` refuses it.
const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'app');

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(dir, entry.name))
      : entry.name.endsWith('.tsx')
        ? [join(dir, entry.name)]
        : [],
  );
}

const pages = files(APP).map((file) => ({
  name: relative(APP, file).replaceAll('\\', '/'),
  lines: readFileSync(file, 'utf8').split('\n'),
}));

/** A page title made by hand: `PageHeader` without `Page` (the home and chat have heroes of their own). */
const HANDMADE_TITLE = /<PageHeader\b/;
/** Content keys that say a page or a list has nothing yet. */
const EMPTY_COPY = /\.(empty|noReport|memoryEmpty|noGoal)\b/;
/** Where such a sentence may sit: the empty state, or a muted line inside a card, as on the home. */
const EMPTY_LOOK = /<EmptyState\b|text-muted/;
/** A status line that is always in the page (not one rendered only once it has something to say). */
const STANDING_STATUS = /^\s*<p\b[^>]*role="status"/;

function offending(test: (line: string, i: number, lines: string[]) => boolean): string[] {
  return pages.flatMap(({ name, lines }) =>
    lines.flatMap((line, i) => (test(line, i, lines) ? [`${name}:${i + 1}`] : [])),
  );
}

describe('one rhythm for every titled page', () => {
  it('finds the pages', () => {
    expect(pages.length).toBeGreaterThan(30);
    expect(offending((line) => /<Page\b/.test(line)).length).toBeGreaterThanOrEqual(15);
  });

  it('every title goes through Page, so the gap under it is the same everywhere', () => {
    expect(offending((line) => HANDMADE_TITLE.test(line))).toEqual([]);
  });

  it('a status line on a page takes no space while it is silent', () => {
    const files = new Set(
      pages.filter(({ lines }) => lines.some((l) => /<Page\b/.test(l))).map((p) => p.name),
    );
    const standing = offending(
      (line) => STANDING_STATUS.test(line) && !/sr-only/.test(line),
    ).filter((at) => files.has(at.split(':')[0] ?? ''));
    expect(standing).toEqual([]);
  });

  it('"nothing yet" is said one way: the empty state, or a muted line in a card', () => {
    expect(
      offending(
        (line, i, lines) =>
          EMPTY_COPY.test(line) && !EMPTY_LOOK.test(line) && !EMPTY_LOOK.test(lines[i - 1] ?? ''),
      ),
    ).toEqual([]);
  });

  it('the checks are proven on broken examples', () => {
    expect(HANDMADE_TITLE.test('      <PageHeader title={t.title} lead={t.lead} />')).toBe(true);
    expect(STANDING_STATUS.test('      <p role="status" className="font-medium">')).toBe(true);
    expect(
      STANDING_STATUS.test('          {message ? <p role="status">{message}</p> : null}'),
    ).toBe(false);
    const bare = '            <p>{t.empty}</p>';
    expect(EMPTY_COPY.test(bare) && !EMPTY_LOOK.test(bare)).toBe(true);
    expect(EMPTY_LOOK.test('            <EmptyState>{t.empty}</EmptyState>')).toBe(true);
  });
});

describe('the primitives', () => {
  it('Page: the title, then every part one gap apart (no margin under the header)', () => {
    render(
      <Page title="A title" lead="A lead">
        <p>A part</p>
      </Page>,
    );
    const heading = screen.getByRole('heading', { level: 1, name: 'A title' });
    const header = heading.closest('header');
    expect(header?.className).not.toMatch(/\bm[by]?-/);
    expect(header?.parentElement?.className).toContain('gap-6');
    expect(screen.getByText('A part').parentElement).toBe(header?.parentElement);
  });

  it('StatusLine: a live region that takes no space while it is empty', () => {
    render(<StatusLine>{''}</StatusLine>);
    const status = screen.getByRole('status');
    expect(status.className).toContain('empty:sr-only');
    expect(status.textContent).toBe('');
  });

  it('EmptyState: a card with one muted sentence and at most one outline button', () => {
    render(
      <EmptyState action={{ href: '/somewhere', label: 'Go somewhere' }}>Nothing yet.</EmptyState>,
    );
    const sentence = screen.getByText('Nothing yet.');
    expect(sentence.className).toContain('text-muted');
    const card = sentence.parentElement;
    // Card's fill and edge are `.uf-card`'s (RT-04, test/card-separation.test.tsx).
    expect(card?.className).toMatch(/uf-card rounded-lg border/);
    const link = screen.getByRole('link', { name: 'Go somewhere' });
    expect(link.getAttribute('href')).toBe('/somewhere');
    expect(link.className).toContain('border-line-strong');
    expect(card?.querySelectorAll('a, button')).toHaveLength(1);
  });

  it('EmptyState without an action: the sentence alone, when the next step is already on the page', () => {
    render(<EmptyState>Nothing yet.</EmptyState>);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
