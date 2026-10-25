import {
  careFor,
  cvOn,
  SelectionBody,
  selectionTexts,
  selectionView,
} from '@/lib/server/cv-routes';
import { handler, json, parseBody, requireReady } from '@/lib/server/http';

/**
 * What goes on the CV (docs/design/mmereko-api-proposal.md §10.3, §10.5): what is ticked (school,
 * the subjects whose mark shows (none by default, D11), the accepted offer, modules, entries) and
 * the contact details the learner typed for it (D9: never the sign-in phone, never an ID or
 * student number). The answer also lists what can be ticked, each with where it came from, and the
 * profile it makes now. The summary and label are the learner's words: crisis-checked (§7.5).
 */

export const GET = handler(async (request: Request) => {
  const services = await cvOn();
  const { student } = await requireReady(request);
  return json(await selectionView(student, services));
});

export const PUT = handler(async (request: Request) => {
  const services = await cvOn();
  const { student } = await requireReady(request);
  const body = await parseBody(request, SelectionBody);
  const saved = await student.saveCvSelection(body, services.cvAccess);
  const care = await careFor(student, services, selectionTexts(saved));
  return json({ ...(await selectionView(student, services)), care });
});
