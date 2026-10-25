import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { GeminiChatModel } from './gemini-model';
import {
  AnthropicChatModel,
  type ChatModel,
  FallbackChatModel,
  ModelError,
  type ModelRequest,
  type ModelResponse,
  ModelUnavailableError,
} from './model';
import { runTurn, type TurnEvent } from './runner';
import { fakeContext } from './testing';
import { TOOLS } from './tools';

/**
 * When the chosen provider can't answer (network, server error, rate limit) and the other one is
 * configured, the other answers that request instead (owner's decision of 2026-10-23). Only
 * when nothing has happened yet: once the learner has seen words or a tool has run, a second
 * answer would repeat them, so the failure stands and the runner answers kindly.
 */

type Script = (request: ModelRequest) => Promise<ModelResponse>;

/** Who a scripted model says it is (A10-49): a script, no AI. */
const SCRIPTED = { provider: 'local', model: 'scripted-test-model' } as const;

class Scripted implements ChatModel {
  readonly isSample = false;
  readonly writer = SCRIPTED;
  calls = 0;
  constructor(readonly script: Script) {}
  respond(request: ModelRequest) {
    this.calls++;
    return this.script(request);
  }
}

function request() {
  const deltas: string[] = [];
  const tools: string[] = [];
  const req: ModelRequest = {
    system: 'THE STABLE CHARTER',
    context: 'Per-request context.',
    history: [{ role: 'user', text: 'What can I study?' }],
    tools: TOOLS,
    onText: (delta) => deltas.push(delta),
    callTool: async (name) => {
      tools.push(name);
      return { content: '{"ok":true}', isError: false };
    },
  };
  return { req, deltas, tools };
}

const answers =
  (text: string): Script =>
  async (r) => {
    r.onText(text);
    return { text, refused: false };
  };
const unavailable: Script = async () => {
  throw new ModelUnavailableError('synthetic outage');
};

describe('FallbackChatModel', () => {
  it('uses the chosen model when it answers, and never asks the other', async () => {
    const primary = new Scripted(answers('From the first.'));
    const secondary = new Scripted(answers('From the second.'));
    const { req, deltas } = request();
    const model = new FallbackChatModel(primary, secondary);
    expect(model.isSample).toBe(false);
    expect(await model.respond(req)).toEqual({
      text: 'From the first.',
      refused: false,
      writtenBy: SCRIPTED,
    });
    expect(deltas).toEqual(['From the first.']);
    expect(secondary.calls).toBe(0);
  });

  it('asks the other model, with the same request, when the chosen one is unavailable', async () => {
    let seen: ModelRequest | undefined;
    const primary = new Scripted(unavailable);
    const secondary = new Scripted(async (r) => {
      seen = r;
      return answers('From the second.')(r);
    });
    const { req, deltas } = request();
    const response = await new FallbackChatModel(primary, secondary).respond(req);
    expect(response).toEqual({ text: 'From the second.', refused: false, writtenBy: SCRIPTED });
    expect(deltas).toEqual(['From the second.']);
    // The prompt and tools are the learner's request, unchanged: nothing new reaches the model.
    expect(seen?.system).toBe(req.system);
    expect(seen?.context).toBe(req.context);
    expect(seen?.history).toBe(req.history);
    expect(seen?.tools).toBe(req.tools);
  });

  it('never falls back on a refusal: the runner answers a refusal itself', async () => {
    const primary = new Scripted(async () => ({ text: '', refused: true }));
    const secondary = new Scripted(answers('Another try.'));
    const response = await new FallbackChatModel(primary, secondary).respond(request().req);
    expect(response).toEqual({ text: '', refused: true, writtenBy: SCRIPTED });
    expect(secondary.calls).toBe(0);
  });

  it('never falls back on a failure that is not an outage (a bad request, a broken tool loop)', async () => {
    const primary = new Scripted(async () => {
      throw new ModelError('Too many tool calls');
    });
    const secondary = new Scripted(answers('Another try.'));
    await expect(new FallbackChatModel(primary, secondary).respond(request().req)).rejects.toThrow(
      'Too many tool calls',
    );
    expect(secondary.calls).toBe(0);
  });

  it('never falls back once the learner has seen words: they would be repeated', async () => {
    const primary = new Scripted(async (r) => {
      r.onText('Half an ');
      throw new ModelUnavailableError('synthetic outage');
    });
    const secondary = new Scripted(answers('A whole answer.'));
    const { req, deltas } = request();
    await expect(new FallbackChatModel(primary, secondary).respond(req)).rejects.toBeInstanceOf(
      ModelUnavailableError,
    );
    expect(deltas).toEqual(['Half an ']);
    expect(secondary.calls).toBe(0);
  });

  it('never falls back once a tool has run: it would run again', async () => {
    const primary = new Scripted(async (r) => {
      await r.callTool('remember', { fact: 'synthetic' });
      throw new ModelUnavailableError('synthetic outage');
    });
    const secondary = new Scripted(answers('A whole answer.'));
    const { req, tools } = request();
    await expect(new FallbackChatModel(primary, secondary).respond(req)).rejects.toBeInstanceOf(
      ModelUnavailableError,
    );
    expect(tools).toEqual(['remember']);
    expect(secondary.calls).toBe(0);
  });

  it('rejects with the other model’s error when both fail', async () => {
    const primary = new Scripted(unavailable);
    const secondary = new Scripted(async () => {
      throw new ModelError('second failed');
    });
    await expect(new FallbackChatModel(primary, secondary).respond(request().req)).rejects.toThrow(
      'second failed',
    );
  });
});

