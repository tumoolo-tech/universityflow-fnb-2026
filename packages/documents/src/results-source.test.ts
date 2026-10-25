import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  FakeResultsSource,
  InvalidResultsFileError,
  isSampleExamNumber,
  RESULTS_PERIODS,
  SAMPLE_NOTICE,
  type SampleResultsFile,
} from './results-source';
import { resultsSourceContract } from './results-source.contract';

/** The generator's committed output (tools/results-generator, `pnpm … generate`). */
const FIXTURE = fileURLToPath(new URL('../fixtures/sample-results.json', import.meta.url));

/** A tiny synthetic file in the generator's shape, so these tests don't depend on its output. */
function file(overrides: Partial<SampleResultsFile> = {}): SampleResultsFile {
  return {
    format: 'universityflow-sample-results',
    version: 1,
    sample: true,
    notice: SAMPLE_NOTICE,
    seed: 'test-seed',
    learners: [
      {
        examNumber: 'SAMPLE-AB2CD3',
        displayName: 'Ayanda Sample',
        school: 'Sample Secondary School 1',
        reports: [
          {
            period: 'grade-10-june',
            academicYear: 2024,
            subjects: [
              {
                subject: 'english-hl',
                nameAsPrinted: 'English Home Language',
                percent: 64,
                level: 5,
              },
              { subject: 'mathematics', nameAsPrinted: 'Mathematics', percent: 48, level: 3 },
            ],
            pass: 'none',
          },
          {
            period: 'grade-11-final',
            academicYear: 2025,
            subjects: [
              {
                subject: 'english-hl',
                nameAsPrinted: 'English Home Language',
                percent: 70,
                level: 6,
              },
              { subject: 'mathematics', nameAsPrinted: 'Mathematics', percent: 52, level: 4 },
            ],
            pass: 'none',
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('FakeResultsSource, from a file in the generator’s shape', () => {
  resultsSourceContract(async () => ({
    source: new FakeResultsSource(file()),
    known: 'SAMPLE-AB2CD3',
    unknown: 'SAMPLE-ZZ9ZZ9',
  }));
});

describe('FakeResultsSource, from the generator’s committed output', () => {
  resultsSourceContract(async () => {
    const source = await FakeResultsSource.fromFile(FIXTURE);
    const [known] = source.examNumbers;
    return { source, known: known as string, unknown: 'SAMPLE-ZZ9ZZ9' };
  });

  it('holds every report from Grade 10 June to the final NSC for each learner', async () => {
    const source = await FakeResultsSource.fromFile(FIXTURE);
    expect(source.examNumbers.length).toBeGreaterThan(0);
    for (const examNumber of source.examNumbers) {
      const results = await source.find(examNumber);
      expect(results?.reports.map((r) => r.period)).toEqual([...RESULTS_PERIODS]);
    }
  });
});

describe('FakeResultsSource refuses anything but a sample file', () => {
  const refuse = (data: unknown) => () => new FakeResultsSource(data);

  it('refuses a file not marked as a sample', () => {
    expect(refuse({ ...file(), sample: false })).toThrow(InvalidResultsFileError);
  });

  it('refuses a file without the sample notice', () => {
    expect(refuse({ ...file(), notice: 'Statement of results' })).toThrow(InvalidResultsFileError);
  });

  it('refuses a learner whose exam number is not in the sample shape', () => {
    const data = file();
    const learner = data.learners[0];
    if (!learner) throw new Error('fixture');
    const realLooking = `${'1234567'}${'890123'}`;
    expect(refuse({ ...data, learners: [{ ...learner, examNumber: realLooking }] })).toThrow(
      InvalidResultsFileError,
    );
  });

  it('refuses the same exam number twice, and the same report twice', () => {
    const data = file();
    const learner = data.learners[0];
    if (!learner) throw new Error('fixture');
    expect(refuse({ ...data, learners: [learner, learner] })).toThrow(InvalidResultsFileError);
    const twice = { ...learner, reports: [learner.reports[0], learner.reports[0]] };
    expect(refuse({ ...data, learners: [twice] })).toThrow(InvalidResultsFileError);
  });

  it.each([101, -1, 55.5])('refuses a percentage of %d', (percent) => {
    const data = structuredClone(file()) as {
      learners: Array<{ reports: Array<{ subjects: Array<{ percent: number }> }> }>;
    };
    const subject = data.learners[0]?.reports[0]?.subjects[0];
    if (!subject) throw new Error('fixture');
    subject.percent = percent;
    expect(refuse(data)).toThrow(InvalidResultsFileError);
  });

  it('never echoes the file into its error (it may hold a learner’s details)', () => {
    try {
      new FakeResultsSource({ ...file(), sample: false });
    } catch (error) {
      expect(String(error)).not.toContain('Ayanda');
      return;
    }
    throw new Error('expected a refusal');
  });
});

describe('isSampleExamNumber', () => {
  it.each([
    ['SAMPLE-AB2CD3', true],
    ['SAMPLE-K7Q2M9', true],
    ['sample-ab2cd3', false],
    ['SAMPLE-AB2CD0', false],
    ['SAMPLE-AB2CDO', false],
    ['SAMPLE-AB2CD', false],
    [`${'1234567'}${'890123'}`, false],
  ])('%s → %s', (value, expected) => {
    expect(isSampleExamNumber(value)).toBe(expected);
  });
});
