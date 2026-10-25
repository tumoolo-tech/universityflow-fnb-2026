import {
  ENGLISH,
  isHomeLanguage,
  LIFE_ORIENTATION,
  type RequiredPass,
  type SubjectId,
} from '@universityflow/catalogue';
import { byPercentDescending, type SubjectMark, validateMarks } from './marks';

/**
 * The NSC pass a set of marks would earn, as defined nationally.
 *
 * Source: North West Department of Education, NSC information page
 * (https://education.nwpg.gov.za/?page_id=128), restating the DBE requirements:
 * - **NSC**: 40% in three subjects, one an official language at Home Language level, and 30%
 *   in three subjects.
 * - **Higher Certificate**: an NSC with at least 30% in the language of learning and teaching.
 * - **Diploma**: as above, plus level 3 (40%) or better in four 20-credit subjects.
 * - **Bachelor's**: as above, plus level 4 (50%) or better in four 20-credit subjects.
 * The designated-subject list was revoked in 2018, so any 20-credit subject counts; Life
 * Orientation (10 credits) never does.
 *
 * Applied to Grade 11 or June marks this is a *projection*, and the interface says so: the pass
 * is awarded on the final NSC results.
 */

export type PassOutcome = RequiredPass | 'nsc' | 'none';

/** Lowest to highest, so passes can be compared by index. */
export const PASS_ORDER: ReadonlyArray<PassOutcome> = [
  'none',
  'nsc',
  'higher-certificate',
  'diploma',
  'bachelor',
];

export function passRank(pass: PassOutcome): number {
  return PASS_ORDER.indexOf(pass);
}

export function meetsPass(achieved: PassOutcome, required: RequiredPass): boolean {
  return passRank(achieved) >= passRank(required);
}

/** The language of learning and teaching at all six launch universities is English. */
const LOLT: ReadonlyArray<SubjectId> = ENGLISH;

function earnsNsc(marks: ReadonlyArray<SubjectMark>): boolean {
  for (const home of marks) {
    if (!isHomeLanguage(home.subject) || home.percent < 40) continue;
    const others = byPercentDescending(marks.filter((m) => m !== home));
    const atForty = others.slice(0, 2);
    const atThirty = others.slice(2, 5);
    if (
      atForty.length === 2 &&
      atForty.every((m) => m.percent >= 40) &&
      atThirty.length === 3 &&
      atThirty.every((m) => m.percent >= 30)
    ) {
      return true;
    }
  }
  return false;
}

function fourTwentyCreditAtLeast(marks: ReadonlyArray<SubjectMark>, percent: number): boolean {
  return marks.filter((m) => m.subject !== LIFE_ORIENTATION && m.percent >= percent).length >= 4;
}

export function nscPass(marks: ReadonlyArray<SubjectMark>): PassOutcome {
  const checked = validateMarks(marks);
  if (!earnsNsc(checked)) return 'none';
  const lolt = checked.some((m) => LOLT.includes(m.subject) && m.percent >= 30);
  if (!lolt) return 'nsc';
  if (fourTwentyCreditAtLeast(checked, 50)) return 'bachelor';
  if (fourTwentyCreditAtLeast(checked, 40)) return 'diploma';
  return 'higher-certificate';
}
