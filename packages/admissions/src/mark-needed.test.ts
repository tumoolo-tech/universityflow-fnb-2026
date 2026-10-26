import {
  type AssessmentComponent,
  type AssessmentRules,
  catalogueView,
  RAW_CATALOGUE,
} from '@universityflow/catalogue';
import { describe, expect, it } from 'vitest';
import { type ConfirmedOutlineScheme, type ResolvedScheme, resolveScheme } from './assessment';
import {
  dpStatus,
  finalMark,
  InvalidAssessmentMarksError,
  type LearnerMarks,
  markNeeded,
  type NeededResult,
  percentFromScore,
  shownNeeded,
  supplementaryOutlook,
  yearMark,
} from './mark-needed';

/** Synthetic schemes and marks only (hard rule 4). */
const TODAY = new Date('2028-03-01T08:00:00Z');
const VERIFIED = { verifiedOn: '2028-02-01', verifiedBy: 'Test Verifier' } as const;

/** A scheme from a synthetic confirmed outline and (optionally) synthetic general rules. */
function scheme(
  outline: Partial<ConfirmedOutlineScheme>,
  rules: Partial<AssessmentRules> = {},
): ResolvedScheme {
  const general: AssessmentRules = {
    sourceUrl: 'https://www.uct.ac.za/test-rules/',
    academicYear: 2028,
    ...VERIFIED,
    id: 'uct-test-general',
    universityId: 'uct',
    title: 'Test Rules',
    otherRules: [{ quote: 'Test rule.' }],
    ...rules,
  };
  return resolveScheme({
    module: { universityId: 'uct', code: 'TST1001F', academicYear: 2028 },
    faculty: 'Commerce',
    outline: { moduleCode: 'TST1001F', academicYear: 2028, confirmedOn: '2028-02-20', ...outline },
    records: { assessmentRules: [general], moduleAssessments: [] },
    today: TODAY,
    includeDrafts: false,
  });
}

const PASS_50 = { passMark: { value: 50, quote: 'The pass mark is 50%.' } };
const C = (
  name: string,
  kind: AssessmentComponent['kind'],
  weight: number,
  extra: Partial<AssessmentComponent> = {},
): AssessmentComponent => ({ name, kind, weight, ...extra });

const FORTY_SIXTY = scheme(
  {
    components: [C('Tests', 'test', 40), C('Exam', 'exam', 60)],
    yearMarkWeight: 40,
    examWeight: 60,
  },
  PASS_50,
);
const PASS: { kind: 'pass-mark' } = { kind: 'pass-mark' };
const own = (percent: number) => ({ kind: 'own' as const, percent });
const marks = (...m: Array<[string, number]>): LearnerMarks => ({
  components: m.map(([component, percent]) => ({ component, percent })),
});

describe('marks the learner typed: refused when bad, never repaired', () => {
  it.each([-1, 101, Number.NaN, Number.POSITIVE_INFINITY])('refuses %s', (percent) => {
    expect(() => yearMark(FORTY_SIXTY, marks(['Tests', percent]))).toThrow(
      InvalidAssessmentMarksError,
    );
  });

  it('accepts decimals, refuses an unknown component, a second mark, and an exam mark as coursework', () => {
    expect(yearMark(FORTY_SIXTY, marks(['Tests', 62.5]))).toMatchObject({
      kind: 'known',
      yearMark: 62.5,
    });
    expect(() => yearMark(FORTY_SIXTY, marks(['Quizzes', 60]))).toThrow(/Quizzes/);
    expect(() => yearMark(FORTY_SIXTY, marks(['Tests', 60], ['tests', 70]))).toThrow(
      InvalidAssessmentMarksError,
    );
    expect(() => yearMark(FORTY_SIXTY, marks(['Exam', 60]))).toThrow(InvalidAssessmentMarksError);
  });

  it('converts a raw score in code, refusing nonsense', () => {
    expect(percentFromScore(18, 24)).toBe(75);
    expect(() => percentFromScore(25, 24)).toThrow(InvalidAssessmentMarksError);
    expect(() => percentFromScore(5, 0)).toThrow(InvalidAssessmentMarksError);
    expect(() => percentFromScore(-1, 10)).toThrow(InvalidAssessmentMarksError);
  });
});

