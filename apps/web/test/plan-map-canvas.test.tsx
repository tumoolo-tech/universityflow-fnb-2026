// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { en } from '@universityflow/content';
import { type PlanMapView, templateSeed } from '@universityflow/ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EDGE, fitView, PAN_STEP, ZOOM } from '../app/(app)/goals/maps/[id]/canvas-math';
import { MAP_GRID } from '../app/(app)/goals/maps/[id]/map-layout';
import { LIFT_HOLD_MS } from '../app/(app)/goals/maps/[id]/plan-map-canvas';
import { PlanMapPage } from '../app/(app)/goals/maps/[id]/plan-map-view';
import { planCopy, templateCopy } from '../lib/server/plan-maps-copy';

/**
 * The plan map on a canvas card (the owner, 2026-10-24: "a canvas on a card where you can scroll
 * up, down, left and right without scrolling the whole page, and zoom in and out, and close the
 * canvas"): a labelled region with its keys explained; buttons and keys that pan and zoom; a
 * full-screen dialog that takes focus and gives it back; a drag that never opens a part; and,
 * under reduced motion, every move a jump. jsdom has no layout, so the card's and the map's sizes
 * are given here. Synthetic words.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const t = en.planMaps;
const c = t.canvas;
const copy = planCopy();
const CARD = { width: 328, height: 520 };
const WORLD = { width: 960, height: 900 };

function mapOf(): PlanMapView {
  const seed = templateSeed('six-stops');
  const id = (ref: string) =>
    `00000000-0000-4000-8000-${String(seed.findIndex((s) => s.ref === ref)).padStart(12, '0')}`;
  return {
    id: '00000000-0000-4000-9000-000000000001',
    templateId: 'six-stops',
    title: null,
    linksGoal: false,
    goal: null,
    nodes: seed.map((s) => ({
      id: id(s.ref),
      parentId: s.parentRef ? id(s.parentRef) : null,
      position: s.position,
      depth: s.depth,
      slotId: s.slotId,
      text: null,
      status: 'planned',
      whyNot: null,
      differently: null,
      targetMonth: null,
    })),
    wordsAllowed: true,
    updatedAt: '2026-10-13T08:00:00.000Z',
  };
}

function page() {
  const map = mapOf();
  return render(
    <PlanMapPage
      map={map}
      copy={copy}
      template={templateCopy(map.templateId)}
      justCreated={false}
      nonce="synthetic-nonce"
    />,
  );
}

/** The frames the page asked for, run by hand. */
let frames: Array<FrameRequestCallback> = [];
let clock = 0;
function runFrames(count = 200) {
  for (let i = 0; i < count && frames.length > 0; i += 1) {
    const now = frames;
    frames = [];
    clock += 16;
    for (const f of now) f(clock);
  }
}

function motion(reduced: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reduced && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

const viewport = () => screen.getAllByRole('region', { name: c.label }).at(-1) as HTMLElement;
const view = () => {
  const el = viewport();
  const read = (name: string) => Number.parseFloat(el.style.getPropertyValue(name));
  return { x: read('--uf-canvas-x'), y: read('--uf-canvas-y'), scale: read('--uf-canvas-scale') };
};
const percent = (scale: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'percent' }).format(scale);

