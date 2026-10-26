import type { PlanLayout } from '@universityflow/ui';
import { describe, expect, it } from 'vitest';
import {
  type Box,
  centreOn,
  clampScale,
  clampView,
  DRAG_THRESHOLD,
  firstView,
  firstViewOf,
  fitView,
  glide,
  homeView,
  isDrag,
  panRange,
  READABLE,
  releaseVelocity,
  revealView,
  roadPath,
  rubber,
  type Size,
  stairPath,
  step,
  type View,
  wheelDelta,
  ZOOM,
  zoomAt,
} from '../app/(app)/goals/maps/[id]/canvas-math';
import {
  CARD_WIDTH,
  cardHeight,
  defaultLayout,
  HUB_WIDTH,
  hubBodyHeight,
  hubOuter,
} from '../app/(app)/goals/maps/[id]/map-layout';

/**
 * The plan map's canvas, as plain maths (no DOM), so each rule is proven on numbers: zoom toward a
 * point keeps that point still; the limits hold; fit-to-view shows the whole map; a flick coasts
 * and comes to rest; an edge eases back; and under reduced motion nothing coasts or glides.
 */

const world = { width: 1000, height: 800 };
const phone = { width: 328, height: 520 };
const laptop = { width: 960, height: 600 };

/** Where a world point sits on screen in a view. */
const onScreen = (v: View, p: { x: number; y: number }) => ({
  x: v.x + p.x * v.scale,
  y: v.y + p.y * v.scale,
});

describe('zoom', () => {
  it('keeps the point under the pointer still when zooming in or out', () => {
    const view: View = { x: -120, y: 40, scale: 1 };
    const pointer = { x: 200, y: 150 };
    const under = { x: (pointer.x - view.x) / view.scale, y: (pointer.y - view.y) / view.scale };
    for (const scale of [1.5, 0.5, 2]) {
      const next = zoomAt(view, scale, pointer);
      expect(next.scale).toBe(scale);
      const p = onScreen(next, under);
      expect(p.x).toBeCloseTo(pointer.x, 6);
      expect(p.y).toBeCloseTo(pointer.y, 6);
    }
  });

  it('stays between its limits, and the point stays still at a limit too', () => {
    expect(clampScale(10)).toBe(ZOOM.max);
    expect(clampScale(0.01)).toBe(ZOOM.min);
    expect(clampScale(1)).toBe(1);
    expect(ZOOM.min).toBeGreaterThan(0);
    expect(ZOOM.max).toBeGreaterThan(1);
    const view: View = { x: 0, y: 0, scale: 1.8 };
    const next = zoomAt(view, 9, { x: 100, y: 100 });
    expect(next.scale).toBe(ZOOM.max);
    expect(onScreen(next, { x: 100 / 1.8, y: 100 / 1.8 }).x).toBeCloseTo(100, 6);
  });
});

describe('fit and home', () => {
  it('fits the whole map in the card, centred, never larger than life', () => {
    const v = fitView(world, laptop, 24);
    expect(v.scale).toBeCloseTo((600 - 48) / 800, 6);
    // Centred both ways.
    expect(v.x + (world.width * v.scale) / 2).toBeCloseTo(laptop.width / 2, 6);
    expect(v.y + (world.height * v.scale) / 2).toBeCloseTo(laptop.height / 2, 6);
    // A small map on a big screen stays at 100%.
    expect(fitView({ width: 300, height: 200 }, laptop, 24).scale).toBe(1);
    // A huge map can't go under the least zoom.
    expect(fitView({ width: 40000, height: 40000 }, laptop, 24).scale).toBe(ZOOM.min);
  });

  it('home is 100%, with the middle of the map in the middle of the card', () => {
    const centre = { x: 350, y: 300, width: 300, height: 200 };
    const v = homeView(centre, phone);
    expect(v.scale).toBe(1);
    expect(v.x + centre.x + centre.width / 2).toBeCloseTo(phone.width / 2, 6);
    expect(v.y + centre.y + centre.height / 2).toBeCloseTo(phone.height / 2, 6);
  });
});

