import {
  type College,
  type CollegeProgramme,
  type CollegeView,
  collegeViewOf,
  type TeachOutNotice,
} from '@universityflow/catalogue';
import { describe, expect, it } from 'vitest';
import { collegeOptions, entryRule } from './colleges';
import type { SubjectMark } from './marks';

/**
 * Plan B with colleges (planning.md §19.1): a college programme beside university courses. Code
 * decides only what the quoted rule makes machine-readable ("Grade 9 pass", "NSC"); anything
 * else is "check the entry rule" with the college's own words and link, never a guessed verdict.
 * Every record here is synthetic.
 */

describe('entryRule: only a whole quote of recognised parts becomes a rule', () => {
  it.each([
    ['Grade 9', { passedGrade: 9, nsc: false }],
    ['Grade 9.', { passedGrade: 9, nsc: false }],
    ['Grade 9 Pass', { passedGrade: 9, nsc: false }],
    ['Passed Grade 9', { passedGrade: 9, nsc: false }],
    ['Minimum Grade 9 Pass', { passedGrade: 9, nsc: false }],
    ['A pass in Grade 9 or equivalent qualification.', { passedGrade: 9, nsc: false }],
    ['Grade 9 Certificate or Grade 9 Pass.', { passedGrade: 9, nsc: false }],
    [
      'Entry requirement: Passed Grade 9 or equivalent qualification',
      { passedGrade: 9, nsc: false },
    ],
    ['Minimum entry requirement: Grade 9', { passedGrade: 9, nsc: false }],
    ['To enter Level 2 – Grade 9 or better', { passedGrade: 9, nsc: false }],
    [
      'Grade 9 or an equivalent qualification to start at NC(V) L2.',
      { passedGrade: 9, nsc: false },
    ],
    ['Grade 10 or NQF Level 1 equivalent', { passedGrade: 10, nsc: false }],
    ['Matric (Grade 12)', { passedGrade: null, nsc: true }],
    ['Grade 12 for N4 admission', { passedGrade: null, nsc: true }],
    ['Entry requirement: N3 or Grade 12.', { passedGrade: null, nsc: true }],
    ['NSC / N3 / Grade 12 for N4.', { passedGrade: null, nsc: true }],
    ['Grade 12 certificate, and/or NC(V) Level 4 certificate', { passedGrade: null, nsc: true }],
    [
      'Report 191 (NATED) N4: a National Senior Certificate (Grade 12)',
      { passedGrade: null, nsc: true },
    ],
    ['Candidates must have a Grade 12 (NSC)', { passedGrade: null, nsc: true }],
  ])('reads %j', (quote, rule) => {
    expect(entryRule(quote)).toEqual(rule);
  });

  it.each([
    null,
    'Grade 9 Pass with 50% of Mathematics',
    'Pass Grade 9 : 55% English',
    'Grade 9 pass and Grade 12',
    'Grade 9 + college requirements set per programme',
    'Successfully completed grade 9 and be at least 16 years old.',
    'MINIMUM Grade 9 pass and 16 years of age',
    'Grade 12 with Mathematics or any other equivalent qualification',
    'Matric with Maths & Physical Science',
    'Gr 11 passed report',
    'N3 or equivalent qualification',
    'N4 – N3 / Level 4',
    'Minimum Admission Requirement : Grade 9,10,11 or 12.',
    'Grade 9 certificate with an APS of 24 or higher',
    'All new applications must be accompanied by: certified ID copy',
  ])('makes no rule of %j (a person reads it)', (quote) => {
    expect(entryRule(quote)).toBeNull();
  });
});

// ── Synthetic records ────────────────────────────────────────────────────────────────────────

