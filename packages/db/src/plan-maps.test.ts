import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Database, rowsOf } from './client';
import {
  ConsentRequiredError,
  InvalidStateError,
  NotFoundError,
  PersonalNumberError,
  PlanMapLimitError,
  PlanWordsError,
} from './errors';
import { PLAN_MAP_LIMITS, PLAN_POSITION_MAX, type PlanPartInput } from './plan-maps';
import { adultStudent, signIn, syntheticPhone, testDatabase, testStore } from './testing';

/**
 * My plan maps (migration 0030, docs/design/plan-maps-proposal.md). The learner's own words wait
 * for consent wording that names them, behind the owner's switch (D2): the store refuses them
 * unless the caller says the switch is on, and the database refuses them unless the store said so
 * for that one transaction. Choosing a template and ticking a status need only consent (hard rule
 * 5). Synthetic words only (hard rule 4).
 */

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(async () => {
  await database.close();
});

const WORDS = { words: true } as const;
const NO_WORDS = { words: false } as const;

/** A small template: a centre and three stops, the last with one step under it. */
const PARTS: PlanPartInput[] = [
  { ref: 'centre', parentRef: null, slotId: 'slot:centre', depth: 0, position: 0 },
  { ref: 'a', parentRef: 'centre', slotId: 'slot:grade-10', depth: 1, position: 0 },
  { ref: 'b', parentRef: 'centre', slotId: 'slot:grade-11', depth: 1, position: 1 },
  { ref: 'c', parentRef: 'centre', slotId: 'slot:matric', depth: 1, position: 2 },
  { ref: 'c1', parentRef: 'c', slotId: 'slot:matric-step', depth: 2, position: 0 },
];

async function adult() {
  const { store } = testStore(database);
  const session = await adultStudent(store);
  return { store, studentId: session.studentId, student: store.forStudent(session.studentId) };
}

async function withMap() {
  const learner = await adult();
  const map = await learner.student.createPlanMap({
    templateId: 'six-stops',
    linksGoal: true,
    parts: PARTS,
  });
  const bySlot = (slot: string) => map.nodes.find((n) => n.slotId === slot)?.id as string;
  return { ...learner, map, bySlot };
}

async function auditOf(studentId: string) {
  return rowsOf<{ action: string; reason: string | null }>(
    await database.db.execute(
      sql`select action, reason from audit_log where student_id = ${studentId}::uuid order by id`,
    ),
  );
}

describe('creating and reading a map', () => {
  it('creates the template’s parts in order, with no words, and reads them back', async () => {
    const { student, map } = await withMap();
    expect(map.templateId).toBe('six-stops');
    expect(map.title).toBeNull();
    expect(map.linksGoal).toBe(true);
    expect(map.nodes.map((n) => [n.slotId, n.depth, n.position])).toEqual([
      ['slot:centre', 0, 0],
      ['slot:grade-10', 1, 0],
      ['slot:grade-11', 1, 1],
      ['slot:matric', 1, 2],
      ['slot:matric-step', 2, 0],
    ]);
    expect(map.nodes.every((n) => n.status === 'planned' && n.text === null)).toBe(true);
    expect(await student.planMap(map.id)).toEqual(map);
    expect((await student.planMaps()).map((m) => m.id)).toEqual([map.id]);
  });

  it('refuses parts that are not one tree from one centre', async () => {
    const { student } = await adult();
    const create = (parts: PlanPartInput[]) =>
      student.createPlanMap({ templateId: 'six-stops', linksGoal: false, parts });
    await expect(create([])).rejects.toThrow(/centre/);
    await expect(
      create([PARTS[0] as PlanPartInput, { ...(PARTS[1] as PlanPartInput), parentRef: 'nowhere' }]),
    ).rejects.toThrow();
    await expect(
      create([PARTS[0] as PlanPartInput, { ...(PARTS[1] as PlanPartInput), depth: 2 }]),
    ).rejects.toThrow();
    await expect(
      student.createPlanMap({ templateId: 'Not An Id', linksGoal: false, parts: PARTS }),
    ).rejects.toThrow();
  });

  it('audits with fixed words and ids only', async () => {
    const { student, studentId, map, bySlot } = await withMap();
    await student.savePlanNode(map.id, bySlot('slot:grade-10'), { text: 'Synthetic words' }, WORDS);
    await student.deletePlanMap(map.id);
    const actions = (await auditOf(studentId)).filter((r) => r.action.startsWith('plan-map'));
    expect(actions).toEqual([
      { action: 'plan-map.created', reason: 'six-stops' },
      { action: 'plan-map.node-saved', reason: null },
      { action: 'plan-map.deleted', reason: null },
    ]);
  });
});

