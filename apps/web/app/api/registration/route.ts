import { confirmedRegistrationSchema } from '@universityflow/documents';
import { HttpError, handler, json, parseBody, requireReady } from '@/lib/server/http';
import {
  registrationResponse,
  registrationResponseFrom,
  saveRegistration,
} from '@/lib/server/registration';
import { getServices } from '@/lib/server/services';

/**
 * The learner's registration check, My modules (Phase 5c). Same guards as every learner route:
 * signed in, same origin for cookie writes (CSRF), and refused while their data may not be
 * processed (hard rule 5, again in the database).
 */

export const GET = handler(async (request: Request) => {
  const { student } = await requireReady(request);
  const { catalogue, offeredChannels } = await getServices();
  return json(await registrationResponse(student, catalogue(), offeredChannels));
});

const HOUR_MS = 60 * 60 * 1000;
/** Registrations a learner may confirm in an hour: room for many corrections, not for a script. */
const REGISTRATIONS_PER_HOUR = 20;

/**
 * The learner confirms their modules, from a proof they checked row by row or typed in (hard rule
 * 6). Only now is anything compared, and the change-deadline reminder scheduled.
 */
export const PUT = handler(async (request: Request) => {
  const { student, studentId } = await requireReady(request);
  const registration = await parseBody(request, confirmedRegistrationSchema);
  const { store, catalogue, jobs, offeredChannels } = await getServices();
  if (!(await store.allow('registration', studentId, REGISTRATIONS_PER_HOUR, HOUR_MS))) {
    throw new HttpError(429, 'rate-limited');
  }
  const view = catalogue();
  const { id, record, channel } = await saveRegistration(student, registration, {
    catalogue: view,
    jobs,
    offeredChannels,
  });
  // The registration and the channel were read while saving: only the offers are read here (A4-12).
  const offers = await student.offers();
  return json({ id, ...registrationResponseFrom(view, { record, offers, channel }) });
});
