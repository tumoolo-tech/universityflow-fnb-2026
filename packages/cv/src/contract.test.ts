import { createHash } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { verifyWebhook } from '@universityflow/messaging';
import { describe, expect, it } from 'vitest';
import { contractText, fixtures } from './fixtures';
import { cvProfileJsonSchema, cvProfileSchema, validateCvProfile } from './profile';
import { MMEREKO_SIGNATURE_HEADER, verifyCvWebhook } from './webhook';

/**
 * Mmereko's shared contract, vendored (packages/cv/contract/, SOURCE.json): every file is its
 * source, the TypeScript validator gives each golden profile case exactly Mmereko's problems, and
 * Mmereko's golden webhook vector verifies with UniversityFlow's own `verifyWebhook`.
 */

const ROOT = join(import.meta.dirname, '..', 'contract');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? files(full) : [relative(ROOT, full).split(sep).join('/')];
  });
}

describe('the vendored contract (SOURCE.json)', () => {
  const source = fixtures.source();

  it('names its source commit and holds every file the source had, and no other', () => {
    expect(source.commit).toMatch(/^[0-9a-f]{7,40}$/);
    expect(
      files(ROOT)
        .filter((f) => f !== 'SOURCE.json')
        .sort(),
    ).toEqual(Object.keys(source.sha256).sort());
  });

  it.each(Object.entries(fixtures.source().sha256))(
    '%s is its source, byte for byte',
    (file, sha) => {
      expect(createHash('sha256').update(contractText(file), 'utf8').digest('hex')).toBe(sha);
    },
  );
});

describe('the golden profile cases against the TypeScript validator (§6.3)', () => {
  it.each(fixtures.profileCases().map((c) => [c.fixture, c] as const))('%s', (_name, c) => {
    const check = validateCvProfile(fixtures.profile(c.fixture));
    expect(check.ok).toBe(c.valid);
    if (check.ok) return;
    expect([...check.issues].sort((a, b) => a.path.localeCompare(b.path))).toEqual(
      [...c.problems].sort((a, b) => a.path.localeCompare(b.path)),
    );
    const said = JSON.stringify(check.issues);
    for (const value of c.mustNotEcho ?? []) expect(said).not.toContain(value);
  });
});

describe('the JSON Schema (cv-profile.schema.json)', () => {
  it('is what UniversityFlow serves and documents', () => {
    expect(cvProfileJsonSchema()).toEqual(fixtures.schema());
  });

  it('names the same top-level sections and basics fields as the validator', () => {
    const schema = fixtures.schema() as {
      properties: Record<string, { properties?: Record<string, unknown> }>;
    };
    expect(Object.keys(schema.properties).sort()).toEqual(
      Object.keys(cvProfileSchema.shape).sort(),
    );
    expect(Object.keys(schema.properties['basics']?.properties ?? {}).sort()).toEqual(
      Object.keys(cvProfileSchema.shape.basics.shape).sort(),
    );
  });
});

describe('the webhook golden vector (§12 item 6)', () => {
  const vector = fixtures.vector();
  const at = new Date(vector.timestamp * 1000 + 60_000);

  it('verifies with UniversityFlow’s verifyWebhook, unchanged', () => {
    expect(vector.channel).toBe('mmereko');
    expect(verifyWebhook(vector.secret, 'mmereko', vector.header, vector.body, at)).toBe(true);
    expect(vector.header).toBe(`t=${vector.timestamp},v1=${vector.signature}`);
  });

  it('is read as a cv.ready for its job, and refused when stale or for another channel', () => {
    const headers = { get: (n: string) => (n === MMEREKO_SIGNATURE_HEADER ? vector.header : null) };
    const verified = verifyCvWebhook([vector.secret], headers, vector.body, at);
    expect(verified?.event).toMatchObject({
      type: 'cv.ready',
      jobId: '6a1d9c0e-3b4f-4a5e-8c7d-9e0f1a2b3c4d',
      learnerRef: '3f0c2a9e-6b7d-4e21-9a0f-1c2d3e4f5a6b',
      id: '0b9f3c1e-5d2a-4c7b-9e8f-1a2b3c4d5e6f',
    });
    const late = new Date(vector.timestamp * 1000 + 6 * 60_000);
    expect(verifyCvWebhook([vector.secret], headers, vector.body, late)).toBeNull();
    expect(verifyWebhook(vector.secret, 'sms', vector.header, vector.body, at)).toBe(false);
  });
});
