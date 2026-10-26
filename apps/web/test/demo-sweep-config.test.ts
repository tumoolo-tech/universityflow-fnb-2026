import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ConfigError,
  MIN_CRON_SECRET_LENGTH,
  readConfig,
  readCronSecret,
} from '../lib/server/config';

/**
 * A11-61: the judge demo's scheduled sweep is a Vercel cron (apps/web/vercel.json) calling a
 * demo-only route guarded by Vercel's `CRON_SECRET`. The secret is a demo switch like every
 * `UF_DEMO_*`: production and staging refuse to start with it (a cron-driven sweep route is never
 * theirs), a demo refuses a short one, and the cron entry must point at the route.
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

const STAGING = {
  NODE_ENV: 'production',
  UF_DEPLOYMENT: 'staging',
  UF_PROVIDERS: 'local',
  AUTH_SECRET: 's'.repeat(44),
  UF_STAGING_PASSWORD: 'staging-test-password-0123',
};

/** A test value, built here, never a real secret. */
const SECRET = `cron-test-${'c'.repeat(MIN_CRON_SECRET_LENGTH)}`;

describe('readConfig: CRON_SECRET is a demo switch', () => {
  it('production refuses to start with CRON_SECRET: no cron-driven sweep route exists there', () => {
    expect(() => readConfig({ ...LIVE, CRON_SECRET: SECRET }, WITH_ADAPTER)).toThrow(ConfigError);
    expect(() => readConfig({ ...LIVE, CRON_SECRET: SECRET }, WITH_ADAPTER)).toThrow(
      /CRON_SECRET.*demo deployment, never in production/,
    );
    expect(() => readConfig(LIVE, WITH_ADAPTER)).not.toThrow();
  });

  it('staging refuses it too, and so does a local run (a demo setting copied by mistake)', () => {
    expect(() => readConfig({ ...STAGING, CRON_SECRET: SECRET })).toThrow(
      /CRON_SECRET.*demo deployment, never on a staging site/,
    );
    expect(() => readConfig(STAGING)).not.toThrow();
    expect(() => readConfig({ CRON_SECRET: SECRET })).toThrow(/CRON_SECRET/);
  });

  it('a demo starts with or without it, and refuses one shorter than 32 characters', () => {
    expect(() => readConfig(DEMO)).not.toThrow();
    expect(() => readConfig({ ...DEMO, CRON_SECRET: SECRET })).not.toThrow();
    expect(() =>
      readConfig({ ...DEMO, CRON_SECRET: 'x'.repeat(MIN_CRON_SECRET_LENGTH - 1) }),
    ).toThrow(/CRON_SECRET must be at least 32/);
    expect(MIN_CRON_SECRET_LENGTH).toBe(32);
  });

  it('readCronSecret: null when unset or blank, the value when long enough, a ConfigError when short', () => {
    expect(readCronSecret({})).toBeNull();
    expect(readCronSecret({ CRON_SECRET: '   ' })).toBeNull();
    expect(readCronSecret({ CRON_SECRET: SECRET })).toBe(SECRET);
    expect(() => readCronSecret({ CRON_SECRET: 'short' })).toThrow(ConfigError);
  });
});

describe('the cron entry (apps/web/vercel.json)', () => {
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
    crons?: Array<{ path: string; schedule: string }>;
  };

  it('calls /api/demo/sweep on a schedule valid on every Vercel plan (at most once a day, at a fixed hour)', () => {
    const entry = vercel.crons?.find((c) => c.path === '/api/demo/sweep');
    expect(entry, 'a crons entry for /api/demo/sweep').toBeTruthy();
    // Five fields; the minute and hour fixed, the days every day. Hobby allows once a day only
    // (docs/deploy/demo.md "The scheduled sweep"): an hourly or `*/n` schedule fails the deploy.
    expect(entry?.schedule).toMatch(/^(?:[0-5]?\d) (?:[01]?\d|2[0-3]) \* \* \*$/);
  });

  it('is a hackathon exception with its undo written down', () => {
    const undo = readFileSync(
      new URL('../../../docs/deploy/hackathon-undo-pr.md', import.meta.url),
      'utf8',
    );
    expect(undo).toMatch(/^### M\. The demo's scheduled sweep/m);
    expect(undo).toContain('CRON_SECRET');
    expect(undo).toContain('/api/demo/sweep');
  });

  it('the route exists, is wrapped in handler(), and bounds its own duration', () => {
    const source = readFileSync(new URL('../app/api/demo/sweep/route.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/export const GET = handler\(/);
    expect(source).toMatch(/export const maxDuration = \d+;/);
  });
});
