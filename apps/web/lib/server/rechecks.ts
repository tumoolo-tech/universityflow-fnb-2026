import 'server-only';
import { recheck } from '@universityflow/admissions';
import type { CatalogueView } from '@universityflow/catalogue';
import type { MessagingChannel, RecheckView, ReportKind, StudentStore } from '@universityflow/db';
import type { JobScheduler } from '@universityflow/jobs';
import { reminderChannel, replaceLearnerReminder } from './reminders';
import { scored } from './scored';

/**
 * Re-checks after the June and September reports (planning.md §11, Phase 4c). When a learner
 * confirms one, their results on it are compared with their previous confirmed report, both
 * against today's catalogue, and the change is stored. If anything moved, a `recheck.changed`
 * reminder goes through the 4a pipeline, which decides at send time whether it may go (consent,
 * opt-in, cadence, quiet hours). The message only says there is an update; the courses and
 * numbers stay in the app.
 *
 * Only a confirmed report reaches this: it is called after the learner confirms their marks
 * (hard rule 6), never from a document's extraction.
 */

/** The reports that trigger a re-check. */
export const RECHECK_KINDS: ReadonlySet<ReportKind> = new Set([
  'grade-12-june',
  'grade-12-september',
]);

export type RecheckOutcome =
  | { readonly status: 'not-a-recheck' | 'no-previous-report' }
  | {
      readonly status: 'recorded';
      readonly recheckId: string;
      readonly moves: number;
      readonly reminderId: string | null;
    };

export async function recheckAfterConfirm(
  student: StudentStore,
  report: { readonly id: string; readonly kind: ReportKind },
  deps: {
    readonly catalogue: CatalogueView;
    readonly jobs: JobScheduler;
    readonly offeredChannels: ReadonlyArray<MessagingChannel>;
    readonly now?: Date;
  },
): Promise<RecheckOutcome> {
  if (!RECHECK_KINDS.has(report.kind)) return { status: 'not-a-recheck' };
  const [latest, previous] = await student.recentReports(2);
  // The report just confirmed is the newest; anything else means a race with another confirm,
  // and that one does its own re-check.
  if (!latest || latest.id !== report.id) return { status: 'not-a-recheck' };
  if (!previous) return { status: 'no-previous-report' };
  const summary = recheck(deps.catalogue, scored(previous), scored(latest));
  const recheckId = await student.saveRecheck({
    reportId: latest.id,
    previousReportId: previous.id,
    moves: summary.moves,
    counts: summary.counts,
    includesDrafts: summary.includesDrafts,
  });
  let reminderId: string | null = null;
  if (summary.moves.length > 0) {
    const channel = await reminderChannel(student, deps.offeredChannels);
    // One waiting re-check per learner (A1-12): the message only says there is an update, so a
    // newer re-check replaces one still waiting rather than adding another reminder and job.
    if (channel) {
      ({ id: reminderId } = await replaceLearnerReminder(student, deps.jobs, {
        templateId: 'recheck.changed',
        channel,
        desiredAt: deps.now ?? new Date(),
      }));
    }
  }
  return { status: 'recorded', recheckId, moves: summary.moves.length, reminderId };
}

/** One move as the apps show it: names from the catalogue the learner may see. */
export interface RecheckMoveView {
  readonly programmeId: string;
  readonly name: string;
  readonly universityName: string;
  readonly from: RecheckView['moves'][number]['from'];
  readonly to: RecheckView['moves'][number]['to'];
  readonly direction: 'up' | 'down';
}

export interface RecheckCard {
  readonly reportKind: ReportKind;
  readonly previousKind: ReportKind;
  readonly createdAt: string;
  readonly moves: ReadonlyArray<RecheckMoveView>;
  readonly counts: RecheckView['counts'];
  readonly includesDrafts: boolean;
}

/**
 * The newest re-check, for the learner's current report only, with names from the catalogue
 * view. A programme the view no longer shows (unverified in production, hard rule 3) is left out.
 */
export async function currentRecheck(
  student: StudentStore,
  catalogue: CatalogueView,
): Promise<RecheckCard | null> {
  const view = await student.latestRecheck();
  if (!view) return null;
  const latest = await student.latestReport();
  if (latest?.id !== view.reportId) return null;
  const moves = view.moves.flatMap((m): RecheckMoveView[] => {
    const programme = catalogue.programmes.find((p) => p.id === m.programmeId);
    if (!programme) return [];
    const university = catalogue.universities.find((u) => u.id === programme.universityId);
    return [
      {
        ...m,
        name: programme.name,
        universityName: university?.shortName ?? programme.universityId,
      },
    ];
  });
  return {
    reportKind: view.reportKind,
    previousKind: view.previousKind,
    createdAt: view.createdAt.toISOString(),
    moves,
    counts: view.counts,
    includesDrafts: view.includesDrafts,
  };
}
