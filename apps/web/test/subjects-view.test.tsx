// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import { en } from '@universityflow/content';
import type { SubjectsCourse, SubjectsResponse } from '@universityflow/ui';
import { afterEach, describe, expect, it } from 'vitest';
import { SubjectsView } from '../app/(app)/subjects/subjects-view';

/**
 * My subjects (G10-4): which courses the confirmed report's subjects keep open. The verdicts come
 * from `subjectDoors` and `trySwap` (tested in packages/admissions); this checks the page says
 * them honestly, in the approved order (round 2): the verdict first, by university, the closed
 * courses by what they need, the higher bar's reason, and the what-if. Synthetic data only.
 *
 * Rewritten for the approved redesign (2026-10-22). Kept: the empty state, the chips' look
 * (A3-31), `subjects-summary` holding `someClosed`/`allOpen`, "unknown" never saying "all open",
 * and the talk-to-your-school notice only when some are closed. Changed on purpose: the region
 * "What would open them" became "Courses your subjects close", and a group's line
 * "Mathematics: 2 courses" became a summary "Needs Mathematics" with its count (the old heading
 * over-promised: a course closed by two requirements stays shut with one subject).
 */

afterEach(cleanup);

const t = en.subjects;

const course = (
  id: string,
  universityId: string,
  universityName: string,
  linkable = true,
): SubjectsCourse => ({ id, name: `Sample ${id}`, universityId, universityName, linkable });

const SAMPLE_U = 'Sample University';
const OTHER_U = 'Other Sample University';

const doors: NonNullable<SubjectsResponse['doors']> = {
  status: 'some-closed',
  checked: 10,
  open: 7,
  closed: 3,
  draft: true,
  byUniversity: [
    { id: 'other', name: OTHER_U, checked: 4, closed: 1 },
    { id: 'sample', name: SAMPLE_U, checked: 6, closed: 2 },
  ],
  groups: [
    {
      subjects: ['Mathematics'],
      programmes: [
        { ...course('engineering', 'sample', SAMPLE_U), alsoNeeds: [['Physical Sciences']] },
        { ...course('commerce', 'sample', SAMPLE_U), alsoNeeds: [] },
        { ...course('accounting', 'other', OTHER_U, false), alsoNeeds: [] },
      ],
    },
    {
      subjects: ['Physical Sciences', 'Technical Sciences'],
      programmes: [{ ...course('engineering', 'sample', SAMPLE_U), alsoNeeds: [['Mathematics']] }],
    },
  ],
  higherBar: [
    {
      ...course('diploma', 'other', OTHER_U),
      reasons: [
        { kind: 'score', subject: 'Mathematical Literacy', score: 26, otherwise: 24 },
        {
          kind: 'option',
          yours: { subjects: ['Mathematical Literacy'], level: 6, percent: null },
          lowest: { subjects: ['Mathematics'], level: 4, percent: null },
        },
      ],
    },
  ],
  goal: null,
  swap: {
    drop: [
      { id: 'english-hl', name: 'English Home Language' },
      { id: 'mathematical-literacy', name: 'Mathematical Literacy' },
    ],
    take: [
      { id: 'mathematics', name: 'Mathematics' },
      { id: 'physical-sciences', name: 'Physical Sciences' },
    ],
  },
  whatIf: null,
};

const checked: SubjectsResponse = {
  report: { kind: 'grade-10-final' },
  subjects: [
    { id: 'english-hl', name: 'English Home Language' },
    { id: 'mathematical-literacy', name: 'Mathematical Literacy' },
  ],
  doors,
};

const withDoors = (more: Partial<NonNullable<SubjectsResponse['doors']>>): SubjectsResponse => ({
  ...checked,
  doors: { ...doors, ...more },
});

const closes = () => screen.getByRole('region', { name: t.closesTitle });
const summaries = (region: HTMLElement) => [...region.querySelectorAll('summary')];

