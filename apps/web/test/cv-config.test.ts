import { describe, expect, it } from 'vitest';
import { readConfig } from '../lib/server/config';

/**
 * My CV's switches (docs/design/mmereko-api-proposal.md §9.1, §10.2; D8): `UF_CV=1` is the
 * owner's preview only while the live consent wording is older than guardian v4 / adult-v3, so
 * production and staging refuse it; the judge demo may show it on the stand-in only, and never
 * calls Mmereko (D14; a hackathon exception of 2026-10-24). Once
 * the wording names Mmereko, live mode needs `UF_CV_PROVIDER` to name an adapter that exists
 * (CV_ADAPTERS is empty until Mmereko's sandbox passes the contract), and Mmereko's settings.
 */

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
const STAGING = {
  NODE_ENV: 'production',
  RENDER: 'true',
  UF_DEPLOYMENT: 'staging',
  UF_PROVIDERS: 'local',
  AUTH_SECRET: 's'.repeat(44),
  UF_STAGING_PASSWORD: 'staging-test-password-0123',
};
const DEMO = {
  NODE_ENV: 'production',
  VERCEL_ENV: 'production',
  UF_DEPLOYMENT: 'demo',
  UF_DEMO_PROJECT: '1',
  UF_PROVIDERS: 'local',
  AUTH_SECRET: 'd'.repeat(48),
  DATABASE_URL: 'postgres://demo@demo-db.example/uf?sslmode=verify-full',
  UF_DEMO_DATABASE: 'synthetic',
};
const MMEREKO = {
  UF_CV_PROVIDER: 'mmereko',
  MMEREKO_API_URL: 'https://partner.mmereko.example/partner/v1',
  MMEREKO_CLIENT_ID: 'uf-production',
  MMEREKO_CLIENT_SECRET: 'c'.repeat(48),
  MMEREKO_WEBHOOK_SECRET: 'w'.repeat(48),
  MMEREKO_REGION: 'af-south-1',
};
/** As if the live wording named Mmereko (it doesn't yet): what the switch then needs. */
const NAMED = { namesCv: true };
const now = new Date('2026-10-23T08:00:00Z');

