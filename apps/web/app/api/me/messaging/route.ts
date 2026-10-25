import { MAX_WEEKLY_CAP, MIN_WEEKLY_CAP } from '@universityflow/messaging';
import { z } from 'zod';
import { HttpError, handler, json, parseBody, requireReady } from '@/lib/server/http';
import { getServices } from '@/lib/server/services';

/**
 * The learner's messaging choices (planning.md §7.1): which channels they opted in to, and when,
 * and how many messages a week at most. A learner whose data may not be processed (a minor
 * waiting for a guardian) is refused, here and again in the database (hard rule 5).
 */

type Student = Awaited<ReturnType<typeof requireReady>>['student'];

/**
 * The channels this learner may turn on. The store-review account (A7-01) is offered push only:
 * the database refuses SMS and WhatsApp for it too (migration 0010).
 */
async function offeredTo(student: Student) {
  const { offeredChannels } = await getServices();
  if (!(await student.isReviewAccount())) return offeredChannels;
  return offeredChannels.filter((channel) => channel === 'push');
}

async function view(student: Student) {
  const prefs = await student.messagingPreferences();
  return { ...prefs, offeredChannels: await offeredTo(student) };
}

export const GET = handler(async (request: Request) => {
  const { student } = await requireReady(request);
  return json(await view(student));
});

const Change = z.union([
  z.object({ channel: z.enum(['sms', 'whatsapp', 'push']), optedIn: z.boolean() }).strict(),
  z.object({ maxPerWeek: z.int().min(MIN_WEEKLY_CAP).max(MAX_WEEKLY_CAP) }).strict(),
]);

export const PUT = handler(async (request: Request) => {
  const { student } = await requireReady(request);
  const change = await parseBody(request, Change);
  if ('channel' in change) {
    // Opting out is always allowed; opting in only to a channel we can actually use.
    if (change.optedIn && !(await offeredTo(student)).includes(change.channel)) {
      throw new HttpError(409, 'state');
    }
    // Push is turned on from the app, which registers its phone first (/api/me/push-token):
    // without a phone there is nowhere to send it.
    if (change.optedIn && change.channel === 'push' && (await student.pushDeviceCount()) === 0) {
      throw new HttpError(409, 'state');
    }
    await student.setChannelOptIn(change.channel, change.optedIn);
  } else {
    await student.setMessagesPerWeek(change.maxPerWeek);
  }
  return json(await view(student));
});
