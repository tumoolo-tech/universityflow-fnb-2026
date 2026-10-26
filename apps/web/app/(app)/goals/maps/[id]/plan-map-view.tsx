'use client';

import {
  missingSlots,
  type OutlineNode,
  outlineOf,
  PLAN_LIMITS,
  type PlanMapView,
  type PlanMoveKind,
  type PlanNode,
  type PlanStatus,
  planCounts,
  planMove,
  planTemplate,
  slotIcon,
  subtreeIds,
} from '@universityflow/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import { Icon } from '@/components/icons';
import {
  Button,
  ButtonLink,
  Field,
  Input,
  Notice,
  Page,
  panelLook,
  Select,
  StatusLine,
  TextArea,
} from '@/components/ui';
import { type WrittenCare, WrittenCarePanel } from '@/components/written-care';
import { ApiError, api, errorMessage } from '@/lib/client/api';
import { fill } from '@/lib/client/fill';
import { useStatus } from '@/lib/client/status';
import type { PlanCopy, SlotCopy, TemplateCopy } from '@/lib/server/plan-maps-copy';
import type { Box, Point } from './canvas-math';
import { HubArt, MapLinks, markerPath } from './map-art';
import {
  CARD_STEPS,
  CARD_WIDTH,
  type CardShape,
  cardHeight,
  connectors,
  defaultLayout,
  freePlace,
  HUB_WIDTH,
  hubBodyHeight,
  hubOuter,
  type MapLayout,
  nudge,
  placeCards,
  roadOf,
  toPlace,
  whereIs,
} from './map-layout';
import {
  CanvasDialog,
  type CardDrag,
  MapCanvas,
  type MapPart,
  REVEAL_EVENT,
} from './plan-map-canvas';

/**
 * One plan map (docs/design/plan-maps-proposal.md §7, §8). **One DOM, two layouts:** the map is
 * always one nested list in reading order (the centre as the `h2`, each stop an `li` with an
 * `h3`, its steps nested inside its card). As the Picture, on its canvas card, each stop is placed
 * where its template puts it (map-layout.ts: every card a fixed footprint from what it holds, so
 * nothing overlaps and nothing is measured, RT-07, A4-21) or where the learner moved it (RT-08:
 * drag it, or its Move button and the arrow keys), with the branches drawn between the actual
 * edges of what they join (map-art.tsx) and redrawn as a card moves. The middle stays where the
 * template puts it: it is the map's anchor (MAPS-09). There is no second copy of the words, so
 * what a screen reader hears can't drift from what is drawn. Editing is buttons: Edit opens the
 * part in place; More moves it in the list or deletes it; a step inside a card is edited from
 * the List, where the picture shows its first few.
 *
 * Every save is read by the chat's crisis check on the server (D3): when the words need care the
 * crisis card appears at once, outside the zoomable canvas (A10-65), and focus moves to it.
 */

type Care = { readonly at: string; readonly care: WrittenCare };

const VIEW_KEY = 'uf-plan-map-view';

const STATUS_ORDER: ReadonlyArray<PlanStatus> = ['planned', 'achieved', 'not-achieved'];

/** Layout pixels as rem, so the picture scales with the learner's font size, never overlapping. */
const rem = (px: number) => `${Math.round((px / 16) * 1000) / 1000}rem`;

/** How long a re-flow takes: the token, 0ms under reduced motion (tokens.css). */
function flipDuration(): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--uf-duration-normal');
  const ms = Number.parseFloat(value);
  return Number.isFinite(ms) ? ms : 0;
}

function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** How long after the last arrow press a card's place is said (MAPS-06). */
const SAY_AFTER_MS = 600;

/** How long Reset layout can be undone (MAPS-22). */
const UNDO_MS = 10_000;

