import { isAdmissionReport, type ReportKind } from '@universityflow/catalogue';
import type { SubjectMark } from './marks';

/**
 * What a confirmed report's marks may be used for (planning.md §2.2, §18.3 G10-3). Universities
 * admit on the final Grade 11 report and on Grade 12's (`ADMISSION_REPORT_KINDS`); none admits on
 * Grade 10 results, or on Grade 11's June or September report (§18.7 C2). So those marks only ever
 * say how a learner is tracking: **never "Qualify now", never Plan B**. The same calculation runs,
 * and its "qualifies" becomes "on track" here, in this package, so no screen or tool can show it
 * any other way (hard rule 2).
 */
export type MarksBasis = 'admission' | 'progress';

export function marksBasis(kind: ReportKind): MarksBasis {
  return isAdmissionReport(kind) ? 'admission' : 'progress';
}

/** A confirmed report as the calculations take it: its marks, and which report they are. */
export interface ScoredReport {
  readonly kind: ReportKind;
  readonly marks: ReadonlyArray<SubjectMark>;
}
