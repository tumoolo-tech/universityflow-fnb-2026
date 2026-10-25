import { en } from '@universityflow/content';
import { z } from 'zod';
import { HttpError, handler, json, parseBody, requireSignedIn } from '@/lib/server/http';
import { getServices } from '@/lib/server/services';

const Body = z.object({ version: z.string().trim().min(1).max(40) }).strict();

/**
 * An adult agrees in their own name (audit A7-04; planning.md §8.1 at 18): a new learner aged 18
 * or older, or a learner whose guardian consented and who has turned 18. The page sends the
 * version of the wording it showed (`en.adultConsent.version`); an agreement to any other
 * wording is refused, so the record always names what the learner actually read.
 */
export const POST = handler(async (request: Request) => {
  const { studentId } = await requireSignedIn(request);
  const { version } = await parseBody(request, Body);
  if (version !== en.adultConsent.version) throw new HttpError(409, 'state');
  await (await getServices()).store.consentAsAdult(studentId, version);
  return json({ ok: true });
});
