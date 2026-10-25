import type { SpeechStatus } from '@universityflow/ui';
import { handler, json, requireSignedIn } from '@/lib/server/http';
import { getServices } from '@/lib/server/services';

/**
 * Whether Read aloud is offered (owner's choice of 2026-10-22: ElevenLabs only). The app asks once
 * per session and shows no Read aloud button when it isn't: never a phone voice instead. (The web
 * pages are told by their layout.) Nothing about the learner is read or processed.
 */
export const GET = handler(async (request: Request) => {
  await requireSignedIn(request);
  const { voice } = await getServices();
  return json({ available: voice !== null } satisfies SpeechStatus);
});
