import { holdsPersonalNumber } from '@universityflow/cv';
import { PersonalNumberError } from '@universityflow/db';
import { z } from 'zod';
import { ownCv } from '@/lib/server/cv';
import { AdvertBody, careForLeaving, cvOn } from '@/lib/server/cv-routes';
import { HttpError, handler, json, parseBody, QUOTAS, requireReady } from '@/lib/server/http';

/**
 * An ATS scan (docs/design/mmereko-api-proposal.md §2 `/ats-scans`): how well one of the learner's
 * finished CVs covers a pasted advert's keywords, by Mmereko's deterministic scorer (no model).
 * Mmereko answers at once, so this is the one engine call made in the learner's request (10 s
 * timeout). Nothing is kept: not the advert, not the score. A daily limit (§5.2).
 *
 * The advert is the learner's to type or paste: crisis words in it keep it here, unsent, with the
 * crisis card (`ats: null`), until the learner's second press (`sendAnyway`; A10-55).
 */

const Body = z
  .object({ documentId: z.string().uuid(), advert: AdvertBody, sendAnyway: z.boolean().optional() })
  .strict();

export const POST = handler(async (request: Request) => {
  const services = await cvOn();
  const { student, studentId } = await requireReady(request);
  const { documentId, advert, sendAnyway } = await parseBody(request, Body);
  const doc = await ownCv(student, documentId);
  if (doc.status !== 'ready' || !doc.markdown) throw new HttpError(409, 'state', 'cv-not-ready');
  const care = sendAnyway
    ? null
    : await careForLeaving(student, services, [[advert.title, advert.company, advert.text]]);
  if (care?.level === 'crisis') return json({ ats: null, care });
  // An ID or student number pasted into the advert never leaves (A11-41), as a fitted CV's
  // advert is refused (packages/db `checkAdvert`): the learner is told what to take out.
  if ([advert.title, advert.company, advert.text].some((t) => t && holdsPersonalNumber(t))) {
    throw new PersonalNumberError();
  }
  const { max, windowMs } = QUOTAS.cvAts;
  if (!(await services.store.allow('cv-ats', studentId, max, windowMs))) {
    throw new HttpError(429, 'rate-limited');
  }
  const consent = await student.cvConsent('cv.ats', services.cvAccess);
  const ats = await services.cv.atsScan({
    learnerRef: consent.learnerRef,
    consent: {
      ref: consent.ref,
      version: consent.version,
      purposes: consent.purposes,
      ageBand: consent.ageBand,
    },
    cvText: doc.markdown,
    job: { title: advert.title, company: advert.company, description: advert.text },
  });
  return json({ ats, care });
});
