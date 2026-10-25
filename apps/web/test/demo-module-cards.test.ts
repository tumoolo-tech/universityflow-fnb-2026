import { confirmedModuleOutlineSchema } from '@universityflow/documents';
import { describe, expect, it, vi } from 'vitest';

/**
 * The judge demo's module cards (Phase 6c): each made-up university learner's first module gets
 * the SAMPLE outline (Phase 6b's), confirmed for their own module and year, and made-up marks that
 * fit it, so a judge sees the calculator working at once. Only DEMO modules are samples; the
 * curated subject areas are the demo's own.
 */

vi.mock('server-only', () => ({}));
const { demoModuleSubjectAreas, isDemoSampleModule, sampleConfirmedOutline } = await import(
  '../lib/server/demo/module-cards'
);

describe('the demo’s sample module cards', () => {
  it('confirms the SAMPLE outline for each year’s first module, in the registration’s year', () => {
    for (const [year, code, academicYear] of [
      [1, 'DEMO1001', 2027],
      [2, 'DEMO2001', 2026],
      [3, 'DEMO3001', 2026],
      [1, 'DEMO1001', 2028],
    ] as const) {
      const outline = sampleConfirmedOutline(year, code, academicYear);
      const parsed = confirmedModuleOutlineSchema.parse(outline);
      expect(parsed).toMatchObject({ moduleCode: code, academicYear });
      if (parsed.dates.status !== 'confirmed') throw new Error('no dates');
      for (const d of parsed.dates.items) expect(d.date.slice(0, 4)).toBe(String(academicYear));
      if (parsed.components.status !== 'confirmed') throw new Error('no components');
      expect(parsed.components.items.map((c) => [c.name, c.weight])).toEqual([
        ['Test 1', 15],
        ['Test 2', 15],
        ['Assignment', 10],
        ['Final examination', 60],
      ]);
    }
  });

  it('only a DEMO module is a sample, and only the demo’s courses get curated areas', () => {
    expect(isDemoSampleModule('DEMO1001')).toBe(true);
    expect(isDemoSampleModule('demo2003')).toBe(true);
    expect(isDemoSampleModule('TEST101')).toBe(false);
    expect(isDemoSampleModule('COMP100')).toBe(false);
    expect(demoModuleSubjectAreas('uj-bsc-it-computer-science')).toEqual(['computer-science']);
    expect(demoModuleSubjectAreas('uct-bsc-computer-science')).toEqual(['computer-science']);
    expect(demoModuleSubjectAreas('wits-bcom')).toEqual(['economics']);
    expect(demoModuleSubjectAreas('anything-else')).toEqual([]);
  });
});