describe('who can see a map (row-level security, hard rule 5)', () => {
  it('another learner sees nothing and can change nothing', async () => {
    const { map, bySlot } = await withMap();
    const other = await adult();
    expect(await other.student.planMap(map.id)).toBeNull();
    expect(await other.student.planMaps()).toEqual([]);
    await expect(
      other.student.savePlanNode(map.id, bySlot('slot:grade-10'), { status: 'achieved' }, NO_WORDS),
    ).rejects.toThrow(NotFoundError);
    await expect(other.student.deletePlanMap(map.id)).rejects.toThrow(NotFoundError);
    await expect(
      other.student.addPlanNode(map.id, { parentId: bySlot('slot:centre') }, WORDS),
    ).rejects.toThrow(NotFoundError);
  });

  it('nothing is kept for a minor before a guardian consents', async () => {
    const { store } = testStore(database);
    const { studentId } = await signIn(store, syntheticPhone());
    await store.setDateOfBirth(studentId, '2011-03-03');
    const student = store.forStudent(studentId);
    await expect(
      student.createPlanMap({ templateId: 'six-stops', linksGoal: false, parts: PARTS }),
    ).rejects.toThrow(ConsentRequiredError);
    expect(await student.mayProcess()).toBe(false);
  });

  it('a minor whose guardian consented to today’s wording may choose a template and tick', async () => {
    const { store } = testStore(database);
    const { studentId } = await signIn(store, syntheticPhone());
    await store.setDateOfBirth(studentId, '2010-03-03');
    const { token } = await store.requestGuardianConsent(
      studentId,
      { name: 'Test Guardian', phone: syntheticPhone(), relationship: 'parent' },
      'v3-2026-10',
    );
    await store.grantConsent(token);
    const student = store.forStudent(studentId);
    const map = await student.createPlanMap({
      templateId: 'staircase',
      linksGoal: false,
      parts: PARTS,
    });
    const id = map.nodes[1]?.id as string;
    const saved = await student.savePlanNode(map.id, id, { status: 'achieved' }, NO_WORDS);
    expect(saved.status).toBe('achieved');
    await expect(student.savePlanNode(map.id, id, { text: 'Synthetic' }, NO_WORDS)).rejects.toThrow(
      PlanWordsError,
    );
  });
});

