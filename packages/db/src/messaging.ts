import {
  currentGrade,
  type ExamSubjectChoice,
  examGrade,
  isSubjectId,
} from '@universityflow/catalogue';
import {
  isMessageTemplateId,
  isWhatsAppCategory,
  type WhatsAppCategory,
} from '@universityflow/content';
import { isEntityId } from '@universityflow/jobs';
import type {
  CadenceContext,
  CadenceDecision,
  ChannelName,
  ClaimOutcome,
  DeliveryStatus,
  ReminderDropReason,
  ReminderFailReason,
  ReminderRecord,
  ReminderStore,
} from '@universityflow/messaging';
import { EXPO_PUSH_TOKEN } from '@universityflow/messaging';
import { and, desc, eq, gt, inArray, lte, sql } from 'drizzle-orm';
import { sastDate } from './age';
import { type Db, rowsOf } from './client';
import { scopeToLearner } from './learner';
import {
  auditLog,
  examSubjectChoices,
  LATEST_REPORT_FIRST,
  messagingChannels,
  messagingSuppressions,
  pushTokens,
  reminders,
  sessions,
  students,
} from './schema';

export interface ExamInputs {
  readonly grade: number | null;
  /** Subjects on the latest report the learner confirmed. */
  readonly confirmedSubjects: ReadonlyArray<string>;
  readonly choices: ReadonlyArray<ExamSubjectChoice>;
}

/**
 * The messaging side of the database that runs without a learner's request: the reminder job's
 * store, the channels' last-moment opt-in check, and inbound messages (STOP, replies). It acts
 * as the owner, by ids only, and drops to the learner's own role (`uf_app`, row-level security
 * and the consent check, hard rule 5) for everything that reads their personal data.
 *
 * Nothing here logs. Audit rows carry ids and channel names only (hard rule 4).
 */

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Sends counted by the cadence: the longest window is seven days; a day's margin. */
const SEND_LOOKBACK_MS = 8 * 24 * 60 * 60 * 1000;

export type InboundResult =
  /** No account has that number: nothing is recorded about anyone (a STOP is still suppressed). */
  | 'unknown'
  /** The learner's STOP is recorded for that channel. */
  | 'stopped'
  /** An ordinary message: the channel's 24-hour window opens (when the data may be processed). */
  | 'recorded';

/** A number (E.164) as the suppression list keys it: an HMAC, never the number (hard rule 4). */
export type NumberHash = (phone: string) => string;

/** The channels a suppression applies to: the ones that reach a phone number. */
type NumberChannel = 'sms' | 'whatsapp';
const isNumberChannel = (channel: ChannelName): channel is NumberChannel =>
  channel === 'sms' || channel === 'whatsapp';

export class MessagingStore implements ReminderStore {
  readonly #db: Db;
  readonly #numberHash: NumberHash;
  readonly #clock: () => Date;

  constructor(db: Db, numberHash: NumberHash, clock: () => Date = () => new Date()) {
    this.#db = db;
    this.#numberHash = numberHash;
    this.#clock = clock;
  }

