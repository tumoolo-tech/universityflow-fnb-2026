import { AnthropicChatModel, type ChatModel, FallbackChatModel } from '@universityflow/agent';
import { describe, expect, it } from 'vitest';
import { chatModelFor } from '../lib/server/chat-model';
import { readConfig } from '../lib/server/config';
import { createServices } from '../lib/server/services';

/**
 * A10-49 (S1-A10b): Gemini never answers a learner in production. Walks the real path a learner's
 * chat model is chosen by (readConfig, then chatModelFor, as createServices calls them) with every
 * production-like environment and every spelling of UF_AI_PROVIDER=gemini we could think of. Each
 * must either refuse to start, or build a chat model with no Gemini anywhere in it. The judge
 * demo's allowance (UF_DEPLOYMENT=demo, A10-46: owner and legal) must not reach production either.
 * Keys are placeholders: nothing here reaches a real API.
 */

const ANTHROPIC_KEY = 'test-key-not-real';
const GEMINI_KEY = 'test-gemini-key-not-real';

const LIVE: Record<string, string | undefined> = {
  // Production's own https address (A1-50).
  UF_PUBLIC_URL: 'https://universityflow.example',
  VERCEL_ENV: 'production',
  UF_PROVIDERS: 'live',
  AUTH_SECRET: 'x'.repeat(48),
  DATABASE_URL: 'postgres://user@db.example/uf',
  UF_S3_BUCKET: 'uf-documents-test',
  UF_SMS_PROVIDER: 'test-provider',
  UF_JOBS_PROVIDER: 'test-jobs',
  ANTHROPIC_API_KEY: ANTHROPIC_KEY,
};
const WITH_ADAPTER = {
  sms: ['test-provider'],
  jobs: ['test-jobs'],
  inbound: { sms: ['test-provider'] },
};
const STAGING: Record<string, string | undefined> = {
  NODE_ENV: 'production',
  RENDER: 'true',
  UF_DEPLOYMENT: 'staging',
  UF_PROVIDERS: 'local',
  AUTH_SECRET: 's'.repeat(44),
  UF_STAGING_PASSWORD: 'staging-test-password-0123',
};

/** Every environment a learner's chat runs in that is production, or a host that might be. */
const PRODUCTION_LIKE: ReadonlyArray<readonly [string, Record<string, string | undefined>]> = [
  ['Vercel production', LIVE],
  ['a Vercel preview', { ...LIVE, VERCEL_ENV: 'preview' }],
  ['a Vercel development deployment', { ...LIVE, VERCEL_ENV: 'development' }],
  ['a self-hosted production build', { ...LIVE, VERCEL_ENV: undefined, NODE_ENV: 'production' }],
  ['Render', { ...LIVE, VERCEL_ENV: undefined, RENDER: 'true' }],
  [
    'Vercel with the local-build escape (ignored on a host)',
    { ...LIVE, NODE_ENV: 'production', UF_LOCAL_PRODUCTION_BUILD: '1' },
  ],
  ['staging on Render', STAGING],
  ['staging on a Vercel preview', { ...STAGING, RENDER: undefined, VERCEL_ENV: 'preview' }],
  ['UF_DEPLOYMENT empty (production)', { ...LIVE, UF_DEPLOYMENT: '' }],
];

/** UF_AI_PROVIDER=gemini, however it might be typed. */
const GEMINI_SPELLINGS = [
  'gemini',
  'Gemini',
  'GEMINI',
  'GeMiNi',
  ' gemini',
  'gemini ',
  '\tgemini\n',
  '"gemini"',
  "'gemini'",
  'gemini,anthropic',
  'anthropic,gemini',
  'gemini-3.8-flash',
  'google',
  'google-gemini',
  'gemini​',
  'ｇｅｍｉｎｉ',
];

/** The keys a deployment might carry: none, Gemini's, Gemini's with stray whitespace. */
const GEMINI_KEYS: ReadonlyArray<Record<string, string | undefined>> = [
  {},
  { GEMINI_API_KEY: GEMINI_KEY },
  { GEMINI_API_KEY: `  ${GEMINI_KEY}\n` },
];

/** Every model in a chat model, the fallback's included. */
function models(model: ChatModel): ChatModel[] {
  return model instanceof FallbackChatModel
    ? [...models(model.primary), ...models(model.fallback)]
    : [model];
}

/**
 * Either the configuration refuses to start, or the chat model it builds has no Gemini in it and
 * the Gemini factory was never called. Returns what happened, for the message on failure.
 */
