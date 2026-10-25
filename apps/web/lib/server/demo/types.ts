import type { Store } from '@universityflow/db';

/**
 * Judge demo mode's seam between the core (agent D1: config, routes, picker, banner) and the seed
 * (agent D2: `personas.ts`, which replaces the stand-in). Server-only, like everything here.
 */

export const DEMO_PERSONA_IDS = [
  'demo-grade-10',
  'demo-grade-11',
  'demo-grade-12',
  'demo-first-year',
  'demo-second-year',
  'demo-final-year',
] as const;

export type DemoPersonaId = (typeof DEMO_PERSONA_IDS)[number];

export function isDemoPersonaId(value: unknown): value is DemoPersonaId {
  return (DEMO_PERSONA_IDS as ReadonlyArray<unknown>).includes(value);
}

/** One card on the picker. Every string is a packages/content value (hard rule 8). */
export interface DemoPersonaCard {
  readonly id: DemoPersonaId;
  /** First name only. */
  readonly name: string;
  /** "Grade 11", "First year". */
  readonly stage: string;
  /** The university's name, for the university years. */
  readonly university?: string;
  /** One line: what to try as this learner. */
  readonly tryThis: string;
}

/**
 * Makes a judge's private copy of a persona and returns the new student's id.
 *
 * `store` is the app's `Store` (packages/db), the same object the sign-in routes create students
 * through: the seed uses its existing methods, so every rule, RLS policy and audit row applies,
 * and consent (guardian or adult) is recorded before anything else is written (hard rule 5).
 * The core opens the session itself (`Store.openDemoSession`) and sweeps copies after 24 hours.
 */
export type CloneDemoPersona = (
  store: Store,
  id: DemoPersonaId,
  /** The store's clock; the real time in the app (tests pass their own). */
  now?: Date,
) => Promise<string>;
