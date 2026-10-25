import { handler, json, requireReady } from '@/lib/server/http';
import { currentRecheck } from '@/lib/server/rechecks';
import { getServices } from '@/lib/server/services';

/** What changed with the learner's current report ("Since your June report…"), or null. */
export const GET = handler(async (request: Request) => {
  const { student } = await requireReady(request);
  const { catalogue } = await getServices();
  return json({ recheck: await currentRecheck(student, catalogue()) });
});
