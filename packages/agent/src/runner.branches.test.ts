import { en } from '@universityflow/content';
import { describe, expect, it } from 'vitest';
import type { AgentContext } from './context';
import { runTurn, type TurnEvent } from './runner';
import { requestContext } from './system-prompt';
import { fakeContext, ScriptedModel } from './testing';

/**
 * The runner's edges that the main suite (agent.test.ts) leaves out: a learner with no profile
 * yet, a tool that breaks for a reason that isn't the model's input, and a model that fails while
 * the learner is struggling. Synthetic only.
 */

async function run(context: AgentContext, model: ScriptedModel, message: string) {
  const events: TurnEvent[] = [];
  const result = await runTurn({
    model,
    context,
    history: [],
    message,
    emit: (e) => events.push(e),
  });
  return { result, events };
}

describe('runTurn: a learner with no profile yet', () => {
  it('tells the model no grade, no name and no goal, rather than guessing them', async () => {
    const { context } = fakeContext();
    const model = new ScriptedModel([{ say: 'Hello!' }]);
    const { result } = await run({ ...context, profile: async () => null }, model, 'hello');
    expect(result).toMatchObject({ text: 'Hello!', failed: false, distress: 'none' });
    const sent = model.requests[0]?.context ?? '';
    expect(sent).toContain('applying for the 2028 intake');
    expect(sent).not.toMatch(/Grade \d/);
    expect(sent).not.toContain('learner_text');
    expect(sent).not.toContain('finished school');
  });
});

describe('runTurn: a tool that breaks', () => {
  it('answers kindly and keeps the cause from the learner when a tool fails on our side', async () => {
    const { context } = fakeContext();
    const broken: AgentContext = {
      ...context,
      remember: async () => {
        throw new Error('store unavailable: row 42');
      },
    };
    const model = new ScriptedModel([
      { tool: 'remember', input: { kind: 'note', body: 'likes maths' } },
      { say: 'Saved!' },
    ]);
    const { result, events } = await run(broken, model, 'please remember I like maths');
    // Not an input error the model could fix: the turn fails, it does not say "Saved!".
    expect(model.toolReplies).toEqual([]);
    expect(result).toMatchObject({ failed: true, text: en.chat.error });
    expect(events).toEqual([{ type: 'text', delta: en.chat.error }]);
    expect(JSON.stringify(events)).not.toContain('row 42');
  });
});

describe('runTurn: the model fails while the learner is struggling', () => {
  it('keeps the card and answers with the concern reply after what was streamed', async () => {
    const { context } = fakeContext();
    const { result, events } = await run(
      context,
      new ScriptedModel([{ fail: true }]),
      'I feel so hopeless about my maths',
    );
    expect(result.distress).toBe('concern');
    expect(result.failed).toBe(true);
    expect(result.artifacts.map((a) => a.kind)).toEqual(['crisis-card']);
    // The draft catalogue's support lines are all open 24 hours: the reply may mention them.
    expect(result.text).toBe(`partial\n\n${en.crisis.concernReply}`);
    expect(result.text).not.toContain(en.chat.error);
    expect(events.at(-1)).toEqual({ type: 'text', delta: `\n\n${en.crisis.concernReply}` });
  });
});

describe('requestContext: the learner’s own words, one without the other', () => {
  const base = {
    today: new Date('2026-10-13T00:00:00Z'),
    targetIntake: 2028,
    grade: 11,
    preview: false,
    concern: false,
  };

  it('sends a preferred name alone, with no empty goal line', () => {
    const text = requestContext({ ...base, displayName: 'Thandi', goal: null });
    expect(text).toContain('preferred_name: "Thandi"');
    expect(text).not.toMatch(/^goal_in_their_words:/m);
    expect(text).toContain('<learner_text>\npreferred_name: "Thandi"\n</learner_text>');
  });

  it('sends a goal alone, with no empty name line', () => {
    const text = requestContext({ ...base, displayName: null, goal: 'nursing at UKZN' });
    expect(text).toContain('goal_in_their_words: "nursing at UKZN"');
    expect(text).not.toMatch(/^preferred_name:/m);
    expect(text).toContain(
      '<learner_text>\ngoal_in_their_words: "nursing at UKZN"\n</learner_text>',
    );
  });
});
