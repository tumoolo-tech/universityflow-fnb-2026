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

/**
 * Below this zoom a card's words are too small to read (the integrator, 2026-10-25: a card's
 * 15px words must stay about 12px on screen): the first view never goes under it.
 */
export const READABLE = 0.85;

/**
 * The view a card opens on (the integrator, 2026-10-25/26), as one self-contained function: it
 * names nothing outside itself, because `placeScript` sends its own source to run before the page
 * is live (A4-21), so the two can never disagree. The rule:
 *
 * 1. The whole map, centred, when it fits at a readable zoom (`readable`: a card's 14-15px words
 *    stay about 12px on screen), never above 100%.
 * 2. Otherwise the middle (or, in a phone's window narrower than the middle's shape, its `words`:
 *    the box of what it says) and as many of the cards nearest it as still fit readably, whole.
 * 3. Then, among the zooms from that fit down to `readable` and the pans that keep all of that in
 *    the window, the one that cuts the fewest cards at the window's edge (a card is in, or out of
 *    sight, never sliced), then shows the most whole cards, then is the larger, then the nearer
 *    to centred.
 *
 * Null when there is nothing to measure (the caller shows the middle at 100%).
 */
export function firstViewOf(
  world: Size,
  viewport: Size,
  hub: Box,
  words: Box,
  cards: ReadonlyArray<Box>,
  pad: number,
  readable: number,
): View | null {
  const vw = viewport.width;
  const vh = viewport.height;
  if (!(world.width > 0 && world.height > 0 && vw > 0 && vh > 0)) return null;
  const fitScale = (b: Box) => Math.min(1, (vw - 2 * pad) / b.width, (vh - 2 * pad) / b.height);
  const union = (a: Box, b: Box): Box => {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    return {
      x,
      y,
      width: Math.max(a.x + a.width, b.x + b.width) - x,
      height: Math.max(a.y + a.height, b.y + b.height) - y,
    };
  };
  const whole = { x: 0, y: 0, width: world.width, height: world.height };
  const regions: Box[] = [];
  if (fitScale(whole) >= readable) regions.push(whole);
  else {
    const start = fitScale(hub) >= readable ? hub : words;
    const hx = hub.x + hub.width / 2;
    const hy = hub.y + hub.height / 2;
    const far = (b: Box) => Math.hypot(b.x + b.width / 2 - hx, b.y + b.height / 2 - hy);
    const near = cards.slice().sort((a, b) => far(a) - far(b));
    // The middle and the nearest cards that still fit, nearest first, trying each card as the
    // first one beside it (the nearest alone can lead to a poor set, as on the life map).
    for (let k = -1; k < near.length; k += 1) {
      let region = start;
      const order = k < 0 ? near : [near[k] as Box, ...near.filter((_, i) => i !== k)];
      for (const c of order) {
        const next = union(region, c);
        if (fitScale(next) >= readable) region = next;
      }
      regions.push(region);
    }
    if (fitScale(start) < readable) {
      // Not even the middle's words fit readably (a tiny window): them, centred, at `readable`.
      return {
        x: (vw - start.width * readable) / 2 - start.x * readable,
        y: (vh - start.height * readable) / 2 - start.y * readable,
        scale: readable,
      };
    }
  }
  /** The pans along one axis that keep the region whole, and those that put a card just in or out. */
  const offsets = (lo: number, hi: number, edges: number[]) => {
    const out = [(lo + hi) / 2, lo, hi];
    for (const e of edges) if (e >= lo && e <= hi) out.push(e);
    return out;
  };
  const inset = 8;
  let best: { v: View; score: number[] } | null = null;
  for (const region of regions) {
    const top = fitScale(region);
    const scales =
      top - readable < 0.005 ? [top] : [0, 1, 2, 3, 4].map((k) => top - ((top - readable) * k) / 4);
    for (const s of scales) {
      // Keeping the region whole, within how far the map may pan (`clampView`: its edges never
      // further than `pad` inside the window).
      const within = (lo: number, hi: number, len: number, view: number): [number, number] => {
        const far = view - len * s - pad;
        const plo = Math.min(pad, far);
        const phi = Math.max(pad, far);
        const a = Math.max(lo, plo);
        const b = Math.min(hi, phi);
        if (a <= b) return [a, b];
        const mid = Math.min(phi, Math.max(plo, (lo + hi) / 2));
        return [mid, mid];
      };
      const [xlo, xhi] = within(
        pad - region.x * s,
        vw - pad - (region.x + region.width) * s,
        world.width,
        vw,
      );
      const [ylo, yhi] = within(
        pad - region.y * s,
        vh - pad - (region.y + region.height) * s,
        world.height,
        vh,
      );
      const xe: number[] = [];
      const ye: number[] = [];
      for (const c of cards) {
        xe.push(
          inset - c.x * s,
          vw - inset - (c.x + c.width) * s,
          -(c.x + c.width) * s,
          vw - c.x * s,
        );
        ye.push(
          inset - c.y * s,
          vh - inset - (c.y + c.height) * s,
          -(c.y + c.height) * s,
          vh - c.y * s,
        );
      }
      const xs = offsets(xlo, xhi, xe);
      const ys = offsets(ylo, yhi, ye);
      for (const x of xs) {
        for (const y of ys) {
          let cut = 0;
          let shown = 0;
          for (const c of cards) {
            const l = x + c.x * s;
            const r = x + (c.x + c.width) * s;
            const t = y + c.y * s;
            const b = y + (c.y + c.height) * s;
            const inside = l >= -0.5 && r <= vw + 0.5 && t >= -0.5 && b <= vh + 0.5;
            const seen = r > 1 && l < vw - 1 && b > 1 && t < vh - 1;
            if (inside) shown += 1;
            else if (seen) cut += 1;
          }
          const off = Math.abs(x - (xlo + xhi) / 2) + Math.abs(y - (ylo + yhi) / 2);
          const score = [cut, -shown, -s, off];
          let better = best === null;
          if (best !== null) {
            for (let i = 0; i < score.length; i += 1) {
              const d = (score[i] as number) - (best.score[i] as number);
              if (Math.abs(d) > 1e-9) {
                better = d < 0;
                break;
              }
            }
          }
          if (better) best = { v: { x, y, scale: s }, score };
        }
      }
    }
  }
  return best ? best.v : null;
}

