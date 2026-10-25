import { achievementLevel, nscPass } from '@universityflow/admissions';
import { isHomeLanguage, LIFE_ORIENTATION, type SubjectId } from '@universityflow/catalogue';
import {
  isSampleExamNumber,
  RESULTS_PERIODS,
  resolveSubject,
  sampleResultsFileSchema,
} from '@universityflow/documents';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED, generateCohort, generateLearner } from './learners';
import { SYNTHETIC_SURNAMES } from './strings';

describe('generateLearner', () => {
  it('is deterministic: the same seed gives the same learner, another seed another', () => {
    const a = generateLearner({ seed: 's1', subjectCount: 7 });
    expect(generateLearner({ seed: 's1', subjectCount: 7 })).toEqual(a);
    expect(generateLearner({ seed: 's2', subjectCount: 7 })).not.toEqual(a);
  });

  it('makes an obviously synthetic learner: a sample exam number and a sample surname', () => {
    for (let i = 0; i < 30; i++) {
      const learner = generateLearner({ seed: `n${i}`, subjectCount: 7 });
      expect(isSampleExamNumber(learner.examNumber)).toBe(true);
      const surname = learner.displayName.split(' ').at(-1);
      expect(SYNTHETIC_SURNAMES as ReadonlyArray<string>).toContain(surname);
      expect(learner.school).toMatch(/^Sample Secondary School \d+$/);
    }
  });

  it('holds all nine reports, Grade 10 June to the final NSC, a school year apart', () => {
    const learner = generateLearner({ seed: 'years', subjectCount: 7, firstYear: 2030 });
    expect(learner.reports.map((r) => r.period)).toEqual([...RESULTS_PERIODS]);
    expect(learner.reports.map((r) => r.academicYear)).toEqual([
      2030, 2030, 2030, 2031, 2031, 2031, 2032, 2032, 2032,
    ]);
  });

  it.each([7, 9, 11, 12])(
    'takes %d subjects: a home language, English, mathematics and Life Orientation among them',
    (count) => {
      const learner = generateLearner({ seed: `count-${count}`, subjectCount: count });
      for (const report of learner.reports) {
        const ids = report.subjects.map((s) => s.subject as SubjectId);
        expect(ids).toHaveLength(count);
        expect(new Set(ids).size).toBe(count);
        expect(ids.some((id) => isHomeLanguage(id))).toBe(true);
        expect(ids.some((id) => id === 'english-hl' || id === 'english-fal')).toBe(true);
        expect(ids.some((id) => id === 'mathematics' || id === 'mathematical-literacy')).toBe(true);
        expect(ids).toContain(LIFE_ORIENTATION);
      }
      // The same subjects all the way through.
      const first = learner.reports[0]?.subjects.map((s) => s.subject);
      for (const report of learner.reports) {
        expect(report.subjects.map((s) => s.subject)).toEqual(first);
      }
    },
  );

  it.each([6, 13, 7.5])('refuses %d subjects', (count) => {
    expect(() => generateLearner({ seed: 'x', subjectCount: count })).toThrow(RangeError);
  });

  it('takes every level and pass from packages/admissions (hard rule 2)', () => {
    for (let i = 0; i < 20; i++) {
      const learner = generateLearner({ seed: `rules-${i}`, subjectCount: 7 + (i % 6) });
      for (const report of learner.reports) {
        for (const s of report.subjects) {
          expect(Number.isInteger(s.percent)).toBe(true);
          expect(s.level).toBe(achievementLevel(s.percent));
        }
        expect(report.pass).toBe(
          nscPass(
            report.subjects.map((s) => ({ subject: s.subject as SubjectId, percent: s.percent })),
          ),
        );
      }
    }
  });

  it('prints every subject under a name the report reader resolves back to it', () => {
    for (let i = 0; i < 40; i++) {
      const learner = generateLearner({ seed: `names-${i}`, subjectCount: 12 });
      for (const s of learner.reports[0]?.subjects ?? []) {
        expect(resolveSubject(s.nameAsPrinted)).toBe(s.subject);
      }
    }
  });
});

describe('generateCohort', () => {
  it('passes the sample file schema the fake ResultsSource reads', () => {
    expect(sampleResultsFileSchema.safeParse(generateCohort()).success).toBe(true);
  });

  it('starts Grade 10 in 2024 unless told another year', () => {
    expect(generateCohort({ count: 1 }).learners[0]?.reports[0]?.academicYear).toBe(2024);
    const later = generateCohort({ count: 1, firstYear: 2026 }).learners[0];
    expect(later?.reports.at(-1)?.academicYear).toBe(2028);
  });

  it('gives each learner their own exam number', () => {
    const cohort = generateCohort({ seed: 'unique', count: 40 });
    const numbers = cohort.learners.map((l) => l.examNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('holds no run of seven or more digits anywhere: nothing like an ID or exam number', () => {
    const json = JSON.stringify(generateCohort({ seed: DEFAULT_SEED, count: 40 }));
    expect(json).not.toMatch(/\d{7,}/);
  });

  it('gives the demo a spread of results: some final passes for degree study, some not', () => {
    const finals = generateCohort().learners.map((l) => l.reports.at(-1)?.pass);
    expect(finals).toContain('bachelor');
    expect(finals.some((p) => p !== 'bachelor')).toBe(true);
  });
});