describe('the learner’s own words wait for the switch (D2)', () => {
  it('the store refuses words without the switch, and keeps statuses, order and targets', async () => {
    const { student, map, bySlot } = await withMap();
    const id = bySlot('slot:grade-10');
    for (const patch of [
      { text: 'Synthetic' },
      { whyNot: 'Synthetic' },
      { differently: 'Synthetic' },
    ]) {
      await expect(student.savePlanNode(map.id, id, patch, NO_WORDS)).rejects.toThrow(
        PlanWordsError,
      );
    }
    await expect(student.updatePlanMap(map.id, { title: 'Synthetic' }, NO_WORDS)).rejects.toThrow(
      PlanWordsError,
    );
    await expect(
      student.addPlanNode(map.id, { parentId: bySlot('slot:centre'), text: 'Synthetic' }, NO_WORDS),
    ).rejects.toThrow(PlanWordsError);
    const saved = await student.savePlanNode(
      map.id,
      id,
      { status: 'not-achieved', targetMonth: '2027-11' },
      NO_WORDS,
    );
    expect(saved).toMatchObject({ status: 'not-achieved', targetMonth: '2027-11', text: null });
    // Clearing words is always allowed.
    await student.savePlanNode(map.id, id, { text: null, whyNot: null }, NO_WORDS);
  });

  it('with the switch on, words are kept', async () => {
    const { student, map, bySlot } = await withMap();
    const id = bySlot('slot:grade-11');
    const saved = await student.savePlanNode(
      map.id,
      id,
      {
        text: 'Practise past papers',
        status: 'not-achieved',
        whyNot: 'Ran out of time',
        differently: 'Start earlier',
      },
      WORDS,
    );
    expect(saved).toMatchObject({
      text: 'Practise past papers',
      whyNot: 'Ran out of time',
      differently: 'Start earlier',
    });
    expect((await student.updatePlanMap(map.id, { title: 'My climb' }, WORDS)).title).toBe(
      'My climb',
    );
  });

  it('the database refuses words unless the store turned the switch on for that transaction', async () => {
    const { map, bySlot } = await withMap();
    const id = bySlot('slot:grade-10');
    await expect(
      database.exec(`update plan_map_nodes set text = 'Synthetic' where id = '${id}'`),
    ).rejects.toThrow(/consent does not cover/);
    await expect(
      database.exec(`update plan_maps set title = 'Synthetic' where id = '${map.id}'`),
    ).rejects.toThrow(/consent does not cover/);
    await database.exec(
      `begin; select set_config('uf.plan_words', 'preview', true); update plan_map_nodes set text = 'Synthetic' where id = '${id}'; commit;`,
    );
    // A status alone is never refused.
    await database.exec(`update plan_map_nodes set status = 'achieved' where id = '${id}'`);
  });
});

describe('checks on what is saved', () => {
  it('refuses an ID or student number in any words, in the store and in the database (A11-17)', async () => {
    const { student, map, bySlot } = await withMap();
    const id = bySlot('slot:grade-10');
    const idNumber = ['9001', '0150', '0908', '6'].join('');
    for (const patch of [
      { text: `My ID ${idNumber}` },
      { whyNot: `student number 2${'0'.repeat(6)}1` },
      { differently: idNumber },
    ]) {
      await expect(student.savePlanNode(map.id, id, patch, WORDS)).rejects.toThrow(
        PersonalNumberError,
      );
    }
    await expect(student.updatePlanMap(map.id, { title: idNumber }, WORDS)).rejects.toThrow(
      PersonalNumberError,
    );
    await expect(
      database.exec(
        `begin; select set_config('uf.plan_words', 'preview', true); update plan_map_nodes set why_not = '${idNumber}' where id = '${id}'; commit;`,
      ),
    ).rejects.toThrow(/plan_map_nodes_no_personal_number/);
    await database.exec('rollback');
  });

  it('refuses words past their lengths, and a target outside the sanity range', async () => {
    const { student, map, bySlot } = await withMap();
    const id = bySlot('slot:grade-10');
    await expect(
      student.savePlanNode(map.id, id, { text: 'x'.repeat(121) }, WORDS),
    ).rejects.toThrow();
    await expect(
      student.savePlanNode(map.id, id, { whyNot: 'x'.repeat(501) }, WORDS),
    ).rejects.toThrow();
    await expect(student.updatePlanMap(map.id, { title: 'x'.repeat(61) }, WORDS)).rejects.toThrow();
    await expect(
      student.savePlanNode(map.id, id, { targetMonth: '2019-12' }, WORDS),
    ).rejects.toThrow();
    await expect(
      student.savePlanNode(map.id, id, { targetMonth: '2027-13' }, WORDS),
    ).rejects.toThrow();
    expect(
      (await student.savePlanNode(map.id, id, { text: 'x'.repeat(120) }, WORDS)).text,
    ).toHaveLength(120);
  });

  it('dates a status change, and keeps the reflections when a part is achieved later', async () => {
    const { student, map, bySlot } = await withMap();
    const id = bySlot('slot:grade-11');
    await student.savePlanNode(
      map.id,
      id,
      { status: 'not-achieved', whyNot: 'Ran out of time' },
      WORDS,
    );
    const later = await student.savePlanNode(map.id, id, { status: 'achieved' }, WORDS);
    expect(later.status).toBe('achieved');
    expect(later.whyNot).toBe('Ran out of time');
    expect(later.statusChangedOn).toBe('2026-10-13');
  });
});

