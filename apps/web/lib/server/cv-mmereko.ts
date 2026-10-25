import 'server-only';
import { type Account, AGE_OF_MAJORITY, ageOn, sastDate } from '@universityflow/db';
import type { LearnerStage } from '@universityflow/ui';

/**
 * Who may open Mmereko from My CV (the owner's decision of 2026-10-24: "only enable it for
 * university or 18+ learners and students"): a learner 18 or over by their confirmed date of
 * birth (South African time, so 18 from the first minute of the birthday), or a learner at
 * university, whatever their age. Never an under-18 school learner. The switch
 * (`config.mmerekoCanvas`) is checked by the page, beside this.
 */
export function mmerekoCanvasFor(
  account: Pick<Account, 'dateOfBirth'>,
  stage: LearnerStage,
  now: Date = new Date(),
): boolean {
  if (stage === 'university') return true;
  return Boolean(
    account.dateOfBirth && ageOn(account.dateOfBirth, sastDate(now)) >= AGE_OF_MAJORITY,
  );
}
