import 'server-only';
import type { SubjectMark } from '@universityflow/admissions';
import {
  type AgentOffer,
  finalResultsFrom,
  type OfferCardArtifact,
  offerCard,
} from '@universityflow/agent';
import {
  type CatalogueView,
  programmeById,
  registrationCalendarFor,
} from '@universityflow/catalogue';
import type { MessagingChannel, OfferChange, StudentStore } from '@universityflow/db';
import type { ConfirmedOffer } from '@universityflow/documents';
import type { JobScheduler } from '@universityflow/jobs';
import { type GoalOption, goalOptions } from './goals';
import { HttpError } from './http';
import { daysBeforeAt, reminderChannel, scheduleLearnerReminder } from './reminders';

/**
 * Offers for the web pages and the app's API (planning.md §11, Phase 5a), built by the same code
 * as the agent's `offers` tool (packages/agent/src/offers.ts), so the chat and the screens agree.
 *
 * The reply-by reminder goes through the 4a pipeline, which decides at send time whether it may go
 * (consent, opt-in, cadence, quiet hours, papers). It says only that a place the learner added
 * needs an answer soon (content's `offer.reply-by`); it is dropped, and its job cancelled, once the
 * learner accepts, declines or deletes the offer.
 *
 * The registration-day reminder (5d, A1-33) goes the same way, on the same channel (owner's
 * decision, 2026-10-17): scheduled when the learner accepts an offer, before first-year
 * registration at that university, only from a calendar the learner may see for the offer's
 * academic year. It says only that it is nearly time to register (content's
 * `offer.registration-day`); it is dropped once the offer is declined or deleted.
 */

export interface OffersResponse {
  readonly offers: ReadonlyArray<OfferCardArtifact>;
  /** Every course the learner may choose for "I got an offer", by university. */
  readonly options: ReadonlyArray<GoalOption>;
  /** Whether a reply-by reminder can be sent: a channel the learner opted in to. */
  readonly remindersOn: boolean;
  /**
   * When the accepted offer's registration-day reminder is due (ISO), while one is waiting; null
   * otherwise (no accepted offer, no published date, no channel, or dropped). `offersResponse`
   * always sets it; optional only so pages built before it (and their fixtures) still type-check.
   */
  readonly registrationReminderAt?: string | null;
}

/** How many days before the date to reply by the reminder is due. */
export const REPLY_BY_REMINDER_DAYS = 3;

/**
 * When the reply-by reminder is due: 18:00 SAST, `REPLY_BY_REMINDER_DAYS` days before the date to
 * reply by, or now when that has passed. Null once the date itself has passed: there is nothing
 * left to remind about.
 */
export const replyByReminderAt = (replyBy: string, now: Date): Date | null =>
  daysBeforeAt(replyBy, REPLY_BY_REMINDER_DAYS, now);

/** How many days before first-year registration the registration-day reminder is due. */
export const REGISTRATION_DAY_REMINDER_DAYS = 3;

/**
 * When the registration-day reminder for an accepted offer is due: 18:00 SAST,
 * `REGISTRATION_DAY_REMINDER_DAYS` days before first-year registration opens at the offer's
 * university (or before it closes, when the calendar publishes only the close, #69), or now when
 * that has passed. Null once that day has passed, and null without a date: no course the learner
 * may see, or no calendar the learner may see for the course's academic year (hard rule 3; never
 * another year's, A13-02). Nothing is guessed.
 */
export function registrationDayReminderAt(
  view: CatalogueView,
  offer: { readonly universityId: string; readonly programmeId: string },
  now: Date,
): Date | null {
  const programme = programmeById(view, offer.programmeId);
  if (!programme || programme.universityId !== offer.universityId) return null;
  const calendar = registrationCalendarFor(view, programme.universityId, programme.academicYear);
  if (!calendar) return null;
  const window = calendar.firstYearRegistration;
  return daysBeforeAt(window.from ?? window.to, REGISTRATION_DAY_REMINDER_DAYS, now);
}

/** The learner's offer records as the agent's offer builder takes them. */
export const asAgentOffers = (records: Awaited<ReturnType<StudentStore['offers']>>): AgentOffer[] =>
  records.map((o) => ({
    id: o.id,
    universityId: o.universityId,
    programmeId: o.programmeId,
    kind: o.kind,
    status: o.status,
    source: o.source,
    replyBy: o.replyBy,
    conditions: o.conditions,
    reminder: o.reminder,
  }));

