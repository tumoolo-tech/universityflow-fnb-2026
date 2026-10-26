import 'server-only';
import {
  AnthropicChatModel,
  type ChatModel,
  FallbackChatModel,
  GeminiChatModel,
  SampleChatModel,
} from '@universityflow/agent';
import { type AiProvider, type Config, ConfigError } from './config';

/**
 * Which chat model answers a learner (owner's decision of 2026-10-23). `UF_AI_PROVIDER` names
 * the provider asked first; the other answers a message the first can't (network, server error,
 * rate limit) when its key is set (`FallbackChatModel`). With only one key, that provider; with
 * none, the scripted stand-in locally, and a configuration error live (never a silent stand-in).
 *
 * Production never makes Gemini (readConfig refuses it and its key; this repeats the check for
 * a configuration built by hand). Every provider gets the same charter, context, history and
 * tools: the runner, the crisis check and care don't know which one answered.
 *
 * The keys are read here and handed to the model only, never kept in the configuration.
 * Anthropic's SDK reads its own from the environment.
 */

export interface ChatModelFactories {
  anthropic(model: string): ChatModel;
  gemini(apiKey: string, model: string): ChatModel;
}

const REAL: ChatModelFactories = {
  anthropic: (model) => new AnthropicChatModel({ model }),
  gemini: (apiKey, model) => new GeminiChatModel({ apiKey, model }),
};

export function chatModelFor(
  config: Config,
  env: Record<string, string | undefined>,
  factories: ChatModelFactories = REAL,
): ChatModel {
  const geminiKey = config.production ? undefined : env['GEMINI_API_KEY']?.trim();
  const make: Record<AiProvider, () => ChatModel | null> = {
    anthropic: () =>
      env['ANTHROPIC_API_KEY']?.trim() ? factories.anthropic(config.anthropicModel) : null,
    gemini: () => (geminiKey ? factories.gemini(geminiKey, config.geminiModel) : null),
  };
  const chosen = config.production ? 'anthropic' : config.aiProvider;
  const other: AiProvider = chosen === 'anthropic' ? 'gemini' : 'anthropic';
  const [first, second] = [make[chosen](), make[other]()].filter(
    (model): model is ChatModel => model !== null,
  );
  if (!first) {
    if (config.providers === 'live') throw new ConfigError('Live mode needs an AI key');
    return new SampleChatModel();
  }
  return second ? new FallbackChatModel(first, second) : first;
}

/**
 * Whether Google's Gemini answers the chat: asked first (or alone), only when the other provider
 * can't, or never. The chat's line and the privacy page name Google from this (finding AI-01), so
 * it reads the model the services built, never the switches again.
 */
export function geminiRole(model: ChatModel): 'first' | 'fallback' | null {
  if (model.writer.provider === 'gemini') return 'first';
  if (model instanceof FallbackChatModel && model.fallback.writer.provider === 'gemini') {
    return 'fallback';
  }
  return null;
}
