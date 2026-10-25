import type { PlanMapsResponse, PlanMapView, PlanNode } from '@universityflow/ui';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { agreeAsAdult } from './adult-consent';
import { Browser } from './harness';

/**
 * My plan maps with the owner's words switch off (the default, D2): no consent wording names plan
 * maps yet, so a learner chooses a template and ticks each part, and their own words are refused
 * with a reason the page explains. Nothing else about the map is held back.
 */

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-10-13T08:00:00Z'));
afterAll(() => {
  vi.useRealTimers();
});

const routes = {
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  dob: (await import('../app/api/me/date-of-birth/route')).POST,
  outbox: (await import('../app/api/dev/outbox/route')).GET,
  maps: await import('../app/api/me/plan-maps/route'),
  map: await import('../app/api/me/plan-maps/[id]/route'),
  nodes: await import('../app/api/me/plan-maps/[id]/nodes/route'),
  node: await import('../app/api/me/plan-maps/[id]/nodes/[nodeId]/route'),
};

let n = 4_200_000;
const phone = () => `082${String(n++).padStart(7, '0')}`;

async function adult() {
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
  await browser.json(routes.dob, '/api/me/date-of-birth', { json: { dateOfBirth: '2000-02-02' } });
  await agreeAsAdult(browser);
  return browser;
}

describe('plan maps under today’s consent: templates and ticks only (D2)', () => {
  it('says words are not allowed, refuses them with a reason, and keeps every tick', async () => {
    const browser = await adult();
    const list = await browser.json<PlanMapsResponse>(routes.maps.GET, '/api/me/plan-maps');
    expect(list.body.wordsAllowed).toBe(false);
    const created = await browser.json<{ map: PlanMapView }>(
      routes.maps.POST,
      '/api/me/plan-maps',
      {
        json: { templateId: 'staircase', linksGoal: false },
      },
    );
    expect(created.status).toBe(200);
    const { map } = created.body;
    expect(map.wordsAllowed).toBe(false);
    const part = map.nodes[1] as PlanNode;
    const put = (json: unknown) =>
      browser.json<{ node: PlanNode }>(
        routes.node.PUT,
        `/api/me/plan-maps/${map.id}/nodes/${part.id}`,
        {
          method: 'PUT',
          json,
          params: { id: map.id, nodeId: part.id },
        },
      );
    for (const words of [
      { text: 'Synthetic' },
      { whyNot: 'Synthetic' },
      { differently: 'Synthetic' },
    ]) {
      expect(await put(words)).toMatchObject({
        status: 409,
        body: { error: 'state', detail: 'plan-words' },
      });
    }
    const title = await browser.json(routes.map.PATCH, `/api/me/plan-maps/${map.id}`, {
      method: 'PATCH',
      json: { title: 'Synthetic' },
      params: { id: map.id },
    });
    expect(title).toMatchObject({ status: 409, body: { detail: 'plan-words' } });
    const own = await browser.json(routes.nodes.POST, `/api/me/plan-maps/${map.id}/nodes`, {
      json: { parentId: map.nodes[0]?.id, text: 'Synthetic' },
      params: { id: map.id },
    });
    expect(own).toMatchObject({ status: 409, body: { detail: 'plan-words' } });
    const ticked = await put({ status: 'achieved', targetMonth: '2027-11' });
    expect(ticked.status).toBe(200);
    expect(ticked.body.node).toMatchObject({
      status: 'achieved',
      targetMonth: '2027-11',
      text: null,
    });
  });
});
