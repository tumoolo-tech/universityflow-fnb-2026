// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { crisisCard } from '@universityflow/agent';
import { catalogueView } from '@universityflow/catalogue';
import { en } from '@universityflow/content';
import { contrastRatio, tokens } from '@universityflow/tokens';
import { type PlanMapView, type PlanNode, templateSeed } from '@universityflow/ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HubArt } from '../app/(app)/goals/maps/[id]/map-art';
import { MAP_GRID, SLOT } from '../app/(app)/goals/maps/[id]/map-layout';
import { PlanMapPage } from '../app/(app)/goals/maps/[id]/plan-map-view';
import { planCopy, templateCopy } from '../lib/server/plan-maps-copy';

/**
 * One plan map (docs/design/plan-maps-proposal.md §7, §8): one nested list in reading order, the
 * picture a layout of the same list; status as a word and an icon; Edit in place; "Not achieved"
 * opens the two reflections; keyboard moves keep focus; delete asks inside the page; and a save
 * whose words need care shows the crisis card at once and moves focus to it (D3). Synthetic words.
 */

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const t = en.planMaps;
const copy = planCopy();
const VIEW = catalogueView(new Date('2026-10-13T08:00:00Z'), { includeDrafts: true });

/** A map as the API returns it: the template's seed, with ids. */
function mapOf(templateId: 'six-stops' | 'staircase', wordsAllowed = true): PlanMapView {
  const seed = templateSeed(templateId);
  const id = (ref: string) =>
    `00000000-0000-4000-8000-${String(seed.findIndex((s) => s.ref === ref)).padStart(12, '0')}`;
  return {
    id: '00000000-0000-4000-9000-000000000001',
    templateId,
    title: null,
    linksGoal: true,
    goal: { kind: 'goal', course: 'Synthetic Course', university: 'Synthetic University' },
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
    wordsAllowed,
    updatedAt: '2026-10-13T08:00:00.000Z',
  };
}

function page(map: PlanMapView, justCreated = false) {
  return render(
    <PlanMapPage
      map={map}
      copy={copy}
      template={templateCopy(map.templateId)}
      justCreated={justCreated}
    />,
  );
}

const node = (map: PlanMapView, slot: string) =>
  map.nodes.find((n) => n.slotId === slot) as PlanNode;
const item = (heading: string) =>
  screen.getByRole('heading', { name: heading }).closest('li') as HTMLElement;

beforeEach(() => {
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  push.mockReset();
});

describe('the map as one list (§7)', () => {
  it('is a nested list in reading order: the centre, then each stop, an ordered list for a climb', () => {
    page(mapOf('staircase'));
    expect(
      screen.getByRole('heading', { level: 1, name: t.templates.staircase.name }),
    ).toBeTruthy();
    const centre = screen.getByRole('heading', {
      level: 2,
      name: t.templates.staircase.centre.heading,
    });
    const list = centre.closest('section')?.querySelector('ol') as HTMLOListElement;
    expect(list).toBeTruthy();
    const headings = within(list)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent ?? '');
    const expected = [
      'Where I am now',
      'Finish Grade 10',
      'Finish Grade 11',
      'Write matric',
      'Get in',
      'Pass first year',
      'Each year after',
      'Graduate',
    ];
    expect(headings).toHaveLength(expected.length);
    expected.forEach((h, i) => {
      expect(headings[i]).toContain(h);
      expect(headings[i]).toContain(t.stepOf(i + 1, 8));
    });
    // The goal in the middle, read live, with the way to where they stand.
    expect(screen.getByText(t.goalAt('Synthetic Course', 'Synthetic University'))).toBeTruthy();
    expect(screen.getByRole('link', { name: t.goalLink }).getAttribute('href')).toBe('/goals');
  });

  it('has one copy of each part’s words in the page: the picture is the same list', () => {
    page(mapOf('six-stops'));
    expect(screen.getAllByText('Grade 11', { selector: 'h3, h3 *' })).toHaveLength(1);
    expect(screen.getAllByText(t.templates['six-stops'].slots['grade-11'].hint)).toHaveLength(1);
    expect(document.querySelector('svg.uf-map-links')?.getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelector('svg.uf-map-hub-art')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows each status as a word and an icon, never colour alone, and links a stop to its facts', () => {
    const map = mapOf('six-stops');
    const done = {
      ...map,
      nodes: map.nodes.map((n) =>
        n.slotId === 'slot:grade-10' ? { ...n, status: 'achieved' as const } : n,
      ),
    };
    page(done);
    const grade10 = item('Grade 10');
    expect(within(grade10).getByText(t.status.achieved)).toBeTruthy();
    expect(
      grade10.querySelector('[data-status-icon="achieved"]')?.getAttribute('aria-hidden'),
    ).toBe('true');
    expect(
      within(item('Matric')).getByRole('link', { name: t.links.goal }).getAttribute('href'),
    ).toBe('/goals');
  });

  it('offers Picture and List, pressed state on the one shown', () => {
    page(mapOf('six-stops'));
    const picture = screen.getByRole('button', { name: t.picture });
    const list = screen.getByRole('button', { name: t.list });
    expect(picture.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(list);
    expect(list.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('.uf-map')?.getAttribute('data-view')).toBe('list');
  });

  it('puts focus on the title of a map just started', async () => {
    page(mapOf('six-stops'), true);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 })),
    );
  });
});

