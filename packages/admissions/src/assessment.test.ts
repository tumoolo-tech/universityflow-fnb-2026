import type { AssessmentRules, ModuleAssessment } from '@universityflow/catalogue';
import { describe, expect, it } from 'vitest';
import {
  type ConfirmedOutlineScheme,
  InvalidSchemeError,
  type ResolveInput,
  resolveScheme,
} from './assessment';

/** Synthetic records only (hard rule 4): test pages, made-up module codes, no real learner. */
const TODAY = new Date('2028-03-01T08:00:00Z');
const VERIFIED = { verifiedOn: '2028-02-01', verifiedBy: 'Test Verifier' } as const;
const SOURCE = { sourceUrl: 'https://www.uct.ac.za/test-rules/', academicYear: 2028 } as const;

const UNIVERSITY: AssessmentRules = {
  ...SOURCE,
  ...VERIFIED,
  id: 'uct-test-general',
  universityId: 'uct',
  title: 'Test General Rules',
  passMark: { value: 50, quote: 'The pass mark is 50%.', page: 'p. 1' },
  examSubminimum: { value: 35, quote: 'Exam subminimum 35%.' },
  supplementary: {
    eligibleFinalMark: { from: 45, to: 49 },
    result: { kind: 'capped-at', cap: 50 },
    quote: 'Supplementary for 45–49%, capped at 50%.',
  },
  rounding: { method: 'half-up', quote: 'Marks are rounded to the nearest whole number.' },
  otherRules: [{ quote: 'Absent from an exam is a fail.' }],
};

const FACULTY: AssessmentRules = {
  ...SOURCE,
  ...VERIFIED,
  id: 'uct-test-commerce',
  universityId: 'uct',
  faculty: 'Commerce',
  title: 'Test Commerce Rules',
  examSubminimum: { value: 40, quote: 'Exam subminimum 40% in Commerce.' },
};

const MODULE: ModuleAssessment = {
  ...SOURCE,
  ...VERIFIED,
  universityId: 'uct',
  code: 'TST1001F',
  components: [
    { name: 'Tests', kind: 'test', weight: 40 },
    { name: 'Exam', kind: 'exam', weight: 60 },
  ],
  yearMarkWeight: 40,
  examWeight: 60,
  dpRequirement: { minimumYearMark: 40, quote: 'DP: 40% class record.' },
  quote: 'Tests 40%, exam 60%. DP: 40% class record.',
};

const OUTLINE: ConfirmedOutlineScheme = {
  moduleCode: 'TST1001F',
  academicYear: 2028,
  confirmedOn: '2028-02-20',
  components: [
    { name: 'Tests', kind: 'test', weight: 30 },
    { name: 'Assignment', kind: 'assignment', weight: 10 },
    { name: 'Exam', kind: 'exam', weight: 60 },
  ],
  yearMarkWeight: 40,
  examWeight: 60,
};

const input = (over: Partial<ResolveInput> = {}): ResolveInput => ({
  module: { universityId: 'uct', code: 'TST1001F', academicYear: 2028 },
  faculty: 'Commerce',
  records: { assessmentRules: [UNIVERSITY, FACULTY], moduleAssessments: [MODULE] },
  today: TODAY,
  includeDrafts: false,
  ...over,
});

