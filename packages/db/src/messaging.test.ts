import { catalogueView, examPapersForSuppression } from '@universityflow/catalogue';
import type { TemplateVariables } from '@universityflow/content';
import { JOB_LEASE_MS } from '@universityflow/jobs';
import {
  type ChannelName,
  isQuietHour,
  MemoryOutbox,
  MemoryWhatsAppChannel,
  type PaperSlot,
  type PaperSlotSource,
  paperAt,
  REMINDER_SWEEP_AFTER_MS,
  type RecipientGate,
  reminderHandler,
  reminderSweepHandler,
  SmsChannel,
  scheduleReminderJob,
  WEEK_MS,
} from '@universityflow/messaging';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { type Database, rowsOf } from './client';
import { ConsentRequiredError, InvalidStateError } from './errors';
import { PostgresJobScheduler } from './jobs';
import { TimetablePaperSlots } from './papers';
import { Store } from './store';
import { signIn, syntheticPhone, testDatabase } from './testing';

/**
 * The reminder pipeline end to end on real Postgres (PGlite): a reminder row → its
 * `reminder.send` job → the handler → the channel → the outbox. Every safety property of
 * planning.md §11, Phase 4a, is proven here through the whole pipeline, not only in the pure
 * cadence function: no message without channel opt-in, none for a minor without a guardian's
 * consent, none after STOP, none in quiet hours, none during a paper, never above the cap;
 * consent withdrawn or the account deleted between scheduling and sending → nothing sent.
 */

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(async () => {
  await database.close();
});
beforeEach(async () => {
  // Every test starts with an empty queue, so a runner only finds its own jobs.
  await database.exec('delete from jobs');
});

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** 10:00 on a Tuesday in South Africa. */
const START = new Date('2026-10-13T08:00:00Z');

function harness(start = START, source?: PaperSlotSource) {
  let now = start;
  const clock = () => now;
  const store = new Store(database, {
    secret: 'test-secret-that-is-long-enough-for-hmac-keys',
    clock,
  });
  const messaging = store.messaging();
  const scheduler = new PostgresJobScheduler(database, { clock });
  const outbox = new MemoryOutbox();
  const sentAt: Date[] = [];
  const gate: RecipientGate = (channel, to) => messaging.mayMessage(channel, to);
  /** After the provider takes a message: answer, drop the connection, or never come back. */
  let afterAccept: 'answer' | 'drop' | 'hang' = 'answer';
  const sms = new SmsChannel(
    {
      send: async (message) => {
        sentAt.push(clock());
        const receipt = await outbox.send(message);
        if (afterAccept === 'drop') throw new Error('socket hang up');
        if (afterAccept === 'hang') return new Promise(() => undefined);
        return receipt;
      },
    },
    { gate, clock },
  );
  const whatsapp = new MemoryWhatsAppChannel({ gate, clock });
  let papers: PaperSlot[] = [];
  const handler = reminderHandler({
    store: messaging,
    channels: { sms, whatsapp },
    scheduler,
    papers: source ?? { slotsFor: async () => papers },
    resolve: (): TemplateVariables => ({}),
    clock,
  });

  return {
    store,
    messaging,
    scheduler,
    outbox,
    sentAt,
    whatsapp,
    handler,
    now: clock,
    advance(ms: number) {
      now = new Date(now.getTime() + ms);
    },
    setPapers(slots: PaperSlot[]) {
      papers = slots;
    },
    afterAccept(mode: 'answer' | 'drop' | 'hang') {
      afterAccept = mode;
    },
    /** An adult who has agreed in their own name (A7-04), opted in to `channels`. */
    async adult(n: number, channels: ChannelName[] = ['sms']) {
      const phone = syntheticPhone(n);
      const { studentId } = await signIn(store, phone);
      await store.setDateOfBirth(studentId, '2000-01-15');
      await store.consentAsAdult(studentId, 'adult-v1-test');
      const student = store.forStudent(studentId);
      for (const channel of channels) await student.setChannelOptIn(channel, true);
      return { studentId, phone, student };
    },
    /** A reminder and its job, as the app schedules them. */
    async schedule(studentId: string, at = clock(), channel: ChannelName = 'sms') {
      const student = store.forStudent(studentId);
      const id = await student.createReminder({
        templateId: 'reminder.check-in',
        channel,
        desiredAt: at,
      });
      const jobId = await scheduleReminderJob(scheduler, id, at, 0);
      await student.setReminderJob(id, jobId);
      return { id, jobId };
    },
    run: () => scheduler.runDue([handler]),
  };
}

async function reminderRow(id: string) {
  const [row] = rowsOf<{
    status: string;
    outcome_reason: string | null;
    job_id: string | null;
    receipt_id: string | null;
    delivery_status: string | null;
    billed_category: string | null;
    sent_at: Date | null;
  }>(await database.db.execute(sql`select * from reminders where id = ${id}::uuid`));
  return row ?? null;
}

/** A minor whose guardian agreed to `version` of the consent wording (v2 names messaging). */
async function minorWithConsent(h: ReturnType<typeof harness>, n: number, version = 'v2-2026-10') {
  const phone = syntheticPhone(n);
  const { studentId } = await signIn(h.store, phone);
  await h.store.setDateOfBirth(studentId, '2010-03-03');
  const { token } = await h.store.requestGuardianConsent(
    studentId,
    { name: 'Test Guardian', phone: syntheticPhone(n + 1), relationship: 'parent' },
    version,
  );
  await h.store.grantConsent(token);
  return { studentId, phone, token, student: h.store.forStudent(studentId) };
}

