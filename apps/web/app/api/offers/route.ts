import { confirmedOfferSchema } from '@universityflow/documents';
import { HttpError, handler, json, parseBody, requireReady } from '@/lib/server/http';
import { addOffer, offersResponse } from '@/lib/server/offers';
import { getServices } from '@/lib/server/services';

/**
 * The learner's offers (Phase 5a). Same guards as every learner route: signed in, same origin for
 * cookie writes (CSRF), and refused while their data may not be processed (hard rule 5, again in
 * the database).
 */

export const GET = handler(async (request: Request) => {
  const { student } = await requireReady(request);
  const { catalogue, offeredChannels } = await getServices();
  return json(await offersResponse(student, catalogue(), offeredChannels));
});

const HOUR_MS = 60 * 60 * 1000;
/** Offers a learner may add in an hour: room for many corrections, not for a script. */
const OFFERS_PER_HOUR = 20;

/**
 * "I got an offer": the learner confirms it, from a letter they checked field by field or in their
 * own words (hard rule 6). Only now is it saved, and its reply-by reminder scheduled.
 */
export const POST = handler(async (request: Request) => {
  const { student, studentId } = await requireReady(request);
  const offer = await parseBody(request, confirmedOfferSchema);
  const { store, catalogue, jobs, offeredChannels } = await getServices();
  if (!(await store.allow('offer', studentId, OFFERS_PER_HOUR, HOUR_MS))) {
    throw new HttpError(429, 'rate-limited');
  }
  const view = catalogue();
  const { id } = await addOffer(student, offer, { catalogue: view, jobs, offeredChannels });
  return json({ id, ...(await offersResponse(student, view, offeredChannels)) }, { status: 201 });
});
