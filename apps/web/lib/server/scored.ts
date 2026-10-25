import 'server-only';
import {
  type SchoolRecord,
  type ScoredReport,
  type SubjectMark,
  schoolRecord,
} from '@universityflow/admissions';
import type { ConfirmedReport } from '@universityflow/db';

/**
 * A confirmed report as packages/admissions scores it: its kind decides whether its marks can say
 * "qualify" at all (Grade 10's never do, G10-3). The marks are the learner's confirmed ones
 * (hard rule 6); admissions validates every subject before using it.
 */
export function scored(report: ConfirmedReport): ScoredReport {
  return { kind: report.kind, marks: report.marks as ReadonlyArray<SubjectMark> };
}

/**
 * The school record (planning.md §18.7 C2) from the store's confirmed reports
 * (`schoolRecordReports`): packages/admissions works out the levels, changes and passes.
 */
export function schoolRecordOf(reports: ReadonlyArray<ConfirmedReport>): SchoolRecord {
  return schoolRecord(reports.map((r) => ({ ...scored(r), confirmedAt: r.confirmedAt })));
}
