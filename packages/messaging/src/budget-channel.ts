import type { MessageBudget } from './budget';
import {
  type ChannelName,
  ChannelSendError,
  type DeliveryStatus,
  type MessageChannel,
  type MessageReceipt,
  type ReplyMessage,
  type SendOutcome,
  type TemplateBroadcast,
  type TemplateMessage,
  type TextMessage,
} from './channel';

/**
 * A paid channel inside its own global budget (A12-15), the way SMS sits inside its budgets:
 * WhatsApp bills every template message, so the app caps them across every learner and server,
 * with the same ledger, the same 80%/100% alerts and the same refusal. Any adapter can be wrapped,
 * so a live one can't skip it.
 *
 * - **What is charged:** each template message, one unit per address, before the provider is
 *   asked. A message the channel then refuses (an opted-out learner, a bad template) has still
 *   spent its unit: a cap errs towards sending less. A broadcast that doesn't fit is refused whole.
 * - **What is free:** free-form text and replies (`sendText`, `sendReply`). On WhatsApp they go
 *   only inside the 24-hour window the learner opened, where Meta doesn't charge them (service
 *   messages). A STOP confirmation or crisis help is never held back by a budget.
 * - **A spent budget** is `ChannelSendError` (nothing went out, retryable) with the
 *   `BudgetExceededError` as its cause, so the reminder pipeline waits out the window without
 *   spending a retry, exactly as for an over-budget SMS (A12-08).
 *
 * Nothing here sees an address or a message (hard rule 4): the budget counts units.
 */
export class BudgetedChannel implements MessageChannel {
  readonly #inner: MessageChannel;
  readonly #budget: MessageBudget;

  constructor(inner: MessageChannel, budget: MessageBudget) {
    this.#inner = inner;
    this.#budget = budget;
  }

  get name(): ChannelName {
    return this.#inner.name;
  }

  get maxLength(): number {
    return this.#inner.maxLength;
  }

  get templateOnlyOutsideWindow(): boolean {
    return this.#inner.templateOnlyOutsideWindow;
  }

  /** The budget this channel spends: its name, for alerts and tests. */
  get budget(): string {
    return this.#budget.name;
  }

  async send(message: TemplateMessage): Promise<MessageReceipt> {
    await this.#spend(1);
    return this.#inner.send(message);
  }

  async sendMany(message: TemplateBroadcast): Promise<ReadonlyArray<SendOutcome>> {
    const addresses = [...new Set(message.to)];
    if (addresses.length === 0) return this.#inner.sendMany(message);
    try {
      await this.#spend(addresses.length);
    } catch (error) {
      return addresses.map((to) => ({ to, error }));
    }
    return this.#inner.sendMany(message);
  }

  sendText(message: TextMessage): Promise<MessageReceipt> {
    return this.#inner.sendText(message);
  }

  sendReply(message: ReplyMessage): Promise<MessageReceipt> {
    return this.#inner.sendReply(message);
  }

  status(receiptId: string): Promise<DeliveryStatus | null> {
    return this.#inner.status(receiptId);
  }

  recordStatus(receiptId: string, status: DeliveryStatus): Promise<boolean> {
    return this.#inner.recordStatus(receiptId, status);
  }

  freeFormAllowed(to: string, now: Date): Promise<boolean> {
    return this.#inner.freeFormAllowed(to, now);
  }

  noteInbound(from: string, at: Date): Promise<void> {
    return this.#inner.noteInbound(from, at);
  }

  async #spend(units: number): Promise<void> {
    try {
      await this.#budget.spend(units);
    } catch (error) {
      // Spent, or the ledger is down: either way nothing went out, and it fails closed.
      throw new ChannelSendError(this.name, { cause: error });
    }
  }
}
