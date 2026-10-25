// Phase 6a: how marks work (resolve a module's scheme, then the mark maths).
export {
  type ComponentSubminimumRule,
  type ConfirmedOutlineScheme,
  type ExamAdmissionRule,
  type FieldSource,
  InvalidSchemeError,
  type OutlineSupplementary,
  type Resolved,
  type ResolvedScheme,
  type ResolvedSupplementary,
  type ResolveInput,
  resolveScheme,
  SCHEME_LEVELS,
  type SchemeLevel,
} from './assessment';
export { type MarksBasis, marksBasis, type ScoredReport } from './basis';
// Public TVET colleges in Plan B (planning.md §19.1): code decides only a printed rule it can read.
export {
  type CollegeOption,
  type CollegeOptions,
  type CollegeVerdict,
  collegeOptions,
  type EntryRule,
  entryRule,
} from './colleges';
export {
  CLOSE_LEVELS,
  checkProgramme,
  groupResults,
  minimumScoreFor,
  type OptionCheck,
  type ProgrammeCheck,
  type RequirementCheck,
  type ResultsGroups,
  targetPercent,
  type Verdict,
} from './eligibility';
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
export {
  byPercentDescending,
  InvalidMarksError,
  type LevelledMark,
  type SubjectMark,
  validateMarks,
} from './marks';
export { type AchievementLevel, achievementLevel, LEVEL_FLOOR } from './nsc-levels';
export {
  CANDIDATE_LIMIT,
  FINAL_CHECK_PLAN_B_LIMIT,
  type FinalCheck,
  finalCheck,
  isFinalOffer,
  isOfferKind,
  normaliseTitle,
  OFFER_KINDS,
  type OfferKind,
  programmeCandidates,
  replyByDaysLeft,
} from './offers';
export { meetsPass, nscPass, PASS_ORDER, type PassOutcome, passRank } from './pass-type';
export {
  compareResults,
  type Move,
  type RecheckSummary,
  recheck,
  type Standing,
} from './recheck';
export {
  compareRegistration,
  DIFFERENCE_KINDS,
  type DifferenceKind,
  type ModuleMatch,
  type RegisteredModule,
  type RegistrationComparison,
  type RegistrationDifference,
} from './registration';
export {
  type ChangeDeadline,
  type ChangeDeadlines,
  changeDeadlinesFor,
  type DeadlineScope,
  termsOfDifference,
} from './registration-deadlines';
export {
  assessAll,
  assessOne,
  type ProgrammeResult,
  type Results,
  type ResultVerdict,
  type ScoreBreakdown,
  type Shortfall,
  scorable,
  shownVerdict,
  summarise,
} from './results';
export {
  type MarkSource,
  type SchoolRecord,
  type SchoolRecordInput,
  type SchoolRecordMark,
  type SchoolRecordReport,
  type SchoolRecordRow,
  schoolRecord,
} from './school-record';
export {
  type BestOfConfig,
  type Bonus,
  bestOfMethod,
  type LifeOrientationRule,
  type LineReason,
  NSC_LEVEL_TABLE,
  type PointsBand,
  type PointsTable,
  pointsFor,
  type ScoreLine,
  type ScoreMethod,
  type ScoreResult,
} from './scoring/engine';
export {
  type ClosedCourse,
  type DoorGroup,
  type HigherBarCourse,
  type HigherBarReason,
  type SubjectDoors,
  type SubjectSwap,
  subjectDoors,
  swapChoices,
  trySwap,
  type UniversityDoors,
} from './subject-doors';
export {
  DEFAULT_METHOD,
  METHODS,
  methodFor,
  tutAps,
  uctFps,
  uctFpsScience,
  ujAps,
  ukznAps,
  ukznMbchbAverage,
  upAps,
  witsAps,
} from './universities/methods';
export {
  type Blocker,
  type PlanStatus,
  type SubjectTarget,
  type TargetReason,
  type WhatINeedPlan,
  type WhatINeedResult,
  whatINeed,
  whatINeedFor,
} from './what-i-need';
