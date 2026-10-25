import { cvOn } from '@/lib/server/cv-routes';
import { handler, json, requireReady } from '@/lib/server/http';

/**
 * "Every line is true" (docs/design/mmereko-api-proposal.md §10.6, §1 flag 7): the learner's own
 * check of a finished CV, the last check against anything a tailored CV claims that isn't so.
 * Needed before a CV can be shared.
 */

type Params = { params: Promise<{ id: string }> };

export const POST = handler(async (request: Request, { params }: Params) => {
  const services = await cvOn();
  const { student } = await requireReady(request);
  const { id } = await params;
  return json({ document: await student.confirmCvDocument(id, services.cvAccess) });
});
