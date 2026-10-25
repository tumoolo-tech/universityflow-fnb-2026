import { UNIVERSITY_IDS } from '@universityflow/catalogue';
import { FIRST_WEEK_STEPS } from '@universityflow/content';
import { z } from 'zod';
import { chosenUniversity, firstWeekResponse } from '@/lib/server/campus';
import { handler, json, parseBody, requireReady } from '@/lib/server/http';
import { getServices } from '@/lib/server/services';

/**
 * The first-week checklist (Phase 5b): the accepted offer's university, or `?university=` to see
 * another's. Progress is kept per learner and university (migration 0019).
 */
export const GET = handler(async (request: Request) => {
  const { student } = await requireReady(request);
  const chosen = chosenUniversity(new URL(request.url).searchParams.get('university'));
  const { catalogue } = await getServices();
  return json(await firstWeekResponse(student, catalogue(), chosen));
});

const Tick = z
  .object({
    universityId: z.enum(UNIVERSITY_IDS),
    step: z.enum(FIRST_WEEK_STEPS),
    done: z.boolean(),
  })
  .strict();

/** Ticks or unticks one step; answers with that university's checklist. */
export const PUT = handler(async (request: Request) => {
  const { student } = await requireReady(request);
  const { universityId, step, done } = await parseBody(request, Tick);
  await student.setFirstWeekStep(universityId, step, done);
  const { catalogue } = await getServices();
  return json(await firstWeekResponse(student, catalogue(), universityId));
});