describe('FallbackChatModel with the real adapters inside runTurn', () => {
  const geminiSays = (text: string) =>
    (async () =>
      new Response(
        `data: ${JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }] })}\r\n\r\n`,
        { status: 200 },
      )) as typeof fetch;
  const anthropicDown = (status: number) =>
    new Anthropic({
      apiKey: 'test-key',
      maxRetries: 0,
      fetch: async () =>
        new Response('{"type":"error","error":{"type":"overloaded_error","message":"x"}}', {
          status,
          headers: { 'content-type': 'application/json' },
        }),
    });

  async function turn(model: ChatModel, message = 'When does UCT close?') {
    const { context } = fakeContext();
    const events: TurnEvent[] = [];
    const result = await runTurn({
      model,
      context,
      history: [],
      message,
      emit: (e) => events.push(e),
    });
    const text = events.flatMap((e) => (e.type === 'text' ? [e.delta] : [])).join('');
    return { result, text, events };
  }

  it.each([529, 429, 500])(
    'Anthropic answering %i: Gemini answers that message instead',
    async (status) => {
      const model = new FallbackChatModel(
        new AnthropicChatModel({ client: anthropicDown(status), model: 'claude-test-model' }),
        new GeminiChatModel({
          apiKey: 'test-key',
          model: 'gemini-test-model',
          fetch: geminiSays('UCT closes soon.'),
        }),
      );
      const { result, text } = await turn(model);
      expect(result.failed).toBe(false);
      expect(text).toBe('UCT closes soon.');
    },
  );

  it('Anthropic answering 400: no fallback, the kind error message', async () => {
    const secondary = new Scripted(answers('Should not be asked.'));
    const model = new FallbackChatModel(
      new AnthropicChatModel({ client: anthropicDown(400), model: 'claude-test-model' }),
      secondary,
    );
    const { result } = await turn(model);
    expect(result.failed).toBe(true);
    expect(secondary.calls).toBe(0);
  });

  it('a crisis reaches neither model', async () => {
    const primary = new Scripted(answers('x'));
    const secondary = new Scripted(answers('y'));
    const { result } = await turn(
      new FallbackChatModel(primary, secondary),
      'I want to kill myself',
    );
    expect(result.distress).toBe('crisis');
    expect(primary.calls + secondary.calls).toBe(0);
  });
});
