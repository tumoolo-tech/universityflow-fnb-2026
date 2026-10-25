import type { MyModulesArtifact } from '@universityflow/agent';
import { renderMessage } from '@universityflow/content';
import type { RegistrationDraft } from '@universityflow/documents';
import { toGsm7Typography } from '@universityflow/messaging';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { E2E_REGISTRATION_PROGRAMME } from '../lib/server/e2e-fixtures';
import { changeDeadlineReminderAt, likelyAcademicYear } from '../lib/server/registration';
import { agreeAsAdult } from './adult-consent';
import { Browser } from './harness';
import { withoutIds } from './no-phone';

/**
 * Phase 5c over the real route handlers, an embedded database and the local stand-ins: a proof of
 * registration read into a draft, nothing compared until the learner confirms every row (hard
 * rule 6), My modules from the same code as the agent's tool, and the change-deadline reminder
 * through 4a's pipeline (only while there is something to fix; dropped on a clean re-confirm).
 *
 * The catalogue is the preview one plus the E2E fixtures: a synthetic TEST-coded curriculum for
 * one programme, so a verdict exists to test. UP's draft faculty office and 2027 calendar are the
 * catalogue's own. The clock is pinned (Date only) to 18:00 in South Africa.
 */

process.env['UF_CATALOGUE_E2E_FIXTURES'] = '1';
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
  offers: await import('../app/api/offers/route'),
  offer: await import('../app/api/offers/[id]/route'),
  registration: await import('../app/api/registration/route'),
  registrationId: await import('../app/api/registration/[id]/route'),
  runJobs: (await import('../app/api/dev/jobs/run/route')).POST,
  outbox: (await import('../app/api/dev/outbox/route')).GET,
};

let n = 7_500_000;
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

interface RegistrationBody {
  modules: MyModulesArtifact | null;
  acceptedProgrammeId: string | null;
  options: Array<{ id: string }>;
  remindersOn: boolean;
  defaultYear: number;
}

const MODULES = [
  { code: 'TEST101', name: 'Sample module one', term: 'S1', credits: 16 },
  { code: 'TEST102', name: 'Sample module two', term: 'S1', credits: 16 },
  { code: 'TEST103', name: 'Sample module three', term: 'S2', credits: 16 },
];
const CONFIRMED = {
  programmeId: E2E_REGISTRATION_PROGRAMME,
  academicYear: 2027,
  yearOfStudy: 1,
  modules: MODULES,
};

const get = (browser: Browser) =>
  browser.json<RegistrationBody>(routes.registration.GET, '/api/registration');
const confirm = (browser: Browser, body: Record<string, unknown> = CONFIRMED) =>
  browser.json<RegistrationBody & { id: string }>(routes.registration.PUT, '/api/registration', {
    method: 'PUT',
    json: body,
  });
const remove = (browser: Browser, id: string) =>
  browser.json<RegistrationBody>(routes.registrationId.DELETE, `/api/registration/${id}`, {
    method: 'DELETE',
    params: { id },
  });

const upload = async (browser: Browser, kind: string) => {
  const form = new FormData();
  form.append('kind', kind);
  form.append(
    'file',
    new Blob([new TextEncoder().encode('%PDF-1.7\nsynthetic proof\n%%EOF')], {
      type: 'application/pdf',
    }),
    'proof.pdf',
  );
  return browser.json<{
    documentId: string;
    registration?: RegistrationDraft | null;
    draft?: unknown;
    sample: boolean;
  }>(routes.documents.POST, '/api/documents', { body: form, method: 'POST' });
};

async function deadlineReminders(browser: Browser) {
  const { body } = await browser.json<{
    reminders: Array<{ id: string; templateId: string; status: string; outcomeReason: string }>;
  }>(routes.reminders.GET, '/api/me/reminders');
  return body.reminders.filter((r) => r.templateId === 'registration.change-deadline');
}

