import { describe, expect, it } from 'vitest';
import { ConfigError, isDemo, readConfig } from '../lib/server/config';

/**
 * Judge demo mode (UF_DEPLOYMENT=demo, docs/deploy/demo.md): a third deployment beside production
 * and staging. Its own Vercel project, made-up learners only, phone sign-in off, the real AI with
 * an optional daily cap. It must never be production, never carry production's providers or keys,
 * and production must never carry its markers.
 */

const DEMO: Record<string, string | undefined> = {
  NODE_ENV: 'production',
  VERCEL_ENV: 'production',
  UF_DEPLOYMENT: 'demo',
  UF_DEMO_PROJECT: '1',
  UF_PROVIDERS: 'local',
  AUTH_SECRET: 'd'.repeat(48),
  DATABASE_URL: 'postgres://demo@demo-db.example/uf?sslmode=verify-full',
  UF_DEMO_DATABASE: 'synthetic',
};

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
const WITH_ADAPTER = {
  sms: ['test-provider'],
  jobs: ['test-jobs'],
  inbound: { sms: ['test-provider'] },
};

describe('readConfig: the demo deployment (UF_DEPLOYMENT=demo)', () => {
  it('a production build on Vercel production that is neither production nor staging', () => {
    const config = readConfig(DEMO);
    expect(config.demo).toBe(true);
    expect(config.production).toBe(false);
    expect(config.staging).toBe(false);
    expect(config.providers).toBe('local');
    expect(isDemo(DEMO)).toBe(true);
    expect(isDemo({})).toBe(false);
  });

  it('allows the real AI keys (Anthropic, Gemini) and the catalogue drafts', () => {
    const config = readConfig({
      ...DEMO,
      ANTHROPIC_API_KEY: 'test-key-not-real',
      GEMINI_API_KEY: 'test-key-not-real',
      UF_CATALOGUE_PREVIEW: '1',
    });
    expect(config.catalogueDrafts).toBe(true);
  });

  it('may ask Gemini first (UF_AI_PROVIDER=gemini), on Vercel production, where production may not', () => {
    const gemini = { UF_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key-not-real' };
    const config = readConfig({ ...DEMO, ...gemini });
    expect(config.aiProvider).toBe('gemini');
    expect(config.production).toBe(false);
    expect(() => readConfig({ ...LIVE, ...gemini }, WITH_ADAPTER)).toThrow(/Gemini|GEMINI/);
  });

  it('staging still refuses the Gemini key', () => {
    const staging = {
      NODE_ENV: 'production',
      UF_DEPLOYMENT: 'staging',
      UF_PROVIDERS: 'local',
      AUTH_SECRET: 's'.repeat(44),
      UF_STAGING_PASSWORD: 'staging-test-password-0123',
    };
    expect(() => readConfig({ ...staging, GEMINI_API_KEY: 'test-key-not-real' })).toThrow(
      /GEMINI_API_KEY/,
    );
  });

  it('needs UF_DEMO_PROJECT=1, so the production project can never become a demo by one switch', () => {
    expect(() => readConfig({ ...DEMO, UF_DEMO_PROJECT: undefined })).toThrow(ConfigError);
    expect(() => readConfig({ ...DEMO, UF_DEMO_PROJECT: undefined })).toThrow(/UF_DEMO_PROJECT/);
  });

  it('refuses live providers', () => {
    expect(() => readConfig({ ...DEMO, UF_PROVIDERS: 'live' })).toThrow(/demo.*local/i);
  });

  it.each([
    ['UF_S3_BUCKET', 'uf-documents'],
    ['UF_S3_REGION', 'af-south-1'],
    ['AWS_ACCESS_KEY_ID', 'AKIA-not-real'],
    ['UF_SMS_PROVIDER', 'x'],
    ['UF_WHATSAPP_PROVIDER', 'x'],
    ['UF_PUSH_PROVIDER', 'expo'],
    ['UF_JOBS_PROVIDER', 'x'],
    ['UF_REVIEW_PHONE', 'x'],
    ['UF_REVIEW_PIN_HASH', 'x'],
    ['UF_REVIEW_UNTIL', '2026-11-01'],
    ['EXPO_ACCESS_TOKEN', 'x'],
    // ElevenLabs' key and UF_MINDMAP_WORDS are allowed on a demo since 2026-10-24 (hackathon
    // exceptions: demo-features-config.test.ts); production's approval record still isn't.
    ['UF_ELEVENLABS_MINORS_APPROVED', '1'],
    ['UF_MESSAGING_WEBHOOK_SECRET', 'w'.repeat(40)],
    ['UF_PROFILE_PHOTO', '1'],
    ['UF_STAGING_PASSWORD', 's'.repeat(20)],
  ])('refuses a real production marker: %s', (name, value) => {
    expect(() => readConfig({ ...DEMO, [name]: value })).toThrow(ConfigError);
    expect(() => readConfig({ ...DEMO, [name]: value })).toThrow(new RegExp(name));
  });

  // Vercel's functions run on AWS Lambda, which sets these three itself on every function; Vercel
  // reserves the names, so a project can't set them. On Vercel they are the platform's own, never
  // our keys: the demo refused itself there (2026-10-23, /api/health 503 on the live demo).
  const LAMBDA = {
    AWS_ACCESS_KEY_ID: 'ASIA-platform-not-real',
    AWS_SECRET_ACCESS_KEY: 'platform-not-real',
    AWS_SESSION_TOKEN: 'platform-not-real',
  };

  it("starts on Vercel, whose runtime sets AWS Lambda's own credentials on every function", () => {
    expect(() => readConfig({ ...DEMO, VERCEL: '1', ...LAMBDA })).not.toThrow();
  });

  it('still refuses AWS keys anywhere but Vercel', () => {
    expect(() => readConfig({ ...DEMO, ...LAMBDA })).toThrow(/AWS_ACCESS_KEY_ID/);
  });

  it('a Postgres database only with UF_DEMO_DATABASE=synthetic; the embedded one always', () => {
    expect(() => readConfig({ ...DEMO, UF_DEMO_DATABASE: undefined })).toThrow(
      /UF_DEMO_DATABASE=synthetic/,
    );
    expect(() => readConfig({ ...DEMO, UF_DEMO_DATABASE: 'yes' })).toThrow(
      /UF_DEMO_DATABASE=synthetic/,
    );
    expect(
      readConfig({ ...DEMO, DATABASE_URL: 'pglite:./.data/demo', UF_DEMO_DATABASE: undefined })
        .databaseUrl,
    ).toBe('pglite:./.data/demo');
  });

  it('on Vercel with no database set, the embedded one in /tmp (the only folder it may write)', () => {
    const config = readConfig({ ...DEMO, DATABASE_URL: undefined, UF_DEMO_DATABASE: undefined });
    expect(config.databaseUrl).toMatch(/^pglite:\/tmp\//);
    expect(config.fileStoreDir).toMatch(/^\/tmp\//);
  });

  it('keeps files in its own Postgres, since each Vercel instance has its own /tmp', () => {
    expect(readConfig(DEMO).filesInDatabase).toBe(true);
    expect(
      readConfig({
        ...DEMO,
        DATABASE_URL: 'postgresql://demo@demo-db.example/uf?sslmode=verify-full',
      }).filesInDatabase,
    ).toBe(true);
  });

  it('keeps files on disk with the embedded database (one process, one folder)', () => {
    const local = readConfig({ ...DEMO, DATABASE_URL: 'pglite:./.data/demo' });
    expect(local.filesInDatabase).toBe(false);
    const vercel = readConfig({ ...DEMO, DATABASE_URL: undefined, UF_DEMO_DATABASE: undefined });
    expect(vercel.filesInDatabase).toBe(false);
  });

  it('needs a long AUTH_SECRET', () => {
    expect(() => readConfig({ ...DEMO, AUTH_SECRET: undefined })).toThrow(/AUTH_SECRET/);
    expect(() => readConfig({ ...DEMO, AUTH_SECRET: 'short' })).toThrow(/AUTH_SECRET/);
  });

  it('the daily AI cap is off unless set, and a whole number when set', () => {
    expect(readConfig(DEMO).demoAiDailyCap).toBeNull();
    expect(readConfig({ ...DEMO, UF_DEMO_AI_DAILY_CAP: '' }).demoAiDailyCap).toBeNull();
    expect(readConfig({ ...DEMO, UF_DEMO_AI_DAILY_CAP: '250' }).demoAiDailyCap).toBe(250);
    expect(() => readConfig({ ...DEMO, UF_DEMO_AI_DAILY_CAP: 'lots' })).toThrow(
      /UF_DEMO_AI_DAILY_CAP/,
    );
  });

  it('a demo build has no messaging webhook secret, so no one can post to the inbound routes', () => {
    expect(readConfig(DEMO).messagingWebhookSecret).toBeNull();
  });

  it('still refuses Render, like everything but staging', () => {
    expect(() => readConfig({ ...DEMO, VERCEL_ENV: undefined, RENDER: 'true' })).toThrow(/Render/);
  });
});

describe('readConfig: the demo’s database on Supabase (owner’s decision, 2026-10-23)', () => {
  // The shape of Supabase's transaction pooler string (synthetic project ref and password).
  const POOLER =
    'postgresql://postgres.abcdefghijklmnopqrst:not-a-real-password@aws-0-eu-west-2.pooler.supabase.com:6543/postgres';
  const PEM = '-----BEGIN CERTIFICATE-----\nMIIBsynthetic\n-----END CERTIFICATE-----';

  it('takes the transaction pooler with Supabase’s CA: a small serverless pool, files in the database', () => {
    const config = readConfig({
      ...DEMO,
      DATABASE_URL: `${POOLER}?sslmode=verify-full`,
      DATABASE_CA_CERT: PEM,
    });
    expect(config.databaseUrl).toBe(`${POOLER}?sslmode=verify-full`);
    expect(config.databaseConnection).toEqual({
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
      ca: PEM,
    });
    expect(config.filesInDatabase).toBe(true);
  });

  it('reads a CA pasted on one line, with \\n for its line breaks', () => {
    const oneLine = PEM.replace(/\n/g, '\\n');
    expect(readConfig({ ...DEMO, DATABASE_CA_CERT: oneLine }).databaseConnection.ca).toBe(PEM);
  });

  it('refuses a CA that is not a PEM certificate', () => {
    expect(() => readConfig({ ...DEMO, DATABASE_CA_CERT: 'prod-ca-2021.crt' })).toThrow(
      /DATABASE_CA_CERT/,
    );
  });

  it('refuses a Postgres across the internet without TLS: its password and rows would travel in the clear', () => {
    for (const url of [POOLER, `${POOLER}?sslmode=disable`, `${POOLER}?sslmode=prefer`]) {
      expect(() => readConfig({ ...DEMO, DATABASE_URL: url }), url).toThrow(/TLS/);
    }
    for (const url of [
      `${POOLER}?sslmode=require`,
      `${POOLER}?sslmode=verify-full`,
      `${POOLER}?sslmode=no-verify`,
    ]) {
      expect(() => readConfig({ ...DEMO, DATABASE_URL: url }), url).not.toThrow();
    }
    expect(() =>
      readConfig({ ...DEMO, DATABASE_URL: POOLER, DATABASE_CA_CERT: PEM }),
    ).not.toThrow();
    // A demo run on this machine, on Docker's Postgres, needs none.
    expect(() =>
      readConfig({ ...DEMO, DATABASE_URL: 'postgres://uf:uf@127.0.0.1:56440/uf' }),
    ).not.toThrow();
    expect(() => readConfig({ ...DEMO, DATABASE_URL: 'postgres://uf@localhost/uf' })).not.toThrow();
  });

  // Vercel's Supabase integration sets POSTGRES_URL and friends, never DATABASE_URL: the demo
  // would quietly fall back to the embedded database in /tmp, one per instance, and sign judges out.
  it.each(['POSTGRES_URL', 'POSTGRES_PRISMA_URL', 'POSTGRES_URL_NON_POOLING'])(
    'refuses %s without DATABASE_URL, rather than fall back to /tmp',
    (name) => {
      const env = { ...DEMO, DATABASE_URL: undefined, UF_DEMO_DATABASE: undefined };
      expect(() => readConfig({ ...env, [name]: POOLER })).toThrow(/DATABASE_URL/);
    },
  );

  it('the embedded database and production keep the pool as it was', () => {
    expect(readConfig({ ...DEMO, DATABASE_URL: 'pglite:./.data/demo' }).databaseConnection).toEqual(
      { ca: null },
    );
    expect(readConfig(LIVE, WITH_ADAPTER).databaseConnection).toEqual({ ca: null });
  });
});

describe('readConfig: production and staging refuse the demo markers', () => {
  it.each([
    ['UF_DEMO_PROJECT', '1'],
    ['UF_DEMO_DATABASE', 'synthetic'],
    ['UF_DEMO_AI_DAILY_CAP', '300'],
    // The judge demo's university logos (owner's decision 2026-10-23, the hackathon only).
    ['NEXT_PUBLIC_UF_DEMO_LOGOS', '1'],
  ])('production refuses %s', (name, value) => {
    expect(() => readConfig({ ...LIVE, [name]: value }, WITH_ADAPTER)).toThrow(new RegExp(name));
    expect(() => readConfig(LIVE, WITH_ADAPTER)).not.toThrow();
  });

  it('staging refuses them too', () => {
    const staging = {
      NODE_ENV: 'production',
      UF_DEPLOYMENT: 'staging',
      UF_PROVIDERS: 'local',
      AUTH_SECRET: 's'.repeat(44),
      UF_STAGING_PASSWORD: 'staging-test-password-0123',
    };
    expect(() => readConfig(staging)).not.toThrow();
    expect(() => readConfig({ ...staging, UF_DEMO_PROJECT: '1' })).toThrow(/UF_DEMO_PROJECT/);
    expect(() => readConfig({ ...staging, NEXT_PUBLIC_UF_DEMO_LOGOS: '1' })).toThrow(
      /NEXT_PUBLIC_UF_DEMO_LOGOS/,
    );
  });

  it('a demo may show the universities’ logos', () => {
    expect(() => readConfig({ ...DEMO, NEXT_PUBLIC_UF_DEMO_LOGOS: '1' })).not.toThrow();
  });

  it('never keep files in the database: production is S3, staging and development disk', () => {
    expect(readConfig(LIVE, WITH_ADAPTER).filesInDatabase).toBe(false);
    const staging = {
      NODE_ENV: 'production',
      UF_DEPLOYMENT: 'staging',
      UF_PROVIDERS: 'local',
      AUTH_SECRET: 's'.repeat(44),
      UF_STAGING_PASSWORD: 'staging-test-password-0123',
    };
    expect(readConfig(staging).filesInDatabase).toBe(false);
    // Local development on Docker's Postgres keeps its folder.
    expect(
      readConfig({ DATABASE_URL: 'postgres://universityflow@localhost/universityflow' })
        .filesInDatabase,
    ).toBe(false);
  });

  it('an unknown deployment still refuses to start', () => {
    expect(() => readConfig({ UF_DEPLOYMENT: 'judges' })).toThrow(/UF_DEPLOYMENT/);
  });
});
