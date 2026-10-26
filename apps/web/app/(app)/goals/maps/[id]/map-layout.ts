import { PLAN_POSITION_MAX, type PlanLayout } from '@universityflow/ui';
import { type Box, type Point, roadPath, type Size } from './canvas-math';

/**
 * The plan map's picture as plain maths (RT-07, RT-08: the owner's run-through, 2026-10-25), every
 * rule a pure function with a test (test/plan-map-layout.test.ts). No DOM, no React.
 *
 * - **Each template's own arrangement** (`defaultLayout`), worked out from the cards' real sizes
 *   (measured in the browser; estimated on the server), so no card ever touches another or the
 *   middle, at any count: the six cards round a starburst (the owner's first picture), the notes
 *   round a cloud (the second), a staircase climbing in flights (the third), numbered branches
 *   round a circle (the fourth) and milestones either side of a winding road (the fifth).
 * - **Branches between the actual edges** (`connectors`): from the middle's drawn edge to the
 *   card's, computed from where both are now, so they follow a card the learner moves.
 * - **The learner's own places** (`placeCards`, `toPlace`, `nudge`, `freePlace`): a dragged or
 *   keyed card keeps its place on the dotted grid, inside the canvas, and never on another card.
 *
 * A box is in the canvas's own pixels at 100% (world coordinates), its corner at the top left.
 */

/** The dotted ground's spacing (tokens.canvas.grid, 1.5rem): a dropped card snaps to it. */
export const MAP_GRID = 24;
/** The least space between any two things on a map the template arranges. */
export const MAP_GAP = 32;
/** The margin round the whole map. */
const PAD = 48;
/**
 * Round a radial map (the starburst, the cloud, the life map) a wider margin of dotted ground,
 * so the first view can frame the middle and the column beside it with the far column wholly out
 * of sight (canvas-math.ts `firstViewOf`; the canvas never pans further than its edge).
 */
const RADIAL_PAD = 160;
/** A card's corner radius (tokens.radius.lg is 20px; a branch meets the straight edge past it). */
const CORNER = 18;

/**
 * The fixed heights of a card's parts in the picture, in pixels at the 16px root (MAPS-05, A4-21:
 * a card's footprint is a sum of these, final on the server, so nothing is measured and nothing
 * jumps when the page comes alive). globals.css holds each as `--uf-map-slot-*`, in tokens, and
 * test/plan-map-view.test.tsx checks the two agree. Every text slot is a set number of lines of
 * 24px, clamped there; the rest is in the List and the editor.
 */
export const SLOT = {
  /** The card's padding (space.4) and its border (border.thick), each side. */
  pad: 16,
  border: 2,
  /** Between parts (space.2). */
  gap: 8,
  /** The badge, the icon and the heading (two lines at most): target. */
  head: 44,
  /** The status chip row (space.5 + space.1). */
  status: 28,
  /** The learner's words or the hint: three lines (space.5 × 3). */
  note: 72,
  /** "Got in the way" or "Try differently": two lines (space.7). */
  reflect: 48,
  /** "My target: …": one line (space.5). */
  target: 24,
  /** A fact link: a 44px row (target). */
  link: 44,
  /** A step under the card: a compact row (space.6); at most three, then "+ n more" (space.5). */
  step: 32,
  more: 24,
  /** Edit, More and Move (target). */
  actions: 44,
  /**
   * The middle, kept to about a card's height (the integrator, 2026-10-25): its padding (space.3);
   * a one-line heading (space.5 + space.1); the learner's words or the hint on two lines
   * (space.7); My goal: the course on two lines and its link on one, with a gap (space.7 +
   * space.1 + space.5); the About me words on one row (space.5), or two for three words
   * (space.5 × 2 + space.1); "n of m achieved" alone (space.5), or with the Edit and Add buttons
   * in one foot row (target).
   */
  hubPad: 12,
  hubHeading: 28,
  hubNote: 48,
  hubGoal: 76,
  hubWords: 24,
  hubWordsTwo: 52,
  hubProgress: 24,
  hubFoot: 44,
} as const;

