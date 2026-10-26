// @vitest-environment jsdom

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { assessAll, collegeOptions, type SubjectMark } from '@universityflow/admissions';
import {
  type College,
  type CollegeProgramme,
  catalogueView,
  collegeViewOf,
  type TeachOutNotice,
} from '@universityflow/catalogue';
import { en } from '@universityflow/content';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type GroupId, type LoadGroup, resultsGroups } from '../app/(app)/results/results-groups';
import { ResultsView } from '../app/(app)/results/results-view';

// The server action is never called here: each test hands the view a fake `loadGroup` instead.
vi.mock('../app/(app)/results/actions', () => ({ loadResultsGroup: vi.fn() }));

/**
 * A stand-in for results/actions.ts: the collapsed group's cards, built the way the action builds
 * them (A4-19), handed back after a tick like a fetch would.
 */
function fakeLoad(input: Parameters<typeof resultsGroups>[0]) {
  return vi.fn<LoadGroup>(async (id: GroupId) => {
    await Promise.resolve();
    return { cards: resultsGroups(input).cardsOf(id) };
  });
}

/**
 * Audit A4-03: `/results` was one client component that rendered and hydrated all 86
 * programme cards, about a second of main-thread work on a budget phone. The cards now render
 * on the server; only the filter and each shortlist button are client islands, and Plan B
 * stays collapsed until the learner opens it.
 */

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXTENSIONS = ['', '.tsx', '.ts', '/index.tsx', '/index.ts'];

/** The app's own module a specifier points at, or null for a package. */
function resolveLocal(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) base = join(WEB, specifier.slice(2));
  else if (specifier.startsWith('.')) base = resolve(dirname(from), specifier);
  else return null;
  for (const ext of EXTENSIONS) {
    const file = `${base}${ext}`;
    if (existsSync(file) && /\.tsx?$/.test(file)) return file;
  }
  throw new Error(`cannot resolve ${specifier} from ${from}`);
}

/**
 * The app modules a page sends to the browser: every module marked 'use client' that the page
 * reaches, and everything those import. Type-only imports are erased, so they don't count.
 */