describe('a proof of registration, confirmed row by row (hard rule 6)', () => {
  it('is read into a draft with nothing personal; nothing is compared until confirmed', async () => {
    const { browser } = await adult();
    expect((await get(browser)).body.modules).toBeNull();
    const read = await upload(browser, 'proof-of-registration');
    expect(read.status).toBe(200);
    expect(read.body.sample).toBe(true);
    expect(read.body.registration?.modules.map((m) => m.code)).toEqual([
      'TEST101',
      'TEST102',
      'TEST103',
    ]);
    expect(read.body.registration?.modules[0]?.term).toBe('S1');
    // IDs blanked first: a random UUID can spell "fee" in hex.
    expect(withoutIds(JSON.stringify(read.body))).not.toMatch(
      /studentNumber|idNumber|address|fee/i,
    );
    // Read, not confirmed: nothing to check yet.
    expect((await get(browser)).body.modules).toBeNull();

    const saved = await confirm(browser, { ...CONFIRMED, documentId: read.body.documentId });
    expect(saved.status).toBe(200);
    const artifact = saved.body.modules;
    expect(artifact).toMatchObject({
      kind: 'my-modules',
      status: 'checked',
      academicYear: 2027,
      includesDrafts: true,
      curriculum: { academicYear: 2027, draft: true },
      office: {
        faculty: 'Engineering, Built Environment and Information Technology',
        draft: true,
      },
    });
    // Exactly one missing module, explained; who to see; the message; the deadline.
    expect(artifact?.differences.map((d) => d.difference.kind)).toEqual(['missing-compulsory']);
    expect(artifact?.differences[0]?.text).toMatch(/TEST104/);
    expect(artifact?.message).toMatch(/TEST104/);
    expect(artifact?.deadlines).toMatchObject({
      status: 'published',
      next: { appliesTo: 'S2', lastDay: '2027-07-30' },
    });
  });

  it('a report’s upload can’t be a registration’s source; bad rows and unknown courses are refused', async () => {
    const { browser } = await adult();
    const report = await upload(browser, 'grade-11-report');
    expect(report.body).toHaveProperty('draft');
    expect(
      (await confirm(browser, { ...CONFIRMED, documentId: report.body.documentId })).status,
    ).toBe(400);
    for (const bad of [
      { ...CONFIRMED, programmeId: 'nope-nope' },
      { ...CONFIRMED, modules: [] },
      { ...CONFIRMED, modules: [{ ...MODULES[0], code: '*?' }] },
      { ...CONFIRMED, modules: [{ ...MODULES[0], term: 'either' }] },
      { ...CONFIRMED, studentNumber: '20261234' },
      { ...CONFIRMED, modules: [{ ...MODULES[0], fees: 1000 }] },
    ]) {
      const res = await confirm(browser, bad);
      expect([400, 404], JSON.stringify(bad)).toContain(res.status);
    }
    expect((await get(browser)).body.modules).toBeNull();
  });

  it('starts from the accepted offer’s course, and a likely year', async () => {
    const { browser } = await adult();
    const added = await browser.json<{ id: string }>(routes.offers.POST, '/api/offers', {
      json: {
        programmeId: E2E_REGISTRATION_PROGRAMME,
        kind: 'final',
        replyBy: null,
        conditions: [],
      },
    });
    await browser.json(routes.offer.PATCH, `/api/offers/${added.body.id}`, {
      method: 'PATCH',
      json: { action: 'accept' },
      params: { id: added.body.id },
    });
    const body = (await get(browser)).body;
    expect(body.acceptedProgrammeId).toBe(E2E_REGISTRATION_PROGRAMME);
    expect(body.defaultYear).toBe(2027);
    expect(likelyAcademicYear(new Date('2027-02-01T08:00:00Z'))).toBe(2027);
  });

  it('gives no verdict without a curriculum record, and still says who to see', async () => {
    const { browser } = await adult();
    const saved = await confirm(browser, { ...CONFIRMED, programmeId: 'up-llb' });
    expect(saved.body.modules).toMatchObject({
      status: 'no-curriculum',
      differences: [],
      message: null,
      curriculum: null,
      office: { faculty: 'Law' },
    });
  });

  it('refuses a minor waiting for a guardian (hard rule 5); is exported; goes with the account', async () => {
    const minor = await signedIn();
    await minor.browser.json(routes.dob, '/api/me/date-of-birth', {
      json: { dateOfBirth: '2010-05-05' },
    });
    expect((await get(minor.browser)).status).toBe(403);
    expect((await confirm(minor.browser)).status).toBe(403);

    const { browser } = await adult();
    const { id } = (await confirm(browser)).body;
    const exported = await browser.json<{ personal: { registrations: unknown[] } }>(
      routes.exportData,
      '/api/me/export',
    );
    expect(exported.body.personal.registrations).toHaveLength(1);
    expect(JSON.stringify(exported.body.personal.registrations)).not.toMatch(/studentNumber/);
    // Another learner can't remove it.
    const other = await adult();
    expect((await remove(other.browser, id)).status).toBe(404);
    expect((await browser.json(routes.me.DELETE, '/api/me', { method: 'DELETE' })).status).toBe(
      200,
    );
  });
});

