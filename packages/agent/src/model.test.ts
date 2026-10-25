import Anthropic from '@anthropic-ai/sdk';
import { en } from '@universityflow/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnthropicChatModel, MAX_TOOL_ROUNDS, ModelError, type ModelRequest } from './model';
import { runTurn, type TurnEvent } from './runner';
import { fakeContext } from './testing';
import { TOOLS } from './tools';

/**
 * A1-07: `AnthropicChatModel` against a fake Anthropic API. The client is the real SDK, so its
 * request building and stream parsing run too; only `fetch` is replaced, answering with
 * server-sent events. No network, no key. Every conversation here is synthetic.
 */

const MODEL = 'claude-test-model';

// ── The fake API ────────────────────────────────────────────────────────────────────────────

type Block =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string; signature: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | {
      type: 'fallback';
      from: { model: string };
      to: { model: string };
      trigger: { type: 'refusal'; category: null };
    };

type StreamReply = {
  blocks: Block[];
  stopReason: string;
  /** Cut the stream after this many content blocks with an `error` event. */
  errorAfter?: number;
};
type Reply = StreamReply | { status: number } | Error;

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

function streamBody(reply: StreamReply): string {
  let out = sse('message_start', {
    type: 'message_start',
    message: {
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      model: MODEL,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 1 },
    },
  });
  reply.blocks.forEach((block, index) => {
    if (reply.errorAfter !== undefined && index >= reply.errorAfter) return;
    if (block.type === 'text') {
      out += sse('content_block_start', {
        type: 'content_block_start',
        index,
        content_block: { type: 'text', text: '' },
      });
      // Several deltas per block, as the API sends them.
      for (const piece of block.text.match(/.{1,5}/gs) ?? []) {
        out += sse('content_block_delta', {
          type: 'content_block_delta',
          index,
          delta: { type: 'text_delta', text: piece },
        });
      }
    } else if (block.type === 'thinking') {
      out += sse('content_block_start', {
        type: 'content_block_start',
        index,
        content_block: { type: 'thinking', thinking: '', signature: '' },
      });
      out += sse('content_block_delta', {
        type: 'content_block_delta',
        index,
        delta: { type: 'thinking_delta', thinking: block.thinking },
      });
      out += sse('content_block_delta', {
        type: 'content_block_delta',
        index,
        delta: { type: 'signature_delta', signature: block.signature },
      });
    } else if (block.type === 'fallback') {
      // No deltas: the block arrives whole, like a server-tool block.
      out += sse('content_block_start', {
        type: 'content_block_start',
        index,
        content_block: block,
      });
    } else {
      out += sse('content_block_start', {
        type: 'content_block_start',
        index,
        content_block: { type: 'tool_use', id: block.id, name: block.name, input: {} },
      });
      const json = JSON.stringify(block.input);
      const half = Math.floor(json.length / 2);
      for (const partial of [json.slice(0, half), json.slice(half)]) {
        out += sse('content_block_delta', {
          type: 'content_block_delta',
          index,
          delta: { type: 'input_json_delta', partial_json: partial },
        });
      }
    }
    out += sse('content_block_stop', { type: 'content_block_stop', index });
  });
  if (reply.errorAfter !== undefined) {
    return (
      out +
      sse('error', {
        type: 'error',
        error: { type: 'overloaded_error', message: 'Overloaded' },
      })
    );
  }
  out += sse('message_delta', {
    type: 'message_delta',
    delta: { stop_reason: reply.stopReason, stop_sequence: null },
    usage: { output_tokens: 20 },
  });
  return out + sse('message_stop', { type: 'message_stop' });
}

interface Captured {
  url: string;
  headers: Headers;
  body: {
    model: string;
    max_tokens: number;
    stream: boolean;
    fallbacks: unknown;
    output_config: { effort: string };
    system: Array<{ type: string; text: string; cache_control?: unknown }>;
    tools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>;
    messages: Array<{ role: string; content: unknown }>;
  };
}