describe('yearMark', () => {
  const three = scheme(
    {
      components: [
        C('Tests', 'test', 20, { bestOf: { count: 2, of: 3 } }),
        C('Practicals', 'practical', 20, { subminimum: 45 }),
        C('Exam', 'exam', 60),
      ],
      yearMarkWeight: 40,
      examWeight: 60,
    },
    PASS_50,
  );

  it('weights what is written and reports what is outstanding, never assumed', () => {
    const y = yearMark(three, marks(['Practicals', 70]));
    expect(y).toMatchObject({ kind: 'known', complete: false, yearMark: 70, earned: 14 });
    if (y.kind !== 'known') throw new Error('unreachable');
    expect(y.outstanding).toEqual(['Tests']);
    expect(y.outstandingWeight).toBe(20);
  });

  it('best 2 of 3 drops the lowest', () => {
    const y = yearMark(
      three,
      marks(['Tests', 40], ['Tests', 80], ['Tests', 60], ['Practicals', 50]),
    );
    // Tests: best two are 80 and 60 → 70; (20·70 + 20·50) / 40 = 60.
    expect(y).toMatchObject({ kind: 'known', complete: true, yearMark: 60 });
  });

  it('a best-of with fewer attempts than it counts is partly outstanding', () => {
    const y = yearMark(three, marks(['Tests', 80], ['Practicals', 50]));
    // One of two counted attempts written: 10 of the 20 weight.
    expect(y).toMatchObject({
      kind: 'known',
      complete: false,
      earned: 8 + 10,
      outstandingWeight: 10,
    });
  });

  it('flags a component below its subminimum', () => {
    const y = yearMark(three, marks(['Practicals', 40]));
    expect(y).toMatchObject({ kind: 'known', belowSubminimum: ['Practicals'] });
  });

  it('applies a university’s component subminimum to big enough components (Wits G7.10 shape)', () => {
    const s = scheme(
      { components: [C('Project', 'project', 30), C('Quiz', 'test', 10), C('Exam', 'exam', 60)] },
      { componentSubminimum: { value: 35, fromWeight: 25, quote: 'Test component rule.' } },
    );
    expect(yearMark(s, marks(['Project', 30], ['Quiz', 10]))).toMatchObject({
      belowSubminimum: ['Project'],
    });
  });

  it('a scheme printed only as year mark against exam takes the learner’s year mark', () => {
    const s = scheme({ yearMarkWeight: 50, examWeight: 50 }, PASS_50);
    expect(yearMark(s, { yearMark: 55 })).toMatchObject({
      kind: 'known',
      complete: true,
      earned: 27.5,
    });
    expect(yearMark(s, {})).toMatchObject({
      kind: 'known',
      complete: false,
      outstanding: ['year mark'],
    });
    expect(() => yearMark(s, marks(['Tests', 50]))).toThrow(InvalidAssessmentMarksError);
  });

  it('gotcha 40: no published weighting is "unknown", never an assumed split', () => {
    expect(yearMark(scheme({}, PASS_50), {})).toEqual({
      kind: 'unknown',
      reason: 'weighting-not-published',
    });
  });
});

describe('dpStatus', () => {
  const withDp = (min?: number) =>
    scheme({
      components: [C('Test 1', 'test', 20), C('Test 2', 'test', 20), C('Exam', 'exam', 60)],
      yearMarkWeight: 40,
      examWeight: 60,
      dpRequirement: {
        ...(min === undefined ? {} : { minimumYearMark: min }),
        conditions: ['80% attendance'],
      },
    });

  it('met or not met once every component is written', () => {
    expect(dpStatus(withDp(40), marks(['Test 1', 50], ['Test 2', 40])).status).toBe('met');
    expect(dpStatus(withDp(40), marks(['Test 1', 30], ['Test 2', 40])).status).toBe('not-met');
  });

  it('on track, at risk, or out of reach while components are outstanding', () => {
    expect(dpStatus(withDp(40), marks(['Test 1', 45])).status).toBe('on-track');
    expect(dpStatus(withDp(40), marks(['Test 1', 20])).status).toBe('at-risk');
    expect(dpStatus(withDp(70), marks(['Test 1', 30])).status).toBe('not-met');
  });

  it('the quoted conditions are the learner’s checklist, never judged', () => {
    const d = dpStatus(withDp(40), marks(['Test 1', 50], ['Test 2', 40]));
    expect(d.conditions).toEqual(['80% attendance']);
  });

  it('gotcha 40: no DP rule, no DP number, or nothing written yet is "unknown"', () => {
    expect(dpStatus(FORTY_SIXTY, marks(['Tests', 60]))).toMatchObject({
      status: 'unknown',
      reason: 'not-published',
    });
    expect(dpStatus(withDp(), marks(['Test 1', 60]))).toMatchObject({
      status: 'unknown',
      reason: 'no-number',
    });
    expect(dpStatus(withDp(40), {})).toMatchObject({
      status: 'unknown',
      reason: 'nothing-written',
    });
  });
});

