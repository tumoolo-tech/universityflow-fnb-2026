import { campusResponse, chosenUniversity } from '@/lib/server/campus';
import { handler, json, requireReady } from '@/lib/server/http';
import { getServices } from '@/lib/server/services';

/**
 * The campus tour (Phase 5b): the accepted offer's university, or `?university=` to look around
 * another. Same guards as every learner route (signed in, consent: hard rule 5).
 */
export const GET = handler(async (request: Request) => {
  const { student } = await requireReady(request);
  const chosen = chosenUniversity(new URL(request.url).searchParams.get('university'));
  const { catalogue } = await getServices();
  return json(await campusResponse(student, catalogue(), chosen));
});
