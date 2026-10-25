import { z } from 'zod';

/**
 * Reading an acceptance letter (planning.md §11, Phase 5a).
 *
 * The reader returns what the letter says, as printed: the university and programme in the
 * letter's own words, which kind of offer it is, the conditions word for word, and the date to
 * reply by. It never returns the learner's name, ID number, student number, address, contact
 * details or any reference number: the schema has no place for them (data minimisation,
 * planning.md §8.1, D4).
 *
 * Nothing here interprets a condition: the conditions are the university's words, shown to the
 * learner as quoted. Which catalogue programme the letter means is matched by tested code in
 * packages/admissions (`programmeCandidates`), as a short list the learner chooses from. The
 * result is a *draft* the learner confirms field by field before anything uses it (hard rule 6).
 */

/** The kinds of offer a letter makes (packages/admissions `OFFER_KINDS`; the web tests hold them equal). */
export const LETTER_OFFER_KINDS = ['provisional', 'conditional', 'final', 'waitlist'] as const;
export type LetterOfferKind = (typeof LETTER_OFFER_KINDS)[number];

export const extractedLetterSchema = z.object({
  /** False when the document isn't an offer or acceptance letter from a university. */
  isAcceptanceLetter: z.boolean(),
  /** The university's name as printed, or null when it can't be read. */
  universityAsPrinted: z.string().nullable(),
  /** The programme or qualification as printed, or null when it can't be read. */
  programmeAsPrinted: z.string().nullable(),
  /** The kind of offer the letter says it is; `unclear` when it doesn't say plainly. */
  offerKind: z.enum([...LETTER_OFFER_KINDS, 'unclear']),
  /** Each condition of the offer, word for word as printed. */
  conditions: z.array(z.string()),
  /** The date the learner must reply or accept by, as YYYY-MM-DD, or null when none is printed. */
  replyBy: z.string().nullable(),
  /** True when parts were too blurred or cut off to read. */
  partlyUnreadable: z.boolean(),
});
export type ExtractedLetter = z.infer<typeof extractedLetterSchema>;

/** At most this many conditions are kept, each at most this long. */
export const MAX_CONDITIONS = 20;
export const MAX_CONDITION_LENGTH = 500;

/** One line, no control characters, spaces collapsed: what is stored and shown, as quoted. */
export function cleanCondition(text: string): string {
  return text
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date written as YYYY-MM-DD. */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export type LetterWarning =
  | 'not-a-letter'
  | 'partly-unreadable'
  | 'kind-unclear'
  | 'reply-by-unreadable'
  | 'conditions-cut';

/** What the learner checks, field by field, before the offer is saved (hard rule 6). */
export interface LetterDraft {
  readonly universityAsPrinted: string | null;
  readonly programmeAsPrinted: string | null;
  /** Null when the letter didn't say plainly: the learner chooses. */
  readonly kind: LetterOfferKind | null;
  readonly conditions: ReadonlyArray<string>;
  /** YYYY-MM-DD, or null when none was printed or it couldn't be read as a date. */
  readonly replyBy: string | null;
  readonly warnings: ReadonlyArray<LetterWarning>;
}

const short = (text: string | null, max: number) => {
  const cleaned = text === null ? '' : cleanCondition(text);
  return cleaned === '' ? null : cleaned.slice(0, max);
};

export function draftFromLetter(extracted: ExtractedLetter): LetterDraft {
  const warnings: LetterWarning[] = [];
  if (!extracted.isAcceptanceLetter) warnings.push('not-a-letter');
  if (extracted.partlyUnreadable) warnings.push('partly-unreadable');
  const kind = extracted.offerKind === 'unclear' ? null : extracted.offerKind;
  if (kind === null) warnings.push('kind-unclear');

  const printed = extracted.replyBy?.trim() ?? '';
  const replyBy = printed !== '' && isIsoDate(printed) ? printed : null;
  if (printed !== '' && replyBy === null) warnings.push('reply-by-unreadable');

  const all = extracted.conditions.map(cleanCondition).filter((c) => c !== '');
  const cut = all.length > MAX_CONDITIONS || all.some((c) => c.length > MAX_CONDITION_LENGTH);
  if (cut) warnings.push('conditions-cut');
  return {
    universityAsPrinted: short(extracted.universityAsPrinted, 120),
    programmeAsPrinted: short(extracted.programmeAsPrinted, 160),
    kind,
    conditions: all.slice(0, MAX_CONDITIONS).map((c) => c.slice(0, MAX_CONDITION_LENGTH)),
    replyBy,
    warnings,
  };
}

const PROGRAMME_ID = /^(?=.{3,80}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;

const condition = z
  .string()
  .transform(cleanCondition)
  .pipe(z.string().min(1).max(MAX_CONDITION_LENGTH));

/**
 * An offer as the learner confirms it (hard rule 6): from a letter they checked field by field,
 * or "I got in" in their own words (no letter, no conditions they typed in unless they choose
 * to). The programme is a catalogue id; the conditions are kept as quoted.
 */
export const confirmedOfferSchema = z
  .object({
    programmeId: z.string().regex(PROGRAMME_ID),
    kind: z.enum(LETTER_OFFER_KINDS),
    replyBy: z.string().refine(isIsoDate, 'A date as YYYY-MM-DD').nullable(),
    conditions: z.array(condition).max(MAX_CONDITIONS),
    /** The letter the values were read from, when there was one. */
    documentId: z.uuid().nullable().optional(),
  })
  .strict();
export type ConfirmedOffer = z.infer<typeof confirmedOfferSchema>;