/**
 * The view a card opens on: `firstViewOf` at `READABLE`; with nothing to measure, the middle at
 * 100%. `placeScript` runs the same before the page is live (A4-21), so nothing shifts.
 */
export function firstView(
  world: Size,
  viewport: Size,
  centre: Box,
  cards: ReadonlyArray<Box>,
  pad: number,
  words: Box = centre,
): View {
  return (
    firstViewOf(world, viewport, centre, words, cards, pad, READABLE) ?? homeView(centre, viewport)
  );
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

/**
 * The first view, applied before the page is live (A4-21): a small inline script the server sends
 * after the canvas's markup, which puts the map exactly where `MapCanvas.start()` will once it
 * hydrates (the same `firstView`, then `clampView`, then the same custom properties, stage size and
 * scroll), so nothing shifts when the page comes alive. It marks the canvas `data-placed`; the
 * live canvas marks it `data-enhanced` and takes over. No React, nothing from the page; the
 * decision is `firstViewOf`'s own source, so the server's view and the live one are one rule.
 * test/plan-map-canvas.test.tsx runs it against the rendered DOM and compares the two views.
 */
export function placeScript(portId: string, pad = EDGE): string {
  return (
    `(function(){var p=document.getElementById(${JSON.stringify(portId)});if(!p)return;` +
    `var r=p.parentNode;while(r&&!(r.className&&(' '+r.className+' ').indexOf(' uf-canvas ')>=0))r=r.parentNode;` +
    `var st=p.firstElementChild,w=st&&st.firstElementChild;if(!r||!st||!w)return;` +
    // The map's size, its middle and its cards, measured as the live canvas measures them (the
    // world is still unscaled here), so the two views agree whatever the root font size.
    `var W=w.offsetWidth,H=w.offsetHeight,c=w.querySelector('.uf-map-centre');` +
    `var vw=p.clientWidth,vh=p.clientHeight,pad=${pad};if(!vw||!vh||!W||!H)return;` +
    `var box=function(e){return{x:e.offsetLeft,y:e.offsetTop,width:e.offsetWidth,height:e.offsetHeight};};` +
    `var hub=c?box(c):{x:0,y:0,width:0,height:0},wb=c&&c.querySelector('.uf-map-centre-body');` +
    `var words=wb?{x:hub.x+wb.offsetLeft,y:hub.y+wb.offsetTop,width:wb.offsetWidth,height:wb.offsetHeight}:hub;` +
    `var cards=[],ls=w.querySelectorAll('.uf-map-branches>li'),i;for(i=0;i<ls.length;i++)cards.push(box(ls[i]));` +
    // The live canvas's own rule, its source as it is (it names nothing outside itself).
    `var v=(${firstViewOf.toString()})({width:W,height:H},{width:vw,height:vh},hub,words,cards,pad,${READABLE});` +
    `if(!v)v={x:vw/2-(hub.x+hub.width/2),y:vh/2-(hub.y+hub.height/2),scale:1};` +
    `var x=v.x,y=v.y,s=Math.min(${ZOOM.max},Math.max(${ZOOM.min},v.scale));` +
    `function range(len,vl){var far=vl-len*s-pad;return[Math.min(pad,far),Math.max(pad,far)];}` +
    `var rx=range(W,vw),ry=range(H,vh);x=Math.min(rx[1],Math.max(rx[0],x));y=Math.min(ry[1],Math.max(ry[0],y));` +
    `var m=Math.max(vw,vh);p.style.setProperty('--uf-canvas-x',x+'px');p.style.setProperty('--uf-canvas-y',y+'px');` +
    `p.style.setProperty('--uf-canvas-scale',String(s));p.style.setProperty('--uf-canvas-margin',m+'px');` +
    `r.setAttribute('data-placed','');st.style.width=(W*s+2*m)+'px';st.style.height=(H*s+2*m)+'px';` +
    `p.scrollLeft=m-x;p.scrollTop=m-y;})();`
  );
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
