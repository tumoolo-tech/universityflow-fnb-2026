import type { FieldSource, ResolvedScheme } from '@universityflow/admissions';
import { moduleCard } from '@universityflow/content/app';
import { describe, expect, it } from 'vitest';
import {
  asTemplates,
  calculate,
  calculatorFields,
  fill,
  initialValues,
  marksFrom,
  parseMark,
} from './mark-calculator';

/**
 * The mark calculator's view model (Phase 6c, D11, D13): what the learner sees as they type, from
 * packages/admissions only (hard rule 2). A rule the scheme doesn't have shows "not published",
 * never a default (gotcha 40); a needed mark is rounded up and says so; bad input is refused, never
 * repaired. Every scheme here is synthetic.
 */

const w = asTemplates(moduleCard.calculator);
const c = moduleCard.calculator;
const outline: FieldSource = { level: 'outline', academicYear: 2027, draft: false };
const rules: FieldSource = { level: 'university', academicYear: 2027, draft: false };

/** The judge demo's sample shape: Test 1 15, Test 2 15, Assignment 10, exam 60 (subminimum 40). */
function scheme(extra: Partial<ResolvedScheme> = {}): ResolvedScheme {
  return {
    universityId: 'uj',
    moduleCode: 'DEMO1001',
    academicYear: 2027,
    weighting: {
      value: {
        components: [
          { name: 'Test 1', kind: 'test', weight: 15 },
          { name: 'Test 2', kind: 'test', weight: 15 },
          { name: 'Assignment', kind: 'assignment', weight: 10 },
          { name: 'Final examination', kind: 'exam', weight: 60, subminimum: 40 },
        ],
      },
      source: outline,
    },
    passMark: { value: 50, source: rules },
    examAdmission: { value: { term: 'DP', minimumYearMark: 40, conditions: [] }, source: outline },
    examSubminimum: { value: 40, source: outline },
    otherRules: [],
    includesDrafts: false,
    ...extra,
  };
}

/** The values typed into each field, by the component's name (attempt 1). */
function typed(s: ResolvedScheme, byName: Record<string, string>, target = '') {
  const { fields } = calculatorFields(s, w);
  const values: Record<string, string> = {};
  for (const f of fields) values[f.key] = byName[f.component] ?? '';
  return calculate({ scheme: s, values, target }, w);
}

describe('fill and asTemplates', () => {
  it('turn the content’s functions into templates and back, word for word', () => {
    expect(fill(w.needed, 44)).toBe(c.needed(44));
    expect(fill(w.dp['on-track'], 'DP', 40)).toBe(c.dp['on-track']('DP', 40));
    expect(w.title).toBe(c.title);
  });
});

describe('parseMark', () => {
  it('reads a percentage or a score, and refuses anything else (never repaired)', () => {
    expect(parseMark('')).toBeNull();
    expect(parseMark('  ')).toBeNull();
    expect(parseMark('62')).toBe(62);
    expect(parseMark('62.5')).toBe(62.5);
    expect(parseMark('62,5')).toBe(62.5);
    expect(parseMark('62%')).toBe(62);
    expect(parseMark('18/24')).toBe(75);
    expect(parseMark('18 / 24')).toBe(75);
    for (const bad of ['101', '-1', 'abc', '25/24', '1/0', '6 2', '1e2']) {
      expect(parseMark(bad), bad).toBe('invalid');
    }
  });
});