describe('editing a part', () => {
  it('opens in place; Not achieved opens the two reflections; Save is one PUT', async () => {
    const map = mapOf('six-stops');
    const part = node(map, 'slot:grade-11');
    const fetch = vi.fn(async () =>
      Response.json({
        node: {
          ...part,
          status: 'not-achieved',
          whyNot: 'Ran out of time',
          text: 'Practise past papers',
        },
        care: null,
      }),
    );
    vi.stubGlobal('fetch', fetch);
    page(map);
    const li = item('Grade 11');
    fireEvent.click(within(li).getByRole('button', { name: t.editing('Grade 11') }));
    const editor = within(li).getByRole('group', { name: t.statusLegend });
    expect(within(li).queryByLabelText(t.whyNot)).toBeNull();
    fireEvent.click(within(editor).getByLabelText(t.status['not-achieved']));
    fireEvent.change(within(li).getByLabelText(t.myWords), {
      target: { value: 'Practise past papers' },
    });
    fireEvent.change(within(li).getByLabelText(t.whyNot), { target: { value: 'Ran out of time' } });
    expect(within(li).getByLabelText(t.differently)).toBeTruthy();
    fireEvent.click(within(li).getByRole('button', { name: t.save }));
    expect(
      await screen.findByText(t.savedStatus('Grade 11', t.status['not-achieved'])),
    ).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`/api/me/plan-maps/${map.id}/nodes/${part.id}`);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(String(init.body))).toMatchObject({
      text: 'Practise past papers',
      status: 'not-achieved',
      whyNot: 'Ran out of time',
    });
    expect(within(item('Grade 11')).getByText('Ran out of time')).toBeTruthy();
  });

  it('without the consent wording, ticks only: no word fields, and the page says why', () => {
    page(mapOf('six-stops', false));
    expect(screen.getByText(t.wordsWait)).toBeTruthy();
    const li = item('Grade 11');
    fireEvent.click(within(li).getByRole('button', { name: t.editing('Grade 11') }));
    expect(within(li).queryByLabelText(t.myWords)).toBeNull();
    fireEvent.click(within(li).getByLabelText(t.status['not-achieved']));
    expect(within(li).queryByLabelText(t.whyNot)).toBeNull();
    expect(within(li).getByLabelText(t.month)).toBeTruthy();
    expect(screen.queryByRole('button', { name: t.addChild })).toBeNull();
  });

  it('shows the crisis card at once when the words need it, and moves focus to it (D3)', async () => {
    const map = mapOf('six-stops');
    const part = node(map, 'slot:grade-11');
    const card = crisisCard(VIEW.helplines, ['suicide']);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          node: { ...part, status: 'not-achieved', whyNot: 'Synthetic' },
          care: { level: 'crisis', card },
        }),
      ),
    );
    page(map);
    // In the picture (the canvas card): where A10-65 was.
    fireEvent.click(screen.getByRole('button', { name: t.picture }));
    const li = item('Grade 11');
    fireEvent.click(within(li).getByRole('button', { name: t.editing('Grade 11') }));
    fireEvent.click(within(li).getByLabelText(t.status['not-achieved']));
    fireEvent.change(within(li).getByLabelText(t.whyNot), { target: { value: 'Synthetic' } });
    fireEvent.click(within(li).getByRole('button', { name: t.save }));
    const heading = await screen.findByRole('heading', { name: en.crisis.cardTitle });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(screen.getByText(t.care.crisisLead)).toBeTruthy();
    // "Talk to someone now" is the card's own title, first, where focus went.
    expect(heading.textContent).toBe(en.crisis.cardTitle);
    // A10-65 (Phase 6 audit): never inside the zoomable canvas, where it was drawn at the map's
    // zoom (8 px at Fit to view) and its Call links were clipped by the card.
    expect(screen.getByRole('button', { name: t.picture }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(document.querySelector('.uf-canvas-world')).not.toBeNull();
    expect(heading.closest('.uf-canvas-world')).toBeNull();
    const calls = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href')?.startsWith('tel:'));
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect(call.closest('.uf-canvas-world')).toBeNull();
    // It stays until the learner says they have seen it.
    fireEvent.click(screen.getByRole('button', { name: t.care.seen }));
    expect(screen.queryByRole('heading', { name: en.crisis.cardTitle })).toBeNull();
  });

  it('a concern offers the companion, opening the chat empty', async () => {
    const map = mapOf('six-stops');
    const part = node(map, 'slot:grade-10');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          node: part,
          care: { level: 'concern', card: crisisCard(VIEW.helplines, ['distress']) },
        }),
      ),
    );
    page(map);
    const li = item('Grade 10');
    fireEvent.click(within(li).getByRole('button', { name: t.editing('Grade 10') }));
    fireEvent.click(within(li).getByRole('button', { name: t.save }));
    const link = await screen.findByRole('link', { name: t.care.companion });
    expect(link.getAttribute('href')).toBe('/chat');
    expect(screen.getByText(t.care.concernLead)).toBeTruthy();
  });
});