beforeEach(() => {
  frames = [];
  clock = 0;
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => {
    frames.push(f);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames = [];
  });
  const size = (cls: string, value: number) =>
    function (this: HTMLElement) {
      // A closed dialog has no size, as in a browser.
      const dialog = this.closest('dialog');
      if (dialog && !dialog.hasAttribute('open')) return 0;
      if (this.classList.contains('uf-canvas-viewport') && cls === 'card') return value;
      if (this.classList.contains('uf-canvas-world') && cls === 'world') return value;
      return 0;
    };
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(
    size('card', CARD.width),
  );
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(
    size('card', CARD.height),
  );
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(
    size('world', WORLD.width),
  );
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(
    size('world', WORLD.height),
  );
  motion(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the canvas card', () => {
  it('holds the map in a labelled region you can focus, its keys explained, the map still one list', () => {
    page();
    const region = viewport();
    expect(region.tabIndex).toBe(0);
    const hint = document.getElementById(region.getAttribute('aria-describedby') ?? '');
    // The window's keys, and how to move a card without a mouse (RT-08).
    expect(hint?.textContent).toBe(`${c.keys} ${t.arrange.keys}`);
    // The map's words are inside it, once, in reading order.
    expect(within(region).getByRole('heading', { level: 2 })).toBeTruthy();
    expect(within(region).getAllByRole('heading', { level: 3 })).toHaveLength(6);
    expect(screen.getAllByText('Grade 11', { selector: 'h3, h3 *' })).toHaveLength(1);
  });

  it('has buttons that zoom in and out, show the level, fit the map and go back to the middle', () => {
    page();
    const tools = screen.getByRole('group', { name: c.tools });
    const start = view();
    expect(start.scale).toBe(1);
    expect(within(tools).getByText(percent(1))).toBeTruthy();

    fireEvent.click(within(tools).getByRole('button', { name: c.zoomIn }));
    expect(view().scale).toBeCloseTo(ZOOM.step, 6);
    expect(within(tools).getByText(percent(ZOOM.step))).toBeTruthy();

    fireEvent.click(within(tools).getByRole('button', { name: c.zoomOut }));
    fireEvent.click(within(tools).getByRole('button', { name: c.zoomOut }));
    expect(view().scale).toBeCloseTo(1 / ZOOM.step, 6);

    fireEvent.click(within(tools).getByRole('button', { name: c.fit }));
    expect(view().scale).toBeCloseTo(fitView(WORLD, CARD, EDGE).scale, 6);

    fireEvent.click(within(tools).getByRole('button', { name: c.reset }));
    expect(view().scale).toBe(1);
    // Each button names its key for a pointer, and every target is at least 24px (WCAG 2.5.8).
    expect(within(tools).getByRole('button', { name: c.zoomIn }).title).toBe(c.zoomInKey);
    expect(
      within(tools).getByRole('button', { name: c.zoomIn }).getAttribute('aria-keyshortcuts'),
    ).toBe('+');
  });

  it('moves by the arrow keys, zooms by + and −, and fits by 0, from the card', () => {
    page();
    const region = viewport();
    const start = view();
    fireEvent.keyDown(region, { key: 'ArrowRight' });
    expect(view().x).toBeCloseTo(start.x - PAN_STEP, 6);
    fireEvent.keyDown(region, { key: 'ArrowDown' });
    expect(view().y).toBeCloseTo(start.y - PAN_STEP, 6);
    fireEvent.keyDown(region, { key: 'ArrowLeft' });
    expect(view().x).toBeCloseTo(start.x, 6);
    fireEvent.keyDown(region, { key: '+' });
    expect(view().scale).toBeCloseTo(ZOOM.step, 6);
    fireEvent.keyDown(region, { key: '-' });
    expect(view().scale).toBeCloseTo(1, 6);
    fireEvent.keyDown(region, { key: '0' });
    expect(view().scale).toBeCloseTo(fitView(WORLD, CARD, EDGE).scale, 6);
  });

  it('leaves the keys alone on a part’s own buttons and fields', () => {
    page();
    const before = view();
    const edit = screen.getByRole('button', { name: t.editing('Grade 11') });
    fireEvent.keyDown(edit, { key: 'ArrowRight' });
    fireEvent.keyDown(edit, { key: '0' });
    expect(view()).toEqual(before);
  });

  it('pans by a drag, and a drag never opens the part it started on; a tap still does', () => {
    page();
    const before = view();
    const edit = screen.getByRole('button', { name: t.editing('Grade 11') });
    const at = (x: number, y: number) => ({
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      clientX: x,
      clientY: y,
    });
    fireEvent.pointerDown(edit, at(100, 100));
    fireEvent.pointerMove(edit, at(70, 90));
    fireEvent.pointerMove(edit, at(40, 70));
    fireEvent.pointerUp(edit, at(40, 70));
    fireEvent.click(edit);
    expect(screen.queryByRole('group', { name: t.statusLegend })).toBeNull();
    expect(view().x).toBeCloseTo(before.x - 60, 6);
    expect(view().y).toBeCloseTo(before.y - 30, 6);

    // A tap: down and up in one place.
    fireEvent.pointerDown(edit, at(40, 70));
    fireEvent.pointerUp(edit, at(41, 70));
    fireEvent.click(edit);
    expect(screen.getByRole('group', { name: t.statusLegend })).toBeTruthy();
  });

  it('zooms toward the pointer with Ctrl and the wheel, and pans with the wheel alone', () => {
    page();
    const region = viewport();
    const before = view();
    fireEvent.wheel(region, { deltaX: 30, deltaY: 50, deltaMode: 0 });
    expect(view().x).toBeCloseTo(before.x - 30, 6);
    expect(view().y).toBeCloseTo(before.y - 50, 6);
    fireEvent.wheel(region, { deltaY: -100, deltaMode: 0, ctrlKey: true, clientX: 0, clientY: 0 });
    expect(view().scale).toBeGreaterThan(1);
  });
});

