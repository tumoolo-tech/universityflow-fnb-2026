/**
 * National Senior Certificate achievement levels.
 *
 * Every university's admission score starts from these, and then diverges: UP and UJ add the
 * levels of the best six subjects, Wits uses its own table, UCT adds raw percentages
 * (planning.md §2.3). The per-university formulas live beside this file, one module each, and
 * are verified against each prospectus in Phase 1. This mapping is the one thing they share.
 *
 * Source: Department of Basic Education, NSC achievement levels (national, not per university).
 */

export type AchievementLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * Lower bound (inclusive) of each level's percentage band, highest first. Level 1 (0–29%) is
 * whatever falls below the last band.
 */
const BANDS: ReadonlyArray<readonly [min: number, level: AchievementLevel]> = [
  [80, 7],
  [70, 6],
  [60, 5],
  [50, 4],
  [40, 3],
  [30, 2],
];

/** The lowest percentage that reaches each level: the mark a learner has to aim for. */
export const LEVEL_FLOOR: Readonly<Record<AchievementLevel, number>> = {
  1: 0,
  2: 30,
  3: 40,
  4: 50,
  5: 60,
  6: 70,
  7: 80,
};

/**
 * The achievement level for a subject percentage.
 *
 * Reports print whole percentages, so anything else is rejected rather than rounded: how a
 * fractional mark rounds is a per-university rule, and guessing it here would hide the choice.
 */
export function achievementLevel(percent: number): AchievementLevel {
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    throw new RangeError(
      `A subject percentage must be a whole number from 0 to 100, got ${percent}`,
    );
  }
  for (const [min, level] of BANDS) {
    if (percent >= min) return level;
  }
  return 1;
}