function outcome(env: Record<string, string | undefined>): string {
  let config: ReturnType<typeof readConfig>;
  try {
    config = readConfig(env, WITH_ADAPTER);
  } catch {
    return 'refused';
  }
  let geminiMade = false;
  let model: ChatModel;
  try {
    model = chatModelFor(config, env, {
      anthropic: (m) => new AnthropicChatModel({ model: m }),
      gemini: () => {
        geminiMade = true;
        throw new Error('Gemini was made');
      },
    });
  } catch (error) {
    if (geminiMade) return 'gemini';
    return error instanceof Error && error.message === 'Gemini was made' ? 'gemini' : 'refused';
  }
  if (geminiMade || models(model).some((m) => m.writer.provider === 'gemini')) return 'gemini';
  return `no gemini (${models(model)
    .map((m) => m.writer.provider)
    .join(', ')})`;
}

describe('Gemini never answers a learner in production (A10-49, A10-46)', () => {
  for (const [where, base] of PRODUCTION_LIKE) {
    it(`${where}: every spelling of UF_AI_PROVIDER=gemini, with or without its key`, () => {
      for (const spelling of GEMINI_SPELLINGS) {
        for (const key of GEMINI_KEYS) {
          const result = outcome({ ...base, UF_AI_PROVIDER: spelling, ...key });
          expect(result, `${JSON.stringify(spelling)} ${JSON.stringify(key)}`).not.toBe('gemini');
        }
      }
    });

    it(`${where}: Gemini's key alone, with the default provider, never makes Gemini`, () => {
      for (const key of GEMINI_KEYS) {
        expect(outcome({ ...base, ...key })).not.toBe('gemini');
      }
    });
  }

  it('production refuses outright (never a quiet stand-in) when Gemini is asked for or its key is set', () => {
    expect(outcome({ ...LIVE, UF_AI_PROVIDER: 'gemini' })).toBe('refused');
    expect(outcome({ ...LIVE, GEMINI_API_KEY: GEMINI_KEY })).toBe('refused');
    // And production on its own still starts, on Anthropic.
    expect(outcome(LIVE)).toBe('no gemini (anthropic)');
  });

  it('a staging site, with Gemini asked for, answers with the stand-in', () => {
    expect(outcome({ ...STAGING, UF_AI_PROVIDER: 'gemini' })).toBe('no gemini (local)');
  });

  it('a staging site with Gemini asked for builds the stand-in through createServices too', async () => {
    const env = { ...STAGING, UF_AI_PROVIDER: 'gemini', DATABASE_URL: 'pglite:memory' };
    const services = await createServices(readConfig(env), { env });
    expect(models(services.model).map((m) => m.writer.provider)).toEqual(['local']);
    await services.database.close();
  });
});

describe('the demo’s Gemini allowance never reaches production (A10-46)', () => {
  const DEMO_MARKERS: ReadonlyArray<Record<string, string | undefined>> = [
    { UF_DEMO_PROJECT: '1' },
    { UF_DEMO_AI_DAILY_CAP: '100' },
    { UF_DEMO_DATABASE: 'synthetic' },
    { UF_DEPLOYMENT: 'Demo', UF_DEMO_PROJECT: '1' },
    { UF_DEPLOYMENT: 'demo ', UF_DEMO_PROJECT: '1' },
    { UF_DEPLOYMENT: 'DEMO', UF_DEMO_PROJECT: '1' },
    // A demo without its own project's marker is not a demo.
    { UF_DEPLOYMENT: 'demo' },
  ];

  it('production carrying any of the demo’s switches, with Gemini, refuses to start', () => {
    for (const markers of DEMO_MARKERS) {
      for (const key of GEMINI_KEYS) {
        const result = outcome({ ...LIVE, ...markers, UF_AI_PROVIDER: 'gemini', ...key });
        expect(result, JSON.stringify(markers)).toBe('refused');
      }
    }
  });

  it('a demo is never production: live providers, the production project, refuse', () => {
    const demo = {
      UF_DEPLOYMENT: 'demo',
      UF_DEMO_PROJECT: '1',
      UF_AI_PROVIDER: 'gemini',
      GEMINI_API_KEY: GEMINI_KEY,
    };
    // Production's own configuration (live providers) can't become a demo by adding the markers.
    expect(outcome({ ...LIVE, ...demo })).toBe('refused');
  });
});
