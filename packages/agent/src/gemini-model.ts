import { z } from 'zod';
import {
  type ChatModel,
  MAX_TOOL_ROUNDS,
  ModelError,
  type ModelRequest,
  type ModelResponse,
  ModelUnavailableError,
  type ReplyWriter,
} from './model';
import type { Tool } from './tools';

/**
 * Google Gemini as the chat model (owner's decision of 2026-10-23: the judge demo first). It
 * implements the same `ChatModel` contract as `AnthropicChatModel` (model-contract.test.ts), so
 * the runner, the crisis check, care and every safety rule behave the same: it is sent the same
 * charter, context, history and tools, and nothing else.
 *
 * The REST API over `fetch`, no SDK. Checked against Google's documentation on 2026-10-23:
 * - streamGenerateContent, `POST {base}/v1beta/models/{model}:streamGenerateContent?alt=sse`,
 *   the key in the `x-goog-api-key` header (never in the URL), `contents` with roles `user` and
 *   `model`, `systemInstruction`, `tools[].functionDeclarations`, the `FinishReason` and
 *   `BlockReason` enums: https://ai.google.dev/api/generate-content
 * - function calling (`functionCall` parts back, `functionResponse` parts in a `user` turn):
 *   https://ai.google.dev/gemini-api/docs/function-calling
 * - thought signatures: the model's `functionCall` parts must go back exactly as received, or
 *   the request is refused (400): https://ai.google.dev/gemini-api/docs/generate-content/thought-signatures
 * - the stable model id (`GEMINI_DEFAULT_MODEL`, recommended there for new projects):
 *   https://ai.google.dev/gemini-api/docs/models
 *
 * Differences from Anthropic, each mapped to the same outcome:
 * - No server-side refusal fallback: a safety block (`promptFeedback.blockReason`, or a
 *   candidate finishing on SAFETY and its kin) is reported as `refused`, and the runner answers.
 * - No prompt-cache marker: Gemini caches implicitly. The charter and tools still go first and
 *   byte-identical on every request.
 * - A rate limit, a server error or no connection is `ModelUnavailableError`, so another
 *   provider may answer (`FallbackChatModel`).
 *
 * Nothing here logs, and no error message carries the key, the prompt or the answer (hard rule 4).
 */

/** Recommended by Google for new projects (models page, 2026-10-23). Overridden by GEMINI_MODEL. */
export const GEMINI_DEFAULT_MODEL = 'gemini-3.8-flash';
export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export interface GeminiChatModelOptions {
  readonly apiKey: string;
  readonly model: string;
  /** Tests pass a fake; the real one otherwise. */
  readonly fetch?: typeof fetch;
  readonly baseUrl?: string;
  /** How long one request may take before it counts as unavailable. */
  readonly timeoutMs?: number;
}

interface FunctionCall {
  readonly id?: string;
  readonly name: string;
  readonly args?: unknown;
}
interface Part {
  readonly text?: string;
  readonly thought?: boolean;
  readonly thoughtSignature?: string;
  readonly functionCall?: FunctionCall;
  readonly functionResponse?: {
    readonly id?: string;
    readonly name: string;
    readonly response: Record<string, unknown>;
  };
}
interface Content {
  readonly role: 'user' | 'model';
  readonly parts: ReadonlyArray<Part>;
}
interface Chunk {
  readonly candidates?: ReadonlyArray<{ content?: { parts?: Part[] }; finishReason?: string }>;
  readonly promptFeedback?: { blockReason?: string };
  readonly error?: { code?: number };
}

/** The candidate was withheld on safety grounds: our refusal path. */
const REFUSED = new Set([
  'SAFETY',
  'PROHIBITED_CONTENT',
  'BLOCKLIST',
  'SPII',
  'RECITATION',
  'IMAGE_SAFETY',
  'IMAGE_PROHIBITED_CONTENT',
  // "Filtered by an escalation rule" (the FinishReason enum, 2026-10-23): S1-A10b, A10-51.
  'ESCALATION',
]);
/** Fine endings. Any other finish (a malformed call, a missing signature...) is a failure. */
const FINISHED = new Set(['STOP', 'MAX_TOKENS']);

/**
 * Gemini's own safety filters (S1-A10b, A10-45). Google's default for Gemini 2.5 and later is
 * "Off" for every category (https://ai.google.dev/gemini-api/docs/safety-settings, 2026-10-23),
 * where Anthropic's models carry their own safety training and a server-side fallback. The
 * learners include 14-year-olds: sexual content blocked from the lowest level, the rest from
 * medium. A block is a refusal (`REFUSED`), so the runner answers kindly. The crisis check still
 * runs first and never depends on this.
 */
const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
] as const;

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_TOKENS = 16000;

const unavailable = (status: number) => status === 429 || status >= 500;

function failure(status: number): ModelError {
  const message = `The Gemini API answered ${status}`;
  return unavailable(status) ? new ModelUnavailableError(message) : new ModelError(message);
}

