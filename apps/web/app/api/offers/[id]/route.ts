import { z } from 'zod';
import { scheduleSafetyReminders } from '@/lib/server/campus';
import { HttpError, handler, json, parseBody, requireReady } from '@/lib/server/http';
import { cancelJobs, offersResponse, scheduleRegistrationDayReminder } from '@/lib/server/offers';
import { getServices } from '@/lib/server/services';

const Change = z.object({ action: z.enum(['accept', 'decline']) }).strict();

const offerId = async (params: Promise<{ id: string }>) => {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) throw new HttpError(404, 'not-found');
  return id;
};

/**
 * The learner accepted or declined an offer. At most one accepted (409 `another-accepted`); the
 * reply-by reminder is dropped and its job taken off the schedule. Declining the accepted offer
 * drops its registration-day reminder too; newly accepting one schedules it (5d, A1-33).
 */
export const PATCH = handler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { student } = await requireReady(request);
    const id = await offerId(params);
    const { action } = await parseBody(request, Change);
    const { catalogue, jobs, offeredChannels } = await getServices();
    const change =
      action === 'accept' ? await student.acceptOffer(id) : await student.declineOffer(id);
    await cancelJobs(jobs, change);
    // Safety and scam guidance by push, now and in mid-January (Phase 5b, §8.6).
    if (action === 'accept') await scheduleSafetyReminders(student, jobs, offeredChannels);
    // Before registration day, only when this accept made it the accepted offer: never twice.
    if (change.newlyAccepted) {
      await scheduleRegistrationDayReminder(student, id, {
        catalogue: catalogue(),
        jobs,
        offeredChannels,
      });
    }
    return json(await offersResponse(student, catalogue(), offeredChannels));
  },
);

/** Deletes an offer; its waiting reminders go with it. */
export const DELETE = handler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { student } = await requireReady(request);
    const id = await offerId(params);
    const { catalogue, jobs, offeredChannels } = await getServices();
    await cancelJobs(jobs, await student.deleteOffer(id));
    return json(await offersResponse(student, catalogue(), offeredChannels));
  },
);
