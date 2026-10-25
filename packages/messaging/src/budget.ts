import { type SmsMessage, type SmsReceipt, type SmsSender, validateSms } from './sms';
import { smsSegments } from './sms-encoding';

/**
 * A cap on SMS sent, whatever the provider (status.md open finding 1). Per-number and per-IP
 * limits stop one caller; this stops many callers together, from many addresses and many numbers,
 * from running up the SMS bill. When the budget is spent, sending fails closed until the rolling
 * window frees room.
 *
 * A budget counts **segments**, the way a provider bills (A1-14, A12-08): a message that goes out
 * in three segments takes three units, and one that doesn't fit in the room left is refused
 * whole.
 *
 * The app keeps separate budgets by name (A5-01): one for sign-in PINs and guardian consent links,
 * one for reminders, so reminders can never spend what sign-in needs. Each has its own windows and
 * its own alerts.
 *
 * Every paid channel has one (A12-15): `MessageBudget` is the budget itself, whatever it counts,
 * and `BudgetedChannel` (budget-channel.ts) puts WhatsApp's template messages under one, one unit
 * a message, with the same ledger, alerts and refusal as SMS. Push (Expo) costs nothing per
 * message and has none.
 *
 * The counting lives behind `SmsBudgetLedger`: Postgres in the app (shared by every server
 * instance, so the cap is global), memory in tests. The ledger checks and records one send
 * atomically, so two sends racing at the boundary can't both pass.
 *
 * Nothing here sees or logs a number or a message body (hard rule 4).
 */

export interface SmsBudgetWindow {
  /** A label for alerts, e.g. "hour" or "day". */
  readonly name: string;
  readonly limit: number;
  readonly windowMs: number;
}

export interface SmsBudgetTake {
  readonly allowed: boolean;
  /** Units counted in each window, in the order given, including this send's when allowed. */
  readonly used: ReadonlyArray<number>;
}

export interface SmsBudgetLedger {
  /**
   * Records one send of `units` (its segments) if every window has room for all of them;
   * otherwise records nothing. Atomic.
   */
  take(windows: ReadonlyArray<SmsBudgetWindow>, units: number): Promise<SmsBudgetTake>;
}

/** 80%: someone should look. 100%: sending has stopped. */
export type SmsBudgetLevel = 'warning' | 'exhausted';

export interface SmsBudgetAlert {
  /** Which budget: e.g. "sms-auth" or "sms-reminders". */
  readonly budget: string;
  readonly level: SmsBudgetLevel;
  readonly window: string;
  readonly used: number;
  readonly limit: number;
}

export interface SmsBudgetAlerts {
  onBudgetThreshold(alert: SmsBudgetAlert): void | Promise<void>;
}

export const SMS_BUDGET_WARNING_RATIO = 0.8;

/** The wait after a spent budget that didn't say which window was full. */
export const SMS_BUDGET_DEFAULT_RETRY_MS = 60 * 60 * 1000;

/** The budget name when none is given. */
export const DEFAULT_SMS_BUDGET_NAME = 'sms';

/** The default alert: one log line of counts and labels. Never a number or a body. */
export const logSmsBudgetAlerts: SmsBudgetAlerts = {
  onBudgetThreshold({ budget, level, window, used, limit }) {
    console.warn(`${budget} budget ${level}: ${used}/${limit} in the last ${window}`);
  },
};

/** A message budget is spent: SMS (`SmsBudgetExceededError`) or another paid channel's (A12-15). */
export class BudgetExceededError extends Error {
  override readonly name: string = 'BudgetExceededError';
  /**
   * @param window The full window's label.
   * @param retryAfterMs When the send could fit again at the latest: the full window's length,
   *   after which everything now counted in it has left.
   */
  constructor(
    readonly window: string,
    readonly retryAfterMs: number | null = null,
    readonly budget: string = DEFAULT_SMS_BUDGET_NAME,
  ) {
    super(`The ${budget} budget for the last ${window} is spent`);
  }
}

/** An SMS budget is spent. Sign-in answers it with "SMS unavailable" (open finding 1). */
export class SmsBudgetExceededError extends BudgetExceededError {
  override readonly name = 'SmsBudgetExceededError';
}

/**
 * The wait before trying again when `error` (or what caused it) is a spent message budget, SMS or
 * another paid channel's; null for any other error. A channel wraps a sender's errors, so the
 * cause is followed.
 */
export function budgetRetryAfterMs(error: unknown): number | null {
  for (let e = error, depth = 0; e instanceof Error && depth < 5; depth++) {
    if (e instanceof BudgetExceededError) return e.retryAfterMs ?? SMS_BUDGET_DEFAULT_RETRY_MS;
    e = e.cause;
  }
  return null;
}

/** The same, by its first name (A12-08): every budget, SMS or not, since A12-15. */
export const smsBudgetRetryAfterMs = budgetRetryAfterMs;

export function validateBudget(windows: ReadonlyArray<SmsBudgetWindow>): void {
  if (windows.length === 0) throw new Error('An SMS budget needs at least one window');
  for (const w of windows) {
    if (!Number.isInteger(w.limit) || w.limit < 1) throw new Error('A budget limit is 1 or more');
    if (!Number.isInteger(w.windowMs) || w.windowMs < 1000) {
      throw new Error('A budget window is at least a second');
    }
  }
}