function clientModules(page: string): string[] {
  const client = new Set<string>();
  const seen = new Set<string>();
  const visit = (file: string, inClient: boolean) => {
    const key = `${file}|${inClient}`;
    if (seen.has(key)) return;
    seen.add(key);
    const source = readFileSync(file, 'utf8');
    const isClient = inClient || /^\s*['"]use client['"]/.test(source);
    if (isClient) client.add(relative(WEB, file).split(sep).join('/'));
    const imports = source.matchAll(
      /^(?:import|export)\s+(?!type\s)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm,
    );
    for (const [, specifier] of imports) {
      const target = specifier ? resolveLocal(file, specifier) : null;
      if (target) visit(target, isClient);
    }
  };
  visit(join(WEB, page), false);
  return [...client].sort();
}

describe('/results renders its cards on the server (A4-03)', () => {
  it('sends no programme card code to the browser, only the filter and shortlist islands', () => {
    const client = clientModules('app/(app)/results/page.tsx');
    expect(client).not.toContain('app/(app)/results/results-view.tsx');
    expect(client).not.toContain('components/programme-card.tsx');
    expect(client).toContain('app/(app)/results/shortlist-button.tsx');
    // The school record is rendered on the server too (§18.7 C2).
    expect(client).not.toContain('components/school-record.tsx');
  });
});

describe('ResultsView', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const VIEW = catalogueView(new Date('2026-10-13T00:00:00Z'), { includeDrafts: true });
  const RESULTS_MARKS: ReadonlyArray<SubjectMark> = [
    { subject: 'english-hl', percent: 68 },
    { subject: 'isizulu-fal', percent: 74 },
    { subject: 'mathematics', percent: 61 },
    { subject: 'physical-sciences', percent: 55 },
    { subject: 'life-sciences', percent: 66 },
    { subject: 'geography', percent: 63 },
    { subject: 'life-orientation', percent: 80 },
  ];
  const RESULTS = assessAll(VIEW, { kind: 'grade-11-final', marks: RESULTS_MARKS });
  const UNIVERSITIES = VIEW.universities.map((u) => ({ id: u.id, name: u.shortName }));

  function show(
    shortlist: string[] = [],
    loadGroup: LoadGroup = fakeLoad({ results: RESULTS, shortlist: new Set(shortlist) }),
  ) {
    return render(
      <ResultsView
        results={RESULTS}
        shortlist={shortlist}
        reportKind="grade-11-final"
        confirmedAt="2026-10-01T10:00:00.000Z"
        universities={UNIVERSITIES}
        loadGroup={loadGroup}
      />,
    );
  }

  const cardOf = (programmeId: string) =>
    document.getElementById(`p-${programmeId}`)?.closest('li') as HTMLElement;

  const section = (name: RegExp) =>
    screen.getByRole('heading', { name }).closest('section') as HTMLElement;

  it('has courses in every group, so the checks below mean something', () => {
    expect(RESULTS.qualifyNow.length).toBeGreaterThan(0);
    expect(RESULTS.close.length).toBeGreaterThan(0);
    expect(RESULTS.planB.length).toBeGreaterThan(0);
  });

  it('on Grade 10 marks shows On track and Close, never Qualify now or Plan B (G10-3)', () => {
    const grade10 = assessAll(VIEW, {
      kind: 'grade-10-final',
      marks: RESULTS_MARKS,
    });
    render(
      <ResultsView
        results={grade10}
        shortlist={[]}
        reportKind="grade-10-final"
        confirmedAt="2026-10-01T10:00:00.000Z"
        universities={UNIVERSITIES}
      />,
    );
    expect(screen.getByText(en.results.leadGrade10)).toBeTruthy();
    expect(screen.queryByText(en.results.lead)).toBeNull();
    const onTrack = section(new RegExp(en.results.groups.onTrack));
    // Every course the same marks would meet on a Grade 11 report, degree or Plan B.
    expect(within(onTrack).getAllByRole('heading', { level: 3 })).toHaveLength(
      RESULTS.qualifyNow.length + RESULTS.planB.length,
    );
    expect(
      screen.queryByRole('heading', { name: new RegExp(en.results.groups.qualifyNow) }),
    ).toBeNull();
    expect(screen.queryByRole('heading', { name: new RegExp(en.results.groups.planB) })).toBeNull();
    expect(screen.queryByRole('button', { name: new RegExp(en.results.groups.planB) })).toBeNull();
    expect(screen.getByText(/final Grade 10 report/)).toBeTruthy();
  });

  it('on Grade 11 June or September marks shows On track, with its own lead, never Qualify now (§18.7 C2)', () => {
    const june = assessAll(VIEW, { kind: 'grade-11-june', marks: RESULTS_MARKS });
    render(
      <ResultsView
        results={june}
        shortlist={[]}
        reportKind="grade-11-june"
        confirmedAt="2027-07-01T10:00:00.000Z"
        universities={UNIVERSITIES}
      />,
    );
    expect(screen.getByText(en.schoolRecord.resultsLeadInterim)).toBeTruthy();
    expect(screen.queryByText(en.results.leadGrade10)).toBeNull();
    expect(
      screen.getByRole('heading', { name: new RegExp(en.results.groups.onTrack) }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('heading', { name: new RegExp(en.results.groups.qualifyNow) }),
    ).toBeNull();
    expect(screen.getByText(/Grade 11 June report/)).toBeTruthy();
  });

  it('shows the school record it is given, under the courses (§18.7 C2)', () => {
    render(
      <ResultsView
        results={RESULTS}
        shortlist={[]}
        reportKind="grade-11-final"
        confirmedAt="2026-10-01T10:00:00.000Z"
        universities={UNIVERSITIES}
        schoolRecord={<section aria-label="record slot">record</section>}
      />,
    );
    expect(screen.getByRole('region', { name: 'record slot' })).toBeTruthy();
  });

  it('shows Qualify now and Close, and keeps Plan B collapsed behind a real disclosure', async () => {
    const loadGroup = fakeLoad({ results: RESULTS, shortlist: new Set() });
    show([], loadGroup);
    const now = section(new RegExp(en.results.groups.qualifyNow));
    expect(within(now).getAllByRole('heading', { level: 3 })).toHaveLength(
      RESULTS.qualifyNow.length,
    );
    expect(
      within(section(new RegExp(en.results.groups.close))).getAllByRole('heading', { level: 3 }),
    ).toHaveLength(RESULTS.close.length);

    const toggle = screen.getByRole('button', { name: new RegExp(en.results.groups.planB) });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    const planB = section(new RegExp(en.results.groups.planB));
    expect(within(planB).queryAllByRole('heading', { level: 3 })).toHaveLength(0);
    // The count is there before opening, so the learner knows what is behind it.
    expect(toggle.textContent).toContain(`(${RESULTS.planB.length})`);
    // Nothing is fetched for a group nobody opened (A4-19).
    expect(loadGroup).not.toHaveBeenCalled();

    fireEvent.click(toggle);
    // The disclosure answers at once; the cards follow.
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const controlled = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    expect(controlled).not.toBeNull();
    expect(controlled?.getAttribute('aria-busy')).toBe('true');
    expect(within(planB).getByRole('status').textContent).toBe(en.common.loading);
    expect(loadGroup).toHaveBeenCalledTimes(1);
    expect(loadGroup).toHaveBeenCalledWith('plan-b');
    // The first cards come with the first paint, the rest in a transition (A4-20): all of them.
    await waitFor(() => {
      expect(within(planB).getAllByRole('heading', { level: 3 })).toHaveLength(
        RESULTS.planB.length,
      );
    });
    expect(RESULTS.planB.length).toBeGreaterThan(8);
    expect(within(planB).queryByRole('status')).toBeNull();
    expect(controlled?.getAttribute('aria-busy')).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(within(planB).queryAllByRole('heading', { level: 3 })).toHaveLength(0);

    // Opened again: the cards it already has, at once, with no second fetch (A4-20).
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(within(planB).getAllByRole('heading', { level: 3 })).toHaveLength(RESULTS.planB.length);
    expect(loadGroup).toHaveBeenCalledTimes(1);
  });

  it('says when Plan B’s cards didn’t arrive, and tries again on request', async () => {
    const working = fakeLoad({ results: RESULTS, shortlist: new Set() });
    const loadGroup = vi
      .fn<LoadGroup>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementation(working);
    show([], loadGroup);
    const toggle = screen.getByRole('button', { name: new RegExp(en.results.groups.planB) });
    const planB = section(new RegExp(en.results.groups.planB));
    fireEvent.click(toggle);
    const alert = await within(planB).findByRole('alert');
    expect(alert.textContent).toContain(en.results.groups.loadFailed);
    expect(within(planB).queryAllByRole('heading', { level: 3 })).toHaveLength(0);
    fireEvent.click(within(alert).getByRole('button', { name: en.common.tryAgain }));
    await waitFor(() => {
      expect(within(planB).getAllByRole('heading', { level: 3 })).toHaveLength(
        RESULTS.planB.length,
      );
    });
    expect(within(planB).queryByRole('alert')).toBeNull();
    expect(loadGroup).toHaveBeenCalledTimes(2);
  });

  it('filters the cards it fetched, and shows them again when the filter clears', async () => {
    show();
    const toggle = screen.getByRole('button', { name: new RegExp(en.results.groups.planB) });
    const planB = section(new RegExp(en.results.groups.planB));
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(within(planB).getAllByRole('heading', { level: 3 })).toHaveLength(
        RESULTS.planB.length,
      );
    });
    fireEvent.change(screen.getByLabelText(en.results.filters.search), {
      target: { value: 'zzzz no such course' },
    });
    expect(within(planB).queryAllByRole('heading', { level: 3 })).toHaveLength(0);
    expect(within(planB).getByText(en.results.groups.empty)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(en.results.filters.search), { target: { value: '' } });
    expect(within(planB).getAllByRole('heading', { level: 3 })).toHaveLength(RESULTS.planB.length);
  });

  it('filters by institution and by words, and the counts follow', () => {
    show();
    const ids = new Set(RESULTS.qualifyNow.map((r) => r.universityId));
    const [uni] = [...ids];
    const expected = RESULTS.qualifyNow.filter((r) => r.universityId === uni);
    fireEvent.change(screen.getByLabelText(en.colleges.filters.institution), {
      target: { value: uni },
    });
    const now = section(new RegExp(en.results.groups.qualifyNow));
    expect(within(now).getAllByRole('heading', { level: 3 })).toHaveLength(expected.length);
    expect(within(now).getByRole('heading', { level: 2 }).textContent).toContain(
      `(${expected.length})`,
    );

    fireEvent.change(screen.getByLabelText(en.colleges.filters.institution), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText(en.results.filters.search), {
      target: { value: 'zzzz no such course' },
    });
    expect(within(now).queryAllByRole('heading', { level: 3 })).toHaveLength(0);
    expect(within(now).getByText(en.results.groups.empty)).toBeTruthy();
  });

  it('adds a course to the shortlist and says so', async () => {
    const fetch = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const [first] = RESULTS.qualifyNow;
    if (!first) throw new Error('expected a course');
    show();
    const card = cardOf(first.programmeId);
    fireEvent.click(within(card).getByRole('button', { name: en.results.shortlist }));
    const pressed = await within(card).findByRole('button', { name: en.results.shortlisted });
    expect(pressed.getAttribute('aria-pressed')).toBe('true');
    expect(fetch).toHaveBeenCalledWith(
      '/api/shortlist',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ programmeId: first.programmeId }),
      }),
    );
  });

  it('starts with the learner’s shortlist marked', () => {
    const [first] = RESULTS.qualifyNow;
    if (!first) throw new Error('expected a course');
    show([first.programmeId]);
    const card = cardOf(first.programmeId);
    expect(within(card).getByRole('button', { name: en.results.shortlisted })).toBeTruthy();
  });
});

