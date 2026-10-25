import { PLAN_MAP_LIMITS } from '@universityflow/db';
import {
  PLAN_LIMITS,
  type PlanMapsResponse,
  type PlanMapView,
  type PlanNode,
  templateSeed,
} from '@universityflow/ui';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import type { WrittenCare } from '@/lib/server/plan-care';
import { agreeAsAdult } from './adult-consent';
import { Browser } from './harness';

/**
 * My plan maps over the real route handlers and an embedded database
 * (docs/design/plan-maps-proposal.md §3.2), with the owner's words switch on (UF_MINDMAP_WORDS=1,
 * the preview): guards, CSRF, consent, limits, the goal in the middle, export, and the crisis
 * check on every save (D3), whose words are saved anyway and never logged or audited.
 */

process.env['UF_MINDMAP_WORDS'] = '1';
vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-10-13T08:00:00Z'));
afterAll(() => {
  vi.useRealTimers();
  delete process.env['UF_MINDMAP_WORDS'];
});
afterEach(() => {
  vi.restoreAllMocks();
});

const routes = {
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  dob: (await import('../app/api/me/date-of-birth/route')).POST,
  exportData: (await import('../app/api/me/export/route')).GET,
  outbox: (await import('../app/api/dev/outbox/route')).GET,
  goal: await import('../app/api/me/goal/route'),
  maps: await import('../app/api/me/plan-maps/route'),
  map: await import('../app/api/me/plan-maps/[id]/route'),
  nodes: await import('../app/api/me/plan-maps/[id]/nodes/route'),
  node: await import('../app/api/me/plan-maps/[id]/nodes/[nodeId]/route'),
  move: (await import('../app/api/me/plan-maps/[id]/nodes/[nodeId]/move/route')).POST,
};

let n = 4_100_000;
const phone = () => `082${String(n++).padStart(7, '0')}`;

async function signedIn() {
  const number = phone();
  const browser = new Browser();
  await browser.json(routes.requestPin, '/api/auth/request-pin', { json: { phone: number } });
  const { body } = await new Browser().json<{ messages: Array<{ to: string; body: string }> }>(
    routes.outbox,
    '/api/dev/outbox',
  );
  const pin = body.messages
    .findLast((m) => m.to === `+27${number.slice(1)}`)
    ?.body.match(/\b(\d{6})\b/)?.[1];
  await browser.json(routes.verifyPin, '/api/auth/verify-pin', { json: { phone: number, pin } });
  return browser;
}

async function adult() {
  const browser = await signedIn();
  await browser.json(routes.dob, '/api/me/date-of-birth', { json: { dateOfBirth: '2000-02-02' } });
  await agreeAsAdult(browser);
  return browser;
}

async function create(
  browser: Browser,
  json: unknown = { templateId: 'six-stops', linksGoal: false },
) {
  return browser.json<{ map: PlanMapView }>(routes.maps.POST, '/api/me/plan-maps', { json });
}

const nodeOf = (map: PlanMapView, slotId: string) =>
  map.nodes.find((x) => x.slotId === slotId) as PlanNode;

function save(browser: Browser, map: PlanMapView, nodeId: string, json: unknown) {
  return browser.json<{ node: PlanNode; care: WrittenCare | null }>(
    routes.node.PUT,
    `/api/me/plan-maps/${map.id}/nodes/${nodeId}`,
    { method: 'PUT', json, params: { id: map.id, nodeId } },
  );
}

