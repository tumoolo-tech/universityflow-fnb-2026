import { MAX_CV_WEBHOOK_BYTES } from '@universityflow/cv';
import { readCappedText } from '@/lib/server/capped-body';
import { receiveCvWebhook } from '@/lib/server/cv';
import { cvOn } from '@/lib/server/cv-routes';
import { HttpError, handler, json } from '@/lib/server/http';

/**
 * Mmereko's signed webhooks (docs/design/mmereko-api-proposal.md §4.1, §5.3): `cv.ready`,
 * `tailor.ready`, `job.failed`, `learner.deleted`, ids only. Signed for the channel `mmereko` with
 * packages/messaging's scheme (either live secret during a rotation); a forged, unsigned, altered,
 * stale or other-channel request is refused before anything is read, and one already seen inside
 * its window is refused as a replay (A5-06). A job's news schedules `cv.collect`; an unknown job
 * is answered 200 and ignored. Nothing is logged but ids.
 */

export const POST = handler(async (request: Request) => {
  const services = await cvOn();
  // Read up to the cap and no further, with or without a content-length (A5-19).
  const body = await readCappedText(request, MAX_CV_WEBHOOK_BYTES);
  if (body === null) throw new HttpError(400, 'invalid');
  const answer = await receiveCvWebhook(
    { store: services.store, engine: services.cv, scheduler: services.jobs },
    { headers: request.headers, body },
  );
  if (!answer.ok) {
    throw new HttpError(answer.status, answer.status === 401 ? 'forbidden' : 'invalid');
  }
  return json({ ok: true });
});
