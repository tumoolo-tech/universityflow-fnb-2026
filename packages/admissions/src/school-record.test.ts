import { describe, expect, it } from 'vitest';
import { InvalidMarksError, type SubjectMark } from './marks';
import { nscPass } from './pass-type';
import { type SchoolRecordInput, schoolRecord } from './school-record';

/** The school record (planning.md §18.7 C2): synthetic marks only (hard rule 4). */

const report = (
  kind: SchoolRecordInput['kind'],
  confirmedAt: string,
  marks: ReadonlyArray<SubjectMark>,
): SchoolRecordInput => ({ kind, confirmedAt: new Date(confirmedAt), marks });

const GRADE_10: ReadonlyArray<SubjectMark> = [
  { subject: 'english-hl', percent: 61 },
  { subject: 'isizulu-fal', percent: 70 },
  { subject: 'mathematics', percent: 52 },
  { subject: 'physical-sciences', percent: 48 },
  { subject: 'life-sciences', percent: 55 },
  { subject: 'geography', percent: 58 },
  { subject: 'life-orientation', percent: 75 },
];
const GRADE_11 = GRADE_10.map((m) => ({ ...m, percent: m.percent + 6 }));

describe('schoolRecord', () => {
  it('is empty with no confirmed report', () => {
    const record = schoolRecord([]);
    expect(record.reports).toEqual([]);
    expect(record.rows).toEqual([]);
  });

  it.each([
    [0, 1],
    [29, 1],
    [30, 2],
    [39, 2],
    [40, 3],
    [49, 3],
    [50, 4],
    [59, 4],
    [60, 5],
    [69, 5],
    [70, 6],
    [79, 6],
    [80, 7],
    [100, 7],
  ])('gives %i%% achievement level %i (every band edge, gotcha 40)', (percent, level) => {
    const record = schoolRecord([
      report('grade-10-final', '2026-12-01', [{ subject: 'mathematics', percent }]),
    ]);
    expect(record.rows[0]?.marks[0]?.level).toBe(level);
    expect(record.rows[0]?.marks[0]?.percent).toBe(percent);
  });

  it.each([29.5, 79.5, -1, 101])(
    'refuses %s: marks are stored as the whole numbers the learner confirmed, never rounded here',
    (percent) => {
      expect(() =>
        schoolRecord([
          report('grade-10-final', '2026-12-01', [{ subject: 'mathematics', percent }]),
        ]),
      ).toThrow(InvalidMarksError);
    },
  );

  it('carries the key to the levels, from the one table (7 = 80–100 … 1 = 0–29)', () => {
    expect(schoolRecord([]).levels).toEqual([
      { level: 7, from: 80, to: 100 },
      { level: 6, from: 70, to: 79 },
      { level: 5, from: 60, to: 69 },
      { level: 4, from: 50, to: 59 },
      { level: 3, from: 40, to: 49 },
      { level: 2, from: 30, to: 39 },
      { level: 1, from: 0, to: 29 },
    ]);
  });

  it('puts every report side by side in the order the school year runs, the newest of each kind', () => {
    const record = schoolRecord([
      report('grade-11-final', '2027-12-05', GRADE_11),
      report('grade-10-final', '2026-12-01', [{ subject: 'mathematics', percent: 40 }]),
      report('grade-11-june', '2027-07-01', GRADE_10),
      // Confirmed again: a correction, so it replaces the first Grade 10 report.
      report('grade-10-final', '2027-01-10', GRADE_10),
    ]);
    expect(record.reports.map((r) => r.kind)).toEqual([
      'grade-10-final',
      'grade-11-june',
      'grade-11-final',
    ]);
    expect(record.reports[0]?.confirmedAt).toBe('2027-01-10T00:00:00.000Z');
    const maths = record.rows.find((r) => r.subject === 'mathematics');
    expect(maths?.marks.map((m) => m?.percent)).toEqual([52, 52, 58]);
    expect(maths?.marks.map((m) => m?.level)).toEqual([4, 4, 4]);
  });

  it('labels every mark and every report as entered by the learner', () => {
    const record = schoolRecord([
      report('grade-10-final', '2026-12-01', GRADE_10),
      report('grade-11-final', '2027-12-05', GRADE_11),
    ]);
    expect(record.reports.every((r) => r.source === 'learner')).toBe(true);
    const marks = record.rows.flatMap((r) => r.marks);
    expect(marks).toHaveLength(GRADE_10.length * 2);
    expect(marks.every((m) => m?.source === 'learner')).toBe(true);
  });

  it('gives the change since the earliest report that has the subject, and none from one report', () => {
    const record = schoolRecord([
      report('grade-10-final', '2026-12-01', [
        { subject: 'mathematics', percent: 52 },
        { subject: 'geography', percent: 70 },
      ]),
      report('grade-11-june', '2027-07-01', [
        { subject: 'mathematics', percent: 55 },
        { subject: 'history', percent: 60 },
      ]),
      report('grade-11-final', '2027-12-05', [
        { subject: 'mathematics', percent: 61 },
        { subject: 'geography', percent: 64 },
        { subject: 'history', percent: 66 },
      ]),
    ]);
    const row = (subject: string) => record.rows.find((r) => r.subject === subject);
    expect(row('mathematics')?.change).toBe(9);
    expect(row('geography')?.change).toBe(-6);
    expect(row('history')?.change).toBe(6);
    // Not on every report: an empty cell, never a 0.
    expect(row('geography')?.marks.map((m) => m?.percent ?? null)).toEqual([70, null, 64]);
    const single = schoolRecord([report('grade-10-final', '2026-12-01', GRADE_10)]);
    expect(single.rows.every((r) => r.change === null)).toBe(true);
  });

  it('gives each report the pass its marks would earn, from nscPass', () => {
    const weak = GRADE_10.map((m) => ({ ...m, percent: 35 }));
    const record = schoolRecord([
      report('grade-10-final', '2026-12-01', weak),
      report('grade-11-final', '2027-12-05', GRADE_11),
    ]);
    expect(record.reports.map((r) => r.pass)).toEqual([nscPass(weak), nscPass(GRADE_11)]);
    expect(record.reports.map((r) => r.pass)).toEqual(['none', 'bachelor']);
  });

  it('lists the newest report’s subjects first, then any it no longer has', () => {
    const record = schoolRecord([
      report('grade-10-final', '2026-12-01', [
        { subject: 'mathematical-literacy', percent: 70 },
        { subject: 'english-hl', percent: 60 },
      ]),
      report('grade-11-final', '2027-12-05', [
        { subject: 'english-hl', percent: 62 },
        { subject: 'mathematics', percent: 50 },
      ]),
    ]);
    expect(record.rows.map((r) => r.subject)).toEqual([
      'english-hl',
      'mathematics',
      'mathematical-literacy',
    ]);
  });
});
