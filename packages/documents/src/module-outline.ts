import { MODULE_TERMS, type ModuleTerm } from '@universityflow/catalogue';
import { z } from 'zod';
import { cleanCondition, isIsoDate } from './letter';
import { MODULE_CODE, termFromPrinted } from './registration';

/**
 * Reading a module outline or study guide (Phase 6b, docs/plans/phase-6-proposal.md).
 *
 * The reader returns what the outline prints, as printed: the module's code and name, the
 * assessment components with their weights as printed, the DP requirement (a number and the
 * words, quoted), subminima, the supplementary rules as quoted, the dates, the prescribed and
 * recommended books, and the lecturers' **work** contact details and consultation times (D3). It
 * never returns a student number, a class list or any other student's name: the schema has no
 * place for them (data minimisation, planning.md §8.1). A personal mobile number or a personal
 * email address that an outline prints for a lecturer is dropped here, in code (D3).
 *
 * The result is a *draft* the learner confirms section by section (components, then dates, then
 * books, then people; "not in my outline" is a valid answer for each) before anything uses it
 * (hard rule 6). Turning "40 %" into 40, "Semester 1" into S1 and "15 March 2027" into a date is
 * done here, in tested code, never by the AI. Weights that don't add up to 100 are flagged in the
 * draft and refused in the confirmed outline, never rescaled.
 */

/** The kinds of assessment a component is (Phase 6a's `moduleAssessment` uses the same words). */
export const OUTLINE_COMPONENT_KINDS = [
  'test',
  'assignment',
  'practical',
  'tutorial',
  'exam',
  'project',
  'other',
] as const;
export type OutlineComponentKind = (typeof OUTLINE_COMPONENT_KINDS)[number];

export const OUTLINE_BOOK_ROLES = ['prescribed', 'recommended'] as const;
export type OutlineBookRole = (typeof OUTLINE_BOOK_ROLES)[number];

export const extractedModuleOutlineSchema = z.object({
  /** False when the document isn't a module outline, course outline or study guide. */
  isModuleOutline: z.boolean(),
  /** The module code exactly as printed, or null. */
  moduleCodeAsPrinted: z.string().nullable(),
  /** The module's name as printed, or null. */
  moduleNameAsPrinted: z.string().nullable(),
  /** The academic year the outline is for, as printed (e.g. 2027), or null. */
  academicYearAsPrinted: z.number().nullable(),
  /** The semester, term or period as printed (e.g. "Semester 1", "Year"), or null. */
  termAsPrinted: z.string().nullable(),
  /** One row per assessment component, in the outline's order. */
  components: z.array(
    z.object({
      /** The component's name as printed, e.g. "Test 1" or "Final examination". */
      name: z.string(),
      /** What kind of assessment it is, or null when unclear. */
      kind: z.enum(OUTLINE_COMPONENT_KINDS).nullable(),
      /** Its weight exactly as printed, e.g. "20%", or null when none is printed. */
      weightAsPrinted: z.string().nullable(),
      /** A subminimum printed for this component, e.g. "40%", or null. */
      subminimumAsPrinted: z.string().nullable(),
    }),
  ),
  /** The requirement for exam admission (the DP), as printed. */
  dpRequirement: z.object({
    /** The year-mark or class-mark minimum as printed, e.g. "40%", or null. */
    percentAsPrinted: z.string().nullable(),
    /** The requirement's words exactly as printed, or null. */
    quote: z.string().nullable(),
  }),
  /** The exam subminimum as printed, e.g. "40%", or null. */
  examSubminimumAsPrinted: z.string().nullable(),
  /** What the outline says about supplementary exams, word for word, or null. */
  supplementaryQuote: z.string().nullable(),
  /** Each assessment or deadline date, in the outline's order. */
  dates: z.array(
    z.object({
      /** What is due, as printed, e.g. "Test 1" or "Assignment 2 due". */
      whatAsPrinted: z.string(),
      /** The date as printed, or null when none is printed. */
      dateAsPrinted: z.string().nullable(),
    }),
  ),
  /** The prescribed and recommended books. */
  books: z.array(
    z.object({
      role: z.enum(OUTLINE_BOOK_ROLES).nullable(),
      title: z.string(),
      authors: z.string().nullable(),
      edition: z.string().nullable(),
      isbn: z.string().nullable(),
    }),
  ),
  /** The lecturers, coordinators and tutors the outline names, with their work contact details. */
  people: z.array(
    z.object({
      name: z.string(),
      roleAsPrinted: z.string().nullable(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
      office: z.string().nullable(),
      consultationTimes: z.string().nullable(),
    }),
  ),
  /** True when parts were too blurred or cut off to read. */
  partlyUnreadable: z.boolean(),
});
export type ExtractedModuleOutline = z.infer<typeof extractedModuleOutlineSchema>;

/** At most this many rows of each kind are kept. */
export const OUTLINE_LIMITS = {
  components: 20,
  dates: 40,
  books: 20,
  people: 10,
  name: 160,
  label: 120,
  quote: 500,
  title: 200,
  authors: 200,
  edition: 40,
  role: 60,
  office: 80,
  consultationTimes: 200,
  email: 120,
  phone: 30,
} as const;

// ── Conversions, in code ─────────────────────────────────────────────────────────────────────

/**
 * A percentage as printed ("40%", "40 %", "12,5%", "40 percent"), or null when it isn't one plain
 * percentage from 0 to 100 (a range, a fraction, words): the learner types it. Never a guess.
 */
export function percentFromPrinted(printed: string | null): number | null {
  if (printed === null) return null;
  const match = /^\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:%|percent|per cent)?\s*$/i.exec(printed);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(',', '.'));
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

