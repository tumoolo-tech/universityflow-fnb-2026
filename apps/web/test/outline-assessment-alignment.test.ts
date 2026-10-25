import { ASSESSMENT_KINDS, assessmentComponentSchema } from '@universityflow/catalogue';
import { OUTLINE_COMPONENT_KINDS, type OutlineComponent } from '@universityflow/documents';
import { describe, expect, it } from 'vitest';

/**
 * A learner's confirmed module outline (6b, packages/documents) outranks the module's published
 * scheme (6a, packages/catalogue) in resolveScheme (D2), and the mark calculator (6c) takes either.
 * The two packages can't import each other, so their component shapes are held together here,
 * where the web app meets both: the same kinds, and every outline component a valid published one
 * once its "no subminimum printed" (null) becomes absent.
 */
describe('a module outline component and a published assessment component (Phase 6a/6b)', () => {
  it('have the same kinds, in the same order', () => {
    expect([...OUTLINE_COMPONENT_KINDS]).toEqual([...ASSESSMENT_KINDS]);
  });

  it('an outline component is a published component once a null subminimum is left out', () => {
    const outline: OutlineComponent[] = OUTLINE_COMPONENT_KINDS.map((kind, i) => ({
      name: `Part ${i + 1}`,
      kind,
      weight: 10,
      subminimum: i % 2 === 0 ? null : 40,
    }));
    for (const { subminimum, ...rest } of outline) {
      const asPublished = subminimum === null ? rest : { ...rest, subminimum };
      expect(assessmentComponentSchema.safeParse(asPublished).success, rest.kind).toBe(true);
    }
  });
});