describe('the full-screen canvas', () => {
  it('opens in a dialog with focus inside; Esc closes it and focus goes back to Open', () => {
    page();
    const open = screen.getByRole('button', { name: c.open });
    fireEvent.click(open);
    const dialog = screen.getByRole('dialog');
    expect(dialog.hasAttribute('open')).toBe(true);
    const inside = within(dialog).getByRole('region', { name: c.label });
    expect(document.activeElement).toBe(inside);
    // The map moved into the dialog: still one copy of each part, and the page says where it is.
    expect(screen.getAllByText('Grade 11', { selector: 'h3, h3 *' })).toHaveLength(1);
    expect(screen.getByText(c.openNow)).toBeTruthy();

    fireEvent.keyDown(inside, { key: 'Escape' });
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: c.open }));
  });

  it('closes with its Close button too, focus back on Open', () => {
    page();
    fireEvent.click(screen.getByRole('button', { name: c.open }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: c.close }));
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: c.open }));
  });

  it('gives focus back to Open only once the page is no longer inert (a real modal dialog)', () => {
    // jsdom has no modal dialogs: these stand in for the browser's. While one is open, nothing
    // outside it can take focus.
    const modal = { open: null as HTMLDialogElement | null };
    vi.stubGlobal('HTMLDialogElement', HTMLDialogElement);
    Object.assign(HTMLDialogElement.prototype, {
      showModal(this: HTMLDialogElement) {
        this.setAttribute('open', '');
        modal.open = this;
      },
      close(this: HTMLDialogElement) {
        this.removeAttribute('open');
        modal.open = null;
      },
    });
    const focus = HTMLElement.prototype.focus;
    vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (this: HTMLElement) {
      if (modal.open && !modal.open.contains(this)) return;
      focus.call(this);
    });
    try {
      page();
      fireEvent.click(screen.getByRole('button', { name: c.open }));
      expect(modal.open).not.toBeNull();
      fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
      expect(modal.open).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: c.open }));
    } finally {
      Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
      Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
    }
  });

  it('opens on the same first view as the card, measured once the dialog has a size', () => {
    page();
    const card = view();
    fireEvent.click(screen.getByRole('button', { name: c.open }));
    expect(view()).toEqual(card);
  });

  it('keeps editing working inside it', () => {
    page();
    fireEvent.click(screen.getByRole('button', { name: c.open }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: t.editing('Grade 11') }));
    expect(within(dialog).getByRole('group', { name: t.statusLegend })).toBeTruthy();
  });
});

describe('motion', () => {
  it('glides over frames when motion is welcome', () => {
    motion(false);
    page();
    const start = view();
    fireEvent.keyDown(viewport(), { key: 'ArrowRight' });
    expect(view().x).toBeCloseTo(start.x, 6);
    expect(frames.length).toBeGreaterThan(0);
    runFrames();
    expect(view().x).toBeCloseTo(start.x - PAN_STEP, 6);
  });

  it('under reduced motion every pan and zoom jumps, and nothing coasts after a flick', () => {
    page();
    const start = view();
    fireEvent.keyDown(viewport(), { key: 'ArrowRight' });
    expect(view().x).toBeCloseTo(start.x - PAN_STEP, 6);
    const at = (x: number, t: number) => ({
      pointerId: 2,
      pointerType: 'touch',
      isPrimary: true,
      button: 0,
      clientX: x,
      clientY: 100,
      timeStamp: t,
    });
    const region = viewport();
    fireEvent.pointerDown(region, at(200, 0));
    fireEvent.pointerMove(region, at(150, 10));
    fireEvent.pointerMove(region, at(100, 20));
    fireEvent.pointerUp(region, at(100, 20));
    const released = view();
    runFrames();
    expect(view()).toEqual(released);
  });
});