describe('the first view (the integrator, 2026-10-25/26: the map, readable, no card cut)', () => {
  const LAYOUTS: ReadonlyArray<PlanLayout> = ['ring', 'cloud', 'stairs', 'branches', 'road'];
  const COUNT: Record<PlanLayout, number> = { ring: 6, cloud: 6, stairs: 8, branches: 7, road: 6 };
  const EMPTY_CARD = {
    note: true,
    whyNot: false,
    differently: false,
    target: false,
    link: true,
    steps: 0,
  };
  const FULL_HUB = { note: true, goal: true, words: 3, progress: true, actions: true };
  /** Each template as a new map lays out: empty cards, the middle with a goal and three words. */
  const laidOut = (layout: PlanLayout) => {
    const body = { width: HUB_WIDTH[layout], height: hubBodyHeight(FULL_HUB) };
    const hub = hubOuter(layout, body);
    const card = { width: CARD_WIDTH[layout], height: cardHeight(EMPTY_CARD) };
    const laid = defaultLayout(
      layout,
      hub,
      Array.from({ length: COUNT[layout] }, () => card),
    );
    // The middle's words sit centred in its shape (globals.css: .uf-map-centre centres its body).
    const words: Box = {
      x: laid.hub.x + (laid.hub.width - body.width) / 2,
      y: laid.hub.y + (laid.hub.height - body.height) / 2,
      ...body,
    };
    return { ...laid, words };
  };
  /** The canvas card's window at 1280 and at 360 wide, about 600 tall (tokens.canvas.height). */
  const WINDOWS = { 1280: { width: 960, height: 600 }, 360: { width: 312, height: 600 } } as const;
  const shown = (v: View, b: Box, port: Size, margin = 0) => {
    const l = v.x + b.x * v.scale;
    const t = v.y + b.y * v.scale;
    const r = v.x + (b.x + b.width) * v.scale;
    const bottom = v.y + (b.y + b.height) * v.scale;
    const inside =
      l >= margin - 0.5 &&
      t >= margin - 0.5 &&
      r <= port.width - margin + 0.5 &&
      bottom <= port.height - margin + 0.5;
    const seen = r > 1 && l < port.width - 1 && bottom > 1 && t < port.height - 1;
    return { inside, cut: seen && !inside };
  };

  it('shows the whole map, centred, when it fits at a readable zoom; never above 100%', () => {
    const hub = { x: 200, y: 150, width: 200, height: 100 };
    const small = { width: 600, height: 400 };
    const v = firstView(small, WINDOWS[1280], hub, [], 24);
    expect(v.scale).toBe(1);
    expect(v.x + small.width / 2).toBeCloseTo(WINDOWS[1280].width / 2, 6);
    expect(v.y + small.height / 2).toBeCloseTo(WINDOWS[1280].height / 2, 6);
    // A map a little bigger than the window: the whole of it, zoomed out, still readable.
    const big = { width: 1000, height: 620 };
    const w = firstView(big, WINDOWS[1280], hub, [], 24);
    expect(w.scale).toBeCloseTo(Math.min((960 - 48) / 1000, (600 - 48) / 620), 6);
    expect(w.scale).toBeGreaterThanOrEqual(READABLE);
    expect(shown(w, { x: 0, y: 0, ...big }, WINDOWS[1280], 24).inside).toBe(true);
  });

  it('never goes under the readable zoom (a card’s words about 12px on screen)', () => {
    expect(READABLE).toBeGreaterThanOrEqual(0.85);
    expect(15 * READABLE).toBeGreaterThanOrEqual(12.5);
  });

  for (const layout of LAYOUTS) {
    for (const width of [1280, 360] as const) {
      const port = WINDOWS[width];
      it(`${layout} at ${width}: readable, the middle whole, no card cut at an edge${width === 1280 ? ', cards beside it' : ''}`, () => {
        const laid = laidOut(layout);
        const v = firstView(laid.world, port, laid.hub, laid.cards, 24, laid.words);
        expect(v.scale).toBeGreaterThanOrEqual(READABLE);
        expect(v.scale).toBeLessThanOrEqual(1);
        // The middle whole where its shape fits the window; on a phone at least all its words.
        const hubFits = Math.min(
          (port.width - 48) / laid.hub.width,
          (port.height - 48) / laid.hub.height,
        );
        expect(shown(v, hubFits >= READABLE ? laid.hub : laid.words, port, 24 - 1e-6).inside).toBe(
          true,
        );
        const states = laid.cards.map((c) => shown(v, c, port));
        // The one exception, by geometry: on a phone the road's last milestone (its lane beside
        // the road, under the goal) can't be wholly in or out of a 312px window with the goal's
        // words whole and readable, so its top shows at the window's foot, a pan away.
        const allowed = layout === 'road' && width === 360 ? 1 : 0;
        expect(states.filter((s) => s.cut).length).toBeLessThanOrEqual(allowed);
        if (width === 1280) expect(states.filter((s) => s.inside).length).toBeGreaterThanOrEqual(1);
        // The same view once kept on the map (what the canvas applies).
        expect(clampView(v, laid.world, port, 24)).toEqual(v);
      });
    }
  }

  it('the server’s script runs the very same rule (its source, self-contained)', () => {
    const laid = laidOut('ring');
    const source = firstViewOf.toString();
    const again = new Function(`return (${source});`)() as typeof firstViewOf;
    const args = [
      laid.world,
      WINDOWS[360],
      laid.hub,
      laid.words,
      laid.cards,
      24,
      READABLE,
    ] as const;
    expect(again(...args)).toEqual(firstViewOf(...args));
  });

  it('with nothing to measure (no size), falls back to the middle at 100%', () => {
    const centre = { x: 330, y: 350, width: 300, height: 200 };
    expect(firstView({ width: 0, height: 0 }, phone, centre, [], 24)).toEqual(
      homeView(centre, phone),
    );
  });
});

