import type { PlanLayout } from '@universityflow/ui';
import { PLAN_POSITION_MAX } from '@universityflow/ui';
import { describe, expect, it } from 'vitest';
import type { Box, Size } from '../app/(app)/goals/maps/[id]/canvas-math';
import {
  CARD_WIDTH,
  cardHeight,
  connectors,
  defaultLayout,
  edgePoint,
  freePlace,
  HUB_WIDTH,
  hubBodyHeight,
  hubOuter,
  hubShape,
  MAP_GAP,
  MAP_GRID,
  nudge,
  placeCards,
  ROAD_WIDTH,
  roadOf,
  roadSamples,
  SLOT,
  toPlace,
  whereIs,
} from '../app/(app)/goals/maps/[id]/map-layout';

/**
 * The plan map's picture as pure maths (RT-07, RT-08: the owner's run-through, 2026-10-25): each
 * template's own arrangement worked out from the cards' real sizes so nothing overlaps, every
 * branch drawn between the actual edges of the two things it joins, and cards the learner moves
 * kept on the canvas. No DOM.
 */

const LAYOUTS: ReadonlyArray<PlanLayout> = ['ring', 'cloud', 'stairs', 'branches', 'road'];

/** A seeded run of card heights, from a short empty card to a tall one with words and steps. */
function heights(n: number, seed: number): number[] {
  let s = seed;
  return Array.from({ length: n }, () => {
    s = (s * 9301 + 49297) % 233280;
    return 150 + Math.round((s / 233280) * 330);
  });
}

const gapBetween = (a: Box, b: Box) =>
  Math.max(
    b.x - (a.x + a.width),
    a.x - (b.x + b.width),
    b.y - (a.y + a.height),
    a.y - (b.y + b.height),
  );

const centre = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