describe('cards the learner moves (RT-08)', () => {
  const at = (x: number, y: number, type = 'mouse', id = 1) => ({
    pointerId: id,
    pointerType: type,
    isPrimary: true,
    button: 0,
    clientX: x,
    clientY: y,
  });
  const cardOf = (heading: string) =>
    screen.getByRole('heading', { name: heading }).closest('li') as HTMLElement;
  // Cards are placed in rem, so the picture scales with the learner's font size.
  const placeOf = (li: HTMLElement) => ({
    x: Math.round(Number.parseFloat(li.style.left) * 16),
    y: Math.round(Number.parseFloat(li.style.top) * 16),
  });

  it('a mouse drag on a card moves it, not the map, and saves where it lands, on the grid', async () => {
    const fetch = vi.fn(async () => Response.json({ map: mapOf() }));
    vi.stubGlobal('fetch', fetch);
    page();
    const li = cardOf('Grade 11');
    const was = placeOf(li);
    const before = view();
    const grip = screen.getByRole('heading', { name: 'Grade 11' });
    fireEvent.pointerDown(grip, at(300, 300));
    fireEvent.pointerMove(grip, at(330, 320));
    runFrames();
    expect(li.hasAttribute('data-lifted')).toBe(true);
    fireEvent.pointerMove(grip, at(400, 350));
    runFrames();
    fireEvent.pointerUp(grip, at(400, 350));
    // The map itself did not pan.
    expect(view()).toEqual(before);
    expect(li.hasAttribute('data-lifted')).toBe(false);
    const now = placeOf(li);
    expect(now).not.toEqual(was);
    expect(now.x % MAP_GRID).toBe(0);
    expect(now.y % MAP_GRID).toBe(0);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/me\/plan-maps\/[^/]+\/layout$/);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(String(init.body))).toEqual({
      places: [{ nodeId: expect.any(String), x: now.x, y: now.y }],
    });
    expect(screen.getByRole('status').textContent).toBe(t.arrange.placed('Grade 11'));
  });

  it('a finger held still on a card lifts it; a finger that moves at once pans the map', () => {
    vi.useFakeTimers();
    try {
      const fetch = vi.fn(async () => Response.json({ map: mapOf() }));
      vi.stubGlobal('fetch', fetch);
      page();
      const li = cardOf('Grade 11');
      const grip = screen.getByRole('heading', { name: 'Grade 11' });
      const before = view();
      // Moves at once: a pan.
      fireEvent.pointerDown(grip, at(200, 200, 'touch', 7));
      fireEvent.pointerMove(grip, at(150, 190, 'touch', 7));
      fireEvent.pointerUp(grip, at(150, 190, 'touch', 7));
      expect(li.hasAttribute('data-lifted')).toBe(false);
      expect(view().x).toBeCloseTo(before.x - 50, 6);
      // Held still past the hold time: the card lifts and follows.
      fireEvent.pointerDown(grip, at(200, 200, 'touch', 8));
      vi.advanceTimersByTime(LIFT_HOLD_MS + 1);
      expect(li.hasAttribute('data-lifted')).toBe(true);
      const panned = view();
      fireEvent.pointerMove(grip, at(260, 230, 'touch', 8));
      runFrames();
      fireEvent.pointerUp(grip, at(260, 230, 'touch', 8));
      expect(view()).toEqual(panned);
      expect(li.hasAttribute('data-lifted')).toBe(false);
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('Escape during a drag puts the card back and saves nothing', () => {
    const fetch = vi.fn(async () => Response.json({ map: mapOf() }));
    vi.stubGlobal('fetch', fetch);
    page();
    const li = cardOf('Grade 11');
    const was = placeOf(li);
    const grip = screen.getByRole('heading', { name: 'Grade 11' });
    fireEvent.pointerDown(grip, at(300, 300));
    fireEvent.pointerMove(grip, at(400, 350));
    runFrames();
    expect(li.hasAttribute('data-lifted')).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(li.hasAttribute('data-lifted')).toBe(false);
    expect(placeOf(li)).toEqual(was);
    fireEvent.pointerUp(grip, at(400, 350));
    expect(fetch).not.toHaveBeenCalled();
  });

  const lineOf = (index: number) =>
    document.querySelector(`[data-link="${index}"] [data-part="line"]`)?.getAttribute('d');

  // MAPS-13: the branch followed the pointer; put back, it goes back with the card.
  it('after Escape mid-drag, the card’s branch is drawn where it was before the drag', () => {
    page();
    const before = lineOf(1);
    expect(before).toBeTruthy();
    const grip = screen.getByRole('heading', { name: 'Grade 11' });
    fireEvent.pointerDown(grip, at(300, 300));
    fireEvent.pointerMove(grip, at(420, 380));
    runFrames();
    expect(lineOf(1)).not.toBe(before);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(lineOf(1)).toBe(before);
    fireEvent.pointerUp(grip, at(420, 380));
    expect(lineOf(1)).toBe(before);
  });

  // MAPS-12: the card never shows at its start between letting go and its new place.
  it('on a drop the card goes straight to its new place, never back to its start first', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ map: mapOf() })),
    );
    page();
    const li = cardOf('Grade 11');
    const start = li.style.left;
    const grip = screen.getByRole('heading', { name: 'Grade 11' });
    const seen = new MutationObserver(() => {});
    seen.observe(li, { attributes: true, attributeFilter: ['style'], attributeOldValue: true });
    fireEvent.pointerDown(grip, at(300, 300));
    fireEvent.pointerMove(grip, at(400, 350));
    runFrames();
    fireEvent.pointerUp(grip, at(400, 350));
    const states = [
      ...seen.takeRecords().map((r) => r.oldValue ?? ''),
      li.getAttribute('style') ?? '',
    ];
    seen.disconnect();
    const lifted = states.findIndex((s) => s.includes('translate('));
    expect(lifted).toBeGreaterThan(-1);
    const backAtStart = states
      .slice(lifted)
      .filter((s) => !s.includes('translate(') && s.includes(`left: ${start}`));
    expect(backAtStart).toEqual([]);
    expect(li.style.left).not.toBe(start);
    expect(li.style.transform).toBe('');
  });

  // MAPS-23: Chrome on Android takes the pointer back (pointercancel) after its long-press menu.
  it('a lifted card the browser takes the pointer from goes back, unsaved; its menu stays shut', () => {
    const fetch = vi.fn(async () => Response.json({ map: mapOf() }));
    vi.stubGlobal('fetch', fetch);
    page();
    const li = cardOf('Grade 11');
    const was = placeOf(li);
    const grip = screen.getByRole('heading', { name: 'Grade 11' });
    fireEvent.pointerDown(grip, at(300, 300));
    fireEvent.pointerMove(grip, at(400, 350));
    runFrames();
    const menu = new Event('contextmenu', { bubbles: true, cancelable: true });
    grip.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
    fireEvent.pointerCancel(grip, at(400, 350));
    expect(li.hasAttribute('data-lifted')).toBe(false);
    expect(placeOf(li)).toEqual(was);
    expect(fetch).not.toHaveBeenCalled();
    // Not lifted, the browser's menu is the learner's again.
    const later = new Event('contextmenu', { bubbles: true, cancelable: true });
    grip.dispatchEvent(later);
    expect(later.defaultPrevented).toBe(false);
  });

  // MAPS-16: a finger held, then let go without moving, put nothing anywhere.
  it('a long press let go without moving puts the card back and saves nothing', () => {
    vi.useFakeTimers();
    try {
      const fetch = vi.fn(async () => Response.json({ map: mapOf() }));
      vi.stubGlobal('fetch', fetch);
      page();
      const li = cardOf('Grade 11');
      const was = placeOf(li);
      const grip = screen.getByRole('heading', { name: 'Grade 11' });
      fireEvent.pointerDown(grip, at(200, 200, 'touch', 9));
      vi.advanceTimersByTime(LIFT_HOLD_MS + 1);
      expect(li.hasAttribute('data-lifted')).toBe(true);
      fireEvent.pointerUp(grip, at(201, 200, 'touch', 9));
      expect(li.hasAttribute('data-lifted')).toBe(false);
      expect(placeOf(li)).toEqual(was);
      vi.advanceTimersByTime(1000);
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('the mini-map sits outside the map’s window, so it never covers a card; it can be hidden', () => {
    page();
    const mini = document.querySelector('.uf-minimap') as SVGElement;
    expect(mini).not.toBeNull();
    expect(mini.closest('.uf-canvas-viewport')).toBeNull();
    expect(mini.getAttribute('aria-hidden')).toBe('true');
    // It draws every card and the middle from the layout, not from measuring.
    expect(mini.querySelectorAll('.uf-minimap-part')).toHaveLength(7);
    fireEvent.click(screen.getByRole('button', { name: t.arrange.hideMiniMap }));
    expect(document.querySelector('.uf-minimap')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: t.arrange.showMiniMap }));
    expect(document.querySelector('.uf-minimap')).not.toBeNull();
  });

  it('Reset layout puts every card back with one request, and is off while nothing has moved', async () => {
    const fetch = vi.fn(async () => Response.json({ map: mapOf() }));
    vi.stubGlobal('fetch', fetch);
    page();
    const reset = screen.getByRole('button', { name: t.arrange.resetLayout });
    expect(reset.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(reset);
    expect(fetch).not.toHaveBeenCalled();
    const grip = screen.getByRole('heading', { name: 'Grade 11' });
    fireEvent.pointerDown(grip, at(300, 300));
    fireEvent.pointerMove(grip, at(400, 350));
    runFrames();
    fireEvent.pointerUp(grip, at(400, 350));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(reset.getAttribute('aria-disabled')).toBe('false'));
    fireEvent.click(reset);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const [url, init] = fetch.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/layout$/);
    expect(init.method).toBe('DELETE');
    expect(await screen.findByText(t.arrange.resetDone)).toBeTruthy();
  });
});