describe('My subjects', () => {
  it('with no confirmed report, asks for one and checks nothing', () => {
    render(<SubjectsView data={{ report: null, subjects: [], doors: null }} />);
    expect(screen.getByRole('heading', { level: 1, name: t.title })).toBeTruthy();
    expect(screen.getByText(t.none)).toBeTruthy();
    expect(screen.getByRole('link', { name: t.add }).getAttribute('href')).toBe('/documents');
    expect(screen.queryByTestId('subjects-summary')).toBeNull();
  });

  it('says the verdict first: the first heading after the title, a one-sentence lead above it', () => {
    render(<SubjectsView data={checked} />);
    expect(screen.getByText(t.intro)).toBeTruthy();
    const first = screen.getAllByRole('heading', { level: 2 })[0];
    expect(first?.getAttribute('data-testid')).toBe('subjects-summary');
    expect(first?.textContent).toBe(t.someClosed(3, 10));
    expect(screen.getByText(t.meterLegend(7, 3))).toBeTruthy();
  });

  it('draws the meter as decoration only: the numbers are in the text (WCAG 1.1.1, 1.4.1)', () => {
    render(<SubjectsView data={checked} />);
    const meter = screen.getByTestId('subjects-meter');
    expect(meter.getAttribute('aria-hidden')).toBe('true');
    expect(meter.textContent).toBe('');
  });

  it('lists the confirmed subjects in the verdict card, from which report, and how to fix them', () => {
    render(<SubjectsView data={checked} />);
    expect(screen.getByText(t.fromReport(en.reportKinds['grade-10-final']))).toBeTruthy();
    const list = within(screen.getByTestId('subjects-list')).getAllByRole('listitem');
    expect(list.map((li) => li.textContent)).toEqual([
      'English Home Language',
      'Mathematical Literacy',
    ]);
    expect(screen.getByRole('link', { name: t.notRight }).getAttribute('href')).toBe('/documents');
  });

  it('sets each subject chip off from its card, so the names don’t run together (A3-31)', () => {
    render(<SubjectsView data={checked} />);
    const list = screen.getByTestId('subjects-list');
    // The card is `bg-surface`: a chip of the same colour vanishes into it (measured, A3-31).
    expect(list.closest('.bg-surface')).toBeTruthy();
    for (const li of within(list).getAllByRole('listitem')) {
      const chip = li.firstElementChild as HTMLElement;
      expect(chip.className).not.toMatch(/\bbg-surface\b/);
      expect(chip.className).toMatch(/\bbg-sunk\b/);
    }
  });

  it('compares the universities side by side, each a link to its own courses', () => {
    render(<SubjectsView data={checked} />);
    const region = screen.getByRole('region', { name: t.byUniversityTitle });
    const links = within(region).getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual([
      `${OTHER_U}${t.universityClosed(1, 4)}`,
      `${SAMPLE_U}${t.universityClosed(2, 6)}`,
    ]);
    expect(links[0]?.getAttribute('href')).toBe('/subjects?university=other#subjects-closes');
  });

  it('groups the closed courses by what they need, each summary with its count and no “Show”', () => {
    render(<SubjectsView data={checked} />);
    expect(screen.queryByRole('region', { name: 'What would open them' })).toBeNull();
    const groups = summaries(closes());
    expect(groups.map((s) => s.textContent)).toEqual([
      `${t.needs('Mathematics')}${t.count(3)}`,
      `${t.needs(`Physical Sciences${t.or}Technical Sciences`)}${t.count(1)}`,
    ]);
    for (const summary of groups) {
      expect(summary.textContent).not.toMatch(/show/i);
      // The browser's marker is replaced by a chevron that turns when open (decorative).
      expect(summary.className).toMatch(/\blist-none\b/);
      expect(summary.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
    }
  });

  it('lists a group’s courses under their university, says what else each needs, and links What I need', () => {
    render(<SubjectsView data={checked} />);
    const maths = summaries(closes())[0]?.closest('details') as HTMLElement;
    expect(
      within(maths)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent),
    ).toEqual([OTHER_U, SAMPLE_U]);
    const engineering = within(maths).getByRole('link', { name: /Sample engineering/ });
    expect(engineering.getAttribute('href')).toBe('/results/what-i-need/engineering');
    expect(engineering.textContent).toBe(`Sample engineering${t.alsoNeeds('Physical Sciences')}`);
    // What I need can't show this one, so it isn't a link (no dead end).
    expect(within(maths).queryByRole('link', { name: /Sample accounting/ })).toBeNull();
    expect(within(maths).getByText('Sample accounting')).toBeTruthy();
  });

  it('keeps every group closed by default with no goal in it', () => {
    render(<SubjectsView data={checked} />);
    for (const s of summaries(closes())) expect(s.closest('details')?.open).toBe(false);
  });

  it('shows the goal in the verdict card, and opens the first group that holds it', () => {
    const goal = course('engineering', 'sample', SAMPLE_U);
    render(
      <SubjectsView
        data={withDoors({
          goal: { course: goal, status: 'closed', needs: [['Mathematics'], ['Physical Sciences']] },
        })}
      />,
    );
    const card = screen.getByTestId('subjects-summary').closest('section') as HTMLElement;
    expect(within(card).getByText(t.goalLabel)).toBeTruthy();
    expect(within(card).getByText('Sample engineering')).toBeTruthy();
    expect(
      within(card).getByText(t.goalNeeds(`Mathematics${t.and}Physical Sciences`)),
    ).toBeTruthy();
    expect(within(card).getByRole('link', { name: en.whatINeed.open }).getAttribute('href')).toBe(
      '/results/what-i-need/engineering',
    );
    expect(summaries(closes()).map((s) => s.closest('details')?.open)).toEqual([true, false]);
  });

  it('says an open goal is open, and a higher-bar goal so', () => {
    const goal = course('arts', 'sample', SAMPLE_U);
    render(
      <SubjectsView data={withDoors({ goal: { course: goal, status: 'open', needs: [] } })} />,
    );
    expect(screen.getByText(t.goalOpen)).toBeTruthy();
    cleanup();
    render(
      <SubjectsView
        data={withDoors({ goal: { course: goal, status: 'higher-bar', needs: [] } })}
      />,
    );
    expect(screen.getByText(t.goalHigher)).toBeTruthy();
  });

  it('filters the closed courses by university with a GET form, never changing the verdict', () => {
    render(<SubjectsView data={checked} university="other" />);
    expect(screen.getByTestId('subjects-summary').textContent).toBe(t.someClosed(3, 10));
    const region = screen.getByRole('region', { name: t.closesTitleAt(OTHER_U) });
    expect(summaries(region).map((s) => s.textContent)).toEqual([
      `${t.needs('Mathematics')}${t.countAt(1, 3)}`,
    ]);
    expect(within(region).getByText(t.showing(OTHER_U))).toBeTruthy();
    expect(within(region).getByRole('link', { name: t.showAll }).getAttribute('href')).toBe(
      '/subjects#subjects-closes',
    );
    // By university stays whole.
    const universities = screen.getByRole('region', { name: t.byUniversityTitle });
    expect(within(universities).getAllByRole('link')).toHaveLength(2);
    // The higher bar is filtered too: the diploma is at the other university.
    expect(screen.getByRole('region', { name: t.higherTitle })).toBeTruthy();
  });

  it('the filter is a native select with a visible label and a Show button, no submit-on-change', () => {
    render(<SubjectsView data={checked} university="sample" />);
    const select = screen.getByLabelText(t.filterLabel) as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
    expect(select.name).toBe('university');
    expect(select.value).toBe('sample');
    expect([...select.options].map((o) => o.textContent)).toEqual([
      t.allUniversities,
      OTHER_U,
      SAMPLE_U,
    ]);
    expect(select.getAttribute('onchange')).toBeNull();
    const form = select.closest('form') as HTMLFormElement;
    expect(form.getAttribute('method')).toBe('get');
    expect(form.getAttribute('action')).toBe('/subjects#subjects-closes');
    expect(within(form).getByRole('button', { name: t.show }).getAttribute('type')).toBe('submit');
  });

  it('ignores a university it doesn’t know, and says when one has nothing closed', () => {
    render(<SubjectsView data={checked} university="nowhere" />);
    expect(closes()).toBeTruthy();
    expect(summaries(closes())).toHaveLength(2);
    cleanup();
    render(
      <SubjectsView
        data={withDoors({
          byUniversity: [
            ...doors.byUniversity,
            { id: 'third', name: 'Third', checked: 2, closed: 0 },
          ],
        })}
        university="third"
      />,
    );
    const region = screen.getByRole('region', { name: t.closesTitleAt('Third') });
    expect(summaries(region)).toHaveLength(0);
    expect(within(region).getByText(t.noneAt('Third'))).toBeTruthy();
  });

  it('says why each higher bar is higher, from the catalogue’s numbers', () => {
    render(<SubjectsView data={checked} />);
    const region = screen.getByRole('region', { name: t.higherTitle });
    expect(within(region).getByText(t.higherScore('Mathematical Literacy', 26, 24))).toBeTruthy();
    expect(
      within(region).getByText(
        t.higherOption(
          t.atBar('Mathematical Literacy', t.level(6)),
          t.atBar('Mathematics', t.level(4)),
        ),
      ),
    ).toBeTruthy();
  });

  it('offers the what-if: two labelled selects and a Check button, in a GET form', () => {
    render(<SubjectsView data={checked} />);
    const region = screen.getByRole('region', { name: t.whatIfTitle });
    const drop = within(region).getByLabelText(t.dropLabel) as HTMLSelectElement;
    const take = within(region).getByLabelText(t.takeLabel) as HTMLSelectElement;
    expect([drop.name, take.name]).toEqual(['drop', 'take']);
    expect([...drop.options].map((o) => o.value)).toEqual(['english-hl', 'mathematical-literacy']);
    expect([...take.options].map((o) => o.value)).toEqual(['mathematics', 'physical-sciences']);
    const form = drop.closest('form') as HTMLFormElement;
    expect(form.getAttribute('method')).toBe('get');
    expect(form.getAttribute('action')).toBe('/subjects#what-if');
    expect(within(form).getByRole('button', { name: t.check }).getAttribute('type')).toBe('submit');
    expect(within(region).getByText(t.whatIfLead)).toBeTruthy();
  });

  it('prints the what-if’s answer under it, hypothetical, the real verdict untouched', () => {
    render(
      <SubjectsView
        data={withDoors({
          whatIf: {
            drop: { id: 'mathematical-literacy', name: 'Mathematical Literacy' },
            take: { id: 'mathematics', name: 'Mathematics' },
            checked: 10,
            closed: 1,
            opened: [course('commerce', 'sample', SAMPLE_U)],
            closes: [course('diploma', 'other', OTHER_U)],
          },
        })}
      />,
    );
    expect(screen.getByTestId('subjects-summary').textContent).toBe(t.someClosed(3, 10));
    const result = screen.getByRole('region', {
      name: t.whatIfHeading('Mathematics', 'Mathematical Literacy'),
    });
    expect(result.id).toBe('what-if');
    expect(within(result).getByText(t.whatIfVerdict(1, 10))).toBeTruthy();
    expect(within(result).getByText(t.whatIfOpens(1))).toBeTruthy();
    expect(within(result).getByText(t.whatIfCloses(1))).toBeTruthy();
    expect(within(result).getByText(t.reportUnchanged)).toBeTruthy();
    // Talk to your school, right under the answer: the catalogue doesn't know which
    // combinations a school allows.
    expect(within(result).getByText(t.talk)).toBeTruthy();
    expect(screen.getAllByText(t.talk)).toHaveLength(1);
    // The choices stay as asked.
    expect((screen.getByLabelText(t.dropLabel) as HTMLSelectElement).value).toBe(
      'mathematical-literacy',
    );
    expect((screen.getByLabelText(t.takeLabel) as HTMLSelectElement).value).toBe('mathematics');
  });

  it('keeps the talk-to-your-school notice and the longer explanation', () => {
    render(<SubjectsView data={checked} />);
    expect(screen.getByText(t.talk)).toBeTruthy();
    expect(screen.getByText(t.draft)).toBeTruthy();
    const how = screen.getByText(t.howItWorks).closest('details') as HTMLElement;
    expect(within(how).getByText(t.lead)).toBeTruthy();
  });

  it('never says doors are open when nothing could be checked', () => {
    render(
      <SubjectsView
        data={withDoors({
          status: 'unknown',
          checked: 0,
          open: 0,
          closed: 0,
          draft: false,
          byUniversity: [],
          groups: [],
          higherBar: [],
          swap: { drop: doors.swap.drop, take: [] },
        })}
      />,
    );
    expect(screen.getByText(t.unknown)).toBeTruthy();
    expect(screen.queryByTestId('subjects-summary')).toBeNull();
    expect(screen.queryByTestId('subjects-meter')).toBeNull();
    expect(screen.queryByText(t.draft)).toBeNull();
    expect(screen.queryByRole('region', { name: t.whatIfTitle })).toBeNull();
    // The subjects are still listed, from the confirmed report.
    expect(screen.getByTestId('subjects-list')).toBeTruthy();
  });

  it('with every door open, says so, with no advice to change and nothing to try', () => {
    render(
      <SubjectsView
        data={withDoors({
          status: 'open',
          checked: 10,
          open: 10,
          closed: 0,
          draft: false,
          groups: [],
          higherBar: [],
          swap: { drop: doors.swap.drop, take: [] },
        })}
      />,
    );
    expect(screen.getByTestId('subjects-summary').textContent).toBe(t.allOpen(10));
    expect(screen.queryByText(t.talk)).toBeNull();
    expect(screen.queryByRole('region', { name: t.closesTitle })).toBeNull();
    expect(screen.queryByRole('region', { name: t.whatIfTitle })).toBeNull();
  });
});
