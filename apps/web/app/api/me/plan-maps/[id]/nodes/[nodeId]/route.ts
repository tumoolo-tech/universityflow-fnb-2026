import { PLAN_LIMITS, PLAN_STATUSES, type PlanTemplateId } from '@universityflow/ui';
import { z } from 'zod';
import { handler, json, parseBody, requireReady } from '@/lib/server/http';
import { careForStudent } from '@/lib/server/plan-care';
import { headingOf, ownMap, planWordsAllowed, toPlanNode } from '@/lib/server/plan-maps';
import { getServices } from '@/lib/server/services';

/**
 * One part of a plan map: its words, how it went, and the learner's own target month; or delete
 * it with everything under it (never the centre).
 *
 * Every save is read by the same crisis check as the chat (D3, docs/design/plan-maps-proposal.md
 * §5.2): the part's words, what got in the way and what to try, as they now stand, under the
 * part's heading. The words are saved anyway, and the answer carries `care`: the crisis card, or
 * one kind line for a setback, or null. Nothing about the check is stored or logged.
 */

type Params = { params: Promise<{ id: string; nodeId: string }> };

const words = (max: number) => z.string().trim().max(max).nullable().optional();

const Save = z
  .object({
    text: words(PLAN_LIMITS.text),
    status: z.enum(PLAN_STATUSES).optional(),
    whyNot: words(PLAN_LIMITS.reflection),
    differently: words(PLAN_LIMITS.reflection),
    targetMonth: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .nullable()
      .optional(),
  })
  .strict();

export const PUT = handler(async (request: Request, { params }: Params) => {
  const { student } = await requireReady(request);
  const { id, nodeId } = await params;
  const patch = await parseBody(request, Save);
  const map = await ownMap(student, id);
  const node = await student.savePlanNode(id, nodeId, patch, { words: await planWordsAllowed() });
  const { catalogue } = await getServices();
  const templateId = map.templateId as PlanTemplateId;
  const care = await careForStudent(student, catalogue(), {
    // A learner's own part is read under the words it had: "I just want to" over "die".
    heading: headingOf(templateId, map.nodes.find((n) => n.id === nodeId) ?? node),
    texts: [node.text, node.whyNot, node.differently],
  });
  return json({ node: toPlanNode(node), care });
});

export const DELETE = handler(async (request: Request, { params }: Params) => {
  const { student } = await requireReady(request);
  const { id, nodeId } = await params;
  await ownMap(student, id);
  await student.deletePlanNode(id, nodeId);
  return json({ ok: true });
});