describe('the reminder pipeline: schedule → due → handler → channel', () => {
  it('sends a due reminder to an opted-in learner, without their name, and records it', async () => {
    const h = harness();
    const { studentId, phone, student } = await h.adult(5101);
    await student.updateProfile({ displayName: 'Lebo Mokoena' });
    const { id, jobId } = await h.schedule(studentId);

    const report = await h.run();
    expect(report.completed).toEqual([jobId]);
    // GSM-7 typography on SMS (A1-14); nothing personal, the name included (A11-02); how to
    // stop (A12-10).
    const body = h.outbox.to(phone)[0]?.body;
    expect(body).toBe(
      'UniversityFlow: this is the check-in reminder you set. Open the app to see your next step. Reply STOP to stop.',
    );
    expect(body).not.toMatch(/Lebo|Mokoena/);
    expect(await reminderRow(id)).toMatchObject({
      status: 'sent',
      delivery_status: 'accepted',
      receipt_id: expect.stringMatching(/\S/),
    });
    expect((await student.reminders())[0]).toMatchObject({ id, status: 'sent' });
    const audit = rowsOf<{ action: string; reason: string }>(
      await database.db.execute(
        sql`select action, reason from audit_log where student_id = ${studentId}::uuid and action = 'message.sent'`,
      ),
    );
    expect(audit).toEqual([{ action: 'message.sent', reason: 'sms' }]);
  });

  it('waits for its time', async () => {
    const h = harness();
    const { studentId, phone } = await h.adult(5102);
    await h.schedule(studentId, new Date(START.getTime() + 2 * HOUR));
    await h.run();
    expect(h.outbox.to(phone)).toHaveLength(0);
    h.advance(2 * HOUR);
    await h.run();
    expect(h.outbox.to(phone)).toHaveLength(1);
  });

  it('carries only the reminder id in its job (hard rule 4)', async () => {
    const h = harness();
    const { studentId } = await h.adult(5103);
    const { id, jobId } = await h.schedule(studentId);
    const job = await h.scheduler.get(jobId);
    expect(job?.payload).toEqual({ reminderId: id });
  });

  it('records a delivery report against the receipt', async () => {
    const h = harness();
    const { studentId } = await h.adult(5104);
    const { id } = await h.schedule(studentId);
    await h.run();
    const receipt = (await reminderRow(id))?.receipt_id as string;
    expect(await h.messaging.recordDelivery('sms', receipt, 'delivered')).toBe(true);
    expect(await h.messaging.recordDelivery('whatsapp', receipt, 'delivered')).toBe(false);
    expect(await h.messaging.recordDelivery('sms', 'never-issued', 'delivered')).toBe(false);
    expect((await reminderRow(id))?.delivery_status).toBe('delivered');
  });

  it('A12-09: records the category WhatsApp billed, marketing included, and only on WhatsApp', async () => {
    const h = harness();
    const { studentId } = await h.adult(5106, ['whatsapp', 'sms']);
    const { id } = await h.schedule(studentId, START, 'whatsapp');
    await h.run();
    const receipt = (await reminderRow(id))?.receipt_id as string;
    expect(await h.messaging.recordDelivery('whatsapp', receipt, 'delivered', 'marketing')).toBe(
      true,
    );
    expect(await reminderRow(id)).toMatchObject({
      delivery_status: 'delivered',
      billed_category: 'marketing',
    });
    // A later report without a category keeps what was recorded.
    expect(await h.messaging.recordDelivery('whatsapp', receipt, 'delivered')).toBe(true);
    expect((await reminderRow(id))?.billed_category).toBe('marketing');
    // The database itself refuses a category we don't know, and one on another channel.
    await expect(
      database.db.execute(
        sql`update reminders set billed_category = 'authentication' where id = ${id}::uuid`,
      ),
    ).rejects.toThrow();
    const sms = await h.schedule(studentId, START, 'sms');
    await expect(
      database.db.execute(
        sql`update reminders set billed_category = 'utility' where id = ${sms.id}::uuid`,
      ),
    ).rejects.toThrow();
  });

  it('retries a provider failure and then sends', async () => {
    const h = harness();
    const { studentId, phone } = await h.adult(5105, ['whatsapp']);
    const { id } = await h.schedule(studentId, START, 'whatsapp');
    h.whatsapp.failNext();
    expect((await h.run()).retrying).toHaveLength(1);
    expect(await reminderRow(id)).toMatchObject({ status: 'scheduled', sent_at: null });
    h.advance(5 * 60 * 1000);
    await h.run();
    expect(h.whatsapp.to(phone)).toHaveLength(1);
    expect((await reminderRow(id))?.status).toBe('sent');
  });
});

