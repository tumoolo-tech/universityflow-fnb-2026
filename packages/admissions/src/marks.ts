import { isSubjectId, type SubjectId } from '@universityflow/catalogue';
import { type AchievementLevel, achievementLevel } from './nsc-levels';

/**
 * One subject result from a report the student has confirmed (hard rule 6). Calculators only
 * ever take confirmed marks: what a document reader *thought* it saw never reaches them.
 */
export interface SubjectMark {
  readonly subject: SubjectId;
  readonly percent: number;
}

export interface LevelledMark extends SubjectMark {
  readonly level: AchievementLevel;
}

export class InvalidMarksError extends Error {
  override readonly name = 'InvalidMarksError';
}

/**
 * Checks a set of marks before any calculation runs: known subjects, whole percentages from 0
 * to 100, and no subject twice. Bad input is refused, never quietly repaired, because a
 * repaired mark is a mark the student didn't confirm.
 */
export function validateMarks(marks: ReadonlyArray<SubjectMark>): ReadonlyArray<LevelledMark> {
  const seen = new Set<string>();
  return marks.map((mark) => {
    if (!isSubjectId(mark.subject)) {
      throw new InvalidMarksError(`Unknown subject: ${mark.subject}`);
    }
    if (seen.has(mark.subject)) {
      throw new InvalidMarksError(`${mark.subject} appears twice`);
    }
    seen.add(mark.subject);
    try {
      return { ...mark, level: achievementLevel(mark.percent) };
    } catch {
      throw new InvalidMarksError(
        `${mark.subject}: a percentage must be a whole number from 0 to 100, got ${mark.percent}`,
      );
    }
  });
}

/** Highest percentage first; ties keep their input order, so results are stable. */
export function byPercentDescending<T extends SubjectMark>(marks: ReadonlyArray<T>): T[] {
  return [...marks].sort((a, b) => b.percent - a.percent);
}
