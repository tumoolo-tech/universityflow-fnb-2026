import type {
  MessageTemplateId,
  TemplateVariables,
  WhatsAppCategory,
} from '@universityflow/content';
import {
  defineJobKind,
  type EntityId,
  entityId,
  handle,
  JOB_LEASE_MS,
  type JobHandler,
  type JobScheduler,
} from '@universityflow/jobs';
import { budgetRetryAfterMs } from './budget';
import {
  CADENCE_HORIZON_MS,
  type CadenceDecision,
  nextAllowedSend,
  type PaperSlot,
  WEEK_MS,
} from './cadence';
import {
  type ChannelName,
  type DeliveryStatus,
  DeliveryUnconfirmedError,
  InvalidMessageError,
  type MessageChannel,
  RecipientGoneError,
  RecipientOptedOutError,
  type SendOutcome,
} from './channel';

/**
 * The outbound pipeline (planning.md §11, Phase 4a): a reminder row → a `reminder.send` job
 * carrying the reminder's id only (hard rule 4) → this handler → the channel → a receipt.
 *
 * Everything is checked again **at send time**, because a lot can change between scheduling a
 * reminder and its moment: consent (a guardian withdraws, hard rule 5), the channel opt-in (the
 * learner says STOP), cadence (other messages went out), quiet hours, a paper. The store makes
 * the consent, opt-in and cadence checks and claims the send in one locked transaction, so two
 * runners can't both take the learner's last slot. The channel then checks the opt-in once more
 * against our records just before handing the message over.
 *
 * Not allowed now → rescheduled to the next allowed time, or dropped with a recorded reason.
 * Deleted account → the reminder is gone, and so is its job; a job that still runs finds nothing.
 *
 * **At most once** (A12-06, A12-14, A1-15). A claimed reminder is never claimed again, so it is
 * never sent twice, and every way out of the claim is recorded:
 * - sent → `sent`, with the receipt;
 * - the provider certainly didn't take it → the claim is given back and the job retried;
 * - the provider may have taken it (a timeout after the request went out) → `unconfirmed`, never
 *   retried; it keeps its place in the cadence, because it may well have reached the phone;
 * - anything that fails after the claim and before a send (a lookup, the database) → the claim is
 *   given back and the job retried: nothing went out;
 * - the runner dies, or can't record what happened → a `reminder.sweep` job, scheduled before the
 *   claim, finds the reminder still `sending` after the job lease and fails it as
 *   `unknown-outcome`. Never resent.
 */

export const REMINDER_SEND = defineJobKind('reminder.send', ['reminderId']);
/** Closes a reminder whose runner died after claiming it. Carries the reminder's id only. */
export const REMINDER_SWEEP = defineJobKind('reminder.sweep', ['reminderId']);

/** Attempts per job; a provider failure is retried with the scheduler's backoff. */
export const REMINDER_MAX_ATTEMPTS = 3;
/**
 * When the sweep looks: past the job lease, when no live runner still holds the claim, with a
 * minute's margin.
 */
export const REMINDER_SWEEP_AFTER_MS = JOB_LEASE_MS + 60 * 1000;
/** Sweep attempts: a claim found younger than the lease is looked at again with the backoff. */
export const REMINDER_SWEEP_ATTEMPTS = 3;
/** A reminder pushed back more than this from its time is no longer useful: dropped. */
export const REMINDER_STALE_AFTER_MS = WEEK_MS;
/** Reschedules at most, whatever the reason: a loop guard. */
export const REMINDER_MAX_RESCHEDULES = 20;

/**
 * `unconfirmed`: the provider may have taken it but never said so (A12-06). Like `sending` and
 * `sent`, it counts towards the cadence; unlike `sending`, it is final.
 */
export type ReminderStatus =
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'unconfirmed'
  | 'dropped'
  | 'failed';

/** Why a reminder was not sent. Recorded on the reminder; IDs and words only. */
export type ReminderDropReason =
  | 'no-consent'
  | 'not-opted-in'
  | 'no-address'
  | 'channel-unavailable'
  | 'cadence'
  | 'stale'
  | 'unresolved'
  | 'invalid';

/**
 * Why a reminder failed. `unknown-outcome`: it may or may not have gone (a dead runner, A12-14;
 * on an `unconfirmed` reminder, a provider that never answered, A12-06).
 */