/** The most steps a card shows before "+ n more". */
export const CARD_STEPS = 3;

export interface CardShape {
  readonly note: boolean;
  readonly whyNot: boolean;
  readonly differently: boolean;
  readonly target: boolean;
  readonly link: boolean;
  readonly steps: number;
}

/** A card's height in the picture from what it holds: fixed slots, gaps between them. */
export function cardHeight(shape: CardShape): number {
  const rows = Math.min(shape.steps, CARD_STEPS);
  const stepsBlock = rows * SLOT.step + (shape.steps > CARD_STEPS ? SLOT.more : 0);
  const blocks = [
    SLOT.head,
    SLOT.status,
    shape.note ? SLOT.note : 0,
    shape.whyNot ? SLOT.reflect : 0,
    shape.differently ? SLOT.reflect : 0,
    shape.target ? SLOT.target : 0,
    shape.link ? SLOT.link : 0,
    stepsBlock,
    SLOT.actions,
  ].filter((h) => h > 0);
  return (
    2 * SLOT.pad +
    2 * SLOT.border +
    blocks.reduce((s, h) => s + h, 0) +
    (blocks.length - 1) * SLOT.gap
  );
}

export interface HubShape {
  readonly note: boolean;
  readonly goal: boolean;
  /** How many About me words it shows (0 to 3). */
  readonly words: number;
  readonly progress: boolean;
  readonly actions: boolean;
}

/** The middle's words' height, the same way (its shape is drawn round this, `hubOuter`). */
export function hubBodyHeight(shape: HubShape): number {
  let words = 0;
  if (shape.words >= 3) words = SLOT.hubWordsTwo;
  else if (shape.words > 0) words = SLOT.hubWords;
  let foot = 0;
  if (shape.actions) foot = SLOT.hubFoot;
  else if (shape.progress) foot = SLOT.hubProgress;
  const blocks = [
    SLOT.hubHeading,
    shape.note ? SLOT.hubNote : 0,
    shape.goal ? SLOT.hubGoal : 0,
    words,
    foot,
  ].filter((h) => h > 0);
  return 2 * SLOT.hubPad + blocks.reduce((s, h) => s + h, 0) + (blocks.length - 1) * SLOT.gap;
}

/** Each picture's card width: wide enough for a heading, a status and a few short lines. */
export const CARD_WIDTH: Readonly<Record<PlanLayout, number>> = {
  ring: 288,
  cloud: 280,
  stairs: 264,
  branches: 296,
  road: 300,
};

/** The width of the middle's words, inside its shape: wide enough for the goal's link and the foot row. */
export const HUB_WIDTH: Readonly<Record<PlanLayout, number>> = {
  ring: 296,
  cloud: 296,
  stairs: 296,
  branches: 280,
  road: 296,
};

export interface MapLayout {
  readonly hub: Box;
  readonly cards: ReadonlyArray<Box>;
  readonly world: Size;
}

/** How the middle is drawn: an ellipse-like shape (the star, the cloud, the circle) or a card. */
export function hubShape(layout: PlanLayout): 'ellipse' | 'rect' {
  return layout === 'stairs' || layout === 'road' ? 'rect' : 'ellipse';
}

/**
 * The middle's box from the size of its words: the ellipse (or circle) drawn round them, with
 * room to breathe, so no word or button is ever cut by the shape (RT-07); for the staircase's and
 * the road's goal, a card the size of its words. The starburst's points and the cloud's bumps
 * are drawn outside this box, into the space the arrangement leaves round it.
 */
export function hubOuter(layout: PlanLayout, content: Size): Size {
  if (hubShape(layout) === 'rect') return { width: content.width, height: content.height };
  // An ellipse holds a box when (1/kw)² + (1/kh)² ≤ 1 for its width and height factors. Wider
  // rather than taller (the integrator, 2026-10-25: the middle near a card's height), as the
  // owner's first picture's starburst and second's cloud are; the life map's circle a mild oval.
  // 1.55 wide keeps the middle whole in a 360px phone's window at a readable zoom.
  const [kw, kh] = [1.55, 1.4];
  return { width: Math.ceil(content.width * kw), height: Math.ceil(content.height * kh) };
}

