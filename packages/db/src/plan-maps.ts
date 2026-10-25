import { asc, eq, inArray, sql } from 'drizzle-orm';
import { sastDate } from './age';
import type { Db } from './client';
import {
  InvalidStateError,
  NotFoundError,
  PersonalNumberError,
  PlanMapLimitError,
  PlanWordsError,
} from './errors';
import { type PlanNodeStatus, planMapNodes, planMaps } from './schema';
import { holdsPersonalNumber } from './store';

/**
 * My plan maps (migration 0030, docs/design/plan-maps-proposal.md): the learner's mind maps under
 * My goal. `StudentStore` runs each of these in the learner's own transaction (row-level security
 * and the consent gate, hard rule 5), so another learner's map is simply not there.
 *
 * The learner's own words (a title, a part's text, what got in the way, what to try differently)
 * wait for consent wording that names them. Until a later migration names it, they are refused
 * unless the caller says the owner's preview switch is on (`words`, UF_MINDMAP_WORDS); the
 * database refuses them too unless that transaction said so (`uf.plan_words`). Statuses, order,
 * template stops and the learner's own target month need only consent.
 *
 * Audit rows carry fixed words and ids only (hard rule 4).
 */

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** The limits (D8): `packages/ui` PLAN_LIMITS holds the same, checked by a web test. */
export const PLAN_MAP_LIMITS = {
  maps: 10,
  nodes: 60,
  children: 12,
  depth: 3,
  text: 120,
  reflection: 500,
  title: 60,
} as const;

const PLAN_STATUSES: ReadonlyArray<PlanNodeStatus> = ['planned', 'achieved', 'not-achieved'];
const TEMPLATE_ID = /^[a-z0-9-]{1,40}$/;
const SLOT_ID = /^slot:[a-z0-9-]{1,40}$/;
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether the owner's switch lets the learner's own words through (D2). */
export interface PlanWords {
  readonly words: boolean;
}

/** One part of a new map: `ref` names it within the list, so a child can point at its parent. */
export interface PlanPartInput {
  readonly ref: string;
  readonly parentRef: string | null;
  readonly slotId: string;
  readonly depth: number;
  readonly position: number;
}

export interface PlanNodeRecord {
  readonly id: string;
  readonly mapId: string;
  readonly parentId: string | null;
  readonly depth: number;
  readonly position: number;
  readonly slotId: string | null;
  readonly text: string | null;
  readonly status: PlanNodeStatus;
  readonly whyNot: string | null;
  readonly differently: string | null;
  /** `YYYY-MM`: the learner's own aim, never a deadline. */
  readonly targetMonth: string | null;
  readonly statusChangedOn: string | null;
  readonly updatedAt: Date;
}

export interface PlanMapRecord {
  readonly id: string;
  readonly templateId: string;
  readonly title: string | null;
  readonly linksGoal: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** Parents before children, siblings in order. */
  readonly nodes: ReadonlyArray<PlanNodeRecord>;
}

export interface PlanNodePatch {
  readonly text?: string | null | undefined;
  readonly status?: PlanNodeStatus | undefined;
  readonly whyNot?: string | null | undefined;
  readonly differently?: string | null | undefined;
  /** `YYYY-MM`, or null to clear it. */
  readonly targetMonth?: string | null | undefined;
}

export interface NewPlanNode {
  readonly parentId: string;
  /** A template stop (put back, or an extra), or none: the learner's own part. */
  readonly slotId?: string | null;
  readonly text?: string | null | undefined;
  /** A stop's own stops, put back with it (a template group). */
  readonly childSlots?: ReadonlyArray<string>;
}

/** What each call needs from the learner's transaction. */
export interface PlanContext {
  readonly tx: Tx;
  readonly studentId: string;
  readonly now: Date;
  audit(action: string, reason?: string): Promise<void>;
}

type NodeRow = typeof planMapNodes.$inferSelect;
type MapRow = typeof planMaps.$inferSelect;

function toNode(row: NodeRow): PlanNodeRecord {
  return {
    id: row.id,
    mapId: row.mapId,
    parentId: row.parentId,
    depth: row.depth,
    position: row.position,
    slotId: row.slotId,
    text: row.text,
    status: row.status,
    whyNot: row.whyNot,
    differently: row.differently,
    targetMonth: row.targetMonth ? row.targetMonth.slice(0, 7) : null,
    statusChangedOn: row.statusChangedOn,
    updatedAt: row.updatedAt,
  };
}

