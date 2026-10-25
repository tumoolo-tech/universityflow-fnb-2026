import type { AchievementLevel, PassOutcome } from '@universityflow/admissions';
import { SAMPLE_NOTICE, SAMPLE_PDF_PRODUCER } from '@universityflow/documents';

/**
 * Every word printed on a generated statement, in one place.
 *
 * These are not app UI: they appear only on the sample PDFs this tool writes (for tests, the
 * report reader and demos), so they live here rather than in `packages/content` (hard rule 8
 * covers what the apps show). If an app ever shows one of these, it moves to `packages/content`.
 *
 * No admission fact lives here (hard rule 2): the percentage bands in the key come from
 * `LEVEL_FLOOR` and the pass from `nscPass`, both in `packages/admissions`. The level words are
 * the DBE's descriptors; check them against the DBE's current publication before a release
 * (planning.md §18.7, gotcha 40).
 *
 * Nothing here names an issuer, a certificate number, a seal or a signature: a generator of
 * convincing certificates would be a forgery tool (§18.7).
 */

export { SAMPLE_NOTICE };

export const STATEMENT = {
  title: 'Results statement (sample)',
  /** Printed huge and pale across the page, behind everything. */
  watermark: 'SAMPLE',
  footer: `${SAMPLE_NOTICE}. A synthetic learner made by UniversityFlow's results generator, for testing and demos.`,
  header: {
    learner: 'Learner',
    examNumber: 'Exam number',
    school: 'School',
    year: 'Year',
    report: 'Report',
  },
  table: {
    subject: 'Subject',
    percent: '%',
    level: 'Achievement level',
  },
  passHeading: 'Pass statement',
  /** Under a June, September or Grade 10/11 report's pass line. */
  projectionNote:
    'A projection from these marks: the pass is awarded on the final Grade 12 results.',
  keyHeading: 'Key to achievement levels',
  /** Judge demo mode accepts only PDFs with this producer (packages/documents sample-pdf.ts). */
  producer: SAMPLE_PDF_PRODUCER,
} as const;

/**
 * Every word printed on a generated SAMPLE module outline (Phase 6b) beyond the outline's own
 * values (packages/documents `sampleModuleOutline`). Made up, and says so.
 */
export const OUTLINE = {
  title: 'Module outline (sample)',
  watermark: 'SAMPLE',
  footer: `${SAMPLE_NOTICE}. A made-up module outline by UniversityFlow's results generator, for testing and demos. No real module, lecturer or student.`,
  yearAndTerm: (year: number, term: string) => `Academic year ${year} · ${term}`,
  assessment: 'Assessment',
  component: 'Component',
  weight: 'Weight',
  subminimum: 'Subminimum',
  dp: (percent: string, quote: string) => `Exam admission (DP): ${percent}. ${quote}`,
  examSubminimum: (percent: string) => `Exam subminimum: ${percent}.`,
  dates: 'Important dates',
  books: 'Books',
  book: (
    prescribed: boolean,
    title: string,
    authors: string | null,
    edition: string | null,
    isbn: string | null,
  ) =>
    [
      prescribed ? 'Prescribed:' : 'Recommended:',
      title,
      authors ? `by ${authors}` : null,
      edition ? `(${edition} edition)` : null,
      isbn ? `ISBN ${isbn}` : null,
    ]
      .filter((part) => part !== null)
      .join(' '),
  people: 'Lecturer',
  contact: (email: string, office: string, times: string) =>
    `Email: ${email} · Office: ${office} · Consultation: ${times}`,
  /** A real outline sometimes prints one; the reader's schema has no place for it. */
  classList: 'Tutorial group A (class list)',
  classListNames: [
    'Sample Student 1 (made-up)',
    'Sample Student 2 (made-up)',
    'Sample Student 3 (made-up)',
    'Sample Student 4 (made-up)',
  ],
  producer: SAMPLE_PDF_PRODUCER,
} as const;

export const TERM_NAMES = {
  june: 'June',
  september: 'September',
  final: 'final',
} as const;

/** "Grade 11, June". */
export function reportLabel(grade: 10 | 11 | 12, term: keyof typeof TERM_NAMES): string {
  return `Grade ${grade}, ${TERM_NAMES[term]}`;
}

/** The pass line on a final Grade 12 statement. */
export const PASS_FINAL: Readonly<Record<PassOutcome, string>> = {
  bachelor: "Passed with admission to Bachelor's degree studies",
  diploma: 'Passed with admission to Diploma studies',
  'higher-certificate': 'Passed with admission to Higher Certificate studies',
  nsc: 'Passed: National Senior Certificate',
  none: 'Not yet passed',
};

/** The pass line on any earlier report: what these marks would give. */
export const PASS_PROJECTED: Readonly<Record<PassOutcome, string>> = {
  bachelor: "On these marks: admission to Bachelor's degree studies",
  diploma: 'On these marks: admission to Diploma studies',
  'higher-certificate': 'On these marks: admission to Higher Certificate studies',
  nsc: 'On these marks: a National Senior Certificate pass',
  none: 'On these marks: not yet a pass',
};

/** The DBE's words for each level (verify before release, gotcha 40). */
export const LEVEL_WORDS: Readonly<Record<AchievementLevel, string>> = {
  7: 'Outstanding achievement',
  6: 'Meritorious achievement',
  5: 'Substantial achievement',
  4: 'Adequate achievement',
  3: 'Moderate achievement',
  2: 'Elementary achievement',
  1: 'Not achieved',
};

// ── Synthetic people and places ───────────────────────────────────────────────────────────

/** First names, chosen at random from a seed. The surname is what makes a learner synthetic. */
export const GIVEN_NAMES = [
  'Ayanda',
  'Lerato',
  'Thabo',
  'Naledi',
  'Sipho',
  'Zanele',
  'Kagiso',
  'Palesa',
  'Lwazi',
  'Refilwe',
  'Musa',
  'Nomsa',
  'Tshepo',
  'Amahle',
  'Jaco',
  'Aisha',
  'Priya',
  'Kyle',
] as const;

/** Every learner's surname is one of these, so no one can mistake a sample for a person. */
export const SYNTHETIC_SURNAMES = [
  'Sample',
  'Example',
  'Specimen',
  'Testcase',
  'Placeholder',
] as const;

/** "Sample Secondary School 3": no real school has this name. */
export function schoolName(n: number): string {
  return `Sample Secondary School ${n}`;
}
