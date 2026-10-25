import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GEMINI_DEFAULT_MODEL, GeminiChatModel } from './gemini-model';
import { isModelUnavailable, MAX_TOOL_ROUNDS, ModelError, type ModelRequest } from './model';
import { TOOLS } from './tools';

/**
 * What only Gemini's adapter does, against a fake Gemini API (the shared behaviour is in
 * model-contract.test.ts). No network, no key: the key here is a placeholder. Synthetic only.
 */

const KEY = 'test-gemini-key-not-real';

type Part = Record<string, unknown>;
type Chunk = Record<string, unknown>;
type Reply = { chunks: Chunk[] } | { raw: string } | { status: number } | Error;

const event = (data: unknown) => `data: ${JSON.stringify(data)}\r\n\r\n`;
const parts = (p: Part[], finishReason?: string): Chunk => ({
  candidates: [{ content: { role: 'model', parts: p }, ...(finishReason ? { finishReason } : {}) }],
});

interface Captured {
  url: string;
  headers: Headers;
  body: {
    systemInstruction: { parts: Array<{ text: string }> };
    tools: Array<{ functionDeclarations: Array<Record<string, unknown>> }>;
    contents: Array<{ role: string; parts: Part[] }>;
    generationConfig: Record<string, unknown>;
  };
  signal: AbortSignal | null | undefined;
}

function fakeApi(...replies: Reply[]) {
  const requests: Captured[] = [];
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({
      url: String(input),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body)),
      signal: init?.signal,
    });
    const reply = replies.shift();
    if (!reply) throw new Error('No more fake replies');
    if (reply instanceof Error) throw reply;
    if ('status' in reply) return new Response('{"error":{}}', { status: reply.status });
    const body = 'raw' in reply ? reply.raw : reply.chunks.map(event).join('');
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  }) as typeof globalThis.fetch;
  return {
    model: new GeminiChatModel({ apiKey: KEY, model: 'gemini-test-model', fetch }),
    requests,
  };
}

