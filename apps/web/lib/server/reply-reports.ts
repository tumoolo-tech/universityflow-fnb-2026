import 'server-only';
import type { ReplyReportReason } from '@universityflow/content';
import type { ReplyWriter } from '@universityflow/db';

/**
 * A learner reported an AI reply (A10-35): a person must look at it. Who that person is waits for
 * the safeguarding lead (A11-23) and an alerting account (D8), so like the review sign-in's alerts
 * (`logReviewAlerts`) the stand-in is one warning line in the server log, which Vercel keeps and
 * the owner can alert on. Ids, the reason and who wrote the reply (a provider and a model id,
 * A10-49) only, never the reply's text (hard rule 4). Every line starts `reply-report`.
 */
export interface ReplyReportAlerts {
  reported(report: {
    readonly studentId: string;
    readonly messageId: string;
    readonly reason: ReplyReportReason;
    /** Who wrote the reported reply; null: not recorded (a reply from before migration 0036). */
    readonly writtenBy: ReplyWriter | null;
  }): void;
}

/** Who wrote a reply, as the alert line says it. */
export function writerLabel(writer: ReplyWriter | null): string {
  if (!writer) return 'writer not recorded';
  if (writer.provider === 'system') return 'written by the system (no model)';
  return `written by ${writer.provider} ${writer.model ?? '(model not recorded)'}`;
}

export const logReplyReportAlerts: ReplyReportAlerts = {
  reported({ studentId, messageId, reason, writtenBy }) {
    console.warn(
      `reply-report: student ${studentId} reported message ${messageId} (${reason}), ${writerLabel(writtenBy)}`,
    );
  },
};
