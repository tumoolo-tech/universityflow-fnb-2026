import { PLAN_TEMPLATE_IDS, templateSeed } from '@universityflow/ui';
import { z } from 'zod';
import { handler, json, parseBody, requireReady } from '@/lib/server/http';
import { planMapsResponse, planMapView, planWordsAllowed } from '@/lib/server/plan-maps';
import { getServices } from '@/lib/server/services';

/**
 * My plan maps (docs/design/plan-maps-proposal.md §3.2): the learner's maps, and a new one from a
 * template. Same guards as /api/me/goal: signed in, same origin for cookie writes (CSRF), and
 * refused while their data may not be processed (hard rule 5, again in the database). A new map
 * holds no words: the template's stops, all Planned.
 */

export const GET = handler(async (request: Request) => {
  const { student } = await requireReady(request);
  return json(await planMapsResponse(student));
});

const Create = z.object({ templateId: z.enum(PLAN_TEMPLATE_IDS), linksGoal: z.boolean() }).strict();

export const POST = handler(async (request: Request) => {
  const { student } = await requireReady(request);
  const { templateId, linksGoal } = await parseBody(request, Create);
  const map = await student.createPlanMap({
    templateId,
    linksGoal,
    parts: templateSeed(templateId),
  });
  const { catalogue } = await getServices();
  return json({ map: await planMapView(student, catalogue(), map, await planWordsAllowed()) });
});
