import { describe, expect, it, vi } from 'vitest';
import {
  BudgetedSmsSender,
  logSmsBudgetAlerts,
  MemorySmsBudgetLedger,
  SMS_BUDGET_DEFAULT_RETRY_MS,
  type SmsBudgetAlert,
  SmsBudgetExceededError,
  type SmsBudgetLedger,
  type SmsBudgetWindow,
  smsBudgetRetryAfterMs,
  validateBudget,
} from './budget';
import { InvalidSmsError, MemoryOutbox } from './sms';
import { smsContract } from './sms.contract';

// Synthetic number, built at runtime (hard rule 4).
const PHONE = `+2782${'0000456'}`;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function setup(windows: SmsBudgetWindow[] = [{ name: 'hour', limit: 10, windowMs: HOUR }]) {
  let now = new Date('2026-10-13T08:00:00Z');
  const outbox = new MemoryOutbox();
  const ledger = new MemorySmsBudgetLedger(() => now);
  const alerts: SmsBudgetAlert[] = [];
  const sender = new BudgetedSmsSender(outbox, ledger, {
    windows,
    alerts: { onBudgetThreshold: (a) => void alerts.push(a) },
  });
  const send = () => sender.send({ to: PHONE, body: 'Your PIN is 123456' });
  return {
    outbox,
    ledger,
    sender,
    alerts,
    send,
    advance(ms: number) {
      now = new Date(now.getTime() + ms);
    },
  };
}

describe('BudgetedSmsSender meets the SMS contract', () => {
  smsContract(
    () =>
      new BudgetedSmsSender(new MemoryOutbox(), new MemorySmsBudgetLedger(), {
        windows: [{ name: 'hour', limit: 100, windowMs: HOUR }],
        alerts: { onBudgetThreshold: () => undefined },
      }),
    PHONE,
  );
});