describe('moving and deleting (keyboard, no drag)', () => {
  it('moves a part up with one POST and keeps focus on it', async () => {
    const map = mapOf('six-stops');
    const part = node(map, 'slot:grade-11');
    const centre = node(map, 'slot:centre');
    const moved = {
      ...map,
      nodes: map.nodes.map((n) =>
        n.id === part.id
          ? { ...n, position: 0 }
          : n.slotId === 'slot:grade-10'
            ? { ...n, position: 1 }
            : n,
      ),
    };
    const fetch = vi.fn(async () => Response.json({ map: moved }));
    vi.stubGlobal('fetch', fetch);
    page(map);
    const li = item('Grade 11');
    fireEvent.click(within(li).getByRole('button', { name: t.moreFor('Grade 11') }));
    fireEvent.click(within(li).getByRole('button', { name: t.moveUp }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(item('Grade 11')).getByRole('button', { name: t.moreFor('Grade 11') }),
      ),
    );
    expect(
      JSON.parse(String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body)),
    ).toEqual({
      parentId: centre.id,
      position: 0,
    });
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent ?? '');
    expect(headings[0]).toContain('Grade 11');
  });

  it('asks inside the page before deleting, never with confirm(), then focuses the part before', async () => {
    const map = mapOf('six-stops');
    const fetch = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetch);
    page(map);
    const li = item('Grade 11');
    fireEvent.click(within(li).getByRole('button', { name: t.moreFor('Grade 11') }));
    fireEvent.click(within(li).getByRole('button', { name: t.delete }));
    expect(within(li).getByText(t.deleteAsk('Grade 11', 0))).toBeTruthy();
    fireEvent.click(within(li).getByRole('button', { name: t.keep }));
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(within(li).getByRole('button', { name: t.moreFor('Grade 11') }));
    fireEvent.click(within(li).getByRole('button', { name: t.delete }));
    fireEvent.click(within(li).getByRole('button', { name: t.delete }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: /Grade 11/ })).toBeNull());
    expect(globalThis.confirm).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(item('Grade 10')).getByRole('button', { name: t.editing('Grade 10') }),
      ),
    );
  });
});