export type ReminderFailReason = 'provider-error' | 'internal-error' | 'unknown-outcome';

export interface ReminderRecord {
  readonly id: string;
  readonly studentId: string;
  readonly templateId: MessageTemplateId;
  readonly channel: ChannelName;
  /** Catalogue references the template's variables come from (`universityId`, `subjectId`). */
  readonly params: Readonly<Record<string, string>>;
  readonly desiredAt: Date;
  readonly status: ReminderStatus;
  readonly reschedules: number;
  /** The provider's id for the message, once sent (an Expo push ticket id, for push). */
  readonly receiptId?: string | null;
  /**
   * Every id the send was given, the first being `receiptId`: on push, one ticket per phone
   * (A11-07), each of which has its receipt checked.
   */
  readonly receiptIds?: ReadonlyArray<string> | null;
}

/** What the cadence rules need, read inside the claim's transaction. */
export interface CadenceContext {
  readonly maxPerWeek: number;
  readonly recentSends: ReadonlyArray<Date>;
}

export interface Recipient {
  readonly address: string;
  /**
   * More addresses on the same channel, sent the same message: push, where one learner may have
   * the app on several phones (Phase 4d, at most five, A5-04). Every address's receipt is
   * recorded; the first address's is the reminder's `receiptId`.
   */
  readonly otherAddresses?: ReadonlyArray<string>;
}

export type ClaimOutcome =
  /** The reminder is no longer waiting (sent, dropped, or deleted with the account). */
  | { readonly kind: 'gone' }
  | { readonly kind: 'drop'; readonly reason: 'no-consent' | 'not-opted-in' | 'no-address' }
  | { readonly kind: 'wait'; readonly decision: Exclude<CadenceDecision, { kind: 'now' }> }
  /** Claimed: the reminder is now "sending" and counts towards the cadence. */
  | { readonly kind: 'send'; readonly recipient: Recipient };

/** The reminder's storage. Postgres in the app (packages/db), memory in unit tests. */
export interface ReminderStore {
  reminder(id: string): Promise<ReminderRecord | null>;
  /**
   * In one transaction, locked per learner: checks consent and the channel opt-in, asks
   * `decide` with the learner's cap and recent sends, and on "now" marks the reminder sending.
   */
  claimSend(
    id: string,
    now: Date,
    decide: (context: CadenceContext) => CadenceDecision,
  ): Promise<ClaimOutcome>;
  /**
   * Sending → sent, with every receipt the send was given (never empty): the first is the
   * reminder's `receiptId`, the rest the other phones' tickets (A11-07).
   */
  recordSent(id: string, receiptIds: ReadonlyArray<string>, at: Date): Promise<void>;
  /**
   * Records the `receipt.check` job that now carries a sent reminder, so account deletion can
   * cancel it in a hosted scheduler too (A11-11).
   */
  recordReceiptJob(id: string, jobId: string, at: Date): Promise<void>;
  /** Sending → scheduled again (a provider failure that will be retried). */
  release(id: string, at: Date): Promise<void>;
  /** Scheduled or sending → failed: the provider kept refusing, or our own side kept failing. */
  recordFailed(id: string, at: Date, reason: ReminderFailReason): Promise<void>;
  /**
   * Sending → unconfirmed, reason `unknown-outcome`: the provider may have taken it (A12-06).
   * Keeps `sent_at`: it counts towards the cadence. Never retried.
   */
  recordUnconfirmed(id: string, at: Date): Promise<void>;
  /**
   * Sending, claimed at or before `claimedBefore` → failed, reason `unknown-outcome` (A12-14).
   * False, changing nothing, for a reminder not in that state.
   */
  sweepStale(id: string, claimedBefore: Date, at: Date): Promise<boolean>;
  drop(id: string, reason: ReminderDropReason, at: Date): Promise<void>;
  /** Records the job that now carries a waiting reminder. */
  setJob(id: string, jobId: string, at: Date, rescheduled: boolean): Promise<void>;
  /**
   * A provider's delivery report for a sent message. False when no sent reminder has it. On
   * WhatsApp, `category` is the category Meta billed it as, recorded when given (A12-09).
   */
  recordDelivery(
    channel: ChannelName,
    receiptId: string,
    status: DeliveryStatus,
    category?: WhatsAppCategory,
  ): Promise<boolean>;
}

