import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { GeminiChatModel } from './gemini-model';
import {
  AnthropicChatModel,
  type ChatModel,
  FallbackChatModel,
  type ModelRequest,
  type ModelResponse,
  ModelUnavailableError,
  NO_MODEL,
  type ReplyWriter,
} from './model';
import { runTurn } from './runner';
import { SampleChatModel } from './sample-model';
import { fakeContext, ScriptedModel } from './testing';

/**
 * A10-49: which provider wrote each reply. Every chat model says who it is (a provider and a
 * model id, nothing else: hard rule 4), and the turn runner says who wrote the reply it returns.
 * A reply no model wrote (the reviewed crisis reply, or our own kind line when the model refused or
 * failed before saying anything) is `NO_MODEL`: provider 'system', no model id.
 */

type Script = (request: ModelRequest) => Promise<ModelResponse>;

class Named implements ChatModel {
  readonly isSample = false;
  calls = 0;
  constructor(
    readonly writer: ReplyWriter,
    readonly script: Script,
  ) {}
  respond(request: ModelRequest) {
    this.calls++;
    return this.script(request);
  }
}

const answers =
  (text: string): Script =>
  async (r) => {
    r.onText(text);
    return { text, refused: false };
  };

const FIRST: ReplyWriter = { provider: 'anthropic', model: 'claude-test-model' };
const SECOND: ReplyWriter = { provider: 'gemini', model: 'gemini-test-model' };

async function turn(model: ChatModel, message = 'When does UCT close?') {
  const { context } = fakeContext();
  return runTurn({ model, context, history: [], message, emit: () => {} });
}

describe('every chat model says who it is (A10-49)', () => {
  it('names the provider and the configured model id, never a key', () => {
    const anthropic = new AnthropicChatModel({
      client: new Anthropic({ apiKey: 'test-key' }),
      model: 'claude-test-model',
    });
    expect(anthropic.writer).toEqual({ provider: 'anthropic', model: 'claude-test-model' });
    const gemini = new GeminiChatModel({ apiKey: 'test-key', model: 'gemini-test-model' });
    expect(gemini.writer).toEqual({ provider: 'gemini', model: 'gemini-test-model' });
    expect(JSON.stringify(gemini.writer)).not.toContain('test-key');
  });

  it('the stand-in says it is the local script', () => {
    expect(new SampleChatModel().writer).toEqual({ provider: 'local', model: 'sample-chat-model' });
  });

  it('a fallback pair is, by default, the provider asked first', () => {
    const pair = new FallbackChatModel(
      new Named(FIRST, answers('a')),
      new Named(SECOND, answers('b')),
    );
    expect(pair.writer).toEqual(FIRST);
  });

  it('no model is the system, with no model id', () => {
    expect(NO_MODEL).toEqual({ provider: 'system', model: null });
  });
});

describe('the turn says who wrote its reply (A10-49)', () => {
  it('the model that answered', async () => {
    const result = await turn(new ScriptedModel([{ say: 'UCT closes in July.' }]));
    expect(result.writtenBy).toEqual(new ScriptedModel([]).writer);
  });

  it('the stand-in, when it answered', async () => {
    const result = await turn(new SampleChatModel(), 'hello');
    expect(result.writtenBy).toEqual({ provider: 'local', model: 'sample-chat-model' });
  });

  it('a crisis reply: the system, and no model was asked', async () => {
    const model = new Named(FIRST, answers('x'));
    const result = await turn(model, 'I want to kill myself');
    expect(result.distress).toBe('crisis');
    expect(model.calls).toBe(0);
    expect(result.writtenBy).toEqual(NO_MODEL);
  });

  it('a refusal before any words: the system wrote everything the learner reads', async () => {
    const result = await turn(new Named(FIRST, async () => ({ text: '', refused: true })));
    expect(result.failed).toBe(true);
    expect(result.writtenBy).toEqual(NO_MODEL);
  });

  it('a failure before any words: the system', async () => {
    const result = await turn(
      new Named(FIRST, async () => {
        throw new Error('synthetic');
      }),
    );
    expect(result.failed).toBe(true);
    expect(result.writtenBy).toEqual(NO_MODEL);
  });

  it('a refusal mid-answer: the model wrote the words before our kind line', async () => {
    const result = await turn(
      new Named(FIRST, async (r) => {
        r.onText('Part of an');
        return { text: 'Part of an', refused: true };
      }),
    );
    expect(result.failed).toBe(true);
    expect(result.writtenBy).toEqual(FIRST);
  });

  it('a failure mid-answer: the model that streamed the words', async () => {
    const result = await turn(
      new Named(FIRST, async (r) => {
        r.onText('Half an ');
        throw new ModelUnavailableError('synthetic outage');
      }),
    );
    expect(result.failed).toBe(true);
    expect(result.writtenBy).toEqual(FIRST);
  });

  it('the other provider, when the chosen one was down and it answered instead', async () => {
    const pair = new FallbackChatModel(
      new Named(FIRST, async () => {
        throw new ModelUnavailableError('synthetic outage');
      }),
      new Named(SECOND, answers('From the second.')),
    );
    const result = await turn(pair);
    expect(result.failed).toBe(false);
    expect(result.writtenBy).toEqual(SECOND);
  });

  it('the other provider, when it took over and then failed mid-answer', async () => {
    const pair = new FallbackChatModel(
      new Named(FIRST, async () => {
        throw new ModelUnavailableError('synthetic outage');
      }),
      new Named(SECOND, async (r) => {
        r.onText('Half from the second ');
        throw new Error('synthetic');
      }),
    );
    const result = await turn(pair);
    expect(result.failed).toBe(true);
    expect(result.writtenBy).toEqual(SECOND);
  });

  it('the chosen provider, when it answered and the other was never asked', async () => {
    const second = new Named(SECOND, answers('never'));
    const result = await turn(new FallbackChatModel(new Named(FIRST, answers('First.')), second));
    expect(second.calls).toBe(0);
    expect(result.writtenBy).toEqual(FIRST);
  });
});