describe('readConfig: UF_CV, the CV switch (D8)', () => {
  it('is off by default and on only for exactly 1, as the owner’s preview while the wording is older', () => {
    expect(readConfig({}).cv).toBe(false);
    expect(readConfig({ UF_CV: 'true' }).cv).toBe(false);
    const on = readConfig({ UF_CV: '1' });
    expect(on.cv).toBe(true);
    // The live wording doesn't name Mmereko, so the preview stands in for it.
    expect(on.cvPreview).toBe(true);
    expect(on.cvProvider).toBeNull();
    expect(
      readConfig({ NODE_ENV: 'production', UF_LOCAL_PRODUCTION_BUILD: '1', UF_CV: '1' }).cv,
    ).toBe(true);
  });

  it('is refused in production until consent v4 is live', () => {
    expect(() => readConfig({ ...LIVE, UF_CV: '1' }, WITH_ADAPTER)).toThrow(/UF_CV.*consent v4/);
    expect(readConfig(LIVE, WITH_ADAPTER).cv).toBe(false);
  });

  it('is refused on a staging site', () => {
    expect(readConfig(STAGING).cv).toBe(false);
    expect(() => readConfig({ ...STAGING, UF_CV: '1' })).toThrow(/UF_CV/);
  });

  // A hackathon exception (2026-10-24): the judge demo may show My CV on the stand-in only, and
  // still never calls Mmereko (D14). demo-features-config.test.ts holds the rest.
  it('on the judge demo, the stand-in only: Mmereko is never named there (D14)', () => {
    expect(readConfig(DEMO).cv).toBe(false);
    expect(readConfig({ ...DEMO, UF_CV: '1' })).toMatchObject({ cv: true, cvProvider: null });
    expect(() => readConfig({ ...DEMO, UF_CV: '1', ...MMEREKO })).toThrow(/UF_CV_PROVIDER/);
    expect(() => readConfig({ ...DEMO, MMEREKO_CLIENT_SECRET: 'c'.repeat(48) })).toThrow(
      /MMEREKO_CLIENT_SECRET/,
    );
  });

  it('keeps Mmereko’s settings off a staging site', () => {
    expect(() => readConfig({ ...STAGING, MMEREKO_WEBHOOK_SECRET: 'w'.repeat(48) })).toThrow(
      /MMEREKO_WEBHOOK_SECRET/,
    );
  });

  it('once the wording names Mmereko, production still needs an adapter that exists', () => {
    const env = { ...LIVE, UF_CV: '1' };
    expect(() => readConfig(env, WITH_ADAPTER, now, NAMED)).toThrow(/UF_CV_PROVIDER/);
    expect(() => readConfig({ ...env, ...MMEREKO }, WITH_ADAPTER, now, NAMED)).toThrow(
      /UF_CV_PROVIDER=mmereko has no adapter yet\. Available: none/,
    );
    const ok = readConfig({ ...env, ...MMEREKO }, { ...WITH_ADAPTER, cv: ['mmereko'] }, now, NAMED);
    expect(ok).toMatchObject({ cv: true, cvPreview: false, cvProvider: 'mmereko' });
    expect(ok.mmereko).toEqual({
      apiUrl: 'https://partner.mmereko.example/partner/v1',
      clientId: 'uf-production',
    });
    // Secrets are never kept in the configuration.
    expect(JSON.stringify(ok)).not.toContain('c'.repeat(48));
  });

  it('needs every Mmereko setting, an https URL and long secrets', () => {
    const env = { ...LIVE, UF_CV: '1', ...MMEREKO };
    const adapters = { ...WITH_ADAPTER, cv: ['mmereko'] };
    for (const missing of [
      'MMEREKO_API_URL',
      'MMEREKO_CLIENT_ID',
      'MMEREKO_CLIENT_SECRET',
      'MMEREKO_WEBHOOK_SECRET',
    ]) {
      expect(() => readConfig({ ...env, [missing]: undefined }, adapters, now, NAMED)).toThrow(
        new RegExp(missing),
      );
    }
    expect(() =>
      readConfig(
        { ...env, MMEREKO_API_URL: 'http://partner.mmereko.example' },
        adapters,
        now,
        NAMED,
      ),
    ).toThrow(/https/);
    expect(() =>
      readConfig({ ...env, MMEREKO_WEBHOOK_SECRET: 'short' }, adapters, now, NAMED),
    ).toThrow(/MMEREKO_WEBHOOK_SECRET/);
    expect(() =>
      readConfig({ ...env, MMEREKO_WEBHOOK_SECRET_NEXT: 'short' }, adapters, now, NAMED),
    ).toThrow(/MMEREKO_WEBHOOK_SECRET_NEXT/);
  });

  it('keeps learners’ CV data in South Africa: live Mmereko needs its partner cell declared in af-south-1 (D3, POPIA s72; A11-35)', () => {
    const env = { ...LIVE, UF_CV: '1', ...MMEREKO };
    const adapters = { ...WITH_ADAPTER, cv: ['mmereko'] };
    // Nothing in a URL says where a service runs: the owner declares it, and anything but Cape
    // Town is refused, so a re-plan of "student data stays in South Africa" is a code change.
    expect(() => readConfig({ ...env, MMEREKO_REGION: undefined }, adapters, now, NAMED)).toThrow(
      /MMEREKO_REGION.*af-south-1/,
    );
    for (const region of ['eu-west-1', 'us-east-1', 'AF-SOUTH-1 ', 'af-south-1x']) {
      expect(() => readConfig({ ...env, MMEREKO_REGION: region }, adapters, now, NAMED)).toThrow(
        /MMEREKO_REGION/,
      );
    }
    expect(readConfig(env, adapters, now, NAMED).cv).toBe(true);
    // A staging site and the demo never carry it (the rest of Mmereko's settings aren't there).
    expect(() => readConfig({ ...STAGING, MMEREKO_REGION: 'af-south-1' })).toThrow(
      /MMEREKO_REGION/,
    );
  });

  it('refuses a CV provider named without the switch, so a half-set configuration never starts', () => {
    expect(() => readConfig({ UF_CV_PROVIDER: 'mmereko' })).toThrow(/UF_CV_PROVIDER.*UF_CV=1/);
  });
});