/**
 * A channel whose provider reports delivery later, by receipt (Expo push): asked some minutes
 * after a send, it says what became of each message, and forgets addresses that no longer
 * reach anyone.
 */
export interface ReceiptChecker {
  checkReceipts(ids: ReadonlyArray<string>): Promise<ReadonlyMap<string, ReceiptOutcome>>;
}

/** delivered or failed: final. pending: the provider doesn't know yet; ask again later. */
export type ReceiptOutcome = 'delivered' | 'failed' | 'pending';

export function checksReceipts(
  channel: MessageChannel,
): channel is MessageChannel & ReceiptChecker {
  return typeof (channel as Partial<ReceiptChecker>).checkReceipts === 'function';
}

/** Checks a sent push message's receipt. The job carries the reminder's id only (hard rule 4). */
export const RECEIPT_CHECK = defineJobKind('receipt.check', ['reminderId']);
/** Expo keeps receipts for a day and has most ready in about 15 minutes. */
export const RECEIPT_CHECK_DELAY_MS = 15 * 60 * 1000;
/** First check plus retries (1, 2, 4, 8 minutes later) while the receipt is pending. */
export const RECEIPT_CHECK_ATTEMPTS = 5;

export class ReceiptPendingError extends Error {
  override readonly name = 'ReceiptPendingError';
}

/** The papers a learner sits (4b: the verified timetable). Until then, `noPaperSlots`. */
export interface PaperSlotSource {
  slotsFor(studentId: string, from: Date, to: Date): Promise<ReadonlyArray<PaperSlot>>;
}

export const noPaperSlots: PaperSlotSource = { slotsFor: async () => [] };

/**
 * Fills a template's variables from the reminder's catalogue references. Null when a reference no
 * longer resolves (a university hidden until verified, hard rule 3): the reminder is dropped. The
 * variables are checked, never shown in a message (A11-02).
 */
export type VariableResolver = (
  reminder: ReminderRecord,
  recipient: Recipient,
) => TemplateVariables | null;

export interface ReminderPipeline {
  readonly store: ReminderStore;
  readonly channels: Partial<Readonly<Record<ChannelName, MessageChannel>>>;
  readonly scheduler: JobScheduler;
  readonly papers: PaperSlotSource;
  readonly resolve: VariableResolver;
  readonly clock?: () => Date;
}

/** Puts a reminder's job on the schedule. One job per reminder and attempt number. */
export async function scheduleReminderJob(
  scheduler: JobScheduler,
  reminderId: string,
  runAt: Date,
  reschedules: number,
): Promise<string> {
  const id: EntityId = entityId(reminderId);
  const job = await scheduler.schedule({
    kind: REMINDER_SEND,
    payload: { reminderId: id },
    runAt,
    idempotencyKey: `reminder:${id}:${reschedules}`,
    maxAttempts: REMINDER_MAX_ATTEMPTS,
  });
  return job.id;
}

/**
 * Puts a waiting reminder on a new job at `at`, or drops it as stale when that is too far past
 * its time or it has been put back too often.
 */
async function rescheduleOrDrop(
  pipeline: ReminderPipeline,
  reminder: ReminderRecord,
  at: Date,
  now: Date,
): Promise<void> {
  if (
    at.getTime() - reminder.desiredAt.getTime() > REMINDER_STALE_AFTER_MS ||
    reminder.reschedules >= REMINDER_MAX_RESCHEDULES
  ) {
    await pipeline.store.drop(reminder.id, 'stale', now);
    return;
  }
  const next = reminder.reschedules + 1;
  const jobId = await scheduleReminderJob(pipeline.scheduler, reminder.id, at, next);
  await pipeline.store.setJob(reminder.id, jobId, now, true);
}

