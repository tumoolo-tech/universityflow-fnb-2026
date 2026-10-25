import { z } from 'zod';
import { sastDateOf } from './exams';
import { provenanceSchema } from './provenance';
import { isUniversitySource, universityId } from './records';
import { SAFETY_ADVICE_KINDS } from './safety-kinds';

export { SAFETY_ADVICE_KINDS, type SafetyAdviceKind } from './safety-kinds';

/**
 * A university's own safety advice (planning.md §11, Phase 5e-3): "walk in groups", an escort, a
 * shuttle stop, an area the university itself names. Quoted, never paraphrased; dated; and it
 * **expires**, so stale advice goes back to a person instead of staying on screen (owner's
 * decisions 6 and 8).
 *
 * Sourced like every record (hard rule 3): a page on the university's own site, and
 * `verifiedOn`/`verifiedBy` only from a person. Strict: there is no severity, danger level or map
 * zone, and a record that tries to add one doesn't validate.
 *
 * Pure data only: the mobile app imports this (hard rule 11).
 */

const isoDate = z.iso.date();
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lower-case words joined by hyphens');

/**
 * How long a note may stay on screen before a person re-checks it: 90 days (owner's decision 8,
 * the recommendation). A record can't choose a longer life: the schema refuses it.
 */
export const SAFETY_ADVICE_HORIZON_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(isoDay: string, days: number): string {
  return new Date(Date.parse(`${isoDay}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * A note's life, for the data files: from the day a person read the page to the horizon. Use it
 * rather than typing `validUntil`, so every note gets the same horizon.
 */
export function adviceValidity(readOn: string): { validFrom: string; validUntil: string } {
  if (!isoDate.safeParse(readOn).success) {
    throw new RangeError(`A note's reading date is an ISO day (YYYY-MM-DD), not "${readOn}"`);
  }
  return { validFrom: readOn, validUntil: addDays(readOn, SAFETY_ADVICE_HORIZON_DAYS) };
}

export const safetyAdviceSchema = provenanceSchema
  .extend({
    /** Starts with the university id, e.g. `uj-walk-in-groups`. */
    id: slug,
    universityId,
    /** The campus it is about. Left out when the advice is for the whole university. */
    campusId: slug.optional(),
    /** The place it is about (a bus stop, a gate), when the university names one. */
    placeId: slug.optional(),
    kind: z.enum(SAFETY_ADVICE_KINDS),
    /** The university's exact words. Never paraphrased, never shortened in a way that changes them. */
    quote: z.string().trim().min(3),
    /**
     * An area, only in the university's own words ("Auckland Park / Melville / Hursthill"), only
     * when it names one (owner's decision 6). Never our own description of a place.
     */
    area: z.string().trim().min(2).optional(),
    /** Days and hours as printed, when the advice is for some times only. */
    days: z.string().trim().min(2).optional(),
    hours: z.string().trim().min(3).optional(),
    /** The date the university's page prints for the advice. Left out when it prints none. */
    publishedOn: isoDate.optional(),
    /** The day a person read it on the page. */
    validFrom: isoDate,
    /** The last day it may be shown: required, within the horizon (`adviceValidity`). */
    validUntil: isoDate,
    /** Something research could not settle, shown to the verifier only. */
    note: z.string().min(3).optional(),
  })
  .strict()
  .refine((a) => isUniversitySource(a.universityId, a.sourceUrl), {
    message: 'A record cites a page on its university’s own domain',
  })
  .refine((a) => a.id.startsWith(`${a.universityId}-`), {
    message: 'A safety note id starts with its university id',
  })
  .refine((a) => a.campusId === undefined || a.campusId.startsWith(`${a.universityId}-`), {
    message: 'A safety note is on one of its own university’s campuses',
  })
  .refine((a) => a.validUntil > a.validFrom, {
    message: 'A safety note expires after it starts',
  })
  .refine((a) => a.validUntil <= addDays(a.validFrom, SAFETY_ADVICE_HORIZON_DAYS), {
    message: `A safety note expires within ${SAFETY_ADVICE_HORIZON_DAYS} days of being read`,
  })
  .refine((a) => a.publishedOn === undefined || a.publishedOn <= a.validFrom, {
    message: 'A page is published before it is read',
  });
export type SafetyAdvice = z.infer<typeof safetyAdviceSchema>;

type Dated = Pick<SafetyAdvice, 'validFrom' | 'validUntil'>;

/** Whether a note may be shown on `today` (a South African day): from `validFrom` to `validUntil`. */
export function isAdviceCurrent(advice: Dated, today: Date): boolean {
  const day = sastDateOf(today);
  return advice.validFrom <= day && day <= advice.validUntil;
}

/** Whether a note's last day has passed: it goes back to a person ("expired: re-check"). */
export function isAdviceExpired(advice: Dated, today: Date): boolean {
  return sastDateOf(today) > advice.validUntil;
}
