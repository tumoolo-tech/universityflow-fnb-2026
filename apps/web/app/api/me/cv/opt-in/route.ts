import { cv as cvCopy } from '@universityflow/content';
import type { CvPurpose } from '@universityflow/cv';
import { z } from 'zod';
import { adultInOwnName, cvOn, sendCvDeletions } from '@/lib/server/cv-routes';
import { handler, json, parseBody, requireReady, requireSignedIn } from '@/lib/server/http';

/**
 * The learner's own CV opt-in (docs/design/mmereko-api-proposal.md §9.1 item 3), separate from
 * the account consent and revocable here. GET reads it; POST gives it (or adds recruiter sharing,
 * 18+ in their own name only, §9.3); DELETE is "Stop using Mmereko" (D15): every share link off,
 * Mmereko asked to delete what it holds, and the CV data here deleted. Offer the download first:
 * the page does, before calling DELETE. 404 while UF_CV is off.
 */

const BASE: ReadonlyArray<CvPurpose> = ['cv.draft', 'cv.tailor', 'cv.ats'];

export const GET = handler(async (request: Request) => {
  const services = await cvOn();
  const { student, account } = await requireReady(request);
  const state = await student.cvState(services.cvAccess);
  return json({
    optIn: state.link
      ? {
          optedInAt: state.link.optedInAt.toISOString(),
          version: state.link.consentVersion,
          purposes: state.link.purposes,
        }
      : null,
    wordingCovers: state.wordingCovers,
    mayShare: state.mayShare,
    canShare: adultInOwnName(account),
    version: cvCopy.optInVersion,
  });
});

const Give = z.object({ share: z.boolean().optional() }).strict();

export const POST = handler(async (request: Request) => {
  const services = await cvOn();
  const { student } = await requireReady(request);
  const { share } = await parseBody(request, Give);
  const link = await student.cvOptIn(
    {
      version: cvCopy.optInVersion,
      purposes: share ? [...BASE, 'cv.share'] : BASE,
    },
    services.cvAccess,
  );
  return json({
    optIn: {
      optedInAt: link.optedInAt.toISOString(),
      version: link.consentVersion,
      purposes: link.purposes,
    },
  });
});

/** For any signed-in learner, with or without consent: a learner can always take their data back. */
export const DELETE = handler(async (request: Request) => {
  const services = await cvOn();
  const { student } = await requireSignedIn(request);
  const { fileKeys } = await student.cvWithdraw();
  await Promise.all(fileKeys.map((key) => services.files.delete(key)));
  await sendCvDeletions(services);
  return json({ optIn: null, deleted: { cvs: fileKeys.length } });
});