describe('the calculator’s fields', () => {
  it('one per coursework component, and the exam left to the calculator', () => {
    const { mode, fields, examNotes } = calculatorFields(scheme(), w);
    expect(mode).toBe('components');
    expect(fields.map((f) => f.label)).toEqual([
      c.markLabel('Test 1'),
      c.markLabel('Test 2'),
      c.markLabel('Assignment'),
    ]);
    expect(examNotes).toEqual([c.examNote('Final examination')]);
  });

  it('one per attempt for a best-of component', () => {
    const s = scheme({
      weighting: {
        value: {
          components: [
            { name: 'Tests', kind: 'test', weight: 40, bestOf: { count: 2, of: 3 } },
            { name: 'Exam', kind: 'exam', weight: 60 },
          ],
        },
        source: outline,
      },
    });
    expect(calculatorFields(s, w).fields.map((f) => f.label)).toEqual([
      c.attemptLabel('Tests', 1),
      c.attemptLabel('Tests', 2),
      c.attemptLabel('Tests', 3),
    ]);
  });

  it('one year mark for a scheme printed as "year mark X, exam Y"', () => {
    const s = scheme({
      weighting: { value: { yearMarkWeight: 40, examWeight: 60 }, source: rules },
    });
    const { mode, fields } = calculatorFields(s, w);
    expect(mode).toBe('year-mark');
    expect(fields.map((f) => f.label)).toEqual([c.yearMarkLabel]);
  });

  it('none when the weighting isn’t published', () => {
    const { weighting: _w, ...rest } = scheme();
    const s = rest as ResolvedScheme;
    expect(calculatorFields(s, w)).toMatchObject({ mode: 'unknown', fields: [] });
    expect(typed(s, {}).kind).toBe('no-weighting');
    expect(typed(s, {})).toMatchObject({ summary: c.noWeighting });
  });

  it('starts from the learner’s saved marks, and turns typed values back into marks', () => {
    const s = scheme();
    const values = initialValues(calculatorFields(s, w).fields, [
      { component: 'test 1', attempt: 1, percent: 62 },
      { component: 'Assignment', attempt: 1, percent: 70.5 },
    ]);
    expect(Object.values(values)).toEqual(['62', '', '70.5']);
    expect(marksFrom(calculatorFields(s, w).fields, values)).toEqual([
      { component: 'Test 1', attempt: 1, percent: 62 },
      { component: 'Assignment', attempt: 1, percent: 70.5 },
    ]);
  });
});

