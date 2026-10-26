// @vitest-environment jsdom

import { assessAll, collegeOptions, type SubjectMark } from '@universityflow/admissions';
import { catalogueView } from '@universityflow/catalogue';
import { collegeView } from '@universityflow/catalogue/colleges';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResultsList } from '../app/(app)/results/results-list';
import { ResultsView } from '../app/(app)/results/results-view';

/**
 * Audit A4-19: /results sent every card of every group in its RSC payload, the collapsed Plan B
 * and its 45 college cards included, though the page showed none of them until opened: a
 * 1,149 KB document for 1,787 DOM nodes, and a mobile Lighthouse of 88–89. Now the server view
 * hands the island only the cards of the groups that show; a collapsed group's cards are fetched
 * when the learner opens it (results/actions.ts, computed by packages/admissions: hard rule 2).
 */

type IslandProps = Parameters<typeof ResultsList>[0];
const handed: IslandProps[] = [];

// The server action never runs here: the test looks at what the page itself sends.
vi.mock('../app/(app)/results/actions', () => ({ loadResultsGroup: vi.fn() }));
// The island stands in: it draws every card it is handed, so the markup measured below is the
// page's HTML plus everything the RSC payload would carry for the island, whatever is shown.
vi.mock('../app/(app)/results/results-list', () => ({
  ResultsList: (props: IslandProps) => {
    handed.push(props);
    return <div data-island>{Object.values(props.cards)}</div>;
  },
}));

/**
 * What the page may send for a matric learner with every public TVET college in Plan B, in KB of
 * markup (each card counted once; the real document carries it twice, as HTML and as the RSC
 * payload). Measured on 2026-10-25: 674 KB with the collapsed groups' cards, 134 KB without.
 */
const BUDGET_KB = 200;

const TODAY = new Date('2026-10-13T00:00:00Z');
const MARKS: ReadonlyArray<SubjectMark> = [
  { subject: 'english-hl', percent: 68 },
  { subject: 'isizulu-fal', percent: 74 },
  { subject: 'mathematics', percent: 61 },
  { subject: 'physical-sciences', percent: 55 },
  { subject: 'life-sciences', percent: 66 },
  { subject: 'geography', percent: 63 },
  { subject: 'life-orientation', percent: 80 },
];
const REPORT = { kind: 'grade-11-final', marks: MARKS } as const;
const VIEW = catalogueView(TODAY, { includeDrafts: true });
const RESULTS = assessAll(VIEW, REPORT);
const COLLEGES = collegeOptions(collegeView(TODAY, { includeDrafts: true }), REPORT, TODAY);

function markup() {
  return renderToStaticMarkup(
    <ResultsView
      results={RESULTS}
      shortlist={[]}
      reportKind="grade-11-final"
      confirmedAt="2026-10-01T10:00:00.000Z"
      universities={VIEW.universities.map((u) => ({ id: u.id, name: u.shortName }))}
      colleges={COLLEGES}
    />,
  );
}

describe('/results sends only the cards it shows (A4-19)', () => {
  beforeEach(() => {
    handed.length = 0;
  });

  it('has Plan B courses and many colleges, so the budget below means something', () => {
    expect(RESULTS.planB.length).toBeGreaterThan(0);
    expect(new Set(COLLEGES.options.map((o) => o.collegeId)).size).toBeGreaterThanOrEqual(40);
  });

  it(`stays within ${BUDGET_KB} KB of markup for a matric learner with every college in Plan B`, () => {
    const html = markup();
    const kb = Math.round(html.length / 1024);
    expect(kb, `${kb} KB of page and island markup`).toBeLessThanOrEqual(BUDGET_KB);
  });

  it('hands the island the shown groups’ cards, and only the names of what is collapsed', () => {
    const html = markup();
    const [props] = handed;
    if (!props) throw new Error('the island was not rendered');
    const [first] = RESULTS.qualifyNow;
    if (!first) throw new Error('expected a course');
    expect(html).toContain(`aria-labelledby="p-${first.programmeId}"`);
    expect(props.cards[first.programmeId]).toBeDefined();
    for (const r of RESULTS.planB) expect(props.cards[r.programmeId]).toBeUndefined();
    expect(Object.keys(props.cards).some((id) => id.startsWith('college-'))).toBe(false);
    expect(html).not.toContain('aria-labelledby="c-');
    // The count and the filter still know what is behind Plan B.
    const planB = props.groups.find((g) => g.id === 'plan-b');
    expect(planB?.items).toHaveLength(
      RESULTS.planB.length + new Set(COLLEGES.options.map((o) => o.collegeId)).size,
    );
    expect(typeof props.loadGroup).toBe('function');
  });
});