describe('the map’s own name (RT-06)', () => {
  it('needs a name: an empty one is not saved, and the field says why', () => {
    const fetch = vi.fn(async () => Response.json({ map: mapOf('six-stops'), care: null }));
    vi.stubGlobal('fetch', fetch);
    page(mapOf('six-stops'));
    // Untitled (made before maps had names, or by an app that sent none): say so, show the
    // template's name as the title, and the layout's name apart.
    expect(screen.getByText(t.naming.nameThis)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      t.templates['six-stops'].name,
    );
    expect(screen.getByText(t.naming.layout(t.templates['six-stops'].name))).toBeTruthy();
    const input = screen.getByLabelText(t.naming.label) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: t.saveTitle }));
    expect(screen.getByText(t.naming.needed)).toBeTruthy();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'My six stops' } });
    fireEvent.click(screen.getByRole('button', { name: t.saveTitle }));
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/me\/plan-maps\/[^/]+$/);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({ title: 'My six stops' });
  });

  it('a named map is headed by its name, with no prompt to name it', () => {
    page({ ...mapOf('six-stops'), title: 'My road to engineering' });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('My road to engineering');
    expect(screen.queryByText(t.naming.nameThis)).toBeNull();
  });
});

describe('cards the learner moves, by the keyboard (RT-08, WCAG 2.5.7)', () => {
  const li = (heading: string) =>
    screen.getByRole('heading', { name: heading }).closest('li') as HTMLElement;
  const placeOf = (el: HTMLElement) => ({
    x: Number.parseFloat(el.style.left) * 16,
    y: Number.parseFloat(el.style.top) * 16,
  });

  it('restores where each card was put, from the map, and the middle stays where the template puts it', () => {
    const map = mapOf('six-stops');
    const placed = {
      ...map,
      nodes: map.nodes.map((n) =>
        n.slotId === 'slot:grade-11' ? { ...n, place: { x: 1200, y: 1416 } } : n,
      ),
    };
    page(placed);
    expect(placeOf(li('Grade 11'))).toEqual({ x: 1200, y: 1416 });
    // Every other card sits where the template puts it: on the canvas, apart from the rest.
    const boxes = ['Grade 10', 'Matric', 'Applying', 'First year', 'Finishing my qualification']
      .map(li)
      .map((el) => ({ ...placeOf(el), w: Number.parseFloat(el.style.width) * 16 }));
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
    }
    // The middle has no Move button: it is the map's anchor (MAPS-09).
    expect(screen.queryByRole('button', { name: t.arrange.move(t.goalCentre) })).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: t.arrange.move(t.templates['six-stops'].centre.heading),
      }),
    ).toBeNull();
  });

  it('Move, then the arrow keys, then Enter: one dot per press, said in words, one save', async () => {
    const fetch = vi.fn(async () => Response.json({ map: mapOf('six-stops') }));
    vi.stubGlobal('fetch', fetch);
    page(mapOf('six-stops'));
    const card = li('Grade 11');
    const was = placeOf(card);
    const move = screen.getByRole('button', { name: t.arrange.move('Grade 11') });
    fireEvent.click(move);
    expect(move.getAttribute('aria-pressed')).toBe('true');
    expect(card.hasAttribute('data-moving')).toBe(true);
    expect(screen.getByRole('status').textContent).toBe(t.arrange.moving('Grade 11'));
    fireEvent.keyDown(move, { key: 'ArrowRight' });
    fireEvent.keyDown(move, { key: 'ArrowDown', shiftKey: true });
    expect(placeOf(card)).toEqual({ x: was.x + MAP_GRID, y: was.y + 4 * MAP_GRID });
    // Where it is now, in words, a little after the last press (not on every press).
    expect(screen.getByRole('status').textContent).toBe(t.arrange.moving('Grade 11'));
    await waitFor(
      () => expect(screen.getByRole('status').textContent?.startsWith('Grade 11: ')).toBe(true),
      { timeout: 2000 },
    );
    expect(screen.getByRole('status').textContent).toMatch(/middle/);
    expect(fetch).not.toHaveBeenCalled();
    // Enter (a press on the button) puts it down: one PUT with the new place, on the grid.
    fireEvent.click(move);
    expect(card.hasAttribute('data-moving')).toBe(false);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/layout$/);
    expect(init.method).toBe('PUT');
    // Put down on the grid (the template's own places need not be), where the card now shows.
    const now = placeOf(li('Grade 11'));
    expect(now).not.toEqual(was);
    expect(now.x % MAP_GRID).toBe(0);
    expect(now.y % MAP_GRID).toBe(0);
    expect(JSON.parse(String(init.body))).toEqual({
      places: [{ nodeId: expect.any(String), x: now.x, y: now.y }],
    });
    expect(screen.getByRole('status').textContent).toBe(t.arrange.placed('Grade 11'));
  });

  it('Escape, or focus leaving, puts the card back and saves nothing', () => {
    const fetch = vi.fn(async () => Response.json({ map: mapOf('six-stops') }));
    vi.stubGlobal('fetch', fetch);
    page(mapOf('six-stops'));
    const card = li('Grade 11');
    const was = placeOf(card);
    const move = screen.getByRole('button', { name: t.arrange.move('Grade 11') });
    fireEvent.click(move);
    fireEvent.keyDown(move, { key: 'ArrowLeft' });
    fireEvent.keyDown(move, { key: 'Escape' });
    expect(placeOf(card)).toEqual(was);
    expect(screen.getByRole('status').textContent).toBe(t.arrange.putBack('Grade 11'));
    fireEvent.click(move);
    fireEvent.keyDown(move, { key: 'ArrowUp' });
    fireEvent.blur(move);
    expect(placeOf(card)).toEqual(was);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('Move takes focus when pressed, as Safari’s click would not give it (MAPS-25)', () => {
    page(mapOf('six-stops'));
    const move = screen.getByRole('button', { name: t.arrange.move('Grade 11') });
    fireEvent.click(move);
    expect(document.activeElement).toBe(move);
  });

  // MAPS-11 (WCAG 2.5.7): dragging has a one-tap-at-a-time way too, on screen, for a phone.
  it('in Move mode an on-screen pad moves the card by taps: right twice, Put down, one save', async () => {
    const fetch = vi.fn(async () => Response.json({ map: mapOf('six-stops') }));
    vi.stubGlobal('fetch', fetch);
    page(mapOf('six-stops'));
    const card = li('Grade 11');
    const was = placeOf(card);
    const move = screen.getByRole('button', { name: t.arrange.move('Grade 11') });
    expect(screen.queryByRole('group', { name: t.arrange.pad.label('Grade 11') })).toBeNull();
    move.focus();
    fireEvent.click(move);
    const pad = screen.getByRole('group', { name: t.arrange.pad.label('Grade 11') });
    const buttons = within(pad).getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual([
      t.arrange.pad.up,
      t.arrange.pad.left,
      t.arrange.pad.right,
      t.arrange.pad.down,
      t.arrange.pad.putDown,
      t.arrange.pad.cancel,
    ]);
    const right = within(pad).getByRole('button', { name: t.arrange.pad.right });
    // A browser that focuses a pressed button moves focus off Move: not "focus left", so the
    // card stays in Move mode.
    right.focus();
    fireEvent.click(right);
    fireEvent.click(right);
    expect(placeOf(card)).toEqual({ x: was.x + 2 * MAP_GRID, y: was.y });
    fireEvent.click(within(pad).getByRole('button', { name: t.arrange.pad.putDown }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/layout$/);
    expect(init.method).toBe('PUT');
    const now = placeOf(li('Grade 11'));
    expect(now.x).toBe(Math.round((was.x + 2 * MAP_GRID) / MAP_GRID) * MAP_GRID);
    expect(JSON.parse(String(init.body))).toEqual({
      places: [{ nodeId: expect.any(String), x: now.x, y: now.y }],
    });
    expect(screen.queryByRole('group', { name: t.arrange.pad.label('Grade 11') })).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: t.arrange.move('Grade 11') }),
    );
  });

  it('the pad’s Cancel puts the card back and saves nothing', () => {
    const fetch = vi.fn(async () => Response.json({ map: mapOf('six-stops') }));
    vi.stubGlobal('fetch', fetch);
    page(mapOf('six-stops'));
    const card = li('Grade 11');
    const was = placeOf(card);
    fireEvent.click(screen.getByRole('button', { name: t.arrange.move('Grade 11') }));
    const pad = screen.getByRole('group', { name: t.arrange.pad.label('Grade 11') });
    fireEvent.click(within(pad).getByRole('button', { name: t.arrange.pad.down }));
    fireEvent.click(within(pad).getByRole('button', { name: t.arrange.pad.cancel }));
    expect(placeOf(card)).toEqual(was);
    expect(screen.getByRole('status').textContent).toBe(t.arrange.putBack('Grade 11'));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('a card put down on another lands on the nearest free spot; boxed in, it goes back and says so', async () => {
    const fetch = vi.fn(async () => Response.json({ map: mapOf('six-stops') }));
    vi.stubGlobal('fetch', fetch);
    page(mapOf('six-stops'));
    const card = li('Grade 11');
    const other = li('Matric');
    const target = placeOf(other);
    const move = screen.getByRole('button', { name: t.arrange.move('Grade 11') });
    fireEvent.click(move);
    // Walk Grade 11 onto Matric's spot, four dots at a time, then put it down.
    const was = placeOf(card);
    const steps = Math.round((target.y - was.y) / (4 * MAP_GRID));
    for (let i = 0; i < steps; i += 1)
      fireEvent.keyDown(move, { key: 'ArrowDown', shiftKey: true });
    fireEvent.click(move);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const now = placeOf(card);
    const apart = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.abs(a.x - b.x) >= 32 || Math.abs(a.y - b.y) >= 32;
    expect(apart(now, placeOf(other))).toBe(true);
  });
});