describe('Reset layout can be undone (MAPS-22)', () => {
  it('offers Undo for ten seconds, which puts every moved card back with one request', async () => {
    const map = mapOf();
    const moved = map.nodes.find((n) => n.slotId === 'slot:grade-11') as (typeof map.nodes)[number];
    const placed = {
      ...map,
      nodes: map.nodes.map((n) => (n.id === moved.id ? { ...n, place: { x: 1200, y: 1416 } } : n)),
    };
    const fetch = vi.fn(async () => Response.json({ map: mapOf() }));
    vi.stubGlobal('fetch', fetch);
    render(
      <PlanMapPage
        map={placed}
        copy={copy}
        template={templateCopy(map.templateId)}
        justCreated={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: t.arrange.resetLayout }));
    const undo = await screen.findByRole('button', { name: t.arrange.undoReset });
    expect(fetch).toHaveBeenCalledTimes(1);
    fireEvent.click(undo);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const [url, init] = fetch.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/layout$/);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(String(init.body))).toEqual({
      places: [{ nodeId: moved.id, x: 1200, y: 1416 }],
    });
    await screen.findByText(t.arrange.undoneReset);
    const li = screen.getByRole('heading', { name: 'Grade 11' }).closest('li') as HTMLElement;
    expect(Number.parseFloat(li.style.left) * 16).toBe(1200);
    expect(screen.queryByRole('button', { name: t.arrange.undoReset })).toBeNull();
  });

  it('the Undo goes after ten seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const map = mapOf();
      const placed = {
        ...map,
        nodes: map.nodes.map((n) =>
          n.slotId === 'slot:grade-11' ? { ...n, place: { x: 1200, y: 1416 } } : n,
        ),
      };
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json({ map: mapOf() })),
      );
      render(
        <PlanMapPage
          map={placed}
          copy={copy}
          template={templateCopy(map.templateId)}
          justCreated={false}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: t.arrange.resetLayout }));
      await screen.findByRole('button', { name: t.arrange.undoReset });
      await vi.advanceTimersByTimeAsync(10_001);
      expect(screen.queryByRole('button', { name: t.arrange.undoReset })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the first view before the page is live (A4-21: no layout shift when it enhances)', () => {
  it('the server sends a script that places the map exactly where the live canvas will', () => {
    page();
    const script = document.querySelector('script[data-canvas-place]') as HTMLScriptElement;
    expect(script).not.toBeNull();
    expect(script.getAttribute('nonce')).toBe('synthetic-nonce');
    const live = view();
    const port = viewport();
    const root = port.closest('.uf-canvas') as HTMLElement;
    // Undo what the live canvas did, then run the script as the browser would, before hydration.
    for (const name of ['--uf-canvas-x', '--uf-canvas-y', '--uf-canvas-scale']) {
      port.style.removeProperty(name);
    }
    root.removeAttribute('data-enhanced');
    root.removeAttribute('data-placed');
    new Function(script.textContent ?? '')();
    expect(root.hasAttribute('data-placed')).toBe(true);
    expect(root.hasAttribute('data-enhanced')).toBe(false);
    const placed = view();
    expect(placed.x).toBeCloseTo(live.x, 6);
    expect(placed.y).toBeCloseTo(live.y, 6);
    expect(placed.scale).toBeCloseTo(live.scale, 6);
  });
});