describe('the limits (D8)', () => {
  it('match the agreed numbers', () => {
    expect(PLAN_MAP_LIMITS).toEqual({
      maps: 10,
      nodes: 60,
      children: 12,
      depth: 3,
      text: 120,
      reflection: 500,
      title: 60,
    });
  });

  it('keeps ten maps at most, in the store and the database', async () => {
    const { student, studentId } = await adult();
    for (let i = 0; i < 10; i++) {
      await student.createPlanMap({
        templateId: 'six-stops',
        linksGoal: false,
        parts: PARTS.slice(0, 1),
      });
    }
    await expect(
      student.createPlanMap({
        templateId: 'six-stops',
        linksGoal: false,
        parts: PARTS.slice(0, 1),
      }),
    ).rejects.toThrow(PlanMapLimitError);
    await expect(
      database.exec(
        `insert into plan_maps (student_id, template_id) values ('${studentId}', 'six-stops')`,
      ),
    ).rejects.toThrow(/at most 10 plan maps/);
  });

  it('refuses a thirteenth part under one part, and a part below the third level', async () => {
    const { student, map, bySlot } = await withMap();
    const centre = bySlot('slot:centre');
    for (let i = 0; i < 9; i++) await student.addPlanNode(map.id, { parentId: centre }, NO_WORDS);
    await expect(student.addPlanNode(map.id, { parentId: centre }, NO_WORDS)).rejects.toMatchObject(
      {
        reason: 'too-many-children',
      },
    );
    const level2 = bySlot('slot:matric-step');
    const level3 = await student.addPlanNode(map.id, { parentId: level2 }, NO_WORDS);
    expect(level3.depth).toBe(3);
    await expect(
      student.addPlanNode(map.id, { parentId: level3.id }, NO_WORDS),
    ).rejects.toMatchObject({
      reason: 'too-deep',
    });
  });

  it('refuses a sixty-first part', async () => {
    const { student, map } = await withMap();
    const nodes = [...map.nodes];
    // Fill the centre, then each part at the first level, until the map is full.
    for (let i = 0; nodes.length < PLAN_MAP_LIMITS.nodes; i++) {
      const parent = nodes.filter((n) => n.depth <= 1)[i] as (typeof nodes)[number];
      while (
        nodes.length < PLAN_MAP_LIMITS.nodes &&
        nodes.filter((n) => n.parentId === parent.id).length < PLAN_MAP_LIMITS.children
      ) {
        nodes.push(await student.addPlanNode(map.id, { parentId: parent.id }, NO_WORDS));
      }
    }
    expect((await student.planMap(map.id))?.nodes).toHaveLength(60);
    const roomy = nodes.find((n) => n.depth === 1 && !nodes.some((c) => c.parentId === n.id));
    await expect(
      student.addPlanNode(map.id, { parentId: roomy?.id as string }, NO_WORDS),
    ).rejects.toMatchObject({ reason: 'too-many-nodes' });
  });
});

