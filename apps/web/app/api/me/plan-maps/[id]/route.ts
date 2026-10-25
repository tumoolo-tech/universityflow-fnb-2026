import { PLAN_LIMITS } from '@universityflow/ui';
import { z } from 'zod';
import { handler, json, parseBody, requireReady } from '@/lib/server/http';
import { careForStudent } from '@/lib/server/plan-care';
import { ownMap, planMapView, planWordsAllowed } from '@/lib/server/plan-maps';
import { getServices } from '@/lib/server/services';

/**
 * One of the learner's plan maps: read it, change its title or whether the middle shows My goal,
 * delete it (and everything in it). Another learner's map is not found (row-level security).
 * A title is the learner's own words: it waits for the owner's switch (D2), and is read by the
 * crisis check like every saved word (D3).
 */

type Params = { params: Promise<{ id: string }> };

export const GET = handler(async (request: Request, { params }: Params) => {
  const { student } = await requireReady(request);
  const { id } = await params;
  const { catalogue } = await getServices();
  const map = await ownMap(student, id);
  return json({ map: await planMapView(student, catalogue(), map, await planWordsAllowed()) });
});

const Change = z
  .object({
    title: z.string().trim().max(PLAN_LIMITS.title).nullable().optional(),
    linksGoal: z.boolean().optional(),
  })
  .strict();

export const PATCH = handler(async (request: Request, { params }: Params) => {
  const { student } = await requireReady(request);
  const { id } = await params;
  const patch = await parseBody(request, Change);
  await ownMap(student, id);
  const words = await planWordsAllowed();
  const saved = await student.updatePlanMap(id, patch, { words });
  const { catalogue } = await getServices();
  const view = catalogue();
  const care = patch.title ? await careForStudent(student, view, { texts: [saved.title] }) : null;
  return json({ map: await planMapView(student, view, saved, words), care });
});

export const DELETE = handler(async (request: Request, { params }: Params) => {
  const { student } = await requireReady(request);
  const { id } = await params;
  await ownMap(student, id);
  await student.deletePlanMap(id);
  return json({ ok: true });
});
