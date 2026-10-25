import {
  InvalidTemplateError,
  isMessageTemplateId,
  type MessageChannelName,
  type MessageTemplateId,
  messageTemplate,
  renderMessage,
  type TemplateVariables,
} from '@universityflow/content';

/**
 * One way to reach a learner, whatever the channel (planning.md §7): SMS, WhatsApp or push, each
 * behind this interface with a stand-in (D8) and the shared contract in channel.contract.ts.
 *
 * What every channel guarantees, stand-in or live:
 * - A message we start is a **template** from `packages/content` with its variables (hard rule
 *   8). A live WhatsApp adapter sends Meta the approved template's name and parameters; the
 *   others render the text.
 * - **Free-form text** goes out only when the channel allows it: WhatsApp only within 24 hours
 *   of the learner's last message to us (§7.3); SMS and push always.
 * - A recipient who has **opted out** of the channel is refused at the last moment, by asking our
 *   own records (`RecipientGate`) just before handing the message over: a second check after the
 *   pipeline's own, so a bug upstream can't message someone who said STOP. The one exception is
 *   `sendReply`, the answer to the message they just sent (STOP's confirmation, A12-12).
 * - Errors never quote an address or a message (hard rule 4).
 * - **A failure says whether the message could have gone** (A12-06). `ChannelSendError`: the
 *   provider certainly did not take it, so a retry is safe. `DeliveryUnconfirmedError`: it may
 *   have (a timeout or a dropped connection after the request went out), so it is never sent
 *   again. A live adapter throws `MessageNotSentError` only for what it knows didn't go out; any
 *   other failure counts as maybe sent, because a missed reminder costs less than a doubled one.
 * - A message sent with a **`reference`** reaches its address at most once under that reference:
 *   a repeat delivers nothing new and returns the first receipt (or, if the first one's outcome is
 *   unknown, `DeliveryUnconfirmedError` again). A live adapter whose provider takes an idempotency
 *   key passes the reference on, so this holds across server processes too.
 */

export type ChannelName = MessageChannelName;

export interface TemplateMessage {
  /** E.164 (+27…) for SMS and WhatsApp; a push token for push. */
  readonly to: string;
  readonly template: MessageTemplateId;
  readonly variables: TemplateVariables;
  /**
   * Names this message for idempotency: an id we made (the reminder's), never personal data.
   * Letters, digits, `-` and `_`, at most 100 characters.
   */
  readonly reference?: string;
}

/** One template message for several addresses: a learner's phones, on push (A5-04). */
export interface TemplateBroadcast extends Omit<TemplateMessage, 'to'> {
  readonly to: ReadonlyArray<string>;
}

/** What became of one address in a `sendMany`: its receipt, or the error `send` would throw. */
export type SendOutcome =
  | { readonly to: string; readonly receipt: MessageReceipt }
  | { readonly to: string; readonly error: unknown };

export interface TextMessage {
  readonly to: string;
  readonly text: string;
}

/** A reply to a message the learner just sent us (A12-12): STOP's confirmation, or help. */
export interface ReplyMessage extends TextMessage {
  /** When their message reached us. A reply answers only a message inside the window. */
  readonly receivedAt: Date;
}

/** How long after a learner's message a reply may still answer it: WhatsApp's window. */
export const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface MessageReceipt {
  readonly id: string;
  readonly channel: ChannelName;
}

/** accepted: the provider took it · delivered: it reached the phone · failed: it never will. */
export type DeliveryStatus = 'accepted' | 'delivered' | 'failed';
export const DELIVERY_STATUSES: ReadonlyArray<DeliveryStatus> = ['accepted', 'delivered', 'failed'];

