import { isSubjectId } from '@universityflow/catalogue';
import { expect, it } from 'vitest';
import {
  InvalidExamNumberError,
  RESULTS_PERIODS,
  type ResultsSource,
  type SourcedResults,
} from './results-source';

/**
 * The contract every results source meets (planning.md §18.7, D8): the fake that reads the
 * generator's JSON now, and the DBE, IEB or SACAI source once there is an agreement. Each
 * source's test file runs it, so the screens built on the fake can't rely on something the real
 * source won't do.
 */
export interface ResultsSourceUnderTest {
  readonly source: ResultsSource;
  /** An exam number the source holds results for. */
  readonly known: string;
  /** An exam number in the source's own shape that it holds nothing for. */
  readonly unknown: string;
}

/** The only keys a result may carry: marks and where they came from, never who the learner is. */
const RESULT_KEYS = ['examNumber', 'issuer', 'reports'];
const REPORT_KEYS = ['academicYear', 'period', 'subjects'];
const SUBJECT_KEYS = ['nameAsPrinted', 'percent', 'subject'];

/** A 13-digit number in the shape of an SA ID, built at runtime (hard rule 4). */
function idShapedNumber(): string {
  const body = `080612${'0001'}08`;
  for (let check = 0; check <= 9; check++) {
    const digits = `${body}${check}`;
    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
      let d = Number(digits[digits.length - 1 - i]);
      if (i % 2 === 1) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
    }
    if (sum % 10 === 0) return digits;
  }
  throw new Error('unreachable');
}

export function resultsSourceContract(make: () => Promise<ResultsSourceUnderTest>) {
  it('finds the results for a known exam number, from this issuer', async () => {
    const { source, known } = await make();
    const results = await source.find(known);
    expect(results).not.toBeNull();
    expect(results?.examNumber).toBe(known);
    expect(results?.issuer).toBe(source.issuer);
    expect(results?.reports.length).toBeGreaterThan(0);
  });

  it('says whether it is a sample, and only the sample issuer is one', async () => {
    const { source } = await make();
    expect(source.isSample).toBe(source.issuer === 'sample');
  });

  it('returns each report once, in the order the school years run', async () => {
    const { source, known } = await make();
    const results = (await source.find(known)) as SourcedResults;
    const order = results.reports.map((r) => RESULTS_PERIODS.indexOf(r.period));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(new Set(order).size).toBe(order.length);
    const years = results.reports.map((r) => r.academicYear);
    expect(years.every((y) => Number.isInteger(y))).toBe(true);
    expect([...years].sort((a, b) => a - b)).toEqual(years);
  });

  it('gives every mark as a whole percentage for a known subject, each subject once', async () => {
    const { source, known } = await make();
    const results = (await source.find(known)) as SourcedResults;
    for (const report of results.reports) {
      expect(report.subjects.length).toBeGreaterThan(0);
      expect(new Set(report.subjects.map((s) => s.subject)).size).toBe(report.subjects.length);
      for (const s of report.subjects) {
        expect(isSubjectId(s.subject)).toBe(true);
        expect(Number.isInteger(s.percent)).toBe(true);
        expect(s.percent).toBeGreaterThanOrEqual(0);
        expect(s.percent).toBeLessThanOrEqual(100);
        expect(s.nameAsPrinted.trim()).not.toBe('');
      }
    }
  });

  it('carries marks and their source only: no name, school or ID (hard rule 4)', async () => {
    const { source, known } = await make();
    const results = (await source.find(known)) as SourcedResults;
    expect(Object.keys(results).sort()).toEqual(RESULT_KEYS);
    for (const report of results.reports) {
      expect(Object.keys(report).sort()).toEqual(REPORT_KEYS);
      for (const s of report.subjects) expect(Object.keys(s).sort()).toEqual(SUBJECT_KEYS);
    }
  });

  it('returns null for an exam number it holds nothing for', async () => {
    const { source, unknown } = await make();
    expect(await source.find(unknown)).toBeNull();
  });

  it.each([
    ['empty', ''],
    ['spaces', '   '],
    ['an ID-shaped number', idShapedNumber()],
    ['a path', '../learners'],
  ])('refuses an exam number that is %s', async (_label, examNumber) => {
    const { source } = await make();
    await expect(source.find(examNumber)).rejects.toThrow(InvalidExamNumberError);
  });

  it('hands out a copy: changing a result changes nothing in the source', async () => {
    const { source, known } = await make();
    const first = (await source.find(known)) as SourcedResults;
    const before = structuredClone(first);
    const subjects = first.reports[0]?.subjects as unknown as Array<{ percent: number }>;
    if (subjects[0]) subjects[0].percent = 101;
    (first.reports as unknown[]).length = 0;
    expect(await source.find(known)).toEqual(before);
  });
}
