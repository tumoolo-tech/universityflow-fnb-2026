import { readFileSync } from 'node:fs';
import { GEMINI_DEFAULT_MODEL } from '@universityflow/agent';
import { describe, expect, it } from 'vitest';
import {
  ConfigError,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_SMS_BUDGET,
  DEFAULT_SMS_REMINDER_BUDGET,
  DEFAULT_WHATSAPP_BUDGET,
  isProduction,
  isStaging,
  readConfig,
} from '../lib/server/config';

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
  ANTHROPIC_API_KEY: 'test-key-not-real',
};
/**
 * No SMS or job adapter exists yet; tests that need them pretend they do. The SMS adapter can
 * receive as well as send (A5-02): a live channel that can't hear STOP never starts.
 */
const WITH_ADAPTER = {
  sms: ['test-provider'],
  jobs: ['test-jobs'],
  inbound: { sms: ['test-provider'] },
};

describe('data residency: functions run in Cape Town', () => {
  it('pins every function to cpt1 in vercel.json (London only while hackathon exception J stands)', () => {
    const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
    if (vercel.regions[0] === 'lhr1') {
      // The judge demo's functions beside its London database (docs/deploy/hackathon-undo-pr.md J).
      // Allowed only while that exception is written down to be undone; production refuses lhr1.
      const undo = readFileSync(
        new URL('../../../docs/deploy/hackathon-undo-pr.md', import.meta.url),
        'utf8',
      );
      expect(undo).toMatch(/^### J\. The demo's functions in London/m);
      expect(vercel.regions).toEqual(['lhr1']);
      return;
    }
    expect(vercel.regions).toEqual(['cpt1']);
  });

  it('refuses to start in production outside cpt1', () => {
    expect(() => readConfig({ ...LIVE, VERCEL_REGION: 'iad1' }, WITH_ADAPTER)).toThrow(
      /must run in cpt1, not iad1/,
    );
    expect(() => readConfig({ ...LIVE, VERCEL_REGION: 'lhr1' }, WITH_ADAPTER)).toThrow(
      /must run in cpt1, not lhr1/,
    );
    expect(() => readConfig({ ...LIVE, VERCEL_REGION: 'cpt1' }, WITH_ADAPTER)).not.toThrow();
  });
});

describe('data residency: production never runs on Render (docs/deploy/README.md)', () => {
  // Render sets RENDER=true on every service, at build and at run time. It has no South African
  // region, so production refuses it rather than process student data outside the country.
  const ON_RENDER = { ...LIVE, VERCEL_ENV: undefined, NODE_ENV: 'production', RENDER: 'true' };

  it('refuses a production build on Render, however complete its configuration', () => {
    expect(() => readConfig(ON_RENDER, WITH_ADAPTER)).toThrow(ConfigError);
    expect(() => readConfig(ON_RENDER, WITH_ADAPTER)).toThrow(/Render has no South African/);
  });

  it('A5-12: the local-build escape (UF_LOCAL_PRODUCTION_BUILD=1) is ignored on Render, as on Vercel', () => {
    expect(
      isProduction({ NODE_ENV: 'production', UF_LOCAL_PRODUCTION_BUILD: '1', RENDER: 'true' }),
    ).toBe(true);
    expect(() =>
      readConfig({ ...ON_RENDER, UF_LOCAL_PRODUCTION_BUILD: '1' }, WITH_ADAPTER),
    ).toThrow(/Render has no South African/);
  });

  it('A5-12: anything on Render that isn’t staging refuses, a dev build included', () => {
    expect(() => readConfig({ RENDER: 'true' })).toThrow(/Render has no South African/);
    expect(() => readConfig({ RENDER: 'true', NODE_ENV: 'development' })).toThrow(
      /Render has no South African/,
    );
  });

  it('still accepts the same configuration off Render', () => {
    expect(() => readConfig({ ...ON_RENDER, RENDER: undefined }, WITH_ADAPTER)).not.toThrow();
  });
});

describe('readConfig: the staging deployment (UF_DEPLOYMENT=staging, synthetic data only)', () => {
  // A production build on Render, as render.yaml configures it: stand-ins, a generated secret,
  // the access gate's password (A5-10).
  const STAGING = {
    NODE_ENV: 'production',
    RENDER: 'true',
    UF_DEPLOYMENT: 'staging',
    UF_PROVIDERS: 'local',
    AUTH_SECRET: 's'.repeat(44),
    UF_STAGING_PASSWORD: 'staging-test-password-0123',
  };

  it('runs a production build on Render with the stand-ins, marked as staging', () => {
    const config = readConfig(STAGING);
    expect(config).toMatchObject({ staging: true, production: false, providers: 'local' });
  });

  it('is never staging unless it says so', () => {
    expect(readConfig({}).staging).toBe(false);
    expect(readConfig(LIVE, WITH_ADAPTER).staging).toBe(false);
  });

  it('refuses live providers: no real SMS, AI or S3, so no real learner’s data', () => {
    expect(() => readConfig({ ...STAGING, UF_PROVIDERS: 'live' }, WITH_ADAPTER)).toThrow(
      /Staging runs on synthetic data only/,
    );
  });

  it('can never be Vercel production, so staging is never mistaken for it', () => {
    expect(() => readConfig({ ...STAGING, RENDER: undefined, VERCEL_ENV: 'production' })).toThrow(
      /never Vercel production/,
    );
    // A Vercel preview may be a staging site.
    expect(readConfig({ ...STAGING, RENDER: undefined, VERCEL_ENV: 'preview' }).staging).toBe(true);
  });

  it('needs a long random AUTH_SECRET: it is on the internet', () => {
    expect(() => readConfig({ ...STAGING, AUTH_SECRET: undefined })).toThrow(/AUTH_SECRET/);
    expect(() => readConfig({ ...STAGING, AUTH_SECRET: 'short' })).toThrow(/AUTH_SECRET/);
  });

  it('A5-11: accepts only the embedded database, never a real Postgres', () => {
    expect(readConfig({ ...STAGING, DATABASE_URL: 'pglite:./.data/pglite' }).staging).toBe(true);
    for (const url of ['postgres://user@prod.example/uf', 'postgresql://x/y', 'pglite-ish://x']) {
      expect(() => readConfig({ ...STAGING, DATABASE_URL: url }), url).toThrow(
        /synthetic data only: DATABASE_URL/,
      );
    }
  });

  it.each([
    'ANTHROPIC_API_KEY',
    'ELEVENLABS_API_KEY',
    'EXPO_ACCESS_TOKEN',
    'UF_MESSAGING_WEBHOOK_SECRET',
    'UF_SMS_PROVIDER',
    'UF_JOBS_PROVIDER',
    'UF_WHATSAPP_PROVIDER',
    'UF_PUSH_PROVIDER',
    'UF_REVIEW_PHONE',
    'UF_REVIEW_PIN_HASH',
    'UF_REVIEW_UNTIL',
    'UF_S3_BUCKET',
    'UF_S3_REGION',
    'UF_S3_ENDPOINT',
    'UF_S3_KMS_KEY_ID',
    'UF_S3_PREFIX',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_SESSION_TOKEN',
  ])('A5-11: refuses %s, a real provider’s key or setting', (name) => {
    expect(() =>
      readConfig({ ...STAGING, [name]: 'copied-from-production-value-0123456789' }),
    ).toThrow(new RegExp(`synthetic data only: ${name}`));
  });

  it('refuses any other UF_DEPLOYMENT value rather than guess', () => {
    expect(() => readConfig({ UF_DEPLOYMENT: 'prod' })).toThrow(/UF_DEPLOYMENT/);
    expect(readConfig({ UF_DEPLOYMENT: 'production' }).staging).toBe(false);
  });

  it('isStaging reads the same switch, for the banner', () => {
    expect(isStaging({ UF_DEPLOYMENT: 'staging' })).toBe(true);
    expect(isStaging({})).toBe(false);
    expect(isStaging({ UF_DEPLOYMENT: 'production' })).toBe(false);
  });
});

describe('.env.example', () => {
  it('documents every variable the app reads', () => {
    const sources = [
      '../lib/server/config.ts',
      '../lib/server/services.ts',
      '../lib/server/chat-model.ts',
      '../lib/server/http.ts',
      '../lib/server/sms-providers.ts',
      '../lib/server/job-providers.ts',
      '../lib/server/messaging-providers.ts',
      '../next.config.ts',
    ]
      .map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'))
      .join('\n');
    const read = new Set(
      [...sources.matchAll(/(?:env|process\.env)\['([A-Z_]+)'\]/g)].map((m) => m[1] as string),
    );
    const example = readFileSync(new URL('../../../.env.example', import.meta.url), 'utf8');
    // Set by the platform, not by us.
    for (const name of ['VERCEL', 'VERCEL_ENV', 'VERCEL_REGION', 'NODE_ENV']) read.delete(name);
    for (const name of read) expect(example, name).toMatch(new RegExp(`^#? ?${name}=`, 'm'));
  });
});

describe('readConfig: what counts as production (audit finding 5)', () => {
  it('treats any production build as production, a Vercel preview included', () => {
    expect(isProduction({ NODE_ENV: 'production' })).toBe(true);
    expect(isProduction({ VERCEL_ENV: 'preview', NODE_ENV: 'production' })).toBe(true);
    expect(() => readConfig({ NODE_ENV: 'production' })).toThrow(ConfigError);
  });

  it('lets only an explicit local production build (E2E) use the stand-ins, never on Vercel', () => {
    expect(isProduction({ NODE_ENV: 'production', UF_LOCAL_PRODUCTION_BUILD: '1' })).toBe(false);
    expect(
      isProduction({
        NODE_ENV: 'production',
        UF_LOCAL_PRODUCTION_BUILD: '1',
        VERCEL_ENV: 'preview',
      }),
    ).toBe(true);
    expect(isProduction({ NODE_ENV: 'development' })).toBe(false);
  });
});

describe('readConfig', () => {
  it('runs locally with stand-ins and an embedded database by default', () => {
    const config = readConfig({});
    expect(config).toMatchObject({
      providers: 'local',
      catalogueDrafts: false,
      catalogueE2eFixtures: false,
      production: false,
      databaseUrl: 'pglite:./.data/pglite',
      anthropicModel: 'claude-opus-5',
    });
  });

  it('accepts a complete production configuration', () => {
    const config = readConfig(LIVE, WITH_ADAPTER);
    expect(config).toMatchObject({
      production: true,
      providers: 'live',
      smsProvider: 'test-provider',
      jobsProvider: 'test-jobs',
      s3: {
        bucket: 'uf-documents-test',
        region: 'af-south-1',
        kmsKeyId: null,
        prefix: 'documents/',
        endpoint: null,
      },
      smsBudget: DEFAULT_SMS_BUDGET,
      smsReminderBudget: DEFAULT_SMS_REMINDER_BUDGET,
    });
  });

  it.each([
    ['local providers', { UF_PROVIDERS: 'local' }],
    ['unverified catalogue data (hard rule 3)', { UF_CATALOGUE_PREVIEW: '1' }],
    ['the E2E catalogue fixtures (Phase 5c)', { UF_CATALOGUE_E2E_FIXTURES: '1' }],
    ['a short secret', { AUTH_SECRET: 'short' }],
    ['a missing secret', { AUTH_SECRET: undefined }],
    ['an embedded database', { DATABASE_URL: 'pglite:./x' }],
    ['S3 outside South Africa', { UF_S3_REGION: 'eu-west-1' }],
    ['a stand-in S3 server', { UF_S3_ENDPOINT: 'http://127.0.0.1:55491' }],
  ])('refuses production with %s', (_label, override) => {
    expect(() => readConfig({ ...LIVE, ...override }, WITH_ADAPTER)).toThrow(ConfigError);
  });
});

/**
 * My plan maps (D2): a learner's own words wait for consent wording that names them (guardian
 * v4, adult-v3, owed legal review). UF_MINDMAP_WORDS=1 lets them through in the owner's preview
 * only; it is off unless set to exactly 1, and refused anywhere a learner could see it.
 */
describe('readConfig: UF_MINDMAP_WORDS, the plan maps’ words switch', () => {
  it('is off by default and on only for exactly 1', () => {
    expect(readConfig({}).mindmapWords).toBe(false);
    expect(readConfig({ UF_MINDMAP_WORDS: 'true' }).mindmapWords).toBe(false);
    expect(readConfig({ UF_MINDMAP_WORDS: '1' }).mindmapWords).toBe(true);
    // A local production build (the owner's preview, the E2E runs) may turn it on.
    expect(
      readConfig({ NODE_ENV: 'production', UF_LOCAL_PRODUCTION_BUILD: '1', UF_MINDMAP_WORDS: '1' })
        .mindmapWords,
    ).toBe(true);
  });

  it('is refused in production: no consent wording names plan maps yet', () => {
    expect(() => readConfig({ ...LIVE, UF_MINDMAP_WORDS: '1' }, WITH_ADAPTER)).toThrow(
      /UF_MINDMAP_WORDS/,
    );
    expect(readConfig(LIVE, WITH_ADAPTER).mindmapWords).toBe(false);
  });

  it('is refused on a staging site too: a production build, possibly outside South Africa', () => {
    const staging = {
      NODE_ENV: 'production',
      RENDER: 'true',
      UF_DEPLOYMENT: 'staging',
      UF_PROVIDERS: 'local',
      AUTH_SECRET: 's'.repeat(44),
      UF_STAGING_PASSWORD: 'staging-test-password-0123',
    };
    expect(readConfig(staging).mindmapWords).toBe(false);
    expect(() => readConfig({ ...staging, UF_MINDMAP_WORDS: '1' })).toThrow(/UF_MINDMAP_WORDS/);
  });
});

describe('readConfig: UF_PROVIDERS=live refuses to start with anything missing', () => {
  const local = { ...LIVE, VERCEL_ENV: undefined };

  it('refuses today: no SMS adapter has been written yet', () => {
    expect(() => readConfig(LIVE)).toThrow(/UF_SMS_PROVIDER=test-provider has no adapter yet/);
    expect(() => readConfig(local)).toThrow(/Available: none/);
  });

  it('refuses today: no job scheduler adapter exists, and the Postgres queue is a stand-in', () => {
    const smsOnly = { sms: ['test-provider'], jobs: [] };
    expect(() => readConfig(LIVE, smsOnly)).toThrow(
      /UF_JOBS_PROVIDER=test-jobs has no adapter yet/,
    );
    expect(() => readConfig(local, smsOnly)).toThrow(/Available: none/);
  });

  it.each([
    ['no SMS provider', { UF_SMS_PROVIDER: undefined }, /UF_SMS_PROVIDER/],
    ['an SMS provider with no adapter', { UF_SMS_PROVIDER: 'nope' }, /no adapter yet/],
    ['no job scheduler', { UF_JOBS_PROVIDER: undefined }, /UF_JOBS_PROVIDER/],
    ['a job scheduler with no adapter', { UF_JOBS_PROVIDER: 'nope' }, /UF_JOBS_PROVIDER=nope/],
    ['no bucket', { UF_S3_BUCKET: undefined }, /UF_S3_BUCKET/],
    ['an empty bucket', { UF_S3_BUCKET: '' }, /UF_S3_BUCKET/],
    ['a dotted bucket name', { UF_S3_BUCKET: 'uf.documents' }, /UF_S3_BUCKET/],
    ['a bad prefix', { UF_S3_PREFIX: '../up/' }, /UF_S3_PREFIX/],
    ['no AI key (the scripted AI is a stand-in)', { ANTHROPIC_API_KEY: undefined }, /ANTHROPIC/],
  ])('with %s, locally and in production', (_label, override, message) => {
    expect(() => readConfig({ ...local, ...override }, WITH_ADAPTER)).toThrow(message);
    expect(() => readConfig({ ...LIVE, ...override }, WITH_ADAPTER)).toThrow(ConfigError);
  });

  it('lets a local live run use another region, a KMS key and an S3-compatible server', () => {
    const config = readConfig(
      {
        ...local,
        UF_S3_REGION: 'eu-west-1',
        UF_S3_KMS_KEY_ID: 'alias/uf-documents',
        UF_S3_ENDPOINT: 'http://127.0.0.1:55491',
        UF_S3_PREFIX: '',
      },
      WITH_ADAPTER,
    );
    expect(config.s3).toEqual({
      bucket: 'uf-documents-test',
      region: 'eu-west-1',
      kmsKeyId: 'alias/uf-documents',
      prefix: '',
      endpoint: 'http://127.0.0.1:55491',
    });
  });

  it('has no S3, SMS provider or job scheduler in local mode', () => {
    expect(readConfig({})).toMatchObject({ s3: null, smsProvider: null, jobsProvider: null });
  });
});

describe('readConfig: messaging (Phase 4a)', () => {
  const local = { ...LIVE, VERCEL_ENV: undefined };

  it('offers WhatsApp and push in live mode only when their adapters are named', () => {
    expect(readConfig(LIVE, WITH_ADAPTER)).toMatchObject({
      whatsappProvider: null,
      pushProvider: null,
    });
    const adapters = {
      ...WITH_ADAPTER,
      whatsapp: ['test-wa'],
      push: ['test-push'],
      inbound: { sms: ['test-provider'], whatsapp: ['test-wa'] },
    };
    expect(
      readConfig(
        { ...LIVE, UF_WHATSAPP_PROVIDER: 'test-wa', UF_PUSH_PROVIDER: 'test-push' },
        adapters,
      ),
    ).toMatchObject({ whatsappProvider: 'test-wa', pushProvider: 'test-push' });
  });

  it.each([
    [
      'a WhatsApp provider with no adapter',
      { UF_WHATSAPP_PROVIDER: 'nope' },
      /UF_WHATSAPP_PROVIDER=nope/,
    ],
    ['a push provider with no adapter', { UF_PUSH_PROVIDER: 'nope' }, /UF_PUSH_PROVIDER=nope/],
  ])('refuses %s, never a stand-in in its place', (_label, override, message) => {
    expect(() => readConfig({ ...local, ...override }, WITH_ADAPTER)).toThrow(message);
    expect(() => readConfig({ ...LIVE, ...override }, WITH_ADAPTER)).toThrow(ConfigError);
  });

  it('A5-02: refuses a live SMS adapter that can send but not hear STOP, locally and in production', () => {
    const sendOnly = { sms: ['test-provider'], jobs: ['test-jobs'] };
    expect(() => readConfig(local, sendOnly)).toThrow(ConfigError);
    expect(() => readConfig(local, sendOnly)).toThrow(
      /UF_SMS_PROVIDER=test-provider can send but not receive/,
    );
    expect(() => readConfig(LIVE, sendOnly)).toThrow(ConfigError);
    // Receiving on another channel is not receiving on this one.
    expect(() =>
      readConfig(LIVE, { ...sendOnly, inbound: { whatsapp: ['test-provider'] } }),
    ).toThrow(/UF_SMS_PROVIDER=test-provider can send but not receive/);
  });

  it('A5-02: refuses a live WhatsApp adapter that can send but not hear STOP', () => {
    const env = { ...LIVE, UF_WHATSAPP_PROVIDER: 'test-wa' };
    const adapters = { ...WITH_ADAPTER, whatsapp: ['test-wa'] };
    expect(() => readConfig(env, adapters)).toThrow(
      /UF_WHATSAPP_PROVIDER=test-wa can send but not receive/,
    );
    expect(() => readConfig({ ...env, VERCEL_ENV: undefined }, adapters)).toThrow(ConfigError);
    expect(
      readConfig(env, { ...adapters, inbound: { sms: ['test-provider'], whatsapp: ['test-wa'] } })
        .whatsappProvider,
    ).toBe('test-wa');
  });

  it('A5-03/A11-06: refuses Expo push without EXPO_ACCESS_TOKEN, in production and in live mode', () => {
    const adapters = { ...WITH_ADAPTER, push: ['expo'] };
    const expo = { ...LIVE, UF_PUSH_PROVIDER: 'expo' };
    expect(() => readConfig(expo, adapters)).toThrow(ConfigError);
    expect(() => readConfig(expo, adapters)).toThrow(/EXPO_ACCESS_TOKEN/);
    expect(() => readConfig({ ...expo, EXPO_ACCESS_TOKEN: '' }, adapters)).toThrow(
      /EXPO_ACCESS_TOKEN/,
    );
    expect(() => readConfig({ ...expo, VERCEL_ENV: undefined }, adapters)).toThrow(
      /EXPO_ACCESS_TOKEN/,
    );
    expect(
      readConfig({ ...expo, EXPO_ACCESS_TOKEN: 'expo-test-token' }, adapters).pushProvider,
    ).toBe('expo');
  });

  it('A5-02/A5-03: local mode is unaffected: stand-ins receive, and push needs no Expo token', () => {
    expect(readConfig({ UF_PUSH_PROVIDER: 'expo' })).toMatchObject({
      providers: 'local',
      pushProvider: null,
      smsProvider: null,
    });
  });

  it('signs inbound webhooks with a development secret locally, and with none in production unless set', () => {
    expect(readConfig({}).messagingWebhookSecret).toMatch(/^.{32,}$/);
    expect(readConfig(LIVE, WITH_ADAPTER).messagingWebhookSecret).toBeNull();
    const secret = 'w'.repeat(40);
    expect(
      readConfig({ ...LIVE, UF_MESSAGING_WEBHOOK_SECRET: secret }, WITH_ADAPTER)
        .messagingWebhookSecret,
    ).toBe(secret);
  });

  it('refuses a short webhook secret, or the development one', () => {
    expect(() => readConfig({ UF_MESSAGING_WEBHOOK_SECRET: 'short' })).toThrow(ConfigError);
    const dev = readConfig({}).messagingWebhookSecret as string;
    expect(() => readConfig({ ...LIVE, UF_MESSAGING_WEBHOOK_SECRET: dev }, WITH_ADAPTER)).toThrow(
      ConfigError,
    );
  });
});

describe('readConfig: the store-review sign-in (A7-01, review-notes.md option A)', () => {
  // A synthetic number, built at runtime (hard rule 4), and a hash of the right shape.
  const PHONE = `082${'9000123'}`;
  const HASH = 'ab'.repeat(32);
  const NOW = new Date('2026-10-14T08:00:00Z');
  const REVIEW = {
    UF_REVIEW_PHONE: PHONE,
    UF_REVIEW_PIN_HASH: HASH,
    UF_REVIEW_UNTIL: '2026-10-20',
  };

  it('guard 1: is off when none of the variables is set', () => {
    expect(readConfig({}, undefined, NOW).review).toBeNull();
    expect(readConfig(LIVE, WITH_ADAPTER, NOW).review).toBeNull();
  });

  it('reads the number as E.164, the hash, and the last day (to the end of that day, SAST)', () => {
    expect(readConfig(REVIEW, undefined, NOW).review).toEqual({
      phone: `+27${PHONE.slice(1)}`,
      pinHash: HASH,
      until: new Date('2026-10-20T23:59:59.999+02:00'),
    });
  });

  it('guard 6: works in production with live providers, and never lets production use a stand-in', () => {
    expect(readConfig({ ...LIVE, ...REVIEW }, WITH_ADAPTER, NOW).review?.pinHash).toBe(HASH);
    expect(() =>
      readConfig({ ...LIVE, ...REVIEW, UF_PROVIDERS: 'local' }, WITH_ADAPTER, NOW),
    ).toThrow(/UF_PROVIDERS=live/);
  });

  it.each([
    ['no PIN hash', { UF_REVIEW_PIN_HASH: undefined }],
    ['no number', { UF_REVIEW_PHONE: undefined }],
    ['no last day (guard 4: it must expire)', { UF_REVIEW_UNTIL: undefined }],
    ['an empty PIN hash', { UF_REVIEW_PIN_HASH: '' }],
  ])('refuses to start with %s', (_label, override) => {
    expect(() => readConfig({ ...REVIEW, ...override }, undefined, NOW)).toThrow(
      /UF_REVIEW_PHONE, UF_REVIEW_PIN_HASH and UF_REVIEW_UNTIL/,
    );
  });

  it.each([
    ['a landline', { UF_REVIEW_PHONE: '0115550000' }, /UF_REVIEW_PHONE/],
    ['a PIN in the clear', { UF_REVIEW_PIN_HASH: '246810' }, /UF_REVIEW_PIN_HASH/],
    ['a short hash', { UF_REVIEW_PIN_HASH: 'ab'.repeat(31) }, /UF_REVIEW_PIN_HASH/],
    ['an upper-case hash', { UF_REVIEW_PIN_HASH: 'AB'.repeat(32) }, /UF_REVIEW_PIN_HASH/],
    ['a date that is not YYYY-MM-DD', { UF_REVIEW_UNTIL: '20/10/2026' }, /UF_REVIEW_UNTIL/],
    ['a date that does not exist', { UF_REVIEW_UNTIL: '2026-02-30' }, /UF_REVIEW_UNTIL/],
    ['a window longer than 31 days', { UF_REVIEW_UNTIL: '2026-11-30' }, /31 days/],
  ])('refuses %s', (_label, override, message) => {
    expect(() => readConfig({ ...REVIEW, ...override }, undefined, NOW)).toThrow(ConfigError);
    expect(() => readConfig({ ...REVIEW, ...override }, undefined, NOW)).toThrow(message);
  });

  it('accepts a last day already past: the sign-in is simply refused (guard 4)', () => {
    const config = readConfig({ ...REVIEW, UF_REVIEW_UNTIL: '2026-10-01' }, undefined, NOW);
    expect(config.review?.until.getTime()).toBeLessThan(NOW.getTime());
  });
});

describe('readConfig: the global SMS budget (open finding 1)', () => {
  it('defaults to a budget per hour and per day', () => {
    expect(readConfig({}).smsBudget).toEqual({ perHour: 300, perDay: 2000 });
  });

  it('reads the budget from the environment', () => {
    expect(
      readConfig({ UF_SMS_BUDGET_PER_HOUR: '50', UF_SMS_BUDGET_PER_DAY: '400' }).smsBudget,
    ).toEqual({ perHour: 50, perDay: 400 });
  });

  it.each([
    [{ UF_SMS_BUDGET_PER_HOUR: '0' }],
    [{ UF_SMS_BUDGET_PER_HOUR: '-5' }],
    [{ UF_SMS_BUDGET_PER_DAY: '1.5' }],
    [{ UF_SMS_BUDGET_PER_DAY: 'lots' }],
    [{ UF_SMS_BUDGET_PER_HOUR: '500', UF_SMS_BUDGET_PER_DAY: '100' }],
    [{ UF_SMS_REMINDER_BUDGET_PER_HOUR: '0' }],
    [{ UF_SMS_REMINDER_BUDGET_PER_DAY: 'lots' }],
    [{ UF_SMS_REMINDER_BUDGET_PER_HOUR: '500', UF_SMS_REMINDER_BUDGET_PER_DAY: '100' }],
  ])('refuses %j', (env) => {
    expect(() => readConfig(env)).toThrow(ConfigError);
  });

  it('A5-01: reminders have a budget of their own, read apart from sign-in’s', () => {
    expect(readConfig({}).smsReminderBudget).toEqual(DEFAULT_SMS_REMINDER_BUDGET);
    expect(DEFAULT_SMS_REMINDER_BUDGET).toEqual({ perHour: 1000, perDay: 4000 });
    const config = readConfig({
      UF_SMS_BUDGET_PER_HOUR: '5',
      UF_SMS_BUDGET_PER_DAY: '50',
      UF_SMS_REMINDER_BUDGET_PER_HOUR: '7',
      UF_SMS_REMINDER_BUDGET_PER_DAY: '70',
    });
    expect(config.smsBudget).toEqual({ perHour: 5, perDay: 50 });
    expect(config.smsReminderBudget).toEqual({ perHour: 7, perDay: 70 });
  });

  it('A12-15: WhatsApp, a paid channel, has a budget of its own (placeholders until the owner sets it)', () => {
    expect(readConfig({}).whatsappBudget).toEqual(DEFAULT_WHATSAPP_BUDGET);
    expect(DEFAULT_WHATSAPP_BUDGET).toEqual({ perHour: 500, perDay: 2000 });
    expect(
      readConfig({ UF_WHATSAPP_BUDGET_PER_HOUR: '3', UF_WHATSAPP_BUDGET_PER_DAY: '30' })
        .whatsappBudget,
    ).toEqual({ perHour: 3, perDay: 30 });
    for (const env of [
      { UF_WHATSAPP_BUDGET_PER_HOUR: '0' },
      { UF_WHATSAPP_BUDGET_PER_DAY: 'lots' },
      { UF_WHATSAPP_BUDGET_PER_HOUR: '500', UF_WHATSAPP_BUDGET_PER_DAY: '100' },
    ]) {
      expect(() => readConfig(env), JSON.stringify(env)).toThrow(ConfigError);
    }
  });
});

describe('readConfig: the Read aloud voice (ElevenLabs only, owner 2026-10-22)', () => {
  const VOICE = { ELEVENLABS_API_KEY: 'test-elevenlabs-key', ELEVENLABS_VOICE_ID: 'TestVoice0001' };

  it('is off, with no Read aloud at all, when no ElevenLabs key is set, locally or live', () => {
    expect(readConfig({}).voice).toBeNull();
    expect(readConfig(LIVE, WITH_ADAPTER).voice).toBeNull();
  });

  it('is on with a key and a voice, ElevenLabs’ default model unless one is named', () => {
    expect(readConfig(VOICE).voice).toEqual({ voiceId: 'TestVoice0001', modelId: null });
    expect(
      readConfig(
        {
          ...LIVE,
          ...VOICE,
          ELEVENLABS_MODEL_ID: 'eleven_flash_v2_5',
          UF_ELEVENLABS_MINORS_APPROVED: '1',
        },
        WITH_ADAPTER,
      ).voice,
    ).toEqual({ voiceId: 'TestVoice0001', modelId: 'eleven_flash_v2_5' });
  });

  it('A11-30: production refuses the voice until ElevenLabs’ written approval for under-18s is recorded', () => {
    expect(() => readConfig({ ...LIVE, ...VOICE }, WITH_ADAPTER)).toThrow(ConfigError);
    expect(() => readConfig({ ...LIVE, ...VOICE }, WITH_ADAPTER)).toThrow(
      /UF_ELEVENLABS_MINORS_APPROVED/,
    );
    expect(() =>
      readConfig({ ...LIVE, ...VOICE, UF_ELEVENLABS_MINORS_APPROVED: 'yes' }, WITH_ADAPTER),
    ).toThrow(/UF_ELEVENLABS_MINORS_APPROVED/);
    expect(
      readConfig({ ...LIVE, ...VOICE, UF_ELEVENLABS_MINORS_APPROVED: '1' }, WITH_ADAPTER).voice,
    ).toEqual({ voiceId: 'TestVoice0001', modelId: null });
  });

  it('A11-30: the owner’s local preview keeps the voice without the approval switch', () => {
    expect(readConfig(VOICE).voice).not.toBeNull();
    expect(readConfig({ ...VOICE, NODE_ENV: 'development' }).voice).not.toBeNull();
  });

  it('never keeps the key in the configuration', () => {
    expect(JSON.stringify(readConfig(VOICE))).not.toContain('test-elevenlabs-key');
  });

  it('live, a voice switched on without its key, or a key without a voice, refuses to start: never a silent fallback', () => {
    for (const partial of [
      { ELEVENLABS_VOICE_ID: 'TestVoice0001' },
      { ELEVENLABS_MODEL_ID: 'eleven_multilingual_v2' },
      { ELEVENLABS_API_KEY: 'test-elevenlabs-key' },
    ]) {
      expect(
        () => readConfig({ ...LIVE, ...partial }, WITH_ADAPTER),
        JSON.stringify(partial),
      ).toThrow(/ELEVENLABS/);
    }
  });

  it('locally, a key without a voice is a mistake; a voice without a key is simply off', () => {
    expect(() => readConfig({ ELEVENLABS_API_KEY: 'test-elevenlabs-key' })).toThrow(ConfigError);
    expect(readConfig({ ELEVENLABS_VOICE_ID: 'TestVoice0001' }).voice).toBeNull();
  });

  it('refuses a voice or model id that isn’t a plain identifier', () => {
    expect(() => readConfig({ ...VOICE, ELEVENLABS_VOICE_ID: '../v1/voices' })).toThrow(
      ConfigError,
    );
    expect(() => readConfig({ ...VOICE, ELEVENLABS_MODEL_ID: 'model?x=1' })).toThrow(ConfigError);
  });
});

describe('readConfig: the chat model’s provider (UF_AI_PROVIDER, owner 2026-10-23)', () => {
  const GEMINI_KEY = 'test-gemini-key-not-real';
  const STAGING = {
    NODE_ENV: 'production',
    RENDER: 'true',
    UF_DEPLOYMENT: 'staging',
    UF_PROVIDERS: 'local',
    AUTH_SECRET: 's'.repeat(44),
    UF_STAGING_PASSWORD: 'staging-test-password-0123',
  };

  it('is Anthropic unless it says otherwise, with Gemini’s documented model as its default', () => {
    expect(readConfig({})).toMatchObject({
      aiProvider: 'anthropic',
      geminiModel: GEMINI_DEFAULT_MODEL,
    });
    expect(readConfig(LIVE, WITH_ADAPTER).aiProvider).toBe('anthropic');
    expect(readConfig({ GEMINI_MODEL: 'gemini-test-model' }).geminiModel).toBe('gemini-test-model');
  });

  it('may be Gemini locally, in a local production build (E2E) and on staging with the stand-ins', () => {
    expect(readConfig({ UF_AI_PROVIDER: 'gemini' }).aiProvider).toBe('gemini');
    expect(
      readConfig({
        UF_AI_PROVIDER: 'gemini',
        NODE_ENV: 'production',
        UF_LOCAL_PRODUCTION_BUILD: '1',
      }).aiProvider,
    ).toBe('gemini');
    expect(readConfig({ ...STAGING, UF_AI_PROVIDER: 'gemini' }).aiProvider).toBe('gemini');
  });

  it('keeps the default model equal to the agent’s documented one', () => {
    expect(DEFAULT_GEMINI_MODEL).toBe(GEMINI_DEFAULT_MODEL);
  });

  it('refuses any other provider rather than guess', () => {
    expect(() => readConfig({ UF_AI_PROVIDER: 'openai' })).toThrow(/UF_AI_PROVIDER/);
    expect(() => readConfig({ UF_AI_PROVIDER: 'Gemini' })).toThrow(ConfigError);
  });

  it('production refuses Gemini: a new operator outside South Africa needs consent wording, the privacy page and legal review first', () => {
    expect(() => readConfig({ ...LIVE, UF_AI_PROVIDER: 'gemini' }, WITH_ADAPTER)).toThrow(
      ConfigError,
    );
    expect(() => readConfig({ ...LIVE, UF_AI_PROVIDER: 'gemini' }, WITH_ADAPTER)).toThrow(
      /Gemini is refused in production/,
    );
  });

  it('production refuses GEMINI_API_KEY too: an outage would otherwise send learners’ messages there', () => {
    expect(() => readConfig({ ...LIVE, GEMINI_API_KEY: GEMINI_KEY }, WITH_ADAPTER)).toThrow(
      /GEMINI_API_KEY is refused in production/,
    );
  });

  it('staging refuses GEMINI_API_KEY, a real provider’s key (A5-11), as it refuses Anthropic’s', () => {
    expect(() => readConfig({ ...STAGING, GEMINI_API_KEY: GEMINI_KEY })).toThrow(
      /synthetic data only: GEMINI_API_KEY/,
    );
  });

  it('live outside production, Gemini chosen needs its key: never a silent stand-in', () => {
    const live = { ...LIVE, VERCEL_ENV: undefined, UF_AI_PROVIDER: 'gemini' };
    expect(() => readConfig(live, WITH_ADAPTER)).toThrow(/needs GEMINI_API_KEY/);
    expect(readConfig({ ...live, GEMINI_API_KEY: GEMINI_KEY }, WITH_ADAPTER).aiProvider).toBe(
      'gemini',
    );
  });

  it('never keeps the Gemini key in the configuration', () => {
    const config = readConfig({ UF_AI_PROVIDER: 'gemini', GEMINI_API_KEY: GEMINI_KEY });
    expect(JSON.stringify(config)).not.toContain(GEMINI_KEY);
  });
});
