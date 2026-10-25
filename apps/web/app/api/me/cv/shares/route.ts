import { CV_SHARE_DAYS } from '@universityflow/db';
import { z } from 'zod';
import { cvOn } from '@/lib/server/cv-routes';
import { HttpError, handler, json, parseBody, QUOTAS, requireReady } from '@/lib/server/http';

/**
 * Recruiter links (docs/design/mmereko-api-proposal.md §9.3, D5): 18+ only, in the learner's own
 * name, under adult-v3, for a CV they checked line by line (refused in the database too). Served
 * by UniversityFlow at `/cv/s/<token>`, never by Mmereko. The token is shown once, here, and kept
 * only as a hash; a link lasts 7 to 90 days (30 by default) and can be switched off at any time.
 */

export const GET = handler(async (request: Request) => {
  await cvOn();
  const { student } = await requireReady(request);
  return json({ shares: await student.cvShares() });
});

const Create = z
  .object({
    documentId: z.string().uuid(),
    days: z.number().int().min(CV_SHARE_DAYS.min).max(CV_SHARE_DAYS.max).optional(),
  })
  .strict();

export const POST = handler(async (request: Request) => {
  const services = await cvOn();
  const { student, studentId } = await requireReady(request);
  const { documentId, days } = await parseBody(request, Create);
  // A daily limit per learner (CV-A5 A5-21): each link is a row, and plenty for real use.
  const { max, windowMs } = QUOTAS.cvShare;
  if (!(await services.store.allow('cv-share', studentId, max, windowMs))) {
    throw new HttpError(429, 'rate-limited');
  }
  const { share, token } = await student.createCvShare(
    documentId,
    days ?? CV_SHARE_DAYS.default,
    services.cvAccess,
  );
  return json({ share, url: `${services.config.publicUrl}/cv/s/${token}` }, { status: 201 });
});

const Revoke = z.object({ id: z.string().uuid() }).strict();

export const DELETE = handler(async (request: Request) => {
  await cvOn();
  const { student } = await requireReady(request);
  const { id } = await parseBody(request, Revoke);
  await student.revokeCvShare(id);
  return json({ ok: true });
});
