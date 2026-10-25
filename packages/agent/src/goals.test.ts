import { assessOne } from '@universityflow/admissions';
import { catalogueView } from '@universityflow/catalogue';
import { en } from '@universityflow/content';
import type { ExamCountdownArtifact, GoalCardArtifact } from '@universityflow/ui';
import { describe, expect, it } from 'vitest';
import { examCountdown, goalCard } from './goals';
import { runTurn, type TurnEvent } from './runner';
import { SampleChatModel } from './sample-model';
import { fakeContext, SAMPLE_MARKS, SAMPLE_REPORT } from './testing';
import { runTool, ToolInputError } from './tools';

const TODAY = new Date('2026-10-13T08:00:00Z');
const PREVIEW = catalogueView(TODAY, { includeDrafts: true });
const LEARNERS = catalogueView(TODAY, { includeDrafts: false });

describe('the goal card (hard rule 2: code decides, the AI explains)', () => {
  it('carries the verdict packages/admissions gives for the confirmed marks', () => {
    const card = goalCard(PREVIEW, 'wits-bsc-computer-science', SAMPLE_REPORT) as GoalCardArtifact;
    const expected = assessOne(PREVIEW, 'wits-bsc-computer-science', SAMPLE_REPORT)?.result;
    expect(card.result).toEqual(expected);
    expect(card.programme).toMatchObject({
      id: 'wits-bsc-computer-science',
      universityId: 'wits',
      universityName: 'Wits',
      draft: true,
    });
    expect(card.hasMarks).toBe(true);
  });

  it('without confirmed marks, has no verdict and says so', () => {
    const card = goalCard(PREVIEW, 'wits-bsc-computer-science', null);
    expect(card?.result).toBeNull();
    expect(card?.hasMarks).toBe(false);
  });

  it('is null for a programme learners may not see (unverified) or that does not exist', () => {
    expect(goalCard(LEARNERS, 'wits-bsc-computer-science', SAMPLE_REPORT)).toBeNull();
    expect(goalCard(PREVIEW, 'nope-nothing', SAMPLE_REPORT)).toBeNull();
  });

  it('on Grade 10 marks says on track, never qualifies (G10-3)', () => {
    const strong = SAMPLE_MARKS.map((m) => ({ ...m, percent: 90 }));
    const g11 = goalCard(PREVIEW, 'uj-bcom-accounting', { kind: 'grade-11-final', marks: strong });
    const g10 = goalCard(PREVIEW, 'uj-bcom-accounting', { kind: 'grade-10-final', marks: strong });
    expect(g11?.result?.verdict).toBe('qualifies');
    expect(g10?.result?.verdict).toBe('on-track');
  });
});

describe('the exam countdown', () => {
  const base = {
    view: PREVIEW,
    now: TODAY,
    grade: 12,
    confirmedSubjects: ['mathematics', 'english-fal', 'life-orientation'],
    choices: [],
  };

  it('lists the next papers for the subjects written, with days left, drafts labelled', () => {
    const c = examCountdown(base);
    expect(c).toMatchObject({ examYear: 2026, timetablePublished: true, subjectCount: 2 });
    expect(c.papers.map((p) => [p.id, p.daysLeft])).toEqual([
      ['nsc-2026-english-fal-p3', 2],
      ['nsc-2026-mathematics-p1', 10],
      ['nsc-2026-mathematics-p2', 13],
      ['nsc-2026-english-fal-p1', 15],
      ['nsc-2026-english-fal-p2', 37],
    ]);
    expect(c.papers.every((p) => p.draft)).toBe(true);
    expect(c.papers[0]).toMatchObject({ subjectName: 'English First Additional Language' });
    expect(c.includesDrafts).toBe(true);
  });

  it('drops a paper once it has ended, and keeps one being written', () => {
    const during = examCountdown({ ...base, now: new Date('2026-10-23T08:00:00Z') });
    expect(during.papers[0]).toMatchObject({ id: 'nsc-2026-mathematics-p1', daysLeft: 0 });
    const after = examCountdown({ ...base, now: new Date('2026-10-23T10:00:00Z') });
    expect(after.papers[0]?.id).toBe('nsc-2026-mathematics-p2');
  });

  it('honours the learner’s own subject changes', () => {
    const c = examCountdown({
      ...base,
      choices: [
        { subjectId: 'english-fal', included: false },
        { subjectId: 'tourism', included: true },
      ],
    });
    expect(c.papers.map((p) => p.subjectId)).toEqual(['mathematics', 'mathematics', 'tourism']);
  });

  it('shows learners no unverified paper', () => {
    const c = examCountdown({ ...base, view: LEARNERS });
    expect(c.papers).toEqual([]);
    expect(c.timetablePublished).toBe(false);
  });

  it('says the timetable is not out for a Grade 11 learner (2027), and invents nothing', () => {
    const c = examCountdown({ ...base, grade: 11 });
    expect(c).toMatchObject({ examYear: 2027, timetablePublished: false, papers: [] });
  });

  it('caps the list', () => {
    const many = examCountdown({
      ...base,
      confirmedSubjects: ['mathematics', 'english-hl', 'physical-sciences', 'life-sciences'],
      limit: 3,
    });
    expect(many.papers).toHaveLength(3);
  });
});