describe('edges', () => {
  it('lets a map bigger than the card pan only until its edge, with a margin', () => {
    expect(panRange(1000, 328, 1, 24)).toEqual([328 - 1000 - 24, 24]);
    // Smaller than the card: it moves anywhere inside the card.
    expect(panRange(200, 328, 1, 24)).toEqual([24, 328 - 200 - 24]);
  });

  it('clamps a view that went off the map back to the edge', () => {
    const v = clampView({ x: 500, y: -5000, scale: 1 }, world, phone, 24);
    expect(v).toEqual({ x: 24, y: 520 - 800 - 24, scale: 1 });
  });

  it('eases a view past the edge back over several frames, not at once', () => {
    let state: ReturnType<typeof step> = {
      view: { x: 200, y: 0, scale: 1 },
      vx: 0,
      vy: 0,
      done: false,
    };
    const first = step(state, 16, world, phone, 24);
    expect(first.view.x).toBeLessThan(200);
    expect(first.view.x).toBeGreaterThan(24);
    let frames = 0;
    while (!state.done && frames < 500) {
      state = step(state, 16, world, phone, 24);
      frames += 1;
    }
    expect(state.done).toBe(true);
    expect(state.view.x).toBe(24);
    expect(frames).toBeGreaterThan(3);
  });
});

describe('momentum', () => {
  it('a flick coasts on and comes to rest inside the edges', () => {
    let state: ReturnType<typeof step> = {
      view: { x: -300, y: -100, scale: 1 },
      vx: -1.2,
      vy: 0.4,
      done: false,
    };
    const speeds: number[] = [];
    let frames = 0;
    while (!state.done && frames < 1000) {
      state = step(state, 16, world, phone, 24);
      speeds.push(Math.hypot(state.vx, state.vy));
      frames += 1;
    }
    expect(state.done).toBe(true);
    expect(state.vx).toBe(0);
    expect(state.vy).toBe(0);
    // It slowed down every frame until it stopped.
    for (let i = 1; i < speeds.length; i += 1) {
      expect(speeds[i]).toBeLessThanOrEqual(speeds[i - 1] as number);
    }
    // It moved past where the finger let go, and stayed on the map.
    expect(state.view.x).toBeLessThan(-300);
    expect(state.view).toEqual(clampView(state.view, world, phone, 24));
  });

  it('measures the release speed from the last moments of a drag', () => {
    const samples = [
      { t: 0, x: 0, y: 0 },
      { t: 50, x: 10, y: 0 },
      { t: 100, x: 60, y: 20 },
    ];
    const v = releaseVelocity(samples, false);
    expect(v.vx).toBeGreaterThan(0);
    expect(v.vy).toBeGreaterThan(0);
    // A finger that stopped before letting go doesn't flick.
    expect(releaseVelocity([...samples, { t: 400, x: 60, y: 20 }], false)).toEqual({
      vx: 0,
      vy: 0,
    });
  });
});

describe('reduced motion', () => {
  it('never coasts: the release speed is nothing', () => {
    const samples = [
      { t: 0, x: 0, y: 0 },
      { t: 50, x: 100, y: 40 },
    ];
    expect(releaseVelocity(samples, true)).toEqual({ vx: 0, vy: 0 });
  });

  it('never glides: the glide is at its end at once', () => {
    const from: View = { x: 0, y: 0, scale: 1 };
    const to: View = { x: 300, y: -200, scale: 1.5 };
    expect(glide(from, to, 0, true)).toEqual(to);
    // With motion, the glide starts where it was and ends where it goes.
    expect(glide(from, to, 0, false)).toEqual(from);
    expect(glide(from, to, 1, false)).toEqual(to);
    const half = glide(from, to, 0.5, false);
    expect(half.x).toBeGreaterThan(150); // eased out: past halfway at half time
    expect(half.x).toBeLessThan(300);
  });
});