/** A tool's input schema as JSON Schema, without the `$schema` marker the API doesn't take. */
function parameters(tool: Tool): Record<string, unknown> {
  const { $schema: _, ...schema } = z.toJSONSchema(tool.input) as Record<string, unknown>;
  return schema;
}

/** What a tool returned, as the object a `functionResponse` carries. */
function toolResponse(result: { content: string; isError: boolean }): Record<string, unknown> {
  if (result.isError) return { error: result.content };
  try {
    return { output: JSON.parse(result.content) as unknown };
  } catch {
    return { output: result.content };
  }
}

export class GeminiChatModel implements ChatModel {
  readonly isSample = false;
  readonly #apiKey: string;
  readonly #model: string;
  readonly #fetch: typeof fetch;
  readonly #baseUrl: string;
  readonly #timeoutMs: number;
  /** The provider and model id only, never the key (A10-49). */
  readonly writer: ReplyWriter;

  constructor(options: GeminiChatModelOptions) {
    if (!options.apiKey) throw new ModelError('GeminiChatModel needs an API key');
    this.#apiKey = options.apiKey;
    this.#model = options.model;
    this.writer = { provider: 'gemini', model: options.model };
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#baseUrl = (options.baseUrl ?? GEMINI_API_BASE).replace(/\/$/, '');
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async respond(request: ModelRequest): Promise<ModelResponse> {
    const contents: Content[] = request.history.map((turn) => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.text }],
    }));
    // Deterministic order and schemas, first in every request (as Anthropic's cached prefix).
    const tools = [
      {
        functionDeclarations: request.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parametersJsonSchema: parameters(tool),
        })),
      },
    ];
    let text = '';

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const reply = await this.#stream(
        {
          systemInstruction: { parts: [{ text: request.system }, { text: request.context }] },
          tools,
          contents,
          safetySettings: SAFETY_SETTINGS,
          generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
        },
        (delta) => {
          text += delta;
          request.onText(delta);
        },
      );

      if (reply.blocked || REFUSED.has(reply.finishReason ?? '')) return { text, refused: true };
      if (reply.finishReason === undefined) throw new ModelError('The answer was cut off');
      const calls = reply.parts.flatMap((p) => (p.functionCall ? [p.functionCall] : []));
      if (!FINISHED.has(reply.finishReason)) {
        throw new ModelError(`The answer ended with ${reply.finishReason}`);
      }
      if (calls.length === 0) return { text, refused: false };
      if (reply.finishReason === 'MAX_TOKENS') throw new ModelError('Tool input was cut off');
      if (round === MAX_TOOL_ROUNDS) throw new ModelError('Too many tool calls');

      // The model's turn goes back exactly as received: its thought signatures included.
      contents.push({ role: 'model', parts: reply.parts });
      const results: Part[] = [];
      for (const call of calls) {
        const result = await request.callTool(call.name, call.args ?? {});
        results.push({
          functionResponse: {
            ...(call.id ? { id: call.id } : {}),
            name: call.name,
            response: toolResponse(result),
          },
        });
      }
      contents.push({ role: 'user', parts: results });
    }
    throw new ModelError('Too many tool calls');
  }

  /** One streamed request: the parts as received, how it finished, whether it was blocked. */
  async #stream(
    body: unknown,
    onText: (delta: string) => void,
  ): Promise<{ parts: Part[]; finishReason: string | undefined; blocked: boolean }> {
    const url = `${this.#baseUrl}/models/${encodeURIComponent(this.#model)}:streamGenerateContent?alt=sse`;
    let response: Response;
    try {
      response = await this.#fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.#apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.#timeoutMs),
      });
    } catch {
      // No connection, or the timeout. The cause is left out: it may name the request.
      throw new ModelUnavailableError('The Gemini API could not be reached');
    }
    if (!response.ok || !response.body) throw failure(response.status);

    const parts: Part[] = [];
    let finishReason: string | undefined;
    let blocked = false;
    const take = (data: string) => {
      let chunk: Chunk;
      try {
        chunk = JSON.parse(data) as Chunk;
      } catch {
        throw new ModelError('The Gemini API sent an unreadable event');
      }
      if (chunk.error) throw failure(chunk.error.code ?? 500);
      if (chunk.promptFeedback?.blockReason) blocked = true;
      const candidate = chunk.candidates?.[0];
      for (const part of candidate?.content?.parts ?? []) {
        parts.push(part);
        // Thoughts are the model's own; only the answer reaches the learner.
        if (typeof part.text === 'string' && part.text !== '' && !part.thought) onText(part.text);
      }
      if (candidate?.finishReason) finishReason = candidate.finishReason;
    };

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    const drain = (final: boolean) => {
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = final ? '' : (events.pop() ?? '');
      for (const event of events) {
        const data = event
          .split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');
        if (data) take(data);
      }
    };
    for (;;) {
      let next: ReadableStreamReadResult<string>;
      try {
        next = await reader.read();
      } catch {
        throw new ModelUnavailableError('The Gemini stream broke');
      }
      if (next.done) break;
      buffer += next.value;
      drain(false);
    }
    drain(true);
    return { parts, finishReason, blocked };
  }
}