export interface MessageChannel {
  readonly name: ChannelName;
  /** The longest message, in characters, the channel takes. */
  readonly maxLength: number;
  /** True for WhatsApp: outside the 24-hour window only templates may be sent. */
  readonly templateOnlyOutsideWindow: boolean;
  send(message: TemplateMessage): Promise<MessageReceipt>;
  /**
   * The same template message to several addresses, each once, with the same checks as `send`
   * for each. A provider that takes many messages a request (Expo, A5-04) gets them together.
   * One outcome per distinct address, in order; a problem with the message itself (a template,
   * a variable, a reference) refuses the whole call, as `send` would.
   */
  sendMany(message: TemplateBroadcast): Promise<ReadonlyArray<SendOutcome>>;
  /** Free-form text (a reply). Refused with `FreeFormNotAllowedError` outside the window. */
  sendText(message: TextMessage): Promise<MessageReceipt>;
  /**
   * The answer to a message the learner sent us a moment ago, on the channel it came on (A12-12):
   * the STOP confirmation, or crisis help. The one message the opt-out doesn't stop, because the
   * learner who just said STOP is owed the confirmation, and someone in distress is owed help.
   * Only the inbound route sends it, right after a verified inbound message.
   *
   * - Free-form text, inside the window their message opened: refused with
   *   `FreeFormNotAllowedError` when `receivedAt` is more than `REPLY_WINDOW_MS` ago or ahead.
   * - Not a reminder: no cadence slot, no quiet hours, never counted toward the learner's cap.
   *   Those belong to the reminder pipeline, which never sends one.
   * - The same address, length and error rules as every other message.
   */
  sendReply(message: ReplyMessage): Promise<MessageReceipt>;
  /** What became of a message, or null for a receipt this channel never issued. */
  status(receiptId: string): Promise<DeliveryStatus | null>;
  /** Records a delivery report (a provider's status callback). False for an unknown receipt. */
  recordStatus(receiptId: string, status: DeliveryStatus): Promise<boolean>;
  /** May free-form text go to `to` at `now`? */
  freeFormAllowed(to: string, now: Date): Promise<boolean>;
  /**
   * The learner wrote to us. A live provider tracks this itself (Meta enforces the WhatsApp
   * window); the stand-ins record it so they behave as the provider would.
   */
  noteInbound(from: string, at: Date): Promise<void>;
}

/** True when our records allow messaging `to` on `channel` right now. */
export type RecipientGate = (channel: ChannelName, to: string) => Promise<boolean>;

export class InvalidMessageError extends Error {
  override readonly name: string = 'InvalidMessageError';
}

/** The recipient opted out of this channel (or never opted in). Never retried. */
export class RecipientOptedOutError extends Error {
  override readonly name = 'RecipientOptedOutError';
  constructor(readonly channel: ChannelName) {
    super(`The recipient has not opted in to ${channel}`);
  }
}

/**
 * The address no longer reaches anyone: Expo said `DeviceNotRegistered` (the app was removed, or
 * its notifications were reset). The channel has already told its owner to forget the address.
 * Never retried.
 */
export class RecipientGoneError extends InvalidMessageError {
  override readonly name = 'RecipientGoneError';
}

/** Free-form text outside WhatsApp's 24-hour window: only a template may go. */
export class FreeFormNotAllowedError extends InvalidMessageError {
  override readonly name = 'FreeFormNotAllowedError';
}

/** The provider certainly did not take the message. Worth retrying later. */
export class ChannelSendError extends Error {
  override readonly name = 'ChannelSendError';
  constructor(
    readonly channel: ChannelName,
    options?: { cause?: unknown },
  ) {
    super(`The ${channel} provider did not accept the message`, options);
  }
}

/**
 * The provider may have taken the message: the request went out and no answer came back (a
 * timeout, a dropped connection, an answer we can't read). Never retried: a retry could send it
 * twice (A12-06).
 */
export class DeliveryUnconfirmedError extends Error {
  override readonly name = 'DeliveryUnconfirmedError';
  constructor(
    readonly channel: ChannelName,
    options?: { cause?: unknown },
  ) {
    super(`The ${channel} provider may have taken the message; it did not confirm`, options);
  }
}

/**
 * For adapters (and `SmsSender`s): the provider certainly did not take the message. It answered
 * with an error, or no connection was ever made. The channel reports it as a retryable
 * `ChannelSendError`. The message must not quote an address or a message (hard rule 4).
 */
export class MessageNotSentError extends Error {
  override readonly name = 'MessageNotSentError';
}

/** An idempotency reference: an id we made. Never free text, so nothing personal rides along. */
const REFERENCE = /^[A-Za-z0-9_-]{1,100}$/;
/** How long, and how many, references a channel remembers within one server process. */
const REFERENCE_MEMORY_MS = 24 * 60 * 60 * 1000;
const MAX_REMEMBERED_REFERENCES = 10_000;

export const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface ChannelOptions {
  readonly gate: RecipientGate;
  readonly clock?: () => Date;
}

/**
 * The checks every channel makes, in one place: address, template, length, opt-out. A live
 * adapter extends this and implements `deliver` with the provider's API, so it can't skip them.
 */
