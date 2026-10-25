import { PLAN_LIMITS } from '@universityflow/ui';
import { z } from 'zod';
import { handler, json, parseBody, requireReady } from '@/lib/server/http';
import { ownMap, planMapView, planWordsAllowed } from '@/lib/server/plan-maps';
import { getServices } from '@/lib/server/services';

/**
 * Moves a part of a plan map, with everything under it: the keyboard's Move up, Move down, Move
 * in a level and Move out a level (proposal §7), never a drag. The limits are the store's.
 */

type Params = { params: Promise<{ id: string; nodeId: string }> };

const Move = z
  .object({ parentId: z.uuid(), position: z.int().min(0).max(PLAN_LIMITS.children) })
  .strict();

export const POST = handler(async (request: Request, { params }: Params) => {
  const { student } = await requireReady(request);
  const { id, nodeId } = await params;
  const to = await parseBody(request, Move);
  await ownMap(student, id);
  await student.movePlanNode(id, nodeId, to);
  const { catalogue } = await getServices();
  const map = await ownMap(student, id);
  return json({ map: await planMapView(student, catalogue(), map, await planWordsAllowed()) });
});