describe('confirming reads each record once (A4-12)', () => {
  /**
   * Every store read is its own transaction (BEGIN, set_config, set role, uf_may_process, query,
   * COMMIT): the learner's store is wrapped so the PUT's reads can be counted.
   */
  async function counting() {
    const { store } = await getServices();
    const real = store.forStudent.bind(store);
    const counts = { registration: 0, messagingPreferences: 0, offers: 0 };
    const spy = vi.spyOn(store, 'forStudent').mockImplementation((id: string) => {
      const student = real(id);
      return new Proxy(student, {
        get(target, name, receiver) {
          const value = Reflect.get(target, name, receiver);
          if (typeof value !== 'function') return value;
          return (...args: unknown[]) => {
            if (typeof name === 'string' && name in counts) counts[name as keyof typeof counts]++;
            return value.apply(target, args);
          };
        },
      });
    });
    return { counts, restore: () => spy.mockRestore() };
  }

  it('PUT reads the registration and the messaging preferences once each', async () => {
    // With something to fix and a channel: the path that reads the preferences for the reminder.
    const { browser } = await adult({ sms: true });
    const { counts, restore } = await counting();
    try {
      const saved = await confirm(browser);
      expect(saved.status).toBe(200);
      expect(saved.body.remindersOn).toBe(true);
      expect(saved.body.modules?.reminderAt).toBe('2027-07-27T16:00:00.000Z');
      expect(counts).toEqual({ registration: 1, messagingPreferences: 1, offers: 1 });
    } finally {
      restore();
    }
    // What the PUT answered from its single reads is what a fresh GET reads.
    const { id: _id, ...answered } = (await confirm(browser)).body;
    expect(answered).toEqual((await get(browser)).body);
  });

  it('and once each when there is nothing to remind about', async () => {
    const { browser } = await adult();
    const { counts, restore } = await counting();
    try {
      const saved = await confirm(browser, {
        ...CONFIRMED,
        modules: [...MODULES, { code: 'TEST104', name: null, term: 'S2', credits: 16 }],
      });
      expect(saved.body).toMatchObject({ remindersOn: false, modules: { differences: [] } });
      expect(counts).toEqual({ registration: 1, messagingPreferences: 1, offers: 1 });
    } finally {
      restore();
    }
  });
});

describe('the change-deadline reminder goes through the 4a pipeline', () => {
  it('is due at 18:00 three days before, or now, and never once the day has passed', () => {
    const now = new Date('2027-02-01T16:00:00Z');
    expect(changeDeadlineReminderAt('2027-02-19', now)?.toISOString()).toBe(
      '2027-02-16T16:00:00.000Z',
    );
    expect(changeDeadlineReminderAt('2027-02-02', now)).toEqual(now);
    expect(changeDeadlineReminderAt('2027-01-31', now)).toBeNull();
  });

  it('scheduled only while there is something to fix; a clean re-confirm drops it and its job', async () => {
    const { browser, number } = await adult({ sms: true });
    const saved = await confirm(browser);
    expect(saved.body.remindersOn).toBe(true);
    expect(saved.body.modules?.reminderAt).toBe('2027-07-27T16:00:00.000Z');
    const [waiting] = await deadlineReminders(browser);
    expect(waiting).toMatchObject({ status: 'scheduled' });

    const { messaging, store, jobs } = await getServices();
    const studentId = (await messaging.reminder(waiting?.id ?? ''))?.studentId ?? '';
    const [jobId] = await store.forStudent(studentId).scheduledJobIds();

    const clean = await confirm(browser, {
      ...CONFIRMED,
      modules: [...MODULES, { code: 'TEST104', name: null, term: 'S2', credits: 16 }],
    });
    expect(clean.body.modules).toMatchObject({ differences: [], reminderAt: null, message: null });
    const after = await deadlineReminders(browser);
    expect(after).toEqual([
      expect.objectContaining({ status: 'dropped', outcomeReason: 'registration-changed' }),
    ]);
    expect((await jobs.get(jobId ?? ''))?.status).toBe('cancelled');
    await new Browser().json(routes.runJobs, '/api/dev/jobs/run', {
      method: 'POST',
      json: { at: '2027-07-27T16:00:00Z' },
    });
    expect((await smsTo(number)).filter((b) => /registration you added/.test(b))).toEqual([]);
  });

  it('when due, the SMS says only that the registration needs a change', async () => {
    const { browser, number } = await adult({ sms: true });
    await confirm(browser);
    await new Browser().json(routes.runJobs, '/api/dev/jobs/run', {
      method: 'POST',
      json: { at: '2027-07-27T16:00:00Z' },
    });
    const sent = (await smsTo(number)).filter((b) => /registration you added/.test(b));
    expect(sent).toEqual([
      toGsm7Typography(
        renderMessage('registration.change-deadline', { universityName: 'UP' }, 'sms'),
      ),
    ]);
    expect(sent[0]).not.toMatch(/TEST|UP|Pretoria|module|\d/);
  });

  it('not scheduled without an opted-in channel, and dropped when the registration is removed', async () => {
    const quiet = await adult();
    expect((await confirm(quiet.browser)).body.modules?.reminderAt).toBeNull();
    expect(await deadlineReminders(quiet.browser)).toEqual([]);

    const { browser } = await adult({ sms: true });
    const { id } = (await confirm(browser)).body;
    expect((await remove(browser, id)).body.modules).toBeNull();
    expect((await deadlineReminders(browser))[0]).toMatchObject({
      status: 'dropped',
      outcomeReason: 'registration-changed',
    });
  });
});