export function PlanMapPage({
  map: initial,
  copy,
  template,
  justCreated,
  nonce,
}: {
  map: PlanMapView;
  copy: PlanCopy;
  template: TemplateCopy;
  /** Just started from My goal: focus goes to the title. */
  justCreated: boolean;
  /** This request's CSP nonce, for the canvas's first-view script (A4-21). */
  nonce?: string | undefined;
}) {
  const router = useRouter();
  const [map, setMap] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [care, setCare] = useState<Care | null>(null);
  const [status, setStatus] = useStatus();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'picture' | 'list'>('picture');
  const [focusId, setFocusId] = useState<{ id: string; n: number } | null>(null);
  const [justAchieved, setJustAchieved] = useState<string | null>(null);
  const [adding, setAdding] = useState('');
  /** The picture's canvas is open full screen (plan-map-canvas.tsx). */
  const [canvasOpen, setCanvasOpen] = useState(false);
  /** The canvas was opened and closed: the card's Open takes focus back when it returns. */
  const [canvasClosed, setCanvasClosed] = useState(false);
  /** A card in Move mode (the keyboard's way to move it, RT-08), and where it is now. */
  const [moving, setMoving] = useState<{ id: string; from: Point; at: Point } | null>(null);
  const inFlight = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);
  const section = useRef<HTMLElement>(null);
  const flip = useRef<Map<string, DOMRect> | null>(null);
  /** Places waiting to be saved, the latest per card, and whether a save is on its way (MAPS-08). */
  const pending = useRef(new Map<string, { to: Point; was: Point | null }>());
  const saving = useRef(false);
  const sayTimer = useRef<number | null>(null);
  /** For a while after Reset layout: where the learner had put each card (MAPS-22). */
  const [undo, setUndo] = useState<Array<{ nodeId: string; x: number; y: number }> | null>(null);
  const undoTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (undoTimer.current !== null) clearTimeout(undoTimer.current);
    },
    [],
  );
  const tpl = planTemplate(map.templateId);
  const outline = outlineOf(map.nodes);

  useEffect(() => {
    if (justCreated) title.current?.focus();
  }, [justCreated]);

  // The learner's choice of Picture or List, in this browser only.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_KEY);
      if (saved === 'list' || saved === 'picture') setView(saved);
    } catch {
      // Storage can be off: the picture is the default.
    }
  }, []);

  // Focus never drops to <body> (WCAG 2.4.3): after a change, it goes where the change is.
  useEffect(() => {
    if (focusId) document.getElementById(focusId.id)?.focus();
  }, [focusId]);
  const focusOn = (id: string) => setFocusId((f) => ({ id, n: (f?.n ?? 0) + 1 }));

  // M5: a move or a delete re-flows the list over the normal duration (FLIP by hand), at once
  // under reduced motion (the token is 0ms there).
  useLayoutEffect(() => {
    const before = flip.current;
    flip.current = null;
    if (!before) return;
    const duration = flipDuration();
    if (duration <= 0) return;
    for (const el of document.querySelectorAll<HTMLElement>('[data-node-id]')) {
      const was = before.get(el.dataset['nodeId'] ?? '');
      if (!was || typeof el.animate !== 'function') continue;
      const now = el.getBoundingClientRect();
      const dx = was.left - now.left;
      const dy = was.top - now.top;
      if (dx === 0 && dy === 0) continue;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
        duration,
        easing: 'ease-out',
      });
    }
  });
  function measure() {
    const rects = new Map<string, DOMRect>();
    for (const el of document.querySelectorAll<HTMLElement>('[data-node-id]')) {
      rects.set(el.dataset['nodeId'] ?? '', el.getBoundingClientRect());
    }
    flip.current = rects;
  }

  function planError(e: unknown): string {
    if (e instanceof ApiError && e.code === 'state' && e.detail) {
      if (e.detail in copy.limits) return copy.limits[e.detail as keyof PlanCopy['limits']];
      if (e.detail === 'plan-words') return copy.errors.words;
      if (e.detail === 'personal-number') return copy.errors['personal-number'];
    }
    return errorMessage(e);
  }

  /** One request at a time: a press while one runs does nothing (A3-01). */
  async function run<T>(call: () => Promise<T>): Promise<T | null> {
    if (inFlight.current) return null;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setStatus('');
    try {
      return await call();
    } catch (e) {
      setError(planError(e));
      return null;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const slot = (n: PlanNode): SlotCopy | null =>
    n.slotId ? (template.slots[n.slotId] ?? null) : null;
  const nameOf = (n: PlanNode) => slot(n)?.heading || n.text || copy.newStep;
  const statusWord = (s: PlanStatus) => copy.status[s];

  async function save(node: PlanNode, patch: Record<string, unknown>) {
    const result = await run(() =>
      api<{ node: PlanNode; care: WrittenCare | null }>(
        `/api/me/plan-maps/${map.id}/nodes/${node.id}`,
        { method: 'PUT', json: patch },
      ),
    );
    if (!result) return;
    setMap((m) => ({ ...m, nodes: m.nodes.map((n) => (n.id === node.id ? result.node : n)) }));
    setEditing(null);
    // The sparks (M3+) only on a new Achieved whose words needed no care: never beside a crisis
    // card (M7), never on Not achieved.
    const achievedNow = result.node.status === 'achieved' && node.status !== 'achieved';
    setJustAchieved(achievedNow && !result.care ? node.id : null);
    setStatus(fill(copy.savedStatus, nameOf(result.node), statusWord(result.node.status)));
    if (result.care) {
      setCare({ at: node.id, care: result.care });
      // The crisis card moves focus to itself (WrittenCarePanel); a setback line doesn't.
      if (result.care.level === 'setback') focusOn(`edit-${node.id}`);
    } else {
      setCare((c) => (c?.at === node.id ? null : c));
      focusOn(`edit-${node.id}`);
    }
  }

  async function move(node: PlanNode, kind: PlanMoveKind) {
    const to = planMove(map.nodes, node.id, kind);
    if (to === null) return;
    if (typeof to === 'string') {
      setError(copy.limits[to]);
      return;
    }
    const result = await run(() =>
      api<{ map: PlanMapView }>(`/api/me/plan-maps/${map.id}/nodes/${node.id}/move`, {
        method: 'POST',
        json: to,
      }),
    );
    if (!result) return;
    measure();
    setMenu(null);
    setMap(result.map);
    setStatus(copy.moved);
    focusOn(`more-${node.id}`);
  }

  async function remove(node: PlanNode) {
    const done = await run(() =>
      api(`/api/me/plan-maps/${map.id}/nodes/${node.id}`, { method: 'DELETE' }),
    );
    if (done === null) return;
    const gone = new Set(subtreeIds(map.nodes, node.id));
    const siblings = map.nodes
      .filter((n) => n.parentId === node.parentId && !gone.has(n.id))
      .sort((a, b) => a.position - b.position);
    const before = [...siblings].reverse().find((n) => n.position < node.position);
    measure();
    setMap((m) => ({
      ...m,
      nodes: m.nodes
        .filter((n) => !gone.has(n.id))
        .map((n) => {
          const i = siblings.findIndex((s) => s.id === n.id);
          return i === -1 ? n : { ...n, position: i };
        }),
    }));
    setConfirming(null);
    setMenu(null);
    setStatus(copy.deleted);
    focusOn(`edit-${before?.id ?? node.parentId ?? ''}`);
  }

  async function addUnder(parent: PlanNode) {
    const result = await run(() =>
      api<{ node: PlanNode }>(`/api/me/plan-maps/${map.id}/nodes`, {
        method: 'POST',
        json: { parentId: parent.id },
      }),
    );
    if (!result) return;
    setMap((m) => ({ ...m, nodes: [...m.nodes, result.node] }));
    setMenu(null);
    setEditing(result.node.id);
    setStatus(copy.added);
    // A new step inside a card is written in the List, where every step has its editor.
    if (result.node.depth > 1) showAs('list');
    focusOn(`words-${result.node.id}`);
  }

  const missing = missingSlots(map.templateId, map.nodes);

  async function addStop() {
    const choice = missing.find((m) => m.slotId === adding);
    if (!choice) return;
    const result = await run(async () => {
      await api(`/api/me/plan-maps/${map.id}/nodes`, {
        method: 'POST',
        json: { parentId: choice.parentId, slotId: choice.slotId },
      });
      return api<{ map: PlanMapView }>(`/api/me/plan-maps/${map.id}`);
    });
    if (!result) return;
    setMap(result.map);
    setAdding('');
    setStatus(copy.added);
    const added = result.map.nodes.find((n) => n.slotId === choice.slotId);
    if (added) focusOn(`edit-${added.id}`);
  }

  async function saveTitle(value: string) {
    const result = await run(() =>
      api<{ map: PlanMapView; care: WrittenCare | null }>(`/api/me/plan-maps/${map.id}`, {
        method: 'PATCH',
        json: { title: value.trim() === '' ? null : value },
      }),
    );
    if (!result) return;
    setMap(result.map);
    setStatus(copy.saved);
    setCare(result.care ? { at: 'title', care: result.care } : null);
  }

  async function deleteMap() {
    const done = await run(() => api(`/api/me/plan-maps/${map.id}`, { method: 'DELETE' }));
    if (done !== null) router.push('/goals');
  }

  function showAs(v: 'picture' | 'list') {
    setView(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      // Not remembered: fine.
    }
  }

  // ── Where each card sits (RT-07, RT-08) ─────────────────────────────────────────────────────

  const picture = view === 'picture';
  const layout = tpl.layout;
  const stops = outline?.children ?? [];
  const centre = outline?.node;
  const centreWords = centre ? slot(centre) : null;
  const total = stops.length;
  const counts = planCounts(map.nodes.filter((n) => n.depth <= 1));
  const words = map.words ?? [];
  const hintOf = (n: PlanNode) => {
    const parent = map.nodes.find((p) => p.id === n.parentId);
    return slot(n)?.hint ?? (parent ? (slot(parent)?.childHint ?? null) : null);
  };
  /** What a card holds, for its fixed footprint (map-layout.ts `cardHeight`). */
  const shapeOf = (o: OutlineNode): CardShape => ({
    note: Boolean(o.node.text || hintOf(o.node)),
    whyNot: Boolean(o.node.whyNot),
    differently: Boolean(o.node.differently),
    target: Boolean(o.node.targetMonth),
    link: Boolean(slot(o.node)?.link),
    steps: o.children.length,
  });
  const hubShape = {
    note: Boolean(centre?.text || centreWords?.hint),
    goal: map.goal !== null,
    words: words.length,
    progress: total > 0,
    actions: map.wordsAllowed,
  };
  const hubSize = hubOuter(layout, { width: HUB_WIDTH[layout], height: hubBodyHeight(hubShape) });
  const cardSizes = stops.map((o) => ({
    width: CARD_WIDTH[layout],
    height: cardHeight(shapeOf(o)),
  }));
  const placeOf = (n: PlanNode): Point | null =>
    moving?.id === n.id ? moving.at : (n.place ?? null);
  const laid: MapLayout = placeCards(
    defaultLayout(layout, hubSize, cardSizes),
    { hub: null, cards: stops.map((o) => placeOf(o.node)) },
    hubSize,
  );
  const indexOf = (id: string) => stops.findIndex((o) => o.node.id === id);
  const boxOf = (id: string): Box | undefined => laid.cards[indexOf(id)];
  /** Everything a card must keep clear of: the middle and the other cards. */
  const othersOf = (id: string): Box[] => [
    laid.hub,
    ...laid.cards.filter((_, k) => stops[k]?.node.id !== id),
  ];
  const parts: MapPart[] = centre
    ? [
        { id: centre.id, box: laid.hub, status: '', centre: true },
        ...stops.map((o, k) => ({
          id: o.node.id,
          box: laid.cards[k] as Box,
          status: o.node.status,
          centre: false,
        })),
      ]
    : [];
  const canReset = map.nodes.some((n) => n.place);
  /** The first stop of a climb not yet achieved: "You are here" (the staircase and the road). */
  const here = tpl.ordered ? stops.find((o) => o.node.status !== 'achieved')?.node.id : undefined;

  /**
   * Redraws what follows one card, straight into the SVG (no React, once a frame while it is
   * dragged, MAPS-04): its branch (and, on the staircase, the one arriving at it), and on the
   * road the road itself with the card's marker and the start sign.
   */
  function redraw(id: string, at: Point) {
    const root = section.current;
    const i = indexOf(id);
    if (!root || i < 0) return;
    const cards = laid.cards.map((b, k) => (k === i ? { ...b, x: at.x, y: at.y } : b));
    const lines = connectors(layout, laid.hub, cards).filter(
      (c) => c.index === i || (layout === 'stairs' && c.index === i - 1),
    );
    for (const c of lines) {
      const g = root.querySelector(`[data-link="${c.index}"]`);
      if (!g) continue;
      g.querySelector('[data-part="line"]')?.setAttribute('d', c.d);
      const head = g.querySelector('[data-part="head"]');
      if (head && c.head) head.setAttribute('d', c.head);
      const dot = g.querySelector('[data-part="dot"]');
      dot?.setAttribute('cx', String(c.to.x));
      dot?.setAttribute('cy', String(c.to.y));
    }
    if (layout === 'road') {
      const road = roadOf(laid.hub, cards);
      for (const p of root.querySelectorAll('[data-road-path]')) p.setAttribute('d', road.d);
      root
        .querySelector('[data-road-sign]')
        ?.setAttribute('transform', `translate(${road.start.x} ${road.start.y})`);
      const m = road.markers[i];
      const marker = root.querySelector(`[data-marker="${i}"]`);
      if (m && marker) {
        marker.querySelector('circle')?.setAttribute('cx', String(m.x));
        marker.querySelector('circle')?.setAttribute('cy', String(m.y));
        marker.querySelector('path')?.setAttribute('d', markerPath(m));
      }
    }
  }

  /** Saves where cards were put, the latest place per card, one request at a time (MAPS-08). */
  async function flushPlaces() {
    if (saving.current || pending.current.size === 0) return;
    const batch = new Map(pending.current);
    pending.current.clear();
    saving.current = true;
    try {
      await api(`/api/me/plan-maps/${map.id}/layout`, {
        method: 'PUT',
        json: { places: [...batch].map(([nodeId, p]) => ({ nodeId, x: p.to.x, y: p.to.y })) },
      });
    } catch (e) {
      // Back where they were, unless moved again since.
      setMap((m) => ({
        ...m,
        nodes: m.nodes.map((n) =>
          batch.has(n.id) && !pending.current.has(n.id)
            ? { ...n, place: batch.get(n.id)?.was ?? null }
            : n,
        ),
      }));
      setError(planError(e));
    } finally {
      saving.current = false;
      void flushPlaces();
    }
  }

  /** Puts a card down at `to` (on the grid, in a free spot), saves it, and says so; where it went. */
  function putDown(node: PlanNode, to: Point): Point | null {
    const box = boxOf(node.id);
    if (!box) return null;
    const snapped = toPlace(to);
    const free = freePlace({ ...box, x: snapped.x, y: snapped.y }, othersOf(node.id));
    if (!free) {
      setStatus(copy.arrange.noRoom);
      return null;
    }
    const was = node.place ?? null;
    const queued = pending.current.get(node.id);
    pending.current.set(node.id, { to: free, was: queued ? queued.was : was });
    setMap((m) => ({
      ...m,
      nodes: m.nodes.map((n) => (n.id === node.id ? { ...n, place: free } : n)),
    }));
    setStatus(fill(copy.arrange.placed, nameOf(node)));
    void flushPlaces();
    return free;
  }

  const byId = (id: string) => map.nodes.find((n) => n.id === id);
  /** Where a card sits now (before any drag), in map coordinates. */
  const originOf = (id: string): Point | null => {
    const b = boxOf(id);
    return b ? { x: b.x, y: b.y } : null;
  };
  const drag: CardDrag = {
    start: (id) => (moving ? null : originOf(id)),
    frame: (id, at) => redraw(id, at),
    drop: (id, at) => {
      const node = byId(id);
      const from = originOf(id);
      // The new place is in the DOM before this returns (MAPS-12: the canvas then lets go of the
      // card's lift, so it never shows at its start in between).
      let placed: Point | null = null;
      flushSync(() => {
        placed = node ? putDown(node, at) : null;
      });
      // Its branches where the card now is: the new place, or back where it was when there was
      // no room or it came back to the same spot (MAPS-13: React keeps a value it already had).
      const to = placed ?? from;
      if (to) redraw(id, to);
    },
    cancel: (id) => {
      const node = byId(id);
      const from = originOf(id);
      if (from) redraw(id, from);
      if (node) setStatus(fill(copy.arrange.putBack, nameOf(node)));
    },
  };

  async function resetLayout() {
    // Where the learner had put each card, for the Undo (MAPS-22).
    const had = map.nodes.flatMap((n) => (n.place ? [{ nodeId: n.id, ...n.place }] : []));
    const result = await run(() =>
      api<{ map: PlanMapView }>(`/api/me/plan-maps/${map.id}/layout`, { method: 'DELETE' }),
    );
    if (!result) return;
    measure();
    setMap(result.map);
    setStatus(copy.arrange.resetDone);
    if (undoTimer.current !== null) clearTimeout(undoTimer.current);
    setUndo(had.length > 0 ? had : null);
    undoTimer.current = window.setTimeout(() => {
      undoTimer.current = null;
      setUndo(null);
    }, UNDO_MS);
  }

  /** Undo reset: every card back where the learner had put it, with one request. */
  async function undoReset() {
    const places = undo;
    if (!places) return;
    const done = await run(() =>
      api(`/api/me/plan-maps/${map.id}/layout`, { method: 'PUT', json: { places } }),
    );
    if (done === null) return;
    if (undoTimer.current !== null) clearTimeout(undoTimer.current);
    undoTimer.current = null;
    setUndo(null);
    const at = new Map(places.map((p) => [p.nodeId, { x: p.x, y: p.y }]));
    measure();
    setMap((m) => ({
      ...m,
      nodes: m.nodes.map((n) => (at.has(n.id) ? { ...n, place: at.get(n.id) ?? null } : n)),
    }));
    setStatus(copy.arrange.undoneReset);
  }

  // Move mode (WCAG 2.5.7): after each arrow press the card asks the canvas to keep it in view
  // (MAPS-03), and a little later its place is said in words (MAPS-06).
  // biome-ignore lint/correctness/useExhaustiveDependencies: on each move only.
  useEffect(() => {
    if (!moving) return;
    const button = document.getElementById(`move-${moving.id}`);
    button?.dispatchEvent(new CustomEvent(REVEAL_EVENT, { bubbles: true }));
    const node = byId(moving.id);
    const box = boxOf(moving.id);
    if (!node || !box) return;
    if (sayTimer.current !== null) clearTimeout(sayTimer.current);
    sayTimer.current = window.setTimeout(() => {
      sayTimer.current = null;
      const { sector, far } = whereIs(box, laid.hub);
      setStatus(
        fill(
          copy.arrange.at,
          nameOf(node),
          `${copy.arrange.sectors[sector]}, ${far ? copy.arrange.far : copy.arrange.near}`,
        ),
      );
    }, SAY_AFTER_MS);
    return () => {
      if (sayTimer.current !== null) clearTimeout(sayTimer.current);
    };
  }, [moving?.at.x, moving?.at.y, moving?.id]);

  /** Ends Move mode: put down where it is now (saved), or back where it was (nothing saved). */
  function finishMove(how: 'down' | 'back') {
    if (!moving) return;
    const node = byId(moving.id);
    const at = moving.at;
    setMoving(null);
    if (!node) return;
    if (how === 'down') putDown(node, at);
    else setStatus(fill(copy.arrange.putBack, nameOf(node)));
  }

  /** One dot of the grid in Move mode, from an arrow key or the pad. */
  function nudgeMove(key: string, shift = false): boolean {
    if (!moving) return false;
    const next = nudge(moving.at, key, shift);
    if (!next) return false;
    setMoving({ ...moving, at: next });
    return true;
  }

  /** Focus went somewhere other than the card's Move button or its pad: the card goes back. */
  const leftMove = (to: EventTarget | null) =>
    !(to instanceof Element && (to.closest('[data-move-pad]') || to.id === `move-${moving?.id}`));

  /** Move mode: the Move button, then the arrow keys; Enter puts it down, Escape puts it back. */
  function moveButton(n: PlanNode, name: string) {
    const on = moving?.id === n.id;
    return (
      <button
        type="button"
        id={`move-${n.id}`}
        className="uf-map-move"
        aria-label={fill(copy.arrange.move, name)}
        title={fill(copy.arrange.move, name)}
        aria-pressed={on}
        onClick={(e) => {
          // Safari doesn't focus a pressed button (MAPS-25): the arrow keys need it focused.
          e.currentTarget.focus();
          if (on) {
            finishMove('down');
            return;
          }
          const from = originOf(n.id);
          if (!from) return;
          setMoving({ id: n.id, from, at: from });
          setStatus(fill(copy.arrange.moving, name));
        }}
        onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
          if (!on || !moving) return;
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            finishMove('back');
            return;
          }
          if (nudgeMove(e.key, e.shiftKey)) e.preventDefault();
        }}
        onBlur={(e) => {
          // Focus left without a choice: the card goes back, never a silent save (MAPS-06). A
          // press on the pad is a choice still being made (MAPS-11).
          if (on && leftMove(e.relatedTarget)) finishMove('back');
        }}
      >
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20">
          <path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />
        </svg>
      </button>
    );
  }

  /** A step inside a card, as the picture shows it: compact, its editing in the List. */
  const renderStepRow = (o: OutlineNode): ReactNode => {
    const n = o.node;
    const name = nameOf(n);
    return (
      <li key={n.id} data-node-id={n.id} data-status={n.status} className="uf-map-step-row">
        <h4 id={`heading-${n.id}`} className="uf-map-step-name">
          {name}
        </h4>
        <span className="uf-map-step-status">
          <StatusIcon status={n.status} />
          <span className="sr-only">{statusWord(n.status)}</span>
        </span>
      </li>
    );
  };

  const renderNode = (o: OutlineNode, index: number): ReactNode => {
    const n = o.node;
    const words = slot(n);
    const tone = (index % 6) + 1;
    const box = n.depth === 1 && picture ? laid.cards[index] : undefined;
    const style =
      n.depth === 1
        ? ({
            '--i': index,
            '--uf-map-tone': `var(--uf-color-map-tone${tone})`,
            '--uf-map-soft': `var(--uf-color-map-tone${tone}-soft)`,
            ...(box
              ? {
                  left: rem(box.x),
                  top: rem(box.y),
                  width: rem(box.width),
                  height: rem(box.height),
                }
              : {}),
          } as CSSProperties)
        : undefined;
    const name = nameOf(n);
    const hint = hintOf(n);
    const Heading = n.depth === 1 ? 'h3' : 'h4';
    const steps = subtreeIds(map.nodes, n.id).length - 1;
    const isOpen = menu === n.id;
    const can = (kind: PlanMoveKind) => planMove(map.nodes, n.id, kind) !== null;
    const icon = slotIcon(map.templateId, n.slotId);
    const shownSteps = box ? o.children.slice(0, CARD_STEPS) : o.children;
    const moreSteps = o.children.length - shownSteps.length;
    return (
      <li
        key={n.id}
        data-node-id={n.id}
        data-status={n.status}
        data-just={justAchieved === n.id ? 'achieved' : undefined}
        data-drag-id={box ? n.id : undefined}
        data-moving={box && moving?.id === n.id ? '' : undefined}
        data-active={editing === n.id || menu === n.id || confirming === n.id ? '' : undefined}
        className={n.depth === 1 ? 'uf-map-branch' : 'uf-map-step'}
        style={style}
      >
        <div className="uf-map-card">
          <div className="uf-map-head">
            {n.depth === 1 ? (
              <span aria-hidden="true" className="uf-map-number">
                {index + 1}
              </span>
            ) : null}
            {n.depth === 1 && icon ? <Icon name={icon} className="uf-map-slot-icon" /> : null}
            <Heading id={`heading-${n.id}`} className="uf-map-heading">
              {tpl.ordered && n.depth === 1 ? (
                <span className="sr-only">{`${fill(copy.stepOf, index + 1, total)}: `}</span>
              ) : null}
              <span className="uf-map-name">{name}</span>
              {words?.subtitle ? (
                <span className="uf-map-subtitle"> ({words.subtitle})</span>
              ) : null}
            </Heading>
          </div>
          <div className="uf-map-meta">
            <p className="uf-map-status" data-status={n.status}>
              <StatusIcon status={n.status} />
              <span>{statusWord(n.status)}</span>
            </p>
            {here === n.id ? <p className="uf-map-here">{copy.arrange.youAreHere}</p> : null}
          </div>
          {n.text ? <p className="uf-map-words uf-map-note">{n.text}</p> : null}
          {!n.text && hint ? <p className="uf-map-hint uf-map-note">{hint}</p> : null}
          {n.whyNot ? (
            <p className="uf-map-reflect-line text-sm">
              <span className="font-medium">
                {n.status === 'achieved' ? copy.learnedLastTime : copy.whyNotShown}:
              </span>{' '}
              {n.whyNot}
            </p>
          ) : null}
          {n.differently ? (
            <p className="uf-map-reflect-line text-sm">
              <span className="font-medium">{copy.differentlyShown}:</span> {n.differently}
            </p>
          ) : null}
          {n.targetMonth ? (
            <p className="uf-map-target text-sm text-muted">
              {fill(copy.targetShown, monthName(n.targetMonth))}
            </p>
          ) : null}
          {words?.link ? (
            <p className="uf-map-link text-sm">
              <ButtonLink href={words.link.href} variant="quiet" className="px-0">
                {words.link.label}
              </ButtonLink>
            </p>
          ) : null}

          {o.children.length > 0 ? (
            <ul className="uf-map-steps">
              {box
                ? shownSteps.map((c) => renderStepRow(c))
                : o.children.map((c, i) => renderNode(c, i))}
              {moreSteps > 0 ? (
                <li className="uf-map-steps-more">
                  <button type="button" className="uf-map-more-btn" onClick={() => showAs('list')}>
                    {fill(copy.arrange.stepsMore, moreSteps)}
                  </button>
                </li>
              ) : null}
            </ul>
          ) : null}

          {editing === n.id ? (
            <NodeEditor
              node={n}
              copy={copy}
              hint={hint}
              wordsAllowed={map.wordsAllowed}
              busy={busy}
              onSave={(patch) => void save(n, patch)}
              onCancel={() => {
                setEditing(null);
                focusOn(`edit-${n.id}`);
              }}
            />
          ) : (
            <div className="uf-map-actions">
              <Button
                id={`edit-${n.id}`}
                variant={n.depth === 1 ? 'secondary' : 'quiet'}
                aria-label={fill(copy.editing, name)}
                onClick={() => {
                  setEditing(n.id);
                  setMenu(null);
                }}
              >
                {copy.edit}
              </Button>
              <Button
                id={`more-${n.id}`}
                variant={n.depth === 1 ? 'secondary' : 'quiet'}
                aria-label={fill(copy.moreFor, name)}
                aria-expanded={isOpen}
                aria-controls={`menu-${n.id}`}
                onClick={() => setMenu(isOpen ? null : n.id)}
              >
                {copy.more}
              </Button>
              {box ? moveButton(n, name) : null}
            </div>
          )}

          {isOpen && confirming !== n.id ? (
            <div id={`menu-${n.id}`} className="uf-map-menu flex flex-wrap gap-2">
              {map.wordsAllowed ? (
                <Button
                  variant="quiet"
                  aria-disabled={busy}
                  onClick={() => !busy && void addUnder(n)}
                >
                  {copy.addChild}
                </Button>
              ) : null}
              {(['up', 'down', 'out', 'in'] as const).map((kind) => (
                <Button
                  key={kind}
                  variant="quiet"
                  aria-disabled={busy || !can(kind)}
                  onClick={() => {
                    if (!busy && can(kind)) void move(n, kind);
                  }}
                >
                  {copy[MOVE_LABEL[kind]]}
                </Button>
              ))}
              <Button
                variant="quiet"
                onClick={() => {
                  setConfirming(n.id);
                  focusOn(`confirm-${n.id}`);
                }}
              >
                {copy.delete}
              </Button>
            </div>
          ) : null}

          {confirming === n.id ? (
            <div className={`${panelLook} flex flex-col gap-2 p-3`}>
              <p id={`confirm-${n.id}`} tabIndex={-1} className="font-medium">
                {steps === 0
                  ? fill(copy.deleteAskNone, name)
                  : steps === 1
                    ? fill(copy.deleteAskOne, name)
                    : fill(copy.deleteAsk, name, steps)}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="danger"
                  aria-disabled={busy}
                  onClick={() => !busy && void remove(n)}
                >
                  {copy.delete}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setConfirming(null);
                    setMenu(null);
                    focusOn(`more-${n.id}`);
                  }}
                >
                  {copy.keep}
                </Button>
              </div>
            </div>
          ) : null}

          {care?.at === n.id && !inCanvas ? carePanel : null}
          {justAchieved === n.id && n.depth === 1 ? <Sparks /> : null}
        </div>
      </li>
    );
  };

  // The care a part's words need. In the list it sits under that part; in the picture it is
  // drawn outside the canvas (A10-65): inside, it took the map's zoom (8 px at Fit to view) and the
  // card clipped its Call links. Seen, focus goes back to the part's Edit.
  const inCanvas = picture;
  const carePanel =
    care && care.at !== 'title' ? (
      <WrittenCarePanel
        care={care.care}
        words={copy.care}
        onSeen={() => {
          const at = care.at;
          setCare(null);
          focusOn(`edit-${at}`);
        }}
      />
    ) : null;
  const Branches = tpl.ordered ? 'ol' : 'ul';
  const achievedShare = total === 0 ? 0 : counts.achieved / total;
  const hubStyle = picture
    ? ({
        left: rem(laid.hub.x),
        top: rem(laid.hub.y),
        width: rem(laid.hub.width),
        height: rem(laid.hub.height),
      } as CSSProperties)
    : undefined;
  const hubBodyStyle = picture
    ? ({ width: rem(HUB_WIDTH[layout]), height: rem(hubBodyHeight(hubShape)) } as CSSProperties)
    : undefined;

  // The map, drawn once: as the picture it sits on a canvas card (and, opened, in the dialog
  // instead, so there is never a second copy of its words); as the list it is the page's own.
  const mapSection = centre ? (
    <section
      ref={section}
      aria-labelledby={`heading-${centre.id}`}
      className={`uf-map uf-map--${layout}`}
      data-view={view}
      style={picture ? { width: rem(laid.world.width), height: rem(laid.world.height) } : undefined}
    >
      {picture ? (
        <MapLinks
          layout={layout}
          hub={laid.hub}
          cards={laid.cards}
          world={laid.world}
          statuses={stops.map((o) => o.node.status)}
          startLabel={copy.arrange.start}
        />
      ) : null}
      <div
        className="uf-map-centre"
        data-node-id={centre.id}
        data-active={editing === centre.id ? '' : undefined}
        style={hubStyle}
      >
        {picture ? <HubArt layout={layout} size={laid.hub} done={achievedShare} /> : null}
        <div className="uf-map-centre-body" style={hubBodyStyle}>
          <h2 id={`heading-${centre.id}`} className="uf-map-hub-heading">
            {centreWords?.heading ?? copy.goalCentre}
          </h2>
          {centre.text ? <p className="uf-map-words uf-map-note">{centre.text}</p> : null}
          {!centre.text && centreWords?.hint ? (
            <p className="uf-map-hint uf-map-note">{centreWords.hint}</p>
          ) : null}
          {map.goal ? (
            <div className="uf-map-goal flex flex-col gap-1">
              <p className="uf-map-goal-line">
                <span className="sr-only">{`${copy.goalCentre}: `}</span>
                {map.goal.kind === 'goal'
                  ? fill(copy.goalAt, map.goal.course, map.goal.university)
                  : map.goal.kind === 'none'
                    ? copy.goalNone
                    : copy.goalUnavailable}
              </p>
              {map.goal.kind === 'goal' ? (
                <Link href="/goals" className="uf-map-hub-link">
                  {copy.goalLink}
                </Link>
              ) : null}
            </div>
          ) : null}
          {words.length > 0 ? (
            // The learner's About me words, read live (never copied into the map): the life map's
            // ribbon, pills on the others; one row, two for three words.
            <p className="uf-map-hub-words" data-rows={words.length >= 3 ? '2' : '1'}>
              <span className="sr-only">{`${copy.arrange.aboutMeWords}: `}</span>
              {words.map((w) => (
                <span key={w} className="uf-map-hub-word">
                  {w}
                </span>
              ))}
            </p>
          ) : null}
          {map.wordsAllowed && editing === centre.id ? (
            <NodeEditor
              node={centre}
              copy={copy}
              hint={centreWords?.hint ?? null}
              wordsAllowed
              centre
              busy={busy}
              onSave={(patch) => void save(centre, patch)}
              onCancel={() => {
                setEditing(null);
                focusOn(`edit-${centre.id}`);
              }}
            />
          ) : map.wordsAllowed || total > 0 ? (
            // The foot row: how far along, and (while writing is on) Edit and Add a stop as round
            // icon buttons, 44px, named for readers and on hover.
            <div className="uf-map-hub-foot" data-actions={map.wordsAllowed ? '' : undefined}>
              {total > 0 ? (
                <p className="uf-map-progress">
                  <span aria-hidden="true" className="uf-map-meter">
                    <span style={{ width: `${Math.round(achievedShare * 100)}%` }} />
                  </span>
                  <span>{fill(copy.arrange.progress, counts.achieved, total)}</span>
                </p>
              ) : null}
              {map.wordsAllowed ? (
                <div className="uf-map-actions">
                  <button
                    type="button"
                    id={`edit-${centre.id}`}
                    className="uf-map-hub-btn"
                    aria-label={fill(copy.editing, centreWords?.heading ?? copy.goalCentre)}
                    title={copy.edit}
                    onClick={() => setEditing(centre.id)}
                  >
                    <svg
                      aria-hidden="true"
                      focusable="false"
                      viewBox="0 0 24 24"
                      width="20"
                      height="20"
                    >
                      <path d="M4 20h4L19 9l-4-4L4 16Zm10-14l4 4" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="uf-map-hub-btn"
                    aria-label={copy.addStop}
                    title={copy.addStop}
                    aria-disabled={busy}
                    onClick={() => !busy && void addUnder(centre)}
                  >
                    <svg
                      aria-hidden="true"
                      focusable="false"
                      viewBox="0 0 24 24"
                      width="20"
                      height="20"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          {care?.at === centre.id && !inCanvas ? carePanel : null}
        </div>
      </div>
      <Branches className="uf-map-branches">{stops.map((c, i) => renderNode(c, i))}</Branches>
    </section>
  ) : null;

  // Move mode's on-screen pad (MAPS-11, WCAG 2.5.7: one tap at a time, no drag): under the
  // canvas's window at full size. A press keeps focus where it is (on Move), so Move's "focus
  // left" never fires for it; Tab into it and out again is a choice not made: the card goes back.
  const movingNode = moving ? byId(moving.id) : undefined;
  const movePad = movingNode ? (
    <fieldset
      className="uf-map-pad"
      data-move-pad=""
      onBlur={(e) => {
        if (leftMove(e.relatedTarget)) finishMove('back');
      }}
    >
      <legend className="sr-only">{fill(copy.arrange.pad.label, nameOf(movingNode))}</legend>
      {PAD_KEYS.map(([dir, key, d]) => (
        <button
          key={dir}
          type="button"
          className="uf-map-pad-btn"
          data-dir={dir}
          aria-label={copy.arrange.pad[dir]}
          title={copy.arrange.pad[dir]}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => nudgeMove(key)}
        >
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20">
            <path d={d} />
          </svg>
        </button>
      ))}
      <button
        type="button"
        className="uf-map-pad-text"
        data-primary=""
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          finishMove('down');
          focusOn(`move-${movingNode.id}`);
        }}
      >
        {copy.arrange.pad.putDown}
      </button>
      <button
        type="button"
        className="uf-map-pad-text"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          finishMove('back');
          focusOn(`move-${movingNode.id}`);
        }}
      >
        {copy.arrange.pad.cancel}
      </button>
    </fieldset>
  ) : null;

  const pageTitle = map.title ?? template.name;
  const canvasProps = {
    movePad,
    copy: copy.canvas,
    arrange: copy.arrange,
    layout,
    size: laid.world,
    hub: laid.hub,
    parts,
    drag,
    canReset,
    onResetLayout: () => void resetLayout(),
    nonce,
  };

  return (
    <Page title={pageTitle} lead={copy.onlyYou} headingRef={title}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ButtonLink href="/goals" variant="quiet" className="px-0">
          {copy.back}
        </ButtonLink>
        <p className="uf-map-layout-label text-sm text-muted">
          {fill(copy.naming.layout, template.name)}
        </p>
      </div>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <StatusLine said={status} />
      {map.wordsAllowed ? null : <Notice tone="info">{copy.wordsWait}</Notice>}
      {map.wordsAllowed && map.title === null ? (
        <Notice tone="info">{copy.naming.nameThis}</Notice>
      ) : null}

      {map.wordsAllowed ? (
        <TitleForm copy={copy} title={map.title} busy={busy} onSave={(v) => void saveTitle(v)} />
      ) : null}
      {care?.at === 'title' ? (
        <WrittenCarePanel care={care.care} words={copy.care} onSeen={() => setCare(null)} />
      ) : null}

      <div className="uf-map-toggle">
        <span className="font-medium">{copy.showAs}</span>
        {(['picture', 'list'] as const).map((v) => (
          <Button key={v} variant="secondary" aria-pressed={view === v} onClick={() => showAs(v)}>
            {copy[v]}
          </Button>
        ))}
      </div>

      {undo ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            aria-disabled={busy}
            onClick={() => !busy && void undoReset()}
          >
            {copy.arrange.undoReset}
          </Button>
        </div>
      ) : null}

      {picture && mapSection ? (
        <>
          {/* The dialog first: its effects run before the card's, so it has closed (and the page
              is no longer inert) when the card's Open takes focus back. */}
          <CanvasDialog
            open={canvasOpen}
            title={pageTitle}
            closeLabel={copy.canvas.close}
            onClose={() => {
              setCanvasOpen(false);
              setCanvasClosed(true);
            }}
          >
            {canvasOpen ? (
              <>
                <MapCanvas {...canvasProps} expanded>
                  {mapSection}
                </MapCanvas>
                {carePanel}
              </>
            ) : null}
          </CanvasDialog>
          {canvasOpen ? (
            <p className="uf-canvas-away text-muted">{copy.canvas.openNow}</p>
          ) : (
            <>
              <MapCanvas
                {...canvasProps}
                returnFocus={canvasClosed}
                onOpen={() => setCanvasOpen(true)}
              >
                {mapSection}
              </MapCanvas>
              {carePanel}
            </>
          )}
        </>
      ) : (
        mapSection
      )}

      {missing.length > 0 ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-60 flex-1">
            <Field label={copy.addFromTemplate}>
              {({ id }) => (
                <Select id={id} value={adding} onChange={(e) => setAdding(e.target.value)}>
                  <option value="">{copy.addStop}</option>
                  {missing.map((m) => (
                    <option key={m.slotId} value={m.slotId}>
                      {template.slots[m.slotId]?.heading ?? m.slotId}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <Button
            variant="secondary"
            aria-disabled={busy || adding === ''}
            onClick={() => {
              if (!busy && adding !== '') void addStop();
            }}
          >
            {copy.addStop}
          </Button>
        </div>
      ) : null}

      <p className="text-sm text-muted">{copy.exportNote}</p>

      {confirming === 'map' ? (
        <div className={`${panelLook} flex flex-col gap-2 p-3`}>
          <p id="confirm-map" tabIndex={-1} className="font-medium">
            {fill(copy.deleteMapAsk, pageTitle)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" aria-disabled={busy} onClick={() => !busy && void deleteMap()}>
              {copy.delete}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setConfirming(null);
                focusOn('delete-map');
              }}
            >
              {copy.keep}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button
            id="delete-map"
            variant="secondary"
            onClick={() => {
              setConfirming('map');
              focusOn('confirm-map');
            }}
          >
            {copy.deleteMap}
          </Button>
        </div>
      )}
    </Page>
  );
}

const MOVE_LABEL = { up: 'moveUp', down: 'moveDown', out: 'moveOut', in: 'moveIn' } as const;

/** The Move pad's arrows, in the order they read: each its key and its arrow's path. */
const PAD_KEYS = [
  ['up', 'ArrowUp', 'M12 19V5M5 12l7-7 7 7'],
  ['left', 'ArrowLeft', 'M19 12H5M12 5l-7 7 7 7'],
  ['right', 'ArrowRight', 'M5 12h14M12 5l7 7-7 7'],
  ['down', 'ArrowDown', 'M12 5v14M5 12l7 7 7-7'],
] as const;

/** "Nov 2028", in South African English, from `2028-11`. */
function monthName(month: string): string {
  return new Date(`${month}-15T12:00:00Z`).toLocaleDateString('en-ZA', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** The twelve months' names, from the browser's own South African English. */
const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Date(Date.UTC(2026, i, 15)).toLocaleDateString('en-ZA', { month: 'long', timeZone: 'UTC' }),
);

/** The status as an icon beside its word (never colour alone): decoration, so hidden. */
function StatusIcon({ status }: { status: PlanStatus }) {
  return (
    <svg
      aria-hidden="true"
      data-status-icon={status}
      className={`uf-map-icon uf-map-icon--${status}`}
      viewBox="0 0 24 24"
      width="20"
      height="20"
    >
      {status === 'planned' ? <circle cx="12" cy="12" r="8" /> : null}
      {status === 'achieved' ? (
        <>
          <circle cx="12" cy="12" r="10" />
          <path className="uf-map-tick" pathLength={1} d="M7 12.5l3.2 3.2L17 9" />
        </>
      ) : null}
      {status === 'not-achieved' ? <path d="M17.5 8A7 7 0 1 0 19 13M17.5 8V3.5M17.5 8H13" /> : null}
    </svg>
  );
}

/**
 * Ten sparks from a stop just marked Achieved (a small, removable piece: the owner decides before
 * merge; the proposal §9 said no confetti). Pure CSS, once, local to the card, from a fixed table
 * of angles (no Math.random: tests are stable); none under reduced motion (not rendered at all,
 * so nothing waits on an animation), never beside a care card and never on Not achieved
 * (plan-map-view.tsx `save`). Decoration: hidden from readers; gone when the last spark ends.
 */
const SPARK_ANGLES = [12, 48, 80, 117, 150, 192, 228, 263, 300, 336];
function Sparks() {
  const [gone, setGone] = useState(() => reducedMotion());
  const ended = useRef(0);
  if (gone) return null;
  return (
    <span
      aria-hidden="true"
      className="uf-map-sparks"
      onAnimationEnd={() => {
        ended.current += 1;
        if (ended.current >= SPARK_ANGLES.length) setGone(true);
      }}
    >
      {SPARK_ANGLES.map((a, i) => (
        <span
          key={a}
          className="uf-map-spark"
          data-shape={i % 2 === 0 ? 'square' : 'round'}
          style={{ '--a': `${a}deg`, '--k': 0.75 + (i % 4) * 0.25 } as CSSProperties}
        />
      ))}
    </span>
  );
}

/**
 * The map's own name (RT-06): the learner's words, so it is here only while writing is on. A
 * name is needed: an empty one is not saved, and the field says why.
 */
function TitleForm({
  copy,
  title,
  busy,
  onSave,
}: {
  copy: PlanCopy;
  title: string | null;
  busy: boolean;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(title ?? '');
  const [missing, setMissing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (busy) return;
        if (value.trim() === '') {
          setMissing(true);
          input.current?.focus();
          return;
        }
        setMissing(false);
        onSave(value);
      }}
    >
      <div className="min-w-60 flex-1">
        <Field
          label={copy.naming.label}
          hint={copy.naming.hint}
          error={missing ? copy.naming.needed : undefined}
        >
          {({ id, describedBy }) => (
            <Input
              ref={input}
              id={id}
              aria-describedby={describedBy}
              aria-invalid={missing || undefined}
              required
              value={value}
              maxLength={PLAN_LIMITS.title}
              onChange={(e) => setValue(e.target.value)}
            />
          )}
        </Field>
      </div>
      <Button type="submit" variant="secondary" aria-disabled={busy}>
        {copy.saveTitle}
      </Button>
    </form>
  );
}

/** A part's editor, in place under it (§8.2): its words, how it went, the reflections, a target. */
function NodeEditor({
  node,
  copy,
  hint,
  wordsAllowed,
  centre = false,
  busy,
  onSave,
  onCancel,
}: {
  node: PlanNode;
  copy: PlanCopy;
  hint: string | null;
  wordsAllowed: boolean;
  centre?: boolean;
  busy: boolean;
  onSave: (patch: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const ids = useId();
  const [text, setText] = useState(node.text ?? '');
  const [status, setStatus] = useState<PlanStatus>(node.status);
  const [whyNot, setWhyNot] = useState(node.whyNot ?? '');
  const [differently, setDifferently] = useState(node.differently ?? '');
  const [month, setMonth] = useState(node.targetMonth?.slice(5, 7) ?? '');
  const [year, setYear] = useState(node.targetMonth?.slice(0, 4) ?? '');
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => thisYear - 2 + i).filter(
    (y) => y >= PLAN_LIMITS.firstYear && y <= PLAN_LIMITS.lastYear,
  );
  const left = (value: string, max: number) => fill(copy.charactersLeft, max - value.length);

  return (
    <form
      className="uf-map-editor flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (busy) return;
        const target = month && year ? `${year}-${month}` : null;
        onSave({
          ...(wordsAllowed ? { text: text.trim() === '' ? null : text } : {}),
          ...(centre ? {} : { status, targetMonth: target }),
          ...(wordsAllowed && !centre
            ? {
                whyNot: whyNot.trim() === '' ? null : whyNot,
                differently: differently.trim() === '' ? null : differently,
              }
            : {}),
        });
      }}
    >
      {wordsAllowed ? (
        // The placeholder prompt is visible hint text, tied to the field (§7), not a placeholder.
        <div className="flex flex-col gap-1">
          <label htmlFor={`words-${node.id}`} className="font-medium">
            {copy.myWords}
          </label>
          {hint ? (
            <p id={`${ids}-words-hint`} className="text-sm text-muted">
              {hint}
            </p>
          ) : null}
          <TextArea
            id={`words-${node.id}`}
            aria-describedby={[hint ? `${ids}-words-hint` : '', `${ids}-words-left`]
              .filter(Boolean)
              .join(' ')}
            value={text}
            maxLength={PLAN_LIMITS.text}
            onChange={(e) => setText(e.target.value)}
          />
          <p id={`${ids}-words-left`} className="text-sm text-muted">
            {left(text, PLAN_LIMITS.text)}
          </p>
        </div>
      ) : null}

      {centre ? null : (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 font-medium">{copy.statusLegend}</legend>
          <div className="flex flex-wrap gap-2">
            {STATUS_ORDER.map((s) => (
              <label
                key={s}
                className="uf-map-radio flex min-h-11 items-center gap-2 rounded-md px-3"
              >
                <input
                  type="radio"
                  name={`${ids}-status`}
                  value={s}
                  checked={status === s}
                  onChange={() => setStatus(s)}
                  className="size-5 accent-brand"
                />
                <StatusIcon status={s} />
                <span>{copy.status[s]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {!centre && status === 'not-achieved' && wordsAllowed ? (
        <div className="uf-map-reflect flex flex-col gap-3">
          <Field label={copy.whyNot}>
            {({ id }) => (
              <TextArea
                id={id}
                value={whyNot}
                maxLength={PLAN_LIMITS.reflection}
                onChange={(e) => setWhyNot(e.target.value)}
              />
            )}
          </Field>
          <Field label={copy.differently}>
            {({ id }) => (
              <TextArea
                id={id}
                value={differently}
                maxLength={PLAN_LIMITS.reflection}
                onChange={(e) => setDifferently(e.target.value)}
              />
            )}
          </Field>
        </div>
      ) : null}

      {centre ? null : (
        <fieldset className="flex flex-col gap-1" aria-describedby={`${ids}-target-hint`}>
          <legend className="font-medium">{copy.target}</legend>
          <p id={`${ids}-target-hint`} className="text-sm text-muted">
            {copy.targetHint}
          </p>
          <div className="flex flex-wrap gap-3">
            <div className="min-w-40">
              <Field label={copy.month}>
                {({ id }) => (
                  <Select id={id} value={month} onChange={(e) => setMonth(e.target.value)}>
                    <option value="">{copy.noTarget}</option>
                    {MONTHS.map((name, i) => (
                      <option key={name} value={String(i + 1).padStart(2, '0')}>
                        {name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <div className="min-w-32">
              <Field label={copy.year}>
                {({ id }) => (
                  <Select id={id} value={year} onChange={(e) => setYear(e.target.value)}>
                    <option value="">{copy.noTarget}</option>
                    {years.map((y) => (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </div>
        </fieldset>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" aria-disabled={busy}>
          {copy.save}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {copy.cancel}
        </Button>
      </div>
    </form>
  );
}
