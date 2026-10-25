import { OFFER_KINDS } from '@universityflow/admissions';
import type { OfferCardArtifact } from '@universityflow/agent';
import {
  type CatalogueView,
  catalogueView,
  registrationCalendarFor,
} from '@universityflow/catalogue';
import { renderMessage } from '@universityflow/content';
import { OFFER_KINDS as STORED_KINDS } from '@universityflow/db';
import { LETTER_OFFER_KINDS, type LetterDraft } from '@universityflow/documents';
import { toGsm7Typography } from '@universityflow/messaging';
import { afterAll, describe, expect, it, vi } from 'vitest';
import {
  REGISTRATION_DAY_REMINDER_DAYS,
  registrationDayReminderAt,
  replyByReminderAt,
} from '../lib/server/offers';
import { agreeAsAdult } from './adult-consent';
import { Browser } from './harness';

/**
 * Phase 5a over the real route handlers, an embedded database and the local stand-ins: "I got an
 * offer" in the learner's words or from a letter they checked field by field (hard rule 6), at most
 * one accepted, the reply-by reminder through 4a's pipeline (dropped when the offer closes), and
 * the January re-check on confirmed final results.
 *
 * The clock is pinned (Date only) to a Wednesday at 18:00 in South Africa, after every NSC paper
 * that day, so neither quiet hours nor a paper decides a test by when it happens to run.
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
  me: await import('../app/api/me/route'),
  messaging: await import('../app/api/me/messaging/route'),
  reminders: await import('../app/api/me/reminders/route'),
  documents: await import('../app/api/documents/route'),
  reports: (await import('../app/api/reports/route')).POST,
  offers: await import('../app/api/offers/route'),
  offer: await import('../app/api/offers/[id]/route'),
  runJobs: (await import('../app/api/dev/jobs/run/route')).POST,
  outbox: (await import('../app/api/dev/outbox/route')).GET,
};

let n = 7_400_000;
/** A synthetic number, built at runtime (hard rule 4). */
const phone = () => `082${String(n++).padStart(7, '0')}`;
const e164 = (local: string) => `+27${local.slice(1)}`;

async function smsTo(local: string) {
  const { body } = await new Browser().json<{ messages: Array<{ to: string; body: string }> }>(
    routes.outbox,
    '/api/dev/outbox',
  );
  return body.messages.filter((m) => m.to === e164(local)).map((m) => m.body);
}

async function signedIn(number = phone()) {
  const browser = new Browser();
  await browser.json(routes.requestPin, '/api/auth/request-pin', { json: { phone: number } });
  const pin = (await smsTo(number))[0]?.match(/\b(\d{6})\b/)?.[1];
  await browser.json(routes.verifyPin, '/api/auth/verify-pin', { json: { phone: number, pin } });
  return { browser, number };
}

async function adult(options: { sms?: boolean } = {}) {
  const session = await signedIn();
  await session.browser.json(routes.dob, '/api/me/date-of-birth', {
    json: { dateOfBirth: '2000-02-02' },
  });
  await agreeAsAdult(session.browser);
  if (options.sms) {
    await session.browser.json(routes.messaging.PUT, '/api/me/messaging', {
      method: 'PUT',
      json: { channel: 'sms', optedIn: true },
    });
  }
  return session;
}

interface OffersBody {
  offers: OfferCardArtifact[];
  options: Array<{ id: string }>;
  remindersOn: boolean;
  registrationReminderAt: string | null;
}

const OFFER = {
  programmeId: 'uj-beng-civil',
  kind: 'provisional',
  replyBy: '2026-10-30',
  conditions: [],
};

const list = (browser: Browser) => browser.json<OffersBody>(routes.offers.GET, '/api/offers');
const add = (browser: Browser, offer: Record<string, unknown> = OFFER) =>
  browser.json<OffersBody & { id: string }>(routes.offers.POST, '/api/offers', { json: offer });
const change = (browser: Browser, id: string, action: 'accept' | 'decline') =>
  browser.json<OffersBody>(routes.offer.PATCH, `/api/offers/${id}`, {
    method: 'PATCH',
    json: { action },
    params: { id },
  });
const remove = (browser: Browser, id: string) =>
  browser.json<OffersBody>(routes.offer.DELETE, `/api/offers/${id}`, {
    method: 'DELETE',
    params: { id },
  });