const SITE = {
  sourceUrl: 'https://www.example-college.edu.za/',
  academicYear: 2027,
  name: 'Example College',
  abbreviations: ['EXC'],
  website: 'https://www.example-college.edu.za/',
  domains: ['example-college.edu.za'],
  mainTown: 'Kimberley',
  applyUrl: null,
};
const COLLEGE: College = {
  sourceUrl: 'https://www.dhet.gov.za/list.pdf',
  academicYear: 2026,
  id: 'example',
  type: 'public-tvet-college',
  dhetName: 'Example TVET College',
  province: 'Northern Cape',
  site: SITE,
};
const programme = (
  id: string,
  over: Partial<CollegeProgramme> & Pick<CollegeProgramme, 'type' | 'programme'>,
): CollegeProgramme => ({
  sourceUrl: 'https://www.example-college.edu.za/courses/',
  academicYear: 2027,
  id,
  collegeId: 'example',
  nameAtCollege: `${over.programme} (as printed)`,
  campuses: null,
  yearPrinted: null,
  entryQuote: null,
  entryQuoteUrl: null,
  ...over,
});
const quoted = (entryQuote: string) => ({
  entryQuote,
  entryQuoteUrl: 'https://www.example-college.edu.za/courses/x/',
});

const TOURISM = programme('ex-tourism', {
  type: 'ncv',
  programme: 'Tourism',
  ...quoted('Grade 9'),
});
const NO_RULE = programme('ex-hospitality', { type: 'ncv', programme: 'Hospitality' });
const MATHS = programme('ex-it', {
  type: 'ncv',
  programme: 'Information Technology and Computer Science',
  ...quoted('Grade 9 Pass with 50% of Mathematics'),
});
const PARTIAL = programme('ex-safety', {
  type: 'ncv',
  programme: 'Safety in Society',
  ...quoted('Grade 9'),
  entryQuoteIncomplete: true,
});
const GRADE_11 = programme('ex-agri', {
  type: 'ncv',
  programme: 'Primary Agriculture',
  ...quoted('Grade 11 pass'),
});
const N4 = programme('ex-n4-business', {
  type: 'n4-n6',
  programme: 'Business Management',
  ...quoted('Grade 12 for N4 admission'),
});

