import { describe, expect, it } from 'vitest';
import {
  type AcademicCalendar,
  type AssessmentRules,
  academicCalendarFor,
  academicCalendarSchema,
  assessmentRulesFor,
  assessmentRulesSchema,
  type ModuleAssessment,
  moduleAssessmentFor,
  moduleAssessmentSchema,
  weightingProblems,
} from './assessment';
import { normaliseModuleCode } from './basics';
import { type CatalogueRecords, catalogueViewOf, RAW_CATALOGUE } from './catalogue';
import { isDraft } from './provenance';
import { isUniversitySource } from './records';

/** Synthetic records only (hard rule 4): test pages, made-up module codes. */
const TODAY = new Date('2028-03-01T08:00:00Z');
const VERIFIED = { verifiedOn: '2028-02-01', verifiedBy: 'Test Verifier' } as const;
const SOURCE = { sourceUrl: 'https://www.uct.ac.za/test-rules/', academicYear: 2028 } as const;

const RULES: AssessmentRules = {
  ...SOURCE,
  id: 'uct-test-general-rules',
  universityId: 'uct',
  title: 'Test General Rules 2028',
  passMark: { value: 50, quote: 'The pass mark is 50%.', page: 'p. 1' },
  examSubminimum: { value: 40, quote: 'A subminimum of 40% in the exam.' },
  supplementary: {
    eligibleFinalMark: { from: 45, to: 49 },
    result: { kind: 'capped-at', cap: 50 },
    quote: 'A supplementary for 45-49%, capped at 50%.',
  },
};

const FACULTY_RULES: AssessmentRules = {
  ...SOURCE,
  id: 'uct-test-commerce-rules',
  universityId: 'uct',
  faculty: 'Commerce',
  title: 'Test Commerce Rules 2028',
  examSubminimum: { value: 45, quote: 'A subminimum of 45% in the exam.' },
};

const MODULE: ModuleAssessment = {
  ...SOURCE,
  universityId: 'uct',
  code: 'TST1001F',
  name: 'Test Module',
  components: [
    { name: 'Class tests', kind: 'test', weight: 30, bestOf: { count: 2, of: 3 } },
    { name: 'Practicals', kind: 'practical', weight: 10, subminimum: 45 },
    { name: 'Examination', kind: 'exam', weight: 60 },
  ],
  yearMarkWeight: 40,
  examWeight: 60,
  dpRequirement: { minimumYearMark: 40, quote: 'DP: a class record of 40%.' },
  quote: 'Class tests 30% (best 2 of 3), practicals 10%, exam 60%.',
};

const CALENDAR: AcademicCalendar = {
  ...SOURCE,
  universityId: 'uct',
  examPeriods: [{ label: 'June examinations', dates: { from: '2028-05-29', to: '2028-06-16' } }],
  supplementaryExams: [
    { label: 'November supplementaries', dates: { from: '2028-11-27', to: '2028-12-01' } },
    // The second semester's supplementaries may be written in January of the next year.
    { label: 'January supplementaries', dates: { from: '2029-01-15', to: '2029-01-19' } },
  ],
  dpLists: [{ label: 'DP lists, first semester', date: '2028-05-19' }],
};

