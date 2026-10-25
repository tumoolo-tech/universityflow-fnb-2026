import { HttpError, handler, QUOTAS, requireReady } from '@/lib/server/http';
import { audioResponse, PLACE_ID, placeAudio } from '@/lib/server/read-aloud';
import { getServices } from '@/lib/server/services';

/**
 * A campus place read aloud in the ElevenLabs voice (owner's choice of 2026-10-22), for the web's
 * audio player and the app's (same route; the app sends its bearer token).
 *
 * The place's id is the only input: no query, no body, no text. The words are built on the server
 * from the catalogue (lib/server/read-aloud.ts), so nothing about a learner can reach ElevenLabs
 * (hard rule 4), and the key never leaves this server. Signed in and consent-ready (hard rule 5),
 * a per-learner limit, and the audio cached so a place is paid for once.
 *
 * A GET, so the browser's `<audio>` and the phone's player can fetch it (and its byte ranges)
 * directly. The session cookie is SameSite=Lax, so another site can't make a learner's browser
 * fetch it; at worst a link spends one read from the learner's own limit.
 */
export const GET = handler(
  async (request: Request, { params }: { params: Promise<{ place: string }> }) => {
    const { studentId } = await requireReady(request);
    const { place } = await params;
    if (!PLACE_ID.test(place)) throw new HttpError(404, 'not-found');
    if (new URL(request.url).search) throw new HttpError(400, 'invalid');
    const { voice, files, store, catalogue } = await getServices();
    if (!voice) throw new HttpError(404, 'not-found');
    if (!(await store.allow('speech', studentId, QUOTAS.speech.max, QUOTAS.speech.windowMs))) {
      throw new HttpError(429, 'rate-limited');
    }
    const audio = await placeAudio({ voice, files, view: catalogue(), placeId: place });
    return audioResponse(audio, request.headers.get('range'));
  },
);
