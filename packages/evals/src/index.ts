/**
 * AI evaluations (planning.md §12.1). The crisis red-team suite must pass 100% before any
 * change to `packages/agent` or `packages/content` merges (hard rule 7). It runs in CI on every
 * pull request: the protocol is deterministic, so it needs no API key.
 */
export const CRISIS_PASS_RATE_REQUIRED = 1;

export { CAMPUS_CRISIS_CASES, type CampusCrisisCase } from './campus-cases';
export { CRISIS_CASES, type CrisisCase } from './crisis-cases';
export { type CaseOutcome, runCrisisSuite } from './crisis-suite';
export { PLAN_MAP_CASES, type PlanMapCase } from './plan-map-cases';
export { SAFETY_ADVICE_CASES, type SafetyAdviceCase } from './safety-cases';