describe('retries never send twice, on Postgres (A12-06, A12-14)', () => {
  it('A12-06: a provider that took the message and then failed: one message, recorded as unconfirmed', async () => {
    const h = harness();
    const { studentId, phone } = await h.adult(5601);
    const { id } = await h.schedule(studentId);
    h.afterAccept('drop');
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await h.run();
      h.advance(HOUR);
    }
    expect(h.outbox.to(phone)).toHaveLength(1);
    const row = await reminderRow(id);
    expect(row).toMatchObject({
      status: 'unconfirmed',
      outcome_reason: 'unknown-outcome',
      receipt_id: null,
    });
    // It may have reached the phone, so it still counts towards the learner's cap.
    expect(row?.sent_at).not.toBeNull();
  });

  it('A12-14: a runner that dies after the claim: swept to failed (unknown-outcome), never resent', async () => {
    const h = harness();
    const { studentId, phone } = await h.adult(5602);
    const { id } = await h.schedule(studentId);
    const sweeper = reminderSweepHandler({ store: h.messaging, clock: h.now });
    h.afterAccept('hang');
    void h.scheduler.runDue([h.handler, sweeper]); // the runner that dies mid-send
    await vi.waitFor(() => expect(h.outbox.to(phone)).toHaveLength(1), { timeout: 15_000 });
    expect((await reminderRow(id))?.status).toBe('sending');

    h.afterAccept('answer');
    // The job's lease runs out; another runner takes it over, finds the claim, sends nothing.
    h.advance(JOB_LEASE_MS);
    await h.scheduler.runDue([h.handler, sweeper]);
    expect((await reminderRow(id))?.status).toBe('sending');
    h.advance(REMINDER_SWEEP_AFTER_MS - JOB_LEASE_MS);
    await h.scheduler.runDue([h.handler, sweeper]);
    expect(await reminderRow(id)).toMatchObject({
      status: 'failed',
      outcome_reason: 'unknown-outcome',
      sent_at: null,
    });
    h.advance(DAY);
    await h.scheduler.runDue([h.handler, sweeper]);
    expect(h.outbox.to(phone)).toHaveLength(1);
    // The sweep job carried the reminder's id only (hard rule 4).
    const [sweep] = rowsOf<{ payload: unknown }>(
      await database.db.execute(sql`select payload from jobs where kind = 'reminder.sweep'`),
    );
    expect(sweep?.payload).toEqual({ reminderId: id });
  });

  it('A12-14: the sweep never touches a claim younger than the lease, or a reminder that was sent', async () => {
    const h = harness();
    const { studentId } = await h.adult(5603);
    const { id } = await h.schedule(studentId);
    await h.run();
    expect((await reminderRow(id))?.status).toBe('sent');
    const cutoff = new Date(h.now().getTime() + DAY);
    expect(await h.messaging.sweepStale(id, cutoff, h.now())).toBe(false);
    expect((await reminderRow(id))?.status).toBe('sent');

    const other = await h.schedule(studentId, new Date(h.now().getTime() + DAY));
    await database.db.execute(
      sql`update reminders set status = 'sending', sent_at = ${h.now().toISOString()}::timestamptz where id = ${other.id}::uuid`,
    );
    const before = new Date(h.now().getTime() - 1);
    expect(await h.messaging.sweepStale(other.id, before, h.now())).toBe(false);
    expect(await h.messaging.sweepStale(other.id, h.now(), h.now())).toBe(true);
    expect(await reminderRow(other.id)).toMatchObject({
      status: 'failed',
      outcome_reason: 'unknown-outcome',
    });
  });
});

