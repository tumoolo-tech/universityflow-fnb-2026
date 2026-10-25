import { type MessageTemplateId, messageTemplate, messageText } from '@universityflow/content';
import {
  type ChannelOptions,
  GuardedChannel,
  MessageNotSentError,
  RecipientGoneError,
} from './channel';
import { EXPO_PUSH_TOKEN } from './channels';
import type { ReceiptChecker, ReceiptOutcome } from './reminders';

/**
 * Push notifications through Expo's push service (Phase 4d): the live push channel, behind the
 * same `GuardedChannel` checks as every other channel and the same contract suite
 * (channel.contract.ts), run here with a fake `fetch`, so no test reaches the network.
 *
 * **Where the message goes (A11, residency).** A notification leaves South Africa: our server
 * hands it to Expo (exp.host, in the United States), which hands it to Apple (APNs) or Google
 * (FCM), which deliver it to the phone. That is why a push carries only a template's
 * variable-free `pushBody` and the name of an app screen (`opens`), never a name, a university,
 * a subject or a mark (packages/content, messages.ts), and why the token, which identifies a
 * device, is the only thing about the learner that travels. docs/audits/A11-privacy-popia.md
 * records this.
 *
 * **Tickets and receipts.** Expo answers a send with a ticket: an id, or an error. A ticket error
 * `DeviceNotRegistered` means the app is gone from that phone: the token is forgotten at once
 * (`forgetAddress`) and the send is refused with `RecipientGoneError`, never retried. Other
 * ticket errors are provider failures, retried like any other. Some minutes later the receipt
 * says whether Apple or Google took it (`checkReceipts`); a receipt's `DeviceNotRegistered`
 * forgets the token too.
 *
 * **Batches (A5-04).** A reminder goes to all of a learner's phones (at most five, packages/db)
 * through `sendMany`: one request per 100 messages, Expo's limit, each message with its own
 * ticket, so each phone's receipt is checked (A11-07).
 *
 * Errors never quote a token or Expo's own message (which quotes the token): hard rule 4.
 */

export const EXPO_PUSH_SEND_URL = 'https://exp.host/--/api/v2/push/send';
export const EXPO_PUSH_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
/** Expo takes at most 100 messages a send request (A5-04). */
export const EXPO_PUSH_BATCH = 100;
/** Expo takes at most 1,000 receipt ids a request; we ask in smaller batches. */
export const EXPO_RECEIPT_BATCH = 300;
/** How long we remember which token a ticket went to: Expo keeps receipts for a day. */
export const EXPO_TICKET_MEMORY_MS = 24 * 60 * 60 * 1000;
const MAX_REMEMBERED_TICKETS = 50_000;
const DEFAULT_TIMEOUT_MS = 10_000;

/** The parts of `fetch` the adapter uses, so a test can pass a fake. */
export type PushFetch = (
  url: string,
  init: {
    readonly method: 'POST';
    readonly headers: Readonly<Record<string, string>>;
    readonly body: string;
    readonly signal?: AbortSignal;
  },
) => Promise<{ readonly ok: boolean; readonly status: number; json(): Promise<unknown> }>;

export interface ExpoPushOptions extends ChannelOptions {
  /** Defaults to the global `fetch`. */
  readonly fetch?: PushFetch;
  /**
   * `EXPO_ACCESS_TOKEN`, when the owner turns on Expo's "enhanced push security". Optional:
   * without it Expo accepts any send to a valid token.
   */
  readonly accessToken?: string | null;
  /** Forgets a token that no longer reaches a device (our own records). */
  readonly forgetAddress?: (token: string) => Promise<void>;
  readonly timeoutMs?: number;
}

interface ExpoTicket {
  readonly status?: unknown;
  readonly id?: unknown;
  readonly details?: { readonly error?: unknown; readonly expoPushToken?: unknown } | null;
}

/** The provider failed in a way worth retrying. A code word only, never Expo's message. */
class ExpoPushError extends Error {
  override readonly name = 'ExpoPushError';
}

