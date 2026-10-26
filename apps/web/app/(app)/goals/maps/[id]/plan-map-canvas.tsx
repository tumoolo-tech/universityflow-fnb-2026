'use client';

import type { PlanLayout } from '@universityflow/ui';
import {
  type CSSProperties,
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
  placeScript,
  releaseVelocity,
  revealView,
  rubber,
  type Size,
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
 * **Cards move (RT-08, 2026-10-25).** A press on a card (not on its buttons) and a pull lifts it
 * and carries it; a finger held still on it for `LIFT_HOLD_MS` lifts it, a finger that moves at
 * once pans the map as before. While lifted the card follows the pointer in one CSS transform and
 * the page redraws only that card's branches (`CardDrag.frame`), once a frame, never through
 * React; letting go puts it down (`drop`), Escape puts it back (`cancel`). The keyboard's way is
 * the card's own Move button (plan-map-view.tsx), which asks this canvas to bring the card into
 * view (`uf-canvas-reveal`).
 *
 * **Progressive:** the server draws the whole picture at its final places (map-layout.ts) and
 * sends a small script that puts the map on its first view before the page is live
 * (`placeScript`, A4-21: nothing shifts when it hydrates); this component then takes the window
 * over (`data-enhanced`) and moves the map with one CSS transform, written to custom properties
 * once a frame. The maths is `canvas-math.ts`, every rule tested there. No library.
 *
 * **Never by accident:** a press becomes a pan or a lift only past a few pixels, and the click
 * that ends either is swallowed, so a drag that starts on a part's button never opens it; a tap
 * still does. **Reduced motion:** no coast, no glide, no draw-in: every move is a jump.
 */

type CanvasCopy = PlanCopy['canvas'];
type ArrangeCopy = PlanCopy['arrange'];

/** How long a finger rests on a card before it lifts (not a duration token: it must never be 0). */
export const LIFT_HOLD_MS = 300;

/** Below this zoom the dotted ground is drawn quieter (`data-far`). */
const FAR_ZOOM = 0.5;

/** How the page moves a card: where it is now, each frame while lifted, put down, put back. */
export interface CardDrag {
  /** The card's top-left in map coordinates, or null when it can't move. */
  start(id: string): Point | null;
  /** Once a frame while lifted: redraw what follows the card (its branches), DOM only. */
  frame(id: string, at: Point): void;
  /** Puts it down, its new place in the DOM before this returns (the lift's transform then goes). */
  drop(id: string, at: Point): void;
  /** Puts it back where it was picked up, its branches redrawn there. */
  cancel(id: string): void;
}

/** A part of the map for the mini-map: from the layout, never measured. */
export interface MapPart {
  readonly id: string;
  readonly box: Box;
  readonly status: string;
  readonly centre: boolean;
}

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
/** What a press on a card must not start a lift from: its own controls. */
const CONTROL = `button, a, label, ${FIELD}`;

/** The event a card's Move button sends up to bring the card into view (MAPS-03). */
export const REVEAL_EVENT = 'uf-canvas-reveal';

const rem = (px: number) => `${px / 16}rem`;

interface Lift {
  readonly id: string;
  readonly el: HTMLElement;
  readonly origin: Point;
  readonly start: Point;
  readonly pointerId: number;
  readonly touch: boolean;
  lifted: boolean;
  /** It has been carried somewhere: a lift let go without moving is put back, not down (MAPS-16). */
  moved: boolean;
  timer: number | null;
  last: Point;
  frame: number | null;
  /** The Escape listener while lifted: the same function is removed on settling. */
  esc: ((e: globalThis.KeyboardEvent) => void) | null;
  /** The browser's long-press menu, kept off while lifted (MAPS-23). */
  menu: ((e: Event) => void) | null;
}

export function MapCanvas({
  copy,
  arrange,
  layout,
  size,
  hub,
  parts,
  drag,
  canReset,
  onResetLayout,
  nonce,
  expanded = false,
  returnFocus = false,
  onOpen,
  movePad,
  children,
}: {
  copy: CanvasCopy;
  arrange: ArrangeCopy;
  layout: PlanLayout;
  /** The map's size, from its layout. */
  size: Size;
  /** The middle's box, for the first view and the mini-map. */
  hub: Box;
  parts: ReadonlyArray<MapPart>;
  drag: CardDrag;
  /** Something has been moved: Reset layout does something. */
  canReset: boolean;
  onResetLayout: () => void;
  /** This request's CSP nonce, for the first-view script the server sends (A4-21). */
  nonce?: string | undefined;
  /** In the full-screen dialog: focus starts in the map, and Open is the dialog's Close. */
  expanded?: boolean;
  /** Back on the page after the dialog closed: focus returns to Open (WCAG 2.4.3). */
  returnFocus?: boolean;
  onOpen?: () => void;
  /**
   * While a card is in Move mode: its on-screen pad (MAPS-11, WCAG 2.5.7), shown under the
   * window at full size, never zoomed with the map and never over a card.
   */
  movePad?: ReactNode;
  children: ReactNode;
}) {
  const openButton = useRef<HTMLButtonElement>(null);
  const ids = useId();
  const hintId = `${ids}-hint`;
  const portId = `${ids}-port`;
  const root = useRef<HTMLDivElement>(null);
  const port = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const miniView = useRef<SVGRectElement>(null);
  const view = useRef<View>({ x: 0, y: 0, scale: 1 });
  const frame = useRef<number | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const pan = useRef<{
    start: Point;
    from: View;
    moved: boolean;
    samples: Array<{ t: number; x: number; y: number }>;
  } | null>(null);
  const pinch = useRef<{ distance: number; centre: Point; from: View } | null>(null);
  const lift = useRef<Lift | null>(null);
  const swallowClick = useRef(false);
  const [enhanced, setEnhanced] = useState(false);
  const [seen, setSeen] = useState(false);
  const [scale, setScale] = useState(1);
  const [showMini, setShowMini] = useState(true);

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
      // Far out, the dotted ground goes quiet (it would turn to noise behind the cards).
      root.current?.toggleAttribute('data-far', v.scale < FAR_ZOOM);
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

  /**
   * A part of the map, in map coordinates: measured at the map's drawn zoom (the server's script
   * may have scaled the world before the live view knows it, A4-21), the view's zoom with no size.
   */
  function boxOf(el: Element): Box {
    const r = el.getBoundingClientRect();
    const w = world.current?.getBoundingClientRect();
    const drawn = (w?.width ?? 0) / (world.current?.offsetWidth || 1);
    const s = drawn > 0 ? drawn : view.current.scale;
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

  /** The middle's box as drawn (the layout's, scaled to the page's root font size). */
  const hubBox = (): Box => {
    const centre = world.current?.querySelector('.uf-map-centre');
    return centre ? boxOf(centre) : hub;
  };

  const home = (): View => homeView(hubBox(), sizes().port);

  const wholeView = (): View => {
    const s = sizes();
    return fitView(s.world, s.port, EDGE);
  };

  const zoomBy = (factor: number) =>
    goTo(zoomAt(view.current, view.current.scale * factor, middle()));

  /** The view a card opens on: the whole map when it reads, else the middle and its nearest cards. */
  function start() {
    const s = sizes();
    const cards = [...(world.current?.querySelectorAll('.uf-map-branches > li') ?? [])].map(boxOf);
    const hubNow = hubBox();
    const body = world.current?.querySelector('.uf-map-centre-body');
    apply(kept(firstView(s.world, s.port, hubNow, cards, EDGE, body ? boxOf(body) : hubNow)));
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

  // The branches and the road draw themselves in once, when the card first comes into view.
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

  /** The least pan that shows `el`'s card (or `el` itself, when the card is taller than the window). */
  function reveal(el: Element) {
    const s = sizes();
    const card = el.closest('.uf-map-card, .uf-map-centre');
    let box = boxOf(card ?? el);
    if (box.height * view.current.scale > s.port.height - 2 * EDGE) box = boxOf(el);
    const next = revealView(view.current, box, s.port, EDGE);
    if (next.x !== view.current.x || next.y !== view.current.y) goTo(next);
  }

  // Wheel and trackpad: their own listener, not passive, so the page never scrolls under the map.
  // Safari's trackpad pinch arrives as gesture events. A card moved by the keys asks to be seen.
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
    const onReveal = (e: Event) => {
      if (e.target instanceof Element) reveal(e.target);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart);
    el.addEventListener('gesturechange', onGestureChange);
    el.addEventListener('scroll', onScroll);
    el.addEventListener(REVEAL_EVENT, onReveal);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener(REVEAL_EVENT, onReveal);
    };
  }, []);

  const local = (e: { clientX: number; clientY: number }): Point => {
    const r = port.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };

  // ── Lifting a card (RT-08) ──────────────────────────────────────────────────────────────────

  /**
   * Ends a lift: the card's own transform goes (or, for a drop, stays until the page has put the
   * card at its new place: MAPS-12, it never shows at its start in between).
   */
  function settle(l: Lift, keepTransform = false) {
    if (l.timer !== null) clearTimeout(l.timer);
    if (l.frame !== null) cancelAnimationFrame(l.frame);
    if (l.esc) document.removeEventListener('keydown', l.esc);
    if (l.menu) document.removeEventListener('contextmenu', l.menu);
    if (!keepTransform) l.el.style.transform = '';
    l.el.removeAttribute('data-lifted');
    root.current?.removeAttribute('data-lifting');
    lift.current = null;
  }

  function putBack() {
    const l = lift.current;
    if (!l) return;
    const lifted = l.lifted;
    settle(l);
    if (lifted) drag.cancel(l.id);
  }

  /** The card leaves the board: it follows the pointer from here; the map stops panning. */
  function liftCard(l: Lift) {
    stop();
    l.lifted = true;
    if (l.timer !== null) clearTimeout(l.timer);
    l.timer = null;
    pan.current = null;
    root.current?.removeAttribute('data-panning');
    root.current?.setAttribute('data-lifting', '');
    l.el.setAttribute('data-lifted', '');
    try {
      port.current?.setPointerCapture(l.pointerId);
    } catch {
      // Not every browser can hold a pointer: the card still follows it.
    }
    if (l.touch) navigator.vibrate?.(8);
    l.esc = (e) => {
      if (e.key === 'Escape') putBack();
    };
    document.addEventListener('keydown', l.esc);
    // Android's long-press menu would end the drag (and iOS would start selecting): not while lifted.
    l.menu = (e) => e.preventDefault();
    document.addEventListener('contextmenu', l.menu);
    drag.frame(l.id, l.origin);
  }

  /** Where the card is now, in map coordinates: the pointer's travel at the map's zoom. */
  const carried = (l: Lift, p: Point): Point => {
    const s = view.current.scale || 1;
    return {
      x: Math.max(0, l.origin.x + (p.x - l.start.x) / s),
      y: Math.max(0, l.origin.y + (p.y - l.start.y) / s),
    };
  };

  function onPointerDown(e: PointerEvent<HTMLElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest(FIELD)) return;
    stop();
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 1) {
      pan.current = {
        start: p,
        from: view.current,
        moved: false,
        samples: [{ t: e.timeStamp, ...p }],
      };
      // A press on a card (not on one of its controls) may become a lift.
      const card = target?.closest<HTMLElement>('[data-drag-id]');
      const id = card?.dataset['dragId'];
      if (card && id && !target?.closest(CONTROL)) {
        const origin = drag.start(id);
        if (origin) {
          const touch = e.pointerType === 'touch';
          const l: Lift = {
            id,
            el: card,
            origin,
            start: p,
            pointerId: e.pointerId,
            touch,
            lifted: false,
            moved: false,
            timer: null,
            last: origin,
            frame: null,
            esc: null,
            menu: null,
          };
          if (touch) {
            l.timer = window.setTimeout(() => {
              if (lift.current === l && !l.lifted) liftCard(l);
            }, LIFT_HOLD_MS);
          }
          lift.current = l;
        }
      }
    } else if (pointers.current.size === 2) {
      // Two fingers always pinch: a lifted card goes back where it was picked up.
      putBack();
      const [a, b] = [...pointers.current.values()] as [Point, Point];
      pinch.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        centre: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        from: view.current,
      };
      if (pan.current) pan.current.moved = true;
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
    const l = lift.current;
    if (l && l.pointerId === e.pointerId) {
      const travelled = isDrag(p.x - l.start.x, p.y - l.start.y);
      if (!l.lifted) {
        if (travelled) {
          // A finger that moves before the hold is up pans; a mouse or a pen lifts at once.
          if (l.touch) settle(l);
          else liftCard(l);
        }
      }
      if (l.lifted) {
        l.last = carried(l, p);
        if (travelled) l.moved = true;
        l.frame ??= requestAnimationFrame(() => {
          l.frame = null;
          const at = l.last;
          l.el.style.transform = `translate(${at.x - l.origin.x}px, ${at.y - l.origin.y}px)`;
          drag.frame(l.id, at);
        });
        return;
      }
    }
    const d = pan.current;
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
    const l = lift.current;
    if (l && l.pointerId === e.pointerId) {
      const lifted = l.lifted;
      const at = l.last;
      // The browser took the pointer away (a menu, a gesture: MAPS-23), or the card was never
      // carried anywhere (a long press let go, MAPS-16): it goes back, nothing is saved.
      const back = e.type === 'pointercancel' || !l.moved;
      settle(l, lifted && !back);
      if (lifted) {
        pan.current = null;
        swallow();
        if (back) drag.cancel(l.id);
        else {
          // The page commits the new place synchronously (CardDrag.drop); only then does the
          // card's lift go, with no easing, so it never jumps back to its start first.
          drag.drop(l.id, at);
          l.el.style.transform = '';
        }
        return;
      }
    }
    if (pinch.current) {
      if (pointers.current.size >= 2) return;
      pinch.current = null;
      const rest = [...pointers.current.values()][0];
      // One finger left: it carries on panning from here.
      pan.current = rest ? { start: rest, from: view.current, moved: true, samples: [] } : null;
      if (!rest) {
        swallow();
        release(0, 0);
      }
      return;
    }
    const d = pan.current;
    pan.current = null;
    root.current?.removeAttribute('data-panning');
    if (!d?.moved) return;
    swallow();
    const { vx, vy } = releaseVelocity(d.samples, reducedMotion());
    release(vx, vy);
  }

  /** The click that ends a pan or a lift is not a press on what it started over. */
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
    const move = pans[e.key];
    if (move) {
      e.preventDefault();
      goTo({ x: v.x + move.x, y: v.y + move.y, scale: v.scale });
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
    reveal(el);
  }

  function onMini(e: PointerEvent<SVGSVGElement>, jump: boolean) {
    if (e.type === 'pointermove' && e.buttons === 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width === 0) return;
    const s = sizes();
    const point = {
      x: ((e.clientX - r.left) / r.width) * s.world.width,
      y: ((e.clientY - r.top) / r.height) * s.world.height,
    };
    const to = centreOn(view.current, point, s.port);
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
      suppressHydrationWarning
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
          <button
            type="button"
            className="uf-canvas-btn"
            aria-label={arrange.resetLayout}
            title={arrange.resetLayout}
            aria-disabled={!canReset}
            onClick={() => {
              if (canReset) onResetLayout();
            }}
          >
            <Icon d="M4 4h6v6H4ZM14 4h6v6h-6ZM4 14h6v6H4ZM14 14h6v6h-6Z" />
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
        id={portId}
        aria-label={copy.label}
        aria-describedby={hintId}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the canvas is operated by keys (WCAG 2.1.1).
        tabIndex={0}
        className="uf-canvas-viewport"
        suppressHydrationWarning
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
        <div ref={stage} className="uf-canvas-stage" suppressHydrationWarning>
          <div
            ref={world}
            className="uf-canvas-world"
            style={{ width: rem(size.width), height: rem(size.height) }}
          >
            {children}
          </div>
        </div>
      </section>
      <p id={hintId} className="sr-only">
        {`${copy.keys} ${arrange.keys}`}
      </p>

      {/* The mini-map, docked under the window so it never covers a card (RT-07): a pointer's
          shortcut only (the buttons and keys do the same), so hidden from readers. */}
      <div className="uf-canvas-foot">
        {movePad}
        <button
          type="button"
          className="uf-canvas-foot-btn"
          aria-pressed={showMini}
          onClick={() => setShowMini((v) => !v)}
        >
          {showMini ? arrange.hideMiniMap : arrange.showMiniMap}
        </button>
        {showMini && size.width > 0 ? (
          <svg
            aria-hidden="true"
            className="uf-minimap"
            viewBox={`0 0 ${size.width} ${size.height}`}
            preserveAspectRatio="xMidYMid meet"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture?.(e.pointerId);
              onMini(e, false);
            }}
            onPointerMove={(e) => onMini(e, true)}
          >
            {parts.map((p, k) => (
              <rect
                key={p.id}
                className="uf-minimap-part"
                data-status={p.status || undefined}
                data-centre={p.centre ? '' : undefined}
                style={
                  p.centre
                    ? undefined
                    : ({
                        '--uf-map-tone': `var(--uf-color-map-tone${((k - 1) % 6) + 1})`,
                      } as CSSProperties)
                }
                x={p.box.x}
                y={p.box.y}
                width={p.box.width}
                height={p.box.height}
                rx={12}
              />
            ))}
            <rect ref={miniView} className="uf-minimap-view" x={0} y={0} width={0} height={0} />
          </svg>
        ) : null}
      </div>

      {expanded ? null : (
        // The first view before the page is live (A4-21). jsdom never runs it; the test does.
        <script
          nonce={nonce}
          data-canvas-place=""
          // The server's and the browser's builds print the same rule in different words.
          suppressHydrationWarning
          // biome-ignore lint/security/noDangerouslySetInnerHtml: our own script, from numbers only.
          dangerouslySetInnerHTML={{ __html: placeScript(portId) }}
        />
      )}
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