function fakeApi(...replies: Reply[]) {
  const requests: Captured[] = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    // Snapshot the body now: the model mutates its message list after each round.
    requests.push({
      url: String(input),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body)),
    });
    const reply = replies.shift();
    if (!reply) throw new Error('No more fake replies');
    if (reply instanceof Error) throw reply;
    if ('status' in reply) {
      return new Response(
        JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'synthetic' } }),
        { status: reply.status, headers: { 'content-type': 'application/json' } },
      );
    }
    return new Response(streamBody(reply), {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
  };
  const client = new Anthropic({ apiKey: 'test-key', fetch, maxRetries: 0 });
  return { client, requests };
}

const say = (text: string, stopReason = 'end_turn'): StreamReply => ({
  blocks: [{ type: 'text', text }],
  stopReason,
});

function request(overrides: Partial<ModelRequest> = {}) {
  const deltas: string[] = [];
  const calls: Array<{ name: string; input: unknown }> = [];
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
  // Hard rule 4: the adapter logs nothing (a conversation is personal information).
  for (const spy of consoleSpies) expect(spy).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

// ── The request ─────────────────────────────────────────────────────────────────────────────

describe('AnthropicChatModel: the request', () => {
  it('streams from the configured model with the refusal fallback on', async () => {
    const { client, requests } = fakeApi(say('Hello'));
    const model = new AnthropicChatModel({ client, model: MODEL });
    expect(model.isSample).toBe(false);
    await model.respond(request().req);

    const [captured] = requests;
    expect(captured?.url).toMatch(/\/v1\/messages\?beta=true$/);
    expect(captured?.headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect(captured?.body).toMatchObject({
      model: MODEL,
      max_tokens: 16000,
      stream: true,
      fallbacks: 'default',
      output_config: { effort: 'medium' },
    });
  });

  it('uses the configured effort', async () => {
    const { client, requests } = fakeApi(say('Hello'));
    await new AnthropicChatModel({ client, model: MODEL, effort: 'high' }).respond(request().req);
    expect(requests[0]?.body.output_config).toEqual({ effort: 'high' });
  });

  it('caches the charter (and the tools before it), never the per-request context', async () => {
    const { client, requests } = fakeApi(say('Hello'));
    await new AnthropicChatModel({ client, model: MODEL }).respond(request().req);

    expect(requests[0]?.body.system).toEqual([
      { type: 'text', text: 'THE STABLE CHARTER', cache_control: { type: 'ephemeral' } },
      { type: 'text', text: 'Today is 2026-10-13. Per-request context.' },
    ]);
  });

  it('sends every tool, in order, with a JSON schema', async () => {
    const { client, requests } = fakeApi(say('Hello'));
    await new AnthropicChatModel({ client, model: MODEL }).respond(request().req);

    const tools = requests[0]?.body.tools ?? [];
    expect(tools.map((t) => t.name)).toEqual(TOOLS.map((t) => t.name));
    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.input_schema['type']).toBe('object');
    }
  });

  it('sends a byte-identical cached prefix on every request (tools and charter)', async () => {
    const { client, requests } = fakeApi(say('One'), say('Two'));
    const model = new AnthropicChatModel({ client, model: MODEL });
    await model.respond(request().req);
    await model.respond(request({ context: 'A different day.' }).req);

    const prefix = (c?: Captured) => JSON.stringify([c?.body.tools, c?.body.system[0]]);
    expect(prefix(requests[1])).toBe(prefix(requests[0]));
  });

  it('sends the history as alternating turns, ending with the new message', async () => {
    const { client, requests } = fakeApi(say('Hello'));
    await new AnthropicChatModel({ client, model: MODEL }).respond(request().req);
    expect(requests[0]?.body.messages).toEqual([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello! How can I help?' },
      { role: 'user', content: 'What can I study?' },
    ]);
  });
});

// ── Streaming and tools ─────────────────────────────────────────────────────────────────────