describe('the plan maps API (proposal §3.2)', () => {
  it('holds the same limits as the data layer', () => {
    const { firstYear: _f, lastYear: _l, ...limits } = PLAN_LIMITS;
    expect(limits).toEqual(PLAN_MAP_LIMITS);
  });

  it('creates a map from a template, lists it, and reads it back', async () => {
    const browser = await adult();
    const created = await create(browser);
    expect(created.status).toBe(200);
    const map = created.body.map;
    expect(map.templateId).toBe('six-stops');
    expect(map.wordsAllowed).toBe(true);
    expect(map.nodes.map((x) => x.slotId)).toEqual(templateSeed('six-stops').map((p) => p.slotId));
    const list = await browser.json<PlanMapsResponse>(routes.maps.GET, '/api/me/plan-maps');
    expect(list.body).toMatchObject({ wordsAllowed: true, max: 10 });
    expect(list.body.maps).toEqual([
      expect.objectContaining({
        id: map.id,
        templateId: 'six-stops',
        counts: { planned: 6, achieved: 0, notAchieved: 0 },
      }),
    ]);
    const read = await browser.json<{ map: PlanMapView }>(
      routes.map.GET,
      `/api/me/plan-maps/${map.id}`,
      {
        params: { id: map.id },
      },
    );
    expect(read.body.map).toEqual(map);
  });

  it('refuses an unknown template, unknown keys, and a write from another site', async () => {
    const browser = await adult();
    expect((await create(browser, { templateId: 'mind-palace', linksGoal: false })).status).toBe(
      400,
    );
    expect(
      (await create(browser, { templateId: 'six-stops', linksGoal: false, extra: 1 })).status,
    ).toBe(400);
    const forged = await browser.json(routes.maps.POST, '/api/me/plan-maps', {
      json: { templateId: 'six-stops', linksGoal: false },
      origin: 'https://evil.example',
    });
    expect(forged.status).toBe(403);
    const { map } = (await create(browser)).body;
    const unknown = await save(browser, map, nodeOf(map, 'slot:grade-10').id, { colour: 'red' });
    expect(unknown.status).toBe(400);
  });

  it('is refused before consent, and another learner’s map is not found', async () => {
    const waiting = await signedIn();
    expect((await create(waiting)).status).toBe(403);
    const owner = await adult();
    const { map } = (await create(owner)).body;
    const other = await adult();
    const read = await other.json(routes.map.GET, `/api/me/plan-maps/${map.id}`, {
      params: { id: map.id },
    });
    expect(read.status).toBe(404);
    const changed = await save(other, map, nodeOf(map, 'slot:grade-10').id, { status: 'achieved' });
    expect(changed.status).toBe(404);
    const junk = await other.json(routes.map.GET, '/api/me/plan-maps/not-a-uuid', {
      params: { id: 'not-a-uuid' },
    });
    expect(junk.status).toBe(404);
  });

  it('keeps ten maps, then says why', async () => {
    const browser = await adult();
    for (let i = 0; i < 10; i++) expect((await create(browser)).status).toBe(200);
    const full = await create(browser);
    expect(full).toMatchObject({ status: 409, body: { error: 'state', detail: 'too-many-maps' } });
  });

  it('adds, moves and deletes parts, and deletes the map', async () => {
    const browser = await adult();
    const { map } = (await create(browser)).body;
    const centre = nodeOf(map, 'slot:centre');
    const added = await browser.json<{ node: PlanNode }>(
      routes.nodes.POST,
      `/api/me/plan-maps/${map.id}/nodes`,
      {
        json: { parentId: centre.id, text: 'Practise past papers' },
        params: { id: map.id },
      },
    );
    expect(added.status).toBe(200);
    expect(added.body.node).toMatchObject({ depth: 1, position: 6, text: 'Practise past papers' });
    const moved = await browser.json(
      routes.move,
      `/api/me/plan-maps/${map.id}/nodes/${added.body.node.id}/move`,
      {
        json: { parentId: centre.id, position: 0 },
        params: { id: map.id, nodeId: added.body.node.id },
      },
    );
    expect(moved.status).toBe(200);
    expect(
      (moved.body as { map: PlanMapView }).map.nodes.find((x) => x.id === added.body.node.id)
        ?.position,
    ).toBe(0);
    const centreGone = await browser.json(
      routes.node.DELETE,
      `/api/me/plan-maps/${map.id}/nodes/${centre.id}`,
      {
        method: 'DELETE',
        params: { id: map.id, nodeId: centre.id },
      },
    );
    expect(centreGone.status).toBe(409);
    const deleted = await browser.json(
      routes.node.DELETE,
      `/api/me/plan-maps/${map.id}/nodes/${added.body.node.id}`,
      {
        method: 'DELETE',
        params: { id: map.id, nodeId: added.body.node.id },
      },
    );
    expect(deleted.status).toBe(200);
    const gone = await browser.json(routes.map.DELETE, `/api/me/plan-maps/${map.id}`, {
      method: 'DELETE',
      params: { id: map.id },
    });
    expect(gone.status).toBe(200);
    expect(
      (await browser.json<PlanMapsResponse>(routes.maps.GET, '/api/me/plan-maps')).body.maps,
    ).toEqual([]);
  });

  it('puts a template stop back with its own stops, once', async () => {
    const browser = await adult();
    const { map } = (await create(browser, { templateId: 'staircase', linksGoal: false })).body;
    const centre = nodeOf(map, 'slot:centre');
    const body = { parentId: centre.id, slotId: 'slot:habits' };
    const added = await browser.json<{ node: PlanNode }>(
      routes.nodes.POST,
      `/api/me/plan-maps/${map.id}/nodes`,
      {
        json: body,
        params: { id: map.id },
      },
    );
    expect(added.status).toBe(200);
    const read = await browser.json<{ map: PlanMapView }>(
      routes.map.GET,
      `/api/me/plan-maps/${map.id}`,
      { params: { id: map.id } },
    );
    expect(read.body.map.nodes.filter((x) => x.parentId === added.body.node.id)).toHaveLength(6);
    const again = await browser.json(routes.nodes.POST, `/api/me/plan-maps/${map.id}/nodes`, {
      json: body,
      params: { id: map.id },
    });
    expect(again.status).toBe(409);
    // A slot that isn't this template's is refused.
    const foreign = await browser.json(routes.nodes.POST, `/api/me/plan-maps/${map.id}/nodes`, {
      json: { parentId: centre.id, slotId: 'slot:why' },
      params: { id: map.id },
    });
    expect(foreign.status).toBe(400);
  });

  it('shows My goal in the middle, read live: none, then the course, then unavailable', async () => {
    const browser = await adult();
    const { map } = (await create(browser, { templateId: 'the-road', linksGoal: true })).body;
    expect(map.goal).toEqual({ kind: 'none' });
    const options = (
      await browser.json<{ options: Array<{ id: string; name: string; universityName: string }> }>(
        routes.goal.GET,
        '/api/me/goal',
      )
    ).body.options;
    const course = options[0] as (typeof options)[number];
    await browser.json(routes.goal.PUT, '/api/me/goal', {
      method: 'PUT',
      json: { programmeId: course.id },
    });
    const read = async () =>
      (
        await browser.json<{ map: PlanMapView }>(routes.map.GET, `/api/me/plan-maps/${map.id}`, {
          params: { id: map.id },
        })
      ).body.map;
    expect((await read()).goal).toEqual({
      kind: 'goal',
      course: course.name,
      university: course.universityName,
    });
    // Unlinked: nothing in the middle at all.
    await browser.json(routes.map.PATCH, `/api/me/plan-maps/${map.id}`, {
      method: 'PATCH',
      json: { linksGoal: false },
      params: { id: map.id },
    });
    expect((await read()).goal).toBeNull();
  });

  it('saves the words and a target, and says when an ID number must come out', async () => {
    const browser = await adult();
    const { map } = (await create(browser)).body;
    const part = nodeOf(map, 'slot:grade-11');
    const saved = await save(browser, map, part.id, {
      text: '  Practise past papers  ',
      status: 'not-achieved',
      whyNot: 'Ran out of time',
      differently: 'Start in the first term',
      targetMonth: '2027-11',
    });
    expect(saved.status).toBe(200);
    expect(saved.body.node).toMatchObject({
      text: 'Practise past papers',
      status: 'not-achieved',
      targetMonth: '2027-11',
    });
    expect(saved.body.care).toBeNull();
    const id = await save(browser, map, part.id, {
      text: `ID ${['9001', '0150', '0908', '6'].join('')}`,
    });
    expect(id).toMatchObject({ status: 409, body: { error: 'state', detail: 'personal-number' } });
    expect((await save(browser, map, part.id, { text: 'x'.repeat(121) })).status).toBe(400);
    expect((await save(browser, map, part.id, { targetMonth: '2027-1' })).status).toBe(400);
    const titled = await browser.json<{ map: PlanMapView }>(
      routes.map.PATCH,
      `/api/me/plan-maps/${map.id}`,
      {
        method: 'PATCH',
        json: { title: 'My climb' },
        params: { id: map.id },
      },
    );
    expect(titled.body.map.title).toBe('My climb');
  });
});

