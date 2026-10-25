/**
 * Why a learner reports an AI reply (A10-35): the one list. The database's CHECK, the store, the
 * API and both apps' choices follow it, and `en.chat.report.reasons` has words for each. A reason
 * only, never text the learner types (hard rule 4).
 */
export const REPLY_REPORT_REASONS = ['harmful', 'wrong', 'other'] as const;
export type ReplyReportReason = (typeof REPLY_REPORT_REASONS)[number];

export function isReplyReportReason(value: unknown): value is ReplyReportReason {
  return (
    typeof value === 'string' && (REPLY_REPORT_REASONS as ReadonlyArray<string>).includes(value)
  );
}