describe('keyboard focus', () => {
  it('moves the least it can to show a focused part, and nothing when it shows already', () => {
    const view: View = { x: 0, y: 0, scale: 1 };
    const shown = { x: 40, y: 40, width: 100, height: 60 };
    expect(revealView(view, shown, phone, 16)).toEqual(view);
    const right = { x: 600, y: 100, width: 200, height: 100 };
    const v = revealView(view, right, phone, 16);
    expect(v.scale).toBe(1);
    expect(v.x + right.x + right.width).toBeCloseTo(phone.width - 16, 6);
    expect(v.y).toBe(0);
    // Too wide for the card: its start shows.
    const wide = { x: 600, y: 100, width: 900, height: 100 };
    expect(revealView(view, wide, phone, 16).x + wide.x).toBeCloseTo(16, 6);
  });
});

describe('pointer', () => {
  it('a tap is not a drag; a move past the threshold is', () => {
    expect(isDrag(2, 3)).toBe(false);
    expect(isDrag(DRAG_THRESHOLD, 0)).toBe(false);
    expect(isDrag(DRAG_THRESHOLD + 1, 0)).toBe(true);
    expect(isDrag(-5, -5)).toBe(true);
  });

  it('turns a wheel in lines or pages into pixels', () => {
    expect(wheelDelta({ deltaX: 3, deltaY: 4, deltaMode: 0 }, 500)).toEqual({ dx: 3, dy: 4 });
    expect(wheelDelta({ deltaX: 0, deltaY: 2, deltaMode: 1 }, 500)).toEqual({ dx: 0, dy: 32 });
    expect(wheelDelta({ deltaX: 1, deltaY: 0, deltaMode: 2 }, 500)).toEqual({ dx: 500, dy: 0 });
  });
});

describe('dragging past an edge', () => {
  it('follows the finger inside the edges and resists past them', () => {
    const inside: View = { x: -100, y: -50, scale: 1 };
    expect(rubber(inside, world, phone, 24)).toEqual(inside);
    const past = rubber({ x: 124, y: -50, scale: 1 }, world, phone, 24);
    expect(past.x).toBeGreaterThan(24);
    expect(past.x).toBeLessThan(124);
    const below = rubber({ x: -100, y: -404 - 100, scale: 1 }, world, phone, 24);
    expect(below.y).toBeLessThan(-304);
    expect(below.y).toBeGreaterThan(-504);
  });
});

describe('the mini-map', () => {
  it('puts the point it was tapped at in the middle of the card, at the same zoom', () => {
    const v = centreOn({ x: 0, y: 0, scale: 0.5 }, { x: 400, y: 300 }, phone);
    expect(v.scale).toBe(0.5);
    expect(onScreen(v, { x: 400, y: 300 })).toEqual({ x: phone.width / 2, y: phone.height / 2 });
  });
});

describe('paths drawn behind the map', () => {
  const boxes = [
    { x: 0, y: 300, width: 200, height: 100 },
    { x: 220, y: 200, width: 200, height: 100 },
    { x: 440, y: 100, width: 200, height: 100 },
  ];

  it('the staircase climbs from each step’s top corner to the next', () => {
    const d = stairPath(boxes);
    expect(d.startsWith('M0 300')).toBe(true);
    expect(d).toContain('H220');
    expect(d).toContain('V200');
    expect(d).toContain('V100');
    expect(stairPath([])).toBe('');
    // A new row back at the left starts the line again rather than crossing the steps.
    expect(stairPath([...boxes, { x: 0, y: 600, width: 200, height: 100 }])).toMatch(/M0 600$/);
  });

  it('the road winds through every milestone, smooth, top to bottom', () => {
    const points = [
      { x: 100, y: 0 },
      { x: 300, y: 200 },
      { x: 100, y: 400 },
    ];
    const d = roadPath(points);
    expect(d.startsWith('M100 0')).toBe(true);
    expect(d.match(/C/g)).toHaveLength(2);
    expect(d.endsWith('100 400')).toBe(true);
    expect(roadPath([{ x: 1, y: 1 }])).toBe('');
  });
});