describe('consent and opt-in, proven through the whole pipeline', () => {
  it('sends nothing without the channel opt-in', async () => {
    const h = harness();
    const { studentId, phone } = await h.adult(5201, []);
    const { id } = await h.schedule(studentId);
    await h.run();
    expect(h.outbox.to(phone)).toHaveLength(0);
    expect(await reminderRow(id)).toMatchObject({
      status: 'dropped',
      outcome_reason: 'not-opted-in',
    });
  });

  it('sends nothing on a channel other than the one opted in to', async () => {
    const h = harness();
    const { studentId, phone } = await h.adult(5202, ['sms']);
    const { id } = await h.schedule(studentId, START, 'whatsapp');
    await h.run();
    expect(h.whatsapp.to(phone)).toHaveLength(0);
    expect((await reminderRow(id))?.outcome_reason).toBe('not-opted-in');
  });

  it("refuses a minor's opt-in and reminders before a guardian consents (hard rule 5)", async () => {
    const h = harness();
    const { studentId } = await signIn(h.store, syntheticPhone(5203));
    await h.store.setDateOfBirth(studentId, '2010-03-03');
    const student = h.store.forStudent(studentId);
    await expect(student.setChannelOptIn('sms', true)).rejects.toThrow(ConsentRequiredError);
    await expect(student.messagingPreferences()).rejects.toThrow(ConsentRequiredError);
    await expect(
      student.createReminder({ templateId: 'reminder.check-in', channel: 'sms', desiredAt: START }),
    ).rejects.toThrow(ConsentRequiredError);
  });

  it('sends nothing to a minor without consent, even if a reminder got into the database', async () => {
    const h = harness();
    const phone = syntheticPhone(5204);
    const { studentId } = await signIn(h.store, phone);
    await h.store.setDateOfBirth(studentId, '2010-03-03');
    // Written past the application (as the owner), with an opt-in, as a bug might.
    await database.db.execute(sql`
      insert into messaging_channels (student_id, channel, opted_in, opted_in_at, updated_at)
      values (${studentId}::uuid, 'sms', true, now(), now())`);
    const [row] = rowsOf<{ id: string }>(
      await database.db.execute(sql`
        insert into reminders (student_id, template_id, channel, desired_at, created_at, updated_at)
        values (${studentId}::uuid, 'reminder.check-in', 'sms', ${START.toISOString()}::timestamptz, now(), now())
        returning id`),
    );
    const id = row?.id as string;
    await scheduleReminderJob(h.scheduler, id, START, 0);
    expect(await h.messaging.mayMessage('sms', phone)).toBe(false);
    await h.run();
    expect(h.outbox.to(phone)).toHaveLength(0);
    expect(await reminderRow(id)).toMatchObject({
      status: 'dropped',
      outcome_reason: 'no-consent',
    });
  });

  it("sends to a minor once a guardian has consented (§7.1: the guardian's consent covers it)", async () => {
    const h = harness();
    const { studentId, phone, student } = await minorWithConsent(h, 5205);
    await student.setChannelOptIn('sms', true);
    await h.schedule(studentId);
    await h.run();
    expect(h.outbox.to(phone)).toHaveLength(1);
  });

  it('A11-01: refuses a minor’s opt-in when the guardian agreed to wording without messaging (v1)', async () => {
    const h = harness();
    const { student } = await minorWithConsent(h, 5230, 'v1');
    for (const channel of ['sms', 'whatsapp', 'push'] as const) {
      await expect(student.setChannelOptIn(channel, true)).rejects.toMatchObject({
        name: 'ConsentOutdatedError',
      });
    }
    expect((await student.messagingPreferences()).channels.every((c) => c.optedIn === false)).toBe(
      true,
    );
    // Turning a channel off is always allowed.
    await student.setChannelOptIn('sms', false);
  });

  it('A11-01: allows it once the guardian agreed to wording that names messaging (v2)', async () => {
    const h = harness();
    const { student } = await minorWithConsent(h, 5232, 'v2-2026-10');
    await student.setChannelOptIn('sms', true);
    expect((await student.messagingPreferences()).channels).toContainEqual(
      expect.objectContaining({ channel: 'sms', optedIn: true }),
    );
  });

  it('consent withdrawn between scheduling and sending: nothing is sent', async () => {
    const h = harness();
    const { studentId, phone, student, token } = await minorWithConsent(h, 5207);
    await student.setChannelOptIn('sms', true);
    const { id } = await h.schedule(studentId, new Date(START.getTime() + HOUR));
    await h.store.withdrawConsent(token);
    h.advance(HOUR);
    await h.run();
    expect(h.outbox.to(phone)).toHaveLength(0);
    expect(await reminderRow(id)).toMatchObject({
      status: 'dropped',
      outcome_reason: 'no-consent',
    });
  });

  it('A1-33: the registration-day reminder: offer declined, or consent withdrawn, between scheduling and sending: nothing is sent', async () => {
    for (const between of ['decline', 'withdraw'] as const) {
      const h = harness();
      const n = between === 'decline' ? 5801 : 5803;
      const { phone, student, token } = await minorWithConsent(h, n);
      await student.setChannelOptIn('sms', true);
      const offerId = await student.addOffer({
        universityId: 'uj',
        programmeId: 'uj-beng-civil',
        kind: 'final',
        replyBy: null,
        conditions: [],
      });
      expect((await student.acceptOffer(offerId)).newlyAccepted).toBe(true);
      const at = new Date(START.getTime() + HOUR);
      const id = await student.createReminder({
        templateId: 'offer.registration-day',
        channel: 'sms',
        desiredAt: at,
        params: { universityId: 'uj' },
      });
      // The job stays on the queue: a cancel that never happened, or came too late.
      await student.setReminderJob(id, await scheduleReminderJob(h.scheduler, id, at, 0));
      await student.setOfferRegistrationReminder(offerId, id);
      if (between === 'decline') await student.declineOffer(offerId);
      else await h.store.withdrawConsent(token);
      h.advance(HOUR);
      await h.run();
      expect(h.outbox.to(phone), between).toHaveLength(0);
      expect(await reminderRow(id), between).toMatchObject({
        status: 'dropped',
        outcome_reason: between === 'decline' ? 'offer-closed' : 'no-consent',
      });
    }
  });

  it('the learner opts out in the app between scheduling and sending: nothing is sent', async () => {
    const h = harness();
    const { studentId, phone, student } = await h.adult(5209);
    const { id } = await h.schedule(studentId, new Date(START.getTime() + HOUR));
    h.advance(HOUR / 2);
    await student.setChannelOptIn('sms', false);
    h.advance(HOUR / 2);
    await h.run();
    expect(h.outbox.to(phone)).toHaveLength(0);
    expect((await reminderRow(id))?.outcome_reason).toBe('not-opted-in');
    const prefs = await student.messagingPreferences();
    expect(prefs.channels.find((c) => c.channel === 'sms')).toMatchObject({
      optedIn: false,
      optOutSource: 'app',
      optedOutAt: new Date(START.getTime() + HOUR / 2),
    });
  });

  it('STOP between scheduling and sending: nothing more is sent on that channel', async () => {
    const h = harness();
    const { studentId, phone, student } = await h.adult(5210, ['sms', 'whatsapp']);
    await h.schedule(studentId);
    await h.run();
    expect(h.outbox.to(phone)).toHaveLength(1);

    h.advance(DAY);
    const sms = await h.schedule(studentId);
    const wa = await h.schedule(studentId, new Date(h.now().getTime() + DAY), 'whatsapp');
    expect(
      await h.messaging.receiveInbound({ channel: 'sms', from: phone, stop: true, at: h.now() }),
    ).toBe('stopped');
    await h.run();
    expect(h.outbox.to(phone)).toHaveLength(1);
    expect((await reminderRow(sms.id))?.outcome_reason).toBe('not-opted-in');
    expect((await student.messagingPreferences()).channels).toEqual([
      expect.objectContaining({ channel: 'sms', optedIn: false, optOutSource: 'stop' }),
      expect.objectContaining({ channel: 'whatsapp', optedIn: true }),
      expect.objectContaining({ channel: 'push', optedIn: false, optedInAt: null }),
    ]);
    // WhatsApp, which they didn't stop, still works.
    h.advance(DAY);
    await h.run();
    expect(h.whatsapp.to(phone)).toHaveLength(1);
    expect((await reminderRow(wa.id))?.status).toBe('sent');
  });

  it('A11-08: a STOP before consent is kept (an objection, s11(3)) and shows in the export', async () => {
    const h = harness();
    const phone = syntheticPhone(5214);
    const { studentId } = await signIn(h.store, phone);
    await h.store.setDateOfBirth(studentId, '2011-03-02'); // a minor, no guardian yet
    expect(
      await h.messaging.receiveInbound({ channel: 'sms', from: phone, stop: true, at: h.now() }),
    ).toBe('stopped');
    const exported = await h.store.forStudent(studentId).exportAll();
    // Nothing personal is processed without consent, but the record of the objection is theirs.
    expect(exported.personal).toBeNull();
    expect(exported.account?.messagingOptOuts).toEqual([
      {
        channel: 'sms',
        optedOutAt: h.now(),
        optOutSource: 'stop',
        lastInboundAt: h.now(),
      },
    ]);
  });

  it("the channel's own check refuses an opted-out learner even if the pipeline asked it to send", async () => {
    const h = harness();
    const { phone, student } = await h.adult(5212);
    expect(await h.messaging.mayMessage('sms', phone)).toBe(true);
    await student.setChannelOptIn('sms', false);
    expect(await h.messaging.mayMessage('sms', phone)).toBe(false);
    expect(await h.messaging.mayMessage('sms', syntheticPhone(5213))).toBe(false);
    expect(await h.messaging.mayMessage('push', phone)).toBe(false);
  });
});