const at = (size: Size, x: number, y: number): Box => ({ x, y, ...size });

/** Moves every box so the map starts `pad` from the corner, and sizes the canvas round it. */
function normalise(
  hub: Box,
  cards: ReadonlyArray<Box>,
  extra: ReadonlyArray<Point> = [],
  pad = PAD,
): MapLayout {
  const all = [hub, ...cards];
  const minX = Math.min(...all.map((b) => b.x), ...extra.map((p) => p.x));
  const minY = Math.min(...all.map((b) => b.y), ...extra.map((p) => p.y));
  const dx = pad - minX;
  const dy = pad - minY;
  const move = (b: Box): Box => ({ ...b, x: Math.round(b.x + dx), y: Math.round(b.y + dy) });
  const hub2 = move(hub);
  const cards2 = cards.map(move);
  const maxX = Math.max(
    ...[hub2, ...cards2].map((b) => b.x + b.width),
    ...extra.map((p) => p.x + dx),
  );
  const maxY = Math.max(
    ...[hub2, ...cards2].map((b) => b.y + b.height),
    ...extra.map((p) => p.y + dy),
  );
  return {
    hub: hub2,
    cards: cards2,
    world: { width: Math.ceil(maxX + pad), height: Math.ceil(maxY + pad) },
  };
}

/**
 * Round the middle, clockwise from the top (WCAG 2.4.3: the list's order): the first card above
 * the middle, then down the right-hand column, the bottom card, and up the left-hand column. Each
 * side column is centred on the middle; nothing shares a column with anything it could touch.
 */
function radial(layout: PlanLayout, hub: Size, cards: ReadonlyArray<Size>): MapLayout {
  const n = cards.length;
  const colGap = layout === 'branches' ? 136 : 120;
  // The cards above and below the middle stand well clear of the side columns' rows, so the first
  // view (the middle and a column beside it, canvas-math.ts `firstViewOf`) cuts neither of them.
  const vGap = 152;
  const stackGap = 40;
  const hasBottom = n >= 3;
  const rest = n - 1 - (hasBottom ? 1 : 0);
  const rightCount = Math.max(0, Math.ceil(rest / 2));
  const leftCount = Math.max(0, rest - rightCount);
  const right = Array.from({ length: rightCount }, (_, i) => 1 + i);
  const bottom = hasBottom ? 1 + rightCount : -1;
  // Up the left: the card after the bottom one is the lowest on the left.
  const left = Array.from({ length: leftCount }, (_, i) => n - 1 - i).reverse();
  const top = cards[0];
  const below = hasBottom ? cards[bottom] : undefined;
  const centreW = Math.max(hub.width, top?.width ?? 0, below?.width ?? 0);
  const sideW = Math.max(CARD_WIDTH[layout], ...cards.map((c) => c.width));
  const cx = sideW + colGap;
  const hubBox = at(hub, cx + (centreW - hub.width) / 2, -hub.height / 2);
  const boxes: Box[] = new Array(n);
  if (top) boxes[0] = at(top, cx + (centreW - top.width) / 2, hubBox.y - vGap - top.height);
  if (below)
    boxes[bottom] = at(below, cx + (centreW - below.width) / 2, hubBox.y + hub.height + vGap);
  // The thinking cloud's notes sit a little out of line, like notes stuck on by hand.
  const jitter = layout === 'cloud' ? [20, -16, 24, -20, 12, -24] : [0];
  const stack = (ids: ReadonlyArray<number>, x: number, side: number) => {
    const total =
      ids.reduce((s, i) => s + (cards[i]?.height ?? 0), 0) + (ids.length - 1) * stackGap;
    let y = -total / 2;
    for (const [k, i] of ids.entries()) {
      const c = cards[i] as Size;
      const shift = (jitter[(i + k) % jitter.length] ?? 0) * side;
      boxes[i] = at(c, x + (sideW - c.width) / 2 + shift, y);
      y += c.height + stackGap;
    }
  };
  stack(right, cx + centreW + colGap, 1);
  // The left column reads bottom to top, so it is stacked top to bottom in reverse.
  stack([...left].reverse(), 0, -1);
  return normalise(hubBox, boxes, [], RADIAL_PAD);
}