describe('AnthropicChatModel: streaming', () => {
  it('passes text deltas through as they arrive and returns the whole answer', async () => {
    const answer = 'You could look at civil engineering or quantity surveying.';
    const { client } = fakeApi(say(answer));
    const { req, deltas } = request();

    const response = await new AnthropicChatModel({ client, model: MODEL }).respond(req);

    expect(deltas.length).toBeGreaterThan(1);
    expect(deltas.join('')).toBe(answer);
    expect(response).toEqual({ text: answer, refused: false });
  });

  it('runs a tool call through callTool and sends the result back', async () => {
    const thinking = { type: 'thinking', thinking: '', signature: 'sig-synthetic' } as const;
    const { client, requests } = fakeApi(
      {
        blocks: [
          thinking,
          { type: 'text', text: 'Let me check. ' },
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'deadlines',
            input: { university_ids: ['uct'] },
          },
        ],
        stopReason: 'tool_use',
      },
      say('UCT closes soon.'),
    );
    const { req, deltas, calls } = request();

    const response = await new AnthropicChatModel({ client, model: MODEL }).respond(req);

    // The input, streamed in pieces, arrives whole and parsed.
    expect(calls).toEqual([{ name: 'deadlines', input: { university_ids: ['uct'] } }]);
    expect(response).toEqual({ text: 'Let me check. UCT closes soon.', refused: false });
    expect(deltas.join('')).toBe('Let me check. UCT closes soon.');

    expect(requests).toHaveLength(2);
    const followUp = requests[1]?.body.messages ?? [];
    expect(followUp.slice(0, 3)).toEqual(requests[0]?.body.messages);
    // The assistant turn goes back unchanged, thinking signature included.
    expect(followUp[3]).toEqual({
      role: 'assistant',
      content: [
        thinking,
        { type: 'text', text: 'Let me check. ' },
        { type: 'tool_use', id: 'toolu_1', name: 'deadlines', input: { university_ids: ['uct'] } },
      ],
    });
    expect(followUp[4]).toEqual({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 'toolu_1', content: '{"ok":true}', is_error: false },
      ],
    });
    // The cached prefix doesn't move between rounds.
    expect(requests[1]?.body.system).toEqual(requests[0]?.body.system);
    expect(requests[1]?.body.tools).toEqual(requests[0]?.body.tools);
  });

  it('answers parallel tool calls in one user turn, errors flagged', async () => {
    const { client, requests } = fakeApi(
      {
        blocks: [
          {
            type: 'tool_use',
            id: 'toolu_a',
            name: 'deadlines',
            input: { university_ids: ['uct'] },
          },
          { type: 'tool_use', id: 'toolu_b', name: 'remember', input: { nonsense: true } },
        ],
        stopReason: 'tool_use',
      },
      say('Done.'),
    );
    const { req } = request({
      callTool: async (name) =>
        name === 'remember'
          ? { content: 'Invalid input', isError: true }
          : { content: '{"ok":true}', isError: false },
    });

    await new AnthropicChatModel({ client, model: MODEL }).respond(req);

    expect(requests[1]?.body.messages.at(-1)).toEqual({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 'toolu_a', content: '{"ok":true}', is_error: false },
        { type: 'tool_result', tool_use_id: 'toolu_b', content: 'Invalid input', is_error: true },
      ],
    });
  });

  it('refuses a tool call cut off at max_tokens rather than running it', async () => {
    const { client } = fakeApi({
      blocks: [{ type: 'tool_use', id: 'toolu_1', name: 'deadlines', input: { u: 1 } }],
      stopReason: 'max_tokens',
    });
    const { req, calls } = request();
    await expect(
      new AnthropicChatModel({ client, model: MODEL }).respond(req),
    ).rejects.toBeInstanceOf(ModelError);
    expect(calls).toHaveLength(0);
  });

  it(`stops after ${MAX_TOOL_ROUNDS} rounds of tool calls`, async () => {
    const toolRound: StreamReply = {
      blocks: [{ type: 'tool_use', id: 'toolu_x', name: 'deadlines', input: {} }],
      stopReason: 'tool_use',
    };
    const { client, requests } = fakeApi(
      ...Array.from({ length: MAX_TOOL_ROUNDS + 1 }, () => toolRound),
    );
    const { req, calls } = request();
    await expect(
      new AnthropicChatModel({ client, model: MODEL }).respond(req),
    ).rejects.toBeInstanceOf(ModelError);
    expect(requests).toHaveLength(MAX_TOOL_ROUNDS + 1);
    expect(calls).toHaveLength(MAX_TOOL_ROUNDS);
  });
});

