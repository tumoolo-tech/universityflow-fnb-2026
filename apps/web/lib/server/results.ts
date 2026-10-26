import 'server-only';
import {
  assessAll,
  type CollegeOptions,
  collegeOptions,
  type Results,
} from '@universityflow/admissions';
import type { CatalogueView } from '@universityflow/catalogue';
import type { ConfirmedReport } from '@universityflow/db';
import { colleges } from './colleges';
import { scored } from './scored';
import { getServices } from './services';
import type { Signed } from './session';

/**
 * Stage 1 for one learner: every course they can apply for, are close to, or reach through
 * Plan B, and the public TVET colleges beside them, from the marks they confirmed. Computed by
 * packages/admissions, the same code the agent uses (hard rule 2). The results page renders it;
 * the page's server action (results/actions.ts) computes it again for a collapsed group's cards
 * when the learner opens the group (A4-19), so both always agree.
 */
export interface LearnerResults {
  readonly report: ConfirmedReport;
  readonly view: CatalogueView;
  readonly results: Results;
  readonly colleges: CollegeOptions;
  readonly shortlist: ReadonlyArray<string>;
}

/** Null when the learner has no confirmed report yet. */
export async function learnerResults(signed: Signed): Promise<LearnerResults | null> {
  const report = await signed.student.latestReport();
  if (!report) return null;
  const { catalogue } = await getServices();
  const view = catalogue();
  const marks = scored(report);
  return {
    report,
    view,
    results: assessAll(view, marks),
    colleges: collegeOptions(await colleges(), marks, new Date()),
    shortlist: (await signed.student.shortlist()).map((s) => s.programmeId),
  };
}
