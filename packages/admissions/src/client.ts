/**
 * `@universityflow/admissions/client`: the mark maths a module card's calculator runs where the
 * learner is, in the browser and in the phone app with no data (Phase 6c, D11). The scheme is
 * resolved on the server (`resolveScheme`, which reads catalogue records) and handed over as a
 * `ResolvedScheme`; this entry never loads the catalogue, its records or zod (A4-02, A4-13), so it
 * fits a client chunk and both app bundles. client.test.ts fails if it does.
 *
 * Pure, no I/O, React-Native-safe (hard rule 11). Code decides; the AI explains (hard rule 2).
 */

export type {
  ComponentSubminimumRule,
  ExamAdmissionRule,
  FieldSource,
  Resolved,
  ResolvedScheme,
  ResolvedSupplementary,
  SchemeLevel,
} from './assessment';
export {
  type ComponentMark,
  DP_STATUSES,
  type DpStatus,
  type DpStatusKind,
  dpStatus,
  finalMark,
  InvalidAssessmentMarksError,
  type LearnerMarks,
  type MarkNeeded,
  markNeeded,
  type NeededResult,
  percentFromScore,
  type Reading,
  type SupplementaryOutlook,
  shownNeeded,
  supplementaryOutlook,
  type Target,
  type YearMarkResult,
  yearMark,
} from './mark-needed';