describe('what the marks mean', () => {
  it('typing marks updates the year mark, the DP status and what the exam needs', () => {
    const before = typed(scheme(), {});
    expect(before.kind).toBe('result');
    if (before.kind !== 'result') return;
    expect(before.yearMark).toBe(c.nothingYet);

    const after = typed(scheme(), { 'Test 1': '60', 'Test 2': '70', Assignment: '70' }, '60');
    if (after.kind !== 'result') throw new Error('no result');
    expect(after.yearMark).toBe(c.yearMarkSoFar('66.3'));
    expect(after.outstanding).toBeNull();
    expect(after.dp.text).toBe(c.dp.met('DP', 40));
    // 26.5 of 40 points in; 60% needs (60 − 26.5) / 0.6 = 55.83 in the exam: 56, rounded up.
    expect(after.target?.readings).toEqual([
      {
        label: c.readings['all-written'],
        lines: [c.needed(56), c.roundedUp('55.8')],
        kind: 'needed',
      },
    ]);
    // The pass mark of 50: (50 − 26.5) / 0.6 = 39.2, so the exam subminimum of 40 sets it.
    expect(after.pass.readings[0]?.lines).toEqual([c.needed(40), c.bindsSubminimum(40)]);
    expect(after.summary).toContain(c.needed(56));
  });

  it('a scheme with no pass mark shows no "needed to pass" number at all (gotcha 40)', () => {
    const { passMark: _p, ...rest } = scheme();
    const view = typed(rest as ResolvedScheme, {
      'Test 1': '60',
      'Test 2': '70',
      Assignment: '70',
    });
    if (view.kind !== 'result') throw new Error('no result');
    expect(view.pass).toEqual({ title: c.passTitle, text: c.passNotPublished, readings: [] });
    expect(JSON.stringify(view.pass)).not.toMatch(/\d/);
    expect(view.summary).not.toMatch(/You need \d/);
  });

  it('labels a needed mark that was rounded up, and not one that wasn’t', () => {
    const exact = typed(scheme(), { 'Test 1': '60', 'Test 2': '60', Assignment: '60' }, '60');
    if (exact.kind !== 'result') throw new Error('no result');
    // 24 of 40 in; 60% needs exactly 60 in the exam: no rounding label.
    expect(exact.target?.readings[0]?.lines).toEqual([c.needed(60)]);
  });

  it('two labelled readings while coursework is still to write', () => {
    const view = typed(scheme(), { 'Test 1': '60' }, '60');
    if (view.kind !== 'result') throw new Error('no result');
    expect(view.outstanding).toBe(c.stillToWrite('Test 2, Assignment'));
    expect(view.target?.readings.map((r) => r.label)).toEqual([
      c.readings['remaining-like-average'],
      c.readings['nothing-more'],
    ]);
    expect(view.dp.text).toBe(c.dp['on-track']('DP', 40));
  });

  it('says honestly when a target can’t be reached any more, and what happens next', () => {
    const s = scheme({
      supplementary: {
        value: { eligibleFinalMark: { from: 45, to: 49 }, result: { kind: 'capped-at', cap: 50 } },
        source: rules,
      },
    });
    const view = typed(s, { 'Test 1': '10', 'Test 2': '10', Assignment: '0' }, '75');
    if (view.kind !== 'result') throw new Error('no result');
    const [reading] = view.target?.readings ?? [];
    expect(reading?.kind).toBe('impossible');
    expect(reading?.lines).toEqual([c.impossible, c.impossibleNext, c.bestFinal('63')]);
    expect(view.dp.text).toBe(c.dp['not-met']('DP', 40));
    expect(view.supplementary).toEqual([c.supplementaryRange(45, 49), c.supplementaryCapped(50)]);
  });

  it('says when a supplementary is in reach for the best final mark', () => {
    const { examSubminimum: _sub, ...withoutSubminimum } = scheme();
    const s: ResolvedScheme = {
      ...withoutSubminimum,
      weighting: {
        value: {
          components: [
            { name: 'Test 1', kind: 'test', weight: 50 },
            { name: 'Exam', kind: 'exam', weight: 50 },
          ],
        },
        source: outline,
      },
      supplementary: { value: { eligibleFinalMark: { from: 45 } }, source: rules },
    };
    const view = typed(s, { 'Test 1': '0' });
    if (view.kind !== 'result') throw new Error('no result');
    const [reading] = view.pass.readings;
    expect(reading?.lines).toEqual([c.needed(100)]);
    expect(view.supplementary).toEqual([
      c.supplementaryBelowPass(45, 50),
      c.supplementaryResultNotPublished,
    ]);
  });

  it('says a subminimum blocks a pass whatever the total', () => {
    const s = scheme({
      weighting: {
        value: {
          components: [
            { name: 'Project', kind: 'project', weight: 40, subminimum: 50 },
            { name: 'Exam', kind: 'exam', weight: 60 },
          ],
        },
        source: outline,
      },
    });
    const view = typed(s, { Project: '30' });
    if (view.kind !== 'result') throw new Error('no result');
    expect(view.pass.readings[0]).toMatchObject({ kind: 'blocked', lines: [c.blocked('Project')] });
  });

  it('refuses a bad mark: it is marked and nothing is worked out until it is fixed', () => {
    const view = typed(scheme(), { 'Test 1': '101', 'Test 2': 'abc' }, '200');
    expect(view.kind).toBe('invalid');
    if (view.kind !== 'invalid') return;
    expect(view.invalid).toHaveLength(2);
    expect(view.targetInvalid).toBe(true);
    expect(view.summary).toBe(c.fixFirst);
  });

  it('says what isn’t published about writing the exam and the supplementary', () => {
    const { examAdmission: _a, ...rest } = scheme();
    const view = typed(rest as ResolvedScheme, { 'Test 1': '60' });
    if (view.kind !== 'result') throw new Error('no result');
    expect(view.dp.text).toBe(c.dp['not-published'](c.admissionTerm));
    expect(view.supplementary).toEqual([c.supplementaryNotPublished]);
  });

  it('lists the DP conditions as the learner’s own checklist, never judged', () => {
    const s = scheme({
      examAdmission: {
        value: { conditions: ['Attend 80% of the practicals'] },
        source: rules,
      },
    });
    const view = typed(s, { 'Test 1': '60' });
    if (view.kind !== 'result') throw new Error('no result');
    expect(view.dp).toEqual({
      text: c.dp['no-number'](c.admissionTerm),
      status: 'unknown',
      conditions: ['Attend 80% of the practicals'],
    });
  });
});