const MONTHS: ReadonlyArray<ReadonlyArray<string>> = [
  ['jan', 'january'],
  ['feb', 'february'],
  ['mar', 'march'],
  ['apr', 'april'],
  ['may'],
  ['jun', 'june'],
  ['jul', 'july'],
  ['aug', 'august'],
  ['sep', 'sept', 'september'],
  ['oct', 'october'],
  ['nov', 'november'],
  ['dec', 'december'],
];

const iso = (year: number, month: number, day: number): string | null => {
  const value = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isIsoDate(value) ? value : null;
};

/**
 * A date as an outline prints it, as YYYY-MM-DD: "2027-03-15", "15 March 2027", "Mon, 15 Mar
 * 2027", "15/03/2027" (day first, as South Africa writes it) or "2027/03/15". A date without a
 * year, a week number or "TBC" is null: the learner sets it.
 */
export function dateFromPrinted(printed: string | null): string | null {
  if (printed === null) return null;
  const text = printed.trim().toLowerCase().replace(/\s+/g, ' ');
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(text);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
  if (m) return iso(Number(m[3]), Number(m[2]), Number(m[1]));
  m = /^(?:[a-z]+,? )?(\d{1,2})(?:st|nd|rd|th)? ([a-z]+)\.?,? (\d{4})$/.exec(text);
  if (m) {
    const month = MONTHS.findIndex((names) => names.includes(String(m?.[2])));
    return month < 0 ? null : iso(Number(m[3]), month + 1, Number(m[1]));
  }
  return null;
}

/** An ISBN-10 or ISBN-13 as printed, without hyphens or spaces, when its check digit is right. */
export function isbnFromPrinted(printed: string | null): string | null {
  if (printed === null) return null;
  const value = printed
    .replace(/^isbn(?:-1[03])?:?/i, '')
    .replace(/[\s-]/g, '')
    .toUpperCase();
  if (/^97[89]\d{10}$/.test(value)) {
    const sum = [...value]
      .slice(0, 12)
      .reduce((total, digit, i) => total + Number(digit) * (i % 2 === 0 ? 1 : 3), 0);
    return (10 - (sum % 10)) % 10 === Number(value[12]) ? value : null;
  }
  if (/^\d{9}[\dX]$/.test(value)) {
    const sum = [...value].reduce(
      (total, digit, i) => total + (digit === 'X' ? 10 : Number(digit)) * (10 - i),
      0,
    );
    return sum % 11 === 0 ? value : null;
  }
  return null;
}

