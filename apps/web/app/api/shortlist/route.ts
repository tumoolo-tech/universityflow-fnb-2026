import { z } from 'zod';
import { HttpError, handler, json, parseBody, requireReady } from '@/lib/server/http';
import { getServices } from '@/lib/server/services';

const Body = z.object({ programmeId: z.string().min(3).max(80) });

export const GET = handler(async (request: Request) => {
  const { student } = await requireReady(request);
  return json({ shortlist: (await student.shortlist()).map((s) => s.programmeId) });
});

export const POST = handler(async (request: Request) => {
  const { student } = await requireReady(request);
  const { programmeId } = await parseBody(request, Body);
  const { catalogue } = await getServices();
  if (!catalogue().programmes.some((p) => p.id === programmeId))
    throw new HttpError(404, 'not-found');
  await student.addToShortlist(programmeId);
  return json({ ok: true });
});

export const DELETE = handler(async (request: Request) => {
  const { student } = await requireReady(request);
  const { programmeId } = await parseBody(request, Body);
  await student.removeFromShortlist(programmeId);
  return json({ ok: true });
});