/** The learner's offers as cards, with the January re-check once final results are confirmed. */
export async function offersResponse(
  student: StudentStore,
  view: CatalogueView,
  offered: ReadonlyArray<MessagingChannel>,
  now = new Date(),
): Promise<OffersResponse> {
  const [records, report, channel] = await Promise.all([
    student.offers(),
    student.latestReport(),
    reminderChannel(student, offered),
  ]);
  const finalResults = finalResultsFrom(
    report
      ? {
          kind: report.kind,
          confirmedAt: report.confirmedAt,
          // Stored marks were validated as NSC subjects when the learner confirmed them.
          marks: report.marks as ReadonlyArray<SubjectMark>,
        }
      : null,
  );
  const waiting = records.find((o) => o.status === 'accepted')?.registrationReminder;
  return {
    offers: asAgentOffers(records).map((o) => offerCard(view, o, finalResults, now)),
    options: goalOptions(view),
    remindersOn: channel !== null,
    registrationReminderAt:
      waiting?.status === 'scheduled' ? waiting.desiredAt.toISOString() : null,
  };
}

/**
 * Records an offer the learner confirmed (hard rule 6), and its reply-by reminder when there is a
 * date and a channel. Only a programme the learner may see can be an offer (hard rule 3); a letter
 * it came from must be one of their own acceptance letters.
 */
export async function addOffer(
  student: StudentStore,
  offer: ConfirmedOffer,
  deps: {
    readonly catalogue: CatalogueView;
    readonly jobs: JobScheduler;
    readonly offeredChannels: ReadonlyArray<MessagingChannel>;
    readonly now?: Date;
  },
): Promise<{ readonly id: string; readonly reminderId: string | null }> {
  const programme = programmeById(deps.catalogue, offer.programmeId);
  if (!programme) throw new HttpError(404, 'not-found');
  if (offer.documentId) {
    const document = await student.document(offer.documentId);
    if (document.kind !== 'acceptance-letter') throw new HttpError(400, 'invalid');
  }
  const id = await student.addOffer({
    universityId: programme.universityId,
    programmeId: programme.id,
    kind: offer.kind,
    replyBy: offer.replyBy,
    conditions: offer.conditions,
    documentId: offer.documentId ?? null,
  });
  const at = offer.replyBy ? replyByReminderAt(offer.replyBy, deps.now ?? new Date()) : null;
  const channel = at ? await reminderChannel(student, deps.offeredChannels) : null;
  if (!at || !channel) return { id, reminderId: null };
  const { id: reminderId } = await scheduleLearnerReminder(student, deps.jobs, {
    templateId: 'offer.reply-by',
    channel,
    desiredAt: at,
    // The university is checked when it is due (dropped if no longer verified), never shown.
    params: { universityId: programme.universityId },
  });
  await student.setOfferReminder(id, reminderId);
  return { id, reminderId };
}

/**
 * Schedules the registration-day reminder for an offer the learner just accepted, when the
 * catalogue they may see publishes a date for it (`registrationDayReminderAt`) and they opted in
 * to a channel: the first in `CHANNEL_PREFERENCE`, as the reply-by reminder. If the offer was
 * declined or deleted in the meantime, the store drops the reminder at once and its job is taken
 * off the schedule. Consent, cadence, quiet hours and papers are the pipeline's, at send time.
 */
export async function scheduleRegistrationDayReminder(
  student: StudentStore,
  offerId: string,
  deps: {
    readonly catalogue: CatalogueView;
    readonly jobs: JobScheduler;
    readonly offeredChannels: ReadonlyArray<MessagingChannel>;
    readonly now?: Date;
  },
): Promise<string | null> {
  const offer = (await student.offers()).find((o) => o.id === offerId);
  if (offer?.status !== 'accepted') return null;
  const at = registrationDayReminderAt(deps.catalogue, offer, deps.now ?? new Date());
  const channel = at ? await reminderChannel(student, deps.offeredChannels) : null;
  if (!at || !channel) return null;
  const { id: reminderId } = await scheduleLearnerReminder(student, deps.jobs, {
    templateId: 'offer.registration-day',
    channel,
    desiredAt: at,
    // The university is checked when it is due (dropped if no longer verified), never shown.
    params: { universityId: offer.universityId },
  });
  const { jobIds, kept } = await student.setOfferRegistrationReminder(offerId, reminderId);
  for (const jobId of jobIds) await deps.jobs.cancel(jobId);
  return kept ? reminderId : null;
}

/** Takes a closed offer's reminder jobs off the schedule. One that runs anyway sends nothing. */
export async function cancelJobs(jobs: JobScheduler, change: OfferChange): Promise<void> {
  for (const jobId of change.jobIds) await jobs.cancel(jobId);
}