describe('A1-13: one consent rule for pages and jobs (a learner who turns 18 under guardian consent)', () => {
  /** Born 2008-10-20: 17 at START, 18 from 00:00 on 2026-10-20 in South Africa. */
  const DOB = '2008-10-20';
  /** Midnight on the birthday in South Africa: still 19 October in UTC. */
  const BIRTHDAY = new Date('2026-10-19T22:00:00Z');

  /** A minor whose guardian consented (v2), opted in to SMS, with a name on their profile. */
  async function turningEighteen(h: ReturnType<typeof harness>, n: number) {
    const phone = syntheticPhone(n);
    const { studentId } = await signIn(h.store, phone);
    await h.store.setDateOfBirth(studentId, DOB);
    const { token } = await h.store.requestGuardianConsent(
      studentId,
      { name: 'Test Guardian', phone: syntheticPhone(n + 1), relationship: 'parent' },
      'v2-2026-10',
    );
    await h.store.grantConsent(token);
    const student = h.store.forStudent(studentId);
    await student.setChannelOptIn('sms', true);
    await student.updateProfile({ displayName: 'Lebo Mokoena' });
    return { studentId, phone, student };
  }

  it('drops a reminder due the day after their 18th birthday as no-consent, and jobs read nothing of theirs', async () => {
    const h = harness();
    const { studentId, phone, student } = await turningEighteen(h, 5651);
    const due = new Date('2026-10-21T08:00:00Z'); // 10:00 in South Africa
    const { id } = await h.schedule(studentId, due);
    h.advance(due.getTime() - START.getTime());
    // The app refuses them (needsAdultConsent → 403); the data layer must agree.
    expect((await h.store.account(studentId)).needsAdultConsent).toBe(true);

    await h.run();
    expect(h.outbox.to(phone)).toHaveLength(0);
    expect(await reminderRow(id)).toMatchObject({
      status: 'dropped',
      outcome_reason: 'no-consent',
    });
    expect(await h.messaging.mayMessage('sms', phone)).toBe(false);
    expect(await h.messaging.examInputs(studentId)).toBeNull();
    expect(await student.mayProcess()).toBe(false);
    await expect(student.profile()).rejects.toThrow(ConsentRequiredError);

    // Once they agree in their own name, their own opt-in stands and messages resume.
    await h.store.consentAsAdult(studentId, 'adult-v1-test');
    expect(await h.messaging.mayMessage('sms', phone)).toBe(true);
    expect(await h.messaging.examInputs(studentId)).not.toBeNull();
  });

  it('reads the grade the learner is in now, not the one given years ago (G10-1)', async () => {
    const h = harness(new Date('2026-10-13T08:00:00Z'));
    const { studentId, student } = await h.adult(5390);
    await student.updateProfile({ grade: 10 });
    expect((await h.messaging.examInputs(studentId))?.grade).toBe(10);
    h.advance(2 * 365 * 86_400_000);
    // Two school years on: matric, so this year's papers are theirs to stay quiet for.
    expect((await h.messaging.examInputs(studentId))?.grade).toBe(12);
  });

  it('an old Grade 10 report added late never decides a matric learner’s papers (A1-34)', async () => {
    const h = harness();
    const { studentId, student } = await h.adult(5392);
    await student.saveConfirmedReport({
      kind: 'grade-12-september',
      marks: [{ subject: 'mathematical-literacy', percent: 61 }],
    });
    h.advance(60_000);
    // Confirmed later, to complete the record: still the older report, as recentReports orders it.
    await student.saveConfirmedReport({
      kind: 'grade-10-final',
      marks: [{ subject: 'mathematics', percent: 55 }],
    });
    const inputs = await h.messaging.examInputs(studentId);
    expect(inputs?.confirmedSubjects).toEqual(['mathematical-literacy']);
    expect((await student.latestReport())?.kind).toBe('grade-12-september');
  });

  it('the birthday starts at midnight in South Africa, not in UTC', async () => {
    const h = harness();
    const { studentId, phone, student } = await turningEighteen(h, 5653);
    h.advance(BIRTHDAY.getTime() - 1 - START.getTime()); // 23:59:59.999 on 19 October, SAST
    expect((await h.store.account(studentId)).needsAdultConsent).toBe(false);
    expect(await h.messaging.mayMessage('sms', phone)).toBe(true);
    expect(await h.messaging.examInputs(studentId)).not.toBeNull();
    expect(await student.mayProcess()).toBe(true);

    h.advance(1); // 00:00 on 20 October in South Africa; 22:00 on 19 October in UTC
    expect((await h.store.account(studentId)).needsAdultConsent).toBe(true);
    expect(await h.messaging.mayMessage('sms', phone)).toBe(false);
    expect(await h.messaging.examInputs(studentId)).toBeNull();
    expect(await student.mayProcess()).toBe(false);
  });

  it('an adult with no recorded agreement of their own (before migration 0009) is not messaged', async () => {
    const h = harness();
    const { studentId, phone } = await h.adult(5655);
    const { id } = await h.schedule(studentId, new Date(START.getTime() + HOUR));
    // As an account that agreed before the adult wording existed: no version on record.
    await database.db.execute(
      sql`update students set adult_consent_version = null, adult_consented_at = null
          where id = ${studentId}::uuid`,
    );
    expect((await h.store.account(studentId)).needsAdultConsent).toBe(true);
    expect(await h.messaging.mayMessage('sms', phone)).toBe(false);
    h.advance(HOUR);
    await h.run();
    expect(h.outbox.to(phone)).toHaveLength(0);
    expect(await reminderRow(id)).toMatchObject({
      status: 'dropped',
      outcome_reason: 'no-consent',
    });
  });
});

