/**
 * The plan map's canvas as plain maths (no DOM, no React), so every rule is a pure function with
 * a test (test/plan-map-canvas-math.test.ts). A view is where the map sits in its card: `x` and
 * `y` are the screen position of the map's top-left corner in CSS pixels, `scale` its zoom. A
 * world point p shows on screen at `view + p * scale`.
 */

export interface View {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Box extends Size {
  readonly x: number;
  readonly y: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A view in motion: its speed in pixels per millisecond, and whether it has come to rest. */
export interface Motion {
  readonly view: View;
  readonly vx: number;
  readonly vy: number;
  readonly done: boolean;
}

/** The zoom's limits, and how far one press of a button or key zooms. */
export const ZOOM = { min: 0.25, max: 2, step: 1.25 } as const;

/** How far a pointer moves (CSS pixels) before a press becomes a drag: a tap stays a tap. */
export const DRAG_THRESHOLD = 6;

/** How far an arrow key pans, and with Shift. */
export const PAN_STEP = 48;
export const PAN_STEP_BIG = 192;

/** The margin a map keeps from the card's edge when it can go no further. */
export const EDGE = 24;

/** A flick's speed left after each 16ms frame, and the least speed that still moves. */
const FRICTION = 0.94;
const MIN_SPEED = 0.02;
/** The fastest flick, so a fling can't throw the map away (px/ms). */
const MAX_SPEED = 4;
/** What is left of the distance past an edge after each 16ms frame as it eases back. */
const SPRING = 0.72;
/** How far back a release looks to measure its speed (ms). */
const VELOCITY_WINDOW = 100;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function clampScale(scale: number): number {
  return clamp(scale, ZOOM.min, ZOOM.max);
}

/** Zooms to `scale` (within the limits) keeping the map point under `point` where it is. */
export function zoomAt(view: View, scale: number, point: Point): View {
  const next = clampScale(scale);
  const ratio = next / view.scale;
  return {
    x: point.x - (point.x - view.x) * ratio,
    y: point.y - (point.y - view.y) * ratio,
    scale: next,
  };
}

/** The whole map in the card, centred, never above 100% and never under the least zoom. */
export function fitView(world: Size, viewport: Size, pad: number): View {
  if (world.width <= 0 || world.height <= 0) return { x: pad, y: pad, scale: 1 };
  const scale = clampScale(
    Math.min(
      (viewport.width - 2 * pad) / world.width,
      (viewport.height - 2 * pad) / world.height,
      1,
    ),
  );
  return {
    x: (viewport.width - world.width * scale) / 2,
    y: (viewport.height - world.height * scale) / 2,
    scale,
  };
}

/** 100%, with `centre` (the map's middle part, in map coordinates) in the middle of the card. */
export function homeView(centre: Box, viewport: Size): View {
  return {
    x: viewport.width / 2 - (centre.x + centre.width / 2),
    y: viewport.height / 2 - (centre.y + centre.height / 2),
    scale: 1,
  };
}

/** Below this zoom the map's words are too small to read, so the first view is the middle. */
export const READABLE = 0.75;

/**
 * The view a card opens on: the map across the card's width from its top (so it reads from the
 * first stop down), never above 100%; where that would be too small to read (a phone), the
 * middle at 100%.
 */
export function firstView(world: Size, viewport: Size, centre: Box, pad: number): View {
  if (world.width <= 0) return homeView(centre, viewport);
  const scale = Math.min(1, (viewport.width - 2 * pad) / world.width);
  if (scale < READABLE) return homeView(centre, viewport);
  return { x: (viewport.width - world.width * scale) / 2, y: pad, scale };
}

/**
 * How far a map of `length` can go along one axis: until its far edge is `pad` inside the card;
 * a map smaller than the card moves anywhere inside it.
 */
export function panRange(
  length: number,
  viewLength: number,
  scale: number,
  pad: number,
): [number, number] {
  const far = viewLength - length * scale - pad;
  return [Math.min(pad, far), Math.max(pad, far)];
}

export function clampView(view: View, world: Size, viewport: Size, pad: number): View {
  const [lx, hx] = panRange(world.width, viewport.width, view.scale, pad);
  const [ly, hy] = panRange(world.height, viewport.height, view.scale, pad);
  return { x: clamp(view.x, lx, hx), y: clamp(view.y, ly, hy), scale: view.scale };
}

/**
 * One frame of motion after a release: a flick coasts on and slows each frame; past an edge it
 * stops coasting that way and eases back over a few frames. `done` once still and on the map.
 */
export function step(motion: Motion, dt: number, world: Size, viewport: Size, pad: number): Motion {
  const { scale } = motion.view;
  let { x, y } = motion.view;
  let { vx, vy } = motion;
  x += vx * dt;
  y += vy * dt;
  const decay = FRICTION ** (dt / 16);
  vx *= decay;
  vy *= decay;
  if (Math.hypot(vx, vy) < MIN_SPEED) {
    vx = 0;
    vy = 0;
  }
  const ease = 1 - SPRING ** (dt / 16);
  const back = (n: number, [lo, hi]: [number, number]): [number, boolean] => {
    const target = clamp(n, lo, hi);
    if (target === n) return [n, false];
    const moved = n + (target - n) * ease;
    return Math.abs(target - moved) < 0.5 ? [target, true] : [moved, true];
  };
  const [nx, pastX] = back(x, panRange(world.width, viewport.width, scale, pad));
  const [ny, pastY] = back(y, panRange(world.height, viewport.height, scale, pad));
  if (pastX) vx = 0;
  if (pastY) vy = 0;
  const view = { x: nx, y: ny, scale };
  const settled = clampView(view, world, viewport, pad);
  const done = vx === 0 && vy === 0 && settled.x === nx && settled.y === ny;
  return { view, vx, vy, done };
}

/**
 * A release's speed from the drag's last moments (px/ms), capped; nothing when the pointer had
 * stopped before letting go, and nothing at all under reduced motion (no coasting).
 */
export function releaseVelocity(
  samples: ReadonlyArray<{ readonly t: number; readonly x: number; readonly y: number }>,
  reduced: boolean,
): { vx: number; vy: number } {
  const last = samples.at(-1);
  if (reduced || !last) return { vx: 0, vy: 0 };
  const recent = samples.filter((s) => s.t >= last.t - VELOCITY_WINDOW);
  const first = recent[0];
  if (!first || recent.length < 2 || last.t === first.t) return { vx: 0, vy: 0 };
  const dt = last.t - first.t;
  let vx = (last.x - first.x) / dt;
  let vy = (last.y - first.y) / dt;
  const speed = Math.hypot(vx, vy);
  if (speed > MAX_SPEED) {
    vx = (vx / speed) * MAX_SPEED;
    vy = (vy / speed) * MAX_SPEED;
  }
  return { vx, vy };
}

/**
 * Where a glide from `from` to `to` is at `progress` (0 to 1), eased out (fast, then settling).
 * Under reduced motion it is at its end at once: the view jumps.
 */
export function glide(from: View, to: View, progress: number, reduced: boolean): View {
  if (reduced || progress >= 1) return to;
  if (progress <= 0) return from;
  const e = 1 - (1 - progress) ** 3;
  return {
    x: from.x + (to.x - from.x) * e,
    y: from.y + (to.y - from.y) * e,
    scale: from.scale + (to.scale - from.scale) * e,
  };
}

/**
 * The least pan that shows `box` (map coordinates) inside the card with `pad` around it; the
 * same view when it shows already. A box too big for the card shows from its start.
 */
export function revealView(view: View, box: Box, viewport: Size, pad: number): View {
  const axis = (pos: number, start: number, length: number, viewLength: number) => {
    const a = pos + start * view.scale;
    const b = a + length * view.scale;
    if (b - a + 2 * pad > viewLength) return pos + (pad - a);
    if (a < pad) return pos + (pad - a);
    if (b > viewLength - pad) return pos - (b - (viewLength - pad));
    return pos;
  };
  return {
    x: axis(view.x, box.x, box.width, viewport.width),
    y: axis(view.y, box.y, box.height, viewport.height),
    scale: view.scale,
  };
}

/** A press that moved more than the threshold is a drag; less is a tap. */
export function isDrag(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) > DRAG_THRESHOLD;
}

/** A wheel's movement in pixels, whether it counts in pixels, lines or pages. */
export function wheelDelta(
  e: { readonly deltaX: number; readonly deltaY: number; readonly deltaMode: number },
  page: number,
): { dx: number; dy: number } {
  let unit = 1;
  if (e.deltaMode === 1) unit = 16;
  if (e.deltaMode === 2) unit = page;
  return { dx: e.deltaX * unit, dy: e.deltaY * unit };
}

/** How much of a drag past an edge still moves the map: it follows, but reluctantly. */
const RESISTANCE = 0.35;

/** A view under a dragging finger: exact inside the edges, resisting past them. */
export function rubber(view: View, world: Size, viewport: Size, pad: number): View {
  const axis = (pos: number, [lo, hi]: [number, number]) => {
    if (pos > hi) return hi + (pos - hi) * RESISTANCE;
    if (pos < lo) return lo - (lo - pos) * RESISTANCE;
    return pos;
  };
  return {
    x: axis(view.x, panRange(world.width, viewport.width, view.scale, pad)),
    y: axis(view.y, panRange(world.height, viewport.height, view.scale, pad)),
    scale: view.scale,
  };
}

/** The same zoom, with the map point `point` in the middle of the card (the mini-map's tap). */
export function centreOn(view: View, point: Point, viewport: Size): View {
  return {
    x: viewport.width / 2 - point.x * view.scale,
    y: viewport.height / 2 - point.y * view.scale,
    scale: view.scale,
  };
}

const n = (v: number) => String(Math.round(v * 10) / 10);

/**
 * The staircase's climb line, behind the steps: from each step's top-left corner along and up to
 * the next; where a new row starts back at the left, the line starts again there.
 */
export function stairPath(steps: ReadonlyArray<Box>): string {
  const [first, ...rest] = steps;
  if (!first) return '';
  let d = `M${n(first.x)} ${n(first.y)}`;
  let at = first;
  for (const s of rest) {
    d += s.x >= at.x ? ` H${n(s.x)} V${n(s.y)}` : ` M${n(s.x)} ${n(s.y)}`;
    at = s;
  }
  return d;
}

/**
 * The road: one smooth curve through every milestone's marker, top to bottom (a Catmull-Rom
 * spline as cubic Béziers), so it winds from side to side like the owner's fifth picture.
 */
export function roadPath(points: ReadonlyArray<Point>): string {
  if (points.length < 2) return '';
  const p = (i: number) => points[clamp(i, 0, points.length - 1)] as Point;
  let d = `M${n(p(0).x)} ${n(p(0).y)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${n(c1.x)} ${n(c1.y)} ${n(c2.x)} ${n(c2.y)} ${n(p2.x)} ${n(p2.y)}`;
  }
  return d;
}