describe('BudgetedSmsSender: the global SMS budget (open finding 1)', () => {
  it('sends while under the budget and at it, then fails closed', async () => {
    const h = setup();
    for (let i = 0; i < 10; i++) await expect(h.send()).resolves.toHaveProperty('id');
    await expect(h.send()).rejects.toThrow(SmsBudgetExceededError);
    // Nothing reached the provider once the budget was spent.
    expect(h.outbox.all()).toHaveLength(10);
  });

  it('frees room as the rolling window moves on', async () => {
    const h = setup();
    for (let i = 0; i < 5; i++) await h.send();
    h.advance(30 * 60 * 1000);
    for (let i = 0; i < 5; i++) await h.send();
    await expect(h.send()).rejects.toThrow(SmsBudgetExceededError);
    // The first five fall out of the last hour; the second five are still in it.
    h.advance(30 * 60 * 1000 + 1);
    for (let i = 0; i < 5; i++) await h.send();
    await expect(h.send()).rejects.toThrow(SmsBudgetExceededError);
  });

  it('enforces every window: a daily cap holds even when each hour is under its own', async () => {
    const h = setup([
      { name: 'hour', limit: 3, windowMs: HOUR },
      { name: 'day', limit: 5, windowMs: DAY },
    ]);
    for (let i = 0; i < 3; i++) await h.send();
    await expect(h.send()).rejects.toMatchObject({ window: 'hour' });
    h.advance(HOUR + 1);
    for (let i = 0; i < 2; i++) await h.send();
    await expect(h.send()).rejects.toMatchObject({ window: 'day' });
    h.advance(DAY);
    await expect(h.send()).resolves.toHaveProperty('id');
  });

  it('alerts once at 80% and once at 100%, never on a refusal', async () => {
    const h = setup();
    for (let i = 0; i < 10; i++) await h.send();
    for (let i = 0; i < 3; i++) await expect(h.send()).rejects.toThrow(SmsBudgetExceededError);
    expect(h.alerts).toEqual([
      { budget: 'sms', level: 'warning', window: 'hour', used: 8, limit: 10 },
      { budget: 'sms', level: 'exhausted', window: 'hour', used: 10, limit: 10 },
    ]);
  });

  it('alerts per window', async () => {
    const h = setup([
      { name: 'hour', limit: 5, windowMs: HOUR },
      { name: 'day', limit: 10, windowMs: DAY },
    ]);
    for (let i = 0; i < 5; i++) await h.send();
    h.advance(HOUR + 1);
    for (let i = 0; i < 5; i++) await h.send();
    expect(h.alerts.map((a) => `${a.window}:${a.level}`)).toEqual([
      'hour:warning',
      'hour:exhausted',
      'day:warning',
      'hour:warning',
      'hour:exhausted',
      'day:exhausted',
    ]);
  });

  it('lets two sends racing for the last slot through only once', async () => {
    const h = setup([{ name: 'hour', limit: 1, windowMs: HOUR }]);
    const results = await Promise.allSettled([h.send(), h.send()]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });

  it('spends no budget on a message the provider would refuse', async () => {
    const h = setup([{ name: 'hour', limit: 1, windowMs: HOUR }]);
    await expect(h.sender.send({ to: '+441234567890', body: 'x' })).rejects.toThrow(
      InvalidSmsError,
    );
    await expect(h.send()).resolves.toHaveProperty('id');
  });

  it('still sends when an alert hook fails', async () => {
    const sender = new BudgetedSmsSender(new MemoryOutbox(), new MemorySmsBudgetLedger(), {
      windows: [{ name: 'hour', limit: 1, windowMs: HOUR }],
      alerts: {
        onBudgetThreshold: () => {
          throw new Error('pager down');
        },
      },
    });
    await expect(sender.send({ to: PHONE, body: 'x' })).resolves.toHaveProperty('id');
  });

  it('fails closed when the ledger itself fails', async () => {
    const broken: SmsBudgetLedger = { take: async () => Promise.reject(new Error('db down')) };
    const outbox = new MemoryOutbox();
    const sender = new BudgetedSmsSender(outbox, broken, {
      windows: [{ name: 'hour', limit: 1, windowMs: HOUR }],
    });
    await expect(sender.send({ to: PHONE, body: 'x' })).rejects.toThrow('db down');
    expect(outbox.all()).toHaveLength(0);
  });

  it('fails closed when the ledger refuses without saying which window is full', async () => {
    const odd: SmsBudgetLedger = { take: async () => ({ allowed: false, used: [0] }) };
    const sender = new BudgetedSmsSender(new MemoryOutbox(), odd, {
      windows: [{ name: 'hour', limit: 1, windowMs: HOUR }],
    });
    await expect(sender.send({ to: PHONE, body: 'x' })).rejects.toMatchObject({
      name: 'SmsBudgetExceededError',
      window: 'unknown',
    });
  });

  it('logs counts and labels only by default: no number, no body (hard rule 4)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const sender = new BudgetedSmsSender(new MemoryOutbox(), new MemorySmsBudgetLedger(), {
      windows: [{ name: 'hour', limit: 1, windowMs: HOUR }],
    });
    await sender.send({ to: PHONE, body: 'Your PIN is 654321' });
    expect(warn).toHaveBeenCalledWith('sms budget exhausted: 1/1 in the last hour');
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain(PHONE.slice(3));
    expect(logged).not.toContain('654321');
    logSmsBudgetAlerts.onBudgetThreshold({
      budget: 'sms-reminders',
      level: 'warning',
      window: 'day',
      used: 8,
      limit: 10,
    });
    expect(warn).toHaveBeenLastCalledWith('sms-reminders budget warning: 8/10 in the last day');
    warn.mockRestore();
  });

  it('A1-14: charges by segment: a three-segment SMS takes three units', async () => {
    const h = setup([{ name: 'hour', limit: 4, windowMs: HOUR }]);
    // 307 GSM-7 characters: three segments.
    await h.sender.send({ to: PHONE, body: 'x'.repeat(307) });
    await h.send(); // one segment: the fourth unit
    await expect(h.send()).rejects.toThrow(SmsBudgetExceededError);
    expect(h.outbox.all()).toHaveLength(2);
  });

  it('A1-14: refuses a message bigger than the room left, and spends nothing on it', async () => {
    const h = setup([{ name: 'hour', limit: 4, windowMs: HOUR }]);
    await h.send();
    await h.send();
    // A UCS-2 text of 135 characters is three segments; only two units are left.
    await expect(h.sender.send({ to: PHONE, body: 'ŋ'.repeat(135) })).rejects.toThrow(
      SmsBudgetExceededError,
    );
    await h.send();
    await h.send();
    await expect(h.send()).rejects.toThrow(SmsBudgetExceededError);
  });

  it('A1-14: alerts on the send that crosses 80% or 100%, even when it jumps past the mark', async () => {
    const h = setup([{ name: 'hour', limit: 10, windowMs: HOUR }]);
    for (let i = 0; i < 7; i++) await h.send();
    await h.sender.send({ to: PHONE, body: 'x'.repeat(307) }); // 7 → 10
    expect(h.alerts.map((a) => [a.level, a.used])).toEqual([
      ['warning', 10],
      ['exhausted', 10],
    ]);
  });

  it('A12-08: says when to try again: after the full window', async () => {
    const h = setup([
      { name: 'hour', limit: 1, windowMs: HOUR },
      { name: 'day', limit: 5, windowMs: DAY },
    ]);
    await h.send();
    await expect(h.send()).rejects.toMatchObject({ window: 'hour', retryAfterMs: HOUR });
  });

  it('A12-08: finds a spent budget behind a channel error, and nothing behind any other', () => {
    const spent = new SmsBudgetExceededError('day', DAY, 'sms-reminders');
    expect(smsBudgetRetryAfterMs(spent)).toBe(DAY);
    expect(smsBudgetRetryAfterMs(new Error('wrapped', { cause: spent }))).toBe(DAY);
    expect(smsBudgetRetryAfterMs(new SmsBudgetExceededError('unknown'))).toBe(
      SMS_BUDGET_DEFAULT_RETRY_MS,
    );
    expect(smsBudgetRetryAfterMs(new Error('provider down'))).toBeNull();
    expect(smsBudgetRetryAfterMs(null)).toBeNull();
    expect(spent.message).toBe('The sms-reminders budget for the last day is spent');
  });

  it('a ledger refuses a send of no units', async () => {
    await expect(
      new MemorySmsBudgetLedger().take([{ name: 'hour', limit: 1, windowMs: HOUR }], 0),
    ).rejects.toThrow();
  });

  it('refuses a budget that makes no sense', () => {
    expect(() => validateBudget([])).toThrow();
    expect(() => validateBudget([{ name: 'hour', limit: 0, windowMs: HOUR }])).toThrow();
    expect(() => validateBudget([{ name: 'hour', limit: 1.5, windowMs: HOUR }])).toThrow();
    expect(() => validateBudget([{ name: 'hour', limit: 1, windowMs: 10 }])).toThrow();
  });
});
