import { describe, expect, it } from 'vitest';
import { ConfigError, readConfig } from '../lib/server/config';

/**
 * A1-50: production started without UF_PUBLIC_URL, and then every guardian consent link and every
 * link in an SMS pointed at http://localhost:3000, so no minor could ever be let in. The launch
 * checklist only asked the owner to check it by hand. Production now refuses to start without an
 * https address of its own.
 */

const LIVE: Record<string, string | undefined> = {
  VERCEL_ENV: 'production',
  UF_PROVIDERS: 'live',
  AUTH_SECRET: 'x'.repeat(48),
  DATABASE_URL: 'postgres://user@db.example/uf',
  UF_S3_BUCKET: 'uf-documents-test',
  UF_SMS_PROVIDER: 'test-provider',
  UF_JOBS_PROVIDER: 'test-jobs',
  ANTHROPIC_API_KEY: 'test-key-not-real',
  UF_PUBLIC_URL: 'https://universityflow.example',
};
const WITH_ADAPTER = {
  sms: ['test-provider'],
  jobs: ['test-jobs'],
  inbound: { sms: ['test-provider'] },
};

describe('A1-50: production needs its own https address (UF_PUBLIC_URL)', () => {
  it('starts with one', () => {
    expect(readConfig(LIVE, WITH_ADAPTER).publicUrl).toBe('https://universityflow.example');
  });

  it('refuses to start without one, rather than send guardians to localhost', () => {
    expect(() => readConfig({ ...LIVE, UF_PUBLIC_URL: undefined }, WITH_ADAPTER)).toThrow(
      ConfigError,
    );
    expect(() => readConfig({ ...LIVE, UF_PUBLIC_URL: '' }, WITH_ADAPTER)).toThrow(/UF_PUBLIC_URL/);
  });

  it('refuses http, this machine, and anything that isn’t a plain address', () => {
    for (const url of [
      'http://universityflow.example',
      'https://localhost:3000',
      'https://127.0.0.1',
      'universityflow.example',
      'https://universityflow.example/?x=1',
    ]) {
      expect(() => readConfig({ ...LIVE, UF_PUBLIC_URL: url }, WITH_ADAPTER), url).toThrow(
        /UF_PUBLIC_URL/,
      );
    }
  });

  it('leaves local development, staging and the demo as they were', () => {
    expect(readConfig({}).publicUrl).toBe('http://localhost:3000');
    expect(readConfig({ NODE_ENV: 'production', UF_LOCAL_PRODUCTION_BUILD: '1' }).publicUrl).toBe(
      'http://localhost:3000',
    );
  });
});
