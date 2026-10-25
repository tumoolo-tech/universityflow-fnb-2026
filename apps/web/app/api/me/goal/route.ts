import { programmeById } from '@universityflow/catalogue';
import { z } from 'zod';
import { goalResponse } from '@/lib/server/goals';
import { HttpError, handler, json, parseBody, requireReady } from '@/lib/server/http';
import { getServices } from '@/lib/server/services';

/**
 * The learner's goal: one target programme from the catalogue (planning.md §3, Stage 3), with
 * where they stand for it now. Same guards as /api/me: signed in, same origin for cookie writes
 * (CSRF), and refused while their data may not be processed (hard rule 5, again in the database).
 */

export const GET = handler(async (request: Request) => {
  const { student } = await requireReady(request);
  const { catalogue } = await getServices();
  return json(await goalResponse(student, catalogue()));
});

const Change = z.object({ programmeId: z.string().min(3).max(80) }).strict();

export const PUT = handler(async (request: Request) => {
  const { student } = await requireReady(request);
  const { programmeId } = await parseBody(request, Change);
  const { catalogue } = await getServices();
  const view = catalogue();
  // Only a course the learner may see (verified, or labelled preview data) can be a goal.
  if (!programmeById(view, programmeId)) throw new HttpError(404, 'not-found');
  await student.setGoal(programmeId);
  // A goal is on the shortlist, so its application pack exists.
  await student.addToShortlist(programmeId);
  return json(await goalResponse(student, view));
});

export const DELETE = handler(async (request: Request) => {
  const { student } = await requireReady(request);
  await student.clearGoal();
  const { catalogue } = await getServices();
  return json(await goalResponse(student, catalogue()));
});
