/**
 * The ids the campus tour, the first-week checklist and the safety guidance are built from
 * (planning.md §11, Phase 5b). The words for each live in `en` (`en.campus`, `en.firstWeek`,
 * `en.safety`), keyed by these ids, so a step or tip can't be added without its wording.
 *
 * Plain values only: the mobile app imports this (hard rule 11).
 */

/**
 * What a learner needs a place for, in the order the tour shows it, and which kinds of campus
 * place (packages/catalogue `PLACE_KINDS`) answer each need. Every kind but `other` is in exactly
 * one need; a test in packages/agent holds the two lists together.
 */
export const PLACE_NEEDS = {
  'getting-started': ['registration-venue', 'financial-aid'],
  'health-and-safety': ['clinic', 'counselling', 'security'],
  study: ['library', 'computer-lab'],
  'daily-life': ['food', 'transport', 'residence-office'],
  support: ['disability-unit', 'other'],
} as const;
export type PlaceNeed = keyof typeof PLACE_NEEDS;
export const PLACE_NEED_IDS = Object.keys(PLACE_NEEDS) as PlaceNeed[];

/**
 * The first-week checklist, in order. Progress is kept per learner and university (packages/db,
 * migration 0019) by these ids; dates come from the university's registration calendar, never
 * from the wording.
 */
export const FIRST_WEEK_STEPS = [
  'register',
  'student-card',
  'faculty-office',
  'email-and-lms',
  'check-modules',
  'clinic-and-security',
  'financial-aid',
  'residence-check-in',
] as const;
export type FirstWeekStep = (typeof FIRST_WEEK_STEPS)[number];

export function isFirstWeekStep(value: unknown): value is FirstWeekStep {
  return typeof value === 'string' && (FIRST_WEEK_STEPS as ReadonlyArray<string>).includes(value);
}

/**
 * Digital safety and scam guidance (planning.md §8.6), in the order it is shown. Delivered at the
 * right moment: before you arrive (the tour, once an offer is accepted), the first week, and as a
 * few push notifications (owner's decision 4: push and in-app only, never SMS or WhatsApp).
 */
export const SAFETY_TIPS = [
  'accommodation-scams',
  'admission-and-bursary-scams',
  'phishing',
  'passwords',
  'shared-computers',
  'keep-proof',
  'back-up',
] as const;
export type SafetyTip = (typeof SAFETY_TIPS)[number];