describe('markNeeded: worked examples', () => {
  it('a 60% class mark at 40/60 needs 43.33… in the exam to pass: shown 44, rounded up and labelled', () => {
    const r = markNeeded(FORTY_SIXTY, marks(['Tests', 60]), PASS);
    expect(r.readings).toHaveLength(1);
    const [reading] = r.readings;
    expect(reading?.reading).toBe('all-written');
    expect(reading?.result).toMatchObject({
      kind: 'needed',
      bindsOn: 'target',
      shown: 44,
      roundedUp: true,
    });
    expect(reading?.result).toHaveProperty('exact');
    expect((reading?.result as { exact: number } | undefined)?.exact).toBeCloseTo(43.333, 2);
  });

  it('the learner’s own target: 60% needs 60 → (60 − 24) / 0.6 = 60', () => {
    expect(
      markNeeded(FORTY_SIXTY, marks(['Tests', 60]), own(60)).readings[0]?.result,
    ).toMatchObject({
      kind: 'needed',
      shown: 60,
      roundedUp: false,
    });
  });

  it('impossible above 100, already secured when no exam mark is needed', () => {
    expect(markNeeded(FORTY_SIXTY, marks(['Tests', 10]), own(80)).readings[0]?.result.kind).toBe(
      'impossible',
    );
    expect(markNeeded(FORTY_SIXTY, marks(['Tests', 100]), own(40)).readings[0]?.result.kind).toBe(
      'already-secured',
    );
  });

  it('an exam subminimum binds when the target is already reached', () => {
    const s = scheme(
      {
        components: [C('Tests', 'test', 60), C('Exam', 'exam', 40)],
        yearMarkWeight: 60,
        examWeight: 40,
        examSubminimum: 40,
      },
      PASS_50,
    );
    expect(markNeeded(s, marks(['Tests', 90]), PASS).readings[0]?.result).toMatchObject({
      kind: 'needed',
      bindsOn: 'subminimum',
      shown: 40,
    });
    // And it is the higher of the two otherwise.
    expect(markNeeded(s, marks(['Tests', 50]), PASS).readings[0]?.result).toMatchObject({
      shown: 50,
      bindsOn: 'target',
    });
  });

  it('says when the exam subminimum isn’t published, rather than assuming none', () => {
    const r = markNeeded(FORTY_SIXTY, marks(['Tests', 60]), PASS);
    expect(r.examSubminimum).toBe('not-published');
  });

  it('a university’s own printed rounding is applied (half-up: 49.5 passes)', () => {
    const s = scheme(
      {
        components: [C('Tests', 'test', 40), C('Exam', 'exam', 60)],
        yearMarkWeight: 40,
        examWeight: 60,
      },
      {
        ...PASS_50,
        rounding: { method: 'half-up', quote: 'Rounded to the nearest whole number.' },
      },
    );
    // (49.5 − 24) / 0.6 = 42.5 → 43.
    expect(markNeeded(s, marks(['Tests', 60]), PASS).readings[0]?.result).toMatchObject({
      shown: 43,
    });
  });

  it('two labelled readings while coursework is outstanding', () => {
    const s = scheme(
      {
        components: [C('Test 1', 'test', 20), C('Test 2', 'test', 20), C('Exam', 'exam', 60)],
        yearMarkWeight: 40,
        examWeight: 60,
      },
      PASS_50,
    );
    const r = markNeeded(s, marks(['Test 1', 70]), PASS);
    expect(r.readings.map((x) => x.reading)).toEqual(['remaining-like-average', 'nothing-more']);
    // Like average: 14 + 14 = 28 → (50 − 28)/0.6 = 36.67 → 37. Nothing more: (50 − 14)/0.6 = 60.
    expect(r.readings[0]?.result).toMatchObject({ shown: 37 });
    expect(r.readings[1]?.result).toMatchObject({ shown: 60 });
  });

  it('a continuously assessed module: the average needed over everything still to write', () => {
    const s = scheme(
      { components: [C('Essay 1', 'assignment', 50), C('Essay 2', 'assignment', 50)] },
      PASS_50,
    );
    expect(markNeeded(s, marks(['Essay 1', 40]), PASS).readings).toEqual([
      { reading: 'all-remaining', result: expect.objectContaining({ kind: 'needed', shown: 60 }) },
    ]);
  });

  it('a component below its subminimum blocks a pass whatever the total', () => {
    const s = scheme(
      {
        components: [C('Practicals', 'practical', 40, { subminimum: 45 }), C('Exam', 'exam', 60)],
        yearMarkWeight: 40,
        examWeight: 60,
      },
      PASS_50,
    );
    expect(markNeeded(s, marks(['Practicals', 44]), PASS).readings[0]?.result).toEqual({
      kind: 'blocked',
      components: ['Practicals'],
    });
  });

  it('gotcha 40: no pass mark or no weighting gives "unknown", never 50 or an assumed split', () => {
    const noPass = scheme({
      components: [C('Tests', 'test', 40), C('Exam', 'exam', 60)],
      yearMarkWeight: 40,
      examWeight: 60,
    });
    const r = markNeeded(noPass, marks(['Tests', 60]), PASS);
    expect(r.readings).toEqual([
      { reading: 'all-written', result: { kind: 'unknown', reason: 'pass-mark-not-published' } },
    ]);
    expect(JSON.stringify(r)).not.toContain('50');
    expect(markNeeded(scheme({}, PASS_50), {}, PASS).readings[0]?.result).toEqual({
      kind: 'unknown',
      reason: 'weighting-not-published',
    });
    // The learner's own target still works without a published pass mark.
    expect(markNeeded(noPass, marks(['Tests', 60]), own(60)).readings[0]?.result.kind).toBe(
      'needed',
    );
  });

  // A1-82: "not published" never becomes "none" (gotcha 40), and no "secured" beside a DP not met.
  it('already secured says when the exam subminimum isn’t published, and when the DP isn’t met', () => {
    const sixtyForty = (extra: Partial<ConfirmedOutlineScheme> = {}) =>
      scheme(
        {
          components: [C('Tests', 'test', 60), C('Exam', 'exam', 40)],
          yearMarkWeight: 60,
          examWeight: 40,
          ...extra,
        },
        PASS_50,
      );
    // 90% of 60 is 54: the pass mark is reached on coursework alone.
    expect(markNeeded(sixtyForty(), marks(['Tests', 90]), PASS).readings[0]?.result).toEqual({
      kind: 'already-secured',
      examSubminimum: 'not-published',
    });
    // A DP of 95% the coursework doesn't reach: the learner may not write the exam at all.
    expect(
      markNeeded(sixtyForty({ dpRequirement: { minimumYearMark: 95 } }), marks(['Tests', 90]), PASS)
        .readings[0]?.result,
    ).toEqual({
      kind: 'already-secured',
      examSubminimum: 'not-published',
      examAdmission: 'not-met',
    });
    // A DP that is met says nothing more.
    expect(
      markNeeded(sixtyForty({ dpRequirement: { minimumYearMark: 50 } }), marks(['Tests', 90]), PASS)
        .readings[0]?.result,
    ).toEqual({ kind: 'already-secured', examSubminimum: 'not-published' });
    // A module with no exam has no exam subminimum to wonder about.
    const continuous = scheme(
      { components: [C('Essay 1', 'assignment', 50), C('Essay 2', 'assignment', 50)] },
      PASS_50,
    );
    expect(
      markNeeded(continuous, marks(['Essay 1', 100], ['Essay 2', 60]), PASS).readings[0]?.result,
    ).toEqual({ kind: 'already-secured' });
  });

  it('refuses a target outside 0–100', () => {
    expect(() => markNeeded(FORTY_SIXTY, {}, own(101))).toThrow(InvalidAssessmentMarksError);
  });
});