describe('assessmentRules records (Phase 6a)', () => {
  it('validates a synthetic record, every field optional (gotcha 40)', () => {
    expect(assessmentRulesSchema.safeParse(RULES).success).toBe(true);
    const bare = {
      ...SOURCE,
      id: 'uct-test-bare',
      universityId: 'uct',
      title: 'Test',
      unread: 'The site refused automated access',
    };
    expect(assessmentRulesSchema.safeParse(bare).success).toBe(true);
  });

  it('refuses a record that says nothing and records nothing unread', () => {
    const empty = { ...SOURCE, id: 'uct-test-empty', universityId: 'uct', title: 'Test' };
    expect(assessmentRulesSchema.safeParse(empty).success).toBe(false);
  });

  it('refuses a source off the university’s own domain', () => {
    const elsewhere = { ...RULES, sourceUrl: 'https://www.example.com/rules.pdf' };
    expect(assessmentRulesSchema.safeParse(elsewhere).success).toBe(false);
  });

  it('refuses an id that doesn’t start with its university', () => {
    expect(assessmentRulesSchema.safeParse({ ...RULES, id: 'wits-test' }).success).toBe(false);
  });

  it('refuses a supplementary range that runs backwards, a cap over 100, or a range with "not offered"', () => {
    const backwards = {
      ...RULES,
      supplementary: { eligibleFinalMark: { from: 49, to: 45 }, quote: 'Test quote' },
    };
    const cap = {
      ...RULES,
      supplementary: { result: { kind: 'capped-at', cap: 101 }, quote: 'Test quote' },
    };
    const contradicts = {
      ...RULES,
      supplementary: { offered: false, eligibleFinalMark: { from: 45 }, quote: 'Test quote' },
    };
    for (const r of [backwards, cap, contradicts]) {
      expect(assessmentRulesSchema.safeParse(r).success).toBe(false);
    }
  });

  it('refuses a printed value without its quote', () => {
    const unquoted = { ...RULES, passMark: { value: 50 } };
    expect(assessmentRulesSchema.safeParse(unquoted).success).toBe(false);
  });
});

describe('moduleAssessment records: weights add up or are refused, never rescaled', () => {
  it('validates the synthetic module', () => {
    expect(moduleAssessmentSchema.safeParse(MODULE).success).toBe(true);
    expect(weightingProblems(MODULE)).toEqual([]);
  });

  it('refuses components that don’t sum to 100 (UCT prints 33.3 + 66.6 for some courses)', () => {
    const short = {
      ...SOURCE,
      universityId: 'uct',
      code: 'TST1003F',
      components: [
        { name: 'Semester mark', kind: 'test', weight: 33.3 },
        { name: 'Exam', kind: 'exam', weight: 66.6 },
      ],
      quote: 'Semester mark counts 33.3% and exam counts 66.6%.',
    };
    expect(moduleAssessmentSchema.safeParse(short).success).toBe(false);
    expect(weightingProblems({ yearMarkWeight: 33.3, examWeight: 66.6 })).not.toEqual([]);
  });

  it('refuses a year/exam split that doesn’t match its components', () => {
    expect(weightingProblems({ ...MODULE, examWeight: 50, yearMarkWeight: 50 })).not.toEqual([]);
  });

  it('refuses an exam weight with no exam component, and only one of the two weights', () => {
    const noExam = {
      components: [
        { name: 'Tests', kind: 'test' as const, weight: 40 },
        { name: 'Project', kind: 'project' as const, weight: 60 },
      ],
      yearMarkWeight: 40,
      examWeight: 60,
    };
    expect(weightingProblems(noExam)).not.toEqual([]);
    expect(weightingProblems({ examWeight: 60 })).not.toEqual([]);
  });

  it('refuses a best-of that can’t be met, and two components with one name', () => {
    const badBest = {
      components: [
        { name: 'Tests', kind: 'test' as const, weight: 40, bestOf: { count: 4, of: 3 } },
        { name: 'Exam', kind: 'exam' as const, weight: 60 },
      ],
    };
    const twice = {
      components: [
        { name: 'Tests', kind: 'test' as const, weight: 40 },
        { name: 'tests', kind: 'exam' as const, weight: 60 },
      ],
    };
    expect(weightingProblems(badBest)).not.toEqual([]);
    expect(weightingProblems(twice)).not.toEqual([]);
  });

  it('accepts a scheme that prints only its DP rule (no weights)', () => {
    const dpOnly = {
      ...SOURCE,
      universityId: 'uct',
      code: 'TST1002S',
      dpRequirement: {
        conditions: ['Attendance of all tutorials.'],
        quote: 'Attendance of all tutorials.',
      },
      quote: 'DP requirements: Attendance of all tutorials.',
    };
    expect(moduleAssessmentSchema.safeParse(dpOnly).success).toBe(true);
  });
});