/** The `reminder.send` handler. */
export function reminderHandler(pipeline: ReminderPipeline): JobHandler {
  const clock = pipeline.clock ?? (() => new Date());
  return handle(REMINDER_SEND, async ({ reminderId }, context) => {
    const { store } = pipeline;
    const reminder = await store.reminder(reminderId);
    if (reminder?.status !== 'scheduled') return;
    const now = clock();

    const channel = pipeline.channels[reminder.channel];
    if (!channel) {
      await store.drop(reminder.id, 'channel-unavailable', now);
      return;
    }
    const papers = await pipeline.papers.slotsFor(
      reminder.studentId,
      new Date(now.getTime() - WEEK_MS),
      new Date(now.getTime() + CADENCE_HORIZON_MS + WEEK_MS),
    );
    // Before the claim, so a runner that dies at any moment after it still leaves the sweep
    // behind (A12-14). One per run: a retried or rescheduled run claims afresh.
    await pipeline.scheduler.schedule({
      kind: REMINDER_SWEEP,
      payload: { reminderId: entityId(reminder.id) },
      delayMs: REMINDER_SWEEP_AFTER_MS,
      idempotencyKey: `reminder-sweep:${reminder.id}:${reminder.reschedules}:${context.attempt}`,
      maxAttempts: REMINDER_SWEEP_ATTEMPTS,
    });
    const outcome = await store.claimSend(reminder.id, now, ({ maxPerWeek, recentSends }) =>
      nextAllowedSend({ now, notBefore: reminder.desiredAt, maxPerWeek, recentSends, papers }),
    );

    switch (outcome.kind) {
      case 'gone':
        return;
      case 'drop':
        await store.drop(reminder.id, outcome.reason, now);
        return;
      case 'wait': {
        const { decision } = outcome;
        if (decision.kind === 'never') {
          await store.drop(reminder.id, 'cadence', now);
          return;
        }
        await rescheduleOrDrop(pipeline, reminder, decision.at, now);
        return;
      }
      case 'send':
        break;
    }

    // From here until the first send, nothing has gone out: a failure gives the claim back and
    // the job is retried (A1-15), or, on its last attempt, the reminder is failed.
    let variables: TemplateVariables | null;
    try {
      variables = pipeline.resolve(reminder, outcome.recipient);
      if (!variables) {
        await store.drop(reminder.id, 'unresolved', now);
        return;
      }
    } catch (error) {
      if (context.attempt < REMINDER_MAX_ATTEMPTS) await store.release(reminder.id, now);
      else await store.recordFailed(reminder.id, now, 'internal-error');
      throw error;
    }
    // One address, or several on push (the app on more than one phone): each gets the message,
    // in one request where the provider allows it (Expo, A5-04), and each receipt is kept
    // (A11-07). A refusal for one address doesn't stop the rest. The reminder's id is the
    // idempotency reference: one reminder, one message per address.
    const addresses = [outcome.recipient.address, ...(outcome.recipient.otherAddresses ?? [])];
    let outcomes: ReadonlyArray<SendOutcome>;
    try {
      outcomes = await channel.sendMany({
        to: addresses,
        template: reminder.templateId,
        variables,
        reference: reminder.id,
      });
    } catch (error) {
      // The message itself was refused (a template, a variable): the same for every address.
      outcomes = addresses.map((to) => ({ to, error }));
    }
    const receiptIds: string[] = [];
    let providerError: unknown = null;
    let unconfirmed = false;
    let optedOut = false;
    let invalid = false;
    for (const sent of outcomes) {
      if ('receipt' in sent) {
        receiptIds.push(sent.receipt.id);
        continue;
      }
      const { error } = sent;
      if (error instanceof RecipientOptedOutError) optedOut = true;
      else if (error instanceof RecipientGoneError) continue;
      else if (error instanceof InvalidMessageError) invalid = true;
      else if (error instanceof DeliveryUnconfirmedError) unconfirmed = true;
      else providerError ??= error;
    }
    if (receiptIds.length === 0) {
      if (unconfirmed) {
        // It may have reached the phone: never sent again (A12-06). This comes first: a slot
        // given back here could send the message twice.
        await store.recordUnconfirmed(reminder.id, now);
        return;
      }
      // A spent SMS or WhatsApp budget is not a provider failure (A12-08, A12-15): give the slot back and try again
      // once the budget's window has passed, without spending one of the job's retries.
      const budgetWait = budgetRetryAfterMs(providerError);
      if (budgetWait !== null) {
        await store.release(reminder.id, now);
        await rescheduleOrDrop(pipeline, reminder, new Date(now.getTime() + budgetWait), now);
        return;
      }
      if (providerError !== null) {
        // The provider certainly didn't take it: give the slot back and let the scheduler retry,
        // or give up.
        if (context.attempt < REMINDER_MAX_ATTEMPTS) {
          await store.release(reminder.id, now);
          throw providerError;
        }
        await store.recordFailed(reminder.id, now, 'provider-error');
        return;
      }
      // Opted out wins; then a message the channel refused; else every device was gone.
      await store.drop(
        reminder.id,
        optedOut ? 'not-opted-in' : invalid ? 'invalid' : 'no-address',
        now,
      );
      return;
    }
    await store.recordSent(reminder.id, receiptIds, now);
    if (checksReceipts(channel)) {
      // Best effort: a delivery report is worth having, never worth failing a sent reminder.
      // The job is recorded on the reminder, so account deletion can cancel it (A11-11).
      await pipeline.scheduler
        .schedule({
          kind: RECEIPT_CHECK,
          payload: { reminderId: entityId(reminder.id) },
          delayMs: RECEIPT_CHECK_DELAY_MS,
          idempotencyKey: `receipt:${reminder.id}`,
          maxAttempts: RECEIPT_CHECK_ATTEMPTS,
        })
        .then((job) => store.recordReceiptJob(reminder.id, job.id, now))
        .catch(() => undefined);
    }
  });
}