describe('supplementaryOutlook', () => {
  const supp = (s: Partial<NonNullable<AssessmentRules['supplementary']>>) =>
    scheme(
      {
        components: [C('Tests', 'test', 40), C('Exam', 'exam', 60)],
        yearMarkWeight: 40,
        examWeight: 60,
      },
      { ...PASS_50, supplementary: { quote: 'Test supplementary rule.', ...s } },
    );

  it('the snippets’ shape: a 45% final under "40–49, capped at 50" may qualify, capped at 50', () => {
    const s = supp({
      eligibleFinalMark: { from: 40, to: 49 },
      result: { kind: 'capped-at', cap: 50 },
    });
    expect(supplementaryOutlook(s, 45)).toMatchObject({
      kind: 'may-qualify',
      result: { kind: 'capped-at', cap: 50 },
    });
    expect(supplementaryOutlook(s, 39)).toMatchObject({ kind: 'below-range' });
    expect(supplementaryOutlook(s, 52)).toMatchObject({ kind: 'above-range' });
  });

  it('"at least 45%" with no upper bound runs up to the pass mark, and needs it', () => {
    const s = supp({ eligibleFinalMark: { from: 45 } });
    expect(supplementaryOutlook(s, 49.9).kind).toBe('may-qualify');
    expect(supplementaryOutlook(s, 50).kind).toBe('above-range');
    const noPass = scheme(
      {
        components: [C('Tests', 'test', 40), C('Exam', 'exam', 60)],
        yearMarkWeight: 40,
        examWeight: 60,
      },
      { supplementary: { quote: 'Test.', eligibleFinalMark: { from: 45 } } },
    );
    expect(supplementaryOutlook(noPass, 47)).toEqual(
      expect.objectContaining({ kind: 'unknown', reason: 'pass-mark-not-published' }),
    );
  });

  // A1-85: a range printed in whole percents covers the marks between them: "45–49%" with a pass
  // mark of 50 takes 49.3, as it takes 49.
  it('a printed upper bound covers everything below the next whole percent, and below the pass mark', () => {
    const s = supp({ eligibleFinalMark: { from: 45, to: 49 } });
    expect(supplementaryOutlook(s, 49.3).kind).toBe('may-qualify');
    expect(supplementaryOutlook(s, 49.99).kind).toBe('may-qualify');
    expect(supplementaryOutlook(s, 50).kind).toBe('above-range');
    // "40–44%" stops before 45, pass mark or not.
    const low = supp({ eligibleFinalMark: { from: 40, to: 44 } });
    expect(supplementaryOutlook(low, 44.5).kind).toBe('may-qualify');
    expect(supplementaryOutlook(low, 45).kind).toBe('above-range');
    // A bound printed with decimals is taken as printed.
    const exact = supp({ eligibleFinalMark: { from: 45, to: 49.5 } });
    expect(supplementaryOutlook(exact, 49.5).kind).toBe('may-qualify');
    expect(supplementaryOutlook(exact, 49.6).kind).toBe('above-range');
  });

  it('gotcha 40: no cap printed means the result is not published, never "capped at 50"', () => {
    const s = supp({ eligibleFinalMark: { from: 45, to: 49 } });
    const o = supplementaryOutlook(s, 46);
    expect(o).toMatchObject({ kind: 'may-qualify' });
    expect(o).not.toHaveProperty('result');
  });

  it('not offered, or no rule at all', () => {
    expect(supplementaryOutlook(supp({ offered: false }), 46).kind).toBe('not-offered');
    expect(supplementaryOutlook(FORTY_SIXTY, 46)).toEqual(
      expect.objectContaining({ kind: 'unknown', reason: 'not-published' }),
    );
    expect(supplementaryOutlook(supp({}), 46)).toEqual(
      expect.objectContaining({ kind: 'unknown', reason: 'range-not-published' }),
    );
  });

  it('finalMark combines the year mark and the exam', () => {
    expect(finalMark(FORTY_SIXTY, marks(['Tests', 60]), 50)).toBe(54);
    expect(finalMark(scheme({}, PASS_50), {}, 50)).toBeUndefined();
    expect(finalMark(FORTY_SIXTY, {}, 50)).toBeUndefined();
  });
});

