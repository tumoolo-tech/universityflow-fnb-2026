import type { MessageTemplateId } from '@universityflow/content';
import { SmsBudgetExceededError } from './budget';
import {
  type ChannelName,
  type ChannelOptions,
  GuardedChannel,
  InvalidMessageError,
  MessageNotSentError,
  SA_MOBILE,
  WHATSAPP_WINDOW_MS,
} from './channel';
import { InvalidSmsError, SMS_MAX_LENGTH, type SmsSender } from './sms';
import { SMS_MAX_SEGMENTS, smsSegments, toGsm7Typography } from './sms-encoding';

/**
 * The channels. `SmsChannel` wraps any `SmsSender` (the local outbox now, the chosen provider
 * later, always inside an SMS budget: in the app, the reminders' own, apart from sign-in's). WhatsApp and push have in-memory stand-ins until
 * the owner picks the providers (D8); each live adapter extends `GuardedChannel` the same way.
 */

export interface SentMessage {
  readonly id: string;
  readonly channel: ChannelName;
  readonly to: string;
  readonly text: string;
  /** The template it was made from, or null for free-form text. */
  readonly template: MessageTemplateId | null;
  readonly at: Date;
}

/**
 * SMS over an `SmsSender`. Free-form text is allowed; we still only send our own words.
 *
 * Billed by segment (A1-14, A12-07): the text goes out with its typography made GSM-7 (curly
 * quotes and dashes from `packages/content` would send the whole message as UCS-2, at twice the
 * segments), and anything over `SMS_MAX_SEGMENTS` by its real encoding is refused as an invalid
 * message, never retried as if the provider had failed.
 *
 * What a sender's failure means (A12-06): an SMS budget refusing (`SmsBudgetExceededError`, kept
 * as the cause so the pipeline can wait out its window) or a sender throwing `MessageNotSentError`
 * means nothing went out. Anything else, a live sender's timeout included, counts as maybe sent
 * and is never retried.
 */
export class SmsChannel extends GuardedChannel {
  readonly name = 'sms' as const;
  readonly maxLength = SMS_MAX_LENGTH;
  readonly #sender: SmsSender;

  constructor(sender: SmsSender, options: ChannelOptions) {
    super(options);
    this.#sender = sender;
  }

  protected validAddress(to: string): boolean {
    return SA_MOBILE.test(to);
  }

  protected async deliver(to: string, content: { readonly text: string }): Promise<string> {
    const body = toGsm7Typography(content.text);
    if (smsSegments(body) > SMS_MAX_SEGMENTS) throw new InvalidMessageError('Message too long');
    try {
      const { id } = await this.#sender.send({ to, body });
      return id;
    } catch (error) {
      if (error instanceof SmsBudgetExceededError) {
        throw new MessageNotSentError('The SMS budget is spent', { cause: error });
      }
      if (error instanceof InvalidSmsError) throw new InvalidMessageError(error.message);
      throw error;
    }
  }
}

/** Shared by the in-memory stand-ins: keeps what was sent, and can be told to fail. */
abstract class MemoryChannel extends GuardedChannel {
  readonly #sent: SentMessage[] = [];
  #failures = 0;
  #acceptThenFail = 0;
  #next = 1;

  /** The next `n` sends fail as a provider outage would: nothing goes out. */
  failNext(n = 1): void {
    this.#failures = n;
  }

  /** The next `n` sends go out, then fail as a timeout after the provider took them would. */
  acceptThenFailNext(n = 1): void {
    this.#acceptThenFail = n;
  }

  /** Everything sent, newest first. */
  all(): ReadonlyArray<SentMessage> {
    return [...this.#sent].reverse();
  }

  to(address: string): ReadonlyArray<SentMessage> {
    return this.all().filter((m) => m.to === address);
  }

  clear(): void {
    this.#sent.length = 0;
  }

  protected async deliver(
    to: string,
    content: { readonly text: string; readonly template: MessageTemplateId | null },
  ): Promise<string> {
    if (this.#failures > 0) {
      this.#failures -= 1;
      throw new MessageNotSentError('stand-in provider outage');
    }
    const id = `local-${this.name}-${this.#next++}`;
    this.#sent.push({ id, channel: this.name, to, ...content, at: this.clock() });
    if (this.#acceptThenFail > 0) {
      this.#acceptThenFail -= 1;
      throw new Error('stand-in provider timed out');
    }
    return id;
  }
}

/**
 * WhatsApp, as Meta's Cloud API behaves: templates (utility) at any time, free-form text only
 * within 24 hours of the learner's last message. Meta's limits: 1,024 characters for a template
 * body; we hold free-form replies to the same, so one limit covers both.
 */
export class MemoryWhatsAppChannel extends MemoryChannel {
  readonly name = 'whatsapp' as const;
  readonly maxLength = 1024;
  override readonly templateOnlyOutsideWindow = true;
  readonly #lastInbound = new Map<string, number>();

  protected validAddress(to: string): boolean {
    return SA_MOBILE.test(to);
  }

  override async freeFormAllowed(to: string, now: Date): Promise<boolean> {
    const last = this.#lastInbound.get(to);
    return last !== undefined && now.getTime() - last < WHATSAPP_WINDOW_MS;
  }

  override async noteInbound(from: string, at: Date): Promise<void> {
    const last = this.#lastInbound.get(from) ?? Number.NEGATIVE_INFINITY;
    this.#lastInbound.set(from, Math.max(last, at.getTime()));
  }
}

/** An Expo push token: the shape the app registers in Phase 4d. */
export const EXPO_PUSH_TOKEN = /^ExponentPushToken\[[A-Za-z0-9_-]{10,64}\]$/;

/**
 * Push notifications (Expo, Phase 4d). 240 characters: what a lock screen shows without
 * truncating badly, well inside Expo's 4 KB payload.
 */
export class MemoryPushChannel extends MemoryChannel {
  readonly name = 'push' as const;
  readonly maxLength = 240;

  protected validAddress(to: string): boolean {
    return EXPO_PUSH_TOKEN.test(to);
  }
}
