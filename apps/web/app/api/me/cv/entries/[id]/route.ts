import { careFor, cvOn, EntryPatch, entryTexts } from '@/lib/server/cv-routes';
import { handler, json, parseBody, requireReady } from '@/lib/server/http';

/**
 * One CV entry: change it (crisis-checked as it now stands, §7.5) or delete it. Another learner's
 * entry is simply not there (404).
 */

type Params = { params: Promise<{ id: string }> };

export const PATCH = handler(async (request: Request, { params }: Params) => {
  const services = await cvOn();
  const { student } = await requireReady(request);
  const { id } = await params;
  const patch = await parseBody(request, EntryPatch);
  const entry = await student.updateCvEntry(id, patch, services.cvAccess);
  const care = await careFor(student, services, entryTexts(entry));
  return json({ entry, care });
});

export const DELETE = handler(async (request: Request, { params }: Params) => {
  await cvOn();
  const { student } = await requireReady(request);
  const { id } = await params;
  await student.deleteCvEntry(id);
  return json({ ok: true });
});
