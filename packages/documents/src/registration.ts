import { MODULE_TERMS, type ModuleTerm } from '@universityflow/catalogue';
import { z } from 'zod';
import { cleanCondition } from './letter';

/**
 * Reading a proof of registration (planning.md §11, Phase 5c).
 *
 * The reader returns what the proof says about the learner's **studies**, as printed: the
 * programme code, the year of study, and each module's code, name, semester or term, and credits.
 * It never returns the learner's student number, ID number, name, address or fees: the schema has
 * no place for them, and the instructions forbid them (data minimisation, planning.md §8.1, D4).
 *
 * The result is a *draft* the learner confirms row by row, adding, removing or fixing modules,
 * before anything compares it with a curriculum (hard rule 6). Turning "Semester 1" or "1st sem"
 * into a term is done here, in tested code, never by the AI; a term it can't place is left for the
 * learner to choose.
 */

export const extractedRegistrationSchema = z.object({
  /** False when the document isn't a university proof of registration. */
  isProofOfRegistration: z.boolean(),
  /** The programme or qualification code as printed, or null when none is printed. */
  programmeCodeAsPrinted: z.string().nullable(),
  /** The year of study as printed (1 for a first-year), or null. */
  yearOfStudy: z.number().nullable(),
  /** One row per registered module, in the document's order. */
  modules: z.array(
    z.object({
      /** The module code exactly as printed, e.g. "COMS1018A" or "WTW 114". */
      code: z.string(),
      /** The module's name as printed, or null when none is printed. */
      name: z.string().nullable(),
      /** The semester, term or period exactly as printed (e.g. "S1", "Semester 2", "Year"). */
      termAsPrinted: z.string().nullable(),
      /** The credits printed for it, or null. */
      credits: z.number().nullable(),
    }),
  ),
  /** True when parts were too blurred or cut off to read. */
  partlyUnreadable: z.boolean(),
});
export type ExtractedRegistration = z.infer<typeof extractedRegistrationSchema>;

/** At most this many modules are kept: a first-year registers for far fewer. */
export const MAX_MODULES = 40;
const MAX_CODE_LENGTH = 24;
const MAX_MODULE_NAME_LENGTH = 160;
const MAX_PROGRAMME_CODE_LENGTH = 40;

/**
 * A module code as printed, e.g. "COMS1018A", "WTW 114" or "ECO1010F/S". The same pattern as the
 * catalogue's curriculum codes (packages/catalogue `curriculumModuleSchema`), so anything the
 * learner confirms can be compared with a curriculum.
 */
export const MODULE_CODE = /^[A-Za-z0-9][A-Za-z0-9 \-/.]{1,23}$/;

/** Ways a semester, year or quarter is printed, after `termKey`. */
const TERM_WORDS: ReadonlyArray<readonly [ModuleTerm, ReadonlyArray<string>]> = [
  [
    'S1',
    [
      's1',
      'sem1',
      'semester1',
      'firstsemester',
      '1stsemester',
      '1stsem',
      'semesterone',
      'semester1st',
    ],
  ],
  [
    'S2',
    [
      's2',
      'sem2',
      'semester2',
      'secondsemester',
      '2ndsemester',
      '2ndsem',
      'semestertwo',
      'semester2nd',
    ],
  ],
  ['Y', ['y', 'year', 'fullyear', 'yearlong', 'yearmodule', 'wholeyear', 'annual']],
  ['Q1', ['q1', 'quarter1', 'firstquarter', '1stquarter']],
  ['Q2', ['q2', 'quarter2', 'secondquarter', '2ndquarter']],
  ['Q3', ['q3', 'quarter3', 'thirdquarter', '3rdquarter']],
  ['Q4', ['q4', 'quarter4', 'fourthquarter', '4thquarter']],
];

const termKey = (printed: string) => printed.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * The term a proof prints, as a `ModuleTerm`, or null when it isn't one we can place for certain
 * (e.g. "Block 2" or "Term 1": the learner chooses). Never a guess.
 */
export function termFromPrinted(printed: string | null): ModuleTerm | null {
  if (printed === null) return null;
  const key = termKey(printed);
  if (key === '') return null;
  return TERM_WORDS.find(([, words]) => words.includes(key))?.[0] ?? null;
}

