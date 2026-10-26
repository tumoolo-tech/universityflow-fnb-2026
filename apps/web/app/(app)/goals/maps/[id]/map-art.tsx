import type { PlanLayout, PlanStatus } from '@universityflow/ui';
import type { CSSProperties } from 'react';
import type { Box, Point, Size } from './canvas-math';
import { type Connector, connectors, roadOf } from './map-layout';

/**
 * The plan map's drawing (RT-07, the owner's run-through, 2026-10-25), all decoration: hidden
 * from screen readers (the map's words are the list itself), coloured only from tokens, drawn from
 * where the parts are now (map-layout.ts). Each branch carries `data-link` and its parts
 * `data-part`, the road `data-road-path`, its sign `data-road-sign` and each marker `data-marker`,
 * so the page can redraw what follows a dragged card straight into the SVG, once a frame
 * (plan-map-view.tsx `redraw`, MAPS-04).
 *
 * The middle's shape is drawn round its words (never through them): a starburst (the owner's
 * first picture), a cloud (the second), a circle (the fourth), or a goal card with a flag (the
 * staircase and the road). Round shapes carry a ring that fills as stops are achieved.
 */

const n = (v: number) => String(Math.round(v * 10) / 10);
const tone = (i: number) =>
  ({
    '--uf-map-tone': `var(--uf-color-map-tone${(i % 6) + 1})`,
    '--uf-map-soft': `var(--uf-color-map-tone${(i % 6) + 1}-soft)`,
    '--i': i,
  }) as CSSProperties;

/** A star of `points` points round an ellipse: its inner corners on the ellipse, its tips `reach` out. */
function starPath(size: Size, points: number, reach: number): string {
  const cx = size.width / 2;
  const cy = size.height / 2;
  const out: string[] = [];
  for (let i = 0; i < points * 2; i += 1) {
    const a = (Math.PI * i) / points - Math.PI / 2;
    const tip = i % 2 === 0;
    const rx = cx + (tip ? reach : 0);
    const ry = cy + (tip ? reach : 0);
    out.push(`${n(cx + Math.cos(a) * rx)} ${n(cy + Math.sin(a) * ry)}`);
  }
  return `M${out.join(' L')} Z`;
}

/** A cloud round an ellipse: rounded bumps bulging out between points on it. */
function cloudPath(size: Size, bumps: number): string {
  const cx = size.width / 2;
  const cy = size.height / 2;
  const at = (a: number, k: number) => ({
    x: cx + Math.cos(a) * cx * k,
    y: cy + Math.sin(a) * cy * k,
  });
  const start = at(-Math.PI / 2, 1);
  let d = `M${n(start.x)} ${n(start.y)}`;
  for (let i = 0; i < bumps; i += 1) {
    const a0 = -Math.PI / 2 + (2 * Math.PI * i) / bumps;
    const a1 = a0 + (2 * Math.PI) / bumps;
    const c1 = at(a0 + (a1 - a0) * 0.1, 1.2);
    const c2 = at(a0 + (a1 - a0) * 0.9, 1.2);
    const end = at(a1, 1);
    d += ` C${n(c1.x)} ${n(c1.y)} ${n(c2.x)} ${n(c2.y)} ${n(end.x)} ${n(end.y)}`;
  }
  return `${d} Z`;
}

/** The middle's shape, behind its words, with the ring of how much is achieved. */
export function HubArt({
  layout,
  size,
  done,
}: {
  layout: PlanLayout;
  size: Size;
  /** Achieved stops as a share of all (0 to 1). */
  done: number;
}) {
  const { width: w, height: h } = size;
  // The progress ring sits outside the shape, on the canvas (MAPS-14: success on the shape's own
  // light fill would be invisible; on the canvas it is 11:1): 14px past the star's tips, the
  // cloud's bumps and the circle's halo, 6px wide. Measured by test/plan-map-view.test.tsx.
  const ring = (out: number) => (
    <>
      <ellipse
        className="uf-map-hub-track"
        cx={w / 2}
        cy={h / 2}
        rx={w / 2 + out}
        ry={h / 2 + out}
      />
      {done > 0 ? (
        <ellipse
          className="uf-map-hub-progress"
          cx={w / 2}
          cy={h / 2}
          rx={w / 2 + out}
          ry={h / 2 + out}
          pathLength={1}
          strokeDasharray={`${done} 1`}
          transform={`rotate(-90 ${n(w / 2)} ${n(h / 2)})`}
        />
      ) : null}
    </>
  );
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="uf-map-hub-art"
      width={w}
      height={h}
      viewBox={`0 0 ${n(w)} ${n(h)}`}
    >
      {layout === 'ring' ? (
        <>
          <path className="uf-map-hub-shape" d={starPath(size, 14, 26)} />
          {ring(40)}
        </>
      ) : null}
      {layout === 'cloud' ? (
        <>
          <path className="uf-map-hub-shape" d={cloudPath(size, 10)} />
          {ring(Math.ceil(Math.max(w, h) * 0.1) + 14)}
        </>
      ) : null}
      {layout === 'branches' ? (
        <>
          <ellipse
            className="uf-map-hub-halo"
            cx={w / 2}
            cy={h / 2}
            rx={w / 2 + 10}
            ry={h / 2 + 10}
          />
          <ellipse className="uf-map-hub-shape" cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} />
          {/* 14px past the halo's outer edge (it is 10px out, 2px wide). */}
          {ring(10 + 1 + 14)}
        </>
      ) : null}
      {layout === 'stairs' || layout === 'road' ? (
        // A flag on a pole above the goal card: where the climb or the road ends.
        <g className="uf-map-hub-flag">
          <path className="uf-map-hub-pole" d={`M${n(w / 2)} 0 V-46`} />
          <path
            className="uf-map-hub-pennant"
            d={`M${n(w / 2)} -46 L${n(w / 2 + 40)} -36 L${n(w / 2)} -26 Z`}
          />
        </g>
      ) : null}
    </svg>
  );
}