describe('each template’s own arrangement (RT-07)', () => {
  for (const layout of LAYOUTS) {
    it(`${layout}: no card touches another or the middle, at every count and size, all on the canvas`, () => {
      // Up to the cap on stops under the middle (PLAN_LIMITS.children): the ring never falls back
      // to a list (the old RING_MAX rule is gone), it grows.
      const most = 12;
      for (let n = 1; n <= most; n += 1) {
        for (const seed of [1, 7, 42]) {
          const hub = hubOuter(layout, { width: 272, height: 150 + (seed % 5) * 30 });
          const cards: Size[] = heights(n, seed + n).map((h) => ({
            width: CARD_WIDTH[layout],
            height: h,
          }));
          const { hub: h, cards: boxes, world } = defaultLayout(layout, hub, cards);
          const all = [h, ...boxes];
          for (const [i, a] of all.entries()) {
            expect(a.x).toBeGreaterThanOrEqual(0);
            expect(a.y).toBeGreaterThanOrEqual(0);
            expect(a.x + a.width).toBeLessThanOrEqual(world.width);
            expect(a.y + a.height).toBeLessThanOrEqual(world.height);
            for (const b of all.slice(i + 1))
              expect(gapBetween(a, b)).toBeGreaterThanOrEqual(MAP_GAP);
          }
          expect(world.width).toBeLessThanOrEqual(PLAN_POSITION_MAX);
          expect(world.height).toBeLessThanOrEqual(PLAN_POSITION_MAX);
        }
      }
    });
  }

  it('the radial maps read clockwise from the top, as the list does (WCAG 2.4.3)', () => {
    for (const layout of ['ring', 'cloud', 'branches'] as const) {
      const hub = hubOuter(layout, { width: 272, height: 200 });
      const { hub: h, cards } = defaultLayout(
        layout,
        hub,
        heights(6, 3).map((height) => ({ width: CARD_WIDTH[layout], height })),
      );
      const c = centre(h);
      // Clockwise from straight up: 0 at the top, rising to the right, below, then the left.
      const angles = cards.map((b) => {
        const p = centre(b);
        const a = Math.atan2(p.x - c.x, -(p.y - c.y));
        return a < -1e-6 ? a + 2 * Math.PI : a;
      });
      // Straight above (to within the whole pixel each box is rounded to).
      expect(angles[0]).toBeCloseTo(0, 2);
      for (let i = 1; i < angles.length; i += 1) {
        expect(angles[i] as number).toBeGreaterThan(angles[i - 1] as number);
      }
    }
  });

  it('the staircase climbs: each step stands higher than the one before, the goal the last step up', () => {
    const hub = hubOuter('stairs', { width: 272, height: 180 });
    const { hub: h, cards } = defaultLayout(
      'stairs',
      hub,
      heights(8, 5).map((height) => ({ width: CARD_WIDTH.stairs, height })),
    );
    for (let i = 1; i < cards.length; i += 1) {
      const [a, b] = [cards[i - 1] as Box, cards[i] as Box];
      expect(b.y + b.height).toBeLessThan(a.y + a.height);
    }
    // The goal stands higher than every step, beside the top one (2026-10-26: so the first view
    // shows it with the steps below it, canvas-math.ts firstViewOf).
    for (const b of cards) expect(h.y + h.height).toBeLessThan(b.y + b.height);
    const top = cards.at(-1) as Box;
    expect(h.x).toBeGreaterThan(top.x + top.width);
  });

  it('the road starts at the bottom, milestones either side in turn, the goal at its end', () => {
    const hub = hubOuter('road', { width: 272, height: 180 });
    const { hub: h, cards } = defaultLayout(
      'road',
      hub,
      heights(6, 9).map((height) => ({ width: CARD_WIDTH.road, height })),
    );
    for (let i = 1; i < cards.length; i += 1) {
      const [a, b] = [cards[i - 1] as Box, cards[i] as Box];
      expect(centre(b).y).toBeLessThan(centre(a).y);
      expect(centre(b).x < centre(h).x).toBe(!(centre(a).x < centre(h).x));
    }
    for (const b of cards) expect(h.y + h.height).toBeLessThan(b.y);
  });

  for (const layout of LAYOUTS) {
    it(`${layout}: no branch runs through a card other than its own, and the road keeps clear of every card`, () => {
      for (let n = 1; n <= 12; n += 1) {
        const hub = hubOuter(layout, { width: 272, height: 200 });
        const cards: Size[] = heights(n, n * 3).map((h) => ({
          width: CARD_WIDTH[layout],
          height: h,
        }));
        const laid = defaultLayout(layout, hub, cards);
        const inside = (p: { x: number; y: number }, b: Box, slack = 0) =>
          p.x > b.x - slack &&
          p.x < b.x + b.width + slack &&
          p.y > b.y - slack &&
          p.y < b.y + b.height + slack;
        for (const line of connectors(layout, laid.hub, laid.cards)) {
          expect(line.points.length).toBeGreaterThan(1);
          for (const [i, b] of laid.cards.entries()) {
            if (i === line.index) continue;
            // The staircase's arrows run to the next step: that step is its own end too.
            if (layout === 'stairs' && i === line.index + 1) continue;
            for (const p of line.points)
              expect(inside(p, b), `${layout} ${n} ${line.index} -> ${i}`).toBe(false);
          }
        }
        if (layout === 'road') {
          for (const p of roadSamples(laid.hub, laid.cards)) {
            for (const [i, b] of laid.cards.entries()) {
              expect(inside(p, b, ROAD_WIDTH / 2), `${n} road near card ${i}`).toBe(false);
            }
          }
        }
      }
    });
  }

  it('the middle’s shape is drawn around its words, never through them', () => {
    for (const layout of LAYOUTS) {
      const content = { width: 272, height: 220 };
      const outer = hubOuter(layout, content);
      expect(outer.width).toBeGreaterThanOrEqual(content.width);
      expect(outer.height).toBeGreaterThanOrEqual(content.height);
      if (hubShape(layout) === 'rect') continue;
      // Each corner of the words' box sits inside the ellipse the shape is drawn round.
      const rx = outer.width / 2;
      const ry = outer.height / 2;
      const corner = (content.width / 2 / rx) ** 2 + (content.height / 2 / ry) ** 2;
      expect(corner).toBeLessThan(1);
    }
  });
});

