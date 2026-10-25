import { isSubjectId } from '@universityflow/catalogue';
import { z } from 'zod';
import { examsResponse } from '@/lib/server/goals';
import { handler, json, parseBody, requireReady } from '@/lib/server/http';
import { getServices } from '@/lib/server/services';

/**
 * The learner's exam countdown and the subjects it is matched from: their confirmed report, plus
 * their own changes where their school's papers differ. Only the changes are stored, never a copy
 * of the timetable.
 */

export const GET = handler(async (request: Request) => {
  const { student } = await requireReady(request);
  const { catalogue } = await getServices();
  return json(await examsResponse(student, catalogue()));
});

const Change = z
  .object({
    subjectId: z.string().refine(isSubjectId),
    /** true: I write it · false: I don't · null: undo my change, my report decides. */
    included: z.boolean().nullable(),
  })
  .strict();

export const PUT = handler(async (request: Request) => {
  const { student } = await requireReady(request);
  const change = await parseBody(request, Change);
  await student.setExamSubjectChoice(change.subjectId, change.included);
  const { catalogue } = await getServices();
  return json(await examsResponse(student, catalogue()));
});