describe('resolveScheme: the most specific source wins, field by field', () => {
  it('takes each field from the most specific level that prints it, with its source', () => {
    const s = resolveScheme(input());
    expect(s.weighting?.source.level).toBe('module');
    expect(s.weighting?.value.examWeight).toBe(60);
    expect(s.examAdmission?.value.minimumYearMark).toBe(40);
    expect(s.examAdmission?.source.level).toBe('module');
    expect(s.examSubminimum).toMatchObject({ value: 40, source: { level: 'faculty' } });
    expect(s.passMark).toMatchObject({ value: 50, source: { level: 'university', page: 'p. 1' } });
    expect(s.passMark?.source.quote).toBe('The pass mark is 50%.');
    expect(s.supplementary?.source.level).toBe('university');
    expect(s.rounding?.value).toBe('half-up');
    expect(s.otherRules.map((r) => r.quote)).toContain('Absent from an exam is a fail.');
    expect(s.includesDrafts).toBe(false);
  });

  it('a faculty record never applies to another faculty’s learners', () => {
    const s = resolveScheme(input({ faculty: 'Science' }));
    expect(s.examSubminimum).toMatchObject({ value: 35, source: { level: 'university' } });
  });

  it('the learner’s confirmed outline wins (D2), with the published value beside it as a conflict', () => {
    const s = resolveScheme(input({ outline: OUTLINE }));
    expect(s.weighting?.source).toMatchObject({ level: 'outline', confirmedOn: '2028-02-20' });
    expect(s.weighting?.value.components).toHaveLength(3);
    expect(s.weighting?.conflict?.source.level).toBe('module');
    expect(s.weighting?.conflict?.value.components).toHaveLength(2);
    // A field the outline doesn't print still comes from the records, with no conflict.
    expect(s.examAdmission?.source.level).toBe('module');
    expect(s.examAdmission?.conflict).toBeUndefined();
  });

  it('no conflict when the outline agrees with the published record', () => {
    const agrees: ConfirmedOutlineScheme = {
      ...OUTLINE,
      components: MODULE.components ?? [],
      passMark: 50,
    };
    const s = resolveScheme(input({ outline: agrees }));
    expect(s.weighting?.conflict).toBeUndefined();
    expect(s.passMark?.source.level).toBe('outline');
    expect(s.passMark?.conflict).toBeUndefined();
  });

  it('uses the learner’s academic year only: a verified record from another year is never used', () => {
    const lastYear = { ...UNIVERSITY, academicYear: 2027, id: 'uct-test-2027' };
    const s = resolveScheme(
      input({
        records: {
          assessmentRules: [lastYear],
          moduleAssessments: [{ ...MODULE, academicYear: 2027 }],
        },
      }),
    );
    expect(s.passMark).toBeUndefined();
    expect(s.weighting).toBeUndefined();
    expect(() => resolveScheme(input({ outline: { ...OUTLINE, academicYear: 2027 } }))).toThrow(
      InvalidSchemeError,
    );
  });

  it('a draft never reaches a learner outside preview; in preview its field carries the draft flag', () => {
    const draft = { ...UNIVERSITY } as AssessmentRules & {
      verifiedOn?: string;
      verifiedBy?: string;
    };
    delete draft.verifiedOn;
    delete draft.verifiedBy;
    const records = { assessmentRules: [draft], moduleAssessments: [] };
    expect(resolveScheme(input({ records })).passMark).toBeUndefined();
    const preview = resolveScheme(input({ records, includeDrafts: true }));
    expect(preview.passMark?.source.draft).toBe(true);
    expect(preview.includesDrafts).toBe(true);
  });

  it('another university’s or another module’s record is never used', () => {
    const wits = {
      ...UNIVERSITY,
      id: 'wits-test',
      universityId: 'wits' as const,
      sourceUrl: 'https://www.wits.ac.za/x/',
    };
    const s = resolveScheme(
      input({
        records: { assessmentRules: [wits], moduleAssessments: [{ ...MODULE, code: 'TST9999F' }] },
      }),
    );
    expect(s.passMark).toBeUndefined();
    expect(s.weighting).toBeUndefined();
  });

  it('refuses an outline whose weights don’t add up, never rescales it', () => {
    const bad = {
      ...OUTLINE,
      components: [
        { name: 'Tests', kind: 'test' as const, weight: 30 },
        { name: 'Exam', kind: 'exam' as const, weight: 60 },
      ],
    };
    expect(() => resolveScheme(input({ outline: bad }))).toThrow(InvalidSchemeError);
  });

  it('refuses an outline for another module', () => {
    expect(() => resolveScheme(input({ outline: { ...OUTLINE, moduleCode: 'TST2002S' } }))).toThrow(
      InvalidSchemeError,
    );
  });

  it('gotcha 40: with no records and no outline, every rule is absent, never a default', () => {
    const s = resolveScheme(input({ records: { assessmentRules: [], moduleAssessments: [] } }));
    expect(s.passMark).toBeUndefined();
    expect(s.examSubminimum).toBeUndefined();
    expect(s.examAdmission).toBeUndefined();
    expect(s.supplementary).toBeUndefined();
    expect(s.weighting).toBeUndefined();
  });
});