/**
 * Whether a phone number is a South African mobile number (06x, 071–079, 081–084, after 0 or +27):
 * a lecturer's personal number, dropped (D3). Office lines, toll-free and share-call numbers are
 * not. The same prefixes as the `no-real-pii` guard and migration 0040's `uf_holds_mobile_number`.
 */
export function isMobileNumber(printed: string): boolean {
  const digits = printed.replace(/[\s()./-]/g, '');
  return /^(?:\+?27|0)(?:6\d|7[1-9]|8[1-4])\d{7}$/.test(digits);
}

/** Free email providers: an address there is a person's own, not their work's (D3). */
const PERSONAL_EMAIL_DOMAINS: ReadonlyArray<string> = [
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.za',
  'ymail.com',
  'hotmail.com',
  'hotmail.co.za',
  'outlook.com',
  'live.com',
  'live.co.za',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'mweb.co.za',
  'webmail.co.za',
  'telkomsa.net',
  'vodamail.co.za',
  'gmx.com',
];

export function isPersonalEmail(address: string): boolean {
  const domain = address.trim().toLowerCase().split('@')[1] ?? '';
  return PERSONAL_EMAIL_DOMAINS.includes(domain);
}

const EMAIL = /^[^\s@]{1,64}@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;

/**
 * Whether text holds a South African mobile number anywhere (its digits perhaps grouped by single
 * spaces or hyphens): "call me on …" in a consultation line is a personal number too (D3).
 * Migration 0040's `uf_holds_mobile_number` is the same rule.
 */
export function holdsMobileNumber(text: string): boolean {
  return /(?<![\d+])(?:\+27|27|0)[ -]?(?:6\d|7[1-9]|8[1-4])(?:[ -]?\d){7}(?!\d)/.test(text);
}

/**
 * Whether text holds what looks like an ID number or a student number: packages/db's
 * `holdsPersonalNumber` and migration 0021's `uf_holds_personal_number`, the same rule (a db test
 * holds them equal).
 */
export function looksLikePersonalNumber(text: string): boolean {
  return (
    /\d(?:[ -]?\d){12}/.test(text) ||
    /\b(?:student|applicant|application|reference|ref|id|identity|passport|no|nr|number|num)\b\D{0,12}\d{7,}/i.test(
      text,
    )
  );
}

/** The sum of the weights, to two decimals, or null while one is missing. */
export function weightsTotal(weights: ReadonlyArray<number | null>): number | null {
  if (weights.some((w) => w === null)) return null;
  return Math.round((weights as number[]).reduce((sum, w) => sum + w, 0) * 100) / 100;
}

// ── The draft ────────────────────────────────────────────────────────────────────────────────

export type ModuleOutlineWarning =
  | 'not-an-outline'
  | 'partly-unreadable'
  | 'code-unclear'
  | 'term-unclear'
  | 'no-components'
  | 'weight-unclear'
  | 'weights-dont-add-up'
  | 'date-unclear'
  | 'isbn-unclear'
  | 'personal-contact-dropped'
  | 'personal-number-dropped'
  | 'rows-cut';

export interface DraftOutlineComponent {
  readonly name: string;
  readonly kind: OutlineComponentKind | null;
  /** Null when none is printed, or it couldn't be read as one percentage: the learner types it. */
  readonly weight: number | null;
  readonly weightAsPrinted: string | null;
  readonly subminimum: number | null;
  readonly subminimumAsPrinted: string | null;
}

export interface DraftOutlineDate {
  readonly label: string;
  /** YYYY-MM-DD, or null when the outline printed none we could place: the learner sets it. */
  readonly date: string | null;
  readonly dateAsPrinted: string | null;
}

export interface DraftOutlineBook {
  readonly role: OutlineBookRole | null;
  readonly title: string;
  readonly authors: string | null;
  readonly edition: string | null;
  /** Hyphens removed, when the check digit is right; otherwise null and `isbnAsPrinted` shown. */
  readonly isbn: string | null;
  readonly isbnAsPrinted: string | null;
}