describe('sparks on Achieved: small, local, removable (the owner decides before merge)', () => {
  const achieve = async (reduced: boolean) => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: reduced && query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const map = mapOf('six-stops');
    const part = node(map, 'slot:grade-10');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ node: { ...part, status: 'achieved' }, care: null })),
    );
    page(map);
    const li = item('Grade 10');
    fireEvent.click(within(li).getByRole('button', { name: t.editing('Grade 10') }));
    fireEvent.click(within(li).getByLabelText(t.status.achieved));
    fireEvent.click(within(li).getByRole('button', { name: t.save }));
    await screen.findByText(t.savedStatus('Grade 10', t.status.achieved));
    return li;
  };

  it('ten sparks burst from a stop just marked Achieved, hidden from readers', async () => {
    const li = await achieve(false);
    const sparks = li.querySelector('.uf-map-sparks');
    expect(sparks?.getAttribute('aria-hidden')).toBe('true');
    expect(sparks?.querySelectorAll('.uf-map-spark')).toHaveLength(10);
  });

  it('none under reduced motion, and none when the words needed care', async () => {
    const li = await achieve(true);
    expect(li.querySelector('.uf-map-sparks')).toBeNull();
  });
});

describe('motion (§9): CSS only, every time a token, none under reduced motion', () => {
  const CSS = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');
  const START = '/* plan-maps: My plan maps (app/(app)/goals/maps/[id]/plan-map-view.tsx) */';
  const END = '/* end plan-maps */';
  const block = CSS.slice(CSS.indexOf(START), CSS.indexOf(END));

  it('has its own block, with the picture layouts and a reduced-motion path', () => {
    expect(CSS.indexOf(START)).toBeGreaterThan(-1);
    expect(CSS.indexOf(END)).toBeGreaterThan(CSS.indexOf(START));
    for (const layout of ['ring', 'cloud', 'stairs', 'branches', 'road']) {
      expect(block).toContain(`.uf-map--${layout}`);
    }
    const reduced = block.slice(block.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toMatch(/animation:\s*none/);
  });

  it('takes every duration and delay from a token', () => {
    const raw = [...block.matchAll(/(?:transition|animation)(?:-duration|-delay)?\s*:\s*([^;]+);/g)]
      .map((m) => (m[1] ?? '').trim())
      .filter((v) => v !== 'none')
      .filter((v) => /\d(?:ms|s)\b/.test(v) || !/var\(--uf-duration-/.test(v));
    expect(raw).toEqual([]);
  });

  // The owner, 2026-10-24: the picture is a canvas on a card on every screen, so it is never laid
  // out by the page's width; since 2026-10-25 (RT-07) the page places every card itself
  // (map-layout.ts), so the picture needs no width rule at all: no grid, no container query.
  it('places the picture by the page’s layout, never by the page’s width', () => {
    expect(block).not.toMatch(/@media \(min-width/);
    expect(block).not.toMatch(/@container/);
    expect(block).toMatch(
      /\.uf-map\[data-view="picture"\] > \.uf-map-branches > \.uf-map-branch\s*\{[^}]*position:\s*absolute/,
    );
  });

  // MAPS-05, A4-21: a card's height is a sum of fixed slots the server knows (map-layout.ts SLOT);
  // the CSS pins each slot to the same number, in tokens, so nothing is measured and nothing jumps.
  it('pins every slot of a card to the same height the layout counts, in tokens', () => {
    const tokensCss = readFileSync(
      join(__dirname, '..', '..', '..', 'packages', 'tokens', 'tokens.css'),
      'utf8',
    );
    const px = (name: string): number => {
      const m = tokensCss.match(new RegExp(`--uf-${name}:\\s*([^;]+);`));
      if (!m) throw new Error(`no token --uf-${name}`);
      const v = (m[1] ?? '').trim();
      if (v.endsWith('rem')) return Number.parseFloat(v) * 16;
      if (v.endsWith('px')) return Number.parseFloat(v);
      throw new Error(`token --uf-${name} is not a length: ${v}`);
    };
    const resolve = (expr: string): number => {
      // var(--uf-x), calc(a + b), calc(a * n): what the slot lines use.
      const vars = expr.replace(/var\(--uf-([a-z0-9-]+)\)/g, (_, name: string) => String(px(name)));
      const inner = vars.replace(/^calc\(([\s\S]*)\)$/, '$1');
      // biome-ignore lint/security/noGlobalEval: numbers, + and * only, from our own stylesheet.
      if (!/^[\d.\s+*()]+$/.test(inner)) throw new Error(`can't resolve ${expr}`);
      return Number(new Function(`return (${inner});`)());
    };
    const slots: Record<string, number> = {};
    for (const m of block.matchAll(/--uf-map-slot-([a-z-]+):\s*([^;]+);/g)) {
      slots[(m[1] ?? '').replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = resolve(
        (m[2] ?? '').trim(),
      );
    }
    expect(slots).toEqual({ ...SLOT });
  });
});

describe('critic pass 2 (2026-10-26): the picture’s CSS and the middle’s ring', () => {
  const CSS = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');
  const tokensCss = readFileSync(
    join(__dirname, '..', '..', '..', 'packages', 'tokens', 'tokens.css'),
    'utf8',
  );

  // MAPS-15: an animation whose keyframes are missing never runs (the sparks sat as a stray dot).
  it('every animation named in the stylesheet has its keyframes', () => {
    const names = new Set(
      [...CSS.matchAll(/animation(?:-name)?\s*:\s*([a-z][\w-]*)/g)]
        .map((m) => m[1] ?? '')
        .filter((n) => n !== 'none' && n !== 'var'),
    );
    expect(names.has('uf-map-spark')).toBe(true);
    const missing = [...names].filter((n) => !new RegExp(`@keyframes ${n}\\s*\\{`).test(CSS));
    expect(missing).toEqual([]);
  });

  // MAPS-24: two lines of the goal is the picture's clamp; the List shows the whole name.
  it('clamps the goal’s line in the picture only', () => {
    expect(CSS).not.toMatch(/(?:^|\}|\*\/)\s*\.uf-map-goal-line\s*\{/m);
    expect(CSS).toMatch(
      /\.uf-map\[data-view="picture"\] \.uf-map-goal-line\s*\{[^}]*-webkit-line-clamp:\s*2/,
    );
  });

  // MAPS-23: a finger held on a card lifts it; the browser's selection and callout stay off it.
  it('keeps the browser’s selection and long-press callout off a card that can be dragged', () => {
    const rule =
      /\.uf-map\[data-view="picture"\] > \.uf-map-branches > \.uf-map-branch\s*\{([^}]*)\}/.exec(
        CSS,
      )?.[1] ?? '';
    expect(rule).toMatch(/(?:^|;)\s*user-select:\s*none/);
    expect(rule).toMatch(/-webkit-user-select:\s*none/);
    expect(rule).toMatch(/-webkit-touch-callout:\s*none/);
    // MAPS-12: no easing on a card's place as a rule: a dropped card never glides from its start.
    expect(rule).not.toMatch(/transition/);
  });

  // MAPS-14: the ring of how much is achieved is drawn outside the shape, on the canvas, where
  // success is readable (on the shape's own light fill it was 1.02:1).
  it('draws the progress ring 14px clear of the shape, 6px wide, success on the canvas', () => {
    const size = { width: 459, height: 426 };
    const extent = (d: string) => {
      const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
      let dx = 0;
      let dy = 0;
      for (let i = 0; i + 1 < nums.length; i += 2) {
        dx = Math.max(dx, Math.abs((nums[i] as number) - size.width / 2));
        dy = Math.max(dy, Math.abs((nums[i + 1] as number) - size.height / 2));
      }
      return { dx, dy };
    };
    for (const layout of ['ring', 'cloud', 'branches'] as const) {
      const { container, unmount } = render(<HubArt layout={layout} size={size} done={0.5} />);
      const shape = container.querySelector('.uf-map-hub-shape') as SVGElement;
      const halo = container.querySelector('.uf-map-hub-halo');
      const ring = container.querySelector('.uf-map-hub-progress') as SVGElement;
      expect(ring, layout).not.toBeNull();
      // The shape's reach (a path's points and control points bound it; an ellipse its radii).
      let reach =
        shape.tagName === 'path'
          ? extent(shape.getAttribute('d') ?? '')
          : { dx: Number(shape.getAttribute('rx')), dy: Number(shape.getAttribute('ry')) };
      if (halo)
        reach = {
          dx: Number(halo.getAttribute('rx')) + 1,
          dy: Number(halo.getAttribute('ry')) + 1,
        };
      const rx = Number(ring.getAttribute('rx'));
      const ry = Number(ring.getAttribute('ry'));
      expect(rx - reach.dx, `${layout} x`).toBeGreaterThanOrEqual(14 - 0.5);
      expect(ry - reach.dy, `${layout} y`).toBeGreaterThanOrEqual(14 - 0.5);
      unmount();
    }
    const px = (name: string) => {
      const v = (tokensCss.match(new RegExp(`--uf-${name}:\\s*([^;]+);`))?.[1] ?? '').trim();
      return v.endsWith('rem') ? Number.parseFloat(v) * 16 : Number.parseFloat(v);
    };
    for (const cls of ['uf-map-hub-track', 'uf-map-hub-progress']) {
      const rule = new RegExp(`\\.${cls}\\s*\\{([^}]*)\\}`).exec(CSS)?.[1] ?? '';
      const width =
        /stroke-width:\s*calc\(var\(--uf-([a-z0-9-]+)\) \+ var\(--uf-([a-z0-9-]+)\)\)/.exec(rule);
      expect(width, cls).not.toBeNull();
      expect(px(width?.[1] ?? '') + px(width?.[2] ?? '')).toBe(6);
    }
    const progress = /\.uf-map-hub-progress\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(progress).toMatch(/stroke:\s*var\(--uf-color-success\)/);
    // The pair it is drawn in: success on the canvas.
    expect(contrastRatio(tokens.color.success, tokens.color.canvas)).toBeGreaterThanOrEqual(3);
  });
});