async function replyByReminders(browser: Browser) {
  const { body } = await browser.json<{
    reminders: Array<{ id: string; templateId: string; status: string; outcomeReason: string }>;
  }>(routes.reminders.GET, '/api/me/reminders');
  return body.reminders.filter((r) => r.templateId === 'offer.reply-by');
}

const runJobs = (at?: string) =>
  new Browser().json(routes.runJobs, '/api/dev/jobs/run', {
    method: 'POST',
    ...(at ? { json: { at } } : {}),
  });

describe('the offer kinds are one list everywhere', () => {
  it('admissions, the letter schema and the database agree', () => {
    expect([...LETTER_OFFER_KINDS]).toEqual([...OFFER_KINDS]);
    expect([...STORED_KINDS]).toEqual([...OFFER_KINDS]);
  });
});

describe('"I got an offer", in the learner’s own words', () => {
  it('is saved only as confirmed, described by its kind, with a reply-by countdown', async () => {
    const { browser } = await adult();
    expect((await list(browser)).body.offers).toEqual([]);
    const added = await add(browser);
    expect(added.status).toBe(201);
    const [card] = added.body.offers;
    expect(card).toMatchObject({
      kind: 'offer-card',
      offerKind: 'provisional',
      status: 'held',
      source: 'learner',
      universityName: 'UJ',
      programme: { id: 'uj-beng-civil', draft: true },
      replyBy: '2026-10-30',
      daysLeft: 16,
      // Not opted in to any channel: no reminder, and the page says how to get one.
      reminderAt: null,
      checksFinal: true,
      finalCheck: null,
    });
    expect(added.body.remindersOn).toBe(false);
    expect(added.body.options.some((o) => o.id === 'uj-beng-civil')).toBe(true);
  });

  it('refuses what isn’t a confirmed offer for a course the learner may see', async () => {
    const { browser } = await adult();
    for (const bad of [
      { ...OFFER, programmeId: 'nope-nope' },
      { ...OFFER, kind: 'accepted' },
      { ...OFFER, replyBy: '30 October' },
      { ...OFFER, studentNumber: '20261234' },
      { ...OFFER, conditions: ['x'.repeat(501)] },
    ]) {
      const res = await add(browser, bad);
      expect([400, 404], JSON.stringify(bad)).toContain(res.status);
    }
    expect((await add(browser)).status).toBe(201);
    const again = await add(browser);
    expect(again.status).toBe(409);
    expect(again.body).toMatchObject({ error: 'state', detail: 'offer-exists' });
  });

  it('at most one accepted; declining frees the choice', async () => {
    const { browser } = await adult();
    const a = (await add(browser)).body.id;
    const b = (await add(browser, { ...OFFER, programmeId: 'uj-beng-electrical', kind: 'final' }))
      .body.id;
    expect((await change(browser, a, 'accept')).body.offers[0]?.status).toBe('accepted');
    const refused = await change(browser, b, 'accept');
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ detail: 'another-accepted' });
    await change(browser, a, 'decline');
    const now = await change(browser, b, 'accept');
    expect(now.body.offers.map((o) => o.status)).toEqual(['declined', 'accepted']);
    // Another learner can't touch them.
    const other = await adult();
    expect((await change(other.browser, a, 'accept')).status).toBe(404);
    expect((await remove(other.browser, a)).status).toBe(404);
  });

  it('refuses a minor waiting for a guardian (hard rule 5)', async () => {
    const { browser } = await signedIn();
    await browser.json(routes.dob, '/api/me/date-of-birth', {
      json: { dateOfBirth: '2010-05-05' },
    });
    expect((await list(browser)).status).toBe(403);
    expect((await add(browser)).status).toBe(403);
  });

  it('is in the export, and goes with the account', async () => {
    const { browser } = await adult();
    await add(browser);
    const exported = await browser.json<{ personal: { offers: unknown[] } }>(
      routes.exportData,
      '/api/me/export',
    );
    expect(exported.body.personal.offers).toHaveLength(1);
    expect((await browser.json(routes.me.DELETE, '/api/me', { method: 'DELETE' })).status).toBe(
      200,
    );
  });
});