/**
 * The staircase (the owner's third picture): one flight of steps rising left to right, each
 * step's foot a rise above the one before, and the goal above the top step. The canvas is wide
 * for a long climb; it pans, and the first view is the goal at 100%.
 */
function stairs(hub: Size, cards: ReadonlyArray<Size>): MapLayout {
  const gx = MAP_GAP;
  const rise = 96;
  const colW = Math.max(CARD_WIDTH.stairs, ...cards.map((c) => c.width));
  const boxes: Box[] = cards.map((c, i) =>
    at(c, i * (colW + gx) + (colW - c.width) / 2, -i * rise - c.height),
  );
  // The goal is the climb's last step up (the owner's third picture's "Succeeded!" on the top
  // step): beside the top step, a rise higher, so it and the steps below it share the first view.
  const hubBox = at(hub, cards.length * (colW + gx), -cards.length * rise - hub.height);
  return normalise(hubBox, boxes);
}

/** The road's width at 100% (tokens.canvas.road, 2.75rem). */
export const ROAD_WIDTH = 44;
/** How far the road runs from a milestone's edge to its marker, and between the two lanes. */
const ROAD_SIDE = 44;
const ROAD_GAP = 2 * (ROAD_SIDE + 44);

/**
 * The road (the owner's fifth picture): the goal at the top where the road ends, milestones
 * either side of it in turn from the bottom (where the road starts) upward, staggered so the road
 * winds between them. Cards on one side never touch; the two sides are a road apart.
 */
function road(hub: Size, cards: ReadonlyArray<Size>): MapLayout {
  const w = Math.max(CARD_WIDTH.road, ...cards.map((c) => c.width));
  const roadX = w + ROAD_GAP / 2;
  const hubBox = at(hub, roadX - hub.width / 2, 0);
  // Close under the goal, so the goal and the last milestone open together (the first view).
  const startY = hub.height + 40;
  const stagger = 112;
  const sideGap = 40;
  const boxes: Box[] = new Array(cards.length);
  const laneBottom: [number, number] = [startY - sideGap, startY - sideGap];
  let prevY: number | null = null;
  // From the top (the last milestone) down to the first, which sits lowest, by the start.
  for (let i = cards.length - 1; i >= 0; i -= 1) {
    const c = cards[i] as Size;
    const lane = i % 2;
    // The milestone under the last one starts below it altogether, so the first view (the goal
    // and the last milestone) never shows it cut in half at the window's foot.
    const below = i === cards.length - 2 ? (cards[i + 1] as Size).height + 48 : stagger;
    const y = Math.max((laneBottom[lane] ?? 0) + sideGap, prevY === null ? startY : prevY + below);
    const x = lane === 0 ? roadX - ROAD_GAP / 2 - c.width : roadX + ROAD_GAP / 2;
    boxes[i] = at(c, x, y);
    laneBottom[lane] = y + c.height;
    prevY = y;
  }
  const first = boxes[0];
  const start = first ? { x: roadX, y: first.y + first.height + 96 } : { x: roadX, y: startY };
  return normalise(hubBox, boxes, [start]);
}

/** Each template's arrangement of the middle and its cards, from their sizes (RT-07). */
export function defaultLayout(
  layout: PlanLayout,
  hub: Size,
  cards: ReadonlyArray<Size>,
): MapLayout {
  if (layout === 'stairs') return stairs(hub, cards);
  if (layout === 'road') return road(hub, cards);
  return radial(layout, hub, cards);
}

