import { HttpError, handler, json, requireReady } from '@/lib/server/http';
import { confirmedOutline, outlinesResponse } from '@/lib/server/module-outlines';
import { getServices } from '@/lib/server/services';

/**
 * The learner's module outlines (Phase 6b). Same guards as every learner route: signed in, same
 * origin for cookie writes (CSRF), and refused while their data may not be processed (hard rule
 * 5, again in the database). An outline read from an upload also needs consent wording that names
 * module outlines (D9): the database refuses it otherwise.
 */

export const GET = handler(async (request: Request) => {
  const { student } = await requireReady(request);
  return json(await outlinesResponse(student));
});

const HOUR_MS = 60 * 60 * 1000;
/** Outlines a learner may confirm in an hour: room for a whole semester's, not for a script. */
const OUTLINES_PER_HOUR = 30;

/**
 * The learner confirms an outline part by part (hard rule 6), from an upload they checked or typed
 * in. The upload's file is deleted once the outline is saved (D10).
 */
export const PUT = handler(async (request: Request) => {
  const { student, studentId } = await requireReady(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, 'invalid');
  }
  const outline = confirmedOutline(body);
  const { store, files } = await getServices();
  if (!(await store.allow('module-outline', studentId, OUTLINES_PER_HOUR, HOUR_MS))) {
    throw new HttpError(429, 'rate-limited');
  }
  const { id, fileKey } = await student.saveModuleOutline(outline);
  if (fileKey) await files.delete(fileKey);
  return json({ id, ...(await outlinesResponse(student)) });
});