describe('A11-05: withdrawing consent turns messaging off', () => {
  it("a different guardian's later consent does not resume messages: the learner opts in again", async () => {
    const h = harness();
    const { studentId, phone, student, token } = await minorWithConsent(h, 5701);
    await student.setChannelOptIn('sms', true);
    await student.setChannelOptIn('whatsapp', true);
    const later = await h.schedule(studentId, new Date(START.getTime() + 3 * DAY));

    await h.store.withdrawConsent(token);
    h.advance(HOUR);
    const { token: second } = await h.store.requestGuardianConsent(
      studentId,
      { name: 'Another Guardian', phone: syntheticPhone(5703), relationship: 'legal-guardian' },
      'v2-2026-10',
    );
    await h.store.grantConsent(second);

    // The new guardian never chose messaging, and nor has the learner since the withdrawal.
    expect(await h.messaging.mayMessage('sms', phone)).toBe(false);
    expect(await h.messaging.mayMessage('whatsapp', phone)).toBe(false);
    expect((await student.messagingPreferences()).channels).toEqual([
      expect.objectContaining({
        channel: 'sms',
        optedIn: false,
        optOutSource: 'consent-withdrawn',
      }),
      expect.objectContaining({
        channel: 'whatsapp',
        optedIn: false,
        optOutSource: 'consent-withdrawn',
      }),
      expect.objectContaining({ channel: 'push', optedIn: false, optOutSource: null }),
    ]);
    // The reminders scheduled under the old consent went with it, and their jobs.
    expect(await reminderRow(later.id)).toMatchObject({
      status: 'dropped',
      outcome_reason: 'no-consent',
    });
    expect((await h.scheduler.get(later.jobId))?.status).toBe('cancelled');
    h.advance(3 * DAY);
    await h.run();
    expect(h.outbox.to(phone)).toHaveLength(0);

    // The learner's own fresh choice turns it back on.
    await student.setChannelOptIn('sms', true);
    expect(await h.messaging.mayMessage('sms', phone)).toBe(true);
  });
});