describe('worked examples from the drafted records (preview only: drafts until verified)', () => {
  const view = catalogueView(new Date('2026-10-24T08:00:00Z'), { includeDrafts: true });
  const resolve = (
    universityId: 'uct' | 'ukzn' | 'tut' | 'wits',
    code: string,
    faculty: string,
    outline?: ConfirmedOutlineScheme,
  ) =>
    resolveScheme({
      module: { universityId, code, academicYear: 2026 },
      faculty,
      ...(outline ? { outline } : {}),
      records: view,
      today: new Date('2026-10-24T08:00:00Z'),
      includeDrafts: true,
    });

  it('UCT ECO1010F: a 55% year mark at 50/50 needs 45% in the exam (Handbook 3’s 50%), DP at 40%', () => {
    const s = resolve('uct', 'ECO1010S', 'Commerce');
    expect(s.includesDrafts).toBe(true);
    expect(s.passMark?.source.level).toBe('university');
    expect(markNeeded(s, { yearMark: 55 }, PASS).readings[0]?.result).toMatchObject({ shown: 45 });
    expect(dpStatus(s, { yearMark: 38 }).status).toBe('not-met');
    // Commerce: 45–49% may lead to a supplementary, recorded only as a pass or a fail.
    expect(supplementaryOutlook(s, 47)).toMatchObject({
      kind: 'may-qualify',
      result: { kind: 'recorded-pass-or-fail' },
    });
  });

  it('UKZN COMP100: a 70% class mark needs 30% for 50, but the 40% exam subminimum binds', () => {
    const s = resolve('ukzn', 'COMP100', 'College of Agriculture, Engineering and Science');
    const m = marks(
      ['Theory tests (at least 2)', 70],
      ['Practical test (at least 1)', 70],
      ['Practicals/assignments/quizzes/tests', 70],
    );
    expect(markNeeded(s, m, PASS).readings[0]?.result).toMatchObject({
      shown: 40,
      bindsOn: 'subminimum',
    });
    // UKZN prints no supplementary cap: may qualify from 40%, result not published.
    const o = supplementaryOutlook(s, 44);
    expect(o.kind).toBe('may-qualify');
    expect(o).not.toHaveProperty('result');
  });

  it('UKZN MATH130 takes the learner’s own college’s DP (CAES 40%, CLMS 35%)', () => {
    expect(
      resolve('ukzn', 'MATH130', 'College of Agriculture, Engineering and Science').examAdmission
        ?.value.minimumYearMark,
    ).toBe(40);
    expect(
      resolve('ukzn', 'MATH130', 'College of Law and Management Studies').examAdmission?.value
        .minimumYearMark,
    ).toBe(35);
  });

  it('TUT, from the learner’s outline: predicate 40%, 40% exam subminimum, supplementary from 45%', () => {
    const outline: ConfirmedOutlineScheme = {
      moduleCode: 'TST1A11',
      academicYear: 2026,
      confirmedOn: '2026-03-01',
      yearMarkWeight: 50,
      examWeight: 50,
    };
    const s = resolve('tut', 'TST1A11', 'Engineering and the Built Environment', outline);
    expect(dpStatus(s, { yearMark: 39 }).status).toBe('not-met');
    expect(markNeeded(s, { yearMark: 80 }, PASS).readings[0]?.result).toMatchObject({
      shown: 40,
      bindsOn: 'subminimum',
    });
    expect(supplementaryOutlook(s, 46)).toMatchObject({
      kind: 'may-qualify',
      result: { kind: 'replaces-exam' },
    });
  });

  it('Wits: 50% and 35% subminima "unless specified otherwise in a course outline"; Science offers no supplementary', () => {
    const outline: ConfirmedOutlineScheme = {
      moduleCode: 'TST1000A',
      academicYear: 2026,
      confirmedOn: '2026-03-01',
      components: [C('Project', 'project', 30), C('Exam', 'exam', 70)],
    };
    const s = resolve('wits', 'TST1000A', 'Science', outline);
    expect(yearMark(s, marks(['Project', 34]))).toMatchObject({ belowSubminimum: ['Project'] });
    expect(markNeeded(s, marks(['Project', 60]), PASS).readings[0]?.result).toMatchObject({
      shown: 46,
    });
    expect(supplementaryOutlook(s, 45).kind).toBe('not-offered');
  });

  it('UP and UJ: rules not read yet, so every answer is "unknown"', () => {
    const outline: ConfirmedOutlineScheme = {
      moduleCode: 'TST100',
      academicYear: 2026,
      confirmedOn: '2026-03-01',
      yearMarkWeight: 50,
      examWeight: 50,
    };
    for (const id of ['up', 'uj'] as const) {
      const s = resolveScheme({
        module: { universityId: id, code: 'TST100', academicYear: 2026 },
        faculty: 'Law',
        outline,
        records: view,
        today: new Date('2026-10-24T08:00:00Z'),
        includeDrafts: true,
      });
      expect(markNeeded(s, { yearMark: 60 }, PASS).readings[0]?.result).toEqual({
        kind: 'unknown',
        reason: 'pass-mark-not-published',
      });
      expect(supplementaryOutlook(s, 45).kind).toBe('unknown');
    }
  });

  it('every drafted module scheme resolves and calculates without throwing', () => {
    for (const m of RAW_CATALOGUE.moduleAssessments ?? []) {
      const s = resolveScheme({
        module: { universityId: m.universityId, code: m.code, academicYear: m.academicYear },
        faculty: m.faculty ?? 'none',
        records: { assessmentRules: [], moduleAssessments: [m] },
        today: TODAY,
        includeDrafts: true,
      });
      expect(() => markNeeded(s, {}, own(50))).not.toThrow();
    }
  });
});

