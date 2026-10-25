'use client';

import type { PlanLayout } from '@universityflow/ui';
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { PlanCopy } from '@/lib/server/plan-maps-copy';
import {
  type Box,
  centreOn,
  clampView,
  EDGE,
  firstView,
  fitView,
  glide,
  homeView,
  isDrag,
  type Motion,
  PAN_STEP,
  PAN_STEP_BIG,
  type Point,
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
} from './canvas-math';

/**
 * The plan map on a canvas card (the owner, 2026-10-24): the picture in its own window that the
 * learner pans (drag, wheel, arrow keys) and zooms (pinch, Ctrl or ⌘ and the wheel, the buttons,
 * + and −) toward the pointer, with a dotted ground that moves and scales with it, a gentle coast
 * after a flick, edges that ease back, a mini-map, and a full-screen dialog (`CanvasDialog`).
 *
 * **Progressive:** the server draws the map inside a window that scrolls natively both ways, so
 * it reads before any JavaScript; this component then takes the window over (`data-enhanced`) and
 * moves the map with one CSS transform, written to custom properties once a frame, never through
 * React state. The maths is `canvas-math.ts`, every rule tested there. No library.
 *
 * **Never by accident:** a press becomes a pan only past a few pixels, and the click that ends a
 * pan is swallowed, so a drag that starts on a part's button never opens it; a tap still does.
 * **Reduced motion:** no coast, no glide, no draw-in: every move is a jump.
 */

type CanvasCopy = PlanCopy['canvas'];

/** Each picture's own width inside the card (tokens.canvas, held by test/plan-map-canvas.test.tsx). */
const WORLD_CLASS: Record<PlanLayout, string> = {
  ring: 'uf-canvas-world--ring',
  cloud: 'uf-canvas-world--cloud',
  stairs: 'uf-canvas-world--stairs',
  branches: 'uf-canvas-world--branches',
  road: 'uf-canvas-world--road',
};

const PERCENT = new Intl.NumberFormat('en-ZA', { style: 'percent' });

function reducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** The glide's time: the token (0ms under reduced motion, tokens.css), 200ms with no stylesheet. */
function glideTime(): number {
  const ms = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--uf-duration-normal'),
  );
  return Number.isFinite(ms) ? ms : 200;
}

const FIELD = 'input, textarea, select, [contenteditable="true"]';

interface Measured {
  readonly world: Size;
  readonly parts: ReadonlyArray<Box & { readonly status: string; readonly centre: boolean }>;
  readonly path: string;
}

