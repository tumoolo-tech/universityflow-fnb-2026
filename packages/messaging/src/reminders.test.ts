import { randomUUID } from 'node:crypto';
import { JOB_LEASE_MS, MemoryJobScheduler } from '@universityflow/jobs';
import { describe, expect, it, vi } from 'vitest';
import { BudgetedSmsSender, MemorySmsBudgetLedger, MessageBudget } from './budget';
import { BudgetedChannel } from './budget-channel';
import { DAY_MS, type PaperSlot } from './cadence';
import type { ChannelName } from './channel';
import { type MemoryPushChannel, MemoryWhatsAppChannel, SmsChannel } from './channels';
import { EXPO_PUSH_RECEIPTS_URL, ExpoPushChannel, type PushFetch } from './expo-push';
import {
  type CadenceContext,
  type ClaimOutcome,
  RECEIPT_CHECK,
  RECEIPT_CHECK_DELAY_MS,
  REMINDER_MAX_ATTEMPTS,
  REMINDER_MAX_RESCHEDULES,
  REMINDER_SEND,
  REMINDER_SWEEP,
  REMINDER_SWEEP_AFTER_MS,
  type ReminderDropReason,
  type ReminderFailReason,
  type ReminderRecord,
  type ReminderStore,
  receiptCheckHandler,
  reminderHandler,
  reminderSweepHandler,
  scheduleReminderJob,
} from './reminders';
import { MemoryOutbox } from './sms';

/**
 * The handler's decisions against an in-memory store. The same pipeline runs against Postgres,
 * with consent and row-level security, in packages/db (messaging.test.ts).
 */

const PHONE = `+2782${'0000123'}`;
const token = (n: number) => `ExponentPushToken[fake${String(n).padStart(8, '0')}]`;
const receiptHandler = (p: ReturnType<typeof pipeline>) =>
  receiptCheckHandler({ store: p.store, channels: p.channels });

interface Row extends ReminderRecord {
  status: ReminderRecord['status'];
  reason: ReminderDropReason | ReminderFailReason | null;
  sentAt: Date | null;
  receiptId: string | null;
  jobId: string | null;
  reschedules: number;
}

class MemoryReminders implements ReminderStore {
  readonly rows = new Map<string, Row>();
  consent = true;
  optedIn = true;
  address: string | null = PHONE;
  otherAddresses: string[] = [];
  maxPerWeek = 2;

  add(overrides: Partial<ReminderRecord> = {}): Row {
    const row: Row = {
      id: randomUUID(),
      studentId: randomUUID(),
      templateId: 'reminder.check-in',
      channel: 'sms',
      params: {},
      desiredAt: new Date('2026-10-13T08:00:00Z'),
      status: 'scheduled',
      reschedules: 0,
      reason: null,
      sentAt: null,
      receiptId: null,
      jobId: null,
      ...overrides,
    };
    this.rows.set(row.id, row);
    return row;
  }

  async reminder(id: string) {
    return this.rows.get(id) ?? null;
  }

  async claimSend(
    id: string,
    now: Date,
    decide: (c: CadenceContext) => ReturnType<Parameters<ReminderStore['claimSend']>[2]>,
  ): Promise<ClaimOutcome> {
    const row = this.rows.get(id);
    if (row?.status !== 'scheduled') return { kind: 'gone' };
    if (!this.consent) return { kind: 'drop', reason: 'no-consent' };
    if (!this.optedIn) return { kind: 'drop', reason: 'not-opted-in' };
    if (!this.address) return { kind: 'drop', reason: 'no-address' };
    const recentSends = [...this.rows.values()].flatMap((r) => (r.sentAt ? [r.sentAt] : []));
    const decision = decide({ maxPerWeek: this.maxPerWeek, recentSends });
    if (decision.kind !== 'now') return { kind: 'wait', decision };
    row.status = 'sending';
    row.sentAt = now;
    return {
      kind: 'send',
      recipient: {
        address: this.address,
        otherAddresses: this.otherAddresses,
      },
    };
  }

