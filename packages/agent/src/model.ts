import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { Tool } from './tools';

/**
 * The language model, behind an interface (D8). `AnthropicChatModel` is the real one; the local
 * stand-in (`SampleChatModel`) implements the same contract so the whole chat runs without an
 * API key.
 *
 * The model runs the tool loop, but every tool call comes back to `callTool`, which validates
 * and runs our own tested code. The model never touches data directly.
 */

export interface ChatTurn {
  readonly role: 'user' | 'assistant';
  readonly text: string;
}

export interface ModelRequest {
  /** The stable charter. Cached. */
  readonly system: string;
  /** Per-request context (date, intake, the learner's goal). Not cached. */
  readonly context: string;
  /** The conversation so far, ending with the learner's new message. */
  readonly history: ReadonlyArray<ChatTurn>;
  readonly tools: ReadonlyArray<Tool>;
  onText(delta: string): void;
  callTool(name: string, input: unknown): Promise<{ content: string; isError: boolean }>;
}

/**
 * Who wrote a reply (A10-49): a provider and a model id, nothing else (hard rule 4), stored with
 * the reply and with any report of it so a person can tell which provider's output it was.
 * - 'anthropic', 'gemini': the real providers; `model` is the model id that answered.
 * - 'local': the scripted stand-in (or a test's scripted model); no AI at all.
 * - 'system': no model wrote it (`NO_MODEL`): the reviewed crisis reply, or our own kind line
 *   when the model refused or failed before writing anything. `model` is always null.
 */
export type ModelProvider = 'anthropic' | 'gemini' | 'local';
export type ReplyProvider = ModelProvider | 'system';

export interface ReplyWriter {
  readonly provider: ReplyProvider;
  /** The model id; null only for the system. */
  readonly model: string | null;
}

/** A reply no model wrote. */
export const NO_MODEL: ReplyWriter = Object.freeze({ provider: 'system', model: null });

export interface ModelResponse {
  readonly text: string;
  /** True when the model (and its fallback) declined; the runner answers instead. */
  readonly refused: boolean;
  /**
   * Who wrote this answer, when it isn't simply the model asked (`ChatModel.writer`): another
   * provider (`FallbackChatModel`), or Anthropic's server-side fallback model.
   */
  readonly writtenBy?: ReplyWriter;
}

export interface ChatModel {
  readonly isSample: boolean;
  /** Who this model is (A10-49). For a fallback pair, the provider asked first. */
  readonly writer: ReplyWriter;
  respond(request: ModelRequest): Promise<ModelResponse>;
}

/**
 * Who wrote the words a learner saw before a model failed, when that isn't the model asked (a
 * fallback pair whose other provider took over, then failed). Kept beside the error, never on it,
 * so the error itself is unchanged.
 */
const failedWriters = new WeakMap<object, ReplyWriter>();

/** Who wrote the words streamed before `error`, if a model recorded it. */
export function failedWriter(error: unknown): ReplyWriter | undefined {
  return typeof error === 'object' && error !== null ? failedWriters.get(error) : undefined;
}

function recordFailedWriter(error: unknown, writer: ReplyWriter): void {
  if (typeof error === 'object' && error !== null && !failedWriters.has(error)) {
    failedWriters.set(error, writer);
  }
}

/** Tool calls one learner message may make before the agent must answer. */
export const MAX_TOOL_ROUNDS = 6;

export class ModelError extends Error {
  override readonly name: string = 'ModelError';
}

/**
 * The provider could not answer at all, through no fault of the request: the network, a server
 * error or a rate limit. Another provider might answer instead (`FallbackChatModel`); a bad
 * request, a refusal or a broken tool loop is never this.
 */
export class ModelUnavailableError extends ModelError {
  override readonly name = 'ModelUnavailableError';
}

/** A rate limit or a server error: worth asking another provider. */
const unavailableStatus = (status: number | undefined) =>
  status !== undefined && (status === 429 || status >= 500);

/** Whether `error` means the provider was unavailable, whichever provider threw it. */
export function isModelUnavailable(error: unknown): boolean {
  if (error instanceof ModelUnavailableError) return true;
  // The Anthropic SDK's own errors: a timeout is a connection error too.
  if (error instanceof Anthropic.APIConnectionError) return true;
  if (error instanceof Anthropic.APIError) return unavailableStatus(error.status);
  return false;
}

/**
 * The chosen model, and another provider's for when it is unavailable (owner's decision of
 * 2026-10-23). The other answers the same request, unchanged, so the AI sees nothing new; and
 * only while nothing has happened yet. Once the learner has seen words or a tool has run, a
 * second answer would repeat them, so the failure stands and the runner answers kindly. A
 * refusal is never retried here: the runner answers it.
 */
