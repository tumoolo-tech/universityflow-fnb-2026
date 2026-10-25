import { describe, expect, it } from 'vitest';
import {
  ADMISSION_REPORT_KINDS,
  defaultReportKind,
  isAdmissionReport,
  isReportKind,
  printedReportKind,
  REPORT_KINDS,
  reportAboveGrade,
  reportGrade,
} from './reports';

describe('REPORT_KINDS', () => {
  it('runs in the order of the school year, from Grade 10 (planning.md §18.3, G10-2)', () => {
    // Grade 10 and 11's June and September reports came with the school record (§18.7 C2).
    expect(REPORT_KINDS).toEqual([
      'grade-10-june',
      'grade-10-final',
      'grade-11-june',
      'grade-11-september',
      'grade-11-final',
      'grade-12-june',
      'grade-12-september',
      'grade-12-final',
    ]);
    expect(REPORT_KINDS.map(reportGrade)).toEqual([10, 10, 11, 11, 11, 12, 12, 12]);
  });

  it('starts the confirm form on the newest final report the learner can hold (G10-1, A1-35)', () => {
    const october = new Date('2026-10-13T08:00:00Z');
    const december = new Date('2026-12-01T08:00:00Z');
    const january = new Date('2027-01-08T08:00:00Z');
    expect(defaultReportKind(10, october)).toBe('grade-10-final');
    // In Grade 11, the final Grade 11 report is issued in December; before that the newest final
    // report is Grade 10's. A wrong default can then only say "on track", never "Qualify now".
    expect(defaultReportKind(11, january)).toBe('grade-10-final');
    expect(defaultReportKind(11, october)).toBe('grade-10-final');
    expect(defaultReportKind(11, december)).toBe('grade-11-final');
    // December in South Africa starts at 22:00 UTC on 30 November.
    expect(defaultReportKind(11, new Date('2026-11-30T22:30:00Z'))).toBe('grade-11-final');
    expect(defaultReportKind(11, new Date('2026-11-30T21:30:00Z'))).toBe('grade-10-final');
    expect(defaultReportKind(12, october)).toBe('grade-11-final');
    expect(defaultReportKind(null, october)).toBe('grade-11-final');
  });

  it('names the report a document prints, only when the grade and term settle it (A1-35)', () => {
    expect(printedReportKind({ grade: 10, term: 'final' })).toBe('grade-10-final');
    expect(printedReportKind({ grade: 10, term: null })).toBe('grade-10-final');
    expect(printedReportKind({ grade: 10, term: 'june' })).toBe('grade-10-june');
    // There is no Grade 10 September kind: never call it the final one, the learner picks.
    expect(printedReportKind({ grade: 10, term: 'september' })).toBeNull();
    expect(printedReportKind({ grade: 10, term: 'other' })).toBeNull();
    expect(printedReportKind({ grade: 11, term: 'final' })).toBe('grade-11-final');
    expect(printedReportKind({ grade: 11, term: null })).toBe('grade-11-final');
    // A Grade 11 June or September report is its own kind, never the final one (§18.7 C2).
    expect(printedReportKind({ grade: 11, term: 'june' })).toBe('grade-11-june');
    expect(printedReportKind({ grade: 11, term: 'september' })).toBe('grade-11-september');
    expect(printedReportKind({ grade: 11, term: 'other' })).toBeNull();
    expect(printedReportKind({ grade: 12, term: 'june' })).toBe('grade-12-june');
    expect(printedReportKind({ grade: 12, term: 'september' })).toBe('grade-12-september');
    expect(printedReportKind({ grade: 12, term: 'final' })).toBe('grade-12-final');
    expect(printedReportKind({ grade: 12, term: null })).toBeNull();
    expect(printedReportKind({ grade: null, term: 'final' })).toBeNull();
    expect(printedReportKind({ grade: 9, term: 'final' })).toBeNull();
  });

  it('knows a report from a grade above the learner’s (A1-35)', () => {
    expect(reportAboveGrade('grade-12-final', 10)).toBe(true);
    expect(reportAboveGrade('grade-11-final', 10)).toBe(true);
    expect(reportAboveGrade('grade-10-final', 10)).toBe(false);
    expect(reportAboveGrade('grade-11-final', 12)).toBe(false);
    // The new kinds keep the rule (A1-35): a Grade 11 June report is above Grade 10.
    expect(reportAboveGrade('grade-11-june', 10)).toBe(true);
    expect(reportAboveGrade('grade-11-september', 10)).toBe(true);
    expect(reportAboveGrade('grade-10-june', 10)).toBe(false);
    expect(reportAboveGrade('grade-11-september', 11)).toBe(false);
    // No grade on record: nothing to compare with.
    expect(reportAboveGrade('grade-12-final', null)).toBe(false);
  });

  it('knows its own kinds and nothing else', () => {
    expect(isReportKind('grade-10-final')).toBe(true);
    expect(isReportKind('grade-10-june')).toBe(true);
    expect(isReportKind('grade-10-september')).toBe(false);
    expect(isReportKind('grade-9-final')).toBe(false);
    expect(isReportKind(11)).toBe(false);
    expect(isReportKind(null)).toBe(false);
  });

  it('admits only on the final Grade 11 report and Grade 12’s (§2.2, G10-3, §18.7 C2)', () => {
    expect(ADMISSION_REPORT_KINDS).toEqual([
      'grade-11-final',
      'grade-12-june',
      'grade-12-september',
      'grade-12-final',
    ]);
    expect(REPORT_KINDS.filter(isAdmissionReport)).toEqual([...ADMISSION_REPORT_KINDS]);
    for (const kind of [
      'grade-10-june',
      'grade-10-final',
      'grade-11-june',
      'grade-11-september',
    ] as const) {
      expect(isAdmissionReport(kind), kind).toBe(false);
    }
  });
});
