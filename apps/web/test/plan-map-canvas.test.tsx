// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { en } from '@universityflow/content';
import { tokens } from '@universityflow/tokens';
import { type PlanMapView, templateSeed } from '@universityflow/ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EDGE, fitView, PAN_STEP, ZOOM } from '../app/(app)/goals/maps/[id]/canvas-math';
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
    expect(hint?.textContent).toBe(c.keys);
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

  it('lays each picture out at its own width inside the card, from a 360px phone up', () => {
    for (const [layout, width] of [
      ['ring', 'world-ring'],
      ['cloud', 'world-ring'],
      ['stairs', 'world-wide'],
      ['branches', 'world-wide'],
      ['road', 'world-road'],
    ] as const) {
      expect(block).toMatch(
        new RegExp(
          `\\.uf-canvas-world--${layout}[^{]*\\{[^}]*width:\\s*var\\(--uf-canvas-${width}\\)`,
        ),
      );
    }
    expect(Number.parseFloat(tokens.canvas.worldWide)).toBeGreaterThanOrEqual(64);
  });
});