/**
 * The map with the learner's own places (RT-08): a card or the middle they moved sits where they
 * put it; the rest stay where the template puts them; the canvas grows to hold them all.
 */
export function placeCards(
  laid: MapLayout,
  saved: { readonly hub: Point | null; readonly cards: ReadonlyArray<Point | null | undefined> },
  hubSize?: Size,
): MapLayout {
  const hub: Box = saved.hub
    ? { ...(hubSize ?? laid.hub), x: saved.hub.x, y: saved.hub.y }
    : laid.hub;
  const cards = laid.cards.map((b, i) => {
    const p = saved.cards[i];
    return p ? { ...b, x: p.x, y: p.y } : b;
  });
  const all = [hub, ...cards];
  return {
    hub,
    cards,
    world: {
      width: Math.max(laid.world.width, ...all.map((b) => Math.ceil(b.x + b.width + PAD))),
      height: Math.max(laid.world.height, ...all.map((b) => Math.ceil(b.y + b.height + PAD))),
    },
  };
}

const clampPlace = (n: number) => Math.min(PLAN_POSITION_MAX, Math.max(0, Math.round(n)));

/** Where a dropped card stays: on the dotted grid, inside the canvas, in whole pixels. */
export function toPlace(p: Point): Point {
  const snap = (n: number) => clampPlace(Math.round(n / MAP_GRID) * MAP_GRID);
  return { x: snap(p.x), y: snap(p.y) };
}

/**
 * The keyboard's move (WCAG 2.5.7, the alternative to dragging): one dot of the grid per arrow
 * press, four with Shift, never off the canvas. Null for any other key.
 */
export function nudge(p: Point, key: string, shift: boolean): Point | null {
  const by = MAP_GRID * (shift ? 4 : 1);
  const moves: Record<string, Point> = {
    ArrowLeft: { x: -by, y: 0 },
    ArrowRight: { x: by, y: 0 },
    ArrowUp: { x: 0, y: -by },
    ArrowDown: { x: 0, y: by },
  };
  const m = moves[key];
  if (!m) return null;
  return { x: clampPlace(p.x + m.x), y: clampPlace(p.y + m.y) };
}

export type Sector = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

/** Further than this between centres (px) is "far from the middle". */
const FAR = 600;

/**
 * Where a card is relative to the middle, in words a screen reader can say after each arrow
 * press (MAPS-06): one of eight sectors, clockwise from above, and whether it is near or far.
 */
export function whereIs(card: Box, hub: Box): { sector: Sector; far: boolean } {
  const c = centreOf(card);
  const h = centreOf(hub);
  const dx = c.x - h.x;
  const dy = c.y - h.y;
  // 0 straight up, clockwise, in eighths of a turn.
  const turn = (Math.atan2(dx, -dy + 0) / (2 * Math.PI) + 1) % 1;
  const sectors: Sector[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
  const sector = sectors[Math.round(turn * 8) % 8] as Sector;
  return { sector, far: Math.hypot(dx, dy) > FAR };
}

/** How far (in dots of the grid) a dropped card is moved to find room: past a card and its gap. */
const FREE_REACH = 16;

const apart = (a: Box, b: Box, gap: number) =>
  b.x >= a.x + a.width + gap ||
  a.x >= b.x + b.width + gap ||
  b.y >= a.y + a.height + gap ||
  a.y >= b.y + b.height + gap;

/**
 * Where a dropped card lands so it never sits on another card or the middle (RT-07's "no overlap"
 * kept after RT-08's moves): its own spot when that is free, else the nearest free dot of the
 * grid within `FREE_REACH` dots, on the canvas. Null when it is boxed in: the caller puts the card
 * back where it was picked up and says so. `others` are the boxes to keep clear of, the card's
 * own old box left out.
 */
export function freePlace(box: Box, others: ReadonlyArray<Box>): Point | null {
  const free = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x + box.width <= PLAN_POSITION_MAX &&
    y + box.height <= PLAN_POSITION_MAX &&
    others.every((o) => apart({ ...box, x, y }, o, MAP_GAP));
  if (free(box.x, box.y)) return { x: box.x, y: box.y };
  let best: Point | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let r = 1; r <= FREE_REACH; r += 1) {
    for (let dx = -r; dx <= r; dx += 1) {
      for (let dy = -r; dy <= r; dy += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = Math.round(box.x / MAP_GRID + dx) * MAP_GRID;
        const y = Math.round(box.y / MAP_GRID + dy) * MAP_GRID;
        const dist = Math.hypot(x - box.x, y - box.y);
        if (dist < bestDist && free(x, y)) {
          best = { x, y };
          bestDist = dist;
        }
      }
    }
    // A ring further out can't be nearer than the best on this one, less a dot's diagonal.
    if (best && bestDist < (r - 1) * MAP_GRID) break;
  }
  return best;
}

