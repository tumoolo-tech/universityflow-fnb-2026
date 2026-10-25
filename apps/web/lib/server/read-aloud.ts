import 'server-only';
import { createHash } from 'node:crypto';
import { campusTour, isUniversityId } from '@universityflow/agent';
import type { CatalogueView } from '@universityflow/catalogue';
import type { FileStore, StoredFile } from '@universityflow/documents';
import { placeSpeech } from '@universityflow/ui';
import { HttpError } from './http';
import { type Voice, VoiceUnavailableError } from './voice';

/**
 * Read aloud's audio (planning.md §11, Phase 5e-4; owner's choice of 2026-10-22: ElevenLabs only).
 *
 * Only public text ever reaches the voice (hard rule 4): the request names a place by its id, and
 * the words are built here from the catalogue the learner may see, by the same `placeSpeech` the
 * card uses. A request can't bring text of its own, so a chat message, a name or a mark can never
 * be sent. The audio is cached in the files service per voice, model and words, shared by every
 * learner, so each place is paid for once.
 */

/**
 * The longest text sent to the voice. A place's card reads in well under 1,000 characters; this
 * leaves room and stops a runaway record from costing much (ElevenLabs bills by the character).
 */
export const MAX_SPEECH_CHARS = 1500;

/** A place id as the catalogue writes them: lower-case words and digits joined by hyphens. */
export const PLACE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The words Read aloud says for a place the learner may see, or null. */
export function placeText(view: CatalogueView, placeId: string): string | null {
  const place = view.places.find((p) => p.id === placeId);
  if (!place) return null;
  const universityId = view.campuses.find((c) => c.id === place.campusId)?.universityId;
  if (!isUniversityId(universityId)) return null;
  const shown = campusTour(view, universityId, 'chosen')
    ?.campuses.flatMap((c) => c.needs.flatMap((n) => n.places))
    .find((p) => p.id === placeId);
  return shown ? placeSpeech(shown) : null;
}

/** The files-service key for these words in this voice: a hash, never the words or a learner. */
export function speechCacheKey(voice: Pick<Voice, 'voiceId' | 'modelId'>, text: string): string {
  const hash = createHash('sha256')
    .update(`${voice.voiceId}\n${voice.modelId}\n${text}`)
    .digest('hex');
  return `speech-${hash}`;
}

export interface PlaceAudioRequest {
  readonly voice: Voice;
  readonly files: FileStore;
  readonly view: CatalogueView;
  readonly placeId: string;
}

/**
 * The audio as a response: all of it, or the one byte range asked for (`Range: bytes=a-b`, `a-`
 * or `-n`), which Safari and the phones' players need. Private: it is behind a sign-in.
 */
export function audioResponse(audio: StoredFile, range: string | null): Response {
  const size = audio.bytes.byteLength;
  const headers = {
    'content-type': audio.mimeType,
    'accept-ranges': 'bytes',
    'cache-control': 'private, max-age=3600',
  };
  if (!range) {
    return new Response(new Uint8Array(audio.bytes), {
      status: 200,
      headers: { ...headers, 'content-length': String(size) },
    });
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  let start = Number.NaN;
  let end = size - 1;
  if (match && (match[1] || match[2])) {
    if (match[1]) {
      start = Number(match[1]);
      if (match[2]) end = Math.min(Number(match[2]), size - 1);
    } else {
      start = Math.max(size - Number(match[2]), 0);
    }
  }
  if (!Number.isInteger(start) || start >= size || end < start) {
    return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
  }
  return new Response(audio.bytes.slice(start, end + 1), {
    status: 206,
    headers: {
      ...headers,
      'content-range': `bytes ${start}-${end}/${size}`,
      'content-length': String(end - start + 1),
    },
  });
}

/** A place's audio: from the cache, or spoken once and kept. Logs carry the place id only. */
export async function placeAudio({
  voice,
  files,
  view,
  placeId,
}: PlaceAudioRequest): Promise<StoredFile> {
  const text = placeText(view, placeId);
  if (text === null) throw new HttpError(404, 'not-found');
  if (text.length > MAX_SPEECH_CHARS) {
    console.warn(`read-aloud: place ${placeId} is too long to read (${text.length} characters)`);
    throw new HttpError(422, 'invalid', 'too-long');
  }
  const key = speechCacheKey(voice, text);
  // A5-14: one look-up-or-speak per key at a time on this server. The entry is made before the
  // first await, so a second request can't slip past the cache look-up in between; it is removed
  // when the work settles either way, so a failure is never remembered.
  let pending = inFlight.get(files);
  if (!pending) {
    pending = new Map();
    inFlight.set(files, pending);
  }
  const shared = pending.get(key);
  if (shared) return shared;
  const work = cachedOrSpoken(voice, files, key, text, placeId);
  const forThisKey = pending;
  forThisKey.set(key, work);
  try {
    return await work;
  } finally {
    if (forThisKey.get(key) === work) forThisKey.delete(key);
  }
}

/**
 * The look-ups and calls under way, per files service then cache key (A5-14). Per server instance
 * only: two instances may still each pay once, which is the most it costs. Weak on the files
 * service, so a test's store (or a replaced one) takes its entries with it.
 */
const inFlight = new WeakMap<FileStore, Map<string, Promise<StoredFile>>>();

async function cachedOrSpoken(
  voice: Voice,
  files: FileStore,
  key: string,
  text: string,
  placeId: string,
): Promise<StoredFile> {
  const cached = await files.get(key);
  if (cached) return cached;
  let audio: StoredFile;
  try {
    audio = await voice.synthesize(text);
  } catch (error) {
    const reason = error instanceof VoiceUnavailableError ? error.message : 'error';
    console.error(`read-aloud: place ${placeId} could not be spoken (${reason})`);
    throw new HttpError(503, 'speech-unavailable');
  }
  await files.put(key, audio);
  return audio;
}
