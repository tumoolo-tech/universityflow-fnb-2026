import { HttpError, handler, json, parseBody, requireReady } from '@/lib/server/http';
import { markSheetBody, moduleCardData, saveCardMarks } from '@/lib/server/module-card';
import { getServices } from '@/lib/server/services';

/**
 * One confirmed module's card (Phase 6c), for the app: How marks work (resolved by
 * packages/admissions), Dates, Books and Who teaches it, and the learner's own marks. The app's
 * calculator runs on the phone from the resolved scheme in it, offline. Only a module on the
 * learner's own confirmed registration has one; anything else is "not found". Same guards as every
 * learner route: signed in, same origin for cookie writes (CSRF), and refused while their data may
 * not be processed (hard rule 5, again in the database).
 */

type Params = { params: Promise<{ registrationId: string; code: string }> };

async function target(params: Params['params']) {
  const { registrationId, code } = await params;
  let decoded: string;
  try {
    decoded = decodeURIComponent(code);
  } catch {
    throw new HttpError(404, 'not-found');
  }
  return { registrationId, code: decoded };
}

export const GET = handler(async (request: Request, { params }: Params) => {
  const { student } = await requireReady(request);
  const { catalogue, config } = await getServices();
  return json(
    await moduleCardData(student, catalogue(), await target(params), { demo: config.demo }),
  );
});

const HOUR_MS = 60 * 60 * 1000;
/** Saves a learner may make in an hour: room for a whole semester's marks, not for a script. */
const SAVES_PER_HOUR = 120;

/**
 * The learner saves the marks they typed and their target (hard rule 6: typed by them). A mark
 * outside 0–100 or for a part the module doesn't have is refused, never repaired. IDs only in the
 * audit trail (hard rule 4).
 */
export const PUT = handler(async (request: Request, { params }: Params) => {
  const { student, studentId } = await requireReady(request);
  const body = await parseBody(request, markSheetBody);
  const { store, catalogue, config } = await getServices();
  if (!(await store.allow('module-marks', studentId, SAVES_PER_HOUR, HOUR_MS))) {
    throw new HttpError(429, 'rate-limited');
  }
  return json(
    await saveCardMarks(student, catalogue(), await target(params), body, { demo: config.demo }),
  );
});
