import { HttpError, handler, json, requireReady } from '@/lib/server/http';

export const DELETE = handler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { student } = await requireReady(request);
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(404, 'not-found');
    await student.forget(id);
    return json({ ok: true });
  },
);