describe('the goal and exam tools', () => {
  it('set_goal validates its input before anything runs', async () => {
    const { context, goal } = fakeContext({ marks: SAMPLE_MARKS });
    for (const bad of [{}, { programme_id: 'x' }, { programme_id: 'Civil at UJ' }]) {
      await expect(runTool(context, 'set_goal', bad)).rejects.toThrow(ToolInputError);
    }
    expect(goal.id).toBeNull();
  });

  it('set_goal refuses a programme the catalogue does not show, and saves nothing', async () => {
    const { context, goal } = fakeContext({ marks: SAMPLE_MARKS });
    const result = await runTool(context, 'set_goal', { programme_id: 'nowhere-bsc' });
    expect(result.forModel).toEqual({ status: 'unknown-programme' });
    expect(result.artifacts).toEqual([]);
    expect(goal.id).toBeNull();
  });

  it('set_goal saves the goal and returns the goal card with the computed verdict', async () => {
    const { context, goal, shortlist } = fakeContext({ marks: SAMPLE_MARKS });
    const result = await runTool(context, 'set_goal', {
      programme_id: 'wits-bsc-computer-science',
    });
    expect(goal.id).toBe('wits-bsc-computer-science');
    expect(shortlist).toEqual(['wits-bsc-computer-science']);
    const card = result.artifacts[0] as GoalCardArtifact;
    expect(card.kind).toBe('goal-card');
    expect(result.forModel).toMatchObject({
      status: 'goal-set',
      verdict: card.result?.verdict,
      application_pack_university_id: 'wits',
      unverified_preview_data: true,
    });
  });

  it('show_goal says when there is no goal, and shows it when there is', async () => {
    const { context, goal } = fakeContext({ marks: null });
    expect((await runTool(context, 'show_goal', {})).forModel).toMatchObject({
      status: 'no-goal',
    });
    goal.id = 'wits-bsc-computer-science';
    const result = await runTool(context, 'show_goal', {});
    expect(result.forModel).toMatchObject({ status: 'goal', verdict: 'no-confirmed-marks' });
    expect(result.artifacts.map((a) => a.kind)).toEqual(['goal-card']);
    await expect(runTool(context, 'show_goal', { extra: 1 })).rejects.toThrow(ToolInputError);
  });

  it('exam_countdown validates its limit and returns the countdown', async () => {
    const { context } = fakeContext({ marks: SAMPLE_MARKS, grade: 12 });
    for (const limit of [0, 21, 2.5, '3']) {
      await expect(runTool(context, 'exam_countdown', { limit })).rejects.toThrow(ToolInputError);
    }
    const result = await runTool(context, 'exam_countdown', { limit: 2 });
    const countdown = result.artifacts[0] as ExamCountdownArtifact;
    expect(countdown.kind).toBe('exam-countdown');
    expect(countdown.papers).toHaveLength(2);
    expect(result.forModel).toMatchObject({
      exam_year: 2026,
      timetable_published: true,
      unverified_preview_data: true,
    });
  });

  it('exam_countdown for a Grade 11 learner: nothing published, nothing guessed', async () => {
    const { context } = fakeContext({ marks: SAMPLE_MARKS, grade: 11 });
    const result = await runTool(context, 'exam_countdown', {});
    expect(result.forModel).toMatchObject({
      exam_year: 2027,
      timetable_published: false,
      papers: [],
    });
  });

  it('a Grade 12 report counts as Grade 12', async () => {
    const { context } = fakeContext({
      marks: SAMPLE_MARKS,
      grade: 11,
      reportKind: 'grade-12-june',
    });
    const result = await runTool(context, 'exam_countdown', {});
    expect(result.forModel).toMatchObject({ exam_year: 2026, timetable_published: true });
  });
});

describe('the sample model reaches the new tools', () => {
  async function turn(message: string, grade: number | null = 12) {
    const fake = fakeContext({ marks: SAMPLE_MARKS, grade });
    const events: TurnEvent[] = [];
    const result = await runTurn({
      model: new SampleChatModel(),
      context: fake.context,
      history: [],
      message,
      emit: (e) => events.push(e),
    });
    return { result, fake };
  }

  it('answers an exam question with the countdown', async () => {
    const { result } = await turn('When is my next exam?');
    expect(result.artifacts.map((a) => a.kind)).toEqual(['exam-countdown']);
    expect(result.text).toBe(en.agent.sample.exams(8));
  });

  it('says plainly when it has no exam dates', async () => {
    const { result } = await turn('Show me my exam timetable', 11);
    expect(result.text).toBe(en.agent.sample.noExams);
  });

  it('answers a goal question', async () => {
    const { result } = await turn('What is my goal?');
    expect(result.text).toBe(en.agent.sample.noGoal);
  });
});
