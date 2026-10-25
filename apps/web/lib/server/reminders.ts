import 'server-only';
import {
  type CatalogueView,
  isSubjectId,
  sastDateOf,
  subject,
  UNIVERSITY_IDS,
  type UniversityId,
  universityById,
} from '@universityflow/catalogue';
import {
  type MessageTemplateId,
  messageTemplate,
  type TemplateVariables,
} from '@universityflow/content';
import type { MessagingChannel, StudentStore } from '@universityflow/db';
import type { JobScheduler } from '@universityflow/jobs';
import { scheduleReminderJob, type VariableResolver } from '@universityflow/messaging';

/**
 * Reminders in the app: filling a template's variables from the catalogue at send time, and
 * scheduling a new reminder's job. Also the one place for which channel a learner's reminder goes
 * on and when a dated one is due (A1-32): offers, registration, campus and re-checks share them.
 */

/**
 * The channel a learner's reminder goes on: the first in this order the learner has opted in to
 * (and the deployment offers).
 */
export const CHANNEL_PREFERENCE: ReadonlyArray<MessagingChannel> = ['push', 'whatsapp', 'sms'];

/** The first channel in `CHANNEL_PREFERENCE` that is offered and the learner opted in to; or null. */
export function firstOptedInChannel(
  prefs: Awaited<ReturnType<StudentStore['messagingPreferences']>>,
  offered: ReadonlyArray<MessagingChannel>,
): MessagingChannel | null {
  return (
    CHANNEL_PREFERENCE.find(
      (c) => offered.includes(c) && prefs.channels.some((p) => p.channel === c && p.optedIn),
    ) ?? null
  );
}

/** Reads the learner's messaging preferences and picks their reminder channel; or null. */
export async function reminderChannel(
  student: StudentStore,
  offered: ReadonlyArray<MessagingChannel>,
): Promise<MessagingChannel | null> {
  return firstOptedInChannel(await student.messagingPreferences(), offered);
}

/**
 * 18:00 in South Africa: after every NSC paper and its margin, before quiet hours (gotcha 31).
 * The pipeline still moves a reminder if it lands somewhere it may not go.
 */
const REMINDER_HOUR_UTC = 16;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 18:00 SAST on a calendar day (`YYYY-MM-DD`). */
export function eveningOf(day: string): Date {
  return new Date(Date.parse(`${day}T00:00:00Z`) + REMINDER_HOUR_UTC * 3600_000);
}

/**
 * When a reminder about a date is due: 18:00 SAST `days` days before `day`, or now when that has
 * passed. Null once the day itself has passed: there is nothing left to remind about.
 */
export function daysBeforeAt(day: string, days: number, now: Date): Date | null {
  if (day < sastDateOf(now)) return null;
  const at = new Date(eveningOf(day).getTime() - days * DAY_MS);
  return at > now ? at : now;
}

/**
 * The template's variables, from code (hard rule 2): a university's name from the catalogue
 * view (so a reminder about a record no longer verified is dropped, hard rule 3) and a subject's
 * name from the subject list. Null when a reference no longer resolves. The variables are
 * checked, never shown in a message, and the learner's name is never one (A11-02).
 */
export function catalogueResolver(catalogue: () => CatalogueView): VariableResolver {
  return (reminder) => {
    const template = messageTemplate(reminder.templateId);
    const variables: { -readonly [K in keyof TemplateVariables]: string } = {};
    if (template.variables.includes('universityName')) {
      const id = reminder.params['universityId'];
      const university =
        id && (UNIVERSITY_IDS as readonly string[]).includes(id)
          ? universityById(catalogue(), id as UniversityId)
          : undefined;
      if (!university) return null;
      variables.universityName = university.name;
    }
    if (template.variables.includes('subjectName')) {
      const id = reminder.params['subjectId'];
      if (!id || !isSubjectId(id)) return null;
      variables.subjectName = subject(id).name;
    }
    return variables;
  };
}

/** Records a reminder and puts its job on the schedule. */
export async function scheduleLearnerReminder(
  student: StudentStore,
  scheduler: JobScheduler,
  input: {
    readonly templateId: MessageTemplateId;
    readonly channel: MessagingChannel;
    readonly desiredAt: Date;
    readonly params?: Readonly<Record<string, string>>;
  },
): Promise<{ id: string; jobId: string }> {
  const id = await student.createReminder(input);
  const jobId = await scheduleReminderJob(scheduler, id, input.desiredAt, 0);
  await student.setReminderJob(id, jobId);
  return { id, jobId };
}

/**
 * Records a reminder in place of the learner's waiting one from the same template, takes the
 * replaced reminder's job off the schedule, and puts the new one's on (audit A1-12). A cancel
 * that comes too late is harmless: that job finds its reminder no longer waiting.
 */
export async function replaceLearnerReminder(
  student: StudentStore,
  scheduler: JobScheduler,
  input: {
    readonly templateId: MessageTemplateId;
    readonly channel: MessagingChannel;
    readonly desiredAt: Date;
  },
): Promise<{ id: string; jobId: string }> {
  const { id, replacedJobIds } = await student.replaceWaitingReminder(input);
  for (const replaced of replacedJobIds) await scheduler.cancel(replaced);
  const jobId = await scheduleReminderJob(scheduler, id, input.desiredAt, 0);
  await student.setReminderJob(id, jobId);
  return { id, jobId };
}
