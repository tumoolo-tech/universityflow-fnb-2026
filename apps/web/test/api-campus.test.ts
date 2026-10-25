import { randomUUID } from 'node:crypto';
import { RAW_CATALOGUE } from '@universityflow/catalogue';
import { FIRST_WEEK_STEPS, MESSAGE_TEMPLATES } from '@universityflow/content';
import { SIGNATURE_HEADER, signWebhook } from '@universityflow/messaging';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { CampusResponse, FirstWeekResponse } from '../lib/server/campus';
import { safetyReminderTimes } from '../lib/server/campus';
import { agreeAsAdult } from './adult-consent';
import { Browser, type CallOptions } from './harness';

/**
 * Phase 5b over the real route handlers, an embedded database and the local stand-ins (preview
 * catalogue, so UP's draft campus records show, labelled): the tour and checklist for the accepted
 * offer's university or one the learner chooses (never assumed), ticking steps, the safety push
 * notifications on accepting an offer (push only, decision 4), and the SMS crisis reply, which
 * never carries a draft campus line.
 *
 * The clock is pinned (Date only) to a Wednesday at 18:00 in South Africa (gotcha 31).
 */

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-10-14T16:00:00Z'));
afterAll(() => {
  vi.useRealTimers();
});

const { getServices } = await import('../lib/server/services');

const routes = {
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  dob: (await import('../app/api/me/date-of-birth/route')).POST,
  exportData: (await import('../app/api/me/export/route')).GET,
  messaging: await import('../app/api/me/messaging/route'),
  pushToken: await import('../app/api/me/push-token/route'),
  reminders: await import('../app/api/me/reminders/route'),
  offers: await import('../app/api/offers/route'),
  offer: await import('../app/api/offers/[id]/route'),
  campus: (await import('../app/api/campus/route')).GET,
  firstWeek: await import('../app/api/first-week/route'),
  inbound: (await import('../app/api/messaging/[channel]/inbound/route')).POST,
  outbox: (await import('../app/api/dev/outbox/route')).GET,
};

let n = 7_600_000;
/** A synthetic number, built at runtime (hard rule 4). */
const phone = () => `082${String(n++).padStart(7, '0')}`;
const e164 = (local: string) => `+27${local.slice(1)}`;
const NATIVE: CallOptions = { origin: null, headers: { 'x-uf-client': 'native' } };

async function pinFor(local: string) {
  const { body } = await new Browser().json<{ messages: Array<{ to: string; body: string }> }>(
    routes.outbox,
    '/api/dev/outbox',
  );
  return (
    body.messages
      .filter((m) => m.to === e164(local))
      .at(-1)
      ?.body.match(/\b(\d{6})\b/)?.[1] ?? ''
  );
}

/** An adult learner on the web. */
async function adult() {
  const number = phone();
  const browser = new Browser();
  await browser.json(routes.requestPin, '/api/auth/request-pin', { json: { phone: number } });
  await browser.json(routes.verifyPin, '/api/auth/verify-pin', {
    json: { phone: number, pin: await pinFor(number) },
  });
  await browser.json(routes.dob, '/api/me/date-of-birth', { json: { dateOfBirth: '2000-02-02' } });
  await agreeAsAdult(browser);
  return { browser, number, call: {} as CallOptions };
}

/** An adult learner in the app, with push on for this phone. */
let t = 1;
async function appLearnerWithPush() {
  const number = phone();
  const app = new Browser();
  await app.json(routes.requestPin, '/api/auth/request-pin', {
    ...NATIVE,
    json: { phone: number },
  });
  const verified = await app.json<{ token: string }>(routes.verifyPin, '/api/auth/verify-pin', {
    ...NATIVE,
    json: { phone: number, pin: await pinFor(number) },
  });
  const bearer = verified.body.token;
  const call: CallOptions = { bearer, origin: null };
  await app.json(routes.dob, '/api/me/date-of-birth', {
    ...call,
    json: { dateOfBirth: '2000-02-02' },
  });
  await agreeAsAdult(app, call);
  await app.json(routes.pushToken.POST, '/api/me/push-token', {
    ...call,
    json: {
      token: `ExponentPushToken[campus${String(t++).padStart(8, '0')}]`,
      platform: 'android',
    },
  });
  await app.json(routes.messaging.PUT, '/api/me/messaging', {
    ...call,
    method: 'PUT',
    json: { channel: 'push', optedIn: true },
  });
  return { browser: app, number, call };
}