/** Parents before children (by depth), then siblings in order: the order a tree is built in. */
function inTreeOrder(rows: ReadonlyArray<NodeRow>): NodeRow[] {
  return [...rows].sort(
    (a, b) =>
      a.depth - b.depth ||
      String(a.parentId).localeCompare(String(b.parentId)) ||
      a.position - b.position,
  );
}

function toMap(row: MapRow, nodes: ReadonlyArray<NodeRow>): PlanMapRecord {
  return {
    id: row.id,
    templateId: row.templateId,
    title: row.title,
    linksGoal: row.linksGoal,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    nodes: inTreeOrder(nodes.filter((n) => n.mapId === row.id)).map(toNode),
  };
}

/** The learner's maps, oldest first, each with its parts. */
export async function readPlanMaps(tx: Tx): Promise<PlanMapRecord[]> {
  const maps = await tx.select().from(planMaps).orderBy(asc(planMaps.createdAt), asc(planMaps.id));
  if (maps.length === 0) return [];
  const nodes = await tx
    .select()
    .from(planMapNodes)
    .where(
      inArray(
        planMapNodes.mapId,
        maps.map((m) => m.id),
      ),
    );
  return maps.map((m) => toMap(m, nodes));
}

/** One map with its parts, or null: not theirs, or not there. */
export async function readPlanMap(tx: Tx, id: string): Promise<PlanMapRecord | null> {
  if (!UUID.test(id)) return null;
  const [map] = await tx.select().from(planMaps).where(eq(planMaps.id, id));
  if (!map) return null;
  const nodes = await tx.select().from(planMapNodes).where(eq(planMapNodes.mapId, id));
  return toMap(map, nodes);
}

/** Every map as stored, for Download my data: the learner's words verbatim (POPIA s23). */
export async function exportPlanMaps(tx: Tx) {
  const maps = await tx.select().from(planMaps).orderBy(asc(planMaps.createdAt));
  const nodes = await tx.select().from(planMapNodes);
  return maps.map((m) => ({
    ...m,
    nodes: inTreeOrder(nodes.filter((n) => n.mapId === m.id)),
  }));
}

/** Empty or blank words are no words. `undefined` (not given) stays as it is. */
function cleanWords<T extends string | null | undefined>(value: T): T | null {
  if (value === undefined) return value;
  if (value === null) return null;
  const trimmed = value.trim();
  return (trimmed === '' ? null : trimmed) as T;
}

/**
 * Words must be allowed (the switch), short enough, and hold no ID or student number (A11-17).
 * When there are words to write, the database is told the switch is on for this transaction.
 */
async function checkWords(
  tx: Tx,
  words: ReadonlyArray<readonly [string | null | undefined, number]>,
  options: PlanWords,
): Promise<void> {
  const given = words.filter(([w]) => typeof w === 'string') as Array<readonly [string, number]>;
  if (given.length === 0) return;
  if (!options.words) throw new PlanWordsError();
  for (const [w, max] of given) {
    if (w.length > max) throw new InvalidStateError(`Words are at most ${max} characters`);
    if (holdsPersonalNumber(w)) throw new PersonalNumberError();
  }
  await tx.execute(sql`select set_config('uf.plan_words', 'preview', true)`);
}

async function lock(tx: Tx, key: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
}

async function lockedMap(ctx: PlanContext, mapId: string): Promise<PlanMapRecord> {
  if (!UUID.test(mapId)) throw new NotFoundError('No such plan map');
  await lock(ctx.tx, `plan-map:${mapId}`);
  const map = await readPlanMap(ctx.tx, mapId);
  if (!map) throw new NotFoundError('No such plan map');
  return map;
}

async function touch(ctx: PlanContext, mapId: string): Promise<void> {
  await ctx.tx.update(planMaps).set({ updatedAt: ctx.now }).where(eq(planMaps.id, mapId));
}

