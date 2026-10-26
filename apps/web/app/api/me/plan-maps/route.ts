import { PLAN_LIMITS, PLAN_TEMPLATE_IDS, templateSeed } from '@universityflow/ui';
import { z } from 'zod';
import { handler, json, parseBody, requireReady } from '@/lib/server/http';
import { careForStudent } from '@/lib/server/plan-care';
import { planMapsResponse, planMapView, planWordsAllowed } from '@/lib/server/plan-maps';
import { getServices } from '@/lib/server/services';

/**
 * My plan maps (docs/design/plan-maps-proposal.md §3.2): the learner's maps, and a new one from a
 * template. Same guards as /api/me/goal: signed in, same origin for cookie writes (CSRF), and
 * refused while their data may not be processed (hard rule 5, again in the database). A new map
 * holds the template's stops, all Planned.
 *
 * RT-06 (the owner's run-through, 2026-10-25): a learner names their own map; the template is
 * only its layout. The name is the learner's own words, so it needs the words switch (D2); while
 * writing waits for the consent wording, a map can't be given one and is shown by its template's
 * name. The name is optional here (MAPS-01, the integrator's call): the web's start form asks for
 * one, but an installed app build may not send one, and a map without a name shows its template's
 * name with a "name this map" prompt. Like every saved word, it is crisis-checked (D3).
 */

export const GET = handler(async (request: Request) => {
  const { student } = await requireReady(request);
  return json(await planMapsResponse(student));
});

const Create = z
  .object({
    templateId: z.enum(PLAN_TEMPLATE_IDS),
    linksGoal: z.boolean(),
    title: z.string().trim().max(PLAN_LIMITS.title).nullable().optional(),
  })
  .strict();

export const POST = handler(async (request: Request) => {
  const { student } = await requireReady(request);
  const { templateId, linksGoal, title } = await parseBody(request, Create);
  const words = await planWordsAllowed();
  const name = title ? title : null;
  const map = await student.createPlanMap(
    { templateId, linksGoal, parts: templateSeed(templateId), title: name },
    { words },
  );
  const { catalogue } = await getServices();
  const view = catalogue();
  const care = name ? await careForStudent(student, view, { texts: [map.title] }) : null;
  return json({ map: await planMapView(student, view, map, words), care });
});