type Learner = Awaited<ReturnType<typeof adult>>;

async function acceptOffer({ browser, call }: Learner, programmeId = 'up-bsc-computer-science') {
  const added = await browser.json<{ id: string }>(routes.offers.POST, '/api/offers', {
    ...call,
    json: { programmeId, kind: 'final', replyBy: null, conditions: [] },
  });
  const id = added.body.id;
  const res = await browser.json(routes.offer.PATCH, `/api/offers/${id}`, {
    ...call,
    method: 'PATCH',
    json: { action: 'accept' },
    params: { id },
  });
  expect(res.status).toBe(200);
}

const campus = ({ browser, call }: Learner, query = '') =>
  browser.json<CampusResponse>(routes.campus, `/api/campus${query}`, call);
const week = ({ browser, call }: Learner, query = '') =>
  browser.json<FirstWeekResponse>(routes.firstWeek.GET, `/api/first-week${query}`, call);
const tick = ({ browser, call }: Learner, body: Record<string, unknown>) =>
  browser.json<FirstWeekResponse>(routes.firstWeek.PUT, '/api/first-week', {
    ...call,
    method: 'PUT',
    json: body,
  });

describe('the campus tour and the checklist: which university', () => {
  it('none is assumed: without an accepted offer the learner chooses', async () => {
    const learner = await adult();
    const { status, body } = await campus(learner);
    expect(status).toBe(200);
    expect(body.tour).toBeNull();
    expect(body.accepted).toBeNull();
    expect(body.options.map((o) => o.id).sort()).toEqual(
      ['tut', 'uct', 'uj', 'ukzn', 'up', 'wits'].sort(),
    );
    expect((await week(learner)).body.checklist).toBeNull();
    const chosen = await campus(learner, '?university=up');
    expect(chosen.body.tour).toMatchObject({
      universityId: 'up',
      basis: 'chosen',
      beforeYouArrive: false,
    });
    expect((await campus(learner, '?university=harvard')).status).toBe(400);
  });

  it('the accepted offer’s university, its drafts labelled, and never a draft safety place', async () => {
    const learner = await adult();
    await acceptOffer(learner);
    const { body } = await campus(learner);
    expect(body.accepted).toBe('up');
    const tour = body.tour;
    expect(tour).toMatchObject({
      universityId: 'up',
      basis: 'accepted-offer',
      beforeYouArrive: true,
    });
    expect(tour?.includesDrafts).toBe(true);
    expect(tour?.campuses.length).toBeGreaterThan(0);
    const places = tour?.campuses.flatMap((c) => c.needs.flatMap((nd) => nd.places)) ?? [];
    expect(places.length).toBeGreaterThan(0);
    expect(places.every((p) => p.draft)).toBe(true);
    expect(places.some((p) => ['clinic', 'counselling', 'security'].includes(p.kind))).toBe(false);
    // A maps link exactly when the record publishes a location (A13-11), and always Google's.
    for (const p of places) {
      const record = RAW_CATALOGUE.places.find((r) => r.id === p.id);
      if (record?.location) {
        expect(p.mapsUrl, p.id).toMatch(/^https:\/\/www\.google\.com\/maps\/search\//);
      } else {
        expect(p.mapsUrl, p.id).toBeNull();
      }
    }
  });
});

describe('the first-week checklist', () => {
  it('keeps the learner’s ticks per university, and refuses anything but a step', async () => {
    const learner = await adult();
    await acceptOffer(learner);
    const first = await week(learner);
    expect(first.body.checklist?.steps.map((s) => s.id)).toEqual([...FIRST_WEEK_STEPS]);
    // UP's calendar is a draft in preview: shown, labelled.
    expect(first.body.checklist?.calendar?.draft).toBe(true);
    const ticked = await tick(learner, { universityId: 'up', step: 'register', done: true });
    expect(ticked.status).toBe(200);
    expect(ticked.body.checklist?.steps.find((s) => s.id === 'register')?.doneAt).toBe(
      '2026-10-14T16:00:00.000Z',
    );
    // Another university's checklist is its own.
    expect(
      (await week(learner, '?university=wits')).body.checklist?.steps.some((s) => s.doneAt),
    ).toBe(false);
    const unticked = await tick(learner, { universityId: 'up', step: 'register', done: false });
    expect(unticked.body.checklist?.steps.every((s) => s.doneAt === null)).toBe(true);
    for (const bad of [
      { universityId: 'up', step: 'pay-a-deposit', done: true },
      { universityId: 'harvard', step: 'register', done: true },
      { universityId: 'up', step: 'register', done: 'yes' },
      { universityId: 'up', step: 'register', done: true, note: 'x' },
    ]) {
      expect((await tick(learner, bad)).status).toBe(400);
    }
    await tick(learner, { universityId: 'up', step: 'student-card', done: true });
    const exported = await learner.browser.json<{ personal: { firstWeek: unknown[] } }>(
      routes.exportData,
      '/api/me/export',
    );
    expect(exported.body.personal.firstWeek).toEqual([
      expect.objectContaining({ universityId: 'up', step: 'student-card' }),
    ]);
  });
});

describe('safety and scam guidance by push (owner’s decision 4)', () => {
  const safety = async ({ browser, call }: Learner) => {
    const { body } = await browser.json<{
      reminders: Array<{ templateId: string; channel: string; desiredAt: string; status: string }>;
    }>(routes.reminders.GET, '/api/me/reminders', call);
    return body.reminders.filter((r) => r.templateId.startsWith('safety.'));
  };

  it('two push notifications once an offer is accepted: tonight, and mid-January', async () => {
    const learner = await appLearnerWithPush();
    await acceptOffer(learner);
    const list = await safety(learner);
    expect(list.map((r) => [r.templateId, r.channel, r.desiredAt]).sort()).toEqual([
      ['safety.move-in', 'push', '2027-01-15T16:00:00.000Z'],
      ['safety.offer-accepted', 'push', '2026-10-15T16:00:00.000Z'],
    ]);
    // Never on SMS or WhatsApp, by the templates themselves.
    for (const id of ['safety.offer-accepted', 'safety.move-in'] as const) {
      expect(MESSAGE_TEMPLATES[id].channels).toEqual(['push']);
    }
  });

  it('nothing without push on: never by SMS or WhatsApp instead', async () => {
    const learner = await adult();
    await learner.browser.json(routes.messaging.PUT, '/api/me/messaging', {
      method: 'PUT',
      json: { channel: 'sms', optedIn: true },
    });
    await acceptOffer(learner);
    expect(await safety(learner)).toEqual([]);
  });

  it('times: the next 18:00 SAST, and the coming 15 January', () => {
    expect(safetyReminderTimes(new Date('2026-10-14T09:00:00Z'))).toEqual({
      accepted: new Date('2026-10-14T16:00:00Z'),
      moveIn: new Date('2027-01-15T16:00:00Z'),
    });
    expect(safetyReminderTimes(new Date('2027-01-10T20:00:00Z'))).toEqual({
      accepted: new Date('2027-01-11T16:00:00Z'),
      moveIn: new Date('2027-01-15T16:00:00Z'),
    });
    expect(safetyReminderTimes(new Date('2027-01-16T08:00:00Z')).moveIn).toEqual(
      new Date('2028-01-15T16:00:00Z'),
    );
  });
});

describe('the SMS crisis reply never carries a draft campus line', () => {
  it('a learner with an accepted offer at a university whose records are drafts gets helplines only', async () => {
    const learner = await adult();
    await acceptOffer(learner);
    const { config } = await getServices();
    const body = JSON.stringify({
      type: 'message',
      from: e164(learner.number),
      text: 'i want to die',
      id: randomUUID(),
    });
    const res = await new Browser().json<{ reply: string }>(
      routes.inbound,
      '/api/messaging/sms/inbound',
      {
        method: 'POST',
        body,
        headers: {
          'content-type': 'application/json',
          [SIGNATURE_HEADER]: signWebhook(
            config.messagingWebhookSecret ?? '',
            'sms',
            body,
            new Date(),
          ),
        },
        origin: null,
        params: { channel: 'sms' },
      },
    );
    expect(res.status).toBe(200);
    expect(res.body.reply).toBeTruthy();
    expect(res.body.reply).not.toMatch(
      /Hatfield|Student Health|Counselling Unit|Operational Management/,
    );
  });
});
