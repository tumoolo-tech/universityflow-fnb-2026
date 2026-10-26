import { z } from 'zod';
import { sastDateOf } from './exams';
import { sourced } from './provenance';

/**
 * Bursaries beside NSFAS (planning.md §2.4, §3 Stage 2 "NSFAS and bursaries in the same view",
 * §9.1 "Funding first-class"): well-known bursaries open to school leavers and first-year students.
 *
 * Each record is researched from the funder's own page, or from the administrator the funder names
 * (StudyTrust runs several), and holds only what that page prints. A window the page doesn't date
 * is recorded in the source's words (`windowNote`), never guessed. Whether a window is open is
 * decided here, in code (`bursaryStatus`); the funder decides who it funds, never us or the AI.
 */

/** Broad fields of study, for "bursaries for my field". The source's own list is `fieldsAsPrinted`. */
export const FUNDING_FIELDS = [
  'teaching',
  'accounting',
  'commerce',
  'engineering',
  'science',
  'technology',
  'health',
  'law',
  'humanities',
  'arts',
  'agriculture',
] as const;
export const fundingField = z.enum(FUNDING_FIELDS);
export type FundingField = z.infer<typeof fundingField>;

/** Who funds it: a mix, so a learner sees more than company bursaries. */
export const FUNDER_KINDS = [
  'government',
  'partnership',
  'professional-body',
  'corporate',
  'foundation',
] as const;
export type FunderKind = (typeof FUNDER_KINDS)[number];

const isoDate = z.iso.date();
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lower-case words joined by hyphens');
const text = z.string().trim().min(3);

export const bursarySchema = sourced({
  id: slug,
  /** The bursary's name, as the funder prints it. */
  name: text,
  funder: z.string().trim().min(2),
  funderKind: z.enum(FUNDER_KINDS),
  /** Set when the source page is an administrator's that the funder names (e.g. StudyTrust). */
  administeredBy: z.string().trim().min(2).optional(),
  /** Who may apply, one criterion per line, as the source prints it. */
  who: z.array(text).min(1),
  /** The broad fields the source's list falls in (for filtering). */
  fields: z.array(fundingField).min(1),
  /** The fields or degrees exactly as the source lists them. */
  fieldsAsPrinted: text,
  /** What it pays for, as printed. Null when the source doesn't say. */
  covers: text.nullable(),
  /** Null when the source prints no full date. */
  opensOn: isoDate.nullable(),
  closesOn: isoDate.nullable(),
  /**
   * What the source says about the window when it prints no full date ("Application season:
   * 01 June to 30 September", "Applications for the 2027 academic year are closed"), or that it
   * publishes none. Required when either date is missing, so a blank is never read as "open".
   */
  windowNote: text.nullable(),
  howToApply: text,
  applyUrl: z.url({ protocol: /^https$/ }),
  /**
   * Work after graduating, as the source states it: `required` (with its terms, e.g. teach a year
   * for every year funded, or work for the funder if it offers a job), or `not-stated` when the
   * source says nothing about it (which is not a promise that there is none).
   */
  workBack: z.object({ kind: z.enum(['required', 'not-stated']), terms: text.nullable() }),
})
  .refine((b) => b.opensOn === null || b.closesOn === null || b.opensOn <= b.closesOn, {
    message: 'A window must open before it closes',
    path: ['closesOn'],
  })
  .refine((b) => (b.opensOn !== null && b.closesOn !== null) || b.windowNote !== null, {
    message: 'Without both dates, say what the source says about the window (windowNote)',
    path: ['windowNote'],
  })
  .refine((b) => b.workBack.kind !== 'required' || b.workBack.terms !== null, {
    message: 'A work-back obligation needs its terms, as the source states them',
    path: ['workBack', 'terms'],
  });
export type Bursary = z.infer<typeof bursarySchema>;

export const BURSARY_STATUSES = ['open', 'opens-later', 'unknown', 'closed'] as const;
export type BursaryStatus = (typeof BURSARY_STATUSES)[number];

/**
 * Whether a bursary's window is open on `today`, on the South African calendar, both dates
 * inclusive. `unknown` when the source doesn't print enough to say: the learner is sent to the
 * funder's page, never told it is open.
 */
export function bursaryStatus(
  b: Pick<Bursary, 'opensOn' | 'closesOn'>,
  today: Date,
): BursaryStatus {
  const day = sastDateOf(today);
  if (b.closesOn !== null && day > b.closesOn) return 'closed';
  if (b.opensOn !== null && day < b.opensOn) return 'opens-later';
  if (b.opensOn !== null && b.closesOn !== null) return 'open';
  return 'unknown';
}

export interface BursaryWithStatus {
  readonly bursary: Bursary;
  readonly status: BursaryStatus;
}

/**
 * The bursaries a learner sees: those in `field` when one is given (else all), open windows first,
 * then not yet open, then undated, then closed; the data's order within each.
 */
export function bursariesFor(
  bursaries: ReadonlyArray<Bursary>,
  today: Date,
  field?: FundingField,
): BursaryWithStatus[] {
  return bursaries
    .filter((b) => field === undefined || b.fields.includes(field))
    .map((bursary) => ({ bursary, status: bursaryStatus(bursary, today) }))
    .map((entry, index) => ({ entry, index }))
    .sort(
      (a, b) =>
        BURSARY_STATUSES.indexOf(a.entry.status) - BURSARY_STATUSES.indexOf(b.entry.status) ||
        a.index - b.index,
    )
    .map(({ entry }) => entry);
}
