import { UNIVERSITY_IDS } from '@universityflow/catalogue';
import { APPLICATION_STATUSES } from '@universityflow/db';
import { z } from 'zod';
import { HttpError, handler, json, parseBody, requireReady } from '@/lib/server/http';

const Body = z.object({
  status: z.enum(APPLICATION_STATUSES).optional(),
  reference: z.string().trim().max(40).nullable().optional(),
});

/** The learner's own record of an application. We never submit one for them. */
export const PATCH = handler(
  async (request: Request, { params }: { params: Promise<{ university: string }> }) => {
    const { student } = await requireReady(request);
    const { university } = await params;
    if (!(UNIVERSITY_IDS as readonly string[]).includes(university)) {
      throw new HttpError(404, 'not-found');
    }
    const body = await parseBody(request, Body);
    const patch = {
      ...(body.status ? { status: body.status } : {}),
      ...(body.reference !== undefined ? { reference: body.reference || null } : {}),
    };
    return json({ application: await student.updateApplication(university, patch) });
  },
);
