import Anthropic from '@anthropic-ai/sdk';
import { en } from '@universityflow/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GeminiChatModel } from './gemini-model';
import { AnthropicChatModel, type ChatModel, isModelUnavailable, type ModelRequest } from './model';
import { runTurn, type TurnEvent } from './runner';
import { fakeContext } from './testing';
import { TOOLS } from './tools';

/**
 * The chat model contract (D8): every real `ChatModel` passes the same suite against a fake of
 * its own HTTP API, so the runner, the crisis check, care and every safety rule behave the same
 * whichever provider answers. Each provider's harness turns one script of steps into its own
 * API's wire format, and reads its own requests back into one shape. No network, no key; every
 * conversation is synthetic.
 */

// ── The script both fakes play ──────────────────────────────────────────────────────────────

interface Call {
  readonly name: string;
  readonly input: unknown;
}
type Step =
  | { readonly kind: 'say'; readonly text: string }
  | { readonly kind: 'calls'; readonly text?: string; readonly calls: ReadonlyArray<Call> }
  /** The provider declined (Anthropic: stop_reason refusal; Gemini: a safety block). */
  | { readonly kind: 'refuse'; readonly text?: string }
  | { readonly kind: 'status'; readonly status: number }
  | { readonly kind: 'network' };

/** What a provider was sent, read back into one shape. */
interface Sent {
  /** The charter, then the per-request context. */
  readonly system: ReadonlyArray<string>;
  readonly toolNames: ReadonlyArray<string>;
  /** The plain text turns, in order (tool rounds left out). */
  readonly turns: ReadonlyArray<{ readonly role: 'user' | 'assistant'; readonly text: string }>;
  /** The tool results in the last user turn, if it holds any. */
  readonly toolResults: ReadonlyArray<{ readonly content: string; readonly isError: boolean }>;
}

interface Harness {
  readonly model: ChatModel;
  sent(): ReadonlyArray<Sent>;
}

type Provider = (steps: ReadonlyArray<Step>) => Harness;

// ── Anthropic's fake: the real SDK over a fake fetch (as in model.test.ts) ──────────────────

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

function anthropicStream(blocks: ReadonlyArray<Record<string, unknown>>, stop: string): string {
  let out = sse('message_start', {
    type: 'message_start',
    message: {
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      model: 'claude-test-model',
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 1 },
    },
  });
  blocks.forEach((block, index) => {
    if (block['type'] === 'text') {
      out += sse('content_block_start', {
        type: 'content_block_start',
        index,
        content_block: { type: 'text', text: '' },
      });
      for (const piece of String(block['text']).match(/.{1,5}/gs) ?? []) {
        out += sse('content_block_delta', {
          type: 'content_block_delta',
          index,
          delta: { type: 'text_delta', text: piece },
        });
      }
    } else {
      out += sse('content_block_start', {
        type: 'content_block_start',
        index,
        content_block: { ...block, input: {} },
      });
      out += sse('content_block_delta', {
        type: 'content_block_delta',
        index,
        delta: { type: 'input_json_delta', partial_json: JSON.stringify(block['input']) },
      });
    }
    out += sse('content_block_stop', { type: 'content_block_stop', index });
  });
  out += sse('message_delta', {
    type: 'message_delta',
    delta: { stop_reason: stop, stop_sequence: null },
    usage: { output_tokens: 20 },
  });
  return out + sse('message_stop', { type: 'message_stop' });
}

