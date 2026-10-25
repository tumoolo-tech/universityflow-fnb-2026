import { readFile } from 'node:fs/promises';
import { type SubjectId, subjectId } from '@universityflow/catalogue';
import { z } from 'zod';

/**
 * Where a learner's results come from, behind an interface (planning.md §18.7, D8), so the
 * school record's screens don't change when an official source arrives.
 *
 * - `FakeResultsSource`: reads the JSON that `tools/results-generator` writes. Synthetic
 *   learners only: the file must say it is a sample, and every exam number must be in the
 *   sample shape below, which no real exam number or ID number has.
 * - Later (C4, after an agreement and gate H2): the DBE's, IEB's or SACAI's final NSC results.
 *
 * A source returns marks and where they came from, never who the learner is (hard rule 4).
 * Achievement levels and the pass are worked out from the marks by `packages/admissions`
 * (hard rule 2), not taken from a source. The learner's own confirmed reports stay the main
 * path; this interface is for the fake (tests, E2E, the preview, demos) and, later, the
 * official final results.
 */

/** Every report a school record can hold, in the order the school years run. */
export const RESULTS_PERIODS = [
  'grade-10-june',
  'grade-10-september',
  'grade-10-final',
  'grade-11-june',
  'grade-11-september',
  'grade-11-final',
  'grade-12-june',
  'grade-12-september',
  'grade-12-final',
] as const;
export type ResultsPeriod = (typeof RESULTS_PERIODS)[number];

/** Who issued a set of results. Only `sample` exists today; the rest wait on C4. */
export const RESULTS_ISSUERS = ['sample', 'dbe', 'ieb', 'sacai'] as const;
export type ResultsIssuer = (typeof RESULTS_ISSUERS)[number];

/** The words on every generated page and in every sample file. */
export const SAMPLE_NOTICE = 'SAMPLE: not an official document';

/**
 * A sample exam number: `SAMPLE-` and six characters from an alphabet with no 0, O, 1 or I.
 * Real NSC exam numbers and SA ID numbers are all digits, so nothing in this shape can be
 * mistaken for one, or be one.
 */
const SAMPLE_EXAM_NUMBER = /^SAMPLE-[A-HJ-NP-Z2-9]{6}$/;
export const SAMPLE_EXAM_NUMBER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function isSampleExamNumber(value: string): boolean {
  return SAMPLE_EXAM_NUMBER.test(value);
}

export class InvalidExamNumberError extends Error {
  override readonly name = 'InvalidExamNumberError';
}

export class InvalidResultsFileError extends Error {
  override readonly name = 'InvalidResultsFileError';
}

export interface SourcedSubject {
  readonly subject: SubjectId;
  /** The subject's name as the statement prints it. */
  readonly nameAsPrinted: string;
  readonly percent: number;
}

export interface SourcedReport {
  readonly period: ResultsPeriod;
  readonly academicYear: number;
  readonly subjects: ReadonlyArray<SourcedSubject>;
}

export interface SourcedResults {
  readonly examNumber: string;
  readonly issuer: ResultsIssuer;
  /** In the order the school years run, each period at most once. */
  readonly reports: ReadonlyArray<SourcedReport>;
}

export interface ResultsSource {
  readonly issuer: ResultsIssuer;
  /** True for the fake, so the interface can say the results are a sample. */
  readonly isSample: boolean;
  /**
   * The results the source holds for one exam number, or null when it holds none. Throws
   * `InvalidExamNumberError` for a number not in the source's own shape.
   */
  find(examNumber: string): Promise<SourcedResults | null>;
}

// ── The generator's file ──────────────────────────────────────────────────────────────────

const sampleSubjectSchema = z.object({
  subject: subjectId,
  nameAsPrinted: z.string().trim().min(1).max(80),
  percent: z.int().min(0).max(100),
  /** As printed on the statement; the generator takes it from `packages/admissions`. */
  level: z.int().min(1).max(7),
});

const sampleReportSchema = z.object({
  period: z.enum(RESULTS_PERIODS),
  academicYear: z.int().min(2000).max(2100),
  subjects: z
    .array(sampleSubjectSchema)
    .min(1)
    .max(12)
    .refine((s) => new Set(s.map((x) => x.subject)).size === s.length, 'Each subject once'),
  /** As printed on the statement; the generator takes it from `nscPass`. */
  pass: z.enum(['none', 'nsc', 'higher-certificate', 'diploma', 'bachelor']),
});

const sampleLearnerSchema = z.object({
  examNumber: z.string().regex(SAMPLE_EXAM_NUMBER),
  /** Synthetic, for the statement's header only: `find` never returns it. */
  displayName: z.string().trim().min(1).max(80),
  school: z.string().trim().min(1).max(80),
  reports: z
    .array(sampleReportSchema)
    .min(1)
    .refine((reports) => {
      const order = reports.map((r) => RESULTS_PERIODS.indexOf(r.period));
      return order.every((index, i) => i === 0 || index > (order[i - 1] as number));
    }, 'Each report once, in school-year order'),
});

export const sampleResultsFileSchema = z.object({
  format: z.literal('universityflow-sample-results'),
  version: z.literal(1),
  sample: z.literal(true),
  notice: z.literal(SAMPLE_NOTICE),
  seed: z.string().min(1),
  learners: z
    .array(sampleLearnerSchema)
    .refine(
      (learners) => new Set(learners.map((l) => l.examNumber)).size === learners.length,
      'Each exam number once',
    ),
});
export type SampleResultsFile = z.infer<typeof sampleResultsFileSchema>;
export type SampleLearner = SampleResultsFile['learners'][number];
export type SampleReport = SampleLearner['reports'][number];

/** The fake source: synthetic learners from `tools/results-generator`'s JSON. */
export class FakeResultsSource implements ResultsSource {
  readonly issuer = 'sample' as const;
  readonly isSample = true;
  readonly #learners: ReadonlyMap<string, SampleLearner>;

  /** Refuses anything that isn't a valid sample file; the error never echoes the file. */
  constructor(data: unknown) {
    const parsed = sampleResultsFileSchema.safeParse(data);
    if (!parsed.success) {
      const paths = parsed.error.issues.map((i) => i.path.join('.') || '(file)');
      throw new InvalidResultsFileError(
        `Not a valid sample results file (at ${[...new Set(paths)].slice(0, 5).join(', ')})`,
      );
    }
    this.#learners = new Map(parsed.data.learners.map((l) => [l.examNumber, l]));
  }

  static async fromFile(path: string): Promise<FakeResultsSource> {
    let data: unknown;
    try {
      data = JSON.parse(await readFile(path, 'utf8'));
    } catch {
      throw new InvalidResultsFileError('The sample results file could not be read as JSON');
    }
    return new FakeResultsSource(data);
  }

  /** The sample exam numbers this file holds, in file order. */
  get examNumbers(): ReadonlyArray<string> {
    return [...this.#learners.keys()];
  }

  async find(examNumber: string): Promise<SourcedResults | null> {
    if (!isSampleExamNumber(examNumber)) {
      throw new InvalidExamNumberError('Not a sample exam number');
    }
    const learner = this.#learners.get(examNumber);
    if (!learner) return null;
    return {
      examNumber: learner.examNumber,
      issuer: this.issuer,
      reports: learner.reports.map((r) => ({
        period: r.period,
        academicYear: r.academicYear,
        subjects: r.subjects.map((s) => ({
          subject: s.subject,
          nameAsPrinted: s.nameAsPrinted,
          percent: s.percent,
        })),
      })),
    };
  }
}
