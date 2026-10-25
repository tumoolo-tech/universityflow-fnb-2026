import { catalogueView } from '@universityflow/catalogue';
import type { StudentStore } from '@universityflow/db';
import { describe, expect, it, vi } from 'vitest';
import { examsResponse, goalResponse, goalsPage, practiceResponse } from '@/lib/server/goals';

/**
 * A4-07: the My goal page reads each of the learner's records once. Every store read is its own
 * transaction (BEGIN, set_config, set role, uf_may_process, query, COMMIT), so three builders
 * each reading for themselves cost about 45 statements and up to three pool connections.
 */

const NOW = new Date('2026-10-13T08:00:00Z');
const VIEW = catalogueView(NOW, { includeDrafts: true });

/** A store that answers the four reads the goals page needs, and counts them. Synthetic data. */
function countingStore() {
  const reads = {
    goal: vi.fn(async () => ({ programmeId: 'wits-bsc-computer-science' })),
    latestReport: vi.fn(async () => ({
      kind: 'grade-12-june',
      marks: [
        { subject: 'english-fal', percent: 68 },
        { subject: 'mathematics', percent: 71 },
        { subject: 'physical-sciences', percent: 66 },
      ],
    })),
    profile: vi.fn(async () => ({ grade: 12 })),
    examSubjectChoices: vi.fn(async () => [{ subjectId: 'geography', included: true }]),
  };
  return { reads, store: reads as unknown as StudentStore };
}

describe('the My goal page loads its data once (A4-07)', () => {
  it('reads the goal, the latest report, the profile and the exam choices once each', async () => {
    const { reads, store } = countingStore();
    await goalsPage(store, VIEW, NOW);
    expect(reads.latestReport).toHaveBeenCalledTimes(1);
    expect(reads.profile).toHaveBeenCalledTimes(1);
    expect(reads.goal).toHaveBeenCalledTimes(1);
    expect(reads.examSubjectChoices).toHaveBeenCalledTimes(1);
  });

  it('builds exactly what the three API routes build', async () => {
    const { store } = countingStore();
    const page = await goalsPage(store, VIEW, NOW);
    expect(page.goal).toEqual(await goalResponse(store, VIEW));
    expect(page.exams).toEqual(await examsResponse(store, VIEW, NOW));
    expect(page.practice).toEqual(await practiceResponse(store, VIEW));
    expect(page.goal.card?.result).toBeTruthy();
    expect(page.exams.subjects.map((s) => s.subjectId)).toContain('geography');
  });

  it('each route reads only what it needs, once', async () => {
    const goal = countingStore();
    await goalResponse(goal.store, VIEW);
    expect(goal.reads.profile).not.toHaveBeenCalled();
    expect(goal.reads.examSubjectChoices).not.toHaveBeenCalled();
    expect(goal.reads.latestReport).toHaveBeenCalledTimes(1);

    const exams = countingStore();
    await examsResponse(exams.store, VIEW, NOW);
    expect(exams.reads.goal).not.toHaveBeenCalled();
    expect(exams.reads.latestReport).toHaveBeenCalledTimes(1);

    const practice = countingStore();
    await practiceResponse(practice.store, VIEW);
    expect(practice.reads.examSubjectChoices).not.toHaveBeenCalled();
    expect(practice.reads.latestReport).toHaveBeenCalledTimes(1);
  });
});