// ── The branches ────────────────────────────────────────────────────────────────────────────

const centreOf = (b: Box): Point => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
const unit = (x: number, y: number): Point => {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
};

/**
 * Where a line from `box`'s middle toward `toward` leaves its drawn edge, and the edge's outward
 * direction there. A card's line meets the straight part of its edge, clear of the rounded
 * corners, so it visibly touches the card (RT-07).
 */
export function edgePoint(
  box: Box,
  toward: Point,
  shape: 'rect' | 'ellipse',
  /** For a card: the edge it plugs in on, or the one that faces `toward` ('auto'). */
  side: 'auto' | 'x' = 'auto',
): { point: Point; normal: Point } {
  const c = centreOf(box);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y || (dx === 0 ? 1 : 0);
  const rx = box.width / 2;
  const ry = box.height / 2;
  if (shape === 'ellipse') {
    const t = 1 / Math.hypot(dx / rx, dy / ry);
    const point = { x: c.x + dx * t, y: c.y + dy * t };
    return { point, normal: unit((point.x - c.x) / rx ** 2, (point.y - c.y) / ry ** 2) };
  }
  const keep = (v: number, lo: number, hi: number) =>
    lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v));
  if (side === 'x' || Math.abs(dx) * ry >= Math.abs(dy) * rx) {
    const sx = Math.sign(dx) || 1;
    const y = c.y + (dy * rx) / Math.abs(dx || 1);
    return {
      point: { x: c.x + sx * rx, y: keep(y, box.y + CORNER, box.y + box.height - CORNER) },
      normal: { x: sx, y: 0 },
    };
  }
  const sy = Math.sign(dy) || 1;
  const x = c.x + (dx * ry) / Math.abs(dy);
  return {
    point: { x: keep(x, box.x + CORNER, box.x + box.width - CORNER), y: c.y + sy * ry },
    normal: { x: 0, y: sy },
  };
}

export interface Connector {
  /** The card it reaches (its place in the list), or for a step line the step it leaves. */
  readonly index: number;
  readonly from: Point;
  readonly to: Point;
  /** Its centre line, sampled, for the test that no branch runs through another card. */
  readonly points: ReadonlyArray<Point>;
  /** `taper`: a filled branch, wide at the middle and narrowing to the card; `stroke`: a line. */
  readonly kind: 'taper' | 'stroke';
  readonly d: string;
  /** What marks where it meets the card: a dot, an arrowhead (its path), or nothing. */
  readonly end: 'dot' | 'arrow' | 'none';
  readonly head: string | null;
}

const n1 = (v: number) => String(Math.round(v * 10) / 10);

function bezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

/** A centre line through `points`, filled `w0` wide at its start and `w1` at its end. */
function taper(points: ReadonlyArray<Point>, w0: number, w1: number): string {
  const last = points.length - 1;
  const left: Point[] = [];
  const right: Point[] = [];
  for (const [i, p] of points.entries()) {
    const a = points[Math.max(0, i - 1)] as Point;
    const b = points[Math.min(last, i + 1)] as Point;
    const t = unit(b.x - a.x, b.y - a.y);
    const w = (w0 + (w1 - w0) * (i / last)) / 2;
    left.push({ x: p.x - t.y * w, y: p.y + t.x * w });
    right.push({ x: p.x + t.y * w, y: p.y - t.x * w });
  }
  const pts = [...left, ...right.reverse()];
  return `M${pts.map((p) => `${n1(p.x)} ${n1(p.y)}`).join(' L')} Z`;
}

