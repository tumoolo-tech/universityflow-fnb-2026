import {
  isSubjectId,
  type LanguageId,
  printedReportKind,
  type ReportKind,
  type SubjectId,
  subjectId,
} from '@universityflow/catalogue';
import { z } from 'zod';

/**
 * Reading a school report (Stage 1).
 *
 * The reader returns what it saw, as printed: subject names in the school's own words and the
 * percentages next to them. It never sees or returns the learner's name, ID number or school
 * (data minimisation, planning.md §8.1). Turning "Maths" or "Eng FAL" into an NSC subject is
 * done here, in tested code, and the result is a *draft* the learner confirms row by row before
 * any calculation uses it (hard rule 6).
 */

export const extractedReportSchema = z.object({
  /** False when the image isn't a school report at all. */
  isSchoolReport: z.boolean(),
  /** The grade the report is for, when printed. */
  grade: z.number().nullable(),
  /** Which report: the final one, June, September, or unclear. */
  term: z.enum(['final', 'june', 'september', 'other']).nullable(),
  subjects: z.array(
    z.object({
      nameAsPrinted: z.string(),
      /** The percentage printed for the subject, or null when it can't be read. */
      percent: z.number().nullable(),
    }),
  ),
  /** True when parts were too blurred or cut off to read. */
  partlyUnreadable: z.boolean(),
});
export type ExtractedReport = z.infer<typeof extractedReportSchema>;

// ── Subject names as schools print them ─────────────────────────────────────────────────────

const LANGUAGE_NAMES: ReadonlyArray<readonly [LanguageId, ReadonlyArray<string>]> = [
  ['english', ['english', 'engels', 'eng']],
  ['afrikaans', ['afrikaans', 'afr']],
  ['isizulu', ['isizulu', 'zulu']],
  ['isixhosa', ['isixhosa', 'xhosa']],
  ['isindebele', ['isindebele', 'ndebele']],
  ['sepedi', ['sepedi', 'northern sotho', 'sesotho sa leboa', 'pedi']],
  ['sesotho', ['sesotho', 'southern sotho', 'sotho']],
  ['setswana', ['setswana', 'tswana']],
  ['siswati', ['siswati', 'swati']],
  ['tshivenda', ['tshivenda', 'venda']],
  ['xitsonga', ['xitsonga', 'tsonga']],
];

const HOME = ['home language', 'hl', 'huistaal', 'ht', 'first language'];
const FIRST_ADDITIONAL = [
  'first additional language',
  'fal',
  'first add lang',
  'eerste addisionele taal',
  'eat',
  'second language',
  'additional language',
];

const OTHER_NAMES: ReadonlyArray<readonly [SubjectId, ReadonlyArray<string>]> = [
  [
    'mathematical-literacy',
    [
      'mathematical literacy',
      'maths literacy',
      'math literacy',
      'maths lit',
      'math lit',
      'ml',
      'wiskundige geletterdheid',
    ],
  ],
  [
    'technical-mathematics',
    ['technical mathematics', 'technical maths', 'tech maths', 'tegniese wiskunde'],
  ],
  ['mathematics', ['mathematics', 'maths', 'math', 'wiskunde', 'mathematics core']],
  ['technical-sciences', ['technical sciences', 'technical science', 'tegniese wetenskappe']],
  [
    'physical-sciences',
    [
      'physical sciences',
      'physical science',
      'physics',
      'physical sc',
      'fisiese wetenskappe',
      'natuur en skeikunde',
    ],
  ],
  ['life-sciences', ['life sciences', 'life science', 'biology', 'lewenswetenskappe']],
  [
    'agricultural-sciences',
    ['agricultural sciences', 'agricultural science', 'agriculture', 'landbouwetenskappe'],
  ],
  ['life-orientation', ['life orientation', 'lo', 'lewensorientering']],
  ['accounting', ['accounting', 'rekeningkunde']],
  ['business-studies', ['business studies', 'business', 'besigheidstudies']],
  ['economics', ['economics', 'ekonomie']],
  ['geography', ['geography', 'geografie']],
  ['history', ['history', 'geskiedenis']],
  ['religion-studies', ['religion studies', 'religious studies']],
  [
    'computer-applications-technology',
    ['computer applications technology', 'cat', 'rekenaartoepassingstegnologie'],
  ],
  ['information-technology', ['information technology', 'it', 'inligtingstegnologie']],
  [
    'engineering-graphics-and-design',
    [
      'engineering graphics and design',
      'engineering graphics & design',
      'egd',
      'ingenieursgrafika en ontwerp',
    ],
  ],
  ['civil-technology', ['civil technology']],
  ['electrical-technology', ['electrical technology']],
  ['mechanical-technology', ['mechanical technology']],
  ['tourism', ['tourism', 'toerisme']],
  ['consumer-studies', ['consumer studies', 'verbruikerstudies']],
  ['hospitality-studies', ['hospitality studies', 'hospitality']],
  ['dramatic-arts', ['dramatic arts', 'drama']],
  ['visual-arts', ['visual arts', 'art']],
  ['music', ['music', 'musiek']],
  ['dance-studies', ['dance studies', 'dance']],
  ['design', ['design', 'ontwerp']],
];

