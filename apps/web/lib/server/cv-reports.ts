import 'server-only';
import type { CvReportReason } from '@universityflow/content';

/**
 * A learner reported a fitted CV (A10-58): a person must look at it. Who that person is waits for
 * the safeguarding lead (A11-23) and an alerting account (D8), so, like a reported AI reply
 * (`logReplyReportAlerts`), the stand-in is one warning line in the server log, which Vercel keeps
 * and the owner can alert on. Ids and the reason only, never the CV's text or the advert (hard
 * rule 4). A fitted CV is written by Mmereko's AI (D4, Anthropic), so no writer is named. Every
 * line starts `cv-report`.
 */
export interface CvReportAlerts {
  reported(report: {
    readonly studentId: string;
    readonly documentId: string;
    readonly reason: CvReportReason;
  }): void;
}

export const logCvReportAlerts: CvReportAlerts = {
  reported({ studentId, documentId, reason }) {
    console.warn(`cv-report: student ${studentId} reported CV ${documentId} (${reason})`);
  },
};