const anthropic: Provider = (steps) => {
  const queue = [...steps];
  const bodies: Array<Record<string, unknown>> = [];
  const fetch = async (_input: string | URL | Request, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    const step = queue.shift();
    if (!step) throw new Error('No more fake replies');
    if (step.kind === 'network') throw new TypeError('fetch failed');
    if (step.kind === 'status') {
      return new Response(
        JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'synthetic' } }),
        { status: step.status, headers: { 'content-type': 'application/json' } },
      );
    }
    const text = 'text' in step && step.text ? [{ type: 'text', text: step.text }] : [];
    const body =
      step.kind === 'say'
        ? anthropicStream([{ type: 'text', text: step.text }], 'end_turn')
        : step.kind === 'refuse'
          ? anthropicStream(text, 'refusal')
          : anthropicStream(
              [
                ...text,
                ...step.calls.map((c, i) => ({
                  type: 'tool_use',
                  id: `toolu_${bodies.length}_${i}`,
                  name: c.name,
                  input: c.input,
                })),
              ],
              'tool_use',
            );
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  };
  const client = new Anthropic({ apiKey: 'test-key', fetch, maxRetries: 0 });
  return {
    model: new AnthropicChatModel({ client, model: 'claude-test-model' }),
    sent: () =>
      bodies.map((body) => {
        const messages = body['messages'] as Array<{
          role: 'user' | 'assistant';
          content: unknown;
        }>;
        const last = messages.at(-1)?.content;
        return {
          system: (body['system'] as Array<{ text: string }>).map((s) => s.text),
          toolNames: (body['tools'] as Array<{ name: string }>).map((t) => t.name),
          turns: messages.flatMap((m) =>
            typeof m.content === 'string' ? [{ role: m.role, text: m.content }] : [],
          ),
          toolResults: Array.isArray(last)
            ? (last as Array<{ type: string; content: string; is_error: boolean }>)
                .filter((b) => b.type === 'tool_result')
                .map((b) => ({ content: b.content, isError: b.is_error }))
            : [],
        };
      }),
  };
};

// ── Gemini's fake: a fake fetch speaking streamGenerateContent's server-sent events ─────────

const geminiChunk = (data: unknown) => `data: ${JSON.stringify(data)}\r\n\r\n`;

const gemini: Provider = (steps) => {
  const queue = [...steps];
  const bodies: Array<Record<string, unknown>> = [];
  const fetch = async (_input: string | URL | Request, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    const step = queue.shift();
    if (!step) throw new Error('No more fake replies');
    if (step.kind === 'network') throw new TypeError('fetch failed');
    if (step.kind === 'status') {
      return new Response(
        JSON.stringify({
          error: { code: step.status, message: 'synthetic', status: 'UNAVAILABLE' },
        }),
        { status: step.status, headers: { 'content-type': 'application/json' } },
      );
    }
    const textChunks = (text: string | undefined) =>
      (text?.match(/.{1,5}/gs) ?? []).map((piece) =>
        geminiChunk({ candidates: [{ content: { role: 'model', parts: [{ text: piece }] } }] }),
      );
    let body: string;
    if (step.kind === 'say') {
      body =
        textChunks(step.text).join('') +
        geminiChunk({
          candidates: [{ content: { role: 'model', parts: [] }, finishReason: 'STOP' }],
        });
    } else if (step.kind === 'refuse') {
      body =
        textChunks(step.text).join('') +
        (step.text
          ? geminiChunk({ candidates: [{ finishReason: 'SAFETY' }] })
          : geminiChunk({ promptFeedback: { blockReason: 'SAFETY' } }));
    } else {
      body =
        textChunks(step.text).join('') +
        geminiChunk({
          candidates: [
            {
              content: {
                role: 'model',
                parts: step.calls.map((c, i) => ({
                  functionCall: { id: `call_${bodies.length}_${i}`, name: c.name, args: c.input },
                  ...(i === 0 ? { thoughtSignature: 'c2lnLXN5bnRoZXRpYw==' } : {}),
                })),
              },
              finishReason: 'STOP',
            },
          ],
        });
    }
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  };
  type Part = {
    text?: string;
    thought?: boolean;
    functionCall?: unknown;
    functionResponse?: { response: Record<string, unknown> };
  };
  return {
    model: new GeminiChatModel({ apiKey: 'test-key', model: 'gemini-test-model', fetch }),
    sent: () =>
      bodies.map((body) => {
        const contents = body['contents'] as Array<{ role: 'user' | 'model'; parts: Part[] }>;
        const last = contents.at(-1)?.parts ?? [];
        return {
          system: (body['systemInstruction'] as { parts: Array<{ text: string }> }).parts.map(
            (p) => p.text,
          ),
          toolNames: (
            body['tools'] as Array<{ functionDeclarations: Array<{ name: string }> }>
          ).flatMap((t) => t.functionDeclarations.map((d) => d.name)),
          turns: contents.flatMap((c) =>
            c.parts.every((p) => typeof p.text === 'string' && !p.thought)
              ? [
                  {
                    role: c.role === 'model' ? ('assistant' as const) : ('user' as const),
                    text: c.parts.map((p) => p.text).join(''),
                  },
                ]
              : [],
          ),
          toolResults: last
            .filter((p) => p.functionResponse)
            .map((p) => {
              const response = p.functionResponse?.response ?? {};
              return 'error' in response
                ? { content: String(response['error']), isError: true }
                : { content: JSON.stringify(response['output']), isError: false };
            }),
        };
      }),
  };
};