function request(overrides: Partial<ModelRequest> = {}) {
  const deltas: string[] = [];
  const calls: Array<{ name: string; input: unknown }> = [];
  const req: ModelRequest = {
    system: 'THE STABLE CHARTER',
    context: 'Per-request context.',
    history: [{ role: 'user', text: 'What can I study?' }],
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
  for (const spy of consoleSpies) expect(spy).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

describe('GeminiChatModel: the request', () => {
  it('streams from the configured model, the key in a header and never in the URL', async () => {
    const { model, requests } = fakeApi({ chunks: [parts([{ text: 'Hi' }], 'STOP')] });
    await model.respond(request().req);
    const [captured] = requests;
    expect(captured?.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-test-model:streamGenerateContent?alt=sse',
    );
    expect(captured?.url).not.toContain(KEY);
    expect(captured?.headers.get('x-goog-api-key')).toBe(KEY);
    expect(captured?.signal).toBeInstanceOf(AbortSignal);
    expect(captured?.body.generationConfig).toEqual({ maxOutputTokens: 16000 });
  });

  it('turns Gemini’s own safety filters on, which are off by default, for every request (A10-45)', async () => {
    const { model, requests } = fakeApi(
      { chunks: [parts([{ functionCall: { name: 'my_results', args: {} } }], 'STOP')] },
      { chunks: [parts([{ text: 'Done' }], 'STOP')] },
    );
    await model.respond(request().req);
    expect(requests).toHaveLength(2);
    for (const captured of requests) {
      const settings = (captured.body as unknown as { safetySettings?: unknown }).safetySettings;
      // Learners from 14: sexual content blocked at the lowest level, the rest from medium.
      expect(settings).toEqual([
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      ]);
    }
  });

  it('declares every tool with its JSON schema, without the $schema marker', async () => {
    const { model, requests } = fakeApi({ chunks: [parts([{ text: 'Hi' }], 'STOP')] });
    await model.respond(request().req);
    const declarations = requests[0]?.body.tools[0]?.functionDeclarations ?? [];
    expect(declarations).toHaveLength(TOOLS.length);
    for (const d of declarations) {
      const schema = d['parametersJsonSchema'] as Record<string, unknown>;
      expect(schema['type']).toBe('object');
      expect(schema).not.toHaveProperty('$schema');
      expect(String(d['description']).length).toBeGreaterThan(0);
    }
  });

  it('sends the assistant’s turns as the model’s role', async () => {
    const { model, requests } = fakeApi({ chunks: [parts([{ text: 'Hi' }], 'STOP')] });
    await model.respond(
      request({
        history: [
          { role: 'user', text: 'Hi' },
          { role: 'assistant', text: 'Hello!' },
          { role: 'user', text: 'Help me' },
        ],
      }).req,
    );
    expect(requests[0]?.body.contents.map((c) => c.role)).toEqual(['user', 'model', 'user']);
  });

  it('sends a byte-identical prefix (tools and charter) on every request', async () => {
    const { model, requests } = fakeApi(
      { chunks: [parts([{ text: 'One' }], 'STOP')] },
      { chunks: [parts([{ text: 'Two' }], 'STOP')] },
    );
    await model.respond(request().req);
    await model.respond(request({ context: 'A different day.' }).req);
    const prefix = (c?: Captured) =>
      JSON.stringify([c?.body.tools, c?.body.systemInstruction.parts[0]]);
    expect(prefix(requests[1])).toBe(prefix(requests[0]));
  });

  it('uses the documented stable model by default', () => {
    expect(GEMINI_DEFAULT_MODEL).toMatch(/^gemini-[\d.]+-[a-z-]+$/);
  });

  it('refuses to be made without a key', () => {
    expect(() => new GeminiChatModel({ apiKey: '', model: 'm' })).toThrow(ModelError);
  });
});

describe('GeminiChatModel: tools and thoughts', () => {
  it('echoes the model’s turn exactly, thought signature included, and answers by call id', async () => {
    const call = {
      functionCall: { id: 'call_1', name: 'deadlines', args: { university_ids: ['uct'] } },
      thoughtSignature: 'c2lnLXN5bnRoZXRpYw==',
    };
    const { model, requests } = fakeApi(
      { chunks: [parts([{ text: 'Let me check. ' }]), parts([call], 'STOP')] },
      { chunks: [parts([{ text: 'Soon.' }], 'STOP')] },
    );
    await model.respond(request().req);
    const followUp = requests[1]?.body.contents ?? [];
    expect(followUp[1]).toEqual({ role: 'model', parts: [{ text: 'Let me check. ' }, call] });
    expect(followUp[2]).toEqual({
      role: 'user',
      parts: [
        {
          functionResponse: { id: 'call_1', name: 'deadlines', response: { output: { ok: true } } },
        },
      ],
    });
  });

  it('answers a call without an id by name, and passes a non-JSON result as text', async () => {
    const { model, requests } = fakeApi(
      { chunks: [parts([{ functionCall: { name: 'deadlines' } }], 'STOP')] },
      { chunks: [parts([{ text: 'Done.' }], 'STOP')] },
    );
    const { req, calls } = request({
      callTool: async (name, input) => {
        calls.push({ name, input });
        return { content: 'plain words', isError: false };
      },
    });
    await model.respond(req);
    expect(calls).toEqual([{ name: 'deadlines', input: {} }]);
    expect(requests[1]?.body.contents[2]?.parts).toEqual([
      { functionResponse: { name: 'deadlines', response: { output: 'plain words' } } },
    ]);
  });

  it('never streams the model’s thoughts to the learner', async () => {
    const { model } = fakeApi({
      chunks: [parts([{ text: 'private reasoning', thought: true }, { text: 'Answer.' }], 'STOP')],
    });
    const { req, deltas } = request();
    const response = await model.respond(req);
    expect(deltas).toEqual(['Answer.']);
    expect(response.text).toBe('Answer.');
  });

  it('refuses a tool call cut off at MAX_TOKENS rather than running it', async () => {
    const { model } = fakeApi({
      chunks: [parts([{ functionCall: { name: 'deadlines', args: {} } }], 'MAX_TOKENS')],
    });
    const { req, calls } = request();
    await expect(model.respond(req)).rejects.toBeInstanceOf(ModelError);
    expect(calls).toHaveLength(0);
  });

  it('keeps a text answer that reached MAX_TOKENS, as Anthropic’s adapter does', async () => {
    const { model } = fakeApi({ chunks: [parts([{ text: 'Long answer' }], 'MAX_TOKENS')] });
    expect(await model.respond(request().req)).toEqual({ text: 'Long answer', refused: false });
  });

  it.each([
    'MALFORMED_FUNCTION_CALL',
    'MISSING_THOUGHT_SIGNATURE',
    'UNEXPECTED_TOOL_CALL',
    'OTHER',
  ])('fails on a %s ending, never running a call', async (reason) => {
    const { model } = fakeApi({
      chunks: [parts([{ functionCall: { name: 'deadlines', args: {} } }], reason)],
    });
    const { req, calls } = request();
    const error = await model.respond(req).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ModelError);
    expect(isModelUnavailable(error)).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it(`stops after ${MAX_TOOL_ROUNDS} rounds of tool calls`, async () => {
    const round = { chunks: [parts([{ functionCall: { name: 'deadlines', args: {} } }], 'STOP')] };
    const { model, requests } = fakeApi(
      ...Array.from({ length: MAX_TOOL_ROUNDS + 1 }, () => round),
    );
    const { req, calls } = request();
    await expect(model.respond(req)).rejects.toBeInstanceOf(ModelError);
    expect(requests).toHaveLength(MAX_TOOL_ROUNDS + 1);
    expect(calls).toHaveLength(MAX_TOOL_ROUNDS);
  });
});

describe('GeminiChatModel: refusals and failures', () => {
  // ESCALATION: "filtered by an escalation rule", a safety filter too (S1-A10b, A10-51).
  it.each(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION', 'ESCALATION'])(
    'reports a candidate finished on %s as refused',
    async (reason) => {
      const { model } = fakeApi({ chunks: [{ candidates: [{ finishReason: reason }] }] });
      expect(await model.respond(request().req)).toEqual({ text: '', refused: true });
    },
  );

  it('reports a blocked prompt as refused, never running a call', async () => {
    const { model } = fakeApi({
      chunks: [
        {
          promptFeedback: { blockReason: 'PROHIBITED_CONTENT' },
          ...parts([{ functionCall: { name: 'remember', args: {} } }], 'STOP'),
        },
      ],
    });
    const { req, calls } = request();
    expect((await model.respond(req)).refused).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('fails when the stream ends without a finish, keeping what was streamed', async () => {
    const { model } = fakeApi({ chunks: [parts([{ text: 'Half an answer' }])] });
    const { req, deltas } = request();
    await expect(model.respond(req)).rejects.toBeInstanceOf(ModelError);
    expect(deltas.join('')).toBe('Half an answer');
  });

  it('fails on an error event in the stream, unavailable when it is a server error', async () => {
    for (const [code, isUnavailable] of [
      [503, true],
      [400, false],
    ] as const) {
      const { model } = fakeApi({ chunks: [parts([{ text: 'Half' }]), { error: { code } }] });
      const error = await model.respond(request().req).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ModelError);
      expect(isModelUnavailable(error)).toBe(isUnavailable);
    }
  });

  it('fails on an unreadable event', async () => {
    const { model } = fakeApi({ raw: 'data: {not json\r\n\r\n' });
    await expect(model.respond(request().req)).rejects.toBeInstanceOf(ModelError);
  });

  it('reads events split across network reads and LF line endings', async () => {
    const body = `data: ${JSON.stringify(parts([{ text: 'Hello there' }], 'STOP'))}\n\n`;
    const half = Math.floor(body.length / 2);
    const fetch = (async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(body.slice(0, half)));
            controller.enqueue(encoder.encode(body.slice(half)));
            controller.close();
          },
        }),
        { status: 200 },
      )) as typeof globalThis.fetch;
    const model = new GeminiChatModel({ apiKey: KEY, model: 'm', fetch });
    expect(await model.respond(request().req)).toEqual({ text: 'Hello there', refused: false });
  });

  it('counts a stream that breaks mid-read as unavailable', async () => {
    const fetch = (async () =>
      new Response(
        new ReadableStream({
          pull(controller) {
            controller.error(new Error('connection reset'));
          },
        }),
        { status: 200 },
      )) as typeof globalThis.fetch;
    const model = new GeminiChatModel({ apiKey: KEY, model: 'm', fetch });
    const error = await model.respond(request().req).catch((e: unknown) => e);
    expect(isModelUnavailable(error)).toBe(true);
  });

  it('never puts the key, the prompt or the cause in an error message', async () => {
    for (const reply of [{ status: 500 }, { status: 403 }, new TypeError(`fetch failed ${KEY}`)]) {
      const { model } = fakeApi(reply);
      const error = (await model.respond(request().req).catch((e: unknown) => e)) as Error;
      expect(error.message).not.toContain(KEY);
      expect(error.message).not.toContain('What can I study?');
      expect(error.message).not.toContain('fetch failed');
    }
  });
});