describe('from a letter the learner checks field by field (hard rule 6)', () => {
  const upload = async (browser: Browser, kind: string) => {
    const form = new FormData();
    form.append('kind', kind);
    form.append(
      'file',
      new Blob([new TextEncoder().encode('%PDF-1.7\nsynthetic letter\n%%EOF')], {
        type: 'application/pdf',
      }),
      'letter.pdf',
    );
    return browser.json<{
      documentId: string;
      letter: LetterDraft | null;
      candidates: string[];
      sample: boolean;
    }>(routes.documents.POST, '/api/documents', { body: form, method: 'POST' });
  };

  it('reads a draft with candidate courses, saves nothing until confirmed, then links the letter', async () => {
    const { browser } = await adult();
    const read = await upload(browser, 'acceptance-letter');
    expect(read.status).toBe(200);
    expect(read.body.sample).toBe(true);
    expect(read.body.letter).toMatchObject({ kind: 'provisional', replyBy: null });
    // The course is matched by code, as a short list the learner chooses from.
    expect(read.body.candidates[0]).toBe('uj-beng-civil');
    // Read, not confirmed: no offer exists yet.
    expect((await list(browser)).body.offers).toEqual([]);

    const saved = await add(browser, {
      programmeId: read.body.candidates[0],
      kind: read.body.letter?.kind,
      replyBy: '2026-11-20',
      conditions: read.body.letter?.conditions,
      documentId: read.body.documentId,
    });
    expect(saved.status).toBe(201);
    expect(saved.body.offers[0]).toMatchObject({
      source: 'letter',
      conditions: read.body.letter?.conditions,
    });
  });

  it('a report’s upload can’t be the source of an offer, and an unknown kind is refused', async () => {
    const { browser } = await adult();
    const report = await upload(browser, 'grade-11-report');
    expect(report.body).toHaveProperty('draft');
    const res = await add(browser, { ...OFFER, documentId: report.body.documentId });
    expect(res.status).toBe(400);
    expect((await upload(browser, 'passport')).status).toBe(400);
  });

  it('a letter can’t be confirmed as a report’s source; a report can (A1-31)', async () => {
    const { browser } = await adult();
    const marks = [
      'english-hl',
      'afrikaans-fal',
      'mathematics',
      'physical-sciences',
      'life-orientation',
      'geography',
      'life-sciences',
    ].map((subject) => ({ subject, percent: 70 }));
    const letter = await upload(browser, 'acceptance-letter');
    const refused = await browser.json(routes.reports, '/api/reports', {
      json: { kind: 'grade-11-final', marks, documentId: letter.body.documentId },
    });
    expect(refused.status).toBe(400);
    const report = await upload(browser, 'grade-11-report');
    const saved = await browser.json(routes.reports, '/api/reports', {
      json: { kind: 'grade-11-final', marks, documentId: report.body.documentId },
    });
    expect(saved.status).toBe(200);
  });
});

describe('the reply-by reminder goes through the 4a pipeline', () => {
  it('is due at 18:00 three days before, or now, and never once the date has passed', () => {
    const now = new Date('2026-10-14T16:00:00Z');
    expect(replyByReminderAt('2026-10-30', now)?.toISOString()).toBe('2026-10-27T16:00:00.000Z');
    expect(replyByReminderAt('2026-10-15', now)).toEqual(now);
    expect(replyByReminderAt('2026-10-14', now)).toEqual(now);
    expect(replyByReminderAt('2026-10-13', now)).toBeNull();
  });

  it('scheduled with the offer; it names nothing on the way; accepting drops it and its job', async () => {
    const { browser, number } = await adult({ sms: true });
    const added = await add(browser);
    expect(added.body.remindersOn).toBe(true);
    expect(added.body.offers[0]?.reminderAt).toBe('2026-10-27T16:00:00.000Z');
    const [waiting] = await replyByReminders(browser);
    expect(waiting).toMatchObject({ status: 'scheduled' });

    const { messaging, store, jobs } = await getServices();
    const studentId = (await messaging.reminder(waiting?.id ?? ''))?.studentId ?? '';
    const [jobId] = await store.forStudent(studentId).scheduledJobIds();

    const accepted = await change(browser, added.body.id, 'accept');
    expect(accepted.body.offers[0]).toMatchObject({ status: 'accepted', reminderAt: null });
    expect((await replyByReminders(browser))[0]).toMatchObject({
      status: 'dropped',
      outcomeReason: 'offer-closed',
    });
    expect((await jobs.get(jobId ?? ''))?.status).toBe('cancelled');
    await runJobs('2026-10-27T16:00:00Z');
    expect((await smsTo(number)).filter((b) => /needs your answer/.test(b))).toEqual([]);
  });

  it('when due, the SMS says only that a place needs an answer', async () => {
    const { browser, number } = await adult({ sms: true });
    await add(browser, { ...OFFER, replyBy: '2026-10-15' });
    await runJobs();
    const sent = (await smsTo(number)).filter((b) => /needs your answer/.test(b));
    expect(sent).toEqual([
      toGsm7Typography(renderMessage('offer.reply-by', { universityName: 'UJ' }, 'sms')),
    ]);
    expect(sent[0]).not.toMatch(/UJ|Johannesburg|engineering|provisional|\d/i);
  });

  it('waits out quiet hours, and sends nothing once the learner opts out (4a rules)', async () => {
    const { browser, number } = await adult({ sms: true });
    await add(browser, { ...OFFER, replyBy: '2026-10-15' });
    // 23:30 in South Africa: held, not sent, not dropped.
    await runJobs('2026-10-14T21:30:00Z');
    expect((await smsTo(number)).filter((b) => /needs your answer/.test(b))).toEqual([]);
    expect((await replyByReminders(browser))[0]?.status).toBe('scheduled');
    await browser.json(routes.messaging.PUT, '/api/me/messaging', {
      method: 'PUT',
      json: { channel: 'sms', optedIn: false },
    });
    await runJobs('2026-10-15T08:00:00Z');
    expect((await smsTo(number)).filter((b) => /needs your answer/.test(b))).toEqual([]);
  });

  it('declining or deleting the offer drops it too', async () => {
    for (const close of ['decline', 'delete'] as const) {
      const { browser } = await adult({ sms: true });
      const { id } = (await add(browser)).body;
      if (close === 'decline') await change(browser, id, 'decline');
      else expect((await remove(browser, id)).body.offers).toEqual([]);
      expect((await replyByReminders(browser))[0], close).toMatchObject({
        status: 'dropped',
        outcomeReason: 'offer-closed',
      });
    }
  });
});

