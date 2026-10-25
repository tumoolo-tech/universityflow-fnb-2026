import { careFor, cvOn, EntryBody, entryTexts } from '@/lib/server/cv-routes';
import { handler, json, parseBody, requireReady } from '@/lib/server/http';

/**
 * The learner's own CV entries (docs/design/mmereko-api-proposal.md §3.3): projects, skills, work,
 * volunteering, awards, languages and certificates, with evidence links (printed, never fetched,
 * D10). Every save is read by the same crisis check as the chat (§7.5): the words are saved
 * anyway, and the answer carries `care` (the crisis card, a kind line for a setback, or null).
 * Nothing about the check is stored or logged. Nothing is sent to Mmereko until "Make my CV".
 */

export const GET = handler(async (request: Request) => {
  await cvOn();
  const { student } = await requireReady(request);
  return json({ entries: await student.cvEntries() });
});

export const POST = handler(async (request: Request) => {
  const services = await cvOn();
  const { student } = await requireReady(request);
  const body = await parseBody(request, EntryBody);
  const entry = await student.addCvEntry(body, services.cvAccess);
  const care = await careFor(student, services, entryTexts(entry));
  return json({ entry, care });
});
