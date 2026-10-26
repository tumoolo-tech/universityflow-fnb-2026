import { PLAN_LIMITS, PLAN_POSITION_MAX } from '@universityflow/ui';
import { z } from 'zod';
import { handler, json, parseBody, requireReady } from '@/lib/server/http';
import { ownMap, planMapView, planWordsAllowed } from '@/lib/server/plan-maps';
import { getServices } from '@/lib/server/services';

/**
 * Where the cards of a plan map sit on its canvas (RT-08, migration 0043): PUT puts the cards the
 * learner dragged or moved with the keys, DELETE is "Reset layout" (every card back where its
 * template puts it). Numbers only, never words, so no words switch; each place a whole number of
 * pixels inside the canvas's bounds, checked here, in the store and in the database. Another
 * learner's map is not found (row-level security).
 */

type Params = { params: Promise<{ id: string }> };

const place = z.int().min(0).max(PLAN_POSITION_MAX);
const Layout = z
  .object({
    places: z
      .array(z.object({ nodeId: z.uuid(), x: place, y: place }).strict())
      .min(1)
      .max(PLAN_LIMITS.nodes),
  })
  .strict();

export const PUT = handler(async (request: Request, { params }: Params) => {
  const { student } = await requireReady(request);
  const { id } = await params;
  const { places } = await parseBody(request, Layout);
  await ownMap(student, id);
  const saved = await student.savePlanLayout(id, places);
  const { catalogue } = await getServices();
  return json({ map: await planMapView(student, catalogue(), saved, await planWordsAllowed()) });
});

export const DELETE = handler(async (request: Request, { params }: Params) => {
  const { student } = await requireReady(request);
  const { id } = await params;
  await ownMap(student, id);
  const saved = await student.resetPlanLayout(id);
  const { catalogue } = await getServices();
  return json({ map: await planMapView(student, catalogue(), saved, await planWordsAllowed()) });
});
