import { practiceResponse } from '@/lib/server/goals';
import { handler, json, requireReady } from '@/lib/server/http';
import { getServices } from '@/lib/server/services';

/**
 * Free practice for the subjects that matter to the learner (Phase 4e): the same code as the
 * agent's practice_for tool. Read-only. Signed in, and refused while their data may not be
 * processed (hard rule 5).
 */
export const GET = handler(async (request: Request) => {
  const { student } = await requireReady(request);
  const { catalogue } = await getServices();
  return json(await practiceResponse(student, catalogue()));
});
