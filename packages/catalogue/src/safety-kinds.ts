/**
 * What a university's safety note is about (planning.md §11, Phase 5e-3), so the screens can say
 * what to do for each. Plain values only: browsers and the phone app load this through
 * `@universityflow/catalogue/client` (audit A4-02). There is deliberately no severity and no zone:
 * a note is the university's own words, never our rating of a place.
 */
export const SAFETY_ADVICE_KINDS = [
  'avoid-after-dark',
  'walk-in-groups',
  'escort-available',
  'shuttle-stop',
  'safe-route',
  'emergency-point',
  'incident-advisory',
  'general-tip',
] as const;
export type SafetyAdviceKind = (typeof SAFETY_ADVICE_KINDS)[number];