/** A small seeded random generator, so a failing case can be replayed (as registration.test.ts). */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Case {
  scheme: ResolvedScheme;
  marks: LearnerMarks;
  /** Every coursework component written, so there is one reading. */
  complete: boolean;
  subminimum: number | undefined;
  examWeight: number;
}

/** A random valid scheme (weights summing to 100), pass mark, maybe a subminimum, and marks. */
function randomCase(seed: number, rounding?: 'half-up'): Case {
  const random = mulberry32(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));
  const examWeight = int(1, 9) * 10;
  const parts = int(1, 3);
  const course: AssessmentComponent[] = [];
  let left = 100 - examWeight;
  for (let i = 0; i < parts && left > 0; i++) {
    const w = i === parts - 1 ? left : Math.max(1, Math.min(left, int(1, left)));
    left -= w;
    const bestOf = random() < 0.3 ? { bestOf: { count: 2, of: 3 } } : {};
    course.push(C(`Part ${i + 1}`, 'test', w, bestOf));
  }
  if (left > 0) course.push(C('Rest', 'assignment', left));
  const subminimum = random() < 0.5 ? int(30, 50) : undefined;
  const s = scheme(
    {
      components: [...course, C('Exam', 'exam', examWeight)],
      yearMarkWeight: 100 - examWeight,
      examWeight,
      ...(subminimum === undefined ? {} : { examSubminimum: subminimum }),
    },
    {
      passMark: { value: int(40, 60), quote: 'Test pass mark.' },
      ...(rounding ? { rounding: { method: rounding, quote: 'Test rounding.' } } : {}),
    },
  );
  const complete = random() < 0.6;
  const written = course.flatMap((c) => {
    if (!complete && random() < 0.5) return [];
    const n = c.bestOf ? 3 : 1;
    return Array.from({ length: n }, () => ({ component: c.name, percent: int(0, 100) }));
  });
  return { scheme: s, marks: { components: written }, complete, subminimum, examWeight };
}