// ── Refusals and failures ───────────────────────────────────────────────────────────────────

describe('AnthropicChatModel: refusals and failures', () => {
  it('reports a refusal (after the server-side fallback also declined)', async () => {
    const { client } = fakeApi({ blocks: [], stopReason: 'refusal' });
    const response = await new AnthropicChatModel({ client, model: MODEL }).respond(request().req);
    expect(response).toEqual({ text: '', refused: true });
  });

  it('reports a refusal that arrives mid-answer', async () => {
    const { client } = fakeApi(say('Part of an', 'refusal'));
    const response = await new AnthropicChatModel({ client, model: MODEL }).respond(request().req);
    expect(response.refused).toBe(true);
  });

  it('streams the fallback model on when the first model declines before answering', async () => {
    const { client } = fakeApi({
      blocks: [
        {
          type: 'fallback',
          from: { model: MODEL },
          to: { model: 'claude-fallback' },
          trigger: { type: 'refusal', category: null },
        },
        { type: 'text', text: 'Here is a kind answer.' },
      ],
      stopReason: 'end_turn',
    });
    const { req, deltas } = request();
    const response = await new AnthropicChatModel({ client, model: MODEL }).respond(req);
    expect(response).toEqual({
      text: 'Here is a kind answer.',
      refused: false,
      // A10-49: the reply says which model wrote it, the fallback here, not the one asked.
      writtenBy: { provider: 'anthropic', model: 'claude-fallback' },
    });
    expect(deltas.join('')).toBe('Here is a kind answer.');
  });

  it('says the requested model wrote a reply with no fallback (A10-49)', async () => {
    const { client } = fakeApi(say('A plain answer.'));
    const model = new AnthropicChatModel({ client, model: MODEL });
    const response = await model.respond(request().req);
    expect(response.writtenBy ?? model.writer).toEqual({ provider: 'anthropic', model: MODEL });
  });

  it('says the fallback model wrote a reply that fell back in an earlier tool round (A10-49)', async () => {
    const { client } = fakeApi(
      {
        blocks: [
          {
            type: 'fallback',
            from: { model: MODEL },
            to: { model: 'claude-fallback' },
            trigger: { type: 'refusal', category: null },
          },
          { type: 'tool_use', id: 'toolu_1', name: 'deadlines', input: {} },
        ],
        stopReason: 'tool_use',
      },
      say('Done.'),
    );
    const response = await new AnthropicChatModel({ client, model: MODEL }).respond(request().req);
    expect(response.writtenBy).toEqual({ provider: 'anthropic', model: 'claude-fallback' });
  });

  it('after a mid-answer fallback, runs only the fallback model’s tool calls', async () => {
    const fallback = {
      type: 'fallback',
      from: { model: MODEL },
      to: { model: 'claude-fallback' },
      trigger: { type: 'refusal', category: null },
    } as const;
    const { client, requests } = fakeApi(
      {
        blocks: [
          { type: 'thinking', thinking: '', signature: 'sig-declined' },
          { type: 'text', text: 'Let me ' },
          { type: 'tool_use', id: 'toolu_declined', name: 'remember', input: { x: 1 } },
          fallback,
          { type: 'thinking', thinking: '', signature: 'sig-fallback' },
          {
            type: 'tool_use',
            id: 'toolu_ok',
            name: 'deadlines',
            input: { university_ids: ['uct'] },
          },
        ],
        stopReason: 'tool_use',
      },
      say('Done.'),
    );
    const { req, calls } = request();

    await new AnthropicChatModel({ client, model: MODEL }).respond(req);

    // The declined attempt's tool call never runs.
    expect(calls).toEqual([{ name: 'deadlines', input: { university_ids: ['uct'] } }]);
    // Echoed back: the declined attempt's text only, then everything from the hand-over on.
    expect(requests[1]?.body.messages[3]).toEqual({
      role: 'assistant',
      content: [
        { type: 'text', text: 'Let me ' },
        fallback,
        { type: 'thinking', thinking: '', signature: 'sig-fallback' },
        { type: 'tool_use', id: 'toolu_ok', name: 'deadlines', input: { university_ids: ['uct'] } },
      ],
    });
    expect(requests[1]?.body.messages[4]).toEqual({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 'toolu_ok', content: '{"ok":true}', is_error: false },
      ],
    });
  });

  it('rejects when the stream breaks mid-answer, keeping what was streamed', async () => {
    const { client } = fakeApi({
      blocks: [
        { type: 'text', text: 'Half an answer' },
        { type: 'text', text: 'never sent' },
      ],
      stopReason: 'end_turn',
      errorAfter: 1,
    });
    const { req, deltas } = request();
    await expect(new AnthropicChatModel({ client, model: MODEL }).respond(req)).rejects.toThrow(
      Anthropic.APIError,
    );
    expect(deltas.join('')).toBe('Half an answer');
  });

  it('rejects on an API error status and on a network failure', async () => {
    for (const reply of [{ status: 529 }, { status: 429 }, new TypeError('fetch failed')]) {
      const { client } = fakeApi(reply);
      await expect(
        new AnthropicChatModel({ client, model: MODEL }).respond(request().req),
      ).rejects.toBeInstanceOf(Anthropic.AnthropicError);
    }
  });
});

