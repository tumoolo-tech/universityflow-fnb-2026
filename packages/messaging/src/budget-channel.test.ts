import { describe, expect, it } from 'vitest';
import {
  BudgetExceededError,
  budgetRetryAfterMs,
  MemorySmsBudgetLedger,
  MessageBudget,
  type SmsBudgetAlert,
  type SmsBudgetWindow,
} from './budget';
import { BudgetedChannel } from './budget-channel';
import { ChannelSendError, type RecipientGate } from './channel';
import { type ChannelHarness, channelContract } from './channel.contract';
import { MemoryWhatsAppChannel } from './channels';

/**
 * A paid channel inside its own budget (A12-15): WhatsApp bills per template message, so it gets
 * a global cap the way SMS has one, with the same ledger, the same alerts and the same "try again
 * after the window" for a reminder it refuses.
 */

// Synthetic numbers, built at runtime (hard rule 4).
const phone = (n: number) => `+2782${String(n).padStart(7, '0')}`;
const HOUR = 60 * 60 * 1000;

function setup(windows: SmsBudgetWindow[] = [{ name: 'hour', limit: 5, windowMs: HOUR }]) {
  const optedOut = new Set<string>();
  const gate: RecipientGate = async (_channel, to) => !optedOut.has(to);
  let now = new Date('2026-10-13T08:00:00Z');
  const clock = () => now;
  const inner = new MemoryWhatsAppChannel({ gate, clock });
  const alerts: SmsBudgetAlert[] = [];
  const channel = new BudgetedChannel(
    inner,
    new MessageBudget(new MemorySmsBudgetLedger(clock), {
      name: 'whatsapp',
      windows,
      alerts: { onBudgetThreshold: (a) => void alerts.push(a) },
    }),
  );
  const send = (to = phone(1)) =>
    channel.send({ to, template: 'reminder.check-in', variables: {} });
  return {
    inner,
    channel,
    alerts,
    optedOut,
    send,
    clock,
    advance(ms: number) {
      now = new Date(now.getTime() + ms);
    },
  };
}

describe('BudgetedChannel meets the channel contract', () => {
  channelContract((): ChannelHarness => {
    const h = setup([{ name: 'hour', limit: 1000, windowMs: HOUR }]);
    return {
      channel: h.channel,
      address: phone(11),
      other: phone(12),
      badAddress: 'not-a-number',
      optOut: (a) => h.optedOut.add(a),
      failNextSend: () => h.inner.failNext(),
      acceptThenFailNextSend: () => h.inner.acceptThenFailNext(),
      delivered: () => h.inner.all().length,
      now: h.clock,
      advance: h.advance,
    };
  });
});

describe('BudgetedChannel: a global cap on a paid channel (A12-15)', () => {
  it('refuses the (limit+1)th template before the provider: retryable, after the window', async () => {
    const h = setup();
    for (let i = 0; i < 5; i++) await h.send();
    const error = await h.send().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ChannelSendError);
    expect((error as Error).cause).toBeInstanceOf(BudgetExceededError);
    expect((error as Error).cause).toMatchObject({ budget: 'whatsapp', window: 'hour' });
    // The reminder pipeline waits this long, without spending a retry (as for SMS, A12-08).
    expect(budgetRetryAfterMs(error)).toBe(HOUR);
    expect(h.inner.all()).toHaveLength(5);
    // The window moves on: it goes again.
    h.advance(HOUR + 1);
    await expect(h.send()).resolves.toHaveProperty('id');
  });

  it('alerts at 80% and at 100% through the same hook as the SMS budgets', async () => {
    const h = setup();
    for (let i = 0; i < 5; i++) await h.send();
    await h.send().catch(() => undefined);
    expect(h.alerts).toEqual([
      { budget: 'whatsapp', level: 'warning', window: 'hour', used: 4, limit: 5 },
      { budget: 'whatsapp', level: 'exhausted', window: 'hour', used: 5, limit: 5 },
    ]);
  });

  it('charges a broadcast one unit per address, and refuses it whole when there is no room', async () => {
    const h = setup([{ name: 'hour', limit: 3, windowMs: HOUR }]);
    const message = { template: 'reminder.check-in' as const, variables: {} };
    const sent = await h.channel.sendMany({ to: [phone(1), phone(2)], ...message });
    expect(sent.every((o) => 'receipt' in o)).toBe(true);
    const refused = await h.channel.sendMany({ to: [phone(3), phone(4)], ...message });
    expect(refused.map((o) => o.to)).toEqual([phone(3), phone(4)]);
    for (const outcome of refused) {
      expect('error' in outcome ? budgetRetryAfterMs(outcome.error) : null).toBe(HOUR);
    }
    expect(h.inner.all()).toHaveLength(2);
    await expect(h.send()).resolves.toHaveProperty('id');
  });

  it('a reply inside the window is free on WhatsApp: it spends nothing and is never refused', async () => {
    const h = setup([{ name: 'hour', limit: 1, windowMs: HOUR }]);
    await h.send();
    await h.channel.noteInbound(phone(1), h.clock());
    await h.channel.sendText({ to: phone(1), text: 'A reply' });
    await h.channel.sendReply({ to: phone(1), text: 'Another', receivedAt: h.clock() });
    expect(h.inner.all()).toHaveLength(3);
    await expect(h.send()).rejects.toThrow(ChannelSendError);
  });
});
