// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { assessAll, type ProgrammeResult } from '@universityflow/admissions';
import { catalogueView } from '@universityflow/catalogue';
import { afterEach, describe, expect, it } from 'vitest';
import { ProgrammeCard } from '../components/programme-card';
import { courseField } from '../lib/course-art';

/**
 * The course card's picture (cards8): a decorative photo for the course's field across the card's
 * top, under the tokens' scrim, never in the way of a word, a screen reader or the first paint.
 */

afterEach(cleanup);

const VIEW = catalogueView(new Date('2026-10-13T00:00:00Z'), { includeDrafts: true });
const RESULTS = assessAll(VIEW, {
  kind: 'grade-11-final',
  marks: [
    { subject: 'english-hl', percent: 70 },
    { subject: 'isizulu-fal', percent: 70 },
    { subject: 'mathematics', percent: 65 },
    { subject: 'physical-sciences', percent: 60 },
    { subject: 'life-sciences', percent: 66 },
    { subject: 'history', percent: 72 },
    { subject: 'life-orientation', percent: 80 },
  ],
});
const ALL: ProgrammeResult[] = [
  ...RESULTS.qualifyNow,
  ...RESULTS.close,
  ...RESULTS.planB,
  ...RESULTS.onTrack,
];
const byField = (field: string) => {
  const found = ALL.find((r) => courseField(r) === field);
  if (!found) throw new Error(`no ${field} programme in the fixture`);
  return found;
};

function card(result: ProgrammeResult, bare = false) {
  const { container } = render(
    <ul>
      <ProgrammeCard result={result} bare={bare} />
    </ul>,
  );
  return container;
}

describe('the course card’s picture', () => {
  it.each(['arts', 'engineering', 'health', 'commerce'])(
    'shows the %s picture for its course',
    (field) => {
      const container = card(byField(field));
      const img = container.querySelector('img');
      expect(img?.getAttribute('src')).toBe(`/course-art/${field}-800.webp`);
      expect(img?.getAttribute('srcset')).toContain(`/course-art/${field}-400.webp 400w`);
      const avif = container.querySelector('picture source[type="image/avif"]');
      expect(avif?.getAttribute('srcset')).toContain(`/course-art/${field}-400.avif 400w`);
    },
  );

  it('is decoration: no alt text, hidden from screen readers, and no image role to find', () => {
    const container = card(byField('arts'));
    const img = container.querySelector('img');
    expect(img?.getAttribute('alt')).toBe('');
    expect(container.querySelector('.uf-course-art')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.uf-course-art picture img')).toBe(img);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('never holds up the first screen: lazy, async and low priority', () => {
    const img = card(byField('law')).querySelector('img');
    expect(img?.getAttribute('loading')).toBe('lazy');
    expect(img?.getAttribute('decoding')).toBe('async');
    expect(img?.getAttribute('fetchpriority')).toBe('low');
    // Its size is known, so nothing moves when it arrives.
    expect(img?.getAttribute('width')).toBe('800');
    expect(img?.getAttribute('height')).toBe('400');
  });

  it('lays the scrim over the picture and the words over both', () => {
    const container = card(byField('science'));
    const li = container.querySelector('li');
    expect(li?.className).toContain('uf-course-card');
    const layers = li?.querySelectorAll(':scope > [aria-hidden="true"]') ?? [];
    expect([...layers].map((l) => l.className)).toEqual(['uf-course-art', 'uf-course-art-scrim']);
    // The words start below the empty band at the top.
    expect(li?.querySelector('.uf-course-card-band')).not.toBeNull();
  });

  it('draws no picture inside another card (the Goal card)', () => {
    const container = card(byField('arts'), true);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.uf-course-art-scrim')).toBeNull();
  });
});

describe('the course card’s CSS (globals.css)', () => {
  const CSS = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');
  const rule = (selector: string) =>
    new RegExp(`${selector.replace(/[.-]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(CSS)?.[1] ??
    '';

  it('paints the scrim from the tokens: the light top over the band, the text scrim under the words', () => {
    const scrim = rule('.uf-course-art-scrim');
    expect(scrim).toContain('var(--uf-course-art-scrim-top) 0');
    expect(scrim).toContain('var(--uf-course-art-scrim-text) var(--uf-course-art-band)');
    expect(scrim).toContain('var(--uf-color-surface)');
    expect(rule('.uf-course-card-band')).toContain('var(--uf-course-art-band)');
  });

  it('keeps the picture still (no animation, no transition) and out of the way', () => {
    for (const selector of ['.uf-course-art', '.uf-course-art-scrim']) {
      const body = rule(selector);
      expect(body).not.toMatch(/animation|transition/);
      expect(body).toMatch(/pointer-events\s*:\s*none/);
    }
  });

  it('drops the picture in forced colours (high contrast)', () => {
    expect(CSS).toMatch(
      /@media \(forced-colors: active\)\s*\{\s*\.uf-course-art,\s*\.uf-course-art-scrim\s*\{\s*display:\s*none;/,
    );
  });
});