  /**
   * The consent rule `uf_may_process` applies (migration 0014), for the learner on the row, on
   * `at`'s day in South Africa: a guardian's consent ends at 18, and an adult must have agreed in
   * their own name (A1-13). The owner's queries here filter by it, so the channels' last-moment
   * check and the pipeline's gate can never disagree.
   */
  #consentCovers(at: Date = this.#clock()) {
    return sql`uf_consent_covers(${students.id}, ${sastDate(at)}::date)`;
  }

  // ── The suppression list (audit A12-04) ────────────────────────────────────────────────────

  /** When `phone` last said STOP on `channel`, or null. Owner-only table, by HMAC only. */
  async #stoppedAt(channel: NumberChannel, phone: string): Promise<Date | null> {
    const [row] = await this.#db
      .select({ stoppedAt: messagingSuppressions.stoppedAt })
      .from(messagingSuppressions)
      .where(
        and(
          eq(messagingSuppressions.channel, channel),
          eq(messagingSuppressions.numberHash, this.#numberHash(phone)),
        ),
      );
    return row ? new Date(row.stoppedAt) : null;
  }

  /**
   * True when `phone` (E.164) replied STOP on `channel`, whether or not it has an account. Push
   * reaches a phone's token, not a number, and has no STOP: never suppressed here.
   */
  async isSuppressed(channel: ChannelName, phone: string): Promise<boolean> {
    if (!isNumberChannel(channel)) return false;
    return (await this.#stoppedAt(channel, phone)) !== null;
  }

  // ── The reminder pipeline (ReminderStore) ──────────────────────────────────────────────────

  async reminder(id: string): Promise<ReminderRecord | null> {
    if (!isEntityId(id)) return null;
    const [row] = await this.#db.select().from(reminders).where(eq(reminders.id, id));
    if (!row || !isMessageTemplateId(row.templateId)) return null;
    return {
      id: row.id,
      studentId: row.studentId,
      templateId: row.templateId,
      channel: row.channel,
      params: row.params,
      desiredAt: row.desiredAt,
      status: row.status,
      reschedules: row.reschedules,
      receiptId: row.receiptId,
      receiptIds: row.receiptIds,
    };
  }

  async claimSend(
    id: string,
    now: Date,
    decide: (context: CadenceContext) => CadenceDecision,
  ): Promise<ClaimOutcome> {
    if (!isEntityId(id)) return { kind: 'gone' };
    return this.#db.transaction(async (tx): Promise<ClaimOutcome> => {
      const [found] = await tx
        .select({ studentId: reminders.studentId })
        .from(reminders)
        .where(eq(reminders.id, id));
      if (!found) return { kind: 'gone' };
      const sid = found.studentId;
      // One claim at a time per learner: the cadence counts every send, so two runners must
      // not both see room for one more.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`messaging:${sid}`}))`);
      // From here on, as the learner: row-level security and the consent gate decide, on the
      // day `now` falls on in South Africa (an 18th birthday ends a guardian's consent, A1-13).
      await scopeToLearner(tx, sid, now);
      await tx.execute(sql`set local role uf_app`);
      const [gate] = rowsOf<{ ok: boolean }>(
        await tx.execute(sql`select uf_may_process(${sid}::uuid) as ok`),
      );
      if (gate?.ok !== true) return { kind: 'drop', reason: 'no-consent' };

      const [reminder] = await tx
        .select()
        .from(reminders)
        .where(eq(reminders.id, id))
        .for('update');
      if (reminder?.status !== 'scheduled') return { kind: 'gone' };

      const [choice] = await tx
        .select({ optedIn: messagingChannels.optedIn })
        .from(messagingChannels)
        .where(eq(messagingChannels.channel, reminder.channel));
      if (choice?.optedIn !== true) return { kind: 'drop', reason: 'not-opted-in' };

      const [prefs] = rowsOf<{ max_per_week: number }>(
        await tx.execute(sql`select max_per_week from messaging_preferences`),
      );
      const sends = rowsOf<{ sent_at: Date | string }>(
        await tx.execute(sql`
          select sent_at from reminders
          where sent_at is not null
            and sent_at > ${new Date(now.getTime() - SEND_LOOKBACK_MS).toISOString()}::timestamptz`),
      );
      const decision = decide({
        maxPerWeek: Number(prefs?.max_per_week ?? 2),
        recentSends: sends.map((s) => new Date(s.sent_at)),
      });
      if (decision.kind !== 'now') return { kind: 'wait', decision };

      const [address, ...otherAddresses] = await this.#addresses(tx, reminder.channel, now);
      if (!address) return { kind: 'drop', reason: 'no-address' };
      // No name is read: no message carries one (A11-02).
      await tx
        .update(reminders)
        .set({ status: 'sending', sentAt: now, updatedAt: now })
        .where(and(eq(reminders.id, id), eq(reminders.status, 'scheduled')));
      return {
        kind: 'send',
        recipient: {
          address,
          ...(otherAddresses.length > 0 ? { otherAddresses } : {}),
        },
      };
    });
  }

  /**
   * Where this channel reaches the learner (run as the learner): their number, or for push every
   * phone with notifications on whose session is still live, the most recent first.
   */
  async #addresses(tx: Tx, channel: ChannelName, now: Date): Promise<string[]> {
    if (channel === 'push') {
      const rows = await tx
        .select({ token: pushTokens.token })
        .from(pushTokens)
        .innerJoin(sessions, eq(sessions.id, pushTokens.sessionId))
        .where(gt(sessions.expiresAt, now))
        .orderBy(desc(pushTokens.updatedAt));
      return rows.map((r) => r.token);
    }
    const [row] = await tx.select({ phone: students.phone }).from(students);
    return row?.phone ? [row.phone] : [];
  }

  /**
   * Expo says a token no longer reaches a phone (`DeviceNotRegistered`): forget it, whoever it
   * belonged to. As the owner, by the token only; the audit row carries the learner's id.
   */
  async forgetPushToken(token: string): Promise<boolean> {
    if (!EXPO_PUSH_TOKEN.test(token)) return false;
    return this.#db.transaction(async (tx) => {
      const removed = await tx
        .delete(pushTokens)
        .where(eq(pushTokens.token, token))
        .returning({ studentId: pushTokens.studentId });
      for (const row of removed) {
        await tx.insert(auditLog).values({
          actorType: 'system',
          studentId: row.studentId,
          action: 'push.token-gone',
        });
      }
      return removed.length > 0;
    });
  }

  async recordSent(id: string, receiptIds: ReadonlyArray<string>, at: Date): Promise<void> {
    await this.#db.transaction(async (tx) => {
      const [row] = await tx
        .update(reminders)
        .set({
          status: 'sent',
          receiptId: receiptIds[0] ?? null,
          // Every phone's ticket (A11-07); one send has at most five (A5-04).
          receiptIds: [...receiptIds],
          deliveryStatus: 'accepted',
          updatedAt: at,
        })
        .where(and(eq(reminders.id, id), eq(reminders.status, 'sending')))
        .returning({ studentId: reminders.studentId, channel: reminders.channel });
      if (row) {
        await tx.insert(auditLog).values({
          actorType: 'system',
          studentId: row.studentId,
          action: 'message.sent',
          reason: row.channel,
        });
      }
    });
  }

  async recordReceiptJob(id: string, jobId: string, at: Date): Promise<void> {
    await this.#db
      .update(reminders)
      .set({ jobId, updatedAt: at })
      .where(and(eq(reminders.id, id), eq(reminders.status, 'sent')));
  }

  async release(id: string, at: Date): Promise<void> {
    await this.#db
      .update(reminders)
      .set({ status: 'scheduled', sentAt: null, updatedAt: at })
      .where(and(eq(reminders.id, id), eq(reminders.status, 'sending')));
  }

  async recordFailed(id: string, at: Date, reason: ReminderFailReason): Promise<void> {
    await this.#db
      .update(reminders)
      .set({ status: 'failed', sentAt: null, outcomeReason: reason, updatedAt: at })
      .where(and(eq(reminders.id, id), inArray(reminders.status, ['scheduled', 'sending'])));
  }

  async recordUnconfirmed(id: string, at: Date): Promise<void> {
    // sent_at stays: the message may have reached the phone, so it still counts (A12-06).
    await this.#db
      .update(reminders)
      .set({ status: 'unconfirmed', outcomeReason: 'unknown-outcome', updatedAt: at })
      .where(and(eq(reminders.id, id), eq(reminders.status, 'sending')));
  }

  async sweepStale(id: string, claimedBefore: Date, at: Date): Promise<boolean> {
    if (!isEntityId(id)) return false;
    // One statement, so a runner recording its send at this moment either wins or finds the
    // reminder already closed; never both (A12-14).
    const rows = await this.#db
      .update(reminders)
      .set({ status: 'failed', sentAt: null, outcomeReason: 'unknown-outcome', updatedAt: at })
      .where(
        and(
          eq(reminders.id, id),
          eq(reminders.status, 'sending'),
          lte(reminders.sentAt, claimedBefore),
        ),
      )
      .returning({ id: reminders.id });
    return rows.length > 0;
  }

  async drop(id: string, reason: ReminderDropReason, at: Date): Promise<void> {
    // As the owner: a reminder for a learner whose consent was withdrawn must still be closed,
    // and this writes only its status and a reason word.
    await this.#db
      .update(reminders)
      .set({ status: 'dropped', sentAt: null, outcomeReason: reason, updatedAt: at })
      .where(and(eq(reminders.id, id), inArray(reminders.status, ['scheduled', 'sending'])));
  }

  async setJob(id: string, jobId: string, at: Date, rescheduled: boolean): Promise<void> {
    await this.#db
      .update(reminders)
      .set({
        jobId,
        updatedAt: at,
        ...(rescheduled ? { reschedules: sql`${reminders.reschedules} + 1` } : {}),
      })
      .where(and(eq(reminders.id, id), eq(reminders.status, 'scheduled')));
  }

  /**
   * A provider's delivery report for a message we sent. False when no reminder has it. On
   * WhatsApp, the category Meta billed it as is kept when the report gives one (A12-09); a report
   * without one keeps what was recorded.
   */
  async recordDelivery(
    channel: ChannelName,
    receiptId: string,
    status: DeliveryStatus,
    category?: WhatsAppCategory,
  ): Promise<boolean> {
    const billed = channel === 'whatsapp' && isWhatsAppCategory(category) ? category : undefined;
    const rows = await this.#db
      .update(reminders)
      .set({
        deliveryStatus: status,
        ...(billed ? { billedCategory: billed } : {}),
        updatedAt: this.#clock(),
      })
      .where(
        and(
          eq(reminders.receiptId, receiptId),
          eq(reminders.channel, channel),
          eq(reminders.status, 'sent'),
        ),
      )
      .returning({ id: reminders.id });
    return rows.length > 0;
  }

  // ── The learner's exams (the PaperSlotSource reads these) ──────────────────────────────────

  /**
   * What decides which papers a learner sits: their grade, the subjects on their latest
   * confirmed report (hard rule 6: never a value they haven't confirmed), and their own changes.
   * Read as the learner: null when their data may not be processed (hard rule 5).
   */
  async examInputs(studentId: string): Promise<ExamInputs | null> {
    if (!isEntityId(studentId)) return null;
    return this.#db.transaction(async (tx) => {
      await scopeToLearner(tx, studentId, this.#clock());
      await tx.execute(sql`set local role uf_app`);
      const [gate] = rowsOf<{ ok: boolean }>(
        await tx.execute(sql`select uf_may_process(${studentId}::uuid) as ok`),
      );
      if (gate?.ok !== true) return null;
      const [profile] = rowsOf<{ grade: number | null; given_on: string | null }>(
        await tx.execute(sql`select grade, grade_given_on::text as given_on from profiles`),
      );
      // The grade they are in now, not the one typed at sign-up (G10-1).
      const grade = profile
        ? currentGrade({ grade: profile.grade, givenOn: profile.given_on }, this.#clock())
        : null;
      const [report] = rowsOf<{ id: string; kind: string }>(
        await tx.execute(sql`select id, kind from reports order by ${LATEST_REPORT_FIRST} limit 1`),
      );
      const subjects = report
        ? rowsOf<{ subject: string }>(
            await tx.execute(
              sql`select subject from report_marks where report_id = ${report.id}::uuid`,
            ),
          ).map((r) => r.subject)
        : [];
      const choices = await tx
        .select({ subject: examSubjectChoices.subject, included: examSubjectChoices.included })
        .from(examSubjectChoices);
      return {
        grade: examGrade(grade, report?.kind ?? null),
        confirmedSubjects: subjects,
        choices: choices.flatMap((c) =>
          isSubjectId(c.subject) ? [{ subjectId: c.subject, included: c.included }] : [],
        ),
      };
    });
  }

  // ── The channels' last-moment check (RecipientGate) ────────────────────────────────────────

  /**
   * True only when the address belongs to a learner whose data may be processed and who is
   * opted in to that channel right now. For push, the address is a token on a live session.
   */
  async mayMessage(channel: ChannelName, address: string): Promise<boolean> {
    if (channel === 'push') {
      if (!EXPO_PUSH_TOKEN.test(address)) return false;
      const rows = await this.#db
        .select({ id: students.id })
        .from(pushTokens)
        .innerJoin(students, eq(students.id, pushTokens.studentId))
        .innerJoin(sessions, eq(sessions.id, pushTokens.sessionId))
        .innerJoin(messagingChannels, eq(messagingChannels.studentId, students.id))
        .where(
          and(
            eq(pushTokens.token, address),
            gt(sessions.expiresAt, this.#clock()),
            this.#consentCovers(),
            eq(messagingChannels.channel, 'push'),
            eq(messagingChannels.optedIn, true),
          ),
        );
      return rows.length === 1;
    }
    const rows = await this.#db
      .select({ id: students.id, optedInAt: messagingChannels.optedInAt })
      .from(students)
      .innerJoin(messagingChannels, eq(messagingChannels.studentId, students.id))
      .where(
        and(
          eq(students.phone, address),
          this.#consentCovers(),
          eq(messagingChannels.channel, channel),
          eq(messagingChannels.optedIn, true),
        ),
      );
    const [row] = rows;
    if (rows.length !== 1 || !row) return false;
    // A STOP from this number after the learner's opt-in wins (A12-04); the learner's own opt-in
    // in the app after a STOP is a fresh choice, and wins in turn.
    const stoppedAt = await this.#stoppedAt(channel, address);
    return (
      stoppedAt === null ||
      (row.optedInAt !== null && new Date(row.optedInAt).getTime() > stoppedAt.getTime())
    );
  }

  // ── The crisis reply's campus lines (Phase 5b) ─────────────────────────────────────────────

  /**
   * The university of the accepted offer of the learner who has this number (E.164), for the
   * SMS and WhatsApp crisis reply's campus lines (planning.md §4.3). Only an id: what the reply
   * shows is the catalogue's verified safety places. Null for a number with no account, or more
   * than one, or no accepted offer, and whenever the learner's data may not be processed: the
   * offer is read as the learner, under row-level security and the consent gate (hard rule 5).
   */
  async acceptedOfferUniversity(phone: string): Promise<string | null> {
    return this.#db.transaction(async (tx) => {
      const found = await tx
        .select({ id: students.id })
        .from(students)
        .where(eq(students.phone, phone))
        .limit(2);
      const [student] = found;
      if (found.length !== 1 || !student) return null;
      await scopeToLearner(tx, student.id, this.#clock());
      await tx.execute(sql`set local role uf_app`);
      const [gate] = rowsOf<{ ok: boolean }>(
        await tx.execute(sql`select uf_may_process(${student.id}::uuid) as ok`),
      );
      if (gate?.ok !== true) return null;
      const [offer] = rowsOf<{ university_id: string }>(
        await tx.execute(sql`select university_id from offers where status = 'accepted' limit 1`),
      );
      return offer?.university_id ?? null;
    });
  }

  // ── Inbound (the webhooks) ─────────────────────────────────────────────────────────────────

  /**
   * Someone wrote to us on a channel. STOP puts the number on the suppression list for that
   * channel, account or not (A12-04: a guardian's STOP must hold too), and opts a learner out of
   * that channel at once, whatever else is true (an objection is always honoured, even before
   * consent). Any other message opens the channel's 24-hour window, recorded only when their data
   * may be processed.
   */
  async receiveInbound(input: {
    readonly channel: ChannelName;
    readonly from: string;
    readonly stop: boolean;
    readonly at: Date;
  }): Promise<InboundResult> {
    const { channel, from, stop, at } = input;
    return this.#db.transaction(async (tx) => {
      if (stop && isNumberChannel(channel)) {
        await tx
          .insert(messagingSuppressions)
          .values({ channel, numberHash: this.#numberHash(from), stoppedAt: at })
          .onConflictDoUpdate({
            target: [messagingSuppressions.channel, messagingSuppressions.numberHash],
            set: { stoppedAt: at },
          });
      }
      const [student] = await tx
        .select({ id: students.id, covered: this.#consentCovers(at).mapWith(Boolean) })
        .from(students)
        .where(eq(students.phone, from));
      if (!student) return 'unknown';
      if (stop) {
        const change = {
          optedIn: false,
          optedOutAt: at,
          optOutSource: 'stop' as const,
          lastInboundAt: at,
          updatedAt: at,
        };
        await tx
          .insert(messagingChannels)
          .values({ studentId: student.id, channel, ...change })
          .onConflictDoUpdate({
            target: [messagingChannels.studentId, messagingChannels.channel],
            set: change,
          });
        await tx.insert(auditLog).values({
          actorType: 'student',
          actorId: student.id,
          studentId: student.id,
          action: 'messaging.stopped',
          reason: channel,
        });
        return 'stopped';
      }
      if (student.covered === true) {
        await tx
          .update(messagingChannels)
          .set({ lastInboundAt: at, updatedAt: at })
          .where(
            and(
              eq(messagingChannels.studentId, student.id),
              eq(messagingChannels.channel, channel),
            ),
          );
      }
      return 'recorded';
    });
  }
}
