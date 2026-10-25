import { describe, expect, it } from 'vitest';
import { ConfigError, LIVE_WORDING, readConfig } from '../lib/server/config';

/**
 * The profile photo's switch, ready for the day consent v4 is live (A11-31,
 * docs/deploy/profile-photo.md). While the live wording doesn't name the photo, `UF_PROFILE_PHOTO`
 * is the owner's preview only (`profilePhotoPreview` stands in for the wording in the database,
 * migration 0037) and production refuses it, saying why. Once the wording names it, production
 * may turn it on with nothing standing in. Staging never; the judge demo never (sample photos only).
 */

/** The live production settings cv-config.test.ts uses (synthetic values, no real account). */
const PRODUCTION: Record<string, string | undefined> = {
  // Production's own https address (A1-50).
  UF_PUBLIC_URL: 'https://universityflow.example',
  VERCEL_ENV: 'production',
  UF_PROVIDERS: 'live',
  AUTH_SECRET: 'x'.repeat(48),
  DATABASE_URL: 'postgres://user@db.example/uf',
  UF_S3_BUCKET: 'uf-documents-test',
  UF_SMS_PROVIDER: 'test-sms',
  UF_JOBS_PROVIDER: 'test-jobs',
  ANTHROPIC_API_KEY: 'test-key-not-real',
};
const ADAPTERS = {
  sms: ['test-sms'],
  jobs: ['test-jobs'],
  inbound: { sms: ['test-sms'] },
};
const NAMED = { namesCv: false, namesPhoto: true };
const NOT_NAMED = { namesCv: false, namesPhoto: false };
const NOW = new Date('2026-10-23T10:00:00Z');

describe('UF_PROFILE_PHOTO and the consent wording (A11-31)', () => {
  it('the live wording does not name the photo yet (guardian v3, adult-v2)', () => {
    expect(LIVE_WORDING.namesPhoto).toBe(false);
  });

  it('production starts without the switch, and refuses it until the wording names the photo', () => {
    expect(readConfig(PRODUCTION, ADAPTERS, NOW, NOT_NAMED)).toMatchObject({
      production: true,
      profilePhoto: false,
      profilePhotoPreview: false,
    });
    const on = { ...PRODUCTION, UF_PROFILE_PHOTO: '1' };
    expect(() => readConfig(on, ADAPTERS, NOW, NOT_NAMED)).toThrow(ConfigError);
    expect(() => readConfig(on, ADAPTERS, NOW, NOT_NAMED)).toThrow(/consent v4 and adult-v3/);
    expect(() => readConfig(on, ADAPTERS, NOW)).toThrow(/consent v4/);
  });

  it('once the wording names it, production turns it on in one step, with no preview', () => {
    const on = { ...PRODUCTION, UF_PROFILE_PHOTO: '1' };
    expect(readConfig(on, ADAPTERS, NOW, NAMED)).toMatchObject({
      production: true,
      profilePhoto: true,
      profilePhotoPreview: false,
    });
  });

  it('locally, before the wording, it is the owner’s preview (standing in for the wording)', () => {
    expect(readConfig({ UF_PROFILE_PHOTO: '1' }, ADAPTERS, NOW, NOT_NAMED)).toMatchObject({
      profilePhoto: true,
      profilePhotoPreview: true,
    });
    expect(readConfig({ UF_PROFILE_PHOTO: '1' }, ADAPTERS, NOW, NAMED)).toMatchObject({
      profilePhoto: true,
      profilePhotoPreview: false,
    });
    expect(readConfig({}, ADAPTERS, NOW, NOT_NAMED)).toMatchObject({
      profilePhoto: false,
      profilePhotoPreview: false,
    });
  });

  it('a staging site refuses it whatever the wording', () => {
    const staging = {
      NODE_ENV: 'production',
      RENDER: 'true',
      UF_DEPLOYMENT: 'staging',
      UF_PROVIDERS: 'local',
      AUTH_SECRET: 's'.repeat(44),
      UF_STAGING_PASSWORD: 'staging-test-password-0123',
      UF_PROFILE_PHOTO: '1',
    };
    expect(() => readConfig(staging, ADAPTERS, NOW, NAMED)).toThrow(/staging/);
  });
});