  async recordSent(id: string, receiptIds: ReadonlyArray<string>) {
    Object.assign(this.rows.get(id) as Row, {
      status: 'sent',
      receiptId: receiptIds[0],
      receiptIds: [...receiptIds],
    });
  }
  async recordReceiptJob(id: string, jobId: string) {
    (this.rows.get(id) as Row).jobId = jobId;
  }
  async release(id: string) {
    Object.assign(this.rows.get(id) as Row, { status: 'scheduled', sentAt: null });
  }
  async recordFailed(id: string, _at: Date, reason: ReminderFailReason) {
    Object.assign(this.rows.get(id) as Row, { status: 'failed', sentAt: null, reason });
  }
  async recordUnconfirmed(id: string) {
    const row = this.rows.get(id) as Row;
    if (row.status === 'sending')
      Object.assign(row, { status: 'unconfirmed', reason: 'unknown-outcome' });
  }
  async sweepStale(id: string, claimedBefore: Date) {
    const row = this.rows.get(id);
    if (row?.status !== 'sending' || !row.sentAt || row.sentAt > claimedBefore) return false;
    Object.assign(row, { status: 'failed', sentAt: null, reason: 'unknown-outcome' });
    return true;
  }
  async drop(id: string, reason: ReminderDropReason) {
    Object.assign(this.rows.get(id) as Row, { status: 'dropped', sentAt: null, reason });
  }
  async setJob(id: string, jobId: string, _at: Date, rescheduled: boolean) {
    const row = this.rows.get(id) as Row;
    row.jobId = jobId;
    if (rescheduled) row.reschedules += 1;
  }
  readonly deliveries: Array<[string, string, string]> = [];
  async recordDelivery(channel: ChannelName, receiptId: string, status: string) {
    this.deliveries.push([channel, receiptId, status]);
    return true;
  }
}

function pipeline(
  options: { papers?: PaperSlot[]; start?: Date; variables?: Record<string, string> } = {},
) {
  let now = options.start ?? new Date('2026-10-13T08:00:00Z'); // 10:00 SAST
  const clock = () => now;
  const store = new MemoryReminders();
  const scheduler = new MemoryJobScheduler({ clock });
  const gate = async () => store.optedIn;
  const outbox = new MemoryOutbox();
  const whatsapp = new MemoryWhatsAppChannel({ gate, clock });
  const channels: Partial<
    Record<
      ChannelName,
      SmsChannel | MemoryWhatsAppChannel | MemoryPushChannel | ExpoPushChannel | BudgetedChannel
    >
  > = {
    sms: new SmsChannel(outbox, { gate, clock }),
    whatsapp,
  };
  let resolvable = true;
  let resolveFailures = 0;
  const handler = reminderHandler({
    store,
    channels,
    scheduler,
    papers: { slotsFor: async () => options.papers ?? [] },
    resolve: () => {
      if (resolveFailures > 0) {
        resolveFailures -= 1;
        throw new Error('catalogue lookup failed');
      }
      return resolvable ? (options.variables ?? {}) : null;
    },
    clock,
  });
  return {
    clock,
    store,
    scheduler,
    outbox,
    whatsapp,
    channels,
    handler,
    gate,
    advance(ms: number) {
      now = new Date(now.getTime() + ms);
    },
    unresolvable() {
      resolvable = false;
    },
    failResolveOnce(times = 1) {
      resolveFailures = times;
    },
    async schedule(overrides: Partial<ReminderRecord> = {}) {
      const row = store.add({ desiredAt: now, ...overrides });
      row.jobId = await scheduleReminderJob(scheduler, row.id, row.desiredAt, 0);
      return row;
    },
    run: () => scheduler.runDue([handler]),
  };
}