/**
 * The owner's first picture's curly arrows, adapted: one loop part-way along the branch (a
 * cycloid's turn added to the curve), so it reads as hand-drawn, still ending on the card's edge.
 */
function withLoop(points: ReadonlyArray<Point>): Point[] {
  const last = points.length - 1;
  let length = 0;
  for (let i = 1; i <= last; i += 1) {
    const a = points[i - 1] as Point;
    const b = points[i] as Point;
    length += Math.hypot(b.x - a.x, b.y - a.y);
  }
  if (length < 160) return [...points];
  const r = Math.min(22, Math.max(12, length * 0.07));
  const [from, to] = [0.38, 0.66];
  return points.map((p, i) => {
    const t = i / last;
    if (t <= from || t >= to) return p;
    const s = (t - from) / (to - from);
    const theta = 2 * Math.PI * s;
    const a = points[Math.max(0, i - 1)] as Point;
    const b = points[Math.min(last, i + 1)] as Point;
    const d = unit(b.x - a.x, b.y - a.y);
    const along = -r * Math.sin(theta);
    const across = r * (1 - Math.cos(theta));
    return { x: p.x + d.x * along - d.y * across, y: p.y + d.y * along + d.x * across };
  });
}

function arrowHead(tip: Point, back: Point, size: number): string {
  const d = unit(tip.x - back.x, tip.y - back.y);
  const base = { x: tip.x - d.x * size, y: tip.y - d.y * size };
  const half = size * 0.55;
  const l = { x: base.x - d.y * half, y: base.y + d.x * half };
  const r = { x: base.x + d.y * half, y: base.y - d.x * half };
  return `M${n1(tip.x)} ${n1(tip.y)} L${n1(l.x)} ${n1(l.y)} L${n1(r.x)} ${n1(r.y)} Z`;
}

/** A curve leaving `a` along its edge's normal and arriving at `b` along its edge's normal. */
function curve(
  a: { point: Point; normal: Point },
  b: { point: Point; normal: Point },
): [Point, Point, Point, Point] {
  const reach = Math.hypot(b.point.x - a.point.x, b.point.y - a.point.y) * 0.42;
  return [
    a.point,
    { x: a.point.x + a.normal.x * reach, y: a.point.y + a.normal.y * reach },
    { x: b.point.x + b.normal.x * reach, y: b.point.y + b.normal.y * reach },
    b.point,
  ];
}

/** A sideways S from `a` to `b`: out of the hub's side, across the gap, square into the card. */
function sCurve(a: Point, b: Point): [Point, Point, Point, Point] {
  const mid = (a.x + b.x) / 2;
  return [a, { x: mid, y: a.y + (b.y - a.y) * 0.15 }, { x: mid, y: b.y }, b];
}

const sample = (c: [Point, Point, Point, Point], steps = 40) =>
  Array.from({ length: steps + 1 }, (_, i) => bezier(c[0], c[1], c[2], c[3], i / steps));

/** The road through each milestone's marker, from its start below the first to the goal's edge. */
export function roadOf(
  hub: Box,
  cards: ReadonlyArray<Box>,
): { d: string; start: Point; end: Point; markers: Point[]; through: Point[] } {
  const hc = centreOf(hub);
  const markers = cards.map((b) => {
    const c = centreOf(b);
    return c.x < hc.x ? { x: b.x + b.width + ROAD_SIDE, y: c.y } : { x: b.x - ROAD_SIDE, y: c.y };
  });
  const first = cards[0];
  const start = first
    ? { x: (markers[0] as Point).x, y: first.y + first.height + 72 }
    : { x: hc.x, y: hub.y + hub.height + 160 };
  const end = { x: hc.x, y: hub.y + hub.height };
  const through = [start, ...markers, end];
  return { d: roadPath(through), start, end, markers, through };
}

