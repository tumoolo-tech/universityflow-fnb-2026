import { z } from 'zod';
import { HttpError, handler, json, requireReady } from '@/lib/server/http';
import { outlinesResponse } from '@/lib/server/module-outlines';

/** Removes one of the learner's confirmed module outlines. */
export const DELETE = handler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { student } = await requireReady(request);
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) throw new HttpError(404, 'not-found');
    await student.deleteModuleOutline(id);
    return json(await outlinesResponse(student));
  },
);