describe('reminderHandler', () => {
  it('sends a due reminder and records the receipt', async () => {
    const p = pipeline();
    const row = await p.schedule();
    const report = await p.run();
    expect(report.completed).toHaveLength(1);
    expect(row).toMatchObject({ status: 'sent', receiptId: expect.stringMatching(/\S/) });
    expect(p.outbox.to(PHONE)[0]?.body).toMatch(/^UniversityFlow: .* Reply STOP to stop\.$/);
  });

  it('drops a reminder for a learner without consent, or not opted in, or with no address', async () => {
    for (const [setup, reason] of [
      [(s: MemoryReminders) => (s.consent = false), 'no-consent'],
      [(s: MemoryReminders) => (s.optedIn = false), 'not-opted-in'],
      [(s: MemoryReminders) => (s.address = null), 'no-address'],
    ] as const) {
      const p = pipeline();
      setup(p.store);
      const row = await p.schedule();
      await p.run();
      expect(row).toMatchObject({ status: 'dropped', reason });
      expect(p.outbox.all()).toHaveLength(0);
    }
  });

  it('drops a reminder for a channel with no adapter', async () => {
    const p = pipeline();
    const row = await p.schedule({ channel: 'push' });
    await p.run();
    expect(row).toMatchObject({ status: 'dropped', reason: 'channel-unavailable' });
  });

  it('reschedules a reminder that falls in quiet hours to the morning', async () => {
    const p = pipeline({ start: new Date('2026-10-13T20:30:00Z') }); // 22:30 SAST
    const row = await p.schedule();
    const firstJob = row.jobId;
    await p.run();
    expect(row).toMatchObject({ status: 'scheduled', reschedules: 1 });
    expect(row.jobId).not.toBe(firstJob);
    expect((await p.scheduler.get(row.jobId as string))?.runAt).toEqual(
      new Date('2026-10-14T05:00:00Z'),
    );
    expect(p.outbox.all()).toHaveLength(0);
    // The morning: it goes.
    p.advance(8.5 * 60 * 60 * 1000);
    await p.run();
    expect(row.status).toBe('sent');
  });

  it('drops a reminder pushed back past a week, and one past the horizon', async () => {
    const p = pipeline();
    const row = await p.schedule({ desiredAt: new Date('2026-10-01T08:00:00Z') });
    p.store.maxPerWeek = 1;
    p.store.add({ status: 'sent', sentAt: new Date('2026-10-13T06:00:00Z') } as Partial<Row>);
    await p.run();
    expect(row).toMatchObject({ status: 'dropped', reason: 'stale' });

    const papers = [
      { startsAt: new Date('2026-10-13T07:00:00Z'), endsAt: new Date(Date.UTC(2026, 11, 1)) },
    ];
    const q = pipeline({ papers });
    const never = await q.schedule();
    await q.run();
    expect(never).toMatchObject({ status: 'dropped', reason: 'cadence' });
  });

  it('stops rescheduling after the limit', async () => {
    const p = pipeline({ start: new Date('2026-10-13T20:30:00Z') });
    const row = await p.schedule({ reschedules: REMINDER_MAX_RESCHEDULES });
    await p.run();
    expect(row).toMatchObject({ status: 'dropped', reason: 'stale' });
  });

  it('drops a reminder whose variables no longer resolve, and one the channel refuses', async () => {
    const p = pipeline();
    p.unresolvable();
    const row = await p.schedule();
    await p.run();
    expect(row).toMatchObject({ status: 'dropped', reason: 'unresolved' });

    const q = pipeline();
    const bad = await q.schedule({ templateId: 'reminder.study' }); // needs subjectName
    await q.run();
    expect(bad).toMatchObject({ status: 'dropped', reason: 'invalid' });
  });

  it('Phase 5: the reply-by, registration-day and change-deadline reminders pass the same gates (consent, quiet hours, papers, cadence)', async () => {
    const variables = { universityName: 'Synthetic University' };
    for (const templateId of [
      'offer.reply-by',
      'offer.registration-day',
      'registration.change-deadline',
    ] as const) {
      const params = { universityId: 'up' };
      // Sent when due, nothing personal in it.
      const p = pipeline({ variables });
      const row = await p.schedule({ templateId, params });
      await p.run();
      expect(row.status, templateId).toBe('sent');
      expect(p.outbox.to(PHONE)[0]?.body, templateId).not.toMatch(/Synthetic|\d/);
      // No consent: dropped.
      const q = pipeline({ variables });
      q.store.consent = false;
      const refused = await q.schedule({ templateId, params });
      await q.run();
      expect(refused, templateId).toMatchObject({ status: 'dropped', reason: 'no-consent' });
      // Quiet hours: moved to the morning.
      const night = pipeline({ variables, start: new Date('2026-10-13T20:30:00Z') });
      const late = await night.schedule({ templateId, params });
      await night.run();
      expect(late, templateId).toMatchObject({ status: 'scheduled', reschedules: 1 });
      // During a paper: held until after it.
      const papers = [
        {
          startsAt: new Date('2026-10-13T07:00:00Z'),
          endsAt: new Date('2026-10-13T10:00:00Z'),
        },
      ];
      const exam = pipeline({ variables, papers });
      const held = await exam.schedule({ templateId, params });
      await exam.run();
      expect(held.status, templateId).toBe('scheduled');
      expect(exam.outbox.all(), templateId).toHaveLength(0);
      // The weekly cap: waits.
      const capped = pipeline({ variables });
      capped.store.maxPerWeek = 1;
      capped.store.add({
        status: 'sent',
        sentAt: new Date('2026-10-13T06:00:00Z'),
      } as Partial<Row>);
      const waiting = await capped.schedule({ templateId, params });
      await capped.run();
      expect(waiting.status, templateId).toBe('scheduled');
      expect(capped.outbox.all(), templateId).toHaveLength(0);
    }
  });

  it("drops when the channel's own opt-out check refuses at the last moment", async () => {
    const p = pipeline();
    const row = await p.schedule();
    // The store saw an opt-in; the gate, a moment later, sees STOP.
    const store = p.store;
    const claim = store.claimSend.bind(store);
    store.claimSend = async (...args) => {
      const outcome = await claim(...args);
      store.optedIn = false;
      return outcome;
    };
    await p.run();
    expect(row).toMatchObject({ status: 'dropped', reason: 'not-opted-in' });
    expect(p.outbox.all()).toHaveLength(0);
  });

  it('retries a provider failure, then gives up as failed', async () => {
    const p = pipeline();
    const row = await p.schedule({ channel: 'whatsapp' });
    p.whatsapp.failNext(3);
    let report = await p.run();
    expect(report.retrying).toHaveLength(1);
    expect(row).toMatchObject({ status: 'scheduled', sentAt: null });
    p.advance(DAY_MS / 24);
    report = await p.run();
    expect(report.retrying).toHaveLength(1);
    p.advance(DAY_MS / 24);
    report = await p.run();
    expect(report.completed).toHaveLength(1);
    expect(row).toMatchObject({ status: 'failed', reason: 'provider-error' });
  });

  it('A12-08: a reminder the SMS budget refuses is rescheduled after the window, never failed', async () => {
    const p = pipeline();
    const HOUR = DAY_MS / 24;
    const sender = new BudgetedSmsSender(p.outbox, new MemorySmsBudgetLedger(p.clock), {
      windows: [{ name: 'hour', limit: 1, windowMs: HOUR }],
      alerts: { onBudgetThreshold: () => undefined },
    });
    p.channels.sms = new SmsChannel(sender, { gate: async () => true, clock: p.clock });
    // Something else spent the hour's budget.
    await sender.send({ to: `+2782${'0000999'}`, body: 'x' });

    const row = await p.schedule();
    const report = await p.run();
    // Not a provider failure: no retry burned, nothing failed, the slot given back.
    expect(report.retrying).toHaveLength(0);
    expect(report.completed).toHaveLength(1);
    expect(row).toMatchObject({ status: 'scheduled', sentAt: null, reschedules: 1 });
    expect((await p.scheduler.get(row.jobId as string))?.runAt).toEqual(
      new Date(p.clock().getTime() + HOUR),
    );
    expect(p.outbox.to(PHONE)).toHaveLength(0);

    // After the window, it goes.
    p.advance(HOUR);
    await p.run();
    expect(row.status).toBe('sent');
  });

  it('A12-15: a WhatsApp reminder its budget refuses is rescheduled after the window, like SMS', async () => {
    const p = pipeline();
    const HOUR = DAY_MS / 24;
    const budgeted = new BudgetedChannel(
      p.whatsapp,
      new MessageBudget(new MemorySmsBudgetLedger(p.clock), {
        name: 'whatsapp',
        windows: [{ name: 'hour', limit: 1, windowMs: HOUR }],
        alerts: { onBudgetThreshold: () => undefined },
      }),
    );
    p.channels.whatsapp = budgeted;
    // The hour's one template is spent; the (limit+1)th is this reminder.
    await budgeted.send({ to: `+2782${'0000998'}`, template: 'reminder.check-in', variables: {} });

    const row = await p.schedule({ channel: 'whatsapp' });
    const report = await p.run();
    expect(report.retrying).toHaveLength(0);
    expect(report.completed).toHaveLength(1);
    expect(row).toMatchObject({ status: 'scheduled', sentAt: null, reschedules: 1 });
    expect((await p.scheduler.get(row.jobId as string))?.runAt).toEqual(
      new Date(p.clock().getTime() + HOUR),
    );
    expect(p.whatsapp.to(PHONE)).toHaveLength(0);

    p.advance(HOUR);
    await p.run();
    expect(row.status).toBe('sent');
    expect(p.whatsapp.to(PHONE)).toHaveLength(1);
  });

  it('does nothing for a reminder that is gone or no longer waiting', async () => {
    const p = pipeline();
    const row = await p.schedule();
    p.store.rows.delete(row.id);
    expect((await p.run()).completed).toHaveLength(1);

    const q = pipeline();
    const sent = await q.schedule();
    sent.status = 'sent';
    await q.run();
    // And a claim that finds it already taken.
    const r = pipeline();
    const raced = await r.schedule();
    const claim = r.store.claimSend.bind(r.store);
    r.store.claimSend = async (...args) => {
      raced.status = 'sending';
      return claim(...args);
    };
    await r.run();
    expect(q.outbox.all()).toHaveLength(0);
    expect(r.outbox.all()).toHaveLength(0);
  });

  it('sends to every device on push, keeps the first receipt, and skips devices that are gone', async () => {
    const p = pipeline();
    const accepted: string[] = [];
    let next = 1;
    const fakeExpo: PushFetch = async (url, init) => {
      if (url === EXPO_PUSH_RECEIPTS_URL) {
        return { ok: true, status: 200, json: async () => ({ data: {} }) };
      }
      const messages = JSON.parse(init.body) as Array<{ to: string }>;
      const data = messages.map((message) => {
        if (message.to === token(2)) {
          return { status: 'error', details: { error: 'DeviceNotRegistered' } };
        }
        accepted.push(message.to);
        return { status: 'ok', id: `t-${next++}` };
      });
      return { ok: true, status: 200, json: async () => ({ data }) };
    };
    const forgotten: string[] = [];
    p.channels.push = new ExpoPushChannel({
      gate: async () => true,
      fetch: fakeExpo,
      forgetAddress: async (t) => void forgotten.push(t),
    });
    p.store.address = token(1);
    p.store.otherAddresses = [token(2), token(3)];
    const row = await p.schedule({ channel: 'push' });
    await p.run();
    expect(row).toMatchObject({ status: 'sent', receiptId: 't-1' });
    expect(accepted).toEqual([token(1), token(3)]);
    expect(forgotten).toEqual([token(2)]);
  });

  it('A5-04, A11-07: one reminder to five phones is one Expo request, and every ticket is checked', async () => {
    const p = pipeline();
    const sends: Array<Array<{ to: string }>> = [];
    const receiptAsks: string[][] = [];
    const receipts: Record<string, unknown> = {};
    let next = 1;
    const fakeExpo: PushFetch = async (url, init) => {
      if (url === EXPO_PUSH_RECEIPTS_URL) {
        receiptAsks.push((JSON.parse(init.body) as { ids: string[] }).ids);
        return { ok: true, status: 200, json: async () => ({ data: receipts }) };
      }
      const messages = JSON.parse(init.body) as Array<{ to: string }>;
      sends.push(messages);
      const data = messages.map(() => ({ status: 'ok', id: `t-${next++}` }));
      return { ok: true, status: 200, json: async () => ({ data }) };
    };
    const forgotten: string[] = [];
    p.channels.push = new ExpoPushChannel({
      gate: async () => true,
      fetch: fakeExpo,
      forgetAddress: async (t) => void forgotten.push(t),
    });
    const phones = [21, 22, 23, 24, 25].map(token);
    p.store.address = phones[0] as string;
    p.store.otherAddresses = phones.slice(1);
    const row = await p.schedule({ channel: 'push' });
    await p.run();

    expect(sends).toHaveLength(1);
    expect(sends[0]?.map((m) => m.to)).toEqual(phones);
    const tickets = ['t-1', 't-2', 't-3', 't-4', 't-5'];
    expect(row).toMatchObject({ status: 'sent', receiptId: 't-1', receiptIds: tickets });
    // The receipt check now carries the reminder: account deletion can cancel it (A11-11).
    expect((await p.scheduler.get(row.jobId as string))?.kind).toBe(RECEIPT_CHECK.name);

    // The fourth phone's receipt, not the first's, says it is gone (A11-07).
    for (const id of tickets) receipts[id] = { status: 'ok' };
    receipts['t-4'] = { status: 'error', details: { error: 'DeviceNotRegistered' } };
    p.advance(RECEIPT_CHECK_DELAY_MS);
    expect((await p.scheduler.runDue([p.handler, receiptHandler(p)])).completed).toHaveLength(1);
    expect(receiptAsks).toEqual([tickets]);
    expect(forgotten).toEqual([phones[3]]);
    expect(p.store.deliveries).toEqual([['push', 't-1', 'delivered']]);
  });

  it('A11-07: a push reminder whose every receipt failed is recorded failed; a pending one is asked again', async () => {
    const p = pipeline();
    const receipts: Record<string, unknown> = {};
    let next = 1;
    p.channels.push = new ExpoPushChannel({
      gate: async () => true,
      fetch: async (url, init) => {
        if (url === EXPO_PUSH_RECEIPTS_URL) {
          return { ok: true, status: 200, json: async () => ({ data: receipts }) };
        }
        const messages = JSON.parse(init.body) as unknown[];
        const data = messages.map(() => ({ status: 'ok', id: `f-${next++}` }));
        return { ok: true, status: 200, json: async () => ({ data }) };
      },
    });
    p.store.address = token(26);
    p.store.otherAddresses = [token(27)];
    const row = await p.schedule({ channel: 'push' });
    await p.run();
    expect(row).toMatchObject({ status: 'sent', receiptIds: ['f-1', 'f-2'] });
    const due = () => p.scheduler.runDue([p.handler, receiptHandler(p)]);
    // One phone has answered, the other not yet: asked again later.
    receipts['f-1'] = { status: 'error', details: { error: 'MessageTooBig' } };
    p.advance(RECEIPT_CHECK_DELAY_MS);
    expect((await due()).retrying).toHaveLength(1);
    expect(p.store.deliveries).toEqual([]);
    receipts['f-2'] = { status: 'error', details: { error: 'MessageRateExceeded' } };
    p.advance(2 * 60 * 1000);
    expect((await due()).completed).toHaveLength(1);
    expect(p.store.deliveries).toEqual([['push', 'f-1', 'failed']]);
  });

  it('drops a push reminder when every device is gone, and retries when every send failed', async () => {
    const gone = pipeline();
    gone.channels.push = new ExpoPushChannel({
      gate: async () => true,
      fetch: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }],
        }),
      }),
    });
    gone.store.address = token(4);
    const row = await gone.schedule({ channel: 'push' });
    await gone.run();
    expect(row).toMatchObject({ status: 'dropped', reason: 'no-address' });

    const down = pipeline();
    down.channels.push = new ExpoPushChannel({
      gate: async () => true,
      fetch: async () => ({ ok: false, status: 502, json: async () => ({}) }),
    });
    down.store.address = token(5);
    down.store.otherAddresses = [token(6)];
    const retried = await down.schedule({ channel: 'push' });
    expect((await down.run()).retrying).toHaveLength(1);
    expect(retried).toMatchObject({ status: 'scheduled', sentAt: null });
  });

  it('checks a push receipt later, by reminder id only, retrying while it is pending', async () => {
    const p = pipeline();
    const receipts: Record<string, unknown> = {};
    p.channels.push = new ExpoPushChannel({
      gate: async () => true,
      fetch: async (url) =>
        url === EXPO_PUSH_RECEIPTS_URL
          ? { ok: true, status: 200, json: async () => ({ data: receipts }) }
          : {
              ok: true,
              status: 200,
              json: async () => ({ data: [{ status: 'ok', id: 'ticket-a' }] }),
            },
    });
    p.store.address = token(7);
    const row = await p.schedule({ channel: 'push' });
    await p.run();
    expect(row.status).toBe('sent');
    const checks = receiptHandler(p);
    const due = () => p.scheduler.runDue([p.handler, checks]);

    // Not yet: the check waits its quarter of an hour.
    expect((await due()).completed).toHaveLength(0);
    p.advance(RECEIPT_CHECK_DELAY_MS);
    expect((await due()).retrying).toHaveLength(1); // pending
    receipts['ticket-a'] = { status: 'ok' };
    p.advance(2 * 60 * 1000);
    expect((await due()).completed).toHaveLength(1);
    expect(p.store.deliveries).toEqual([['push', 'ticket-a', 'delivered']]);
  });

  it('a receipt check finds nothing to do for a reminder that is gone, unsent, or not on push', async () => {
    const p = pipeline();
    const checks = receiptHandler(p);
    const sms = await p.schedule();
    await p.run();
    expect(sms.status).toBe('sent');
    for (const reminderId of [sms.id, randomUUID()]) {
      await p.scheduler.schedule({
        kind: RECEIPT_CHECK,
        payload: { reminderId: reminderId as never },
        delayMs: 0,
      });
    }
    const report = await p.scheduler.runDue([checks]);
    expect(report.completed).toHaveLength(2);
    expect(p.store.deliveries).toEqual([]);
  });

  it('carries only the reminder id in its job (hard rule 4)', async () => {
    const p = pipeline();
    const row = await p.schedule();
    const job = await p.scheduler.get(row.jobId as string);
    expect(job?.kind).toBe(REMINDER_SEND.name);
    expect(job?.payload).toEqual({ reminderId: row.id });
  });
});