describe('the branches join the actual edges of what they connect (RT-07)', () => {
  const onEllipse = (b: Box, p: { x: number; y: number }) => {
    const c = centre(b);
    return ((p.x - c.x) / (b.width / 2)) ** 2 + ((p.y - c.y) / (b.height / 2)) ** 2;
  };
  const toRect = (b: Box, p: { x: number; y: number }) =>
    Math.min(
      Math.abs(p.x - b.x),
      Math.abs(p.x - (b.x + b.width)),
      Math.abs(p.y - b.y),
      Math.abs(p.y - (b.y + b.height)),
    );

  it('a point on a card’s edge, facing the other thing, clear of its rounded corners', () => {
    const card = { x: 100, y: 100, width: 200, height: 120 };
    for (const toward of [
      { x: 0, y: 0 },
      { x: 600, y: 160 },
      { x: 200, y: 900 },
      { x: -400, y: 160 },
    ]) {
      const { point } = edgePoint(card, toward, 'rect');
      expect(toRect(card, point)).toBeLessThan(0.01);
      // Not within the corner's radius (16px) of a corner, so the line meets the drawn edge.
      const nearCorner = [
        [card.x, card.y],
        [card.x + card.width, card.y],
        [card.x, card.y + card.height],
        [card.x + card.width, card.y + card.height],
      ].some(([x, y]) => Math.hypot(point.x - (x as number), point.y - (y as number)) < 16);
      expect(nearCorner).toBe(false);
    }
  });

  for (const layout of ['ring', 'cloud', 'branches'] as const) {
    it(`${layout}: every card has one branch, from the middle’s edge to the card’s edge`, () => {
      const hub = hubOuter(layout, { width: 272, height: 200 });
      const laid = defaultLayout(
        layout,
        hub,
        heights(6, 11).map((height) => ({ width: CARD_WIDTH[layout], height })),
      );
      const lines = connectors(layout, laid.hub, laid.cards);
      expect(lines).toHaveLength(6);
      for (const [i, line] of lines.entries()) {
        expect(line.index).toBe(i);
        expect(Math.abs(onEllipse(laid.hub, line.from) - 1)).toBeLessThan(0.01);
        expect(toRect(laid.cards[i] as Box, line.to)).toBeLessThan(0.01);
        expect(line.d.startsWith('M')).toBe(true);
      }
    });
  }

  it('a branch follows its card when the card is moved', () => {
    const hub = hubOuter('ring', { width: 272, height: 200 });
    const laid = defaultLayout('ring', hub, [{ width: 288, height: 200 }]);
    const before = connectors('ring', laid.hub, laid.cards)[0];
    const moved = placeCards(
      laid,
      { hub: null, cards: [{ x: 900, y: 1200 }] },
      { width: 288, height: 200 },
    );
    const after = connectors('ring', moved.hub, moved.cards)[0];
    expect(after?.to).not.toEqual(before?.to);
    expect(toRect(moved.cards[0] as Box, after?.to as { x: number; y: number })).toBeLessThan(0.01);
  });

  it('the staircase joins each step to the next, and the last to the goal', () => {
    const hub = hubOuter('stairs', { width: 272, height: 180 });
    const laid = defaultLayout(
      'stairs',
      hub,
      heights(8, 2).map((height) => ({ width: CARD_WIDTH.stairs, height })),
    );
    const lines = connectors('stairs', laid.hub, laid.cards);
    expect(lines).toHaveLength(8);
    for (const [i, line] of lines.slice(0, 7).entries()) {
      expect(toRect(laid.cards[i] as Box, line.from)).toBeLessThan(0.01);
      expect(toRect(laid.cards[i + 1] as Box, line.to)).toBeLessThan(0.01);
    }
    expect(toRect(laid.hub, (lines[7] as { to: { x: number; y: number } }).to)).toBeLessThan(0.01);
  });

  it('the road runs from below the first milestone to the goal’s edge, each milestone joined to it', () => {
    const hub = hubOuter('road', { width: 272, height: 180 });
    const laid = defaultLayout(
      'road',
      hub,
      heights(5, 4).map((height) => ({ width: CARD_WIDTH.road, height })),
    );
    const road = roadOf(laid.hub, laid.cards);
    const first = laid.cards[0] as Box;
    expect(road.start.y).toBeGreaterThan(first.y + first.height);
    expect(road.end.y).toBeCloseTo(laid.hub.y + laid.hub.height, 5);
    const lines = connectors('road', laid.hub, laid.cards);
    expect(lines).toHaveLength(5);
    for (const [i, line] of lines.entries()) {
      expect(toRect(laid.cards[i] as Box, line.from)).toBeLessThan(0.01);
      expect(road.markers[i]).toEqual(line.to);
    }
  });
});