/** Checks a new map's parts are one tree from one centre, within the limits. */
function checkParts(parts: ReadonlyArray<PlanPartInput>): void {
  const [centre, ...rest] = parts;
  if (!centre || centre.parentRef !== null || centre.depth !== 0) {
    throw new InvalidStateError('A plan map starts with its centre');
  }
  if (parts.length > PLAN_MAP_LIMITS.nodes) throw new PlanMapLimitError('too-many-nodes');
  const seen = new Map<string, PlanPartInput>([[centre.ref, centre]]);
  const children = new Map<string, number>();
  for (const part of [centre, ...rest]) {
    if (!SLOT_ID.test(part.slotId)) throw new InvalidStateError('Not a template stop');
    if (part === centre) continue;
    const parent = part.parentRef === null ? undefined : seen.get(part.parentRef);
    if (!parent || seen.has(part.ref) || part.depth !== parent.depth + 1) {
      throw new InvalidStateError('A part sits one level below a part listed before it');
    }
    if (part.depth > PLAN_MAP_LIMITS.depth) throw new PlanMapLimitError('too-deep');
    const n = (children.get(parent.ref) ?? 0) + 1;
    if (n > PLAN_MAP_LIMITS.children) throw new PlanMapLimitError('too-many-children');
    children.set(parent.ref, n);
    seen.set(part.ref, part);
  }
}

export async function createPlanMap(
  ctx: PlanContext,
  input: {
    readonly templateId: string;
    readonly linksGoal: boolean;
    readonly parts: ReadonlyArray<PlanPartInput>;
  },
): Promise<PlanMapRecord> {
  if (!TEMPLATE_ID.test(input.templateId)) throw new InvalidStateError('Not a template id');
  checkParts(input.parts);
  const { tx } = ctx;
  await lock(tx, `plan-maps:${ctx.studentId}`);
  const [count] = await tx.select({ n: sql<number>`count(*)::int` }).from(planMaps);
  if ((count?.n ?? 0) >= PLAN_MAP_LIMITS.maps) throw new PlanMapLimitError('too-many-maps');
  const [map] = await tx
    .insert(planMaps)
    .values({
      studentId: ctx.studentId,
      templateId: input.templateId,
      linksGoal: input.linksGoal,
      createdAt: ctx.now,
      updatedAt: ctx.now,
    })
    .returning({ id: planMaps.id });
  if (!map) throw new Error('Could not save the plan map');
  const ids = new Map(input.parts.map((p) => [p.ref, crypto.randomUUID()]));
  // Parents first: each part's parent is inserted before it, in the same statement.
  const siblings = new Map<string, number>();
  await tx.insert(planMapNodes).values(
    input.parts.map((p) => {
      const key = p.parentRef ?? '';
      const position = siblings.get(key) ?? 0;
      siblings.set(key, position + 1);
      return {
        id: ids.get(p.ref) as string,
        mapId: map.id,
        studentId: ctx.studentId,
        parentId: p.parentRef === null ? null : (ids.get(p.parentRef) as string),
        depth: p.depth,
        position,
        slotId: p.slotId,
        status: 'planned' as const,
        createdAt: ctx.now,
        updatedAt: ctx.now,
      };
    }),
  );
  await ctx.audit('plan-map.created', input.templateId);
  return (await readPlanMap(tx, map.id)) as PlanMapRecord;
}

export async function updatePlanMap(
  ctx: PlanContext,
  id: string,
  patch: { readonly title?: string | null | undefined; readonly linksGoal?: boolean | undefined },
  options: PlanWords,
): Promise<PlanMapRecord> {
  await lockedMap(ctx, id);
  const title = cleanWords(patch.title);
  await checkWords(ctx.tx, [[title, PLAN_MAP_LIMITS.title]], options);
  await ctx.tx
    .update(planMaps)
    .set({
      ...(title === undefined ? {} : { title }),
      ...(patch.linksGoal === undefined ? {} : { linksGoal: patch.linksGoal }),
      updatedAt: ctx.now,
    })
    .where(eq(planMaps.id, id));
  await ctx.audit('plan-map.updated');
  return (await readPlanMap(ctx.tx, id)) as PlanMapRecord;
}

