/**
 * The one rule for a weighting's components (audit A1-81): they add up to 100, exactly (within
 * float noise, never a rounding), and no two share a name. `weightingProblems` (assessment.ts)
 * applies it to published schemes and learners' outlines alike; packages/documents' confirm
 * schema, the outline confirm step in the browser and migration 0042's database check apply the
 * same rule, so an outline the learner confirmed is never one `resolveScheme` refuses.
 *
 * No zod and no records: the browser and the app may load it (`@universityflow/catalogue/client`).
 */

/** Float noise in a sum of printed weights (33.3 + 33.3 + 33.4), nothing more. */
export const WEIGHT_TOLERANCE = 1e-6;

/** Whether weights add up to 100 (33.333 × 3 = 99.999 does not: refused, never rounded). */
export function weightsAddUpTo100(weights: ReadonlyArray<number>): boolean {
  return Math.abs(weights.reduce((sum, w) => sum + w, 0) - 100) < WEIGHT_TOLERANCE;
}

/** A component's name as two names are compared: case and spacing don't matter. */
export function componentNameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** The names used by more than one component, as first written; empty when every name is its own. */
export function duplicateComponentNames(names: ReadonlyArray<string>): string[] {
  const seen = new Set<string>();
  const twice: string[] = [];
  const reported = new Set<string>();
  for (const name of names) {
    const key = componentNameKey(name);
    if (seen.has(key) && !reported.has(key)) {
      twice.push(name);
      reported.add(key);
    }
    seen.add(key);
  }
  return twice;
}