describe('the canvas’s CSS', () => {
  const CSS = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');
  const START = '/* maps: the plan map on a canvas card';
  const END = '/* end maps */';
  const block = CSS.slice(CSS.indexOf(START), CSS.indexOf(END));

  it('has its own block: the page never scrolls under a pan, and the dialog locks the page', () => {
    expect(CSS.indexOf(START)).toBeGreaterThan(-1);
    expect(CSS.indexOf(END)).toBeGreaterThan(CSS.indexOf(START));
    expect(block).toMatch(/touch-action:\s*none/);
    expect(block).toMatch(/overscroll-behavior:\s*contain/);
    expect(block).toMatch(/:root:has\(\.uf-canvas-dialog\[open\]\)\s*\{[^}]*overflow:\s*hidden/);
  });

  it('takes its sizes and times from the tokens, with a reduced-motion and a forced-colours path', () => {
    expect(block).toContain('var(--uf-canvas-height)');
    expect(block).toContain('var(--uf-canvas-grid)');
    expect(block).toContain('var(--uf-duration-journey)');
    const raw = [...block.matchAll(/(?:transition|animation)(?:-duration|-delay)?\s*:\s*([^;]+);/g)]
      .map((m) => (m[1] ?? '').trim())
      .filter((v) => v !== 'none')
      .filter((v) => /\d(?:ms|s)\b/.test(v) || !/var\(--uf-duration-/.test(v));
    expect(raw).toEqual([]);
    expect(block).toContain('@media (prefers-reduced-motion: reduce)');
    expect(block).toContain('@media (forced-colors: active)');
  });

  it('places the map the same way before the page is live (data-placed) as live (A4-21), and docks the mini-map outside the window', () => {
    // The picture's size comes from its layout (no fixed widths any more), and the server's script
    // puts the world where the live canvas will: the same scaled, absolutely placed world.
    expect(block).not.toMatch(/uf-canvas-world--/);
    expect(block).toMatch(
      /\.uf-canvas\[data-enhanced\] \.uf-canvas-world,\s*\.uf-canvas\[data-placed\] \.uf-canvas-world\s*\{[^}]*position:\s*absolute/,
    );
    // The mini-map lives in the foot under the window, not positioned over it.
    expect(block).toMatch(/\.uf-canvas-foot\s*\{/);
    expect(block).not.toMatch(/\.uf-minimap\s*\{[^}]*position:\s*absolute/);
    // Every branch's draw-in is stilled under reduced motion.
    const reduced = block.slice(block.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toMatch(/\.uf-map-link[^{]*\{[^}]*animation:\s*none/);
  });
});
