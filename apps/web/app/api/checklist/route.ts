import { APPLICATION_CHECKLIST } from '@universityflow/agent';
import { UNIVERSITY_IDS } from '@universityflow/catalogue';
import { z } from 'zod';
import { HttpError, handler, json, parseBody, requireReady } from '@/lib/server/http';

const Body = z.object({
  scope: z.string().regex(/^(application:[a-z]+|funding:nsfas)$/),
  item: z.string().regex(/^[a-z0-9-]{2,40}$/),
  done: z.boolean(),
});

/** Ticks an item on an application or funding checklist. */
export const POST = handler(async (request: Request) => {
  const { student } = await requireReady(request);
  const { scope, item, done } = await parseBody(request, Body);
  if (scope.startsWith('application:')) {
    const university = scope.slice('application:'.length);
    if (!(UNIVERSITY_IDS as readonly string[]).includes(university))
      throw new HttpError(400, 'invalid');
    if (!(APPLICATION_CHECKLIST as readonly string[]).includes(item))
      throw new HttpError(400, 'invalid');
  } else if (!/^document-\d{1,2}$/.test(item)) {
    throw new HttpError(400, 'invalid');
  }
  await student.setChecklistItem(scope, item, done);
  return json({ ok: true });
});