export abstract class GuardedChannel implements MessageChannel {
  abstract readonly name: ChannelName;
  abstract readonly maxLength: number;
  readonly templateOnlyOutsideWindow: boolean = false;
  protected readonly gate: RecipientGate;
  protected readonly clock: () => Date;
  readonly #statuses = new Map<string, DeliveryStatus>();
  /** Reference and address → the receipt, or null when the outcome is unknown. Oldest first. */
  readonly #references = new Map<string, { readonly id: string | null; readonly at: number }>();

  constructor(options: ChannelOptions) {
    this.gate = options.gate;
    this.clock = options.clock ?? (() => new Date());
  }

  /** Is `to` a well-formed address on this channel? */
  protected abstract validAddress(to: string): boolean;

  /**
   * Hands the message to the provider; returns the provider's message id. Throws
   * `MessageNotSentError` only when the provider certainly did not take it; anything else counts
   * as maybe sent and is never retried. `reference`, when given, is the message's idempotency
   * key: pass it on if the provider takes one.
   */
  protected abstract deliver(
    to: string,
    content: { readonly text: string; readonly template: MessageTemplateId | null },
    reference: string | null,
  ): Promise<string>;

  /**
   * Hands one message to the provider for each address, in order: a provider id, or the error
   * `deliver` would throw. By default one `deliver` after another; an adapter whose provider takes
   * many messages a request (Expo) sends them together. Never throws.
   */
  protected async deliverMany(
    to: ReadonlyArray<string>,
    content: { readonly text: string; readonly template: MessageTemplateId | null },
    reference: string | null,
  ): Promise<ReadonlyArray<{ readonly id: string } | { readonly error: unknown }>> {
    const results: Array<{ readonly id: string } | { readonly error: unknown }> = [];
    for (const address of to) {
      try {
        results.push({ id: await this.deliver(address, content, reference) });
      } catch (error) {
        results.push({ error });
      }
    }
    return results;
  }

  async send(message: TemplateMessage): Promise<MessageReceipt> {
    this.#checkAddress(message.to);
    const { content, reference } = this.#render(message);
    return this.#deliver(message.to, content, reference);
  }