describe('ResultsView with public TVET colleges (planning.md §19.1)', () => {
  afterEach(cleanup);

  const VIEW = catalogueView(new Date('2026-10-13T00:00:00Z'), { includeDrafts: true });
  const MARKS: ReadonlyArray<SubjectMark> = [
    { subject: 'english-hl', percent: 68 },
    { subject: 'isizulu-fal', percent: 74 },
    { subject: 'mathematics', percent: 61 },
    { subject: 'physical-sciences', percent: 55 },
    { subject: 'life-sciences', percent: 66 },
    { subject: 'geography', percent: 63 },
    { subject: 'life-orientation', percent: 80 },
  ];
  const UNIVERSITIES = VIEW.universities.map((u) => ({ id: u.id, name: u.shortName }));
  const COLLEGE: College = {
    sourceUrl: 'https://www.dhet.gov.za/list.pdf',
    academicYear: 2026,
    id: 'example',
    type: 'public-tvet-college',
    dhetName: 'Example TVET College',
    province: 'Gauteng',
    site: {
      sourceUrl: 'https://www.example-college.edu.za/',
      academicYear: 2027,
      name: 'Example College',
      abbreviations: ['EXC'],
      website: 'https://www.example-college.edu.za/',
      domains: ['example-college.edu.za'],
      mainTown: 'Soweto',
      applyUrl: 'https://www.example-college.edu.za/apply/',
    },
  };
  const course = (
    id: string,
    over: Pick<CollegeProgramme, 'type' | 'programme'> & Partial<CollegeProgramme>,
  ): CollegeProgramme => ({
    sourceUrl: 'https://www.example-college.edu.za/courses/',
    academicYear: 2027,
    id,
    collegeId: 'example',
    nameAtCollege: `NC(V) ${over.programme}`,
    campuses: ['Soweto'],
    yearPrinted: null,
    entryQuote: null,
    entryQuoteUrl: null,
    ...over,
  });
  const TOURISM = course('ex-tourism', {
    type: 'ncv',
    programme: 'Tourism',
    entryQuote: 'Grade 9 pass',
    entryQuoteUrl: 'https://www.example-college.edu.za/courses/tourism/',
  });
  const HOSPITALITY = course('ex-hospitality', { type: 'ncv', programme: 'Hospitality' });
  const N4 = course('ex-n4', { type: 'n4-n6', programme: 'Business Management' });
  const NOTICE: TeachOutNotice = {
    sourceUrl: 'https://www.dhet.gov.za/tc.pdf',
    academicYear: 2027,
    id: 'tc',
    circular: 'TC 0000',
    title: 'Teach-out',
    datePrinted: '15 October 2025',
    type: 'n4-n6',
    programmes: null,
    noFirstIntakeFrom: 2027,
    quotes: ['the last cohort of students on N4 – N6 programmes'],
    supportingUrls: [],
  };
  const TODAY = new Date('2026-10-24T10:00:00Z');
  /** Where NC(V) starts: a synthetic catalogue record (A1-84), never words in the copy. */
  const NCV_ENTRY = {
    sourceUrl: 'https://www.dhet.gov.za/ncv-policy.pdf',
    academicYear: 2027,
    type: 'ncv' as const,
    afterGrade: 9,
    orAfter: null,
    quote: 'The minimum entrance requirements are a Grade 9 Certificate.',
    page: 'p. 13',
  };
  const COLLEGES = collegeViewOf(
    {
      colleges: [COLLEGE],
      programmes: [TOURISM, HOSPITALITY, N4],
      notices: [NOTICE],
      entries: [NCV_ENTRY],
    },
    TODAY,
    { includeDrafts: true },
  );

  function showWith(kind: 'grade-11-final' | 'grade-10-final', view = COLLEGES) {
    const report = { kind, marks: MARKS } as const;
    const results = assessAll(VIEW, report);
    const colleges = collegeOptions(view, report, TODAY);
    return render(
      <ResultsView
        results={results}
        shortlist={[]}
        reportKind={kind}
        confirmedAt="2026-10-01T10:00:00.000Z"
        universities={UNIVERSITIES}
        colleges={colleges}
        loadGroup={fakeLoad({ results, shortlist: new Set(), colleges })}
      />,
    );
  }
  const planBSection = () =>
    screen
      .getByRole('heading', { name: new RegExp(en.results.groups.planB) })
      .closest('section') as HTMLElement;

  it('puts a college in Plan B beside the university courses, one card with its courses', async () => {
    showWith('grade-11-final');
    const planB = assessAll(VIEW, { kind: 'grade-11-final', marks: MARKS }).planB;
    const toggle = screen.getByRole('button', { name: new RegExp(en.results.groups.planB) });
    expect(toggle.textContent).toContain(`(${planB.length + 1})`);
    fireEvent.click(toggle);
    const card = (
      await within(planBSection()).findByRole('heading', { level: 3, name: 'Example College' })
    ).closest('li') as HTMLElement;
    expect(within(card).getByText(en.colleges.badge)).toBeTruthy();
    expect(within(card).getByText(en.colleges.verdicts['meets-minimum'])).toBeTruthy();
    expect(within(card).getByText(en.colleges.verdicts['check-rule'])).toBeTruthy();
    expect(within(card).getByText('Grade 9 pass')).toBeTruthy();
    expect(within(card).getByText(en.colleges.noRule)).toBeTruthy();
    expect(within(card).getByText(en.common.draftBadge)).toBeTruthy();
    // The N4 course is closed by the teach-out: not offered, and the page says why.
    expect(within(card).queryByText('NC(V) Business Management')).toBeNull();
    expect(
      screen.getByText(new RegExp(en.colleges.closed(1, 'TC 0000').slice(0, 30))),
    ).toBeTruthy();
  });

  it('filters by type and by institution: a college, or the universities only', async () => {
    showWith('grade-11-final');
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.results.groups.planB) }));
    await within(planBSection()).findByRole('heading', { level: 3, name: 'Example College' });
    fireEvent.change(screen.getByLabelText(en.colleges.filters.type), {
      target: { value: 'public-tvet-college' },
    });
    expect(within(planBSection()).getAllByRole('heading', { level: 3 })).toHaveLength(1);
    const now = screen
      .getByRole('heading', { name: new RegExp(en.results.groups.qualifyNow) })
      .closest('section') as HTMLElement;
    expect(within(now).queryAllByRole('heading', { level: 3 })).toHaveLength(0);
    const institution = screen.getByLabelText(en.colleges.filters.institution) as HTMLSelectElement;
    expect([...institution.options].map((o) => o.textContent)).toEqual([
      en.colleges.filters.allInstitutions,
      'Example College',
    ]);
    fireEvent.change(screen.getByLabelText(en.colleges.filters.type), {
      target: { value: 'university' },
    });
    expect(
      within(planBSection()).queryByRole('heading', { level: 3, name: 'Example College' }),
    ).toBeNull();
  });

  it('shows a Grade 10 learner NC(V) courses in their own group, never Plan B', async () => {
    showWith('grade-10-final');
    expect(screen.queryByRole('button', { name: new RegExp(en.results.groups.planB) })).toBeNull();
    const toggle = screen.getByRole('button', {
      name: new RegExp(en.colleges.groupAfter(9).replace(/[()]/g, '\\$&')),
    });
    expect(toggle.textContent).toContain('(1)');
    fireEvent.click(toggle);
    expect(await screen.findByRole('heading', { level: 3, name: 'Example College' })).toBeTruthy();
    // Where NC(V) starts comes from the catalogue's record (A1-84).
    expect(document.body.textContent).toContain(en.colleges.programmeTypeEntry(9, null));
  });

  it('names no grade where no record says where NC(V) starts (A1-84, gotcha 40)', async () => {
    const bare = collegeViewOf(
      { colleges: [COLLEGE], programmes: [TOURISM, HOSPITALITY, N4], notices: [NOTICE] },
      TODAY,
      { includeDrafts: true },
    );
    showWith('grade-10-final', bare);
    const toggle = screen.getByRole('button', { name: new RegExp(`^${en.colleges.groupNoEntry}`) });
    fireEvent.click(toggle);
    expect(await screen.findByRole('heading', { level: 3, name: 'Example College' })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Starts after/);
  });

  it('names each filter by its label alone, not the option chosen in it', () => {
    showWith('grade-11-final');
    expect(screen.getByRole('combobox', { name: en.colleges.filters.institution }).id).toBe(
      'filter-institution',
    );
    expect(screen.getByRole('combobox', { name: en.colleges.filters.type }).id).toBe('filter-type');
    // A label wrapped around a select puts the chosen option into its name in browsers ("Institution
    // All institutions"; jsdom doesn't), which failed the phone E2E: the label sits beside it.
    for (const id of ['filter-institution', 'filter-type']) {
      expect(document.getElementById(id)?.closest('label')).toBeNull();
    }
  });

  it('links "Is this college registered?"', () => {
    showWith('grade-11-final');
    expect(screen.getByRole('link', { name: en.colleges.checkLink }).getAttribute('href')).toBe(
      '/colleges/registered',
    );
  });
});
