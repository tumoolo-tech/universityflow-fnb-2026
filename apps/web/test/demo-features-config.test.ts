import { describe, expect, it } from 'vitest';
import { BLANK_IN_PRODUCTION } from '../e2e/production-rehearsal-env';
import { ConfigError, readConfig } from '../lib/server/config';

/**
 * Three HACKATHON EXCEPTIONS the owner approved on 2026-10-24 for the judge demo only
 * (docs/deploy/demo.md "Hackathon exceptions", docs/deploy/hackathon-undo-pr.md): My CV on the
 * built-in stand-in engine (never Mmereko, D14), the learner's own words in a plan map, and Read
 * aloud (ElevenLabs) once the owner sets its key. A demo may switch each on; production, a
 * staging site and the production rehearsal still refuse each exactly as before.
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

const STAGING: Record<string, string | undefined> = {
  NODE_ENV: 'production',
  UF_DEPLOYMENT: 'staging',
  UF_PROVIDERS: 'local',
  AUTH_SECRET: 's'.repeat(44),
  UF_STAGING_PASSWORD: 'staging-test-password-0123',
};

const VOICE = { ELEVENLABS_API_KEY: 'el-test-key-not-real', ELEVENLABS_VOICE_ID: 'voice123' };

describe('the demo’s My CV, on the built-in stand-in only (a hackathon exception; D14)', () => {
  it('a demo may switch My CV on: the stand-in engine, the preview standing in for the wording', () => {
    const config = readConfig({ ...DEMO, UF_CV: '1' });
    expect(config).toMatchObject({ demo: true, cv: true, cvPreview: true, cvProvider: null });
    expect(config.mmereko).toBeNull();
  });

  it('never names a live CV engine on a demo: Mmereko is never called (D14)', () => {
    expect(() => readConfig({ ...DEMO, UF_CV: '1', UF_CV_PROVIDER: 'mmereko' })).toThrow(
      ConfigError,
    );
    expect(() => readConfig({ ...DEMO, UF_CV: '1', UF_CV_PROVIDER: 'mmereko' })).toThrow(
      /UF_CV_PROVIDER/,
    );
    for (const name of [
      'MMEREKO_API_URL',
      'MMEREKO_CLIENT_ID',
      'MMEREKO_CLIENT_SECRET',
      'MMEREKO_WEBHOOK_SECRET',
      'MMEREKO_REGION',
    ]) {
      expect(() => readConfig({ ...DEMO, UF_CV: '1', [name]: 'x'.repeat(40) })).toThrow(
        new RegExp(name),
      );
    }
  });

  it('production still refuses UF_CV while the live wording doesn’t name Mmereko', () => {
    expect(() => readConfig({ ...LIVE, UF_CV: '1' }, WITH_ADAPTER)).toThrow(/UF_CV/);
  });

  it('a staging site still refuses UF_CV', () => {
    expect(() => readConfig({ ...STAGING, UF_CV: '1' })).toThrow(/UF_CV/);
  });
});

describe('the demo’s plan-map words (a hackathon exception)', () => {
  it('a demo may let learners write their own words in a plan map', () => {
    expect(readConfig({ ...DEMO, UF_MINDMAP_WORDS: '1' }).mindmapWords).toBe(true);
    expect(readConfig(DEMO).mindmapWords).toBe(false);
  });

  it('production and staging still refuse UF_MINDMAP_WORDS', () => {
    expect(() => readConfig({ ...LIVE, UF_MINDMAP_WORDS: '1' }, WITH_ADAPTER)).toThrow(
      /UF_MINDMAP_WORDS/,
    );
    expect(() => readConfig({ ...STAGING, UF_MINDMAP_WORDS: '1' })).toThrow(/UF_MINDMAP_WORDS/);
  });
});

describe('the demo’s Read aloud (ElevenLabs; a hackathon exception)', () => {
  it('a demo with the key and a voice offers Read aloud', () => {
    expect(readConfig({ ...DEMO, ...VOICE }).voice).toEqual({
      voiceId: 'voice123',
      modelId: null,
    });
    expect(
      readConfig({ ...DEMO, ...VOICE, ELEVENLABS_MODEL_ID: 'eleven_multilingual_v2' }).voice,
    ).toEqual({ voiceId: 'voice123', modelId: 'eleven_multilingual_v2' });
  });

  it('without the key the demo is as it was: no Read aloud, and it still starts', () => {
    expect(readConfig(DEMO).voice).toBeNull();
    expect(readConfig({ ...DEMO, ELEVENLABS_VOICE_ID: 'voice123' }).voice).toBeNull();
  });

  it('a key without a voice is a mistake, refused rather than half-working', () => {
    expect(() => readConfig({ ...DEMO, ELEVENLABS_API_KEY: 'el-test-key-not-real' })).toThrow(
      /ELEVENLABS_VOICE_ID/,
    );
  });

  it('the production record of ElevenLabs’ approval for under-18s means nothing on a demo, and is refused there', () => {
    expect(() => readConfig({ ...DEMO, ...VOICE, UF_ELEVENLABS_MINORS_APPROVED: '1' })).toThrow(
      /UF_ELEVENLABS_MINORS_APPROVED/,
    );
  });

  it('production still keeps Read aloud off for learners until ElevenLabs approves under-18s (A11-30)', () => {
    expect(() => readConfig({ ...LIVE, ...VOICE }, WITH_ADAPTER)).toThrow(
      /UF_ELEVENLABS_MINORS_APPROVED/,
    );
  });

  it('a staging site still refuses the ElevenLabs key (A5-11)', () => {
    expect(() => readConfig({ ...STAGING, ...VOICE })).toThrow(/ELEVENLABS_API_KEY/);
  });
});

describe('the production rehearsal is untouched', () => {
  it('still blanks every one of the three switches and the voice', () => {
    for (const name of [
      'UF_CV',
      'UF_CV_PROVIDER',
      'UF_MINDMAP_WORDS',
      'ELEVENLABS_API_KEY',
      'ELEVENLABS_VOICE_ID',
      'ELEVENLABS_MODEL_ID',
    ]) {
      expect(BLANK_IN_PRODUCTION, name).toContain(name);
    }
  });
});