export interface DraftOutlinePerson {
  readonly name: string;
  readonly role: string | null;
  /** A work address only: a personal one is dropped (D3). */
  readonly email: string | null;
  /** An office line only: a mobile number is dropped (D3). */
  readonly phone: string | null;
  readonly office: string | null;
  readonly consultationTimes: string | null;
}

/** What the learner checks, section by section, before the outline is saved (hard rule 6). */
export interface ModuleOutlineDraft {
  readonly moduleCode: string | null;
  readonly moduleName: string | null;
  readonly academicYear: number | null;
  readonly term: ModuleTerm | null;
  readonly termAsPrinted: string | null;
  readonly components: ReadonlyArray<DraftOutlineComponent>;
  /** The sum of the weights, or null while one is missing. */
  readonly weightsTotal: number | null;
  readonly dpPercent: number | null;
  readonly dpPercentAsPrinted: string | null;
  readonly dpQuote: string | null;
  readonly examSubminimum: number | null;
  readonly examSubminimumAsPrinted: string | null;
  readonly supplementaryQuote: string | null;
  readonly dates: ReadonlyArray<DraftOutlineDate>;
  readonly books: ReadonlyArray<DraftOutlineBook>;
  readonly people: ReadonlyArray<DraftOutlinePerson>;
  readonly warnings: ReadonlyArray<ModuleOutlineWarning>;
}

export function draftFromModuleOutline(extracted: ExtractedModuleOutline): ModuleOutlineDraft {
  const warnings = new Set<ModuleOutlineWarning>();
  if (!extracted.isModuleOutline) warnings.add('not-an-outline');
  if (extracted.partlyUnreadable) warnings.add('partly-unreadable');

  /**
   * One line, cut to `max`. Text holding an ID or student number is dropped (hard rule 4), and so
   * is text holding a mobile number, wherever the outline prints it (D3).
   */
  const line = (text: string | null, max: number): string | null => {
    const cleaned = text === null ? '' : cleanCondition(text);
    if (cleaned === '') return null;
    if (looksLikePersonalNumber(cleaned)) {
      warnings.add('personal-number-dropped');
      return null;
    }
    if (holdsMobileNumber(cleaned)) {
      warnings.add('personal-contact-dropped');
      return null;
    }
    return cleaned.slice(0, max);
  };
  const keep = <T>(rows: ReadonlyArray<T>, max: number): T[] => {
    if (rows.length > max) warnings.add('rows-cut');
    return rows.slice(0, max);
  };
  const L = OUTLINE_LIMITS;

  const code = line(extracted.moduleCodeAsPrinted, 24);
  if (code !== null && !MODULE_CODE.test(code)) warnings.add('code-unclear');
  const termAsPrinted = line(extracted.termAsPrinted, 40);
  const term = termFromPrinted(termAsPrinted);
  if (termAsPrinted !== null && term === null) warnings.add('term-unclear');
  const year = extracted.academicYearAsPrinted;

  const components: DraftOutlineComponent[] = [];
  for (const c of extracted.components) {
    const name = line(c.name, L.name);
    if (name === null) continue;
    const weightAsPrinted = line(c.weightAsPrinted, 40);
    const weight = percentFromPrinted(weightAsPrinted);
    if (weight === null) warnings.add('weight-unclear');
    const subminimumAsPrinted = line(c.subminimumAsPrinted, 40);
    components.push({
      name,
      kind: c.kind,
      weight,
      weightAsPrinted,
      subminimum: percentFromPrinted(subminimumAsPrinted),
      subminimumAsPrinted,
    });
  }
  const kept = keep(components, L.components);
  if (kept.length === 0) warnings.add('no-components');
  const total = kept.length === 0 ? null : weightsTotal(kept.map((c) => c.weight));
  if (total !== null && total !== 100) warnings.add('weights-dont-add-up');

  const dates: DraftOutlineDate[] = [];
  for (const d of extracted.dates) {
    const label = line(d.whatAsPrinted, L.label);
    if (label === null) continue;
    const dateAsPrinted = line(d.dateAsPrinted, 60);
    const date = dateFromPrinted(dateAsPrinted);
    if (date === null) warnings.add('date-unclear');
    dates.push({ label, date, dateAsPrinted });
  }

  const books: DraftOutlineBook[] = [];
  for (const b of extracted.books) {
    const title = line(b.title, L.title);
    if (title === null) continue;
    // An ISBN is checked by its check digit, not by the personal-number rule (13 digits).
    const isbnAsPrinted = b.isbn === null ? null : cleanCondition(b.isbn).slice(0, 40) || null;
    const isbn = isbnFromPrinted(isbnAsPrinted);
    if (isbnAsPrinted !== null && isbn === null) warnings.add('isbn-unclear');
    books.push({
      role: b.role,
      title,
      authors: line(b.authors, L.authors),
      edition: line(b.edition, L.edition),
      isbn,
      isbnAsPrinted,
    });
  }

  const people: DraftOutlinePerson[] = [];
  for (const p of extracted.people) {
    const name = line(p.name, L.name);
    if (name === null) continue;
    let email = line(p.email, L.email);
    if (email !== null && (!EMAIL.test(email) || isPersonalEmail(email))) {
      if (isPersonalEmail(email)) warnings.add('personal-contact-dropped');
      email = null;
    }
    let phone = line(p.phone, L.phone);
    if (phone !== null && isMobileNumber(phone)) {
      warnings.add('personal-contact-dropped');
      phone = null;
    }
    people.push({
      name,
      role: line(p.roleAsPrinted, L.role),
      email,
      phone,
      office: line(p.office, L.office),
      consultationTimes: line(p.consultationTimes, L.consultationTimes),
    });
  }

  const dpPercentAsPrinted = line(extracted.dpRequirement.percentAsPrinted, 40);
  const examSubminimumAsPrinted = line(extracted.examSubminimumAsPrinted, 40);
  return {
    moduleCode: code,
    moduleName: line(extracted.moduleNameAsPrinted, L.name),
    academicYear:
      year !== null && Number.isInteger(year) && year >= 2020 && year <= 2100 ? year : null,
    term,
    termAsPrinted,
    components: kept,
    weightsTotal: total,
    dpPercent: percentFromPrinted(dpPercentAsPrinted),
    dpPercentAsPrinted,
    dpQuote: line(extracted.dpRequirement.quote, L.quote),
    examSubminimum: percentFromPrinted(examSubminimumAsPrinted),
    examSubminimumAsPrinted,
    supplementaryQuote: line(extracted.supplementaryQuote, L.quote),
    dates: keep(dates, L.dates),
    books: keep(books, L.books),
    people: keep(people, L.people),
    warnings: [...warnings],
  };
}

