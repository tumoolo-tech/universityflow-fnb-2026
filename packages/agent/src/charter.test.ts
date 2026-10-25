import { describe, expect, it } from 'vitest';
import { CARE_GUIDANCE, CHARTER } from './charter';

describe('CHARTER', () => {
  it('carries all seven principles from planning.md §4.1', () => {
    expect(CHARTER).toHaveLength(7);
  });

  it('gives every principle a unique id, so evals can grade against it', () => {
    const ids = CHARTER.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('forbids promising outcomes and inventing stories', () => {
    const ids = CHARTER.map((entry) => entry.id);
    expect(ids).toContain('honest-encouragement');
    expect(ids).toContain('true-stories-only');
  });
});

describe('CARE_GUIDANCE', () => {
  it('applies the charter to five hard moments of matric (Phase 4e), without new principles', () => {
    const topics = CARE_GUIDANCE.map((g) => g.topic);
    for (const topic of ['setback', 'giving-up', 'family-pressure', 'comparison', 'exam-stress']) {
      expect(topics).toContain(topic);
    }
    expect(CHARTER).toHaveLength(7);
  });

  it('fits a Grade 10 learner too: no empty Plan B, no matric timetable for school exams (A10-39)', () => {
    const of = (topic: string) => CARE_GUIDANCE.find((g) => g.topic === topic)?.guidance ?? '';
    // Plan B is always empty on Grade 10 marks; the comfort is that universities don't use them.
    expect(of('setback')).toMatch(/Grade 10 marks?[^.]*universities don't use them/i);
    expect(of('setback')).toMatch(/what_i_need/);
    // exam_countdown holds the NSC papers only: school exams get a study step instead.
    expect(of('exam-stress')).toMatch(/school exams[^.]*not on exam_countdown/i);
  });

  it('and a Grade 11 June or September report: no empty Plan B either (S1-A10b, A10-48)', () => {
    const setback = CARE_GUIDANCE.find((g) => g.topic === 'setback')?.guidance ?? '';
    // On these interim marks Plan B is always empty too (packages/admissions basis.ts).
    expect(setback).toMatch(/Grade 11 June or September report[^.]*no Plan B/i);
    expect(setback).toMatch(/final Grade 11 report/);
  });

  it('and to five of arriving at university (Phase 5d), still without new principles', () => {
    const topics = CARE_GUIDANCE.map((g) => g.topic);
    for (const topic of [
      'offer-lost',
      'money-stress',
      'homesickness',
      'culture-shock',
      'arrival-anxiety',
    ]) {
      expect(topics).toContain(topic);
    }
    expect(topics).toHaveLength(10);
    expect(CHARTER).toHaveLength(7);
  });
});
