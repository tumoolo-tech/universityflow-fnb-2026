import type { SubjectMark } from '@universityflow/admissions';
import {
  type CatalogueView,
  type ExamSubjectChoice,
  nscExamYear,
  type ReportKind,
} from '@universityflow/catalogue';
import type { TickedStep } from './campus';
import type { AgentRegistration } from './modules';
import type { AgentOffer } from './offers';

/**
 * Everything the agent's tools may read or change for one learner. The web app implements it on
 * top of the database Store, so every call still goes through row-level security and the consent
 * check; the agent itself never touches the database.
 */
export interface AgentContext {
  readonly today: Date;
  readonly catalogue: CatalogueView;
  /** The intake the learner is applying for (e.g. 2028 for a Grade 11 learner in 2026). */
  readonly targetIntake: number;
  latestReport(): Promise<{
    kind: ReportKind;
    confirmedAt: Date;
    marks: ReadonlyArray<SubjectMark>;
  } | null>;
  shortlist(): Promise<ReadonlyArray<string>>;
  addToShortlist(programmeId: string): Promise<void>;
  checklist(scope: string): Promise<ReadonlyArray<{ item: string; done: boolean }>>;
  remember(kind: 'goal' | 'preference' | 'note', body: string): Promise<void>;
  /** The learner's target programme id, or null. */
  goal(): Promise<string | null>;
  setGoal(programmeId: string): Promise<void>;
  /** The learner's own changes to which subjects they write. */
  examChoices(): Promise<ReadonlyArray<ExamSubjectChoice>>;
  /** The offers the learner recorded and confirmed (Phase 5a), oldest first. */
  offers(): Promise<ReadonlyArray<AgentOffer>>;
  /** The first-week steps the learner ticked for a university (Phase 5b, migration 0019). */
  firstWeekSteps(universityId: string): Promise<ReadonlyArray<TickedStep>>;
  /** The learner's latest confirmed registration (Phase 5c), or null. */
  registration(): Promise<AgentRegistration | null>;
  profile(): Promise<{
    displayName: string | null;
    grade: number | null;
    /** Past matric (A10-38): the context says so instead of "Grade 12". */
    schoolFinished?: boolean;
    goal: string | null;
  } | null>;
}

/**
 * The intake a learner in a given grade applies for, in a given calendar year: the year after
 * their final NSC exams (`nscExamYear`). Grade 12 applies this year for next year; Grade 11 next
 * year for the year after; Grade 9 was given Grade 11's intake until G10-1.
 */
export function targetIntakeFor(grade: number | null, today: Date): number {
  return nscExamYear(grade, today) + 1;
}