// ── The confirmed outline ────────────────────────────────────────────────────────────────────

/** One line of the learner's (or the outline's) words, at most `max`; no ID or student number. */
const text = (max: number) =>
  z
    .string()
    .transform(cleanCondition)
    .pipe(
      z
        .string()
        .min(1)
        .max(max)
        .refine((t) => !looksLikePersonalNumber(t), 'personal-number')
        .refine((t) => !holdsMobileNumber(t), 'mobile-number'),
    );
const optionalText = (max: number) => text(max).nullable();
const percent = z.number().min(0).max(100);

/**
 * One assessment component as the learner confirms it. A plain type, so Phase 6a's
 * `moduleAssessment` components and the calculator (6c) can take it as it is.
 */
export interface OutlineComponent {
  readonly name: string;
  readonly kind: OutlineComponentKind;
  /** Percent of the final mark, 0–100. The components' weights add up to 100. */
  readonly weight: number;
  /** A subminimum for this component, percent, or null when none is printed. */
  readonly subminimum: number | null;
}

const componentSchema = z
  .object({
    name: text(OUTLINE_LIMITS.name),
    kind: z.enum(OUTLINE_COMPONENT_KINDS),
    weight: z.number().gt(0).max(100),
    subminimum: percent.nullable(),
  })
  .strict();

const NOT_IN_OUTLINE = z.object({ status: z.literal('not-in-outline') }).strict();