describe('retries never send twice (A12-06, A1-15, A12-14)', () => {
  it('A12-06: a provider that took the message and then failed is never sent to again', async () => {
    const p = pipeline();
    // The provider takes the message, then the connection drops before it answers.
    p.channels.sms = new SmsChannel(
      {
        send: async (message) => {
          await p.outbox.send(message);
          throw new Error('socket hang up');
        },
      },
      { gate: p.gate, clock: p.clock },
    );
    const row = await p.schedule();
    const first = await p.run(); // attempt 1
    p.advance(DAY_MS / 24);
    await p.run(); // attempt 2, were it retried
    p.advance(DAY_MS / 24);
    await p.run(); // attempt 3
    expect(p.outbox.all()).toHaveLength(1);
    expect(first.retrying).toEqual([]);
    // Recorded as "the provider may have it": never resent, and it keeps its cadence slot.
    expect(row).toMatchObject({
      status: 'unconfirmed',
      reason: 'unknown-outcome',
      receiptId: null,
    });
    expect(row.sentAt).not.toBeNull();
  });

  it('A12-06: hands the channel the reminder id as the idempotency reference', async () => {
    const p = pipeline();
    const send = vi.spyOn(p.whatsapp, 'sendMany');
    const row = await p.schedule({ channel: 'whatsapp' });
    await p.run();
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ reference: row.id }));
  });

  it('A1-15: a failure after the claim, before anything is sent, gives the claim back and the retry sends', async () => {
    const p = pipeline();
    p.failResolveOnce();
    const row = await p.schedule();
    expect((await p.run()).retrying).toHaveLength(1);
    expect(row).toMatchObject({ status: 'scheduled', sentAt: null });
    p.advance(DAY_MS / 24);
    await p.run();
    expect(row.status).toBe('sent');
    expect(p.outbox.all()).toHaveLength(1);
  });

  it('A1-15: a failure that lasts through the last attempt fails the reminder, sending nothing', async () => {
    const p = pipeline();
    p.failResolveOnce(REMINDER_MAX_ATTEMPTS);
    const row = await p.schedule();
    for (let attempt = 1; attempt <= REMINDER_MAX_ATTEMPTS; attempt += 1) {
      await p.run();
      p.advance(DAY_MS / 24);
    }
    expect(row).toMatchObject({ status: 'failed', reason: 'internal-error', sentAt: null });
    expect(p.outbox.all()).toHaveLength(0);
  });

  it('A12-14: a runner that dies after the claim: the sweeper fails it as unknown-outcome, never resending', async () => {
    const p = pipeline();
    // The provider takes the message; the runner dies before it can record that.
    p.channels.sms = new SmsChannel(
      {
        send: async (message) => {
          await p.outbox.send(message);
          return new Promise(() => undefined);
        },
      },
      { gate: p.gate, clock: p.clock },
    );
    const sweeper = reminderSweepHandler({ store: p.store, clock: p.clock });
    const row = await p.schedule();
    void p.run(); // never finishes: the dead runner
    await vi.waitFor(() => expect(p.outbox.all()).toHaveLength(1), { timeout: 5_000 });
    expect(row.status).toBe('sending');

    // The job's lease runs out: another runner takes the job, finds the claim, sends nothing.
    p.advance(JOB_LEASE_MS);
    await p.scheduler.runDue([p.handler, sweeper]);
    expect(row.status).toBe('sending');
    // Past the lease, the sweeper closes it.
    p.advance(REMINDER_SWEEP_AFTER_MS - JOB_LEASE_MS);
    const report = await p.scheduler.runDue([p.handler, sweeper]);
    expect(report.completed).toHaveLength(1);
    expect(row).toMatchObject({ status: 'failed', reason: 'unknown-outcome', sentAt: null });
    p.advance(DAY_MS);
    await p.scheduler.runDue([p.handler, sweeper]);
    expect(p.outbox.all()).toHaveLength(1);
  });

  it('A12-14: the sweep job carries the reminder id only, leaves a finished reminder alone, and waits on a young claim', async () => {
    const p = pipeline();
    const sweeper = reminderSweepHandler({ store: p.store, clock: p.clock });
    const row = await p.schedule();
    await p.run();
    expect(row.status).toBe('sent');
    // The handler put the sweep on the schedule before it claimed: the same key finds that job.
    const scheduled = await p.scheduler.schedule({
      kind: REMINDER_SWEEP,
      payload: { reminderId: row.id as never },
      delayMs: 0,
      idempotencyKey: `reminder-sweep:${row.id}:0:1`,
    });
    expect(scheduled.created).toBe(false);
    expect(scheduled.runAt).toEqual(new Date(p.clock().getTime() + REMINDER_SWEEP_AFTER_MS));
    const sweep = await p.scheduler.get(scheduled.id);
    expect(sweep?.payload).toEqual({ reminderId: row.id });
    p.advance(REMINDER_SWEEP_AFTER_MS);
    expect((await p.scheduler.runDue([sweeper])).completed).toEqual([scheduled.id]);
    expect(row.status).toBe('sent');

    // A claim younger than the lease is a runner still at work: the sweep waits and tries again.
    const young = p.store.add({ status: 'sending' } as Partial<Row>);
    young.sentAt = p.clock();
    await p.scheduler.schedule({
      kind: REMINDER_SWEEP,
      payload: { reminderId: young.id as never },
      delayMs: 0,
    });
    expect((await p.scheduler.runDue([sweeper])).retrying).toHaveLength(1);
    expect(young.status).toBe('sending');
  });
});