/**
 * Points along the road's centre line (the same spline `roadPath` draws: a Catmull-Rom through
 * its markers as cubic Béziers), for the test that the road keeps clear of every card.
 */
export function roadSamples(hub: Box, cards: ReadonlyArray<Box>, steps = 24): Point[] {
  const { through } = roadOf(hub, cards);
  const p = (i: number) => through[Math.min(Math.max(i, 0), through.length - 1)] as Point;
  const out: Point[] = [];
  for (let i = 0; i < through.length - 1; i += 1) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    out.push(...sample([p1, c1, c2, p2], steps));
  }
  return out;
}

/**
 * Every branch of a map, from where its parts are now (RT-07: drawn between the actual edges of
 * the two things it joins, so it follows them when they move): the middle to each card for the
 * radial maps; each step to the next and the last to the goal on the staircase; each milestone
 * to its marker on the road.
 */
export function connectors(layout: PlanLayout, hub: Box, cards: ReadonlyArray<Box>): Connector[] {
  if (layout === 'road') {
    const { markers } = roadOf(hub, cards);
    return cards.map((b, index) => {
      const to = markers[index] as Point;
      const from = edgePoint(b, to, 'rect').point;
      return {
        index,
        from,
        to,
        points: [from, to],
        kind: 'stroke',
        d: `M${n1(from.x)} ${n1(from.y)} L${n1(to.x)} ${n1(to.y)}`,
        end: 'none',
        head: null,
      };
    });
  }
  if (layout === 'stairs') {
    const targets = [...cards.slice(1), hub];
    return cards.map((b, index) => {
      const next = targets[index] as Box;
      const a = edgePoint(b, centreOf(next), 'rect');
      const z = edgePoint(next, centreOf(b), 'rect');
      const c = curve(a, z);
      const back = bezier(c[0], c[1], c[2], c[3], 0.9);
      return {
        index,
        from: a.point,
        to: z.point,
        points: sample(c),
        kind: 'stroke',
        d: `M${n1(c[0].x)} ${n1(c[0].y)} C${n1(c[1].x)} ${n1(c[1].y)} ${n1(c[2].x)} ${n1(c[2].y)} ${n1(c[3].x)} ${n1(c[3].y)}`,
        end: 'arrow',
        head: arrowHead(z.point, back, 12),
      };
    });
  }
  const hc = centreOf(hub);
  return cards.map((b, index) => {
    const bc = centreOf(b);
    // A card beside the middle (in a side column) plugs in on the edge that faces it, however
    // high it sits (a port on its bottom edge would send the branch up through the card below),
    // and its branch is an S-curve whose control points stay in the gap between the middle and
    // the column: a Bézier never leaves its control points' hull, so it can't run through the
    // card above the middle or any card in the column. The branches fan out of the hub's side.
    const beside = Math.abs(bc.x - hc.x) > hub.width / 2;
    const a = edgePoint(hub, beside ? { x: bc.x, y: hc.y + (bc.y - hc.y) * 0.35 } : bc, 'ellipse');
    const z = edgePoint(b, hc, 'rect', beside ? 'x' : 'auto');
    const c = beside ? sCurve(a.point, z.point) : curve(a, z);
    let points = sample(c);
    if (layout === 'ring') points = withLoop(points);
    const [w0, w1] = layout === 'branches' ? [12, 4] : layout === 'ring' ? [7, 3] : [6, 3];
    const arrow = layout !== 'branches';
    const back = points[points.length - 4] as Point;
    return {
      index,
      from: a.point,
      to: z.point,
      points,
      kind: 'taper',
      d: taper(points, w0, w1),
      end: arrow ? 'arrow' : 'dot',
      head: arrow ? arrowHead(z.point, back, 14) : null,
    };
  });
}