  async sendMany(message: TemplateBroadcast): Promise<ReadonlyArray<SendOutcome>> {
    const { content, reference } = this.#render(message);
    const addresses = [...new Set(message.to)];
    const outcomes = new Map<string, SendOutcome>();
    const due: Array<{ readonly to: string; readonly key: string | null }> = [];
    // The same checks as `send`, address by address; what passes goes to the provider together.
    for (const to of addresses) {
      try {
        this.#checkAddress(to);
        const ready = await this.#beforeDelivery(to, reference);
        if ('receipt' in ready) outcomes.set(to, { to, receipt: ready.receipt });
        else due.push({ to, key: ready.key });
      } catch (error) {
        outcomes.set(to, { to, error });
      }
    }
    if (due.length > 0) {
      const results = await this.deliverMany(
        due.map((d) => d.to),
        content,
        reference,
      );
      due.forEach(({ to, key }, i) => {
        // An adapter that answered for fewer messages than it was given: maybe sent.
        const result = results[i];
        outcomes.set(
          to,
          result && 'id' in result
            ? { to, receipt: this.#accepted(result.id, key) }
            : { to, error: this.#failure(result?.error, key) },
        );
      });
    }
    // Every address has its outcome by now: refused above, or answered for below.
    return addresses.map((to) => outcomes.get(to) as SendOutcome);
  }

  /** Checks a template message's reference, template, variables and length; renders it. */
  #render(message: Omit<TemplateMessage, 'to'>): {
    readonly content: { readonly text: string; readonly template: MessageTemplateId };
    readonly reference: string | null;
  } {
    const reference = message.reference ?? null;
    if (reference !== null && (typeof reference !== 'string' || !REFERENCE.test(reference))) {
      throw new InvalidMessageError('Not a message reference');
    }
    if (!isMessageTemplateId(message.template)) {
      throw new InvalidMessageError('Unknown message template');
    }
    if (!messageTemplate(message.template).channels.includes(this.name)) {
      throw new InvalidMessageError(`That template does not go out on ${this.name}`);
    }
    let text: string;
    try {
      // On push this is the template's variable-free lock-screen text (Phase 4d).
      text = renderMessage(message.template, message.variables, this.name);
    } catch (error) {
      if (error instanceof InvalidTemplateError) throw new InvalidMessageError(error.message);
      throw error;
    }
    this.#checkLength(text);
    return { content: { text, template: message.template }, reference };
  }

  async sendText(message: TextMessage): Promise<MessageReceipt> {
    this.#checkAddress(message.to);
    this.#checkLength(message.text);
    if (!(await this.freeFormAllowed(message.to, this.clock()))) {
      throw new FreeFormNotAllowedError(
        'Outside the 24-hour window: only a template may be sent on this channel',
      );
    }
    return this.#deliver(message.to, { text: message.text, template: null }, null);
  }

  async sendReply(message: ReplyMessage): Promise<MessageReceipt> {
    this.#checkAddress(message.to);
    this.#checkLength(message.text);
    const received = message.receivedAt;
    const age = received instanceof Date ? this.clock().getTime() - received.getTime() : Number.NaN;
    if (!(age >= 0 && age < REPLY_WINDOW_MS)) {
      throw new FreeFormNotAllowedError('A reply answers only a message received just now');
    }
    // No opt-out check: this is the answer to their own message (STOP's confirmation, or help).
    let id: string;
    try {
      id = await this.deliver(message.to, { text: message.text, template: null }, null);
    } catch (error) {
      throw this.#failure(error, null);
    }
    return this.#accepted(id, null);
  }

  async status(receiptId: string): Promise<DeliveryStatus | null> {
    return this.#statuses.get(receiptId) ?? null;
  }

  async recordStatus(receiptId: string, status: DeliveryStatus): Promise<boolean> {
    if (!this.#statuses.has(receiptId) || !DELIVERY_STATUSES.includes(status)) return false;
    this.#statuses.set(receiptId, status);
    return true;
  }

  async freeFormAllowed(_to: string, _now: Date): Promise<boolean> {
    return true;
  }

  async noteInbound(_from: string, _at: Date): Promise<void> {}

  #checkAddress(to: string): void {
    if (typeof to !== 'string' || !this.validAddress(to)) {
      throw new InvalidMessageError(`Not a ${this.name} address`);
    }
  }

  #checkLength(text: string): void {
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new InvalidMessageError('Empty message');
    }
    if (text.length > this.maxLength) throw new InvalidMessageError('Message too long');
  }

  async #deliver(
    to: string,
    content: { readonly text: string; readonly template: MessageTemplateId | null },
    reference: string | null,
  ): Promise<MessageReceipt> {
    const ready = await this.#beforeDelivery(to, reference);
    if ('receipt' in ready) return ready.receipt;
    let id: string;
    try {
      id = await this.deliver(to, content, reference);
    } catch (error) {
      throw this.#failure(error, ready.key);
    }
    return this.#accepted(id, ready.key);
  }

  /**
   * The last checks before the provider: the opt-out, then the reference. Either the receipt of
   * an earlier send under the same reference, or the key to remember this one by.
   */
  async #beforeDelivery(
    to: string,
    reference: string | null,
  ): Promise<{ readonly receipt: MessageReceipt } | { readonly key: string | null }> {
    // Last, so a malformed message never costs a lookup; immediately before the provider, so a
    // STOP that arrived a moment ago still counts.
    if (!(await this.gate(this.name, to))) throw new RecipientOptedOutError(this.name);
    // The same reference to the same address again: never a second message (A12-06).
    const key = reference === null ? null : `${reference} ${to}`;
    const earlier = key === null ? undefined : this.#references.get(key);
    if (earlier) {
      if (earlier.id === null) throw new DeliveryUnconfirmedError(this.name);
      return { receipt: { id: earlier.id, channel: this.name } };
    }
    return { key };
  }

  /** The provider took it: remembered under its reference, and accepted. */
  #accepted(id: string, key: string | null): MessageReceipt {
    if (key !== null) this.#remember(key, id);
    this.#statuses.set(id, 'accepted');
    return { id, channel: this.name };
  }

  /** What a provider's failure means to the caller (A12-06). */
  #failure(error: unknown, key: string | null): unknown {
    if (error instanceof InvalidMessageError || error instanceof ChannelSendError) return error;
    if (error instanceof MessageNotSentError) {
      return new ChannelSendError(this.name, { cause: error });
    }
    // The request may have reached the provider: the outcome is unknown.
    if (key !== null) this.#remember(key, null);
    return new DeliveryUnconfirmedError(this.name, { cause: error });
  }

  #remember(key: string, id: string | null): void {
    const now = this.clock().getTime();
    for (const [old, entry] of this.#references) {
      if (
        now - entry.at <= REFERENCE_MEMORY_MS &&
        this.#references.size < MAX_REMEMBERED_REFERENCES
      ) {
        break;
      }
      this.#references.delete(old);
    }
    this.#references.set(key, { id, at: now });
  }
}

export const SA_MOBILE = /^\+27\d{9}$/;