describe('cadence, proven through the whole pipeline', () => {
  it('never in quiet hours: a 22:00 reminder goes at 07:00', async () => {
    const night = new Date('2026-10-13T20:00:00Z');
    const h = harness(night);
    const { studentId, phone } = await h.adult(5301);
    const { id, jobId } = await h.schedule(studentId);
    await h.run();
    expect(h.outbox.to(phone)).toHaveLength(0);
    const row = await reminderRow(id);
    expect(row).toMatchObject({ status: 'scheduled' });
    expect(row?.job_id).not.toBe(jobId);
    expect((await h.scheduler.get(row?.job_id as string))?.runAt).toEqual(
      new Date('2026-10-14T05:00:00Z'),
    );
    h.advance(9 * HOUR);
    await h.run();
    expect(h.sentAt).toEqual([new Date('2026-10-14T05:00:00Z')]);
  });

  it('never during a paper: the reminder waits until half an hour after it ends', async () => {
    const h = harness();
    const paper = {
      startsAt: new Date(START.getTime() - HOUR),
      endsAt: new Date(START.getTime() + 2 * HOUR),
    };
    h.setPapers([paper]);
    const { studentId, phone } = await h.adult(5302);
    await h.schedule(studentId);
    await h.run();
    expect(h.outbox.to(phone)).toHaveLength(0);
    h.advance(2.5 * HOUR);
    await h.run();
    expect(h.sentAt).toEqual([new Date(START.getTime() + 2.5 * HOUR)]);
  });

  it("never during the learner's own NSC paper, read from the timetable (Phase 4b)", async () => {
    // Mathematics P1, 2026: 09:00–12:00 SAST on 23 October. A reminder for 10:00 that day.
    const during = new Date('2026-10-23T08:00:00Z');
    let h!: ReturnType<typeof harness>;
    const source = new TimetablePaperSlots(
      { examInputs: (id) => h.messaging.examInputs(id) },
      {
        shown: () => catalogueView(during, { includeDrafts: true }).examPapers,
        forSuppression: () => examPapersForSuppression(),
      },
    );
    h = harness(during, source);
    const { studentId, phone, student } = await h.adult(5305);
    await student.updateProfile({ grade: 12 });
    await student.saveConfirmedReport({
      kind: 'grade-11-final',
      marks: [
        { subject: 'mathematics', percent: 64 },
        { subject: 'english-fal', percent: 70 },
      ],
    });
    await h.schedule(studentId);
    await h.run();
    expect(h.outbox.to(phone)).toHaveLength(0);
    h.advance(2.5 * HOUR);
    await h.run();
    // Half an hour after the paper ends at 12:00 SAST (10:00 UTC).
    expect(h.sentAt).toEqual([new Date('2026-10-23T10:30:00Z')]);
  });

  it('a paper the learner removed does not hold a message', async () => {
    const during = new Date('2026-10-23T08:00:00Z');
    let h!: ReturnType<typeof harness>;
    h = harness(
      during,
      new TimetablePaperSlots(
        { examInputs: (id) => h.messaging.examInputs(id) },
        {
          shown: () => catalogueView(during, { includeDrafts: true }).examPapers,
          forSuppression: () => examPapersForSuppression(),
        },
      ),
    );
    const { studentId, phone, student } = await h.adult(5306);
    await student.updateProfile({ grade: 12 });
    // English FAL has no paper that morning; Mathematics P1 is 09:00–12:00 SAST.
    await student.saveConfirmedReport({
      kind: 'grade-12-june',
      marks: [
        { subject: 'mathematics', percent: 64 },
        { subject: 'english-fal', percent: 70 },
      ],
    });
    await student.setExamSubjectChoice('mathematics', false);
    await h.schedule(studentId);
    await h.run();
    expect(h.outbox.to(phone)).toHaveLength(1);
  });

  it('A12-01: in production (no paper verified) a draft paper still holds the message', async () => {
    const during = new Date('2026-10-23T08:00:00Z');
    let h!: ReturnType<typeof harness>;
    h = harness(
      during,
      new TimetablePaperSlots(
        { examInputs: (id) => h.messaging.examInputs(id) },
        {
          // Exactly as the app wires it in production: learners are shown verified papers only.
          shown: () => catalogueView(during, { includeDrafts: false }).examPapers,
          forSuppression: () => examPapersForSuppression(),
        },
      ),
    );
    const { studentId, phone, student } = await h.adult(5307);
    await student.updateProfile({ grade: 12 });
    await student.saveConfirmedReport({
      kind: 'grade-12-june',
      marks: [{ subject: 'mathematics', percent: 64 }],
    });
    await h.schedule(studentId);
    await h.run();
    expect(h.outbox.to(phone)).toHaveLength(0);
    h.advance(2.5 * HOUR);
    await h.run();
    expect(h.sentAt).toEqual([new Date('2026-10-23T10:30:00Z')]);
  });

  it('two runners racing for the last slot of the day: exactly one message goes', async () => {
    const h = harness();
    const { studentId, phone } = await h.adult(5303);
    await h.schedule(studentId);
    await h.schedule(studentId);
    const second = new PostgresJobScheduler(database, { clock: h.now });
    await Promise.all([h.run(), second.runDue([h.handler])]);
    expect(h.outbox.to(phone)).toHaveLength(1);
  });

  it('a simulated six weeks: never above the cap, in quiet hours or during a paper', async () => {
    const h = harness(new Date('2027-05-01T05:00:00Z'));
    const { studentId, phone, student } = await h.adult(5304);
    await student.setMessagesPerWeek(3);
    // An exam series in the last fortnight.
    const papers = [17, 19, 22, 24, 26, 29, 31, 33, 36].map((d) => {
      const startsAt = new Date(Date.UTC(2027, 4, 1 + d, d % 2 ? 7 : 12));
      return { startsAt, endsAt: new Date(startsAt.getTime() + 3 * HOUR) };
    });
    h.setPapers(papers);
    // The app asks for far more than the rules allow: a reminder every eleven hours.
    const end = new Date('2027-06-12T00:00:00Z');
    let nextReminder = h.now().getTime();
    while (h.now() < end) {
      if (h.now().getTime() >= nextReminder) {
        await h.schedule(studentId, h.now());
        nextReminder += 11 * HOUR;
      }
      await h.run();
      h.advance(97 * 60 * 1000);
    }

    const sends = h.sentAt.map((d) => d.getTime());
    expect(h.outbox.to(phone).length).toBe(sends.length);
    expect(sends.length).toBeGreaterThan(8);
    for (const s of sends) {
      expect(isQuietHour(new Date(s))).toBe(false);
      expect(paperAt(new Date(s), papers)).toBeUndefined();
      const week = sends.filter((t) => t >= s && t < s + WEEK_MS);
      expect(week.length).toBeLessThanOrEqual(3);
    }
    // More than two in some week: the exam period allowed it, up to the learner's cap.
    expect(
      Math.max(...sends.map((s) => sends.filter((t) => t >= s && t < s + WEEK_MS).length)),
    ).toBe(3);
  }, 60_000);
});

