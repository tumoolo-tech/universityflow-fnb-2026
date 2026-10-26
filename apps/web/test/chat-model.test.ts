import {
  AnthropicChatModel,
  type ChatModel,
  FallbackChatModel,
  GeminiChatModel,
  SampleChatModel,
} from '@universityflow/agent';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { chatModelFor, geminiRole } from '../lib/server/chat-model';
import { type Config, ConfigError, readConfig } from '../lib/server/config';
import { createServices } from '../lib/server/services';

/**
 * Which chat model answers (owner's decision of 2026-10-23): UF_AI_PROVIDER first, the other
 * provider when the first is down and its key is set, the stand-in locally with no key at all.
 * Keys are placeholders: nothing here reaches a real API.
 */

const ANTHROPIC = { ANTHROPIC_API_KEY: 'test-key-not-real' };
const GEMINI = { GEMINI_API_KEY: 'test-gemini-key-not-real' };

afterEach(() => {
  vi.unstubAllEnvs();
});

function pick(env: Record<string, string | undefined>, config: Config = readConfig(env)) {
  const made: Array<{ provider: string; model: string; apiKey?: string }> = [];
  const model = chatModelFor(config, env, {
    anthropic: (m) => {
      made.push({ provider: 'anthropic', model: m });
      return new AnthropicChatModel({ model: m });
    },
    gemini: (apiKey, m) => {
      made.push({ provider: 'gemini', model: m, apiKey });
      return new GeminiChatModel({ apiKey, model: m });
    },
  });
  return { model, made };
}

const order = (model: ChatModel) =>
  model instanceof FallbackChatModel
    ? [model.primary.constructor.name, model.fallback.constructor.name]
    : [model.constructor.name];

describe('chatModelFor', () => {
  it('is the stand-in locally with no key at all, whichever provider is chosen', () => {
    expect(pick({}).model).toBeInstanceOf(SampleChatModel);
    expect(pick({ UF_AI_PROVIDER: 'gemini' }).model).toBeInstanceOf(SampleChatModel);
  });

  it('is Claude alone with only Anthropic’s key (today’s behaviour)', () => {
    expect(order(pick(ANTHROPIC).model)).toEqual(['AnthropicChatModel']);
  });

  it('asks Claude first and Gemini on an outage, with both keys and the default provider', () => {
    expect(order(pick({ ...ANTHROPIC, ...GEMINI }).model)).toEqual([
      'AnthropicChatModel',
      'GeminiChatModel',
    ]);
  });

  it('asks Gemini first and Claude on an outage, when UF_AI_PROVIDER=gemini', () => {
    expect(order(pick({ ...ANTHROPIC, ...GEMINI, UF_AI_PROVIDER: 'gemini' }).model)).toEqual([
      'GeminiChatModel',
      'AnthropicChatModel',
    ]);
  });

  it('uses whichever provider has a key when only one does', () => {
    expect(order(pick({ ...GEMINI, UF_AI_PROVIDER: 'gemini' }).model)).toEqual(['GeminiChatModel']);
    expect(order(pick({ ...GEMINI }).model)).toEqual(['GeminiChatModel']);
    expect(order(pick({ ...ANTHROPIC, UF_AI_PROVIDER: 'gemini' }).model)).toEqual([
      'AnthropicChatModel',
    ]);
  });

  it('hands Gemini its key and the configured model, and Claude its model', () => {
    const { made } = pick({
      ...ANTHROPIC,
      ...GEMINI,
      GEMINI_MODEL: 'gemini-test-model',
      ANTHROPIC_MODEL: 'claude-test-model',
    });
    expect(made).toEqual([
      { provider: 'anthropic', model: 'claude-test-model' },
      { provider: 'gemini', model: 'gemini-test-model', apiKey: GEMINI.GEMINI_API_KEY },
    ]);
  });

  it('never makes Gemini in production, even for a configuration built by hand', () => {
    const config = { ...readConfig(ANTHROPIC), production: true, aiProvider: 'gemini' as const };
    expect(order(pick({ ...ANTHROPIC, ...GEMINI }, config).model)).toEqual(['AnthropicChatModel']);
  });

  it('live, never falls back to the stand-in: no key is a configuration error', () => {
    const config = { ...readConfig({}), providers: 'live' as const };
    expect(() => pick({}, config)).toThrow(ConfigError);
  });
});

describe('geminiRole: what the notices say about Google (AI-01)', () => {
  // Read from the model that actually answers, so the words can't drift from chatModelFor.
  it('is "first" whenever Gemini is asked first or alone', () => {
    expect(geminiRole(pick({ ...GEMINI }).model)).toBe('first');
    expect(geminiRole(pick({ ...GEMINI, UF_AI_PROVIDER: 'gemini' }).model)).toBe('first');
    expect(geminiRole(pick({ ...ANTHROPIC, ...GEMINI, UF_AI_PROVIDER: 'gemini' }).model)).toBe(
      'first',
    );
  });

  it('is "fallback" when Claude is asked first and Gemini answers on an outage', () => {
    expect(geminiRole(pick({ ...ANTHROPIC, ...GEMINI }).model)).toBe('fallback');
  });

  it('is null when Gemini can never answer: Claude alone, the stand-in, production', () => {
    expect(geminiRole(pick(ANTHROPIC).model)).toBeNull();
    expect(geminiRole(pick({ ...ANTHROPIC, UF_AI_PROVIDER: 'gemini' }).model)).toBeNull();
    expect(geminiRole(pick({}).model)).toBeNull();
    const config = { ...readConfig(ANTHROPIC), production: true, aiProvider: 'gemini' as const };
    expect(geminiRole(pick({ ...ANTHROPIC, ...GEMINI }, config).model)).toBeNull();
  });
});

describe('createServices: the chat model', () => {
  it('locally with both keys, the chat asks the chosen provider first and the other on an outage', async () => {
    // The Anthropic SDK reads its key from the environment itself.
    vi.stubEnv('ANTHROPIC_API_KEY', ANTHROPIC.ANTHROPIC_API_KEY);
    const env = {
      DATABASE_URL: 'pglite:memory',
      UF_AI_PROVIDER: 'gemini',
      ...ANTHROPIC,
      ...GEMINI,
    };
    const services = await createServices(readConfig(env), { env });
    expect(order(services.model)).toEqual(['GeminiChatModel', 'AnthropicChatModel']);
    // Reading documents stays with Anthropic.
    expect(services.reader.isSample).toBe(false);
  });

  it('locally with no key, the stand-in', async () => {
    const env = { DATABASE_URL: 'pglite:memory' };
    const services = await createServices(readConfig(env), { env });
    expect(services.model).toBeInstanceOf(SampleChatModel);
  });
});