/** Hard rule 6: weights that don't add up to 100 are refused, never rescaled. */
const confirmedComponents = z
  .object({
    status: z.literal('confirmed'),
    items: z.array(componentSchema).min(1).max(OUTLINE_LIMITS.components),
    dpRequirement: z
      .object({ percent: percent.nullable(), quote: optionalText(OUTLINE_LIMITS.quote) })
      .strict(),
    examSubminimum: percent.nullable(),
    supplementaryQuote: optionalText(OUTLINE_LIMITS.quote),
  })
  .strict()
  .refine((c) => weightsTotal(c.items.map((i) => i.weight)) === 100, {
    message: 'weights-dont-add-up',
    path: ['items'],
  });

const confirmedDates = z
  .object({
    status: z.literal('confirmed'),
    items: z
      .array(
        z
          .object({
            label: text(OUTLINE_LIMITS.label),
            date: z.string().refine(isIsoDate, 'A date as YYYY-MM-DD'),
          })
          .strict(),
      )
      .min(1)
      .max(OUTLINE_LIMITS.dates),
  })
  .strict();

const confirmedBooks = z
  .object({
    status: z.literal('confirmed'),
    items: z
      .array(
        z
          .object({
            role: z.enum(OUTLINE_BOOK_ROLES),
            title: text(OUTLINE_LIMITS.title),
            authors: optionalText(OUTLINE_LIMITS.authors),
            edition: optionalText(OUTLINE_LIMITS.edition),
            isbn: z
              .string()
              .refine((v) => isbnFromPrinted(v) === v, 'An ISBN-10 or ISBN-13, digits only')
              .nullable(),
          })
          .strict(),
      )
      .min(1)
      .max(OUTLINE_LIMITS.books),
  })
  .strict();

const confirmedPeople = z
  .object({
    status: z.literal('confirmed'),
    items: z
      .array(
        z
          .object({
            name: text(OUTLINE_LIMITS.name),
            role: optionalText(OUTLINE_LIMITS.role),
            /** A work address only (D3). */
            email: z
              .string()
              .trim()
              .max(OUTLINE_LIMITS.email)
              .regex(EMAIL)
              .refine((e) => !isPersonalEmail(e), 'personal-email')
              .nullable(),
            /** An office line only (D3). */
            phone: optionalText(OUTLINE_LIMITS.phone)
              .refine((p) => p === null || !isMobileNumber(p), 'mobile-number')
              .refine((p) => p === null || /^[+\d][\d ()-]{5,}$/.test(p), 'not-a-phone-number'),
            office: optionalText(OUTLINE_LIMITS.office),
            consultationTimes: optionalText(OUTLINE_LIMITS.consultationTimes),
          })
          .strict(),
      )
      .min(1)
      .max(OUTLINE_LIMITS.people),
  })
  .strict();

/**
 * A module outline as the learner confirms it (hard rule 6), section by section: each section is
 * either confirmed (its rows checked, fixed or typed) or "not in my outline". There is no field for
 * a student number, a class list or another student's name, and a lecturer's personal mobile
 * number or email is refused (D3).
 */
export const confirmedModuleOutlineSchema = z
  .object({
    moduleCode: z
      .string()
      .transform((c) => c.trim().replace(/\s+/g, ' ').toUpperCase())
      .pipe(z.string().regex(MODULE_CODE)),
    moduleName: optionalText(OUTLINE_LIMITS.name),
    academicYear: z.int().min(2020).max(2100),
    term: z.enum(MODULE_TERMS).nullable(),
    components: z.discriminatedUnion('status', [NOT_IN_OUTLINE, confirmedComponents]),
    dates: z.discriminatedUnion('status', [NOT_IN_OUTLINE, confirmedDates]),
    books: z.discriminatedUnion('status', [NOT_IN_OUTLINE, confirmedBooks]),
    people: z.discriminatedUnion('status', [NOT_IN_OUTLINE, confirmedPeople]),
    /** The outline the values were read from, when there was one. */
    documentId: z.uuid().nullable().optional(),
  })
  .strict();
export type ConfirmedModuleOutline = z.infer<typeof confirmedModuleOutlineSchema>;

/** The four sections the learner confirms, in order. */
export const OUTLINE_SECTIONS = ['components', 'dates', 'books', 'people'] as const;
export type OutlineSection = (typeof OUTLINE_SECTIONS)[number];