export class ExpoPushChannel extends GuardedChannel implements ReceiptChecker {
  readonly name = 'push' as const;
  /** What a lock screen shows without truncating badly; Expo's own limit is 4 KB. */
  readonly maxLength = 240;
  readonly #fetch: PushFetch;
  readonly #accessToken: string | null;
  readonly #forget: (token: string) => Promise<void>;
  readonly #timeoutMs: number;
  /** Ticket id → the token it went to, for a receipt that doesn't name its token. */
  readonly #tickets = new Map<string, { readonly to: string; readonly at: number }>();

  constructor(options: ExpoPushOptions) {
    super(options);
    this.#fetch = options.fetch ?? ((url, init) => fetch(url, init));
    this.#accessToken = options.accessToken || null;
    this.#forget = options.forgetAddress ?? (async () => undefined);
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  protected validAddress(to: string): boolean {
    return EXPO_PUSH_TOKEN.test(to);
  }

  protected async deliver(
    to: string,
    content: { readonly text: string; readonly template: MessageTemplateId | null },
  ): Promise<string> {
    // One message is a batch of one: deliverMany answers for each address it is given.
    const result = (await this.deliverMany([to], content))[0] as
      | { readonly id: string }
      | { readonly error: unknown };
    if ('id' in result) return result.id;
    throw result.error;
  }

  /**
   * One request per `EXPO_PUSH_BATCH` messages (A5-04): a learner's phones get one request, not
   * one each. Expo answers with a ticket per message, in order. A request that fails fails for
   * every message in it, the same way a single send would.
   */
  protected override async deliverMany(
    to: ReadonlyArray<string>,
    content: { readonly text: string; readonly template: MessageTemplateId | null },
  ): Promise<ReadonlyArray<{ readonly id: string } | { readonly error: unknown }>> {
    // Which screen a tap opens: a word from a fixed list, never a link (the app ignores any
    // other value). Free-form text (a reply) opens home.
    const screen = content.template ? messageTemplate(content.template).opens : 'home';
    const results: Array<{ readonly id: string } | { readonly error: unknown }> = [];
    for (let i = 0; i < to.length; i += EXPO_PUSH_BATCH) {
      const batch = to.slice(i, i + EXPO_PUSH_BATCH);
      const messages = batch.map((address) => ({
        to: address,
        title: messageText.pushTitle,
        body: content.text,
        data: { screen },
        sound: 'default',
        priority: 'high',
      }));
      let tickets: unknown[];
      try {
        // Expo takes no idempotency key, so the reference stays with the channel (GuardedChannel).
        const body = await this.#post(EXPO_PUSH_SEND_URL, messages, { sending: true });
        const data = (body as { data?: unknown } | null)?.data;
        tickets = Array.isArray(data) ? data : [];
      } catch (error) {
        results.push(...batch.map(() => ({ error })));
        continue;
      }
      for (const [j, address] of batch.entries()) {
        try {
          results.push({ id: await this.#ticket(address, tickets[j] as ExpoTicket | undefined) });
        } catch (error) {
          results.push({ error });
        }
      }
    }
    return results;
  }

  /** What Expo's ticket for one message says: its id, or why it didn't go. */
  async #ticket(to: string, ticket: ExpoTicket | undefined): Promise<string> {
    if (ticket?.status === 'ok' && typeof ticket.id === 'string' && ticket.id !== '') {
      this.#remember(ticket.id, to);
      return ticket.id;
    }
    if (ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
      await this.#forget(to);
      throw new RecipientGoneError('The device is no longer registered for notifications');
    }
    if (ticket?.status === 'error') {
      // Expo answered for this message: it did not take it.
      throw new MessageNotSentError(
        `Expo refused the message: ${errorCode(ticket.details?.error)}`,
      );
    }
    // A success answer without a ticket we can read: Expo may well have taken the message.
    throw new ExpoPushError('Expo answered without a ticket');
  }

  /** What became of each ticket. Forgets tokens Apple or Google say are gone. */
  async checkReceipts(ids: ReadonlyArray<string>): Promise<ReadonlyMap<string, ReceiptOutcome>> {
    const outcomes = new Map<string, ReceiptOutcome>();
    const wanted = [...new Set(ids.filter((id) => typeof id === 'string' && id !== ''))];
    for (let i = 0; i < wanted.length; i += EXPO_RECEIPT_BATCH) {
      const batch = wanted.slice(i, i + EXPO_RECEIPT_BATCH);
      const body = await this.#post(EXPO_PUSH_RECEIPTS_URL, { ids: batch });
      const data = (body as { data?: unknown } | null)?.data;
      const receipts = data && typeof data === 'object' ? (data as Record<string, ExpoTicket>) : {};
      for (const id of batch) {
        const receipt = Object.hasOwn(receipts, id) ? receipts[id] : undefined;
        if (receipt?.status === 'ok') {
          await this.recordStatus(id, 'delivered');
          outcomes.set(id, 'delivered');
          this.#tickets.delete(id);
        } else if (receipt?.status === 'error') {
          await this.recordStatus(id, 'failed');
          outcomes.set(id, 'failed');
          if (receipt.details?.error === 'DeviceNotRegistered') {
            const named = receipt.details.expoPushToken;
            const token =
              typeof named === 'string' && EXPO_PUSH_TOKEN.test(named)
                ? named
                : this.#tickets.get(id)?.to;
            if (token) await this.#forget(token);
          }
          this.#tickets.delete(id);
        } else {
          outcomes.set(id, 'pending');
        }
      }
    }
    return outcomes;
  }

  /**
   * One request to Expo. When `sending`, a failure says whether the message could have gone
   * (A12-06): an HTTP error or a request-level error is Expo's answer (not sent, retryable); a
   * connection never made is not sent either; a timeout or a connection lost mid-request may
   * have reached Expo, so it stays an `ExpoPushError`, which the channel reports as unconfirmed.
   */
  async #post(url: string, payload: unknown, options?: { sending: boolean }): Promise<unknown> {
    const NotSent = options?.sending ? MessageNotSentError : ExpoPushError;
    const headers: Record<string, string> = {
      accept: 'application/json',
      'content-type': 'application/json',
    };
    if (this.#accessToken) headers['authorization'] = `Bearer ${this.#accessToken}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    let response: Awaited<ReturnType<PushFetch>>;
    try {
      response = await this.#fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (error) {
      if (!controller.signal.aborted && neverConnected(error)) {
        throw new NotSent('Expo could not be reached');
      }
      throw new ExpoPushError('Expo did not answer');
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) throw new NotSent(`Expo answered HTTP ${response.status}`);
    const body = (await response.json().catch(() => null)) as { errors?: unknown } | null;
    // A request-level error (bad credentials, a malformed request): nothing was sent.
    if (Array.isArray(body?.errors) && body.errors.length > 0) {
      throw new NotSent('Expo refused the request');
    }
    return body;
  }

  #remember(ticketId: string, to: string): void {
    const now = this.clock().getTime();
    for (const [id, ticket] of this.#tickets) {
      if (now - ticket.at <= EXPO_TICKET_MEMORY_MS && this.#tickets.size < MAX_REMEMBERED_TICKETS) {
        break;
      }
      this.#tickets.delete(id);
    }
    this.#tickets.set(ticketId, { to, at: now });
  }
}

/** Failures before any connection to Expo existed: the request can't have reached it. */
const NEVER_CONNECTED = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN']);

function neverConnected(error: unknown): boolean {
  const cause = (error as { cause?: { code?: unknown } } | null)?.cause;
  return typeof cause?.code === 'string' && NEVER_CONNECTED.has(cause.code);
}

/** Expo's error code if it is one we know the shape of; a placeholder otherwise. */
function errorCode(value: unknown): string {
  return typeof value === 'string' && /^[A-Za-z]{1,40}$/.test(value) ? value : 'unknown';
}