describe('cards the learner moves (RT-08)', () => {
  it('a saved place wins over the template’s; the canvas grows to hold it; the rest stay', () => {
    const hub = hubOuter('ring', { width: 272, height: 200 });
    const sizes = heights(3, 8).map((height) => ({ width: 288, height }));
    const laid = defaultLayout('ring', hub, sizes);
    const moved = placeCards(laid, { hub: null, cards: [null, { x: 2400, y: 1800 }, null] }, hub);
    expect(moved.cards[1]).toMatchObject({ x: 2400, y: 1800 });
    expect(moved.cards[0]).toEqual(laid.cards[0]);
    expect(moved.cards[2]).toEqual(laid.cards[2]);
    expect(moved.world.width).toBeGreaterThanOrEqual(2400 + 288);
    expect(moved.world.height).toBeGreaterThanOrEqual(1800 + (sizes[1]?.height ?? 0));
  });

  it('a drop snaps to the dotted grid and stays on the canvas', () => {
    expect(toPlace({ x: 37, y: 11 })).toEqual({ x: MAP_GRID * 2, y: 0 });
    expect(toPlace({ x: -80, y: 99999 })).toEqual({ x: 0, y: PLAN_POSITION_MAX });
    expect(Number.isInteger(toPlace({ x: 12.4, y: 47.6 }).x)).toBe(true);
  });

  it('the keys move a card by one dot, or four with Shift, never off the canvas', () => {
    const at = { x: 96, y: 96 };
    expect(nudge(at, 'ArrowRight', false)).toEqual({ x: 96 + MAP_GRID, y: 96 });
    expect(nudge(at, 'ArrowUp', true)).toEqual({ x: 96, y: 0 });
    expect(nudge({ x: 0, y: 0 }, 'ArrowLeft', false)).toEqual({ x: 0, y: 0 });
    expect(nudge(at, 'ArrowDown', true)).toEqual({ x: 96, y: 96 + 4 * MAP_GRID });
    expect(nudge(at, 'a', false)).toBeNull();
  });
});

describe('fixed footprints: a card’s height from what it holds, final on the server (MAPS-05, A4-21)', () => {
  const empty = {
    note: true,
    whyNot: false,
    differently: false,
    target: false,
    link: false,
    steps: 0,
  };

  it('is the sum of fixed slots: the same numbers every time, nothing measured', () => {
    const base = cardHeight(empty);
    // Padding and border both sides, the head, the status row, the note, the actions, three gaps.
    expect(base).toBe(
      2 * SLOT.pad +
        2 * SLOT.border +
        SLOT.head +
        SLOT.status +
        SLOT.note +
        SLOT.actions +
        3 * SLOT.gap,
    );
    expect(cardHeight(empty)).toBe(base);
    expect(cardHeight({ ...empty, note: false })).toBe(base - SLOT.note - SLOT.gap);
  });

  it('grows by one fixed slot for each part a card holds', () => {
    const base = cardHeight(empty);
    expect(cardHeight({ ...empty, whyNot: true })).toBe(base + SLOT.reflect + SLOT.gap);
    expect(cardHeight({ ...empty, differently: true })).toBe(base + SLOT.reflect + SLOT.gap);
    expect(cardHeight({ ...empty, target: true })).toBe(base + SLOT.target + SLOT.gap);
    expect(cardHeight({ ...empty, link: true })).toBe(base + SLOT.link + SLOT.gap);
    expect(cardHeight({ ...empty, steps: 2 })).toBe(base + 2 * SLOT.step + SLOT.gap);
    // At most three steps show on the card, then "+ n more" on one line.
    expect(cardHeight({ ...empty, steps: 5 })).toBe(base + 3 * SLOT.step + SLOT.more + SLOT.gap);
  });

  it('the middle’s words likewise, compact: a one-line heading, two lines of words, the goal, the About me words, one foot row', () => {
    const none = { note: false, goal: false, words: 0, progress: false, actions: false };
    expect(hubBodyHeight(none)).toBe(2 * SLOT.hubPad + SLOT.hubHeading);
    expect(hubBodyHeight({ ...none, note: true })).toBe(
      2 * SLOT.hubPad + SLOT.hubHeading + SLOT.hubNote + SLOT.gap,
    );
    // One or two About me words sit on one row; three take two.
    expect(hubBodyHeight({ ...none, words: 2 })).toBe(
      2 * SLOT.hubPad + SLOT.hubHeading + SLOT.hubWords + SLOT.gap,
    );
    expect(hubBodyHeight({ ...none, words: 3 })).toBe(
      2 * SLOT.hubPad + SLOT.hubHeading + SLOT.hubWordsTwo + SLOT.gap,
    );
    // Progress and the buttons share one foot row; progress alone is one line.
    expect(hubBodyHeight({ ...none, progress: true })).toBe(
      2 * SLOT.hubPad + SLOT.hubHeading + SLOT.hubProgress + SLOT.gap,
    );
    expect(hubBodyHeight({ ...none, progress: true, actions: true })).toBe(
      2 * SLOT.hubPad + SLOT.hubHeading + SLOT.hubFoot + SLOT.gap,
    );
    const full = hubBodyHeight({ note: true, goal: true, words: 3, progress: true, actions: true });
    expect(full).toBe(
      2 * SLOT.hubPad +
        SLOT.hubHeading +
        SLOT.hubNote +
        SLOT.hubGoal +
        SLOT.hubWordsTwo +
        SLOT.hubFoot +
        4 * SLOT.gap,
    );
    // About one card's height (the integrator, 2026-10-25), with everything on it.
    expect(full).toBeLessThanOrEqual(
      cardHeight({
        note: true,
        whyNot: true,
        differently: false,
        target: false,
        link: true,
        steps: 0,
      }),
    );
  });

  it('the middle’s shape stays near its words’ height: wider rather than taller', () => {
    for (const layout of LAYOUTS) {
      const content = { width: HUB_WIDTH[layout], height: 300 };
      const outer = hubOuter(layout, content);
      expect(outer.height).toBeLessThanOrEqual(content.height * 1.5);
      if (hubShape(layout) === 'ellipse') expect(outer.width).toBeGreaterThanOrEqual(outer.height);
    }
  });
});