export function MapCanvas({
  copy,
  layout,
  expanded = false,
  returnFocus = false,
  onOpen,
  children,
}: {
  copy: CanvasCopy;
  layout: PlanLayout;
  /** In the full-screen dialog: focus starts in the map, and Open is the dialog's Close. */
  expanded?: boolean;
  /** Back on the page after the dialog closed: focus returns to Open (WCAG 2.4.3). */
  returnFocus?: boolean;
  onOpen?: () => void;
  children: ReactNode;
}) {
  const openButton = useRef<HTMLButtonElement>(null);
  const hintId = useId();
  const root = useRef<HTMLDivElement>(null);
  const port = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const miniView = useRef<SVGRectElement>(null);
  const view = useRef<View>({ x: 0, y: 0, scale: 1 });
  const frame = useRef<number | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const drag = useRef<{
    start: Point;
    from: View;
    moved: boolean;
    samples: Array<{ t: number; x: number; y: number }>;
  } | null>(null);
  const pinch = useRef<{ distance: number; centre: Point; from: View } | null>(null);
  const swallowClick = useRef(false);
  const [enhanced, setEnhanced] = useState(false);
  const [seen, setSeen] = useState(false);
  const [scale, setScale] = useState(1);
  const [measured, setMeasured] = useState<Measured | null>(null);

  const sizes = (): { port: Size; world: Size } => ({
    port: { width: port.current?.clientWidth ?? 0, height: port.current?.clientHeight ?? 0 },
    world: { width: world.current?.offsetWidth ?? 0, height: world.current?.offsetHeight ?? 0 },
  });

  /**
   * Puts the map where `v` says. The pan is the window's own scroll position over a stage one
   * window wider on every side than the zoomed map (so the browser's own "scroll into view", for
   * Tab, find in page and tests, reaches every part, and the edges have room to give); the zoom is
   * one CSS scale. The view is also written as custom properties, for the CSS and the tests.
   */
  function apply(v: View) {
    view.current = v;
    const el = port.current;
    if (el) {
      el.style.setProperty('--uf-canvas-x', `${v.x}px`);
      el.style.setProperty('--uf-canvas-y', `${v.y}px`);
      el.style.setProperty('--uf-canvas-scale', String(v.scale));
      const m = Math.max(el.clientWidth, el.clientHeight);
      el.style.setProperty('--uf-canvas-margin', `${m}px`);
      const st = stage.current;
      const w = world.current;
      if (st && w && root.current?.hasAttribute('data-enhanced')) {
        st.style.width = `${w.offsetWidth * v.scale + 2 * m}px`;
        st.style.height = `${w.offsetHeight * v.scale + 2 * m}px`;
        el.scrollLeft = m - v.x;
        el.scrollTop = m - v.y;
      }
    }
    const mini = miniView.current;
    if (mini && el) {
      mini.setAttribute('x', String(-v.x / v.scale));
      mini.setAttribute('y', String(-v.y / v.scale));
      mini.setAttribute('width', String(el.clientWidth / v.scale));
      mini.setAttribute('height', String(el.clientHeight / v.scale));
    }
    setScale(v.scale);
  }

  function stop() {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }

  const kept = (v: View) => {
    const s = sizes();
    return clampView(v, s.world, s.port, EDGE);
  };

  /** Glides to `to` (kept on the map) over the token's time; jumps under reduced motion. */
  function goTo(to: View) {
    stop();
    const target = kept(to);
    const time = glideTime();
    if (reducedMotion() || time <= 0) {
      apply(target);
      return;
    }
    const from = view.current;
    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now;
      const progress = (now - start) / time;
      apply(glide(from, target, progress, false));
      frame.current = progress < 1 ? requestAnimationFrame(tick) : null;
    };
    frame.current = requestAnimationFrame(tick);
  }

  /** After a release: coasts on and eases back from an edge; under reduced motion, jumps back. */
  function release(vx: number, vy: number) {
    stop();
    if (reducedMotion()) {
      apply(kept(view.current));
      return;
    }
    let motion: Motion = { view: view.current, vx, vy, done: false };
    let last: number | null = null;
    const tick = (now: number) => {
      const dt = last === null ? 16 : Math.min(48, now - last);
      last = now;
      const s = sizes();
      motion = step(motion, dt, s.world, s.port, EDGE);
      apply(motion.view);
      frame.current = motion.done ? null : requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }

  /** A part of the map, in map coordinates. */
  function boxOf(el: Element): Box {
    const r = el.getBoundingClientRect();
    const w = world.current?.getBoundingClientRect();
    const s = view.current.scale;
    return {
      x: (r.left - (w?.left ?? 0)) / s,
      y: (r.top - (w?.top ?? 0)) / s,
      width: r.width / s,
      height: r.height / s,
    };
  }

  const middle = (): Point => {
    const { port: p } = sizes();
    return { x: p.width / 2, y: p.height / 2 };
  };

  const home = (): View => {
    const centre = world.current?.querySelector('.uf-map-centre');
    const box = centre ? boxOf(centre) : { x: 0, y: 0, width: 0, height: 0 };
    return homeView(box, sizes().port);
  };

  const wholeView = (): View => {
    const s = sizes();
    return fitView(s.world, s.port, EDGE);
  };

  const zoomBy = (factor: number) =>
    goTo(zoomAt(view.current, view.current.scale * factor, middle()));

  /** The view a card opens on: the map across it from the top when that reads, else the middle. */
  function start() {
    const centre = world.current?.querySelector('.uf-map-centre');
    const s = sizes();
    const box = centre ? boxOf(centre) : { x: 0, y: 0, width: 0, height: 0 };
    apply(kept(firstView(s.world, s.port, box, EDGE)));
  }

  // Takes the window over once the page is live.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when the card mounts.
  useLayoutEffect(() => {
    const el = port.current;
    if (!el) return;
    root.current?.setAttribute('data-enhanced', '');
    start();
    setEnhanced(true);
    // Here, once the controls show (data-enhanced), not from the page: a button still hidden
    // can't take focus.
    if (returnFocus) openButton.current?.focus();
    return stop;
  }, []);

  // In the full-screen dialog: it has opened by now (a closed dialog has no size), so the first
  // view is measured again, and focus starts in the map.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when the dialog's card mounts.
  useEffect(() => {
    if (!expanded) return;
    start();
    port.current?.focus({ preventScroll: true });
  }, [expanded]);

  // The road and the climb line draw themselves in once, when the card first comes into view.
  useEffect(() => {
    const el = port.current;
    if (!el) return;
    if (reducedMotion() || typeof IntersectionObserver !== 'function') {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Wheel and trackpad: their own listener, not passive, so the page never scrolls under the map.
  // Safari's trackpad pinch arrives as gesture events.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the handlers read refs only.
  useEffect(() => {
    const el = port.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      stop();
      const { dx, dy } = wheelDelta(e, el.clientHeight);
      const v = view.current;
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect();
        const at = { x: e.clientX - r.left, y: e.clientY - r.top };
        apply(kept(zoomAt(v, v.scale * Math.exp(-dy * 0.002), at)));
        return;
      }
      const sideways = e.shiftKey && dx === 0;
      apply(kept({ x: v.x - (sideways ? dy : dx), y: v.y - (sideways ? 0 : dy), scale: v.scale }));
    };
    let gestureFrom = 1;
    const onGestureStart = (e: Event) => {
      if (pointers.current.size > 0) return;
      e.preventDefault();
      gestureFrom = view.current.scale;
    };
    const onGestureChange = (e: Event) => {
      if (pointers.current.size > 0) return;
      e.preventDefault();
      const g = e as Event & { scale?: number; clientX?: number; clientY?: number };
      const r = el.getBoundingClientRect();
      const at = { x: (g.clientX ?? r.left) - r.left, y: (g.clientY ?? r.top) - r.top };
      apply(kept(zoomAt(view.current, gestureFrom * (g.scale ?? 1), at)));
    };
    // The browser scrolled the window itself (Tab, find in page, a test's click): that is a pan.
    const onScroll = () => {
      if (!root.current?.hasAttribute('data-enhanced')) return;
      const m = Math.max(el.clientWidth, el.clientHeight);
      const v = view.current;
      const x = m - el.scrollLeft;
      const y = m - el.scrollTop;
      if (Math.abs(x - v.x) < 1 && Math.abs(y - v.y) < 1) return;
      if (frame.current !== null || pointers.current.size > 0) return;
      apply(kept({ x, y, scale: v.scale }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart);
    el.addEventListener('gesturechange', onGestureChange);
    el.addEventListener('scroll', onScroll);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
      el.removeEventListener('scroll', onScroll);
    };
  }, []);

  // Measures the map for the mini-map and the paths behind it, again whenever it changes size
  // (a part opened, a step added), keeping the view on the map.
  // biome-ignore lint/correctness/useExhaustiveDependencies: measured from the DOM on each change.
  useEffect(() => {
    const w = world.current;
    if (!w) return;
    const measure = () => {
      const size = { width: w.offsetWidth, height: w.offsetHeight };
      const cards = [...w.querySelectorAll<HTMLElement>('.uf-map-branches > li > .uf-map-card')];
      const centre = w.querySelector<HTMLElement>('.uf-map-centre');
      const parts = [
        ...(centre ? [{ ...boxOf(centre), status: '', centre: true }] : []),
        ...cards.map((c) => ({
          ...boxOf(c),
          status: c.parentElement?.dataset['status'] ?? '',
          centre: false,
        })),
      ];
      const steps = parts.filter((p) => !p.centre);
      let path = '';
      if (layout === 'stairs') {
        const lift = 16;
        const goal = parts.find((p) => p.centre);
        const climb = stairPath(steps.map((s) => ({ ...s, y: s.y - lift })));
        // From the last step, up to the goal's level and along to it.
        path =
          climb && goal
            ? `${climb} V${Math.round(goal.y + goal.height + lift)} H${Math.round(goal.x + goal.width / 2)}`
            : climb;
      }
      if (layout === 'road') {
        const list = w.querySelector('.uf-map-branches');
        const lane = list ? boxOf(list) : null;
        if (lane && steps.length > 0) {
          const mid = lane.x + lane.width / 2;
          const swing = Math.min(lane.width / 10, 56);
          const marks = steps.map((s) => ({ x: mid, y: s.y + 24 }));
          const points: Point[] = [{ x: mid, y: lane.y }];
          marks.forEach((m, i) => {
            const prev = points.at(-1) as Point;
            points.push({ x: mid + (i % 2 === 0 ? -swing : swing), y: (prev.y + m.y) / 2 }, m);
          });
          points.push({ x: mid, y: lane.y + lane.height });
          path = roadPath(points);
        }
      }
      setMeasured({ world: size, parts, path });
      apply(kept(view.current));
    };
    measure();
    if (typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(w);
    if (port.current) ro.observe(port.current);
    return () => ro.disconnect();
  }, [layout]);

  const local = (e: { clientX: number; clientY: number }): Point => {
    const r = port.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };

  function onPointerDown(e: PointerEvent<HTMLElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target instanceof Element && e.target.closest(FIELD)) return;
    stop();
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 1) {
      drag.current = {
        start: p,
        from: view.current,
        moved: false,
        samples: [{ t: e.timeStamp, ...p }],
      };
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [Point, Point];
      pinch.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        centre: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        from: view.current,
      };
      if (drag.current) drag.current.moved = true;
      for (const id of pointers.current.keys()) {
        try {
          port.current?.setPointerCapture(id);
        } catch {
          // A pointer already gone: nothing to hold.
        }
      }
    }
  }

  function onPointerMove(e: PointerEvent<HTMLElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const s = sizes();
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()] as [Point, Point];
      const centre = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const { from, distance, centre: c0 } = pinch.current;
      const moved = { x: from.x + centre.x - c0.x, y: from.y + centre.y - c0.y, scale: from.scale };
      const ratio = Math.hypot(a.x - b.x, a.y - b.y) / distance;
      apply(rubber(zoomAt(moved, from.scale * ratio, centre), s.world, s.port, EDGE));
      return;
    }
    const d = drag.current;
    if (!d) return;
    const dx = p.x - d.start.x;
    const dy = p.y - d.start.y;
    if (!d.moved) {
      if (!isDrag(dx, dy)) return;
      d.moved = true;
      root.current?.setAttribute('data-panning', '');
      try {
        port.current?.setPointerCapture(e.pointerId);
      } catch {
        // Not every browser can hold a pointer: the pan still follows it.
      }
    }
    apply(
      rubber({ x: d.from.x + dx, y: d.from.y + dy, scale: d.from.scale }, s.world, s.port, EDGE),
    );
    d.samples.push({ t: e.timeStamp, ...p });
    if (d.samples.length > 8) d.samples.shift();
  }

  function onPointerEnd(e: PointerEvent<HTMLElement>) {
    if (!pointers.current.delete(e.pointerId)) return;
    if (pinch.current) {
      if (pointers.current.size >= 2) return;
      pinch.current = null;
      const rest = [...pointers.current.values()][0];
      // One finger left: it carries on panning from here.
      drag.current = rest ? { start: rest, from: view.current, moved: true, samples: [] } : null;
      if (!rest) {
        swallow();
        release(0, 0);
      }
      return;
    }
    const d = drag.current;
    drag.current = null;
    root.current?.removeAttribute('data-panning');
    if (!d?.moved) return;
    swallow();
    const { vx, vy } = releaseVelocity(d.samples, reducedMotion());
    release(vx, vy);
  }

  /** The click that ends a pan is not a press on what it started over. */
  function swallow() {
    swallowClick.current = true;
    setTimeout(() => {
      swallowClick.current = false;
    }, 0);
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    // Only the window's own keys: a part's buttons and fields keep theirs.
    if (e.target !== e.currentTarget) return;
    const v = view.current;
    const by = e.shiftKey ? PAN_STEP_BIG : PAN_STEP;
    const pans: Record<string, Point> = {
      ArrowLeft: { x: by, y: 0 },
      ArrowRight: { x: -by, y: 0 },
      ArrowUp: { x: 0, y: by },
      ArrowDown: { x: 0, y: -by },
    };
    const pan = pans[e.key];
    if (pan) {
      e.preventDefault();
      goTo({ x: v.x + pan.x, y: v.y + pan.y, scale: v.scale });
      return;
    }
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoomBy(ZOOM.step);
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      zoomBy(1 / ZOOM.step);
    } else if (e.key === '0') {
      e.preventDefault();
      goTo(wholeView());
    }
  }

  // Tab to a part out of view: the map glides it in (Tab order is the list's, so it reads in order).
  function onFocus(e: { target: EventTarget }) {
    const el = e.target;
    if (!(el instanceof Element) || el === port.current || !world.current?.contains(el)) return;
    const s = sizes();
    const card = el.closest('.uf-map-card, .uf-map-centre');
    let box = boxOf(card ?? el);
    if (box.height * view.current.scale > s.port.height - 2 * EDGE) box = boxOf(el);
    const next = revealView(view.current, box, s.port, EDGE);
    if (next.x !== view.current.x || next.y !== view.current.y) goTo(next);
  }

  function onMini(e: PointerEvent<SVGSVGElement>, jump: boolean) {
    if (!measured || (e.type === 'pointermove' && e.buttons === 0)) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width === 0) return;
    const point = {
      x: ((e.clientX - r.left) / r.width) * measured.world.width,
      y: ((e.clientY - r.top) / r.height) * measured.world.height,
    };
    const to = centreOn(view.current, point, sizes().port);
    if (jump) apply(kept(to));
    else goTo(to);
  }

  return (
    <div
      ref={root}
      className="uf-canvas"
      data-layout={layout}
      data-expanded={expanded ? '' : undefined}
      data-enhanced={enhanced ? '' : undefined}
      data-seen={seen ? '' : undefined}
    >
      <fieldset className="uf-canvas-tools">
        <legend className="sr-only">{copy.tools}</legend>
        <div className="uf-canvas-zooms">
          <button
            type="button"
            className="uf-canvas-btn"
            aria-label={copy.zoomOut}
            title={copy.zoomOutKey}
            aria-keyshortcuts="-"
            onClick={() => zoomBy(1 / ZOOM.step)}
          >
            <Icon d="M5 12h14" />
          </button>
          <span className="uf-canvas-zoom">
            <span className="sr-only">{`${copy.zoom} `}</span>
            <span>{PERCENT.format(scale)}</span>
          </span>
          <button
            type="button"
            className="uf-canvas-btn"
            aria-label={copy.zoomIn}
            title={copy.zoomInKey}
            aria-keyshortcuts="+"
            onClick={() => zoomBy(ZOOM.step)}
          >
            <Icon d="M5 12h14M12 5v14" />
          </button>
        </div>
        <div className="uf-canvas-zooms">
          <button
            type="button"
            className="uf-canvas-btn"
            aria-label={copy.fit}
            title={copy.fitKey}
            aria-keyshortcuts="0"
            onClick={() => goTo(wholeView())}
          >
            <Icon d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
          </button>
          <button
            type="button"
            className="uf-canvas-btn"
            aria-label={copy.reset}
            title={copy.reset}
            onClick={() => goTo(home())}
          >
            <Icon d="M12 3v4M12 17v4M3 12h4M17 12h4M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6" />
          </button>
          {expanded ? null : (
            <button
              type="button"
              ref={openButton}
              id="canvas-open"
              className="uf-canvas-btn"
              aria-label={copy.open}
              title={copy.open}
              onClick={onOpen}
            >
              <Icon d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" />
            </button>
          )}
        </div>
      </fieldset>

      {/* A labelled region the keyboard can reach: the arrows, + and − and 0 work from here. */}
      <section
        ref={port}
        aria-label={copy.label}
        aria-describedby={hintId}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the canvas is operated by keys (WCAG 2.1.1).
        tabIndex={0}
        className="uf-canvas-viewport"
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={(e) => {
          if (!swallowClick.current) return;
          swallowClick.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div ref={stage} className="uf-canvas-stage">
          <div ref={world} className={`uf-canvas-world ${WORLD_CLASS[layout]}`}>
            {measured?.path ? (
              <svg
                aria-hidden="true"
                className="uf-canvas-paths"
                width={measured.world.width}
                height={measured.world.height}
                viewBox={`0 0 ${measured.world.width} ${measured.world.height}`}
              >
                {layout === 'road' ? (
                  <>
                    <path
                      className="uf-canvas-road uf-canvas-draw"
                      pathLength={1}
                      d={measured.path}
                    />
                    <path className="uf-canvas-road-line" d={measured.path} />
                  </>
                ) : (
                  <path
                    className="uf-canvas-climb uf-canvas-draw"
                    pathLength={1}
                    d={measured.path}
                  />
                )}
              </svg>
            ) : null}
            {children}
          </div>
        </div>
      </section>
      <p id={hintId} className="sr-only">
        {copy.keys}
      </p>

      {measured && measured.world.width > 0 ? (
        // A pointer's shortcut only (the buttons and keys do the same), so hidden from readers.
        <svg
          aria-hidden="true"
          className="uf-minimap"
          viewBox={`0 0 ${measured.world.width} ${measured.world.height}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture?.(e.pointerId);
            onMini(e, false);
          }}
          onPointerMove={(e) => onMini(e, true)}
        >
          {measured.parts.map((p) => (
            <rect
              key={`${p.x}-${p.y}`}
              className="uf-minimap-part"
              data-status={p.status || undefined}
              data-centre={p.centre ? '' : undefined}
              x={p.x}
              y={p.y}
              width={p.width}
              height={p.height}
              rx={12}
            />
          ))}
          <rect ref={miniView} className="uf-minimap-view" x={0} y={0} width={0} height={0} />
        </svg>
      ) : null}
    </div>
  );
}

/** A control's icon: decoration, its name is the button's. */
function Icon({ d }: { d: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" className="uf-canvas-icon">
      <path d={d} />
    </svg>
  );
}

/**
 * The canvas full screen: a modal `<dialog>` (focus held inside, the page behind inert and, by
 * the CSS, not scrolling). Esc and Close both close it; the page then puts focus back on Open.
 * jsdom has no `showModal`, so the attribute stands in there.
 */
export function CanvasDialog({
  open,
  title,
  closeLabel,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useLayoutEffect(() => {
    const d = ref.current;
    if (!d) return;
    const shown = d.hasAttribute('open');
    if (open && !shown) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    } else if (!open && shown) {
      if (typeof d.close === 'function') d.close();
      else d.removeAttribute('open');
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="uf-canvas-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      {open ? (
        <div className="uf-canvas-dialog-body">
          <div className="uf-canvas-dialog-bar">
            <h2 id={titleId} className="text-lg">
              {title}
            </h2>
            <button type="button" className="uf-canvas-close" onClick={onClose}>
              <Icon d="M6 6l12 12M18 6L6 18" />
              <span>{closeLabel}</span>
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
