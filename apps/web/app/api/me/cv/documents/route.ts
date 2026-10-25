import { cvOn } from '@/lib/server/cv-routes';
import { handler, json, requireReady } from '@/lib/server/http';

/**
 * The learner's CVs, newest first, with their state (`packages/content` `cv.status`), and the ids
 * of the ones they reported (A10-58), so a reported CV says so.
 */
export const GET = handler(async (request: Request) => {
  await cvOn();
  const { student } = await requireReady(request);
  const [documents, reported] = await Promise.all([
    student.cvDocuments(),
    student.reportedCvDocuments(),
  ]);
  return json({ documents, reported });
});
