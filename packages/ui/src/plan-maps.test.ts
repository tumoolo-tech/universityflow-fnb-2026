import { planMaps } from '@universityflow/content';
import { describe, expect, it } from 'vitest';
import {
  allSlots,
  canAddChild,
  isPlanTemplateId,
  missingSlots,
  outlineOf,
  PLAN_LIMITS,
  PLAN_LINKS,
  PLAN_STATUSES,
  PLAN_TEMPLATE_IDS,
  PLAN_TEMPLATES,
  type PlanNode,
  planCounts,
  planMove,
  planTemplate,
  slotKey,
  slotWords,
  subtreeIds,
  templateSeed,
} from './plan-maps';

/** A node as the API returns it; synthetic, ids only. */
function node(
  id: string,
  parentId: string | null,
  position: number,
  extra: Partial<PlanNode> = {},
) {
  const depth = extra.depth ?? (parentId === null ? 0 : 1);
  return {
    id,
    parentId,
    position,
    depth,
    slotId: null,
    text: null,
    status: 'planned',
    whyNot: null,
    differently: null,
    targetMonth: null,
    ...extra,
  } satisfies PlanNode;
}

describe('plan map templates (proposal §2)', () => {
  it('are five, in the order the picker shows them', () => {
    expect(PLAN_TEMPLATE_IDS).toEqual([
      'six-stops',
      'thinking-cloud',
      'staircase',
      'life-map',
      'the-road',
    ]);
    expect(PLAN_TEMPLATES.map((t) => t.id)).toEqual([...PLAN_TEMPLATE_IDS]);
    expect(isPlanTemplateId('six-stops')).toBe(true);
    expect(isPlanTemplateId('mind-palace')).toBe(false);
    expect(isPlanTemplateId(7)).toBe(false);
  });

  it('three statuses, Planned first', () => {
    expect(PLAN_STATUSES).toEqual(['planned', 'achieved', 'not-achieved']);
  });

  it('give every slot words, and every word a slot', () => {
    for (const t of PLAN_TEMPLATES) {
      const words = planMaps.templates[t.id].slots;
      const keys = allSlots(t).map((s) => s.key);
      expect(Object.keys(words).sort(), t.id).toEqual([...keys].sort());
      for (const key of keys) {
        expect(slotWords(t.id, `slot:${key}`)?.heading, `${t.id} ${key}`).toBeTruthy();
      }
    }
  });

  it('never use one slot id twice in a template, and every id is storable', () => {
    for (const t of PLAN_TEMPLATES) {
      const keys = allSlots(t).map((s) => s.key);
      expect(new Set(keys).size, t.id).toBe(keys.length);
      for (const key of ['centre', ...keys])
        expect(`slot:${key}`).toMatch(/^slot:[a-z0-9-]{1,40}$/);
    }
    expect(slotKey('slot:grade-10')).toBe('grade-10');
    expect(slotKey(null)).toBeNull();
    expect(slotKey('grade-10')).toBeNull();
  });

  it('fit their own limits: depth, children per node and nodes per map, extras included', () => {
    for (const t of PLAN_TEMPLATES) {
      const all = allSlots(t);
      expect(all.length + 1, t.id).toBeLessThanOrEqual(PLAN_LIMITS.nodes);
      for (const s of all)
        expect(s.depth, `${t.id} ${s.key}`).toBeLessThanOrEqual(PLAN_LIMITS.depth);
      const byParent = new Map<string, number>();
      for (const s of all) byParent.set(s.parent, (byParent.get(s.parent) ?? 0) + 1);
      for (const [parent, n] of byParent) {
        expect(n, `${t.id} ${parent}`).toBeLessThanOrEqual(PLAN_LIMITS.children);
      }
    }
  });

  it('link only to the pages that compute a fact (hard rule 2, §6)', () => {
    expect(Object.keys(PLAN_LINKS).sort()).toEqual(
      ['applications', 'goal', 'modules', 'offers', 'results', 'subjects'].sort(),
    );
    for (const t of PLAN_TEMPLATES) {
      for (const s of allSlots(t)) if (s.link) expect(PLAN_LINKS[s.link]).toMatch(/^\/[a-z-]+$/);
    }
    // Matric links to where the learner stands; Applying to the dates and documents.
    const six = planTemplate('six-stops');
    expect(allSlots(six).find((s) => s.key === 'matric')?.link).toBe('goal');
    expect(allSlots(six).find((s) => s.key === 'applying')?.link).toBe('applications');
  });

  it('seed a new map with the centre and the default slots, never the extras', () => {
    const seed = templateSeed('staircase');
    expect(seed[0]).toEqual({
      ref: 'centre',
      parentRef: null,
      slotId: 'slot:centre',
      depth: 0,
      position: 0,
    });
    const steps = seed.filter((s) => s.parentRef === 'centre');
    expect(steps.map((s) => s.slotId)).toEqual([
      'slot:where-i-am-now',
      'slot:finish-grade-10',
      'slot:finish-grade-11',
      'slot:write-matric',
      'slot:get-in',
      'slot:pass-first-year',
      'slot:each-year-after',
      'slot:graduate',
    ]);
    expect(steps.map((s) => s.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(seed.some((s) => s.slotId === 'slot:habits')).toBe(false);
    expect(seed.some((s) => s.slotId === 'slot:before-grade-10')).toBe(false);
    // The life map's path has its own steps, a level down.
    const life = templateSeed('life-map');
    const path = life.find((s) => s.slotId === 'slot:my-path');
    expect(life.filter((s) => s.parentRef === path?.ref).map((s) => s.depth)).toEqual(
      Array(6).fill(2),
    );
  });
});

describe('outlineOf (proposal §7: one list in reading order)', () => {
  it('orders by position and nests by parent', () => {
    const nodes = [
      node('c', null, 0),
      node('b', 'c', 1),
      node('a', 'c', 0),
      node('a2', 'a', 1, { depth: 2 }),
      node('a1', 'a', 0, { depth: 2 }),
    ];
    const outline = outlineOf(nodes);
    expect(outline?.node.id).toBe('c');
    expect(outline?.children.map((c) => c.node.id)).toEqual(['a', 'b']);
    expect(outline?.children[0]?.children.map((c) => c.node.id)).toEqual(['a1', 'a2']);
  });

  it('is null without a centre, and leaves out a node whose parent is gone', () => {
    expect(outlineOf([])).toBeNull();
    const outline = outlineOf([node('c', null, 0), node('x', 'missing', 0)]);
    expect(outline?.children).toEqual([]);
  });

  it('lists a subtree, the node first', () => {
    const nodes = [node('c', null, 0), node('a', 'c', 0), node('a1', 'a', 0, { depth: 2 })];
    expect(subtreeIds(nodes, 'a')).toEqual(['a', 'a1']);
  });

  it('counts by status, the centre left out', () => {
    const nodes = [
      node('c', null, 0, { status: 'achieved' }),
      node('a', 'c', 0, { status: 'achieved' }),
      node('b', 'c', 1, { status: 'not-achieved' }),
      node('d', 'c', 2),
    ];
    expect(planCounts(nodes)).toEqual({ planned: 1, achieved: 1, notAchieved: 1 });
  });
});

describe('the limits (D8)', () => {
  it('are ten maps, sixty nodes, twelve children, depth three, 120 / 500 / 60 characters', () => {
    expect(PLAN_LIMITS).toEqual({
      maps: 10,
      nodes: 60,
      children: 12,
      depth: 3,
      text: 120,
      reflection: 500,
      title: 60,
      firstYear: 2020,
      lastYear: 2040,
    });
  });

  it('refuse a thirteenth child, a fourth level and a sixty-first node', () => {
    const centre = node('c', null, 0);
    const twelve = Array.from({ length: 12 }, (_, i) => node(`n${i}`, 'c', i));
    expect(canAddChild([centre, ...twelve.slice(0, 11)], 'c')).toBeNull();
    expect(canAddChild([centre, ...twelve], 'c')).toBe('too-many-children');
    const deep = [
      centre,
      node('a', 'c', 0),
      node('b', 'a', 0, { depth: 2 }),
      node('d', 'b', 0, { depth: 3 }),
    ];
    expect(canAddChild(deep, 'b')).toBeNull();
    expect(canAddChild(deep, 'd')).toBe('too-deep');
    const sixty = [centre, ...Array.from({ length: 59 }, (_, i) => node(`m${i}`, 'c', i))];
    expect(canAddChild(sixty, 'm0')).toBe('too-many-nodes');
    expect(canAddChild([centre], 'missing')).toBe('not-found');
  });
});

describe('planMove (keyboard moves, proposal §7)', () => {
  const nodes = [
    node('c', null, 0),
    node('a', 'c', 0),
    node('b', 'c', 1),
    node('b1', 'b', 0, { depth: 2 }),
    node('d', 'c', 2),
  ];

  it('moves up and down among siblings', () => {
    expect(planMove(nodes, 'b', 'up')).toEqual({ parentId: 'c', position: 0 });
    expect(planMove(nodes, 'b', 'down')).toEqual({ parentId: 'c', position: 2 });
    expect(planMove(nodes, 'a', 'up')).toBeNull();
    expect(planMove(nodes, 'd', 'down')).toBeNull();
  });

  it('moves in under the sibling before, last, and out after its parent', () => {
    expect(planMove(nodes, 'd', 'in')).toEqual({ parentId: 'b', position: 1 });
    expect(planMove(nodes, 'a', 'in')).toBeNull();
    expect(planMove(nodes, 'b1', 'out')).toEqual({ parentId: 'c', position: 2 });
    // A branch of the centre can't move out: the centre is the one root.
    expect(planMove(nodes, 'a', 'out')).toBeNull();
    expect(planMove(nodes, 'c', 'up')).toBeNull();
  });

  it('refuses a move that takes a subtree past the depth limit, or a parent past its children', () => {
    const deep = [
      node('c', null, 0),
      node('a', 'c', 0),
      node('b', 'c', 1),
      node('b1', 'b', 0, { depth: 2 }),
      node('b2', 'b1', 0, { depth: 3 }),
    ];
    expect(planMove(deep, 'b', 'in')).toBe('too-deep');
    const full = [
      node('c', null, 0),
      node('a', 'c', 0),
      ...Array.from({ length: 12 }, (_, i) => node(`k${i}`, 'a', i, { depth: 2 })),
      node('z', 'c', 1),
    ];
    expect(planMove(full, 'z', 'in')).toBe('too-many-children');
  });
});

describe('missingSlots ("Add a stop from this template")', () => {
  it('offers a removed slot and the extras, under a parent that is there', () => {
    const seed = templateSeed('six-stops');
    const ids = new Map(seed.map((s, i) => [s.ref, `id${i}`]));
    const nodes: PlanNode[] = seed
      .filter((s) => s.slotId !== 'slot:matric')
      .map((s) =>
        node(
          ids.get(s.ref) as string,
          s.parentRef ? (ids.get(s.parentRef) as string) : null,
          s.position,
          {
            depth: s.depth,
            slotId: s.slotId,
          },
        ),
      );
    const missing = missingSlots('six-stops', nodes).map((m) => m.slotId);
    expect(missing).toContain('slot:matric');
    expect(missing).toContain('slot:before-grade-10');
    expect(missing).not.toContain('slot:grade-10');
    for (const m of missingSlots('six-stops', nodes)) expect(m.parentId).toBe('id0');
  });
});