export type RegistrationWarning =
  | 'not-a-proof'
  | 'partly-unreadable'
  | 'no-modules'
  | 'modules-cut'
  | 'term-unclear'
  | 'code-unclear';

/** One module row the learner checks, fixes or removes (hard rule 6). */
export interface DraftModule {
  readonly code: string;
  readonly name: string | null;
  /** Null when the proof prints none, or one we couldn't place: the learner chooses. */
  readonly term: ModuleTerm | null;
  /** As printed, so the learner can see what the proof said. */
  readonly termAsPrinted: string | null;
  readonly credits: number | null;
}

/** What the learner checks, row by row, before the registration is saved (hard rule 6). */
export interface RegistrationDraft {
  readonly programmeCode: string | null;
  readonly yearOfStudy: number | null;
  readonly modules: ReadonlyArray<DraftModule>;
  readonly warnings: ReadonlyArray<RegistrationWarning>;
}

const oneLine = (text: string | null, max: number): string | null => {
  const cleaned = text === null ? '' : cleanCondition(text);
  return cleaned === '' ? null : cleaned.slice(0, max);
};

const isCredits = (value: number | null): value is number =>
  value !== null && Number.isFinite(value) && value >= 0 && value <= 240;

export function draftFromRegistration(extracted: ExtractedRegistration): RegistrationDraft {
  const warnings = new Set<RegistrationWarning>();
  if (!extracted.isProofOfRegistration) warnings.add('not-a-proof');
  if (extracted.partlyUnreadable) warnings.add('partly-unreadable');

  const rows: DraftModule[] = [];
  for (const m of extracted.modules) {
    const code = oneLine(m.code, MAX_CODE_LENGTH);
    if (code === null) continue;
    if (!MODULE_CODE.test(code)) warnings.add('code-unclear');
    const termAsPrinted = oneLine(m.termAsPrinted, 40);
    const term = termFromPrinted(termAsPrinted);
    if (termAsPrinted !== null && term === null) warnings.add('term-unclear');
    rows.push({
      code,
      name: oneLine(m.name, MAX_MODULE_NAME_LENGTH),
      term,
      termAsPrinted,
      credits: isCredits(m.credits) ? m.credits : null,
    });
  }
  if (rows.length === 0) warnings.add('no-modules');
  if (rows.length > MAX_MODULES) warnings.add('modules-cut');

  const year = extracted.yearOfStudy;
  return {
    programmeCode: oneLine(extracted.programmeCodeAsPrinted, MAX_PROGRAMME_CODE_LENGTH),
    yearOfStudy: year !== null && Number.isInteger(year) && year >= 1 && year <= 10 ? year : null,
    modules: rows.slice(0, MAX_MODULES),
    warnings: [...warnings],
  };
}

const PROGRAMME_ID = /^(?=.{3,80}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const confirmedModuleSchema = z
  .object({
    code: z.string().trim().regex(MODULE_CODE),
    name: z
      .string()
      .transform(cleanCondition)
      .pipe(z.string().max(MAX_MODULE_NAME_LENGTH))
      .transform((name) => (name === '' ? null : name))
      .nullable(),
    /** Null when the learner doesn't know: the comparison then doesn't check its semester. */
    term: z.enum(MODULE_TERMS).nullable(),
    credits: z.number().min(0).max(240).nullable(),
  })
  .strict();
export type ConfirmedModule = z.infer<typeof confirmedModuleSchema>;

/**
 * A registration as the learner confirms it (hard rule 6): the programme (a catalogue id: from
 * their accepted offer, or chosen from the catalogue), the academic year, and every module row
 * they checked. There is no field for a student number, ID number, name, address or fees (D4).
 */
export const confirmedRegistrationSchema = z
  .object({
    programmeId: z.string().regex(PROGRAMME_ID),
    academicYear: z.int().min(2020).max(2100),
    yearOfStudy: z.int().min(1).max(10).nullable(),
    modules: z.array(confirmedModuleSchema).min(1).max(MAX_MODULES),
    /** The proof the rows were read from, when there was one. */
    documentId: z.uuid().nullable().optional(),
  })
  .strict();
export type ConfirmedRegistration = z.infer<typeof confirmedRegistrationSchema>;
