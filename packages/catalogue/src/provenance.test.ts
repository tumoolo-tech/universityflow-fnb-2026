import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { isDraft, isPublishable, type Provenance, provenanceSchema, sourced } from './provenance';

const valid: Provenance = {
  sourceUrl: 'https://www.example.ac.za/prospectus-2028.pdf',
  academicYear: 2028,
  verifiedOn: '2027-02-10',
  verifiedBy: 'Tumo Mogame',
};

const TODAY = new Date('2027-03-01T08:00:00Z');

describe('provenance (hard rule 3)', () => {
  it('publishes a fully sourced, verified record', () => {
    expect(isPublishable(valid, TODAY)).toBe(true);
  });

  it.each(['sourceUrl', 'academicYear', 'verifiedOn', 'verifiedBy'] as const)(
    'refuses a record missing %s',
    (field) => {
      const { [field]: _omitted, ...rest } = valid;
      expect(isPublishable(rest as Provenance, TODAY)).toBe(false);
    },
  );

  it('refuses a plain-HTTP source', () => {
    expect(isPublishable({ ...valid, sourceUrl: 'http://www.example.ac.za/p.pdf' }, TODAY)).toBe(
      false,
    );
  });

  it('refuses a verification dated after today', () => {
    expect(isPublishable({ ...valid, verifiedOn: '2027-03-02' }, TODAY)).toBe(false);
  });

  it('accepts a verification dated today', () => {
    expect(isPublishable({ ...valid, verifiedOn: '2027-03-01' }, TODAY)).toBe(true);
  });

  it('refuses a blank verifier', () => {
    expect(isPublishable({ ...valid, verifiedBy: '  ' }, TODAY)).toBe(false);
  });

  it('refuses an impossible date', () => {
    expect(isPublishable({ ...valid, verifiedOn: '2027-02-30' }, TODAY)).toBe(false);
  });

  it('holds a researched record as a draft until a person verifies it', () => {
    const { verifiedOn: _on, verifiedBy: _by, ...draft } = valid;
    expect(provenanceSchema.safeParse(draft).success).toBe(true);
    expect(isDraft(draft)).toBe(true);
    expect(isPublishable(draft, TODAY)).toBe(false);
    expect(isDraft(valid)).toBe(false);
  });

  it('adds provenance to any record type', () => {
    const programme = sourced({ name: z.string() });
    expect(programme.safeParse({ ...valid, name: 'BSc Engineering' }).success).toBe(true);
    expect(programme.safeParse({ name: 'BSc Engineering' }).success).toBe(false);
  });
});
