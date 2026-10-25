import { z } from 'zod';
import { HttpError, handler, json, requireReady } from '@/lib/server/http';
import { registrationResponse } from '@/lib/server/registration';
import { getServices } from '@/lib/server/services';

/** Removes a confirmed registration; its waiting change-deadline reminder goes with it. */
export const DELETE = handler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { student } = await requireReady(request);
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) throw new HttpError(404, 'not-found');
    const { catalogue, jobs, offeredChannels } = await getServices();
    const { jobIds } = await student.deleteRegistration(id);
    for (const jobId of jobIds) await jobs.cancel(jobId);
    return json(await registrationResponse(student, catalogue(), offeredChannels));
  },
);