/** A claim younger than the job lease: its runner may still be at work. Looked at again later. */
export class ReminderStillSendingError extends Error {
  override readonly name = 'ReminderStillSendingError';
}

/**
 * The `reminder.sweep` handler (A12-14): a reminder still `sending` once the job lease has run out
 * belongs to a runner that died, or that couldn't record what happened. It is failed as
 * `unknown-outcome` (the message may or may not have gone) and never resent; its cadence slot is
 * freed. Anything else (sent, dropped, scheduled again, gone) is left alone.
 */
export function reminderSweepHandler(
  pipeline: Pick<ReminderPipeline, 'store' | 'clock'>,
): JobHandler {
  const clock = pipeline.clock ?? (() => new Date());
  return handle(REMINDER_SWEEP, async ({ reminderId }) => {
    const reminder = await pipeline.store.reminder(reminderId);
    if (reminder?.status !== 'sending') return;
    const now = clock();
    const claimedBefore = new Date(now.getTime() - JOB_LEASE_MS);
    if (await pipeline.store.sweepStale(reminder.id, claimedBefore, now)) return;
    // Still sending, but claimed within the lease (or it changed under us): look again later.
    const again = await pipeline.store.reminder(reminderId);
    if (again?.status === 'sending') {
      throw new ReminderStillSendingError('The reminder was claimed too recently to sweep');
    }
  });
}

/**
 * The `receipt.check` handler: asks the channel what became of a sent message, on every phone it
 * went to (A11-07), and records it: delivered once any phone has it, failed once every phone's
 * receipt says it failed. While any receipt is not ready yet it is retried with the scheduler's
 * backoff (so a phone that is gone is still found); after the last attempt the reminder keeps
 * what was recorded. The channel itself forgets an address the provider says no longer exists
 * (Expo's `DeviceNotRegistered`).
 */
export function receiptCheckHandler(
  pipeline: Pick<ReminderPipeline, 'store' | 'channels'>,
): JobHandler {
  return handle(RECEIPT_CHECK, async ({ reminderId }) => {
    const reminder = await pipeline.store.reminder(reminderId);
    if (reminder?.status !== 'sent' || !reminder.receiptId) return;
    const channel = pipeline.channels[reminder.channel];
    if (!channel || !checksReceipts(channel)) return;
    const { receiptId } = reminder;
    const ids = reminder.receiptIds?.length ? reminder.receiptIds : [receiptId];
    const found = await channel.checkReceipts(ids);
    const outcomes = ids.map((id) => found.get(id) ?? 'pending');
    const delivered = outcomes.includes('delivered');
    if (delivered) await pipeline.store.recordDelivery(reminder.channel, receiptId, 'delivered');
    if (outcomes.includes('pending')) {
      throw new ReceiptPendingError('A receipt is not ready yet');
    }
    if (!delivered) await pipeline.store.recordDelivery(reminder.channel, receiptId, 'failed');
  });
}
