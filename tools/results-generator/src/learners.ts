import { achievementLevel, nscPass } from '@universityflow/admissions';
import { LIFE_ORIENTATION, type SubjectId, subject } from '@universityflow/catalogue';
import {
  RESULTS_PERIODS,
  SAMPLE_EXAM_NUMBER_ALPHABET,
  SAMPLE_NOTICE,
  type SampleLearner,
  type SampleReport,
  type SampleResultsFile,
} from '@universityflow/documents';
import { pick, type Random, seeded, shuffled } from './random';
import { GIVEN_NAMES, SYNTHETIC_SURNAMES, schoolName } from './strings';

/**
 * Synthetic learners' results for Grades 10, 11 and 12 (planning.md §18.7). Everything follows
 * from the seed, so the committed JSON and the PDFs can be regenerated exactly.
 *
 * Exam numbers are `SAMPLE-` plus six characters (see `isSampleExamNumber` in
 * packages/documents): real NSC exam numbers and SA ID numbers are all digits, so none of these
 * can be one. Surnames are words like "Sample" and "Specimen", schools "Sample Secondary
 * School N". Levels come from `achievementLevel` and passes from `nscPass` (hard rule 2).
 */

export const DEFAULT_SEED = 'universityflow-sample-v1';
export const MIN_SUBJECTS = 7;
export const MAX_SUBJECTS = 12;

/** Home languages a synthetic learner may take; English is then a first additional language. */
const HOME_LANGUAGES = [
  'english',
  'isizulu',
  'isixhosa',
  'sesotho',
  'setswana',
  'sepedi',
  'afrikaans',
] as const;
const ADDITIONAL_WITH_ENGLISH_HOME = ['afrikaans', 'isizulu', 'isixhosa', 'sesotho'] as const;

const ELECTIVES: ReadonlyArray<SubjectId> = [
  'physical-sciences',
  'life-sciences',
  'geography',
  'history',
  'accounting',
  'business-studies',
  'economics',
  'computer-applications-technology',
  'information-technology',
  'engineering-graphics-and-design',
  'tourism',
  'consumer-studies',
  'agricultural-sciences',
  'religion-studies',
  'dramatic-arts',
  'visual-arts',
  'music',
];
/** Electives that schools pair with Mathematics rather than Mathematical Literacy. */
const NEEDS_MATHEMATICS: ReadonlyArray<SubjectId> = [
  'physical-sciences',
  'information-technology',
  'engineering-graphics-and-design',
];

export interface LearnerOptions {
  readonly seed: string;
  /** 7 to 12: the NSC's seven, plus up to five extra subjects. */
  readonly subjectCount: number;
  /** The calendar year of Grade 10. Grade 12 is two years later. */
  readonly firstYear?: number;
}

function examNumber(random: Random): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += pick(random, [...SAMPLE_EXAM_NUMBER_ALPHABET]);
  return `SAMPLE-${code}`;
}

function chooseSubjects(random: Random, count: number): SubjectId[] {
  const home = pick(random, HOME_LANGUAGES);
  const additional = home === 'english' ? pick(random, ADDITIONAL_WITH_ENGLISH_HOME) : 'english';
  const maths: SubjectId = random() < 0.7 ? 'mathematics' : 'mathematical-literacy';
  const pool = ELECTIVES.filter((id) => maths === 'mathematics' || !NEEDS_MATHEMATICS.includes(id));
  const electives = shuffled(random, pool).slice(0, count - 4);
  return [
    `${home}-hl` as SubjectId,
    `${additional}-fal` as SubjectId,
    maths,
    ...electives,
    LIFE_ORIENTATION,
  ];
}

function clampPercent(value: number): number {
  return Math.min(98, Math.max(3, Math.round(value)));
}

export function generateLearner(options: LearnerOptions): SampleLearner {
  const { seed, subjectCount, firstYear = 2024 } = options;
  if (
    !Number.isInteger(subjectCount) ||
    subjectCount < MIN_SUBJECTS ||
    subjectCount > MAX_SUBJECTS
  ) {
    throw new RangeError(
      `A learner takes ${MIN_SUBJECTS} to ${MAX_SUBJECTS} subjects, not ${subjectCount}`,
    );
  }
  const random = seeded(seed);
  const number = examNumber(random);
  const displayName = `${pick(random, GIVEN_NAMES)} ${pick(random, SYNTHETIC_SURNAMES)}`;
  const school = schoolName(1 + Math.floor(random() * 9));

  const ability = 30 + random() * 58;
  const subjects = chooseSubjects(random, subjectCount).map((id) => ({
    id,
    offset: (random() - 0.5) * 24 + (id === LIFE_ORIENTATION ? 10 : 0),
    trend: (random() - 0.4) * 2.5,
  }));

  const reports = RESULTS_PERIODS.map((period, step): SampleReport => {
    const marks = subjects.map(({ id, offset, trend }) => {
      const percent = clampPercent(ability + offset + trend * step + (random() - 0.5) * 8);
      return {
        subject: id,
        nameAsPrinted: subject(id).name,
        percent,
        level: achievementLevel(percent),
      };
    });
    return {
      period,
      // RESULTS_PERIODS runs June, September, final for each grade: three reports a year.
      academicYear: firstYear + Math.floor(step / 3),
      subjects: marks,
      pass: nscPass(marks.map((m) => ({ subject: m.subject, percent: m.percent }))),
    };
  });

  return { examNumber: number, displayName, school, reports };
}

export interface CohortOptions {
  readonly seed?: string;
  readonly count?: number;
  readonly firstYear?: number;
}

/** Subject counts the default cohort cycles through: seven, and the longer statements. */
const COHORT_SUBJECT_COUNTS = [7, 9, 11, 8, 10, 12, 7, 7] as const;

export function generateCohort(options: CohortOptions = {}): SampleResultsFile {
  const { seed = DEFAULT_SEED, count = 8, firstYear = 2024 } = options;
  const learners: SampleLearner[] = [];
  const taken = new Set<string>();
  for (let i = 0; learners.length < count; i++) {
    const learner = generateLearner({
      seed: `${seed}:${i}`,
      subjectCount: COHORT_SUBJECT_COUNTS[learners.length % COHORT_SUBJECT_COUNTS.length] as number,
      firstYear,
    });
    if (taken.has(learner.examNumber)) continue;
    taken.add(learner.examNumber);
    learners.push(learner);
  }
  return {
    format: 'universityflow-sample-results',
    version: 1,
    sample: true,
    notice: SAMPLE_NOTICE,
    seed,
    learners,
  };
}
