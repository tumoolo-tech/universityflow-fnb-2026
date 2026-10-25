import 'server-only';
import { type AgentRegistration, type MyModulesArtifact, myModules } from '@universityflow/agent';
import { type CatalogueView, programmeById, sastDateOf } from '@universityflow/catalogue';
import type { MessagingChannel, RegistrationRecord, StudentStore } from '@universityflow/db';
import type { ConfirmedRegistration } from '@universityflow/documents';
import type { JobScheduler } from '@universityflow/jobs';
import { type GoalOption, goalOptions } from './goals';
import { HttpError } from './http';
import { daysBeforeAt, reminderChannel, scheduleLearnerReminder } from './reminders';

/**
 * My modules for the web pages and the app's API (planning.md §11, Phase 5c), built by the same
 * code as the agent's `compare_registration` tool (packages/agent/src/modules.ts), so the chat and
 * the screens agree.
 *
 * The change-deadline reminder goes through the 4a pipeline, which decides at send time whether it
 * may go (consent, opt-in, cadence, quiet hours, papers). It is scheduled only while the check
 * finds something to fix and a published last day to change is still to come, and it says nothing
 * personal (content's `registration.change-deadline`). Confirming the registration again drops it:
 * a new one is scheduled only if there is still something to fix.
 */

export interface RegistrationResponse {
  /** The learner's latest confirmed registration, checked; null before they confirm one. */
  readonly modules: MyModulesArtifact | null;
  /** The programme of the offer they accepted, to start the confirm form with; or null. */
  readonly acceptedProgrammeId: string | null;
  /** Every course the learner may choose, by university. */
  readonly options: ReadonlyArray<GoalOption>;
  /** Whether a change-deadline reminder can be sent: a channel the learner opted in to. */
  readonly remindersOn: boolean;
  /** The academic year a registration confirmed now is most likely for (the form's default). */
  readonly defaultYear: number;
}

/** How many days before the last day to change the reminder is due. */
export const CHANGE_DEADLINE_REMINDER_DAYS = 3;

/**
 * When the change-deadline reminder is due: 18:00 SAST, `CHANGE_DEADLINE_REMINDER_DAYS` days
 * before the last day, or now when that has passed. Null once the day itself has passed.
 */
export const changeDeadlineReminderAt = (lastDay: string, now: Date): Date | null =>
  daysBeforeAt(lastDay, CHANGE_DEADLINE_REMINDER_DAYS, now);

/**
 * The academic year a registration confirmed now is most likely for: South African universities
 * register in January and February, so from October on it is next year's.
 */
export function likelyAcademicYear(now: Date): number {
  const [year, month] = sastDateOf(now).split('-').map(Number) as [number, number];
  return month >= 10 ? year + 1 : year;
}

/** A stored registration as the agent's builder takes it. */
export const asAgentRegistration = (r: RegistrationRecord): AgentRegistration => ({
  id: r.id,
  universityId: r.universityId,
  programmeId: r.programmeId,
  academicYear: r.academicYear,
  yearOfStudy: r.yearOfStudy,
  modules: r.modules,
  confirmedAt: r.confirmedAt,
  reminder: r.reminder,
});

export async function registrationResponse(
  student: StudentStore,
  view: CatalogueView,
  offered: ReadonlyArray<MessagingChannel>,
  now = new Date(),
): Promise<RegistrationResponse> {
  const [record, offers, channel] = await Promise.all([
    student.registration(),
    student.offers(),
    reminderChannel(student, offered),
  ]);
  return registrationResponseFrom(view, { record, offers, channel }, now);
}

/** What `registrationResponse` builds, from records already read (A4-12): no store reads. */
export function registrationResponseFrom(
  view: CatalogueView,
  read: {
    readonly record: RegistrationRecord | null;
    readonly offers: Awaited<ReturnType<StudentStore['offers']>>;
    readonly channel: MessagingChannel | null;
  },
  now = new Date(),
): RegistrationResponse {
  const accepted = read.offers.find((o) => o.status === 'accepted');
  return {
    modules: read.record ? myModules(view, asAgentRegistration(read.record), now) : null,
    acceptedProgrammeId:
      accepted && programmeById(view, accepted.programmeId) ? accepted.programmeId : null,
    options: goalOptions(view),
    remindersOn: read.channel !== null,
    defaultYear: likelyAcademicYear(now),
  };
}

/**
 * Records a registration the learner confirmed row by row (hard rule 6), replacing that year's,
 * and takes the replaced one's reminder off the schedule. Then, only while the check finds
 * something to fix and a published last day is still to come, schedules the change-deadline
 * reminder on the learner's first opted-in channel. Only a programme the learner may see can be
 * registered for (hard rule 3); a proof it came from must be one of their own.
 *
 * It returns what it read, the learner's latest registration (with the reminder just scheduled)
 * and their reminder channel, so the response is built without reading either again (A4-12).
 */
export async function saveRegistration(
  student: StudentStore,
  registration: ConfirmedRegistration,
  deps: {
    readonly catalogue: CatalogueView;
    readonly jobs: JobScheduler;
    readonly offeredChannels: ReadonlyArray<MessagingChannel>;
    readonly now?: Date;
  },
): Promise<{
  readonly id: string;
  readonly reminderId: string | null;
  readonly record: RegistrationRecord | null;
  readonly channel: MessagingChannel | null;
}> {
  const programme = programmeById(deps.catalogue, registration.programmeId);
  if (!programme) throw new HttpError(404, 'not-found');
  if (registration.documentId) {
    const document = await student.document(registration.documentId);
    if (document.kind !== 'proof-of-registration') throw new HttpError(400, 'invalid');
  }
  const { id, jobIds } = await student.saveRegistration({
    universityId: programme.universityId,
    programmeId: programme.id,
    academicYear: registration.academicYear,
    yearOfStudy: registration.yearOfStudy,
    modules: registration.modules,
    documentId: registration.documentId ?? null,
  });
  for (const jobId of jobIds) await deps.jobs.cancel(jobId);

  const now = deps.now ?? new Date();
  // Both are needed by the response whatever happens here: read once, together.
  const [record, channel] = await Promise.all([
    student.registration(),
    reminderChannel(student, deps.offeredChannels),
  ]);
  const unchanged = { id, reminderId: null, record, channel };
  if (!record || record.id !== id) return unchanged;
  const artifact = myModules(deps.catalogue, asAgentRegistration(record), now);
  const next = artifact.deadlines.next;
  const at =
    artifact.differences.length > 0 && next ? changeDeadlineReminderAt(next.lastDay, now) : null;
  if (!at || !channel) return unchanged;
  const { id: reminderId } = await scheduleLearnerReminder(student, deps.jobs, {
    templateId: 'registration.change-deadline',
    channel,
    desiredAt: at,
    // The university is checked when it is due (dropped if no longer verified), never shown.
    params: { universityId: programme.universityId },
  });
  await student.setRegistrationReminder(id, reminderId);
  return {
    id,
    reminderId,
    record: { ...record, reminder: { id: reminderId, status: 'scheduled', desiredAt: at } },
    channel,
  };
}
