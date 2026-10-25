/**
 * The school reports a learner can confirm (planning.md §2.2, §18.3 G10-2), in the order the
 * school year runs. The one list: the database's CHECK, both apps' report pickers, the API's
 * validation and the content's names all follow it, and their tests compare against it, so a new
 * kind is added here first. Plain values: both apps load this through
 * `@universityflow/catalogue/client` (audit A4-02).
 */
export const REPORT_KINDS = [
  'grade-10-june',
  'grade-10-final',
  'grade-11-june',
  'grade-11-september',
  'grade-11-final',
  'grade-12-june',
  'grade-12-september',
  'grade-12-final',
] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export function isReportKind(value: unknown): value is ReportKind {
  return typeof value === 'string' && (REPORT_KINDS as readonly string[]).includes(value);
}

/**
 * The reports universities admit on (planning.md §2.2): the final Grade 11 report and Grade 12's.
 * Every other report (Grade 10's, and Grade 11's June and September ones, §18.7 C2) only says how
 * a learner is tracking: packages/admissions never scores it as "Qualify now" (G10-3), and it
 * comes after every admission report when "the latest report" is chosen (A1-34).
 */
export const ADMISSION_REPORT_KINDS = [
  'grade-11-final',
  'grade-12-june',
  'grade-12-september',
  'grade-12-final',
] as const satisfies ReadonlyArray<ReportKind>;

export function isAdmissionReport(kind: ReportKind): boolean {
  return (ADMISSION_REPORT_KINDS as ReadonlyArray<ReportKind>).includes(kind);
}

/**
 * The report the confirm form starts on for a learner in `grade` (G10-1, A1-35): the newest final
 * report they can hold. In Grade 11 that is Grade 10's until the final Grade 11 report is issued
 * in December (SAST): a Grade 10 report labelled Grade 11 would be scored as "Qualify now", while
 * the other mistake can only say "on track". Grade 10 starts on its own report; Grade 12, or no
 * grade, on the final Grade 11 report. The learner can pick another.
 */
export function defaultReportKind(grade: number | null, today: Date): ReportKind {
  if (grade === 10) return 'grade-10-final';
  if (grade === 11) return sastMonth(today) === 12 ? 'grade-11-final' : 'grade-10-final';
  return 'grade-11-final';
}

/** South Africa's calendar month at `at`, 1 to 12 (SAST, UTC+2, no daylight saving). */
function sastMonth(at: Date): number {
  return new Date(at.getTime() + 2 * 3_600_000).getUTCMonth() + 1;
}

/**
 * The report a document prints, when its grade and term settle it (A1-35), for the form to start
 * on. Null when they don't: a Grade 10 September report has no kind of its own, and calling it the
 * final one would mislabel the school record; the learner picks.
 */
export function printedReportKind(printed: {
  readonly grade: number | null;
  readonly term: 'final' | 'june' | 'september' | 'other' | null;
}): ReportKind | null {
  const { grade, term } = printed;
  if (grade === 10) {
    if (term === 'june') return 'grade-10-june';
    return term === 'final' || term === null ? 'grade-10-final' : null;
  }
  if (grade === 11) {
    if (term === 'june' || term === 'september') return `grade-11-${term}`;
    return term === 'final' || term === null ? 'grade-11-final' : null;
  }
  if (grade === 12 && (term === 'june' || term === 'september' || term === 'final')) {
    return `grade-12-${term}`;
  }
  return null;
}

/** A report from a grade above the learner's own (A1-35): refused. No grade, nothing to compare. */
export function reportAboveGrade(kind: ReportKind, grade: number | null): boolean {
  return grade !== null && reportGrade(kind) > grade;
}

/** The grade the report was written in. */
export function reportGrade(kind: ReportKind): 10 | 11 | 12 {
  if (kind.startsWith('grade-10')) return 10;
  if (kind.startsWith('grade-11')) return 11;
  return 12;
}
