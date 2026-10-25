import { type SubjectMark, whatINeedFor } from '@universityflow/admissions';
import { catalogueView } from '@universityflow/catalogue';
import type { PracticeArtifact } from '@universityflow/ui';
import { describe, expect, it } from 'vitest';
import { PRACTICE_SUBJECT_LIMIT, practicePlan } from './practice';
import { fakeContext, SAMPLE_MARKS } from './testing';
import { runTool, ToolInputError } from './tools';

/** A confirmed final Grade 11 report with these marks. */
const g11 = (marks: ReadonlyArray<SubjectMark>) => ({ kind: 'grade-11-final' as const, marks });

const TODAY = new Date('2026-10-13T08:00:00Z');
const PREVIEW = catalogueView(TODAY, { includeDrafts: true });
const LEARNERS = catalogueView(TODAY, { includeDrafts: false });

/** A learner short of Wits Civil Engineering in Mathematics and Physical Sciences. */
const SHORT: ReadonlyArray<SubjectMark> = [
  { subject: 'english-hl', percent: 72 },
  { subject: 'afrikaans-fal', percent: 70 },
  { subject: 'mathematics', percent: 48 },
  { subject: 'physical-sciences', percent: 45 },
  { subject: 'geography', percent: 75 },
  { subject: 'history', percent: 68 },
  { subject: 'life-orientation', percent: 40 },
];

const ids = (a: PracticeArtifact) => a.subjects.map((s) => s.subjectId);

describe('practicePlan: which subjects (hard rules 2 and 6)', () => {
  it('starts from the subjects "what I need" says must rise for the goal', () => {
    const plan = practicePlan({
      view: PREVIEW,
      grade: 11,
      goalProgrammeId: 'wits-bsceng-civil',
      confirmedReport: g11(SHORT),
    });
    const need = whatINeedFor(PREVIEW, 'wits-bsceng-civil', g11(SHORT))?.plan;
    const toRaise = (need?.subjects ?? []).filter((s) => s.gap > 0).map((s) => s.subject);
    expect(toRaise).toEqual(expect.arrayContaining(['mathematics', 'physical-sciences']));
    expect(plan.basis).toBe('goal');
    expect(plan.goal?.programmeId).toBe('wits-bsceng-civil');
    for (const s of plan.subjects.filter((x) => x.reason === 'goal-to-raise')) {
      expect(toRaise).toContain(s.subjectId);
    }
    expect(ids(plan).slice(0, 2).sort()).toEqual(['mathematics', 'physical-sciences']);
    expect(plan.subjects.length).toBeLessThanOrEqual(PRACTICE_SUBJECT_LIMIT);
  });

  it('when the goal is already met, uses the subjects the programme names', () => {
    const strong = SHORT.map((m) => ({ ...m, percent: 95 }));
    const plan = practicePlan({
      view: PREVIEW,
      grade: 11,
      goalProgrammeId: 'wits-bsceng-civil',
      confirmedReport: g11(strong),
    });
    expect(plan.basis).toBe('goal');
    expect(plan.subjects.every((s) => s.reason === 'goal-requires')).toBe(true);
    expect(ids(plan)).toContain('mathematics');
    expect(ids(plan)).not.toContain('life-orientation');
  });

  it('with a goal but no confirmed marks, uses the named non-language subjects', () => {
    const plan = practicePlan({
      view: PREVIEW,
      grade: 11,
      goalProgrammeId: 'wits-bsceng-civil',
      confirmedReport: null,
    });
    expect(plan.basis).toBe('goal');
    expect(ids(plan)).toContain('mathematics');
    expect(
      plan.subjects.every((s) => !s.subjectId.endsWith('-hl') && !s.subjectId.endsWith('-fal')),
    ).toBe(true);
  });

  it('without a goal, uses the weakest confirmed marks, never Life Orientation', () => {
    const plan = practicePlan({
      view: PREVIEW,
      grade: 11,
      goalProgrammeId: null,
      confirmedReport: g11(SHORT),
    });
    expect(plan.basis).toBe('weakest');
    expect(ids(plan)).toEqual(['physical-sciences', 'mathematics', 'history']);
    expect(plan.subjects.every((s) => s.reason === 'weakest')).toBe(true);
  });

  it('without a goal or confirmed marks, chooses nothing rather than guess (rule 6)', () => {
    const plan = practicePlan({
      view: PREVIEW,
      grade: 11,
      goalProgrammeId: null,
      confirmedReport: null,
    });
    expect(plan).toMatchObject({ basis: 'none', subjects: [], goal: null });
  });

  it('the subject asked about comes first and alone', () => {
    const plan = practicePlan({
      view: PREVIEW,
      grade: 12,
      goalProgrammeId: 'wits-bsceng-civil',
      confirmedReport: g11(SHORT),
      subjectId: 'life-sciences',
    });
    expect(plan.basis).toBe('asked');
    expect(plan.subjects).toHaveLength(1);
    expect(plan.subjects[0]?.resources.map((r) => r.id)).toEqual([
      'siyavula-life-sciences-grade-10-textbook',
    ]);
  });

  it('lists a subject with no free practice yet, empty, after ones that have some', () => {
    const plan = practicePlan({
      view: PREVIEW,
      grade: 11,
      goalProgrammeId: null,
      confirmedReport: g11(SHORT),
    });
    const history = plan.subjects.find((s) => s.subjectId === 'history');
    expect(history?.resources).toEqual([]);
    expect(ids(plan).at(-1)).toBe('history');
  });

  it('ignores a goal learners may not see', () => {
    const plan = practicePlan({
      view: PREVIEW,
      grade: 11,
      goalProgrammeId: 'gone-programme',
      confirmedReport: g11(SHORT),
    });
    expect(plan.goal).toBeNull();
    expect(plan.basis).toBe('weakest');
  });
});

