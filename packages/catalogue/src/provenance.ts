import { z } from 'zod';

/**
 * Where a catalogue fact came from, and who checked it (hard rule 3, planning.md §8.2).
 *
 * A wrong requirement or deadline can cost a learner a year, so no record reaches a student
 * without an official source, the academic year it applies to, and a named person who checked
 * it against that source on a given date.
 *
 * Records are written in two steps. Research captures the source and the year; a person then
 * checks the record against that source and adds `verifiedOn` and `verifiedBy`. Until both are
 * present the record is a draft: it validates, so the data files can hold it, but
 * `isPublishable` refuses it and no student ever sees it.
 */
export const provenanceSchema = z.object({
  /** The official page or prospectus PDF. HTTPS only: a source we can't verify isn't a source. */
  sourceUrl: z.url({ protocol: /^https$/ }),
  /** The academic year the fact applies to, e.g. 2028 for the intake that applies in 2027. */
  academicYear: z.int().min(2025).max(2100),
  /** The date the record was checked against its source (ISO, YYYY-MM-DD). */
  verifiedOn: z.iso.date().optional(),
  /** Who checked it. A person, not a process. */
  verifiedBy: z.string().trim().min(2).optional(),
});

export type Provenance = z.infer<typeof provenanceSchema>;

/** The fields a record must carry before a student may see it. */
export const verifiedProvenanceSchema = provenanceSchema.required({
  verifiedOn: true,
  verifiedBy: true,
});

/** Adds the provenance fields to a catalogue record's schema. Every record type uses this. */
export function sourced<T extends z.ZodRawShape>(shape: T) {
  return provenanceSchema.extend(shape);
}

/**
 * Whether a record may be shown to a student today.
 *
 * Schema validity is necessary but not sufficient: a verification dated in the future is a
 * typo or a fabrication, and either way it hasn't happened yet.
 */
export function isPublishable(record: Provenance, today: Date): boolean {
  const parsed = verifiedProvenanceSchema.safeParse(record);
  if (!parsed.success) return false;
  return parsed.data.verifiedOn <= today.toISOString().slice(0, 10);
}

/** A draft has its source but nobody has checked it yet. */
export function isDraft(record: Provenance): boolean {
  return !verifiedProvenanceSchema.safeParse(record).success;
}