describe('moving and deleting parts', () => {
  it('moves up and down, renumbering the siblings', async () => {
    const { student, map, bySlot } = await withMap();
    const centre = bySlot('slot:centre');
    await student.movePlanNode(map.id, bySlot('slot:matric'), { parentId: centre, position: 0 });
    const after = await student.planMap(map.id);
    const order = after?.nodes
      .filter((n) => n.parentId === centre)
      .sort((a, b) => a.position - b.position);
    expect(order?.map((n) => n.slotId)).toEqual(['slot:matric', 'slot:grade-10', 'slot:grade-11']);
    expect(order?.map((n) => n.position)).toEqual([0, 1, 2]);
  });

  it('moves a part in and out a level with everything under it', async () => {
    const { student, map, bySlot } = await withMap();
    await student.movePlanNode(map.id, bySlot('slot:matric'), {
      parentId: bySlot('slot:grade-11'),
      position: 0,
    });
    let nodes = (await student.planMap(map.id))?.nodes ?? [];
    expect(nodes.find((n) => n.slotId === 'slot:matric')).toMatchObject({
      depth: 2,
      parentId: bySlot('slot:grade-11'),
    });
    expect(nodes.find((n) => n.slotId === 'slot:matric-step')?.depth).toBe(3);
    await student.movePlanNode(map.id, bySlot('slot:matric'), {
      parentId: bySlot('slot:centre'),
      position: 2,
    });
    nodes = (await student.planMap(map.id))?.nodes ?? [];
    expect(nodes.find((n) => n.slotId === 'slot:matric-step')?.depth).toBe(2);
  });

  it('refuses a move under itself, past the depth, of the centre, or to another map', async () => {
    const { student, map, bySlot } = await withMap();
    await expect(
      student.movePlanNode(map.id, bySlot('slot:matric'), {
        parentId: bySlot('slot:matric-step'),
        position: 0,
      }),
    ).rejects.toThrow();
    await expect(
      student.movePlanNode(map.id, bySlot('slot:centre'), {
        parentId: bySlot('slot:grade-10'),
        position: 0,
      }),
    ).rejects.toThrow();
    const deep = await student.addPlanNode(
      map.id,
      { parentId: bySlot('slot:matric-step') },
      NO_WORDS,
    );
    await expect(
      student.movePlanNode(map.id, bySlot('slot:matric'), {
        parentId: bySlot('slot:grade-10'),
        position: 0,
      }),
    ).rejects.toMatchObject({ reason: 'too-deep' });
    const other = await student.createPlanMap({
      templateId: 'six-stops',
      linksGoal: false,
      parts: PARTS,
    });
    await expect(
      student.movePlanNode(map.id, deep.id, {
        parentId: other.nodes[0]?.id as string,
        position: 0,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('deletes a part with everything under it, never the centre, and renumbers', async () => {
    const { student, map, bySlot } = await withMap();
    await expect(student.deletePlanNode(map.id, bySlot('slot:centre'))).rejects.toThrow();
    await student.deletePlanNode(map.id, bySlot('slot:grade-10'));
    await student.deletePlanNode(map.id, bySlot('slot:matric'));
    const nodes = (await student.planMap(map.id))?.nodes ?? [];
    expect(nodes.map((n) => [n.slotId, n.position])).toEqual([
      ['slot:centre', 0],
      ['slot:grade-11', 0],
    ]);
  });

  it('adds a part last under its parent, with its template children', async () => {
    const { student, map, bySlot } = await withMap();
    const added = await student.addPlanNode(
      map.id,
      {
        parentId: bySlot('slot:centre'),
        slotId: 'slot:habits',
        childSlots: ['slot:focus', 'slot:planning'],
      },
      NO_WORDS,
    );
    expect(added).toMatchObject({ slotId: 'slot:habits', depth: 1, position: 3 });
    const nodes = (await student.planMap(map.id))?.nodes ?? [];
    expect(nodes.filter((n) => n.parentId === added.id).map((n) => n.slotId)).toEqual([
      'slot:focus',
      'slot:planning',
    ]);
    await expect(
      student.addPlanNode(
        map.id,
        { parentId: bySlot('slot:centre'), slotId: 'slot:habits' },
        NO_WORDS,
      ),
    ).rejects.toThrow(/already/);
  });
});

describe('a map’s own name (RT-06, migration 0043)', () => {
  it('keeps the name a learner gives a new map, with the switch on', async () => {
    const { student } = await adult();
    const map = await student.createPlanMap(
      { templateId: 'staircase', linksGoal: false, parts: PARTS, title: '  My climb  ' },
      WORDS,
    );
    expect(map.title).toBe('My climb');
    expect((await student.planMap(map.id))?.title).toBe('My climb');
  });

  it('refuses a name without the switch, or one holding an ID number, and keeps no map', async () => {
    const { student } = await adult();
    await expect(
      student.createPlanMap(
        { templateId: 'staircase', linksGoal: false, parts: PARTS, title: 'My climb' },
        NO_WORDS,
      ),
    ).rejects.toThrow(PlanWordsError);
    await expect(
      student.createPlanMap(
        {
          templateId: 'staircase',
          linksGoal: false,
          parts: PARTS,
          title: ['9001', '0150', '0908', '6'].join(''),
        },
        WORDS,
      ),
    ).rejects.toThrow(PersonalNumberError);
    await expect(
      student.createPlanMap(
        { templateId: 'staircase', linksGoal: false, parts: PARTS, title: 'x'.repeat(61) },
        WORDS,
      ),
    ).rejects.toThrow();
    expect(await student.planMaps()).toEqual([]);
  });
});

describe('where each card sits on the canvas (RT-08, migration 0043)', () => {
  it('saves a card’s place and reads it back; the template’s parts start with none', async () => {
    const { student, map, bySlot } = await withMap();
    expect(map.nodes.every((n) => n.place === null)).toBe(true);
    await student.savePlanLayout(map.id, [
      { nodeId: bySlot('slot:grade-10'), x: 120, y: 48 },
      { nodeId: bySlot('slot:centre'), x: 600, y: 400 },
    ]);
    const nodes = (await student.planMap(map.id))?.nodes ?? [];
    expect(nodes.find((n) => n.slotId === 'slot:grade-10')?.place).toEqual({ x: 120, y: 48 });
    expect(nodes.find((n) => n.slotId === 'slot:centre')?.place).toEqual({ x: 600, y: 400 });
    expect(nodes.find((n) => n.slotId === 'slot:grade-11')?.place).toBeNull();
  });

  it('refuses a place off the canvas, not a whole number, or for a step inside a card', async () => {
    const { student, map, bySlot } = await withMap();
    const id = bySlot('slot:grade-10');
    for (const place of [
      { x: -1, y: 0 },
      { x: 0, y: PLAN_POSITION_MAX + 1 },
      { x: 1.5, y: 0 },
      { x: Number.NaN, y: 0 },
    ]) {
      await expect(student.savePlanLayout(map.id, [{ nodeId: id, ...place }])).rejects.toThrow(
        InvalidStateError,
      );
    }
    await expect(
      student.savePlanLayout(map.id, [{ nodeId: bySlot('slot:matric-step'), x: 0, y: 0 }]),
    ).rejects.toThrow(InvalidStateError);
    await expect(
      student.savePlanLayout(map.id, [
        { nodeId: '00000000-0000-4000-8000-000000000999', x: 0, y: 0 },
      ]),
    ).rejects.toThrow(NotFoundError);
    // The database holds the same bounds, and a place for a step at all.
    await expect(
      database.exec(`update plan_map_nodes set place_x = 0, place_y = 5000 where id = '${id}'`),
    ).rejects.toThrow(/plan_map_nodes_canvas_place/);
    await expect(
      database.exec(`update plan_map_nodes set place_x = 10 where id = '${id}'`),
    ).rejects.toThrow(/plan_map_nodes_canvas_place/);
    await expect(
      database.exec(
        `update plan_map_nodes set place_x = 0, place_y = 0 where id = '${bySlot('slot:matric-step')}'`,
      ),
    ).rejects.toThrow(/plan_map_nodes_canvas_place/);
  });

  it('a place is not the learner’s words: it needs only consent, and the audit says nothing else', async () => {
    const { student, studentId, map, bySlot } = await withMap();
    await student.savePlanLayout(map.id, [{ nodeId: bySlot('slot:grade-11'), x: 24, y: 24 }]);
    await student.resetPlanLayout(map.id);
    const actions = (await auditOf(studentId)).filter((r) =>
      r.action.startsWith('plan-map.layout'),
    );
    expect(actions).toEqual([
      { action: 'plan-map.layout-saved', reason: null },
      { action: 'plan-map.layout-reset', reason: null },
    ]);
  });

  it('Reset layout clears every place on the map, and no other map’s', async () => {
    const { student, map, bySlot } = await withMap();
    const other = await student.createPlanMap({
      templateId: 'the-road',
      linksGoal: false,
      parts: PARTS,
    });
    await student.savePlanLayout(map.id, [{ nodeId: bySlot('slot:grade-10'), x: 24, y: 24 }]);
    await student.savePlanLayout(other.id, [
      { nodeId: other.nodes[1]?.id as string, x: 48, y: 48 },
    ]);
    await student.resetPlanLayout(map.id);
    expect((await student.planMap(map.id))?.nodes.every((n) => n.place === null)).toBe(true);
    expect((await student.planMap(other.id))?.nodes[1]?.place).toEqual({ x: 48, y: 48 });
  });

  it('another learner can neither move nor reset a map’s cards', async () => {
    const { map, bySlot } = await withMap();
    const other = await adult();
    await expect(
      other.student.savePlanLayout(map.id, [{ nodeId: bySlot('slot:grade-10'), x: 0, y: 0 }]),
    ).rejects.toThrow(NotFoundError);
    await expect(other.student.resetPlanLayout(map.id)).rejects.toThrow(NotFoundError);
  });

  it('a card moved in a level, inside another card, loses its place', async () => {
    const { student, map, bySlot } = await withMap();
    await student.savePlanLayout(map.id, [{ nodeId: bySlot('slot:grade-11'), x: 240, y: 240 }]);
    await student.movePlanNode(map.id, bySlot('slot:grade-11'), {
      parentId: bySlot('slot:grade-10'),
      position: 0,
    });
    const moved = (await student.planMap(map.id))?.nodes.find((n) => n.slotId === 'slot:grade-11');
    expect(moved).toMatchObject({ depth: 2, place: null });
  });

  it('Download my data has each card’s place', async () => {
    const { student, map, bySlot } = await withMap();
    await student.savePlanLayout(map.id, [{ nodeId: bySlot('slot:grade-10'), x: 72, y: 96 }]);
    const exported = await student.exportAll();
    expect(JSON.stringify(exported.personal?.planMaps)).toMatch(/"placeX":72,"placeY":96/);
  });
});

describe('the learner’s rights (POPIA s23, s24)', () => {
  it('Download my data has every map with its parts and words', async () => {
    const { student, map, bySlot } = await withMap();
    await student.savePlanNode(map.id, bySlot('slot:grade-10'), { text: 'Synthetic words' }, WORDS);
    const exported = await student.exportAll();
    const maps = exported.personal?.planMaps ?? [];
    expect(maps).toHaveLength(1);
    expect(maps[0]?.id).toBe(map.id);
    expect(maps[0]?.nodes).toHaveLength(PARTS.length);
    expect(JSON.stringify(maps)).toContain('Synthetic words');
  });

  it('deleting a map or the account deletes every part', async () => {
    const { student, studentId, map } = await withMap();
    const count = async () =>
      rowsOf<{ n: number }>(
        await database.db.execute(
          sql`select (select count(*)::int from plan_map_nodes where student_id = ${studentId}::uuid) + (select count(*)::int from plan_maps where student_id = ${studentId}::uuid) as n`,
        ),
      )[0]?.n;
    await student.createPlanMap({ templateId: 'the-road', linksGoal: false, parts: PARTS });
    await student.deletePlanMap(map.id);
    expect(await count()).toBe(PARTS.length + 1);
    await student.deleteAccount();
    expect(await count()).toBe(0);
  });
});
