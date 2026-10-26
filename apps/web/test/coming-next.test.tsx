// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import { en } from '@universityflow/content';
import type { HomeData } from '@universityflow/ui';
import { afterEach, describe, expect, it } from 'vitest';
import { ComingNext, showsComingNext } from '../components/coming-next';

/**
 * The university years' "coming next" cards (judge demo spec): one honest card for each part of
 * Stages 6 to 8 that isn't built yet, shown on the home once a university student's first week is
 * behind them. True for real students too, so it isn't tied to the demo.
 */

afterEach(cleanup);

const t = en.demoPersonas.comingNext;

const base: HomeData = {
  stage: 'university',
  name: null,
  qualify: null,
  nextPaperDays: null,
  subjects: null,
  gradeCheck: null,
  turningEighteen: null,
  goalProgrammeId: null,
  shortlist: [],
  applications: [],
  universityYear: { group: 'arriving', yearOfStudy: 1, draft: false },
  offers: [],
  registration: null,
  firstWeek: { done: 8, total: 8 },
  modules: { confirmed: 4, toFix: 0, checked: false },
  marks: [],
  subjectNames: {},
  look: { theme: 'mauve', avatar: 'initials' },
  next: { id: 'campus', href: '/campus' },
};

describe('when the "coming next" cards show', () => {
  it('at university, once every first-week step is done', () => {
    expect(showsComingNext(base)).toBe(true);
  });

  it('not during the first week, nor without a first-week checklist, nor before university', () => {
    expect(showsComingNext({ ...base, firstWeek: { done: 3, total: 8 } })).toBe(false);
    expect(showsComingNext({ ...base, firstWeek: null })).toBe(false);
    expect(showsComingNext({ ...base, stage: 'matric' })).toBe(false);
    expect(showsComingNext({ ...base, stage: 'grade-11', firstWeek: null })).toBe(false);
  });

  // A2-66: a second or final year's first week is behind them whether or not they ticked it here.
  it('in a second or final year, whatever the first-week checklist says (A2-66)', () => {
    for (const group of ['middle', 'final'] as const) {
      const later = { ...base, universityYear: { group, yearOfStudy: 2, draft: false } };
      expect(showsComingNext({ ...later, firstWeek: { done: 0, total: 8 } })).toBe(true);
      expect(showsComingNext({ ...later, firstWeek: null })).toBe(true);
    }
  });
});

describe('the "coming next" cards', () => {
  it('are one labelled section with a card for each unbuilt part, each saying "coming next"', () => {
    render(<ComingNext />);
    const section = screen.getByRole('region', { name: t.title });
    const cards = within(section).getAllByRole('listitem');
    expect(cards).toHaveLength(4);
    const items = [t.items.studyCoach, t.weakSpots, t.items.lifePlan, t.items.portfolio];
    expect(cards.map((card) => card.querySelector('h3')?.textContent)).toEqual(
      items.map((item) => t.label(item.name)),
    );
    for (const item of items) {
      expect(within(section).getByRole('heading', { name: t.label(item.name) })).toBeTruthy();
      expect(within(section).getByText(item.line)).toBeTruthy();
    }
    expect(within(section).getByText(t.lead)).toBeTruthy();
  });

  it('no longer says module marks are coming: the module card has them (A6-06)', () => {
    render(<ComingNext />);
    const section = screen.getByRole('region', { name: t.title });
    expect(within(section).queryByText(t.items.marks.line)).toBeNull();
    expect(within(section).queryByText(t.label(t.items.marks.name))).toBeNull();
  });

  it('link nowhere and promise no date: nothing to press', () => {
    render(<ComingNext />);
    const section = screen.getByRole('region', { name: t.title });
    expect(within(section).queryAllByRole('link')).toHaveLength(0);
    expect(within(section).queryAllByRole('button')).toHaveLength(0);
  });
});