/** One branch: a tapered line or a plain one, and what marks where it meets its card. */
function Link({ c, i, achieved }: { c: Connector; i: number; achieved: boolean }) {
  return (
    <g
      className="uf-map-link"
      data-link={c.index}
      data-kind={c.kind}
      data-achieved={achieved ? '' : undefined}
      style={tone(i)}
    >
      <path
        className={c.kind === 'taper' ? 'uf-map-link-taper' : 'uf-map-link-line'}
        data-part="line"
        pathLength={c.kind === 'stroke' ? 1 : undefined}
        d={c.d}
      />
      {c.head ? <path className="uf-map-link-head" data-part="head" d={c.head} /> : null}
      {c.end === 'dot' ? (
        <circle className="uf-map-link-dot" data-part="dot" cx={c.to.x} cy={c.to.y} r={6} />
      ) : null}
    </g>
  );
}

/** A five-pointed star, the road's milestone marker. */
export function markerPath(p: Point, r = 9): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const a = (Math.PI * i) / 5 - Math.PI / 2;
    const k = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${n(p.x + Math.cos(a) * k)} ${n(p.y + Math.sin(a) * k)}`);
  }
  return `M${pts.join(' L')} Z`;
}

/**
 * Every branch of the map, behind its cards, the size of the whole canvas. The road (the owner's
 * fifth picture) is drawn here too: from its start sign, through a star by each milestone, to the
 * goal; the staircase's arrows climb from each step to the next.
 */
export function MapLinks({
  layout,
  hub,
  cards,
  world,
  statuses,
  startLabel,
}: {
  layout: PlanLayout;
  hub: Box;
  cards: ReadonlyArray<Box>;
  world: Size;
  /** Each card's status, in order: an achieved card's branch end is marked done. */
  statuses: ReadonlyArray<PlanStatus>;
  startLabel: string;
}) {
  const lines = connectors(layout, hub, cards);
  const road = layout === 'road' && cards.length > 0 ? roadOf(hub, cards) : null;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="uf-map-links"
      viewBox={`0 0 ${world.width} ${world.height}`}
    >
      {road ? (
        <g className="uf-map-road">
          <path className="uf-map-road-edge" data-road-path="" d={road.d} />
          <path className="uf-map-road-way" data-road-path="" pathLength={1} d={road.d} />
          <path className="uf-map-road-line" data-road-path="" d={road.d} />
          <g
            className="uf-map-road-sign"
            data-road-sign=""
            transform={`translate(${n(road.start.x)} ${n(road.start.y)})`}
          >
            <path className="uf-map-road-post" d="M0 0 v-56" />
            <rect className="uf-map-road-board" x={-40} y={-78} width={80} height={30} rx={6} />
            <text className="uf-map-road-text" x={0} y={-57} textAnchor="middle">
              {startLabel}
            </text>
          </g>
        </g>
      ) : null}
      {lines.map((c, i) => (
        <Link
          key={`${c.index}-${layout}`}
          c={c}
          i={i}
          achieved={statuses[c.index] === 'achieved'}
        />
      ))}
      {road
        ? road.markers.map((m, i) => (
            <g
              key={`m-${cards[i]?.x}-${cards[i]?.y}`}
              className="uf-map-marker"
              data-marker={i}
              data-achieved={statuses[i] === 'achieved' ? '' : undefined}
              style={tone(i)}
            >
              <circle cx={m.x} cy={m.y} r={15} />
              <path d={markerPath(m)} />
            </g>
          ))
        : null}
    </svg>
  );
}