describe('academicCalendar records', () => {
  it('validates, with the next January allowed for supplementaries only', () => {
    expect(academicCalendarSchema.safeParse(CALENDAR).success).toBe(true);
    const lateExam = {
      ...CALENDAR,
      examPeriods: [{ label: 'Exams', dates: { from: '2029-01-15', to: '2029-01-19' } }],
    };
    expect(academicCalendarSchema.safeParse(lateExam).success).toBe(false);
    const lateSupp = {
      ...CALENDAR,
      supplementaryExams: [{ label: 'Supps', dates: { from: '2029-04-01', to: '2029-04-03' } }],
    };
    expect(academicCalendarSchema.safeParse(lateSupp).success).toBe(false);
  });

  it('refuses an empty calendar and a source off the university’s domain', () => {
    const empty = { ...SOURCE, universityId: 'uct' };
    expect(academicCalendarSchema.safeParse(empty).success).toBe(false);
    expect(
      academicCalendarSchema.safeParse({ ...CALENDAR, sourceUrl: 'https://example.com/x' }).success,
    ).toBe(false);
  });
});

describe('the catalogue view and lookups (hard rule 3: drafts only in preview)', () => {
  const records = (verified: boolean): CatalogueRecords => {
    const v = verified ? VERIFIED : {};
    return {
      ...RAW_CATALOGUE,
      // A university's records are shown only while the university is (as for every record).
      universities: RAW_CATALOGUE.universities.map((u) => (u.id === 'uct' ? { ...u, ...v } : u)),
      assessmentRules: [
        { ...RULES, ...v },
        { ...FACULTY_RULES, ...v },
      ],
      moduleAssessments: [{ ...MODULE, ...v, alternativeCodes: ['TST1001S'] }],
      academicCalendars: [{ ...CALENDAR, ...v }],
    };
  };
  const programme = { universityId: 'uct', faculty: 'Commerce' } as const;

  it('hides drafts from learners and shows them in preview', () => {
    const learners = catalogueViewOf(records(false), TODAY, { includeDrafts: false });
    expect(learners.assessmentRules).toEqual([]);
    expect(learners.moduleAssessments).toEqual([]);
    expect(learners.academicCalendars).toEqual([]);
    const preview = catalogueViewOf(records(false), TODAY, { includeDrafts: true });
    expect(preview.assessmentRules).toHaveLength(2);
    expect(preview.moduleAssessments).toHaveLength(1);
    expect(preview.academicCalendars).toHaveLength(1);
  });

  it('finds the university’s and the faculty’s rules for the learner’s year only', () => {
    const view = catalogueViewOf(records(true), TODAY, { includeDrafts: false });
    const found = assessmentRulesFor(view, programme, 2028);
    expect(found.university?.id).toBe('uct-test-general-rules');
    expect(found.faculty?.id).toBe('uct-test-commerce-rules');
    expect(assessmentRulesFor(view, programme, 2029)).toEqual({});
    expect(
      assessmentRulesFor(view, { ...programme, faculty: 'Science' }, 2028).faculty,
    ).toBeUndefined();
  });

  it('finds a module by its code or an alternative code, normalised, for its year only', () => {
    const view = catalogueViewOf(records(true), TODAY, { includeDrafts: false });
    expect(moduleAssessmentFor(view, 'uct', 'tst 1001f', 2028)?.code).toBe('TST1001F');
    expect(moduleAssessmentFor(view, 'uct', 'TST1001S', 2028)?.code).toBe('TST1001F');
    expect(moduleAssessmentFor(view, 'uct', 'TST1001F', 2027)).toBeUndefined();
    expect(moduleAssessmentFor(view, 'wits', 'TST1001F', 2028)).toBeUndefined();
    expect(academicCalendarFor(view, 'uct', 2028)?.universityId).toBe('uct');
  });

  it('takes the learner’s faculty’s entry when two handbooks print a module differently, never a guess', () => {
    const base = records(true);
    const two: CatalogueRecords = {
      ...base,
      moduleAssessments: [
        {
          ...MODULE,
          ...VERIFIED,
          faculty: 'Commerce',
          dpRequirement: { minimumYearMark: 35, quote: 'DP 35%' },
        },
        { ...MODULE, ...VERIFIED, faculty: 'Science' },
      ],
    };
    const view = catalogueViewOf(two, TODAY, { includeDrafts: false });
    expect(
      moduleAssessmentFor(view, 'uct', 'TST1001F', 2028, 'Commerce')?.dpRequirement
        ?.minimumYearMark,
    ).toBe(35);
    expect(moduleAssessmentFor(view, 'uct', 'TST1001F', 2028, 'Science')?.faculty).toBe('Science');
    expect(moduleAssessmentFor(view, 'uct', 'TST1001F', 2028, 'Humanities')).toBeUndefined();
    expect(moduleAssessmentFor(view, 'uct', 'TST1001F', 2028)).toBeUndefined();
    expect(academicCalendarFor(view, 'uct', 2027)).toBeUndefined();
  });
});