describe('the registration-day reminder (5d, A1-33)', () => {
  const today = new Date('2026-10-14T16:00:00Z');
  const preview = catalogueView(today, { includeDrafts: true });
  const learners = catalogueView(today, { includeDrafts: false });
  const tut = { universityId: 'tut', programmeId: 'tut-dip-information-technology' };
  const up = { universityId: 'up', programmeId: 'up-beng-civil' };

  it('is due at 18:00 three days before first-year registration opens', () => {
    expect(REGISTRATION_DAY_REMINDER_DAYS).toBe(3);
    // TUT's 2027 calendar publishes the opening day.
    const opens = registrationCalendarFor(preview, 'tut', 2027)?.firstYearRegistration.from;
    expect(opens).toBe('2027-01-14');
    expect(registrationDayReminderAt(preview, tut, today)?.toISOString()).toBe(
      '2027-01-11T16:00:00.000Z',
    );
    // Within the three days: now. On the day itself: now.
    const close = new Date('2027-01-12T08:00:00Z');
    expect(registrationDayReminderAt(preview, tut, close)).toEqual(close);
    const onTheDay = new Date('2027-01-14T06:00:00Z');
    expect(registrationDayReminderAt(preview, tut, onTheDay)).toEqual(onTheDay);
  });

  it('from the close when the calendar gives only the close (#69)', () => {
    const window = registrationCalendarFor(preview, 'up', 2027)?.firstYearRegistration;
    expect(window).toEqual({ to: '2027-01-30' });
    expect(registrationDayReminderAt(preview, up, today)?.toISOString()).toBe(
      '2027-01-27T16:00:00.000Z',
    );
  });

  it('UJ: three days before the opening its 2027 calendar prints, though it prints no change deadline', () => {
    expect(
      registrationDayReminderAt(
        preview,
        { universityId: 'uj', programmeId: 'uj-beng-civil' },
        today,
      )?.toISOString(),
    ).toBe('2027-01-08T16:00:00.000Z');
  });

  it('none once the day has passed', () => {
    // TUT opened on 14 January: the day has passed, even though registration is still open.
    expect(registrationDayReminderAt(preview, tut, new Date('2027-01-15T08:00:00Z'))).toBeNull();
    expect(registrationDayReminderAt(preview, up, new Date('2027-01-31T08:00:00Z'))).toBeNull();
  });

  it('none without a calendar, or with one for another academic year (A13-02)', () => {
    // Wits publishes no university-wide registration calendar in the catalogue.
    expect(
      registrationDayReminderAt(
        preview,
        { universityId: 'wits', programmeId: 'wits-bsceng-civil' },
        today,
      ),
    ).toBeNull();
    // UCT's calendar is for 2026; the offer's course is for 2027.
    expect(registrationCalendarFor(preview, 'uct', 2026)).toBeDefined();
    expect(
      registrationDayReminderAt(
        preview,
        { universityId: 'uct', programmeId: 'uct-bsc-computer-science' },
        today,
      ),
    ).toBeNull();
    const nextYears: CatalogueView = {
      ...preview,
      registrationCalendars: preview.registrationCalendars.map((c) => ({
        ...c,
        academicYear: c.academicYear + 1,
      })),
    };
    expect(registrationDayReminderAt(nextYears, tut, today)).toBeNull();
  });

  it('only what the learner may see: a draft calendar never outside preview (hard rule 3)', () => {
    // The course is visible, the calendar is a draft and so is not.
    const draftCalendar: CatalogueView = {
      ...preview,
      registrationCalendars: learners.registrationCalendars,
    };
    expect(registrationDayReminderAt(draftCalendar, tut, today)).toBeNull();
    expect(registrationDayReminderAt(learners, tut, today)).toBeNull();
    // A course the learner may not see, or one at another university than the offer says.
    expect(
      registrationDayReminderAt(preview, { universityId: 'tut', programmeId: 'nope-nope' }, today),
    ).toBeNull();
    expect(registrationDayReminderAt(preview, { ...tut, universityId: 'up' }, today)).toBeNull();
  });

  const UP_OFFER = { ...OFFER, programmeId: 'up-beng-civil', replyBy: null };

  async function registrationReminders(browser: Browser) {
    const { body } = await browser.json<{
      reminders: Array<{
        id: string;
        templateId: string;
        channel: string;
        status: string;
        outcomeReason: string | null;
        desiredAt: string;
      }>;
    }>(routes.reminders.GET, '/api/me/reminders');
    return body.reminders.filter((r) => r.templateId === 'offer.registration-day');
  }

  /** A reminder's catalogue references, as the pipeline reads them when it is due. */
  async function paramsOf(id: string | undefined) {
    const { messaging } = await getServices();
    return (await messaging.reminder(id ?? ''))?.params;
  }

  it('scheduled when an offer is accepted, on the first opted-in channel; never twice', async () => {
    const { browser } = await adult({ sms: true });
    const { id } = (await add(browser, UP_OFFER)).body;
    expect((await list(browser)).body.registrationReminderAt).toBeNull();
    const accepted = await change(browser, id, 'accept');
    expect(accepted.body.registrationReminderAt).toBe('2027-01-27T16:00:00.000Z');
    const reminders = await registrationReminders(browser);
    expect(reminders).toEqual([
      expect.objectContaining({
        status: 'scheduled',
        channel: 'sms',
        desiredAt: '2027-01-27T16:00:00.000Z',
      }),
    ]);
    // The university is checked when it is due, never shown.
    expect(await paramsOf(reminders[0]?.id)).toEqual({ universityId: 'up' });
    // Accepting it again schedules nothing more.
    await change(browser, id, 'accept');
    expect(await registrationReminders(browser)).toHaveLength(1);
    expect((await list(browser)).body.registrationReminderAt).toBe('2027-01-27T16:00:00.000Z');
  });

  it('on WhatsApp before SMS, as the reply-by reminder (owner’s decision, 2026-10-17)', async () => {
    const { browser } = await adult({ sms: true });
    await browser.json(routes.messaging.PUT, '/api/me/messaging', {
      method: 'PUT',
      json: { channel: 'whatsapp', optedIn: true },
    });
    const { id } = (await add(browser, UP_OFFER)).body;
    await change(browser, id, 'accept');
    expect((await registrationReminders(browser))[0]?.channel).toBe('whatsapp');
  });

  it('none with no opted-in channel, and none without a published date', async () => {
    const quiet = await adult();
    const { id } = (await add(quiet.browser, UP_OFFER)).body;
    expect((await change(quiet.browser, id, 'accept')).body.registrationReminderAt).toBeNull();
    expect(await registrationReminders(quiet.browser)).toEqual([]);

    // Wits publishes no university-wide registration calendar: nothing is invented.
    const { browser } = await adult({ sms: true });
    const wits = (await add(browser, { ...OFFER, programmeId: 'wits-bsceng-civil', replyBy: null }))
      .body.id;
    expect((await change(browser, wits, 'accept')).body.registrationReminderAt).toBeNull();
    expect(await registrationReminders(browser)).toEqual([]);
  });

  it('when due, the SMS says only that it is nearly time to register', async () => {
    const { browser, number } = await adult({ sms: true });
    const { id } = (await add(browser, UP_OFFER)).body;
    await change(browser, id, 'accept');
    await runJobs('2027-01-27T16:00:00Z');
    const sent = (await smsTo(number)).filter((b) => /time to register/.test(b));
    expect(sent).toEqual([
      toGsm7Typography(renderMessage('offer.registration-day', { universityName: 'UP' }, 'sms')),
    ]);
    expect(sent[0]).not.toMatch(/UP\b|Pretoria|engineering|civil|\d/i);
  });

  it('declining or deleting the accepted offer drops it and its job; nothing is sent', async () => {
    for (const close of ['decline', 'delete'] as const) {
      const { browser, number } = await adult({ sms: true });
      const { id } = (await add(browser, UP_OFFER)).body;
      await change(browser, id, 'accept');
      const [waiting] = await registrationReminders(browser);
      const { messaging, store, jobs } = await getServices();
      const studentId = (await messaging.reminder(waiting?.id ?? ''))?.studentId ?? '';
      const [jobId] = await store.forStudent(studentId).scheduledJobIds();

      const after =
        close === 'decline' ? await change(browser, id, 'decline') : await remove(browser, id);
      expect(after.body.registrationReminderAt, close).toBeNull();
      expect((await registrationReminders(browser))[0], close).toMatchObject({
        status: 'dropped',
        outcomeReason: 'offer-closed',
      });
      expect((await jobs.get(jobId ?? ''))?.status, close).toBe('cancelled');
      await runJobs('2027-01-27T16:00:00Z');
      expect(
        (await smsTo(number)).filter((b) => /time to register/.test(b)),
        close,
      ).toEqual([]);
    }
  });

  it('accepting another offer instead: the first one’s goes, the new one’s is scheduled', async () => {
    const { browser } = await adult({ sms: true });
    const a = (await add(browser, UP_OFFER)).body.id;
    const b = (
      await add(browser, { ...OFFER, programmeId: 'tut-dip-information-technology', replyBy: null })
    ).body.id;
    await change(browser, a, 'accept');
    expect((await change(browser, b, 'accept')).status).toBe(409);
    await change(browser, a, 'decline');
    expect((await change(browser, b, 'accept')).body.registrationReminderAt).toBe(
      '2027-01-11T16:00:00.000Z',
    );
    const reminders = await registrationReminders(browser);
    const byUniversity = await Promise.all(
      reminders.map(async (r) => [(await paramsOf(r.id))?.['universityId'], r.status]),
    );
    expect(byUniversity.sort()).toEqual([
      ['tut', 'scheduled'],
      ['up', 'dropped'],
    ]);
  });
});