describe('account deletion and export', () => {
  it('deletion between scheduling and sending: the job is purged and nothing is sent', async () => {
    const h = harness();
    const { studentId, phone, student } = await h.adult(5401);
    const { id, jobId } = await h.schedule(studentId, new Date(START.getTime() + HOUR));
    expect(await student.scheduledJobIds()).toEqual([jobId]);
    await student.deleteAccount();
    expect(await h.scheduler.get(jobId)).toBeNull();
    expect(await reminderRow(id)).toBeNull();
    h.advance(HOUR);
    const report = await h.run();
    expect(report.completed).toEqual([]);
    expect(h.outbox.to(phone)).toHaveLength(0);
  });

  it('a job already running when the account is deleted finds nothing and sends nothing', async () => {
    const h = harness();
    const { studentId, phone, student } = await h.adult(5402);
    const { id } = await h.schedule(studentId);
    // The runner takes the job, and the account goes before the handler looks.
    const handler = {
      ...h.handler,
      run: async (
        payload: Parameters<typeof h.handler.run>[0],
        context: Parameters<typeof h.handler.run>[1],
      ) => {
        await student.deleteAccount();
        return h.handler.run(payload, context);
      },
    };
    await h.scheduler.runDue([handler]);
    expect(h.outbox.to(phone)).toHaveLength(0);
    expect(await reminderRow(id)).toBeNull();
  });

  it("removes every messaging row with the account, and purges only that learner's jobs", async () => {
    const h = harness();
    const a = await h.adult(5403, ['sms', 'whatsapp']);
    const b = await h.adult(5404);
    await a.student.setMessagesPerWeek(4);
    await h.schedule(a.studentId, new Date(START.getTime() + HOUR));
    const other = await h.schedule(b.studentId, new Date(START.getTime() + HOUR));
    await a.student.deleteAccount();
    for (const table of ['messaging_channels', 'messaging_preferences', 'reminders']) {
      const [count] = rowsOf<{ n: number }>(
        await database.db.execute(
          sql`select count(*)::int as n from ${sql.identifier(table)} where student_id = ${a.studentId}::uuid`,
        ),
      );
      expect(count?.n, table).toBe(0);
    }
    expect(await h.scheduler.get(other.jobId)).not.toBeNull();
  });

  it('exports the messaging choices and reminders', async () => {
    const h = harness();
    const { studentId, student } = await h.adult(5405);
    await student.setMessagesPerWeek(5);
    await h.schedule(studentId);
    const exported = await student.exportAll();
    expect(exported.personal?.messaging).toMatchObject({
      channels: [expect.objectContaining({ channel: 'sms', optedIn: true })],
      preferences: expect.objectContaining({ maxPerWeek: 5 }),
      reminders: [expect.objectContaining({ templateId: 'reminder.check-in', channel: 'sms' })],
    });
  });
});

describe('preferences and reminders in the data layer', () => {
  it('defaults to nothing opted in and two a week', async () => {
    const h = harness();
    const { student } = await h.adult(5501, []);
    expect(await student.messagingPreferences()).toEqual({
      channels: ['sms', 'whatsapp', 'push'].map((channel) => ({
        channel,
        optedIn: false,
        optedInAt: null,
        optedOutAt: null,
        optOutSource: null,
      })),
      maxPerWeek: 2,
    });
    await student.setChannelOptIn('whatsapp', true);
    const wa = (await student.messagingPreferences()).channels[1];
    expect(wa).toMatchObject({ optedIn: true, optedInAt: START });
  });

  it('refuses a bad channel, cap, template, time or reference', async () => {
    const h = harness();
    const { student } = await h.adult(5502);
    await expect(student.setChannelOptIn('fax' as 'sms', true)).rejects.toThrow(InvalidStateError);
    for (const cap of [0, 8, 2.5]) {
      await expect(student.setMessagesPerWeek(cap)).rejects.toThrow(InvalidStateError);
    }
    const base = { templateId: 'reminder.check-in', channel: 'sms' as const, desiredAt: START };
    await expect(student.createReminder({ ...base, templateId: 'nope' })).rejects.toThrow(
      InvalidStateError,
    );
    await expect(
      student.createReminder({ ...base, desiredAt: new Date(Number.NaN) }),
    ).rejects.toThrow(InvalidStateError);
    await expect(student.createReminder({ ...base, params: { name: 'lebo' } })).rejects.toThrow(
      InvalidStateError,
    );
    await expect(
      student.createReminder({ ...base, params: { universityId: 'Call me on 082' } }),
    ).rejects.toThrow(InvalidStateError);
    const id = await student.createReminder({ ...base, params: { universityId: 'wits' } });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('the database itself refuses free text in a reminder', async () => {
    const h = harness();
    const { studentId } = await h.adult(5503);
    await expect(
      database.db.execute(sql`
        insert into reminders (student_id, template_id, channel, params, desired_at, created_at, updated_at)
        values (${studentId}::uuid, 'reminder.check-in', 'sms', '{"note":"call me"}'::jsonb, now(), now(), now())`),
    ).rejects.toThrow();
  });

  it("keeps one learner's reminders from another (row-level security)", async () => {
    const h = harness();
    const a = await h.adult(5504);
    const b = await h.adult(5505);
    await h.schedule(a.studentId);
    expect(await b.student.reminders()).toEqual([]);
    expect(await a.student.reminders()).toHaveLength(1);
  });

  it('an inbound message from an unknown number records nothing; a reply opens the window', async () => {
    const h = harness();
    expect(
      await h.messaging.receiveInbound({
        channel: 'sms',
        from: syntheticPhone(5506),
        stop: true,
        at: START,
      }),
    ).toBe('unknown');
    const { studentId, phone } = await h.adult(5507, ['whatsapp']);
    expect(
      await h.messaging.receiveInbound({
        channel: 'whatsapp',
        from: phone,
        stop: false,
        at: START,
      }),
    ).toBe('recorded');
    const [row] = rowsOf<{ last_inbound_at: Date }>(
      await database.db.execute(
        sql`select last_inbound_at from messaging_channels where student_id = ${studentId}::uuid and channel = 'whatsapp'`,
      ),
    );
    expect(new Date(row?.last_inbound_at as Date)).toEqual(START);
  });
});
