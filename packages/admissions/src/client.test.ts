import { describe, expect, it, vi } from 'vitest';

/**
 * `@universityflow/admissions/client`: the mark maths a browser's calculator and the phone app run
 * offline (Phase 6c). It must load without the catalogue (its records and zod): the scheme is
 * resolved on the server and handed over, never the records (A4-02, A4-13). Each module that would
 * bring them is replaced by one that fails the moment it loads.
 */
const { loaded } = vi.hoisted(() => ({
  loaded: (name: string) => () => {
    throw new Error(`the client entry loaded ${name}`);
  },
}));
vi.mock('zod', loaded('zod'));
vi.mock('@universityflow/catalogue', loaded('the catalogue barrel'));
vi.mock('./assessment', loaded('the scheme resolver (catalogue records)'));
vi.mock('./index', loaded('the admissions barrel'));

describe('@universityflow/admissions/client', () => {
  it('runs the mark maths on a resolved scheme, without the catalogue', async () => {
    const client = await import('./client');
    const source = { level: 'outline' as const, academicYear: 2027, draft: false };
    const scheme = {
      universityId: 'uct' as const,
      moduleCode: 'TEST1001',
      academicYear: 2027,
      weighting: {
        value: {
          components: [
            { name: 'Test', kind: 'test' as const, weight: 40 },
            { name: 'Exam', kind: 'exam' as const, weight: 60 },
          ],
        },
        source,
      },
      otherRules: [],
      includesDrafts: false,
    };
    const marks = { components: [{ component: 'Test', percent: 70 }] };
    expect(client.yearMark(scheme, marks)).toMatchObject({ kind: 'known', yearMark: 70 });
    expect(client.dpStatus(scheme, marks).status).toBe('unknown');
    const needed = client.markNeeded(scheme, marks, { kind: 'own', percent: 60 });
    expect(needed.readings[0]?.result).toMatchObject({ kind: 'needed', shown: 54 });
    expect(client.supplementaryOutlook(scheme, 45).kind).toBe('unknown');
    expect(client.percentFromScore(18, 24)).toBe(75);
  });

  it('is exported as a subpath', async () => {
    const pkg = (await import('../package.json')).default as { exports: Record<string, string> };
    expect(pkg.exports['./client']).toBe('./src/client.ts');
  });
});
