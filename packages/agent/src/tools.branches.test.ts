import { catalogueView } from '@universityflow/catalogue';
import { describe, expect, it } from 'vitest';
import type { AgentContext } from './context';
import { fakeContext, SAMPLE_MARKS } from './testing';
import { runTool, ToolInputError } from './tools';

/**
 * Tool edges beside agent.test.ts: a model's call with no arguments at all, a learner with no
 * marks or no profile yet, and a catalogue with nothing verified in it (what a real learner sees
 * before a person has checked the records). Synthetic only.
 */

const forModel = async (context: AgentContext, name: string, input: unknown) =>
  (await runTool(context, name, input)).forModel as Record<string, unknown>;

describe('runTool: the arguments a model sends', () => {
  it('reads a call with no arguments at all as an empty object, as the API allows', async () => {
    const { context } = fakeContext();
    const none = await runTool(context, 'deadlines', undefined);
    const empty = await runTool(context, 'deadlines', {});
    expect(none).toEqual(empty);
    expect((none.forModel as { windows: unknown[] }).windows.length).toBeGreaterThan(0);
  });

  it('still validates a call with no arguments: a tool that needs one refuses it', async () => {
    const { context } = fakeContext();
    await expect(runTool(context, 'programme_details', undefined)).rejects.toBeInstanceOf(
      ToolInputError,
    );
  });
});

describe('tools for a learner with no confirmed marks', () => {
  it('programme_details asks for marks instead of guessing them', async () => {
    const { context } = fakeContext();
    const facts = await forModel(context, 'programme_details', {
      programme_id: 'wits-bsc-computer-science',
    });
    expect(facts['status']).toBe('no-confirmed-report');
  });

  it('application_pack lists no shortlisted programme as assessed when there are no marks', async () => {
    const fake = fakeContext();
    await fake.context.addToShortlist('wits-bsc-computer-science');
    const result = await runTool(fake.context, 'application_pack', { university_id: 'wits' });
    expect(result.forModel).toMatchObject({ shortlisted_here: [] });
    expect(result.artifacts[0]).toMatchObject({ kind: 'application-pack', programmes: [] });
  });

  it('exam_countdown never guesses which papers the learner writes', async () => {
    const { context } = fakeContext();
    const facts = await forModel({ ...context, profile: async () => null }, 'exam_countdown', {});
    expect(facts['subjects_matched']).toBe(0);
    expect(facts['papers']).toEqual([]);
  });

  it('practice_for with no profile, no marks and no goal asks instead of suggesting', async () => {
    const { context } = fakeContext();
    const facts = await forModel({ ...context, profile: async () => null }, 'practice_for', {});
    expect(facts['status']).toBe('nothing-to-choose-from');
  });

  it('practice_for still answers a subject the learner asks about, with no profile', async () => {
    const { context } = fakeContext({ marks: SAMPLE_MARKS });
    const facts = await forModel({ ...context, profile: async () => null }, 'practice_for', {
      subject_id: 'mathematics',
    });
    expect(facts['status']).toBeUndefined();
    expect(facts['chosen_from']).toBe('asked');
  });
});

describe('search_programmes with no words', () => {
  it('lists the catalogue, at most 25, with the true count', async () => {
    const { context } = fakeContext();
    const facts = await forModel(context, 'search_programmes', {});
    expect(facts['count']).toBe(context.catalogue.programmes.length);
    expect((facts['programmes'] as unknown[]).length).toBe(
      Math.min(25, context.catalogue.programmes.length),
    );
  });

  it('narrows to one university by its id alone', async () => {
    const { context } = fakeContext();
    const facts = await forModel(context, 'search_programmes', { university_id: 'uct' });
    const programmes = facts['programmes'] as Array<{ university: string }>;
    expect(programmes.length).toBeGreaterThan(0);
    expect(new Set(programmes.map((p) => p.university))).toEqual(new Set(['uct']));
    expect(facts['count']).toBe(
      context.catalogue.programmes.filter((p) => p.universityId === 'uct').length,
    );
  });
});

describe('show_goal when the goal is no longer in the catalogue', () => {
  it('says so, with no card, rather than showing a stale goal', async () => {
    const fake = fakeContext({ marks: SAMPLE_MARKS });
    fake.goal.id = 'withdrawn-programme-0000';
    const result = await runTool(fake.context, 'show_goal', {});
    expect(result).toEqual({ forModel: { status: 'goal-not-available' }, artifacts: [] });
  });
});

describe('tools over a catalogue with nothing verified yet', () => {
  // What a real learner is shown before a person has checked the records: no drafts.
  const verifiedOnly = () => {
    const { context } = fakeContext({ marks: SAMPLE_MARKS });
    return {
      ...context,
      catalogue: catalogueView(context.today, { includeDrafts: false }),
    } satisfies AgentContext;
  };

  it('application_pack says the university is not available instead of showing a draft', async () => {
    const context = verifiedOnly();
    expect(context.catalogue.universities.some((u) => u.id === 'wits')).toBe(false);
    const result = await runTool(context, 'application_pack', { university_id: 'wits' });
    expect(result).toEqual({ forModel: { status: 'not-available' }, artifacts: [] });
  });

  it('funding_overview says NSFAS details are not available, with an empty checklist', async () => {
    const context = verifiedOnly();
    expect(context.catalogue.nsfas).toBeNull();
    const result = await runTool(context, 'funding_overview', {});
    expect(result.forModel).toEqual({ status: 'not-available' });
    expect(result.artifacts).toEqual([{ kind: 'funding', nsfas: null, checklist: [] }]);
  });
});