describe('the crisis check on every save (D3, hard rule 4)', () => {
  const CRISIS = 'I failed because I wanted to die that year';

  it('saves the words, answers with the crisis card, and logs and audits nothing about it', async () => {
    const browser = await adult();
    const { map } = (await create(browser)).body;
    const part = nodeOf(map, 'slot:grade-11');
    const logged: unknown[] = [];
    for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        logged.push(args);
      });
    }
    const crisis = await save(browser, map, part.id, { status: 'not-achieved', whyNot: CRISIS });
    expect(crisis.status).toBe(200);
    expect(crisis.body.node.whyNot).toBe(CRISIS);
    expect(crisis.body.care?.level).toBe('crisis');
    expect(crisis.body.care && 'card' in crisis.body.care && crisis.body.care.card.kind).toBe(
      'crisis-card',
    );
    const concern = await save(browser, map, part.id, {
      whyNot: 'I felt so hopeless I stopped trying',
    });
    expect(concern.body).toMatchObject({
      node: { whyNot: 'I felt so hopeless I stopped trying' },
      care: { level: 'concern' },
    });
    const alarm = await save(browser, map, part.id, { whyNot: 'I killed it in maths' });
    expect(alarm.body).toMatchObject({ node: { whyNot: 'I killed it in maths' }, care: null });
    const setback = await save(browser, map, part.id, { whyNot: 'I failed my trial exams' });
    expect(setback.body.care).toEqual({ level: 'setback' });
    // The heading is read before the words: a learner's own part "I just want to" over "die".
    const own = await browser.json<{ node: PlanNode }>(
      routes.nodes.POST,
      `/api/me/plan-maps/${map.id}/nodes`,
      {
        json: { parentId: nodeOf(map, 'slot:centre').id, text: 'I just want to' },
        params: { id: map.id },
      },
    );
    const joined = await save(browser, map, own.body.node.id, { differently: 'die' });
    expect(joined.body.care?.level).toBe('crisis');
    // A title is checked too.
    const title = await browser.json<{ care: WrittenCare | null }>(
      routes.map.PATCH,
      `/api/me/plan-maps/${map.id}`,
      {
        method: 'PATCH',
        json: { title: 'I want to die' },
        params: { id: map.id },
      },
    );
    expect(title.body.care?.level).toBe('crisis');

    expect(JSON.stringify(logged)).not.toMatch(/die|hopeless|crisis|distress|concern/i);
    const exported = await browser.json<{
      accessHistory: Array<{ action: string; reason: string | null }>;
    }>(routes.exportData, '/api/me/export');
    const history = JSON.stringify(exported.body.accessHistory);
    expect(history).not.toMatch(/die|hopeless|crisis|distress|concern|care/i);
    expect(exported.body.accessHistory.map((r) => r.action)).toContain('plan-map.node-saved');
  });

  it('Download my data has the map, its parts and the learner’s words', async () => {
    const browser = await adult();
    const { map } = (await create(browser)).body;
    await save(browser, map, nodeOf(map, 'slot:grade-10').id, { text: 'Synthetic words' });
    const exported = await browser.json<{
      personal: { planMaps: Array<{ id: string; nodes: unknown[] }> };
    }>(routes.exportData, '/api/me/export');
    expect(exported.body.personal.planMaps.map((m) => m.id)).toEqual([map.id]);
    expect(JSON.stringify(exported.body.personal.planMaps)).toContain('Synthetic words');
  });
});