// ── Through the runner ──────────────────────────────────────────────────────────────────────

const lastToolResult = (captured?: Captured) =>
  (captured?.body.messages.at(-1)?.content as Array<{ is_error: boolean }> | undefined)?.[0];

describe('AnthropicChatModel inside runTurn', () => {
  async function turn(...replies: Reply[]) {
    const { client, requests } = fakeApi(...replies);
    const { context } = fakeContext();
    const events: TurnEvent[] = [];
    const result = await runTurn({
      model: new AnthropicChatModel({ client, model: MODEL }),
      context,
      history: [],
      message: 'When does UCT close?',
      emit: (e) => events.push(e),
    });
    const text = events.flatMap((e) => (e.type === 'text' ? [e.delta] : [])).join('');
    return { result, events, text, requests };
  }

  it('streams the answer and shows the artifact from a real tool call', async () => {
    const { result, events, text, requests } = await turn(
      {
        blocks: [
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'deadlines',
            input: { university_ids: ['uct'] },
          },
        ],
        stopReason: 'tool_use',
      },
      say('Here are the dates.'),
    );
    expect(result.failed).toBe(false);
    expect(text).toBe('Here are the dates.');
    expect(events.some((e) => e.type === 'artifact')).toBe(true);
    expect(lastToolResult(requests[1])?.is_error).toBe(false);
  });

  it('sends invalid tool input back to the model as an error result', async () => {
    const { result, requests } = await turn(
      {
        blocks: [
          { type: 'tool_use', id: 'toolu_1', name: 'deadlines', input: { university_ids: 42 } },
        ],
        stopReason: 'tool_use',
      },
      say('Sorry, let me try again.'),
    );
    expect(result.failed).toBe(false);
    expect(lastToolResult(requests[1])?.is_error).toBe(true);
  });

  it('answers a refusal with the kind fallback message', async () => {
    const { result, text } = await turn({ blocks: [], stopReason: 'refusal' });
    expect(result.failed).toBe(true);
    expect(text).toBe(en.chat.error);
  });

  it('answers a mid-answer refusal on a new paragraph after what was streamed', async () => {
    const { result, text } = await turn(say('Part of an', 'refusal'));
    expect(result.failed).toBe(true);
    expect(text).toBe(`Part of an\n\n${en.chat.error}`);
    expect(result.text).toBe(text);
  });

  it('answers a broken stream with the error message after what was streamed', async () => {
    const { result, text } = await turn({
      blocks: [{ type: 'text', text: 'Half' }],
      stopReason: 'end_turn',
      errorAfter: 1,
    });
    expect(result.failed).toBe(true);
    expect(text).toBe(`Half\n\n${en.chat.error}`);
  });

  it('answers an API outage with the error message', async () => {
    const { result, text } = await turn({ status: 529 });
    expect(result.failed).toBe(true);
    expect(text).toBe(en.chat.error);
  });
});