export interface BudgetedSmsSenderOptions {
  readonly windows: ReadonlyArray<SmsBudgetWindow>;
  readonly alerts?: SmsBudgetAlerts;
  /** The budget's name in alerts and errors. */
  readonly name?: string;
}

export interface MessageBudgetOptions {
  /** The budget's name in the ledger, alerts and errors: e.g. "sms-auth" or "whatsapp". */
  readonly name: string;
  readonly windows: ReadonlyArray<SmsBudgetWindow>;
  readonly alerts?: SmsBudgetAlerts;
  /** The error a spent budget throws; SMS throws `SmsBudgetExceededError`. */
  readonly exceeded?: (window: string, retryAfterMs: number, budget: string) => BudgetExceededError;
}

/**
 * One named budget over a ledger (A5-01, A12-15): SMS and every other paid channel spend through
 * this, so each has the same rolling windows, the same 80%/100% alerts and the same refusal.
 */
export class MessageBudget {
  readonly name: string;
  readonly #ledger: SmsBudgetLedger;
  readonly #windows: ReadonlyArray<SmsBudgetWindow>;
  readonly #alerts: SmsBudgetAlerts;
  readonly #exceeded: NonNullable<MessageBudgetOptions['exceeded']>;

  constructor(ledger: SmsBudgetLedger, options: MessageBudgetOptions) {
    validateBudget(options.windows);
    this.name = options.name;
    this.#ledger = ledger;
    this.#windows = options.windows;
    this.#alerts = options.alerts ?? logSmsBudgetAlerts;
    this.#exceeded =
      options.exceeded ??
      ((window, retry, budget) => new BudgetExceededError(window, retry, budget));
  }

  /** Spends `units`, or throws the budget's error and spends nothing. Alerts as it crosses a mark. */
  async spend(units: number): Promise<void> {
    const { allowed, used } = await this.#ledger.take(this.#windows, units);
    const counts = this.#windows.map((w, i) => ({ w, used: Number(used[i]) }));
    if (!allowed) {
      // Name the first window without room; a ledger that refuses without one still refuses.
      const full = counts.find((c) => !(c.used + units <= c.w.limit));
      const longest = Math.max(...this.#windows.map((w) => w.windowMs));
      throw this.#exceeded(
        full ? full.w.name : 'unknown',
        full ? full.w.windowMs : longest,
        this.name,
      );
    }
    // Each threshold fires on the send that crosses it, which the ledger's atomic count makes
    // exactly one send across every server instance, however many units that send took.
    for (const { w, used: after } of counts) {
      const before = after - units;
      const warnAt = Math.ceil(w.limit * SMS_BUDGET_WARNING_RATIO);
      if (before < warnAt && after >= warnAt && warnAt < w.limit) {
        await this.#alert('warning', w, after);
      }
      if (before < w.limit && after >= w.limit) await this.#alert('exhausted', w, after);
    }
  }

  async #alert(level: SmsBudgetLevel, window: SmsBudgetWindow, used: number): Promise<void> {
    try {
      await this.#alerts.onBudgetThreshold({
        budget: this.name,
        level,
        window: window.name,
        used,
        limit: window.limit,
      });
    } catch {
      // An alert that fails must not stop a learner's PIN, or a reminder.
    }
  }
}

/** Wraps any `SmsSender` in a budget, charged per segment. */
export class BudgetedSmsSender implements SmsSender {
  readonly #inner: SmsSender;
  readonly #budget: MessageBudget;

  constructor(inner: SmsSender, ledger: SmsBudgetLedger, options: BudgetedSmsSenderOptions) {
    this.#inner = inner;
    this.#budget = new MessageBudget(ledger, {
      name: options.name ?? DEFAULT_SMS_BUDGET_NAME,
      windows: options.windows,
      ...(options.alerts ? { alerts: options.alerts } : {}),
      exceeded: (window, retry, budget) => new SmsBudgetExceededError(window, retry, budget),
    });
  }

  async send(message: SmsMessage): Promise<SmsReceipt> {
    // A message the provider would refuse must not spend budget.
    validateSms(message);
    await this.#budget.spend(smsSegments(message.body));
    return this.#inner.send(message);
  }
}

/** The stand-in ledger: one process, a rolling window over a list of sends and their units. */
export class MemorySmsBudgetLedger implements SmsBudgetLedger {
  #sent: Array<{ at: number; units: number }> = [];
  readonly #clock: () => Date;

  constructor(clock: () => Date = () => new Date()) {
    this.#clock = clock;
  }

  async take(windows: ReadonlyArray<SmsBudgetWindow>, units = 1): Promise<SmsBudgetTake> {
    if (!Number.isInteger(units) || units < 1) throw new Error('A send takes 1 unit or more');
    // No await before the record: JavaScript runs this whole check-and-count without
    // interleaving, so concurrent sends in one process can't both take the last slot.
    const now = this.#clock().getTime();
    const longest = Math.max(...windows.map((w) => w.windowMs));
    this.#sent = this.#sent.filter((s) => s.at > now - longest);
    const counts = windows.map((w) => ({
      limit: w.limit,
      used: this.#sent.filter((s) => s.at > now - w.windowMs).reduce((n, s) => n + s.units, 0),
    }));
    const used = counts.map((c) => c.used);
    if (counts.some((c) => c.used + units > c.limit)) return { allowed: false, used };
    this.#sent.push({ at: now, units });
    return { allowed: true, used: used.map((n) => n + units) };
  }
}