/** Lower case, accents and punctuation gone, spaces collapsed. */
export function normaliseName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9& ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const containsPhrase = (haystack: string, phrase: string) =>
  ` ${haystack} `.includes(` ${phrase} `);

/**
 * The NSC subject a printed name stands for, or null when it isn't clear. A language with no
 * level ("English") is null on purpose: Home and First Additional Language are different
 * subjects with different requirements, and only the learner knows which they take.
 */
export function resolveSubject(nameAsPrinted: string): SubjectId | null {
  const name = normaliseName(nameAsPrinted);
  if (!name) return null;

  for (const [language, names] of LANGUAGE_NAMES) {
    if (!names.some((n) => containsPhrase(name, n))) continue;
    const rest = names.reduce((acc, n) => ` ${acc} `.replace(` ${n} `, ' ').trim(), name);
    const home = HOME.some((h) => containsPhrase(rest, h));
    const additional = FIRST_ADDITIONAL.some((f) => containsPhrase(rest, f));
    if (home === additional) return null;
    const id = `${language}-${home ? 'hl' : 'fal'}`;
    return isSubjectId(id) ? id : null;
  }

  for (const [id, names] of OTHER_NAMES) {
    if (names.some((n) => name === n || containsPhrase(name, n))) return id;
  }
  return null;
}

// ── The draft a learner confirms ────────────────────────────────────────────────────────────

export type DraftIssue = 'unknown-subject' | 'missing-percent' | 'out-of-range' | 'duplicate';

export interface DraftRow {
  readonly nameAsPrinted: string;
  readonly subject: SubjectId | null;
  readonly percent: number | null;
  readonly issue: DraftIssue | null;
}

export interface ReportDraft {
  readonly rows: ReadonlyArray<DraftRow>;
  /** Things to tell the learner before they confirm. */
  readonly warnings: ReadonlyArray<
    'not-a-report' | 'partly-unreadable' | 'not-grade-11' | 'few-subjects'
  >;
  /**
   * The report the document prints, when its grade and term settle it (A1-35): the form starts on
   * it, and the learner confirms it like every other value (hard rule 6). Absent on drafts saved
   * before it existed.
   */
  readonly printedKind?: ReportKind | null;
}

export function draftFromExtraction(extracted: ExtractedReport): ReportDraft {
  const seen = new Set<SubjectId>();
  const rows = extracted.subjects.map((s): DraftRow => {
    const subject = resolveSubject(s.nameAsPrinted);
    const percent = s.percent === null ? null : Math.round(s.percent);
    let issue: DraftIssue | null = null;
    if (subject === null) issue = 'unknown-subject';
    else if (seen.has(subject)) issue = 'duplicate';
    else if (percent === null) issue = 'missing-percent';
    else if (percent < 0 || percent > 100) issue = 'out-of-range';
    if (subject) seen.add(subject);
    return { nameAsPrinted: s.nameAsPrinted.trim(), subject, percent, issue };
  });
  const warnings: Array<ReportDraft['warnings'][number]> = [];
  if (!extracted.isSchoolReport) warnings.push('not-a-report');
  if (extracted.partlyUnreadable) warnings.push('partly-unreadable');
  if (extracted.grade !== null && extracted.grade !== 11) warnings.push('not-grade-11');
  if (rows.length < 6) warnings.push('few-subjects');
  return { rows, warnings, printedKind: printedReportKind(extracted) };
}

/** What the learner submits after checking every row (hard rule 6). */
export const confirmedMarksSchema = z
  .array(z.object({ subject: subjectId, percent: z.int().min(0).max(100) }))
  .min(1)
  .max(12)
  .refine((marks) => new Set(marks.map((m) => m.subject)).size === marks.length, {
    message: 'Each subject once',
  });
export type ConfirmedMarks = z.infer<typeof confirmedMarksSchema>;