export class FallbackChatModel implements ChatModel {
  readonly isSample = false;

  constructor(
    readonly primary: ChatModel,
    readonly fallback: ChatModel,
  ) {}

  get writer(): ReplyWriter {
    return this.primary.writer;
  }

  async respond(request: ModelRequest): Promise<ModelResponse> {
    let started = false;
    try {
      const response = await this.primary.respond({
        ...request,
        onText: (delta) => {
          started = true;
          request.onText(delta);
        },
        callTool: (name, input) => {
          started = true;
          return request.callTool(name, input);
        },
      });
      return { ...response, writtenBy: response.writtenBy ?? this.primary.writer };
    } catch (error) {
      if (started || !isModelUnavailable(error)) {
        recordFailedWriter(error, this.primary.writer);
        throw error;
      }
    }
    try {
      const response = await this.fallback.respond(request);
      return { ...response, writtenBy: response.writtenBy ?? this.fallback.writer };
    } catch (error) {
      recordFailedWriter(error, this.fallback.writer);
      throw error;
    }
  }
}

export interface AnthropicChatModelOptions {
  readonly model: string;
  readonly client?: Anthropic;
  readonly effort?: 'low' | 'medium' | 'high';
}

/**
 * The part of a response that belongs to the model that finished it. When the requested model
 * declines mid-answer, the server-side fallback carries on in the same response, after a
 * `fallback` block. Before the last such block only text is kept: the declined attempt's
 * thinking and tool calls are neither run nor echoed back (the API's rule for echoing a
 * fallback turn). The `fallback` marker itself stays in place.
 */
function afterFallback(
  content: ReadonlyArray<Anthropic.Beta.Messages.BetaContentBlock>,
): Anthropic.Beta.Messages.BetaContentBlock[] {
  let boundary = -1;
  content.forEach((block, i) => {
    if (block.type === 'fallback') boundary = i;
  });
  return content.filter((block, i) => i >= boundary || block.type === 'text');
}

export class AnthropicChatModel implements ChatModel {
  readonly isSample = false;
  readonly #client: Anthropic;
  readonly #model: string;
  readonly #effort: 'low' | 'medium' | 'high';

  readonly writer: ReplyWriter;

  constructor(options: AnthropicChatModelOptions) {
    this.#client = options.client ?? new Anthropic();
    this.#model = options.model;
    this.#effort = options.effort ?? 'medium';
    this.writer = { provider: 'anthropic', model: options.model };
  }

  #tools(tools: ReadonlyArray<Tool>): Anthropic.Beta.Messages.BetaToolUnion[] {
    // Deterministic order and schemas, so the cached prefix never changes between requests.
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: z.toJSONSchema(tool.input) as Anthropic.Beta.Messages.BetaTool.InputSchema,
    }));
  }

  async respond(request: ModelRequest): Promise<ModelResponse> {
    const messages: Anthropic.Beta.Messages.BetaMessageParam[] = request.history.map((turn) => ({
      role: turn.role,
      content: turn.text,
    }));
    let text = '';
    // A10-49: when the server-side fallback took over in any round, the reply is (partly) that
    // model's: the last hand-over names it. Otherwise the model asked wrote it all.
    let fellBackTo: string | null = null;
    const answered = (refused: boolean): ModelResponse =>
      fellBackTo
        ? { text, refused, writtenBy: { provider: 'anthropic', model: fellBackTo } }
        : { text, refused };

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const stream = this.#client.beta.messages.stream({
        model: this.#model,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: this.#effort },
        system: [
          { type: 'text', text: request.system, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: request.context },
        ],
        tools: this.#tools(request.tools),
        messages,
      });
      stream.on('text', (delta) => {
        text += delta;
        request.onText(delta);
      });
      const message = await stream.finalMessage();
      for (const block of message.content) {
        if (block.type === 'fallback') fellBackTo = block.to.model;
      }

      if (message.stop_reason === 'refusal') return answered(true);
      const content = afterFallback(message.content);
      const calls = content.filter(
        (b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === 'tool_use',
      );
      if (calls.length === 0) return answered(false);
      if (message.stop_reason === 'max_tokens') throw new ModelError('Tool input was cut off');
      if (round === MAX_TOOL_ROUNDS) throw new ModelError('Too many tool calls');

      messages.push({ role: 'assistant', content });
      const results: Anthropic.Beta.Messages.BetaToolResultBlockParam[] = [];
      for (const call of calls) {
        const result = await request.callTool(call.name, call.input);
        results.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: result.content,
          is_error: result.isError,
        });
      }
      messages.push({ role: 'user', content: results });
    }
    throw new ModelError('Too many tool calls');
  }
}