describe('practicePlan: which links (hard rule 3)', () => {
  it('picks books for the learner’s grade and later, drafts labelled in preview', () => {
    const plan = practicePlan({
      view: PREVIEW,
      grade: 11,
      goalProgrammeId: null,
      confirmedReport: g11(SHORT),
    });
    const maths = plan.subjects.find((s) => s.subjectId === 'mathematics');
    expect(maths?.resources.map((r) => r.id)).toEqual([
      'siyavula-mathematics-grade-11-textbook',
      'siyavula-mathematics-grade-12-textbook',
      'siyavula-mathematics-practice',
      'siyavula-mathematics-past-papers',
    ]);
    expect(
      maths?.resources.every((r) => r.draft && r.url.startsWith('https://www.siyavula.com/')),
    ).toBe(true);
    expect(plan.includesDrafts).toBe(true);
  });

  it('shows learners no unverified link', () => {
    const plan = practicePlan({
      view: LEARNERS,
      grade: 11,
      goalProgrammeId: null,
      confirmedReport: g11(SHORT),
    });
    expect(plan.subjects.flatMap((s) => s.resources)).toEqual([]);
    expect(plan.includesDrafts).toBe(false);
  });

  it('carries no admission fact: no marks, no scores, no requirements', () => {
    const plan = practicePlan({
      view: PREVIEW,
      grade: 11,
      goalProgrammeId: 'wits-bsceng-civil',
      confirmedReport: g11(SHORT),
    });
    const json = JSON.stringify(plan);
    expect(json).not.toMatch(/percent|target|minimum|score|"gap"|aps/i);
    expect(JSON.parse(json)).toEqual(plan);
  });
});

describe('the practice_for tool', () => {
  it('validates its input before anything runs', async () => {
    const { context } = fakeContext({ marks: SAMPLE_MARKS });
    await expect(runTool(context, 'practice_for', { subject_id: 'astrology' })).rejects.toThrow(
      ToolInputError,
    );
    await expect(runTool(context, 'practice_for', { extra: 1 })).rejects.toThrow(ToolInputError);
  });

  it('uses the goal and the latest confirmed report', async () => {
    const fake = fakeContext({ marks: SHORT });
    fake.goal.id = 'wits-bsceng-civil';
    const result = await runTool(fake.context, 'practice_for', {});
    const artifact = result.artifacts[0];
    expect(artifact?.kind).toBe('practice');
    if (artifact?.kind !== 'practice') return;
    expect(artifact.basis).toBe('goal');
    const facts = result.forModel as {
      chosen_from: string;
      subjects: Array<{ subject: string; why: string }>;
      unverified_preview_data: boolean;
    };
    expect(facts.chosen_from).toBe('goal');
    expect(facts.subjects[0]?.why).toMatch(/what_i_need/);
    expect(facts.unverified_preview_data).toBe(true);
    expect(JSON.stringify(facts)).not.toMatch(/\d{2}%|aim_for/);
  });

  it('a Grade 12 report picks Grade 12 material', async () => {
    const fake = fakeContext({ marks: SHORT, reportKind: 'grade-12-june' });
    const result = await runTool(fake.context, 'practice_for', { subject_id: 'mathematics' });
    const artifact = result.artifacts[0];
    if (artifact?.kind !== 'practice') throw new Error('no practice artifact');
    expect(artifact.subjects[0]?.resources.map((r) => r.id)).toEqual([
      'siyavula-mathematics-grade-12-textbook',
      'siyavula-mathematics-practice',
      'siyavula-mathematics-past-papers',
    ]);
  });

  it('with nothing confirmed and no goal, shows nothing and says why (rule 6)', async () => {
    const { context } = fakeContext({ marks: null });
    const result = await runTool(context, 'practice_for', {});
    expect(result.artifacts).toEqual([]);
    expect(result.forModel).toMatchObject({ status: 'nothing-to-choose-from' });
  });
});
