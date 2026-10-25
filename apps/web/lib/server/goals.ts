import 'server-only';
import {
  type ExamCountdownArtifact,
  examCountdown,
  type GoalCardArtifact,
  goalCard,
  type PracticeArtifact,
  practicePlan,
} from '@universityflow/agent';
import {
  type CatalogueView,
  examGrade,
  examSubjects,
  isSubjectId,
  type SubjectId,
  subject,
} from '@universityflow/catalogue';
import type { StudentStore } from '@universityflow/db';
import { scored } from './scored';

/**
 * Stage 3 for the web pages and the app's API: the learner's goal and their exam countdown,
 * built by the same code as the agent's tools (packages/agent/src/goals.ts), so the chat and the
 * screens always agree (hard rule 2).
 *
 * Each store read is its own transaction, so the records are read once by the caller and handed
 * to pure builders (A4-07): the My goal page reads each record once, and each API route reads
 * only the records its answer needs.
 */

/** The learner's records the Stage 3 answers are built from, each read once. */
export interface GoalsRecords {
  readonly goal: Awaited<ReturnType<StudentStore['goal']>>;
  readonly report: Awaited<ReturnType<StudentStore['latestReport']>>;
  readonly profile: Awaited<ReturnType<StudentStore['profile']>>;
  readonly choices: Awaited<ReturnType<StudentStore['examSubjectChoices']>>;
}

export interface GoalOption {
  readonly id: string;
  readonly name: string;
  readonly universityName: string;
  /** "UJ": the course search matches it too (components/course-search.tsx). */
  readonly universityShortName?: string;
  /** The course's faculty, in the university's words: the course search filters by it. */
  readonly faculty?: string;
}

export interface GoalResponse {
  /** The id the learner chose, even when it can't be shown now. */
  readonly goalId: string | null;
  /** The card, or null with no goal, or when the catalogue the learner may see lacks it. */
  readonly card: GoalCardArtifact | null;
  /** Every course the learner may choose, by university. */
  readonly options: ReadonlyArray<GoalOption>;
}

/**
 * Every course the learner may see (drafts only in a preview: hard rule 3), grouped under its
 * university's full name ("University of Johannesburg", not "UJ"): the owner's choice for every
 * course dropdown (My goal, My offers, My modules, "What would you like to study?").
 */
export function goalOptions(view: CatalogueView): GoalOption[] {
  const universities = new Map(view.universities.map((u) => [u.id, u]));
  return view.programmes
    .map((p) => ({
      id: p.id,
      name: p.name,
      universityName: universities.get(p.universityId)?.name ?? '',
      universityShortName: universities.get(p.universityId)?.shortName ?? '',
      faculty: p.faculty,
    }))
    .sort(
      (a, b) => a.universityName.localeCompare(b.universityName) || a.name.localeCompare(b.name),
    );
}

const confirmedReport = (report: GoalsRecords['report']) => (report ? scored(report) : null);

export function buildGoal(
  { goal, report }: Pick<GoalsRecords, 'goal' | 'report'>,
  view: CatalogueView,
): GoalResponse {
  return {
    goalId: goal?.programmeId ?? null,
    card: goal ? goalCard(view, goal.programmeId, confirmedReport(report)) : null,
    options: goalOptions(view),
  };
}

export async function goalResponse(
  student: StudentStore,
  view: CatalogueView,
): Promise<GoalResponse> {
  const [goal, report] = await Promise.all([student.goal(), student.latestReport()]);
  return buildGoal({ goal, report }, view);
}

export interface ExamSubjectRow {
  readonly subjectId: SubjectId;
  readonly name: string;
  /** On the learner's latest confirmed report. */
  readonly onReport: boolean;
  /** Whether they write it, after their own changes. */
  readonly writes: boolean;
  /** Whether a change of theirs decides it. */
  readonly changed: boolean;
}

export interface ExamsResponse {
  readonly countdown: ExamCountdownArtifact;
  readonly subjects: ReadonlyArray<ExamSubjectRow>;
}

export function buildExams(
  { report, profile, choices }: Pick<GoalsRecords, 'report' | 'profile' | 'choices'>,
  view: CatalogueView,
  now: Date,
): ExamsResponse {
  const confirmed = report?.marks.map((m) => m.subject) ?? [];
  const writes = new Set<string>(examSubjects(confirmed, choices));
  const changed = new Set<string>(choices.map((c) => c.subjectId));
  const ids = [...new Set([...confirmed, ...choices.map((c) => c.subjectId)])].filter(
    // Life Orientation has no final written paper.
    (s): s is SubjectId => isSubjectId(s) && s !== 'life-orientation',
  );
  return {
    countdown: examCountdown({
      view,
      now,
      grade: examGrade(profile?.grade ?? null, report?.kind ?? null),
      confirmedSubjects: confirmed,
      choices,
    }),
    subjects: ids
      .map((id) => ({
        subjectId: id,
        name: subject(id).name,
        onReport: confirmed.includes(id),
        writes: writes.has(id),
        changed: changed.has(id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function examsResponse(
  student: StudentStore,
  view: CatalogueView,
  now = new Date(),
): Promise<ExamsResponse> {
  const [report, profile, choices] = await Promise.all([
    student.latestReport(),
    student.profile(),
    student.examSubjectChoices(),
  ]);
  return buildExams({ report, profile, choices }, view, now);
}

/**
 * Free practice for the subjects that matter (Phase 4e), the same code as the agent's
 * practice_for tool: the goal and "what I need" first, else the weakest confirmed marks. Marks
 * come only from the latest confirmed report (hard rule 6).
 */
export function buildPractice(
  { goal, report, profile }: Pick<GoalsRecords, 'goal' | 'report' | 'profile'>,
  view: CatalogueView,
): PracticeArtifact {
  return practicePlan({
    view,
    grade: examGrade(profile?.grade ?? null, report?.kind ?? null),
    goalProgrammeId: goal?.programmeId ?? null,
    confirmedReport: confirmedReport(report),
  });
}

export async function practiceResponse(
  student: StudentStore,
  view: CatalogueView,
): Promise<PracticeArtifact> {
  const [goal, report, profile] = await Promise.all([
    student.goal(),
    student.latestReport(),
    student.profile(),
  ]);
  return buildPractice({ goal, report, profile }, view);
}

export interface GoalsPageData {
  readonly goal: GoalResponse;
  readonly exams: ExamsResponse;
  readonly practice: PracticeArtifact;
}

/** Everything the My goal page shows, from one read of each record (A4-07). */
export async function goalsPage(
  student: StudentStore,
  view: CatalogueView,
  now = new Date(),
): Promise<GoalsPageData> {
  const [goal, report, profile, choices] = await Promise.all([
    student.goal(),
    student.latestReport(),
    student.profile(),
    student.examSubjectChoices(),
  ]);
  const records: GoalsRecords = { goal, report, profile, choices };
  return {
    goal: buildGoal(records, view),
    exams: buildExams(records, view, now),
    practice: buildPractice(records, view),
  };
}
