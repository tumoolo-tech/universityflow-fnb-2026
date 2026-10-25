import { describe, expect, it } from 'vitest';
import { readConfig } from '../lib/server/config';

/**
 * The judge demo's real sign-up switch (a hackathon exception the owner approved on 2026-10-23,
 * docs/deploy/demo.md) and the switch between the main site and the demo. `UF_DEMO_SIGNUP` and
 * the Firebase web values are demo-only: off unless set, refused in production and on staging.
 * `NEXT_PUBLIC_UF_DEMO_URL` (the main site's link to the demo) may be set anywhere, as an https URL;
 * `NEXT_PUBLIC_UF_MAIN_URL` (the demo's link back) is demo-only.
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

const FIREBASE = {
  UF_DEMO_SIGNUP: 'firebase',
  NEXT_PUBLIC_FIREBASE_API_KEY: `AIza${'x'.repeat(35)}`,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'uf-demo-test.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'uf-demo-test',
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

const STAGING = {
  NODE_ENV: 'production',
  UF_DEPLOYMENT: 'staging',
  UF_PROVIDERS: 'local',
  AUTH_SECRET: 's'.repeat(44),
  UF_STAGING_PASSWORD: 'staging-test-password-0123',
};

describe('readConfig: the demo’s real sign-up (UF_DEMO_SIGNUP)', () => {
  it('is off unless set: the demo behaves exactly as before', () => {
    expect(readConfig(DEMO).demoSignup).toBeNull();
    expect(readConfig({ ...DEMO, UF_DEMO_SIGNUP: '' }).demoSignup).toBeNull();
  });

  it('firebase, with the three web values', () => {
    expect(readConfig({ ...DEMO, ...FIREBASE }).demoSignup).toEqual({
      mode: 'firebase',
      firebase: {
        apiKey: FIREBASE.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: 'uf-demo-test.firebaseapp.com',
        projectId: 'uf-demo-test',
      },
    });
  });

  it.each([
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  ])('firebase without %s refuses to start', (name) => {
    expect(() => readConfig({ ...DEMO, ...FIREBASE, [name]: undefined })).toThrow(
      /NEXT_PUBLIC_FIREBASE/,
    );
  });

  it('refuses malformed values', () => {
    expect(() =>
      readConfig({ ...DEMO, ...FIREBASE, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'https://x.com/a' }),
    ).toThrow(/AUTH_DOMAIN/);
    expect(() =>
      readConfig({ ...DEMO, ...FIREBASE, NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'Has Spaces' }),
    ).toThrow(/PROJECT_ID/);
    expect(() =>
      readConfig({ ...DEMO, ...FIREBASE, NEXT_PUBLIC_FIREBASE_API_KEY: 'short' }),
    ).toThrow(/API_KEY/);
    expect(() => readConfig({ ...DEMO, UF_DEMO_SIGNUP: 'phone' })).toThrow(/UF_DEMO_SIGNUP/);
  });

  it('Firebase values without the switch refuse to start (never half on)', () => {
    const { UF_DEMO_SIGNUP: _, ...values } = FIREBASE;
    expect(() => readConfig({ ...DEMO, ...values })).toThrow(/UF_DEMO_SIGNUP/);
  });

  it('the fake runs locally only, never on a host', () => {
    const local = { ...DEMO, VERCEL_ENV: undefined, UF_DEMO_SIGNUP: 'fake' };
    expect(readConfig(local).demoSignup).toEqual({ mode: 'fake' });
    expect(() => readConfig({ ...DEMO, UF_DEMO_SIGNUP: 'fake' })).toThrow(/fake/);
    expect(() => readConfig({ ...local, RENDER: 'true' })).toThrow();
  });

  it.each([...Object.keys(FIREBASE), 'NEXT_PUBLIC_UF_MAIN_URL'])(
    'production refuses %s (demo only)',
    (name) => {
      const value =
        name === 'NEXT_PUBLIC_UF_MAIN_URL'
          ? 'https://universityflow.example'
          : FIREBASE[name as keyof typeof FIREBASE];
      expect(() => readConfig(LIVE, WITH_ADAPTER)).not.toThrow();
      expect(() => readConfig({ ...LIVE, [name]: value }, WITH_ADAPTER)).toThrow(new RegExp(name));
    },
  );

  it('staging refuses them too', () => {
    expect(() => readConfig(STAGING)).not.toThrow();
    expect(() => readConfig({ ...STAGING, UF_DEMO_SIGNUP: 'firebase' })).toThrow(/UF_DEMO_SIGNUP/);
    expect(() =>
      readConfig({ ...STAGING, NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'uf-demo-test' }),
    ).toThrow(/NEXT_PUBLIC_FIREBASE_PROJECT_ID/);
  });
});

describe('readConfig: the switch between the main site and the demo', () => {
  it('production may link to the demo: NEXT_PUBLIC_UF_DEMO_URL, an https URL', () => {
    expect(readConfig(LIVE, WITH_ADAPTER).demoUrl).toBeNull();
    const config = readConfig(
      { ...LIVE, NEXT_PUBLIC_UF_DEMO_URL: 'https://universityflow-demo.vercel.app/' },
      WITH_ADAPTER,
    );
    expect(config.demoUrl).toBe('https://universityflow-demo.vercel.app');
  });

  it.each(['http://universityflow-demo.vercel.app', 'not a url', 'https://a.example/?x=1'])(
    'refuses NEXT_PUBLIC_UF_DEMO_URL=%s',
    (value) => {
      expect(() => readConfig({ ...LIVE, NEXT_PUBLIC_UF_DEMO_URL: value }, WITH_ADAPTER)).toThrow(
        /NEXT_PUBLIC_UF_DEMO_URL/,
      );
    },
  );

  it('a demo may link back to the main site: NEXT_PUBLIC_UF_MAIN_URL, an https URL', () => {
    expect(readConfig(DEMO).mainUrl).toBeNull();
    expect(
      readConfig({ ...DEMO, NEXT_PUBLIC_UF_MAIN_URL: 'https://universityflow.example' }).mainUrl,
    ).toBe('https://universityflow.example');
    expect(() => readConfig({ ...DEMO, NEXT_PUBLIC_UF_MAIN_URL: 'http://x.example' })).toThrow(
      /NEXT_PUBLIC_UF_MAIN_URL/,
    );
  });
});