export async function deletePlanMap(ctx: PlanContext, id: string): Promise<void> {
  if (!UUID.test(id)) throw new NotFoundError('No such plan map');
  const rows = await ctx.tx
    .delete(planMaps)
    .where(eq(planMaps.id, id))
    .returning({ id: planMaps.id });
  if (rows.length === 0) throw new NotFoundError('No such plan map');
  await ctx.audit('plan-map.deleted');
}

function nodeIn(map: PlanMapRecord, nodeId: string): PlanNodeRecord {
  const node = map.nodes.find((n) => n.id === nodeId);
  if (!node) throw new NotFoundError('No such part of this plan map');
  return node;
}

export async function addPlanNode(
  ctx: PlanContext,
  mapId: string,
  input: NewPlanNode,
  options: PlanWords,
): Promise<PlanNodeRecord> {
  const map = await lockedMap(ctx, mapId);
  const parent = nodeIn(map, input.parentId);
  const childSlots = input.childSlots ?? [];
  const slotId = input.slotId ?? null;
  for (const slot of [...(slotId ? [slotId] : []), ...childSlots]) {
    if (!SLOT_ID.test(slot)) throw new InvalidStateError('Not a template stop');
    if (map.nodes.some((n) => n.slotId === slot)) {
      throw new InvalidStateError('That stop is already on this map');
    }
  }
  if (map.nodes.length + 1 + childSlots.length > PLAN_MAP_LIMITS.nodes) {
    throw new PlanMapLimitError('too-many-nodes');
  }
  if (parent.depth + (childSlots.length > 0 ? 2 : 1) > PLAN_MAP_LIMITS.depth) {
    throw new PlanMapLimitError('too-deep');
  }
  const position = map.nodes.filter((n) => n.parentId === parent.id).length;
  if (position >= PLAN_MAP_LIMITS.children || childSlots.length > PLAN_MAP_LIMITS.children) {
    throw new PlanMapLimitError('too-many-children');
  }
  const text = cleanWords(input.text) ?? null;
  await checkWords(ctx.tx, [[text, PLAN_MAP_LIMITS.text]], options);
  const id = crypto.randomUUID();
  const base = {
    mapId,
    studentId: ctx.studentId,
    status: 'planned' as const,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  await ctx.tx.insert(planMapNodes).values([
    { ...base, id, parentId: parent.id, depth: parent.depth + 1, position, slotId, text },
    ...childSlots.map((slot, i) => ({
      ...base,
      parentId: id,
      depth: parent.depth + 2,
      position: i,
      slotId: slot,
    })),
  ]);
  await touch(ctx, mapId);
  await ctx.audit('plan-map.node-added');
  const [row] = await ctx.tx.select().from(planMapNodes).where(eq(planMapNodes.id, id));
  return toNode(row as NodeRow);
}

/** `2027-11` to the first of that month, inside the sanity range; null clears it. */
function targetDate(month: string | null | undefined): string | null | undefined {
  if (month === undefined || month === null) return month;
  const m = MONTH.exec(month);
  const year = Number(m?.[1]);
  if (!m || year < 2020 || year > 2040) throw new InvalidStateError('Not a target month');
  return `${month}-01`;
}

export async function savePlanNode(
  ctx: PlanContext,
  mapId: string,
  nodeId: string,
  patch: PlanNodePatch,
  options: PlanWords,
): Promise<PlanNodeRecord> {
  const map = await lockedMap(ctx, mapId);
  const node = nodeIn(map, nodeId);
  if (patch.status !== undefined && !PLAN_STATUSES.includes(patch.status)) {
    throw new InvalidStateError('Not a status');
  }
  const targetMonth = targetDate(patch.targetMonth);
  const text = cleanWords(patch.text);
  const whyNot = cleanWords(patch.whyNot);
  const differently = cleanWords(patch.differently);
  await checkWords(
    ctx.tx,
    [
      [text, PLAN_MAP_LIMITS.text],
      [whyNot, PLAN_MAP_LIMITS.reflection],
      [differently, PLAN_MAP_LIMITS.reflection],
    ],
    options,
  );
  const statusChanged = patch.status !== undefined && patch.status !== node.status;
  await ctx.tx
    .update(planMapNodes)
    .set({
      ...(text === undefined ? {} : { text }),
      ...(whyNot === undefined ? {} : { whyNot }),
      ...(differently === undefined ? {} : { differently }),
      ...(targetMonth === undefined ? {} : { targetMonth }),
      ...(statusChanged ? { status: patch.status, statusChangedOn: sastDate(ctx.now) } : {}),
      updatedAt: ctx.now,
    })
    .where(eq(planMapNodes.id, nodeId));
  await touch(ctx, mapId);
  await ctx.audit('plan-map.node-saved');
  const [row] = await ctx.tx.select().from(planMapNodes).where(eq(planMapNodes.id, nodeId));
  return toNode(row as NodeRow);
}

/** The node and everything under it, the node first. */
function subtree(nodes: ReadonlyArray<PlanNodeRecord>, id: string): PlanNodeRecord[] {
  const out = nodes.filter((n) => n.id === id);
  for (let i = 0; i < out.length; i++) {
    for (const n of nodes) if (n.parentId === out[i]?.id) out.push(n);
  }
  return out;
}

/** Sets 0, 1, 2… on a list of siblings, in the order given. */
async function renumber(ctx: PlanContext, ids: ReadonlyArray<string>): Promise<void> {
  for (const [position, id] of ids.entries()) {
    await ctx.tx.update(planMapNodes).set({ position }).where(eq(planMapNodes.id, id));
  }
}

const siblingIds = (nodes: ReadonlyArray<PlanNodeRecord>, parentId: string | null) =>
  nodes
    .filter((n) => n.parentId === parentId)
    .sort((a, b) => a.position - b.position)
    .map((n) => n.id);

/**
 * Moves a part (and everything under it) to `position` among `parentId`'s parts: the keyboard's
 * up, down, in and out (§7). The centre never moves; a part can't go under itself.
 */
export async function movePlanNode(
  ctx: PlanContext,
  mapId: string,
  nodeId: string,
  to: { readonly parentId: string; readonly position: number },
): Promise<void> {
  const map = await lockedMap(ctx, mapId);
  const node = nodeIn(map, nodeId);
  if (node.parentId === null) throw new InvalidStateError('The centre stays where it is');
  const parent = nodeIn(map, to.parentId);
  const moving = subtree(map.nodes, node.id);
  if (moving.some((n) => n.id === parent.id)) {
    throw new InvalidStateError('A part can’t go under itself');
  }
  const shift = parent.depth + 1 - node.depth;
  if (Math.max(...moving.map((n) => n.depth)) + shift > PLAN_MAP_LIMITS.depth) {
    throw new PlanMapLimitError('too-deep');
  }
  const sameParent = node.parentId === parent.id;
  const target = siblingIds(map.nodes, parent.id).filter((id) => id !== node.id);
  if (!sameParent && target.length >= PLAN_MAP_LIMITS.children) {
    throw new PlanMapLimitError('too-many-children');
  }
  const at = Math.min(Math.max(0, Math.trunc(to.position)), target.length);
  target.splice(at, 0, node.id);
  if (!sameParent) {
    // The top first, then each level under it: every part's parent is already in place.
    await ctx.tx
      .update(planMapNodes)
      .set({ parentId: parent.id, depth: node.depth + shift, updatedAt: ctx.now })
      .where(eq(planMapNodes.id, node.id));
    for (const n of moving.slice(1)) {
      await ctx.tx
        .update(planMapNodes)
        .set({ depth: n.depth + shift })
        .where(eq(planMapNodes.id, n.id));
    }
    await renumber(
      ctx,
      siblingIds(map.nodes, node.parentId).filter((id) => id !== node.id),
    );
  }
  await renumber(ctx, target);
  await touch(ctx, mapId);
  await ctx.audit('plan-map.node-moved');
}

/** Deletes a part and everything under it. The centre stays: delete the map instead. */
export async function deletePlanNode(
  ctx: PlanContext,
  mapId: string,
  nodeId: string,
): Promise<void> {
  const map = await lockedMap(ctx, mapId);
  const node = nodeIn(map, nodeId);
  if (node.parentId === null) throw new InvalidStateError('The centre stays: delete the map');
  await ctx.tx.delete(planMapNodes).where(eq(planMapNodes.id, nodeId));
  await renumber(
    ctx,
    siblingIds(map.nodes, node.parentId).filter((id) => id !== node.id),
  );
  await touch(ctx, mapId);
  await ctx.audit('plan-map.node-deleted');
}
