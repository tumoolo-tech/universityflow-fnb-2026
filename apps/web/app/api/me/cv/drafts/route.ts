import { scheduleCvDocument } from '@/lib/server/cv';
import {
  careForLeaving,
  cvOn,
  optionalBody,
  profileWordGroups,
  SendBody,
  selectionView,
} from '@/lib/server/cv-routes';
import { HttpError, handler, json, QUOTAS, requireReady } from '@/lib/server/http';

/**
 * "Make my CV" (docs/design/mmereko-api-proposal.md §5.3): a base CV, no job advert and no model
 * (D7). The route writes the row (`queued`) and schedules `cv.submit` with its id; nothing reaches
 * the engine in the learner's request. One at a time; a name and some education first (§11); our
 * own daily limit in front of Mmereko's (§5.2). 202 with the CV's row.
 *
 * What would leave is read by the crisis check first (A10-56): on crisis words nothing is written
 * or sent, and the answer is the crisis card (200, `document: null`); the learner's second press
 * (`sendAnyway`) sends it, since the words may belong on a CV. A concern goes ahead with the card.
 */

export const POST = handler(async (request: Request) => {
  const services = await cvOn();
  const { student, studentId } = await requireReady(request);
  const { sendAnyway } = await optionalBody(request, SendBody);
  const view = await selectionView(student, services);
  if (!view.ready) throw new HttpError(409, 'state', 'cv-incomplete');
  const care = sendAnyway
    ? null
    : await careForLeaving(student, services, profileWordGroups(view.profile));
  if (care?.level === 'crisis') return json({ document: null, care });
  const { max, windowMs } = QUOTAS.cvDraft;
  if (!(await services.store.allow('cv-draft', studentId, max, windowMs))) {
    throw new HttpError(429, 'rate-limited');
  }
  const document = await student.requestCvDocument({ kind: 'draft' }, services.cvAccess);
  await scheduleCvDocument(services.cvScheduler, document.id);
  return json({ document, care }, { status: 202 });
});
