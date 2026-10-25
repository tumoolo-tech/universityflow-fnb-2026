import { type ScoredReport, type SubjectMark, whatINeedFor } from '@universityflow/admissions';
import {
  type CatalogueView,
  isDraft,
  isLanguage,
  isOptionsRequirement,
  isSubjectId,
  LIFE_ORIENTATION,
  practiceForSubject,
  type SubjectId,
  subject,
} from '@universityflow/catalogue';
import type { PracticeArtifact, PracticeReason, PracticeSubject } from '@universityflow/ui';

/**
 * Free practice for the subjects that matter (planning.md §3, Stage 3; §11, Phase 4e), built by
 * tested code only, so the chat, the web page and the app agree:
 *
 * 1. The subject the learner asked about.
 * 2. Otherwise their goal: first the subjects "what I need" (packages/admissions, 4c) says must
 *    rise, biggest gap first; then the other subjects the programme names.
 * 3. Otherwise (no goal) their weakest confirmed marks.
 * 4. Otherwise nothing, and it says so: it never guesses.
 *
 * Marks are only ever the latest **confirmed** report's (hard rule 6). Links come from the
 * catalogue view, so unverified ones appear only in preview, labelled (hard rule 3). The artifact
 * carries no admission fact (hard rule 2): which subjects, never which mark.
 */

/** How many subjects the list shows at most. */
export const PRACTICE_SUBJECT_LIMIT = 3;

export interface PracticeInput {
  readonly view: CatalogueView;
  /** The grade the learner is in (Grade 12 from a Grade 12 report): picks the books. */
  readonly grade: number | null;
  /** Their goal programme id, or null. */
  readonly goalProgrammeId: string | null;
  /** Their latest confirmed report, or null when nothing is confirmed. */
  readonly confirmedReport: ScoredReport | null;
  /** A subject the learner asked about. */
  readonly subjectId?: SubjectId;
}

const REASON_ORDER: ReadonlyArray<PracticeReason> = [
  'asked',
  'goal-to-raise',
  'goal-requires',
  'weakest',
];

type Pick = { readonly subjectId: SubjectId; readonly reason: PracticeReason };

const counts = (id: string): id is SubjectId => isSubjectId(id) && id !== LIFE_ORIENTATION;

function goalSubjects(input: PracticeInput, programmeId: string): Pick[] {
  const { view, confirmedReport } = input;
  const confirmedMarks = confirmedReport?.marks ?? null;
  const programme = view.programmes.find((p) => p.id === programmeId);
  if (!programme) return [];
  const picks: Pick[] = [];
  if (confirmedReport) {
    const plan = whatINeedFor(view, programmeId, confirmedReport)?.plan;
    for (const s of plan?.subjects ?? []) {
      if (s.gap > 0 && counts(s.subject)) {
        picks.push({ subjectId: s.subject, reason: 'goal-to-raise' });
      }
    }
  }
  const takes = confirmedMarks ? new Set<string>(confirmedMarks.map((m) => m.subject)) : null;
  const named = programme.subjectRequirements
    .filter(isOptionsRequirement)
    .flatMap((r) => r.options.flatMap((o) => o.subjects))
    .filter(
      (id) =>
        counts(id) &&
        // With confirmed marks: the named subjects they take. Without: the named non-language
        // subjects (a language option lists every official language, which says nothing).
        (takes ? takes.has(id) : !isLanguage(subject(id))),
    );
  for (const id of named) picks.push({ subjectId: id, reason: 'goal-requires' });
  return picks;
}

function weakestSubjects(marks: ReadonlyArray<SubjectMark>): Pick[] {
  return [...marks]
    .filter((m) => counts(m.subject))
    .sort((a, b) => a.percent - b.percent || a.subject.localeCompare(b.subject))
    .map((m) => ({ subjectId: m.subject as SubjectId, reason: 'weakest' as const }));
}

export function practicePlan(input: PracticeInput): PracticeArtifact {
  const { view } = input;
  const programme = input.goalProgrammeId
    ? view.programmes.find((p) => p.id === input.goalProgrammeId)
    : undefined;
  const goal = programme
    ? {
        programmeId: programme.id,
        name: programme.name,
        universityName:
          view.universities.find((u) => u.id === programme.universityId)?.shortName ??
          programme.universityId,
      }
    : null;

  let basis: PracticeArtifact['basis'] = 'none';
  let picks: Pick[] = [];
  if (input.subjectId) {
    basis = 'asked';
    picks = [{ subjectId: input.subjectId, reason: 'asked' }];
  } else if (programme) {
    basis = 'goal';
    picks = goalSubjects(input, programme.id);
  }
  if (picks.length === 0 && !input.subjectId && input.confirmedReport) {
    basis = 'weakest';
    picks = weakestSubjects(input.confirmedReport.marks);
  }

  const seen = new Set<SubjectId>();
  const all: PracticeSubject[] = [];
  for (const pick of picks) {
    if (seen.has(pick.subjectId)) continue;
    seen.add(pick.subjectId);
    all.push({
      subjectId: pick.subjectId,
      subjectName: subject(pick.subjectId).name,
      reason: pick.reason,
      resources: practiceForSubject(view.practice, pick.subjectId, input.grade).map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        url: r.url,
        grades: r.grades,
        access: r.access,
        sourceUrl: r.sourceUrl,
        draft: isDraft(r),
      })),
    });
  }
  // Within each reason, subjects that have free practice come first, so the few shown are
  // useful; otherwise the order the reasons gave (biggest gap first, weakest first) stands.
  const rank = (s: PracticeSubject) => REASON_ORDER.indexOf(s.reason);
  const subjects = all
    .map((s, i) => ({ s, i }))
    .sort(
      (a, b) =>
        rank(a.s) - rank(b.s) ||
        Number(a.s.resources.length === 0) - Number(b.s.resources.length === 0) ||
        a.i - b.i,
    )
    .map(({ s }) => s)
    .slice(0, PRACTICE_SUBJECT_LIMIT);
  return {
    kind: 'practice',
    basis: subjects.length === 0 ? 'none' : basis,
    goal,
    subjects,
    includesDrafts: view.includesDrafts,
  };
}
