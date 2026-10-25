import { homeData } from '@/lib/server/home';
import { handler, json, requireReady } from '@/lib/server/http';
import { getServices } from '@/lib/server/services';

/**
 * The signed-in home's data (`HomeData`, docs/design/README.md) for the mobile app: the same
 * numbers, lists and next step the web's `/home` renders, worked out by the same server code.
 * Only for a learner whose data may be processed (hard rule 5).
 */
export const GET = handler(async (request: Request) => {
  const { student, account } = await requireReady(request);
  const { catalogue } = await getServices();
  return json(await homeData(student, catalogue(), new Date(), account));
});
