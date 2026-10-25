import { handler, json, requireReady } from '@/lib/server/http';
import { getServices } from '@/lib/server/services';
import { subjectsResponse } from '@/lib/server/subjects';

/**
 * My subjects (G10-4): which courses the subjects on the learner's confirmed report keep open,
 * for the app's screen, with the goal course and, with `?drop=&take=`, the "Try a different
 * subject" what-if (subject ids only; anything not offered is ignored, never echoed). Read-only:
 * nothing is saved, and the address is never logged (hard rule 4). Signed in, and refused while
 * their data may not be processed (hard rule 5).
 */
export const GET = handler(async (request: Request) => {
  const { student } = await requireReady(request);
  const { catalogue } = await getServices();
  const params = new URL(request.url).searchParams;
  const [report, goal] = await Promise.all([student.latestReport(), student.goal()]);
  return json(
    subjectsResponse(catalogue(), report, {
      goalId: goal?.programmeId ?? null,
      drop: params.get('drop'),
      take: params.get('take'),
    }),
  );
});
