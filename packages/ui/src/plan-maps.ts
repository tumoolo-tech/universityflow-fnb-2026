/**
 * My plan maps (docs/design/plan-maps-proposal.md, approved 2026-10-23): the five templates, their
 * slots and links, the limits, and the outline every view draws from. Shared by the web, the app
 * and the API; the words are `en.planMaps` (packages/content), keyed by these ids, and a slot is
 * stored as `slot:<key>` so a word can change without a data migration.
 *
 * Templates name stages only (§6, hard rule 2): where a stop wants a fact, it links to the page
 * that computes it. React-Native-safe (hard rule 11): plain values and functions only.
 */
import { planMaps } from '@universityflow/content/app';

export const PLAN_STATUSES = ['planned', 'achieved', 'not-achieved'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const PLAN_TEMPLATE_IDS = [
  'six-stops',
  'thinking-cloud',
  'staircase',
  'life-map',
  'the-road',
] as const;
export type PlanTemplateId = (typeof PLAN_TEMPLATE_IDS)[number];

/**
 * The limits (D8). The store and the database hold the same (packages/db plan-maps.ts); a web test
 * checks the two agree. `depth` is the deepest level below the centre (the centre is 0).
 */
export const PLAN_LIMITS = {
  maps: 10,
  nodes: 60,
  children: 12,
  depth: 3,
  text: 120,
  reflection: 500,
  title: 60,
  /** A sanity range for "My target", not a deadline. */
  firstYear: 2020,
  lastYear: 2040,
} as const;

export type PlanLimitReason = 'too-many-nodes' | 'too-many-children' | 'too-deep' | 'not-found';

/** The pages a stop links to for the facts it must not hold (§6). Web paths. */
export const PLAN_LINKS = {
  goal: '/goals',
  applications: '/applications',
  results: '/results',
  offers: '/offers',
  modules: '/modules',
  subjects: '/subjects',
} as const;
export type PlanLinkId = keyof typeof PLAN_LINKS;

/**
 * How the picture lays the one list out (§8.3), and the width it starts at, in rem. Below that
 * width, and in the app, the map is the outline. The staircase and the road start at 48rem, not the
 * proposal's 40rem, so a laptop at 200% zoom (640px) gets the outline, as §7 asks.
 */
export type PlanLayout = 'ring' | 'cloud' | 'stairs' | 'branches' | 'road';

interface SlotSpec {
  readonly key: string;
  readonly link?: PlanLinkId;
  /** Not on a new map: "Add a stop from this template" puts it there. */
  readonly extra?: true;
  readonly children?: ReadonlyArray<SlotSpec>;
}

export interface PlanTemplate {
  readonly id: PlanTemplateId;
  readonly layout: PlanLayout;
  /** An ordered climb (staircase, road): `ol`, and "Step n of m". */
  readonly ordered: boolean;
  readonly pictureFrom: number;
  readonly slots: ReadonlyArray<SlotSpec>;
}

const HABITS: SlotSpec = {
  key: 'habits',
  extra: true,
  children: ['focus', 'planning', 'action', 'self-belief', 'motivation', 'keeping-at-it'].map(
    (key) => ({ key }),
  ),
};

export const PLAN_TEMPLATES: ReadonlyArray<PlanTemplate> = [
  {
    id: 'six-stops',
    layout: 'ring',
    ordered: false,
    pictureFrom: 48,
    slots: [
      { key: 'grade-10', link: 'subjects' },
      { key: 'grade-11', link: 'results' },
      { key: 'matric', link: 'goal' },
      { key: 'applying', link: 'applications' },
      { key: 'first-year', link: 'modules' },
      { key: 'finishing' },
      { key: 'before-grade-10', extra: true },
    ],
  },
  {
    id: 'thinking-cloud',
    layout: 'cloud',
    ordered: false,
    pictureFrom: 48,
    slots: ['why', 'good-at', 'learn', 'who-can-help', 'in-the-way', 'first-step'].map((key) => ({
      key,
    })),
  },
  {
    id: 'staircase',
    layout: 'stairs',
    ordered: true,
    pictureFrom: 48,
    slots: [
      { key: 'where-i-am-now' },
      { key: 'finish-grade-10', link: 'subjects' },
      { key: 'finish-grade-11', link: 'results' },
      { key: 'write-matric', link: 'goal' },
      { key: 'get-in', link: 'applications' },
      { key: 'pass-first-year', link: 'modules' },
      { key: 'each-year-after' },
      { key: 'graduate' },
      { key: 'before-grade-10', extra: true },
      HABITS,
    ],
  },
  {
    id: 'life-map',
    layout: 'branches',
    ordered: false,
    pictureFrom: 64,
    slots: [
      { key: 'who-i-am' },
      { key: 'holds-me-back' },
      { key: 'what-i-want' },
      {
        key: 'my-path',
        children: [
          { key: 'path-grade-10', link: 'subjects' },
          { key: 'path-grade-11', link: 'results' },
          { key: 'path-matric', link: 'goal' },
          { key: 'path-applying', link: 'applications' },
          { key: 'path-first-year', link: 'modules' },
          { key: 'path-graduate' },
        ],
      },
      { key: 'turning-it-around' },
      { key: 'my-people' },
      { key: 'my-week' },
    ],
  },
  {
    id: 'the-road',
    layout: 'road',
    ordered: true,
    pictureFrom: 48,
    slots: [
      { key: 'where-i-am-now' },
      { key: 'grades-10-11', link: 'results' },
      { key: 'matric-done', link: 'goal' },
      { key: 'accepted', link: 'offers' },
      { key: 'first-year-passed', link: 'modules' },
      { key: 'graduated' },
      { key: 'before-grade-10', extra: true },
    ],
  },
];

export const CENTRE_SLOT = 'slot:centre';

export function isPlanTemplateId(value: unknown): value is PlanTemplateId {
  return typeof value === 'string' && (PLAN_TEMPLATE_IDS as ReadonlyArray<string>).includes(value);
}

export function planTemplate(id: PlanTemplateId): PlanTemplate {
  return PLAN_TEMPLATES.find((t) => t.id === id) as PlanTemplate;
}

/** A slot with where it sits: its parent's key ('centre' for a branch) and its depth. */
export interface FlatSlot {
  readonly key: string;
  readonly parent: string;
  readonly depth: number;
  /** Its place among the template's siblings. */
  readonly index: number;
  readonly link?: PlanLinkId;
  readonly extra: boolean;
}

/** Every slot of a template, extras included, parents before children. */
export function allSlots(template: PlanTemplate): FlatSlot[] {
  const out: FlatSlot[] = [];
  const walk = (specs: ReadonlyArray<SlotSpec>, parent: string, depth: number, extra: boolean) => {
    specs.forEach((s, index) => {
      const isExtra = extra || s.extra === true;
      out.push({
        key: s.key,
        parent,
        depth,
        index,
        extra: isExtra,
        ...(s.link ? { link: s.link } : {}),
      });
      if (s.children) walk(s.children, s.key, depth + 1, isExtra);
    });
  };
  walk(template.slots, 'centre', 1, false);
  return out;
}

/** `grade-10` for `slot:grade-10`; null for a learner's own part. */
export function slotKey(slotId: string | null): string | null {
  return slotId?.startsWith('slot:') ? slotId.slice(5) : null;
}

export interface SlotWords {
  readonly heading: string;
  readonly hint: string;
  readonly subtitle?: string;
  /** The placeholder for a step the learner adds under this stop. */
  readonly childHint?: string;
}

/** The template's words for a slot (the centre included), or null for a learner's own part. */
export function slotWords(templateId: PlanTemplateId, slotId: string | null): SlotWords | null {
  const key = slotKey(slotId);
  if (!key) return null;
  const words = planMaps.templates[templateId];
  if (key === 'centre') return words.centre;
  return (words.slots as Record<string, SlotWords>)[key] ?? null;
}

/** The page a slot links to, or null. */
export function slotLink(templateId: PlanTemplateId, slotId: string | null): PlanLinkId | null {
  const key = slotKey(slotId);
  return allSlots(planTemplate(templateId)).find((s) => s.key === key)?.link ?? null;
}

/** One node of a map as the API returns it: the learner's words only where they wrote some. */
export interface PlanNode {
  readonly id: string;
  readonly parentId: string | null;
  readonly position: number;
  readonly depth: number;
  readonly slotId: string | null;
  readonly text: string | null;
  readonly status: PlanStatus;
  readonly whyNot: string | null;
  readonly differently: string | null;
  /** The learner's own aim, `YYYY-MM`: never a real deadline (§6). */
  readonly targetMonth: string | null;
}

/** The course and university in the middle, read live from My goal (§4), never stored. */
export type PlanGoal =
  | { readonly kind: 'goal'; readonly course: string; readonly university: string }
  | { readonly kind: 'none' }
  | { readonly kind: 'unavailable' };

export interface PlanMapView {
  readonly id: string;
  readonly templateId: PlanTemplateId;
  readonly title: string | null;
  readonly linksGoal: boolean;
  readonly goal: PlanGoal | null;
  readonly nodes: ReadonlyArray<PlanNode>;
  /** Whether the learner may write their own words now (the owner's switch, D2). */
  readonly wordsAllowed: boolean;
  readonly updatedAt: string;
}

export interface PlanCounts {
  readonly planned: number;
  readonly achieved: number;
  readonly notAchieved: number;
}

export interface PlanMapSummary {
  readonly id: string;
  readonly templateId: PlanTemplateId;
  readonly title: string | null;
  readonly counts: PlanCounts;
  readonly updatedAt: string;
}

export interface PlanMapsResponse {
  readonly maps: ReadonlyArray<PlanMapSummary>;
  readonly wordsAllowed: boolean;
  readonly max: number;
}

/** A node and its children, in position order. */
export interface OutlineNode {
  readonly node: PlanNode;
  readonly children: ReadonlyArray<OutlineNode>;
}

const byPosition = (a: PlanNode, b: PlanNode) => a.position - b.position;

/** The map as one tree in reading order (§7), from its centre; null when it has none. */
export function outlineOf(nodes: ReadonlyArray<PlanNode>): OutlineNode | null {
  const centre = nodes.find((n) => n.parentId === null);
  if (!centre) return null;
  const build = (node: PlanNode, seen: Set<string>): OutlineNode => {
    seen.add(node.id);
    const children = nodes
      .filter((n) => n.parentId === node.id && !seen.has(n.id))
      .sort(byPosition)
      .map((n) => build(n, seen));
    return { node, children };
  };
  return build(centre, new Set());
}

/** A node and everything under it, the node first. */
export function subtreeIds(nodes: ReadonlyArray<PlanNode>, id: string): string[] {
  const out = [id];
  for (let i = 0; i < out.length; i++) {
    for (const n of nodes) if (n.parentId === out[i] && !out.includes(n.id)) out.push(n.id);
  }
  return out;
}

/** Statuses across the map's parts, the centre left out (it is the goal, not a step). */
export function planCounts(nodes: ReadonlyArray<PlanNode>): PlanCounts {
  const parts = nodes.filter((n) => n.parentId !== null);
  return {
    planned: parts.filter((n) => n.status === 'planned').length,
    achieved: parts.filter((n) => n.status === 'achieved').length,
    notAchieved: parts.filter((n) => n.status === 'not-achieved').length,
  };
}

/** Whether a part can go under `parentId`: null if it can, else why not (D8). */
export function canAddChild(
  nodes: ReadonlyArray<PlanNode>,
  parentId: string,
): PlanLimitReason | null {
  const parent = nodes.find((n) => n.id === parentId);
  if (!parent) return 'not-found';
  if (nodes.length >= PLAN_LIMITS.nodes) return 'too-many-nodes';
  if (parent.depth + 1 > PLAN_LIMITS.depth) return 'too-deep';
  if (nodes.filter((n) => n.parentId === parentId).length >= PLAN_LIMITS.children) {
    return 'too-many-children';
  }
  return null;
}

export type PlanMoveKind = 'up' | 'down' | 'in' | 'out';

/** How many levels a subtree goes below its top node (0 for a leaf). */
function heightOf(nodes: ReadonlyArray<PlanNode>, id: string): number {
  const top = nodes.find((n) => n.id === id);
  if (!top) return 0;
  return Math.max(
    0,
    ...subtreeIds(nodes, id).map(
      (sid) => (nodes.find((n) => n.id === sid)?.depth ?? 0) - top.depth,
    ),
  );
}

/**
 * Where a keyboard move takes a part (§7): up or down among its siblings, in under the sibling
 * before it (last), or out to just after its parent. Null when the move goes nowhere (the first
 * can't go up, the centre doesn't move, a branch of the centre can't go out); a reason when it
 * would break a limit. The server checks the same.
 */
export function planMove(
  nodes: ReadonlyArray<PlanNode>,
  id: string,
  move: PlanMoveKind,
): { parentId: string; position: number } | PlanLimitReason | null {
  const node = nodes.find((n) => n.id === id);
  if (!node || node.parentId === null) return null;
  const siblings = nodes.filter((n) => n.parentId === node.parentId).sort(byPosition);
  const index = siblings.findIndex((n) => n.id === id);
  if (move === 'up') return index === 0 ? null : { parentId: node.parentId, position: index - 1 };
  if (move === 'down') {
    return index === siblings.length - 1 ? null : { parentId: node.parentId, position: index + 1 };
  }
  if (move === 'in') {
    const before = siblings[index - 1];
    if (!before) return null;
    if (before.depth + 1 + heightOf(nodes, id) > PLAN_LIMITS.depth) return 'too-deep';
    const count = nodes.filter((n) => n.parentId === before.id).length;
    if (count >= PLAN_LIMITS.children) return 'too-many-children';
    return { parentId: before.id, position: count };
  }
  const parent = nodes.find((n) => n.id === node.parentId);
  if (!parent || parent.parentId === null) return null;
  const parentSiblings = nodes.filter((n) => n.parentId === parent.parentId).sort(byPosition);
  if (parentSiblings.length >= PLAN_LIMITS.children) return 'too-many-children';
  return {
    parentId: parent.parentId,
    position: parentSiblings.findIndex((n) => n.id === parent.id) + 1,
  };
}

/** A new map's parts: the centre and the template's slots, extras left out. */
export interface SeedPart {
  /** A name for this part within the seed, so children can point at their parent. */
  readonly ref: string;
  readonly parentRef: string | null;
  readonly slotId: string;
  readonly depth: number;
  readonly position: number;
}

export function templateSeed(id: PlanTemplateId): SeedPart[] {
  const seed: SeedPart[] = [
    { ref: 'centre', parentRef: null, slotId: CENTRE_SLOT, depth: 0, position: 0 },
  ];
  const walk = (specs: ReadonlyArray<SlotSpec>, parent: string, depth: number) => {
    let position = 0;
    for (const s of specs) {
      if (s.extra) continue;
      seed.push({ ref: s.key, parentRef: parent, slotId: `slot:${s.key}`, depth, position });
      position++;
      if (s.children) walk(s.children, s.key, depth + 1);
    }
  };
  walk(planTemplate(id).slots, 'centre', 1);
  return seed;
}

/**
 * The template's stops a map doesn't have, whose parent part it does: "Add a stop from this
 * template" offers them (a removed slot, or an extra). Each goes last under that parent.
 */
export function missingSlots(
  templateId: PlanTemplateId,
  nodes: ReadonlyArray<PlanNode>,
): Array<{ slotId: string; parentId: string }> {
  const present = new Map(nodes.flatMap((n) => (n.slotId ? [[n.slotId, n.id] as const] : [])));
  return allSlots(planTemplate(templateId)).flatMap((s) => {
    const slotId = `slot:${s.key}`;
    if (present.has(slotId)) return [];
    const parentId = present.get(`slot:${s.parent}`);
    return parentId ? [{ slotId, parentId }] : [];
  });
}

/** The template's child slots under a slot, in order, for putting a group back whole. */
export function slotChildren(templateId: PlanTemplateId, slotId: string): string[] {
  const key = slotKey(slotId);
  return allSlots(planTemplate(templateId))
    .filter((s) => s.parent === key)
    .map((s) => `slot:${s.key}`);
}
