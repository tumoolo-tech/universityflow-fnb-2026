import { allSlots, PLAN_LIMITS, planTemplate, slotChildren, slotKey } from '@universityflow/ui';
import { z } from 'zod';
import { HttpError, handler, json, parseBody, requireReady } from '@/lib/server/http';
import { careForStudent } from '@/lib/server/plan-care';
import { headingOf, ownMap, planWordsAllowed, toPlanNode } from '@/lib/server/plan-maps';
import { getServices } from '@/lib/server/services';

/**
 * Adds a part to one of the learner's plan maps, last under its parent: a stop of the map's own
 * template put back (with its own stops, for a group such as "My habits"), or the learner's own
 * part. Its words wait for the owner's switch (D2) and are read by the crisis check (D3).
 */

type Params = { params: Promise<{ id: string }> };

const Add = z
  .object({
    parentId: z.uuid(),
    slotId: z
      .string()
      .regex(/^slot:[a-z0-9-]{1,40}$/)
      .optional(),
    text: z.string().trim().max(PLAN_LIMITS.text).nullable().optional(),
  })
  .strict();

export const POST = handler(async (request: Request, { params }: Params) => {
  const { student } = await requireReady(request);
  const { id } = await params;
  const input = await parseBody(request, Add);
  const map = await ownMap(student, id);
  const templateId = map.templateId as Parameters<typeof planTemplate>[0];
  // Only this template's own stops: a slot from another template has no words here.
  if (
    input.slotId &&
    !allSlots(planTemplate(templateId)).some((s) => s.key === slotKey(input.slotId ?? null))
  ) {
    throw new HttpError(400, 'invalid');
  }
  const words = await planWordsAllowed();
  const node = await student.addPlanNode(
    id,
    {
      parentId: input.parentId,
      slotId: input.slotId ?? null,
      text: input.text ?? null,
      childSlots: input.slotId ? slotChildren(templateId, input.slotId) : [],
    },
    { words },
  );
  const { catalogue } = await getServices();
  const care = node.text
    ? await careForStudent(student, catalogue(), {
        heading: headingOf(templateId, { ...node, text: null }),
        texts: [node.text],
      })
    : null;
  return json({ node: toPlanNode(node), care });
});
