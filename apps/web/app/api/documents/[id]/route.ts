import { HttpError, handler, json, requireReady } from '@/lib/server/http';
import { getServices } from '@/lib/server/services';

const ID = /^[0-9a-f-]{36}$/;

/** Deletes a document and its file. */
export const DELETE = handler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { student } = await requireReady(request);
    const { id } = await params;
    if (!ID.test(id)) throw new HttpError(404, 'not-found');
    const key = await student.deleteDocument(id);
    await (await getServices()).files.delete(key);
    return json({ ok: true });
  },
);
