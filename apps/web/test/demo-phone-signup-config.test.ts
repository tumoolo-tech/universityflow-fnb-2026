import { describe, expect, it } from 'vitest';
import { demoPhoneSignupOn } from '../lib/demo-phone-signup';
import { readConfig } from '../lib/server/config';

/**
 * The judge demo's on-screen phone sign-up (a HACKATHON EXCEPTION the owner approved on
 * 2026-10-24, docs/deploy/demo.md): `UF_DEMO_PHONE_SIGNUP=onscreen` lets judges sign up as a new
 * learner with a made-up 080 number, the PIN and the guardian's link shown on screen. Off unless
 * set (the demo exactly as before), demo only: production and staging refuse it.
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

describe('readConfig: the demo’s on-screen phone sign-up (UF_DEMO_PHONE_SIGNUP)', () => {
  it('is off unless set: the demo exactly as before', () => {
    expect(readConfig(DEMO).demoPhoneSignup).toBe(false);
    expect(readConfig({ ...DEMO, UF_DEMO_PHONE_SIGNUP: '' }).demoPhoneSignup).toBe(false);
    expect(demoPhoneSignupOn(DEMO)).toBe(false);
  });

  it('onscreen turns it on, on a demo', () => {
    const env = { ...DEMO, UF_DEMO_PHONE_SIGNUP: 'onscreen' };
    expect(readConfig(env).demoPhoneSignup).toBe(true);
    expect(demoPhoneSignupOn(env)).toBe(true);
  });

  it('any other value refuses to start (never a half-meant switch)', () => {
    for (const value of ['1', 'sms', 'on', 'ONSCREEN ']) {
      expect(() => readConfig({ ...DEMO, UF_DEMO_PHONE_SIGNUP: value }), value).toThrow(
        /UF_DEMO_PHONE_SIGNUP/,
      );
    }
    // A page never turns it on from a malformed value.
    expect(demoPhoneSignupOn({ ...DEMO, UF_DEMO_PHONE_SIGNUP: 'sms' })).toBe(false);
  });

  it('production refuses it (demo only)', () => {
    expect(() => readConfig(LIVE, WITH_ADAPTER)).not.toThrow();
    expect(() => readConfig({ ...LIVE, UF_DEMO_PHONE_SIGNUP: 'onscreen' }, WITH_ADAPTER)).toThrow(
      /UF_DEMO_PHONE_SIGNUP/,
    );
  });

  it('staging refuses it too', () => {
    expect(() => readConfig(STAGING)).not.toThrow();
    expect(() => readConfig({ ...STAGING, UF_DEMO_PHONE_SIGNUP: 'onscreen' })).toThrow(
      /UF_DEMO_PHONE_SIGNUP/,
    );
  });

  it('is never on outside a demo, even unset elsewhere', () => {
    expect(demoPhoneSignupOn({ UF_DEMO_PHONE_SIGNUP: 'onscreen' })).toBe(false);
  });
});