describe('the drafted assessment data (hard rule 3)', () => {
  const rules = RAW_CATALOGUE.assessmentRules ?? [];
  const modules = RAW_CATALOGUE.moduleAssessments ?? [];
  const calendars = RAW_CATALOGUE.academicCalendars ?? [];

  it('every record validates', () => {
    for (const r of rules) expect(assessmentRulesSchema.safeParse(r).error).toBeUndefined();
    for (const m of modules) expect(moduleAssessmentSchema.safeParse(m).error).toBeUndefined();
    for (const c of calendars) expect(academicCalendarSchema.safeParse(c).error).toBeUndefined();
  });

  it('is still a draft: no agent adds verifiedOn or verifiedBy', () => {
    for (const r of [...rules, ...modules, ...calendars]) expect(isDraft(r)).toBe(true);
  });

  it('has general rules for all six universities (UP and UJ marked unread)', () => {
    const universities = new Set(
      rules.filter((r) => r.faculty === undefined).map((r) => r.universityId),
    );
    expect([...universities].sort()).toEqual(['tut', 'uct', 'uj', 'ukzn', 'up', 'wits']);
    for (const id of ['up', 'uj'] as const) {
      const r = rules.find((x) => x.universityId === id);
      expect(r?.unread).toMatch(/browser/);
      expect(r?.passMark).toBeUndefined();
    }
  });

  it('cites each university’s own domain, faculty records name a faculty the programmes use', () => {
    const faculties = new Set(
      RAW_CATALOGUE.programmes.map((p) => `${p.universityId}:${p.faculty}`),
    );
    for (const r of rules) {
      expect(isUniversitySource(r.universityId, r.sourceUrl)).toBe(true);
      if (r.faculty !== undefined) expect(faculties).toContain(`${r.universityId}:${r.faculty}`);
    }
    for (const m of modules) {
      expect(isUniversitySource(m.universityId, m.sourceUrl)).toBe(true);
      if (m.faculty !== undefined) expect(faculties).toContain(`${m.universityId}:${m.faculty}`);
    }
    // One entry per module and year, unless each is labelled with its faculty.
    const seen = new Map<string, number>();
    for (const m of modules.filter((x) => x.faculty === undefined)) {
      const key = `${m.universityId}:${normaliseModuleCode(m.code)}:${m.academicYear}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    for (const [key, n] of seen) expect(n, key).toBe(1);
  });

  it('has module schemes only for modules in a drafted curriculum of the same university', () => {
    const codes = new Set(
      RAW_CATALOGUE.curricula.flatMap((c) =>
        c.modules.flatMap((m) =>
          [m.code, ...(m.alternativeCodes ?? [])].map(
            (code) => `${c.programmeId.split('-')[0]}:${normaliseModuleCode(code)}`,
          ),
        ),
      ),
    );
    expect(modules.length).toBeGreaterThan(60);
    for (const m of modules) {
      expect(codes).toContain(`${m.universityId}:${normaliseModuleCode(m.code)}`);
    }
  });

  it('never invents a default: no module record carries a pass mark its quote doesn’t print', () => {
    for (const m of modules) {
      if (m.passMark !== undefined) expect(m.quote).toContain(`${m.passMark}%`);
      if (m.examSubminimum !== undefined) expect(m.quote).toContain(`${m.examSubminimum}%`);
      if (m.dpRequirement?.minimumYearMark !== undefined) {
        expect(`${m.quote} ${m.dpRequirement.quote}`).toContain(
          `${m.dpRequirement.minimumYearMark}%`,
        );
      }
      for (const c of m.components ?? []) expect(m.quote).toContain(`${c.weight}`);
    }
  });
});