// ── The contract ────────────────────────────────────────────────────────────────────────────

function request(overrides: Partial<ModelRequest> = {}) {
  const deltas: string[] = [];
  const calls: Call[] = [];
  const req: ModelRequest = {
    system: 'THE STABLE CHARTER',
    context: 'Today is 2026-10-13. Per-request context.',
    history: [
      { role: 'user', text: 'Hi' },
      { role: 'assistant', text: 'Hello! How can I help?' },
      { role: 'user', text: 'What can I study?' },
    ],
    tools: TOOLS,
    onText: (delta) => deltas.push(delta),
    callTool: async (name, input) => {
      calls.push({ name, input });
      return { content: '{"ok":true}', isError: false };
    },
    ...overrides,
  };
  return { req, deltas, calls };
}

let consoleSpies: ReturnType<typeof vi.spyOn>[] = [];
beforeEach(() => {
  consoleSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => {}),
  );
});
afterEach(() => {
  // Hard rule 4: no adapter logs anything (a conversation is personal information).
  for (const spy of consoleSpies) expect(spy).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

const PROVIDERS: ReadonlyArray<[string, Provider]> = [
  ['AnthropicChatModel', anthropic],
  ['GeminiChatModel', gemini],
];

describe.each(PROVIDERS)('ChatModel contract: %s', (_name, provider) => {
  it('is a real model, not the stand-in', () => {
    expect(provider([]).model.isSample).toBe(false);
  });

  it('sends the charter, the context, every tool in order and the history, unchanged', async () => {
    const harness = provider([{ kind: 'say', text: 'Hello' }]);
    await harness.model.respond(request().req);
    const [sent] = harness.sent();
    expect(sent?.system).toEqual([
      'THE STABLE CHARTER',
      'Today is 2026-10-13. Per-request context.',
    ]);
    expect(sent?.toolNames).toEqual(TOOLS.map((t) => t.name));
    expect(sent?.turns).toEqual([
      { role: 'user', text: 'Hi' },
      { role: 'assistant', text: 'Hello! How can I help?' },
      { role: 'user', text: 'What can I study?' },
    ]);
  });

  it('streams a text answer in pieces and returns the whole of it', async () => {
    const answer = 'You could look at civil engineering or quantity surveying.';
    const harness = provider([{ kind: 'say', text: answer }]);
    const { req, deltas } = request();
    const response = await harness.model.respond(req);
    expect(deltas.length).toBeGreaterThan(1);
    expect(deltas.join('')).toBe(answer);
    expect(response).toEqual({ text: answer, refused: false });
  });

  it('runs a tool call through callTool, sends its result back, and answers', async () => {
    const harness = provider([
      {
        kind: 'calls',
        text: 'Let me check. ',
        calls: [{ name: 'deadlines', input: { university_ids: ['uct'] } }],
      },
      { kind: 'say', text: 'UCT closes soon.' },
    ]);
    const { req, deltas, calls } = request();
    const response = await harness.model.respond(req);

    expect(calls).toEqual([{ name: 'deadlines', input: { university_ids: ['uct'] } }]);
    expect(response).toEqual({ text: 'Let me check. UCT closes soon.', refused: false });
    expect(deltas.join('')).toBe('Let me check. UCT closes soon.');
    const sent = harness.sent();
    expect(sent).toHaveLength(2);
    expect(sent[1]?.toolResults).toEqual([{ content: '{"ok":true}', isError: false }]);
    // The charter and tools don't move between rounds.
    expect(sent[1]?.system).toEqual(sent[0]?.system);
    expect(sent[1]?.toolNames).toEqual(sent[0]?.toolNames);
  });

  it('answers parallel tool calls together, an invalid input flagged as an error', async () => {
    const harness = provider([
      {
        kind: 'calls',
        calls: [
          { name: 'deadlines', input: { university_ids: ['uct'] } },
          { name: 'remember', input: { nonsense: true } },
        ],
      },
      { kind: 'say', text: 'Done.' },
    ]);
    const { req } = request({
      callTool: async (name) =>
        name === 'remember'
          ? { content: 'Invalid input', isError: true }
          : { content: '{"ok":true}', isError: false },
    });
    await harness.model.respond(req);
    expect(harness.sent()[1]?.toolResults).toEqual([
      { content: '{"ok":true}', isError: false },
      { content: 'Invalid input', isError: true },
    ]);
  });

  it('reports a refusal (a blocked answer) as refused, never as an answer', async () => {
    const harness = provider([{ kind: 'refuse' }]);
    const response = await harness.model.respond(request().req);
    expect(response).toEqual({ text: '', refused: true });
  });

  it('reports a refusal that arrives mid-answer', async () => {
    const harness = provider([{ kind: 'refuse', text: 'Part of an' }]);
    const response = await harness.model.respond(request().req);
    expect(response.refused).toBe(true);
  });

  it.each([
    ['an overloaded server (529)', { kind: 'status', status: 529 }],
    ['a server error (500)', { kind: 'status', status: 500 }],
    ['a rate limit (429)', { kind: 'status', status: 429 }],
    ['a network failure', { kind: 'network' }],
  ] as const)('rejects on %s, as unavailable (another provider may answer)', async (_, step) => {
    const harness = provider([step]);
    const error = await harness.model.respond(request().req).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(isModelUnavailable(error)).toBe(true);
  });

  it('rejects on a bad request (400), not as unavailable: another provider would fail too', async () => {
    const harness = provider([{ kind: 'status', status: 400 }]);
    const error = await harness.model.respond(request().req).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(isModelUnavailable(error)).toBe(false);
  });

  describe('inside runTurn', () => {
    async function turn(steps: ReadonlyArray<Step>, message = 'When does UCT close?') {
      const harness = provider(steps);
      const { context } = fakeContext();
      const events: TurnEvent[] = [];
      const result = await runTurn({
        model: harness.model,
        context,
        history: [],
        message,
        emit: (e) => events.push(e),
      });
      const text = events.flatMap((e) => (e.type === 'text' ? [e.delta] : [])).join('');
      return { result, events, text, harness };
    }

    it('shows the artifact from a real tool call and streams the answer', async () => {
      const { result, events, text } = await turn([
        { kind: 'calls', calls: [{ name: 'deadlines', input: { university_ids: ['uct'] } }] },
        { kind: 'say', text: 'Here are the dates.' },
      ]);
      expect(result.failed).toBe(false);
      expect(text).toBe('Here are the dates.');
      expect(events.some((e) => e.type === 'artifact')).toBe(true);
    });

    it('sends invalid tool input back to the model as an error result', async () => {
      const { result, harness } = await turn([
        { kind: 'calls', calls: [{ name: 'deadlines', input: { university_ids: 42 } }] },
        { kind: 'say', text: 'Sorry, let me try again.' },
      ]);
      expect(result.failed).toBe(false);
      expect(harness.sent()[1]?.toolResults[0]?.isError).toBe(true);
    });

    it('answers a refusal with the kind fallback message', async () => {
      const { result, text } = await turn([{ kind: 'refuse' }]);
      expect(result.failed).toBe(true);
      expect(text).toBe(en.chat.error);
    });

    it('answers a mid-answer refusal on a new paragraph after what was streamed', async () => {
      const { result, text } = await turn([{ kind: 'refuse', text: 'Part of an' }]);
      expect(result.failed).toBe(true);
      expect(text).toBe(`Part of an\n\n${en.chat.error}`);
    });

    it('answers an outage with the error message', async () => {
      const { result, text } = await turn([{ kind: 'status', status: 503 }]);
      expect(result.failed).toBe(true);
      expect(text).toBe(en.chat.error);
    });

    it('never calls the model in a crisis: the reviewed reply and the helplines answer', async () => {
      const { result, harness, events } = await turn([], 'I want to kill myself');
      expect(result.distress).toBe('crisis');
      expect(harness.sent()).toHaveLength(0);
      expect(events.some((e) => e.type === 'artifact' && e.artifact.kind === 'crisis-card')).toBe(
        true,
      );
    });
  });
});
