// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/react';
import { type AgentOffer, offerCard } from '@universityflow/agent';
import { catalogueView } from '@universityflow/catalogue';
import type { SubjectsResponse } from '@universityflow/ui';
import { afterEach, describe, expect, it } from 'vitest';
import { SubjectsView } from '../app/(app)/subjects/subjects-view';
import { OfferCard } from '../components/offers';

/**
 * The pictures on more cards (cards9): each subject on My subjects and each offer on My offers
 * gets the course cards' picture layer (test/course-card-art.test.tsx): decorative, lazy, under
 * the tokens' scrim, behind the words.
 */

afterEach(cleanup);

const TODAY = new Date('2026-10-13T08:00:00Z');
const VIEW = catalogueView(TODAY, { includeDrafts: true });

/** Synthetic (hard rule 4). */
const OFFER: AgentOffer = {
  id: '00000000-0000-4000-8000-000000000001',
  universityId: 'uj',
  programmeId: 'uj-beng-civil',
  kind: 'provisional',
  status: 'held',
  source: 'letter',
  replyBy: '2026-10-20',
  conditions: ['Synthetic condition, as quoted.'],
  reminder: null,
};

const SUBJECTS: SubjectsResponse = {
  report: { kind: 'grade-10-final' },
  subjects: [
    { id: 'mathematics', name: 'Mathematics' },
    { id: 'english-hl', name: 'English Home Language' },
    { id: 'history', name: 'History' },
  ],
  doors: null,
};
// The verdict card shows the subjects only with doors; `unknown` is the smallest that does.
const withDoors: SubjectsResponse = {
  ...SUBJECTS,
  doors: {
    status: 'unknown',
    checked: 0,
    open: 0,
    closed: 0,
    draft: false,
    byUniversity: [],
    groups: [],
    higherBar: [],
    goal: null,
    swap: { drop: [], take: [] },
    whatIf: null,
  },
};

/** The two layers a picture card carries, in order, as test/course-card-art.test.tsx holds them. */
function expectPictureLayer(card: Element, src: string) {
  expect(card.className).toContain('uf-course-card');
  const layers = card.querySelectorAll(':scope > [aria-hidden="true"]');
  expect([...layers].map((l) => l.className)).toEqual(['uf-course-art', 'uf-course-art-scrim']);
  const img = card.querySelector('.uf-course-art picture img');
  expect(img?.getAttribute('src')).toBe(src);
  expect(img?.getAttribute('alt')).toBe('');
  expect(img?.getAttribute('loading')).toBe('lazy');
  expect(img?.getAttribute('decoding')).toBe('async');
  expect(img?.getAttribute('fetchpriority')).toBe('low');
  expect(img?.getAttribute('width')).toBe('800');
  expect(img?.getAttribute('height')).toBe('400');
  const avif = card.querySelector('.uf-course-art picture source[type="image/avif"]');
  expect(avif?.getAttribute('srcset')).toContain(src.replace('800.webp', '400.avif 400w'));
  // The words start below the empty band at the top.
  expect(
    card.classList.contains('uf-course-card-band') ||
      card.querySelector('.uf-course-card-band') !== null,
  ).toBe(true);
}

describe('My subjects: a picture on every subject', () => {
  it('shows each subject’s picture behind its name, the default for one awaiting a picture', () => {
    render(<SubjectsView data={withDoors} />);
    const items = within(screen.getByTestId('subjects-list')).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      'Mathematics',
      'English Home Language',
      'History',
    ]);
    const [maths, english, history] = items;
    if (!maths || !english || !history) throw new Error('three subjects expected');
    expectPictureLayer(maths, '/subject-art/mathematics-800.webp');
    expectPictureLayer(english, '/course-art/general-800.webp');
    expectPictureLayer(history, '/course-art/general-800.webp');
    expect(maths.className).toContain('uf-subject-tile');
  });

  it('is decoration: no image a screen reader finds, the name still the chip’s', () => {
    render(<SubjectsView data={withDoors} />);
    expect(screen.queryByRole('img')).toBeNull();
    for (const li of within(screen.getByTestId('subjects-list')).getAllByRole('listitem')) {
      expect((li.firstElementChild as HTMLElement).className).toMatch(/\bbg-sunk\b/);
    }
  });
});

describe('My offers: the course’s picture on every offer', () => {
  it('shows the offer’s course field picture, by programme', () => {
    const { container } = render(<OfferCard artifact={offerCard(VIEW, OFFER, null, TODAY)} />);
    const card = container.querySelector('article');
    if (!card) throw new Error('no card');
    expectPictureLayer(card, '/course-art/engineering-800.webp');
    expect(screen.queryByRole('img')).toBeNull();
    // The heading keeps its name and sits below the band, which is not on the heading itself: its
    // focus ring (it takes focus after Accept or Decline) stays on the scrim, off the bare picture.
    const heading = screen.getByRole('heading', {
      name: 'Bachelor of Engineering in Civil Engineering',
    });
    expect(heading.className).not.toContain('uf-course-card-band');
    expect(heading.parentElement?.className).toContain('uf-course-card-band');
  });

  it('shows the neutral picture when the catalogue no longer holds the course', () => {
    const artifact = { ...offerCard(VIEW, OFFER, null, TODAY), programme: null };
    const { container } = render(<OfferCard artifact={artifact} />);
    const card = container.querySelector('article');
    if (!card) throw new Error('no card');
    expectPictureLayer(card, '/course-art/general-800.webp');
  });
});

describe('the subject tile’s CSS (globals.css)', () => {
  const CSS = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');
  const rule = (selector: string) =>
    new RegExp(`${selector.replace(/[.-]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(CSS)?.[1] ??
    '';

  it('fills the small tile with its picture and the same scrim, and nothing moves', () => {
    const body = rule('.uf-subject-tile .uf-course-art,\n  .uf-subject-tile .uf-course-art-scrim');
    expect(body).toMatch(/block-size:\s*100%/);
    expect(body).not.toMatch(/animation|transition|background/);
  });
});
