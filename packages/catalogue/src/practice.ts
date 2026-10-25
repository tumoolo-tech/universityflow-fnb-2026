import { z } from 'zod';
import { sourced } from './provenance';
import { subjectId } from './subject-schema';
import type { SubjectId } from './subjects';

/**
 * Free, curriculum-aligned study material a learner can open: Siyavula's open textbooks, its
 * practice and its past papers (planning.md §3, Stage 3; §11, Phase 4e). Sourced catalogue
 * records like every other fact (hard rule 3): a link that has moved, or a resource that has
 * started charging, would send a learner somewhere wrong, so each one stays a draft until a
 * person has opened it and checked it against its source.
 *
 * Only free resources are ever recorded (planning.md §8.3: link only to legitimately free
 * sources): the schema has no "paid" value. Practice needs a free account, and says so.
 *
 * No admission fact lives here (hard rule 2): a practice record says what to study, never what
 * mark a course needs. Pure data only: the mobile app imports this (hard rule 11).
 */

export const PRACTICE_PROVIDERS = ['siyavula'] as const;

/** The domains a practice record may link to and cite: the provider's own site. */
export const PRACTICE_SOURCE_DOMAINS = ['siyavula.com'] as const;

/** Whether a URL is on one of `PRACTICE_SOURCE_DOMAINS` (or a subdomain of one). */
export function isPracticeSource(url: string): boolean {
  const host = new URL(url).hostname;
  return PRACTICE_SOURCE_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

export const PRACTICE_KINDS = ['textbook', 'practice', 'past-papers'] as const;
export type PracticeKind = (typeof PRACTICE_KINDS)[number];

/**
 * What it costs a learner. `free`: open it and read, no account. `free-with-account`: free, but
 * the learner signs up first (Siyavula asks under-18s for a parent's or guardian's consent).
 */
export const PRACTICE_ACCESS = ['free', 'free-with-account'] as const;
export type PracticeAccess = (typeof PRACTICE_ACCESS)[number];

/** The licence the provider states for the content (not for its site, logo or name). */
export const PRACTICE_LICENCES = ['cc-by-3.0', 'closed-copyright', 'site-terms'] as const;

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lower-case words joined by hyphens');
const https = z.url({ protocol: /^https$/ });

export const practiceResourceSchema = sourced({
  id: slug,
  provider: z.enum(PRACTICE_PROVIDERS),
  kind: z.enum(PRACTICE_KINDS),
  subjectId,
  /** The NSC grades it covers, as the provider lists them. */
  grades: z.array(z.int().min(10).max(12)).min(1),
  /** The title as the provider prints it. */
  title: z.string().trim().min(3),
  /** The page the learner opens. `sourceUrl` is the page that says it is free. */
  url: https,
  access: z.enum(PRACTICE_ACCESS),
  licence: z.enum(PRACTICE_LICENCES),
  /** The day research opened `url` and `sourceUrl` (ISO). Not a verification: see hard rule 3. */
  accessedOn: z.iso.date(),
  /** Something research could not settle, shown to the verifier. */
  note: z.string().min(3).optional(),
})
  .refine((r) => isPracticeSource(r.url) && isPracticeSource(r.sourceUrl), {
    message: 'A practice link and its source must both be on the provider’s own site',
  })
  .refine((r) => new Set(r.grades).size === r.grades.length, {
    message: 'Each grade once',
  });
export type PracticeResource = z.infer<typeof practiceResourceSchema>;

/**
 * The resources for one subject that suit a learner in `grade`: their grade and the grades still
 * ahead of them. When none does (a Grade 10 book is all there is), every one for the subject, so
 * the learner still gets something to revise from. Unknown grade: everything for the subject.
 * Textbooks first, then practice, then past papers; within a kind, by grade.
 */
export function practiceForSubject(
  resources: ReadonlyArray<PracticeResource>,
  subject: SubjectId,
  grade: number | null,
): PracticeResource[] {
  const forSubject = resources.filter((r) => r.subjectId === subject);
  const ahead =
    grade === null ? forSubject : forSubject.filter((r) => r.grades.some((g) => g >= grade));
  const chosen = ahead.length > 0 ? ahead : forSubject;
  return [...chosen].sort(
    (a, b) =>
      PRACTICE_KINDS.indexOf(a.kind) - PRACTICE_KINDS.indexOf(b.kind) ||
      Math.min(...a.grades) - Math.min(...b.grades) ||
      a.id.localeCompare(b.id),
  );
}