describe('the January re-check, on confirmed final results', () => {
  const marks = (percent: number) =>
    [
      'english-hl',
      'afrikaans-fal',
      'mathematics',
      'physical-sciences',
      'life-sciences',
      'geography',
      'life-orientation',
    ].map((subject) => ({ subject, percent }));

  it('waits for final results; then met or not met, with Plan B; a June report never counts', async () => {
    const { browser } = await adult();
    await add(browser);
    await add(browser, { ...OFFER, programmeId: 'uj-beng-electrical', kind: 'final' });
    const june = await browser.json(routes.reports, '/api/reports', {
      json: { kind: 'grade-12-june', marks: marks(90) },
    });
    expect(june.body).toMatchObject({ offersToCheck: 0 });
    expect((await list(browser)).body.offers[0]?.finalCheck).toBeNull();

    const final = await browser.json(routes.reports, '/api/reports', {
      json: { kind: 'grade-12-final', marks: marks(52) },
    });
    // Only the provisional offer is checked: the final one needs none.
    expect(final.body).toMatchObject({ offersToCheck: 1 });
    const [provisional, finalOffer] = (await list(browser)).body.offers;
    expect(provisional?.finalCheck?.status).toBe('not-met');
    expect(provisional?.finalCheck?.planB.length).toBeGreaterThan(0);
    expect(finalOffer?.finalCheck).toBeNull();

    await browser.json(routes.reports, '/api/reports', {
      json: { kind: 'grade-12-final', marks: marks(90) },
    });
    expect((await list(browser)).body.offers[0]?.finalCheck).toMatchObject({
      status: 'met',
      planB: [],
    });
  });
});
