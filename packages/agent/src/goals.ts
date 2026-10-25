import { assessOne, type ScoredReport } from '@universityflow/admissions';
import {
  type CatalogueView,
  daysUntil,
  type ExamSubjectChoice,
  examSubjects,
  isDraft,
  nscExamYear,
  paperSlot,
  papersFor,
  subject,
} from '@universityflow/catalogue';
import type { ExamCountdownArtifact, GoalCardArtifact } from '@universityflow/ui';

/**
 * The two Stage 3 artifacts, built from tested code only (hard rule 2): the agent's tools, the
 * web pages and the app's API all use these, so the chat and the screens can't disagree.
 */

/**
 * The goal card for a target programme, or null when the catalogue the learner may see doesn't
 * hold it (unverified in production, or removed). The verdict comes from packages/admissions,
 * on the latest confirmed report (Grade 10's says "on track", G10-3).
 */
export function goalCard(
  view: CatalogueView,
  programmeId: string,
  report: ScoredReport | null,
): GoalCardArtifact | null {
  const programme = view.programmes.find((p) => p.id === programmeId);
  if (!programme) return null;
  const university = view.universities.find((u) => u.id === programme.universityId);
  const detail = report ? assessOne(view, programmeId, report) : null;
  return {
    kind: 'goal-card',
    programme: {
      id: programme.id,
      name: programme.name,
      faculty: programme.faculty,
      universityId: programme.universityId,
      universityName: university?.shortName ?? programme.universityId,
      sourceUrl: programme.sourceUrl,
      academicYear: programme.academicYear,
      draft: isDraft(programme) || (detail?.result.draft ?? false),
    },
    result: detail?.result ?? null,
    hasMarks: report !== null,
  };
}

/** How many papers the countdown shows at most. */
export const COUNTDOWN_LIMIT = 8;

export interface CountdownInput {
  readonly view: CatalogueView;
  readonly now: Date;
  readonly grade: number | null;
  /** Subjects on the latest confirmed report (hard rule 6). */
  readonly confirmedSubjects: ReadonlyArray<string>;
  readonly choices: ReadonlyArray<ExamSubjectChoice>;
  readonly limit?: number;
}

/** The learner's next papers (not yet finished), with the days left to each. */
export function examCountdown(input: CountdownInput): ExamCountdownArtifact {
  const { view, now } = input;
  const examYear = nscExamYear(input.grade, now);
  const subjects = examSubjects(input.confirmedSubjects, input.choices).filter(
    (s) => s !== 'life-orientation',
  );
  const upcoming = papersFor(view.examPapers, subjects, examYear).filter(
    (p) => paperSlot(p).endsAt > now,
  );
  return {
    kind: 'exam-countdown',
    examYear,
    timetablePublished: view.examPapers.some((p) => p.academicYear === examYear),
    subjectCount: subjects.length,
    papers: upcoming.slice(0, input.limit ?? COUNTDOWN_LIMIT).map((p) => ({
      id: p.id,
      subjectId: p.subjectId,
      subjectName: subject(p.subjectId).name,
      paper: p.paper,
      date: p.date,
      startsAt: p.startsAt,
      durationMinutes: p.durationMinutes,
      session: p.session,
      daysLeft: daysUntil(p, now),
      note: p.note ?? null,
      sourceUrl: p.sourceUrl,
      draft: isDraft(p),
    })),
    includesDrafts: view.includesDrafts,
  };
}
