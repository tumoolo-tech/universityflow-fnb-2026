// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { crisisCard } from '@universityflow/agent';
import { catalogueView } from '@universityflow/catalogue';
import { en } from '@universityflow/content';
import { type PlanMapView, type PlanNode, templateSeed } from '@universityflow/ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    expect(document.querySelector('svg.uf-map-lines')?.getAttribute('aria-hidden')).toBe('true');
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

  // The owner, 2026-10-24: the picture is a canvas on a card on every screen. It is laid out by
  // the width of the map inside that card (each picture's own width, tokens.canvas), never the
  // page's, so a phone shows the picture too; outside a canvas (the List) it is the outline.
  it('draws the picture by the map’s own width in its canvas, not the page’s', () => {
    expect(block).toMatch(/@container uf-map-world \(min-width: 48rem\)/);
    expect(block).toMatch(/@container uf-map-world \(min-width: 64rem\)/);
    expect(block).not.toMatch(/@media \(min-width/);
  });
});
