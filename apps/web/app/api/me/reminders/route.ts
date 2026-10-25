import { SUBJECTS } from '@universityflow/catalogue';
import {
  MESSAGE_TEMPLATE_IDS,
  type MessageTemplateId,
  messageTemplate,
} from '@universityflow/content';
import { z } from 'zod';
import { HttpError, handler, json, parseBody, requireReady } from '@/lib/server/http';
import { scheduleLearnerReminder } from '@/lib/server/reminders';
import { getServices } from '@/lib/server/services';

/**
 * Reminders a learner sets themselves ("remind me to practise Maths on Thursday"). Only the
 * templates marked learner-schedulable; the time and the subject are all they choose. Whether
 * and when it actually goes is decided when it is due (consent, opt-in, cadence, quiet hours).
 */

/** Reminders a learner may set in a day: enough for real use, not a way to spam the queue. */
const REMINDERS_PER_DAY = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
/** How far ahead a reminder may be set. */
const REMINDER_MAX_AHEAD_MS = 60 * DAY_MS;

const schedulable = MESSAGE_TEMPLATE_IDS.filter((id) => messageTemplate(id).learnerSchedulable);
const subjectIds = SUBJECTS.map((s) => s.id) as [string, ...string[]];

const NewReminder = z
  .object({
    templateId: z.enum(schedulable as [MessageTemplateId, ...MessageTemplateId[]]),
    channel: z.enum(['sms', 'whatsapp', 'push']),
    at: z.iso.datetime({ offset: true }),
    subjectId: z.enum(subjectIds).optional(),
  })
  .strict();

export const GET = handler(async (request: Request) => {
  const { student } = await requireReady(request);
  return json({ reminders: await student.reminders() });
});

export const POST = handler(async (request: Request) => {
  const { student, studentId } = await requireReady(request);
  const input = await parseBody(request, NewReminder);
  const { store, jobs, offeredChannels } = await getServices();
  if (!offeredChannels.includes(input.channel)) throw new HttpError(409, 'state');
  // A push reminder needs a phone with notifications on.
  if (input.channel === 'push' && (await student.pushDeviceCount()) === 0) {
    throw new HttpError(409, 'state');
  }
  const at = new Date(input.at);
  const now = Date.now();
  if (at.getTime() < now - 5 * 60 * 1000 || at.getTime() > now + REMINDER_MAX_AHEAD_MS) {
    throw new HttpError(400, 'invalid');
  }
  const needsSubject = messageTemplate(input.templateId).variables.includes('subjectName');
  if (needsSubject !== (input.subjectId !== undefined)) throw new HttpError(400, 'invalid');
  if (!(await store.allow('reminder', studentId, REMINDERS_PER_DAY, DAY_MS))) {
    throw new HttpError(429, 'rate-limited');
  }
  const { id } = await scheduleLearnerReminder(student, jobs, {
    templateId: input.templateId,
    channel: input.channel,
    desiredAt: at,
    ...(input.subjectId ? { params: { subjectId: input.subjectId } } : {}),
  });
  return json({ id }, { status: 201 });
});