/** The final mark if every outstanding component scores nothing and the exam scores `exam`. */
function finalWithNothingMore(c: Case, exam: number): number {
  const y = yearMark(c.scheme, c.marks);
  if (y.kind !== 'known') throw new Error('unreachable');
  return y.earned + (c.examWeight * exam) / 100;
}

const nothingMore = (r: ReturnType<typeof markNeeded>): NeededResult =>
  (r.readings.find((x) => x.reading === 'nothing-more' || x.reading === 'all-written')?.result ?? {
    kind: 'unknown',
    reason: 'weighting-not-published',
  }) as NeededResult;
const asNumber = (r: NeededResult) =>
  r.kind === 'already-secured'
    ? 0
    : r.kind === 'needed'
      ? r.exact
      : r.kind === 'impossible'
        ? 1000
        : Number.NaN;

describe('markNeeded: properties over generated schemes and marks', () => {
  const RUNS = 400;

  it('the shown mark reaches the target, and one percent less falls short (unless the subminimum binds)', () => {
    for (let seed = 1; seed <= RUNS; seed++) {
      const c = randomCase(seed);
      const target = mulberry32(seed * 31)() * 100;
      const r = nothingMore(markNeeded(c.scheme, c.marks, own(target)));
      if (r.kind !== 'needed') continue;
      expect(finalWithNothingMore(c, r.shown), `seed ${seed}`).toBeGreaterThanOrEqual(
        target - 1e-9,
      );
      if (c.subminimum !== undefined)
        expect(r.shown, `seed ${seed}`).toBeGreaterThanOrEqual(c.subminimum);
      if (r.bindsOn === 'target' && r.shown - 1 >= (c.subminimum ?? 0)) {
        expect(finalWithNothingMore(c, r.shown - 1), `seed ${seed}`).toBeLessThan(target);
      }
    }
  });

  it('with a printed half-up rounding, the rounded final reaches the target', () => {
    for (let seed = 1; seed <= RUNS; seed++) {
      const c = randomCase(seed, 'half-up');
      const target = Math.round(mulberry32(seed * 37)() * 100);
      const r = nothingMore(markNeeded(c.scheme, c.marks, own(target)));
      if (r.kind !== 'needed' || r.bindsOn !== 'target') continue;
      // 1e-9: the float sum of the weights, not a tolerance on the rule.
      expect(
        Math.floor(finalWithNothingMore(c, r.shown) + 0.5 + 1e-9),
        `seed ${seed}`,
      ).toBeGreaterThanOrEqual(target);
      if (r.shown >= 1) {
        expect(Math.floor(finalWithNothingMore(c, r.shown - 1) + 0.5), `seed ${seed}`).toBeLessThan(
          target,
        );
      }
    }
  });

  it('is monotonic in the target', () => {
    for (let seed = 1; seed <= RUNS; seed++) {
      const c = randomCase(seed);
      const random = mulberry32(seed * 41);
      const [a, b] = [random() * 100, random() * 100].sort((x, y) => x - y) as [number, number];
      const ra = asNumber(nothingMore(markNeeded(c.scheme, c.marks, own(a))));
      const rb = asNumber(nothingMore(markNeeded(c.scheme, c.marks, own(b))));
      if (Number.isNaN(ra) || Number.isNaN(rb)) continue;
      expect(ra, `seed ${seed}`).toBeLessThanOrEqual(rb + 1e-9);
    }
  });

  it('is monotonic in the marks: a higher mark never raises what is needed', () => {
    for (let seed = 1; seed <= RUNS; seed++) {
      const c = randomCase(seed);
      const written = c.marks.components ?? [];
      if (written.length === 0) continue;
      const i = Math.floor(mulberry32(seed * 43)() * written.length);
      const higher = written.map((m, j) =>
        j === i ? { ...m, percent: Math.min(100, m.percent + 10) } : m,
      );
      const target = mulberry32(seed * 47)() * 100;
      const before = asNumber(nothingMore(markNeeded(c.scheme, c.marks, own(target))));
      const after = asNumber(
        nothingMore(markNeeded(c.scheme, { components: higher }, own(target))),
      );
      if (Number.isNaN(before) || Number.isNaN(after)) continue;
      expect(after, `seed ${seed}`).toBeLessThanOrEqual(before + 1e-9);
    }
  });

  it('is "impossible" exactly when more than 100 is needed', () => {
    for (let seed = 1; seed <= RUNS; seed++) {
      const c = randomCase(seed);
      const target = mulberry32(seed * 53)() * 100;
      const r = nothingMore(markNeeded(c.scheme, c.marks, own(target)));
      if (r.kind === 'unknown' || r.kind === 'blocked') continue;
      const exact = Math.max(
        ((target - finalWithNothingMore(c, 0)) * 100) / c.examWeight,
        c.subminimum ?? Number.NEGATIVE_INFINITY,
      );
      expect(r.kind === 'impossible', `seed ${seed}`).toBe(exact > 100);
    }
  });

  it('best-n-of-m never counts a dropped attempt: lowering the lowest of three changes nothing', () => {
    const s = scheme(
      {
        components: [
          C('Tests', 'test', 40, { bestOf: { count: 2, of: 3 } }),
          C('Exam', 'exam', 60),
        ],
        yearMarkWeight: 40,
        examWeight: 60,
      },
      PASS_50,
    );
    for (let seed = 1; seed <= 100; seed++) {
      const random = mulberry32(seed);
      const three = [0, 1, 2].map(() => Math.floor(random() * 101)).sort((a, b) => a - b) as [
        number,
        number,
        number,
      ];
      const a = yearMark(s, marks(['Tests', three[0]], ['Tests', three[1]], ['Tests', three[2]]));
      const b = yearMark(s, marks(['Tests', 0], ['Tests', three[1]], ['Tests', three[2]]));
      expect(a, `seed ${seed}`).toEqual(b);
    }
  });

  it('a component below its subminimum blocks a pass whatever the total', () => {
    const s = scheme(
      {
        components: [
          C('Practicals', 'practical', 20, { subminimum: 45 }),
          C('Tests', 'test', 20),
          C('Exam', 'exam', 60),
        ],
        yearMarkWeight: 40,
        examWeight: 60,
      },
      PASS_50,
    );
    for (let seed = 1; seed <= 100; seed++) {
      const random = mulberry32(seed);
      const prac = Math.floor(random() * 45);
      const tests = Math.floor(random() * 101);
      const r = markNeeded(s, marks(['Practicals', prac], ['Tests', tests]), own(random() * 100));
      expect(r.readings[0]?.result.kind, `seed ${seed}`).toBe('blocked');
    }
  });

  it('shownNeeded rounds up to a whole percent and says when it did', () => {
    expect(shownNeeded(43.0000000001)).toEqual({ shown: 43, roundedUp: false });
    expect(shownNeeded(43.2)).toEqual({ shown: 44, roundedUp: true });
    expect(shownNeeded(43)).toEqual({ shown: 43, roundedUp: false });
  });
});
