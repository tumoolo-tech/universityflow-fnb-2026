import 'server-only';
import type { ReviewAlerts } from '@universityflow/db';

/**
 * What the owner must see about the store-review sign-in (A7-01, docs/store/review-notes.md).
 * There is no alerting provider yet: like the SMS budget's alerts (`logSmsBudgetAlerts`), each is
 * one warning line in the server log, which Vercel keeps and the owner can alert on. Ids and
 * counts only, never the number (hard rule 4). Every line starts `store-review`.
 */

/**
 * A sign-in to the review account (guard 5). The audit row (`auth.review-signed-in`) is written
 * by the store in the same transaction as the session.
 */
export function logReviewSignIn(studentId: string): void {
  console.warn(`store-review sign-in: student ${studentId}`);
}

/** What the store reports: each wrong review PIN, the lock (A1-19), a misconfiguration (A1-20). */
export const logReviewAlerts: ReviewAlerts = {
  wrongPin({ failures, limit }) {
    console.warn(`store-review wrong PIN: ${failures} of ${limit} in this window`);
  },
  locked() {
    console.warn('store-review locked: too many wrong PINs; set a new PIN hash and redeploy');
  },
  misconfigured({ studentId }) {
    console.warn(
      `store-review misconfigured: UF_REVIEW_PHONE belongs to student ${studentId}, which is not the review account`,
    );
  },
};
