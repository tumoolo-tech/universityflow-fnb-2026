/**
 * A learner's school grade over time (planning.md §18.3, G10-1). The grade is given once, at
 * sign-up or on About me, and goes up by one each new school year after that, so a learner who
 * signed up in Grade 10 is in matric two years later without typing anything. It stops at 12: a
 * learner past matric is at university or between, which their offers say, not their grade. Each
 * January the learner is asked to confirm it (`gradeCheckDue`); saying so records it afresh.
 *
 * Plain values: both apps load this through `@universityflow/catalogue/client` (audit A4-02).
 */

/** The grades a learner can give: UniversityFlow starts at Grade 10 (D1 kept, §18.8). */
export const SCHOOL_GRADES = [10, 11, 12] as const;
export type SchoolGrade = (typeof SCHOOL_GRADES)[number];

/** South Africa's calendar year at `at` (SAST, UTC+2, no daylight saving). */
function sastYear(at: Date): number {
  return new Date(at.getTime() + 2 * 3_600_000).getUTCFullYear();
}

/** School years started since the grade was given: 0 in the same calendar year. */
function yearsSince(givenOn: string, today: Date): number {
  return Math.max(0, sastYear(today) - Number(givenOn.slice(0, 4)));
}

export interface GradeOnRecord {
  /** The grade as the learner gave it, or null. */
  readonly grade: number | null;
  /** The SAST date (YYYY-MM-DD) they gave or last confirmed it; null with no grade. */
  readonly givenOn: string | null;
}

/** The grade the learner is in today: the grade they gave, plus a year per school year since, to 12. */
export function currentGrade(record: GradeOnRecord, today: Date): number | null {
  if (record.grade === null) return null;
  if (record.givenOn === null) return record.grade;
  return Math.min(12, record.grade + yearsSince(record.givenOn, today));
}

/**
 * Whether to ask "Are you in Grade N now?": a new school year has started since the grade was
 * given or confirmed, and the grade it moved to is still a school grade. A learner whose grade
 * would pass 12 isn't asked about a grade they have finished.
 */
export function gradeCheckDue(record: GradeOnRecord, today: Date): boolean {
  if (record.grade === null || record.givenOn === null) return false;
  const years = yearsSince(record.givenOn, today);
  return years > 0 && record.grade + years <= 12;
}

/**
 * Whether the learner has finished school: the yearly rise would take them past Grade 12
 * (A10-38, A11-27). `currentGrade` stops at 12, so this says what the 12 doesn't: they are at
 * university or between, and "in Grade 12" would be untrue (to the AI, and in their export).
 */
export function schoolFinished(record: GradeOnRecord, today: Date): boolean {
  if (record.grade === null || record.givenOn === null) return false;
  return record.grade + yearsSince(record.givenOn, today) > 12;
}