const NOTICE: TeachOutNotice = {
  sourceUrl: 'https://www.dhet.gov.za/tc.pdf',
  academicYear: 2027,
  id: 'tc-n4',
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
const viewOf = (
  programmes: CollegeProgramme[],
  notices: TeachOutNotice[] = [],
  includeDrafts = true,
): CollegeView =>
  collegeViewOf({ colleges: [COLLEGE], programmes, notices }, TODAY, { includeDrafts });

/** Marks that earn a bachelor's pass. */
const PASSING: SubjectMark[] = [
  { subject: 'english-hl', percent: 70 },
  { subject: 'afrikaans-fal', percent: 65 },
  { subject: 'mathematics', percent: 60 },
  { subject: 'physical-sciences', percent: 60 },
  { subject: 'life-sciences', percent: 60 },
  { subject: 'geography', percent: 60 },
  { subject: 'life-orientation', percent: 70 },
];
/** Marks that earn no NSC. */
const FAILING: SubjectMark[] = PASSING.map((m) => ({ ...m, percent: 20 }));

const grade12 = { kind: 'grade-12-final', marks: PASSING } as const;
const grade10 = { kind: 'grade-10-final', marks: PASSING } as const;
const verdictOf = (options: ReturnType<typeof collegeOptions>, id: string) =>
  options.options.find((o) => o.programmeId === id)?.verdict;

describe('collegeOptions', () => {
  it('never gives a verdict to a programme with no printed rule (hard rule 2)', () => {
    const result = collegeOptions(viewOf([NO_RULE]), grade12, TODAY);
    expect(result.options).toHaveLength(1);
    expect(result.options[0]).toMatchObject({
      programmeId: 'ex-hospitality',
      verdict: 'check-rule',
      rule: null,
      entryQuote: null,
      sourceUrl: 'https://www.example-college.edu.za/courses/',
    });
  });

  it('says "check the entry rule" for a rule code cannot read, with the college’s words and link', () => {
    const [option] = collegeOptions(viewOf([MATHS]), grade12, TODAY).options;
    expect(option).toMatchObject({
      verdict: 'check-rule',
      entryQuote: 'Grade 9 Pass with 50% of Mathematics',
      entryQuoteUrl: 'https://www.example-college.edu.za/courses/x/',
    });
  });

  it('decides nothing from a quote marked as only part of the rule', () => {
    expect(verdictOf(collegeOptions(viewOf([PARTIAL]), grade12, TODAY), 'ex-safety')).toBe(
      'check-rule',
    );
  });

  it('meets a printed "Grade 9" minimum for a learner with a later report', () => {
    expect(verdictOf(collegeOptions(viewOf([TOURISM]), grade12, TODAY), 'ex-tourism')).toBe(
      'meets-minimum',
    );
    expect(verdictOf(collegeOptions(viewOf([TOURISM]), grade10, TODAY), 'ex-tourism')).toBe(
      'meets-minimum',
    );
  });

  it('shows NC(V) to a Grade 10 learner (it starts after Grade 9), but not N4–N6', () => {
    // An N4–N6 course with no printed rule would be "check the entry rule" on an admission report.
    const unruled = programme('ex-n4-unruled', { type: 'n4-n6', programme: 'Tourism' });
    const result = collegeOptions(viewOf([TOURISM, N4, unruled]), grade10, TODAY);
    expect(result.options.map((o) => o.programmeId)).toEqual(['ex-tourism']);
    expect(result.checked).toBe(1);
  });

  it('leaves out a grade the learner has not passed yet', () => {
    const result = collegeOptions(viewOf([GRADE_11]), grade10, TODAY);
    expect(result.options).toEqual([]);
    expect(verdictOf(collegeOptions(viewOf([GRADE_11]), grade12, TODAY), 'ex-agri')).toBe(
      'meets-minimum',
    );
  });

  it('meets an "NSC" rule on admission marks that earn a pass, and leaves it out when they don’t', () => {
    const before = new Date('2025-10-24T10:00:00Z');
    const open = collegeViewOf({ colleges: [COLLEGE], programmes: [N4], notices: [] }, before, {
      includeDrafts: true,
    });
    expect(verdictOf(collegeOptions(open, grade12, before), 'ex-n4-business')).toBe(
      'meets-minimum',
    );
    const failing = { kind: 'grade-12-final', marks: FAILING } as const;
    expect(collegeOptions(open, failing, before).options).toEqual([]);
  });

  it('never offers a programme a national teach-out has closed to first-year students', () => {
    const result = collegeOptions(viewOf([TOURISM, N4], [NOTICE]), grade12, TODAY);
    expect(result.options.map((o) => o.programmeId)).toEqual(['ex-tourism']);
    expect(result.closed).toEqual([{ circular: 'TC 0000', count: 1, sourceUrl: NOTICE.sourceUrl }]);
  });

  it('lists the minimums met first, then the rules to check, by college and name', () => {
    const result = collegeOptions(viewOf([NO_RULE, MATHS, TOURISM]), grade12, TODAY);
    expect(result.options.map((o) => o.programmeId)).toEqual([
      'ex-tourism',
      'ex-hospitality',
      'ex-it',
    ]);
  });

  it('carries the college and the draft label, and says how many were checked', () => {
    const result = collegeOptions(viewOf([TOURISM]), grade12, TODAY);
    expect(result.options[0]).toMatchObject({
      collegeId: 'example',
      collegeName: 'Example College',
      collegeShortName: 'EXC',
      province: 'Northern Cape',
      mainTown: 'Kimberley',
      draft: true,
    });
    expect(result.checked).toBe(1);
    expect(result.includesDrafts).toBe(true);
  });

  it('shows nothing outside preview while every college record is a draft (hard rule 3)', () => {
    const result = collegeOptions(viewOf([TOURISM], [], false), grade12, TODAY);
    expect(result.options).toEqual([]);
    expect(result.checked).toBe(0);
  });
});
