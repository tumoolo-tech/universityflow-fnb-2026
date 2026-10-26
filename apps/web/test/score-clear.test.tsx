// @vitest-environment jsdom

import { cleanup, render, within } from '@testing-library/react';
import { assessOne, type SubjectMark } from '@universityflow/admissions';
import { catalogueView } from '@universityflow/catalogue';
import { en } from '@universityflow/content';
import { afterEach, describe, expect, it } from 'vitest';
import { ProgrammeCard } from '../components/programme-card';
import { ScoreBreakdown } from '../components/score-breakdown';

/**
 * RT-03 (the owner's run-through, 2026-10-25): "Your APS: 52 of 56 · Needs APS 38" read as if
 * something were still needed (the owner worked out 56 − 52 = 4). The card now says whose scale
 * it is, that 56 is the most there is, and how far above (or below) the course's minimum the
 * learner is; "Why this score?" opens the line-by-line breakdown on the course's own page.
 */

afterEach(cleanup);

const VIEW = catalogueView(new Date('2026-10-13T00:00:00Z'), { includeDrafts: true });
const report = (marks: ReadonlyArray<SubjectMark>) => ({ kind: 'grade-11-final' as const, marks });
const STRONG = report([
  { subject: 'english-hl', percent: 85 },
  { subject: 'mathematics', percent: 88 },
  { subject: 'accounting', percent: 82 },
  { subject: 'physical-sciences', percent: 78 },
  { subject: 'life-sciences', percent: 80 },
  { subject: 'geography', percent: 75 },
  { subject: 'life-orientation', percent: 90 },
]);
const WEAK = report([
  { subject: 'english-hl', percent: 52 },
  { subject: 'mathematics', percent: 50 },
  { subject: 'accounting', percent: 48 },
  { subject: 'physical-sciences', percent: 45 },
  { subject: 'life-sciences', percent: 50 },
  { subject: 'geography', percent: 47 },
  { subject: 'life-orientation', percent: 60 },
]);

function witsBcom(marks: typeof STRONG) {
  const found = assessOne(VIEW, 'wits-bcom', marks);
  if (!found) throw new Error('wits-bcom missing from the catalogue');
  return found.result;
}

function card(result: ReturnType<typeof witsBcom>) {
  const { container } = render(
    <ul>
      <ProgrammeCard result={result} />
    </ul>,
  );
  // The card itself, not the list of what to improve inside it.
  return within(container.querySelector('ul > li') as HTMLElement);
}

describe('the score on a results card (RT-03)', () => {
  it('names the university’s scale, says the most there is, and how far above the minimum', () => {
    const result = witsBcom(STRONG);
    const required = result.requiredScore ?? 0;
    expect(result.score).toBeGreaterThan(required);
    const view = card(result);
    expect(
      view.getByText(en.results.scoreOn('Wits', 'APS', result.score, result.scoreMaximum)),
    ).toBeTruthy();
    expect(
      view.getByText(
        `${en.results.asksAtLeast(required)} · ${en.results.above(result.score - required)}`,
      ),
    ).toBeTruthy();
    expect(view.queryByText(/of 56/)).toBeNull();
    expect(en.results.scoreOn('Wits', 'APS', 52, 56)).toBe('Your Wits APS: 52 (the most is 56)');
    expect(en.results.above(14)).toBe('you’re 14 above');
    expect(en.results.above(0)).toBe('you meet it exactly');
  });

  it('below the minimum, says what the course asks for and leaves the gap to the list', () => {
    const result = witsBcom(WEAK);
    expect(result.scoreGap).toBeGreaterThan(0);
    const view = card(result);
    expect(view.getByText(en.results.asksAtLeast(result.requiredScore ?? 0))).toBeTruthy();
    expect(view.getByText(en.results.pointsShort(result.scoreGap, 'APS'))).toBeTruthy();
    expect(view.queryByText(/above/)).toBeNull();
  });

  it('links "Why this score?" to the breakdown on the course’s own page', () => {
    const result = witsBcom(STRONG);
    const link = card(result).getByRole('link', { name: `${en.results.details}: ${result.name}` });
    expect(link.getAttribute('href')).toBe('/results/what-i-need/wits-bcom#why');
  });
});

describe('the breakdown on the course’s page (RT-03)', () => {
  it('shows each subject’s points and the total, under a heading the card links to', () => {
    const detail = assessOne(VIEW, 'wits-bcom', STRONG);
    if (!detail) throw new Error('wits-bcom missing');
    const { container } = render(<ScoreBreakdown breakdown={detail.breakdown} anchor />);
    const section = container.querySelector('section#why');
    expect(section).toBeTruthy();
    const scope = within(section as HTMLElement);
    expect(scope.getByRole('heading', { name: en.breakdown.title })).toBeTruthy();
    expect(scope.getByText('Mathematics')).toBeTruthy();
    expect(scope.getByText(`${detail.breakdown.total} / ${detail.breakdown.maximum}`)).toBeTruthy();
  });
});
