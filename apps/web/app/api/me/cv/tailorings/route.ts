import { z } from 'zod';
import { scheduleCvDocument } from '@/lib/server/cv';
import {
  AdvertBody,
  careForLeaving,
  cvOn,
  profileWordGroups,
  selectionView,
} from '@/lib/server/cv-routes';
import { HttpError, handler, json, parseBody, QUOTAS, requireReady } from '@/lib/server/http';

/**
 * "Fit it to a job" (docs/design/mmereko-api-proposal.md §2, §5.3): a CV tailored to one pasted
 * job advert, written by Anthropic through Mmereko (D4). The advert's text is kept only until the
 * job ends (D13) and is never returned or logged; its title and company stay with the CV. As with
 * a base CV: the row and a `cv.submit` job, one at a time, a daily limit. 202 with the CV's row.
 *
 * The advert is typed or pasted by the learner, so it is read by the crisis check with everything
 * else that would leave (A10-55, A10-56): on crisis words nothing is stored or sent and the answer
 * is the crisis card (200, `document: null`) until the learner's second press (`sendAnyway`).
 */

const Body = z.object({ advert: AdvertBody, sendAnyway: z.boolean().optional() }).strict();

export const POST = handler(async (request: Request) => {
  const services = await cvOn();
  const { student, studentId } = await requireReady(request);
  const { advert, sendAnyway } = await parseBody(request, Body);
  const view = await selectionView(student, services);
  if (!view.ready) throw new HttpError(409, 'state', 'cv-incomplete');
  const care = sendAnyway
    ? null
    : await careForLeaving(student, services, [
        [advert.title, advert.company, advert.text],
        ...profileWordGroups(view.profile),
      ]);
  if (care?.level === 'crisis') return json({ document: null, care });
  const { max, windowMs } = QUOTAS.cvTailor;
  if (!(await services.store.allow('cv-tailor', studentId, max, windowMs))) {
    throw new HttpError(429, 'rate-limited');
  }
  const document = await student.requestCvDocument({ kind: 'tailored', advert }, services.cvAccess);
  await scheduleCvDocument(services.cvScheduler, document.id);
  return json({ document, care }, { status: 202 });
});