describe('where a card is, in words (MAPS-06, WCAG 2.5.7)', () => {
  const hub = { x: 500, y: 500, width: 200, height: 200 };
  const card = (x: number, y: number) => ({ x, y, width: 100, height: 100 });

  it('names the sector round the middle, clockwise from above, and near or far', () => {
    expect(whereIs(card(550, 200), hub)).toEqual({ sector: 'n', far: false });
    expect(whereIs(card(900, 550), hub)).toEqual({ sector: 'e', far: false });
    expect(whereIs(card(550, 900), hub)).toEqual({ sector: 's', far: false });
    expect(whereIs(card(100, 550), hub)).toEqual({ sector: 'w', far: false });
    expect(whereIs(card(900, 200), hub)).toEqual({ sector: 'ne', far: false });
    expect(whereIs(card(100, 900), hub)).toEqual({ sector: 'sw', far: false });
    expect(whereIs(card(1600, 550), hub)).toEqual({ sector: 'e', far: true });
    expect(whereIs(card(550, 550), hub).sector).toBe('n');
  });
});

describe('a dropped card never lands on another (RT-07, RT-08)', () => {
  const others: Box[] = [
    { x: 240, y: 240, width: 240, height: 200 },
    { x: 600, y: 240, width: 240, height: 200 },
  ];
  const overlaps = (a: Box, b: Box) => gapBetween(a, b) < MAP_GAP;

  it('keeps a free spot as it is', () => {
    const box = { x: 240, y: 600, width: 240, height: 160 };
    expect(freePlace(box, others)).toEqual({ x: 240, y: 600 });
  });

  it('moves a card dropped on another to the nearest free dot of the grid', () => {
    const box = { x: 264, y: 264, width: 240, height: 160 };
    const place = freePlace(box, others);
    expect(place).not.toBeNull();
    const at = { ...box, ...(place as { x: number; y: number }) };
    for (const o of others) expect(overlaps(at, o)).toBe(false);
    expect(at.x % MAP_GRID).toBe(0);
    expect(at.y % MAP_GRID).toBe(0);
    expect(at.x).toBeGreaterThanOrEqual(0);
    expect(at.y).toBeGreaterThanOrEqual(0);
    // The nearest: no free dot closer to where it was dropped.
    const dist = Math.hypot(at.x - box.x, at.y - box.y);
    for (let dx = -8; dx <= 8; dx += 1) {
      for (let dy = -8; dy <= 8; dy += 1) {
        const c = { ...box, x: box.x + dx * MAP_GRID, y: box.y + dy * MAP_GRID };
        if (c.x < 0 || c.y < 0 || others.some((o) => overlaps(c, o))) continue;
        expect(Math.hypot(c.x - box.x, c.y - box.y)).toBeGreaterThanOrEqual(dist - 1e-9);
      }
    }
  });

  it('says so (null) when a card is boxed in on every side', () => {
    const wall: Box[] = [];
    for (let i = -3; i <= 3; i += 1) {
      for (let j = -3; j <= 3; j += 1) {
        if (i === 0 && j === 0) continue;
        wall.push({ x: 1000 + i * 300, y: 1000 + j * 300, width: 300, height: 300 });
      }
    }
    expect(freePlace({ x: 1000, y: 1000, width: 300, height: 300 }, wall)).toBeNull();
    // The card's own old box is never in its way (the caller leaves it out).
    expect(freePlace({ x: 1000, y: 1000, width: 10, height: 10 }, [])).toEqual({
      x: 1000,
      y: 1000,
    });
  });
});
