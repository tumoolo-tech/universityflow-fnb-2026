/**
 * Why a learner reports a fitted CV (A10-58; docs/design/mmereko-api-proposal.md §11, A10-35's
 * pattern): the one list. The database's CHECK (migration 0039), the store, the API and both
 * apps' choices follow it, and `en.cv.report.reasons` has words for each. A reason only, never
 * text the learner types (hard rule 4). `untrue`: an AI fitted the CV, and it can claim what the
 * learner never did.
 */
export const CV_REPORT_REASONS = ['untrue', 'harmful', 'other'] as const;
export type CvReportReason = (typeof CV_REPORT_REASONS)[number];

export function isCvReportReason(value: unknown): value is CvReportReason {
  return typeof value === 'string' && (CV_REPORT_REASONS as ReadonlyArray<string>).includes(value);
}
