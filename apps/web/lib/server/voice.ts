import 'server-only';
import type { StoredFile } from '@universityflow/documents';

/**
 * Read aloud's voice (planning.md §11, Phase 5e-4; owner's choice of 2026-10-22: ElevenLabs only,
 * no browser or phone voice). Behind an interface with a fake and a contract (D8,
 * test/voice-contract.ts). Only ever given public catalogue text, built on our server from a
 * place's id (lib/server/read-aloud.ts): never a chat message, a name, a mark or anything else
 * about a learner (hard rule 4).
 *
 * The key stays on this server: the browser and the app only ever ask /api/speech/<place id>.
 */

export interface Voice {
  readonly provider: 'elevenlabs' | 'fake';
  /** Which voice and model speak: the audio cache is keyed by both, with the text. */
  readonly voiceId: string;
  readonly modelId: string;
  /** MP3 audio of `text`. Throws `VoiceUnavailableError` when the provider can't say it. */
  synthesize(text: string): Promise<StoredFile>;
}

/** The provider refused or couldn't be reached. The message is a status only: never the text. */
export class VoiceUnavailableError extends Error {
  override readonly name = 'VoiceUnavailableError';
  constructor(
    readonly status: number | null,
    /** Why an answer that came back was refused (A5-14): a fixed word, never its content. */
    readonly reason?: 'not-audio' | 'too-large',
  ) {
    super(`voice unavailable (${status ?? 'network'}${reason ? `, ${reason}` : ''})`);
  }
}

function assertText(text: string): void {
  if (!text.trim()) throw new RangeError('Nothing to read');
}

/** MP3's frame-sync bytes and a little silence: enough to be audio/mpeg in tests. */
const FAKE_MP3 = new Uint8Array([0xff, 0xfb, 0x90, 0x64, 0, 0, 0, 0]);

/** The fake voice: records what it was asked to say, answers with a few bytes of MP3. */
export class FakeVoice implements Voice {
  readonly provider = 'fake' as const;
  readonly voiceId = 'fake-voice';
  readonly modelId = 'fake-model';
  readonly spoken: string[] = [];
  #broken = false;

  breakIt(): void {
    this.#broken = true;
  }

  async synthesize(text: string): Promise<StoredFile> {
    assertText(text);
    this.spoken.push(text);
    if (this.#broken) throw new VoiceUnavailableError(503);
    return { bytes: new Uint8Array(FAKE_MP3), mimeType: 'audio/mpeg' };
  }
}

/**
 * ElevenLabs text to speech, from its API reference (opened 2026-10-22):
 * https://elevenlabs.io/docs/api-reference/text-to-speech/convert
 *
 * `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`, the key in the `xi-api-key`
 * header, a JSON body `{ text, model_id }` (`model_id` defaults to `eleven_multilingual_v2`), and
 * `output_format` as a query parameter (default `mp3_44100_128`, asked for explicitly here). The
 * answer is the audio file. `enable_logging=false` (zero retention) is for enterprise accounts
 * only, so it isn't sent: ElevenLabs keeps what it is sent, which is why only public text is.
 */
export const ELEVENLABS_API = 'https://api.elevenlabs.io';
export const DEFAULT_ELEVENLABS_MODEL = 'eleven_multilingual_v2';
export const ELEVENLABS_OUTPUT_FORMAT = 'mp3_44100_128';
/** The only answer kept: what `ELEVENLABS_OUTPUT_FORMAT` asks for, and what is stored and served. */
export const SPEECH_AUDIO_TYPE = 'audio/mpeg';

/**
 * The most audio bytes accepted from the voice (A5-14): 5 MiB, checked against a declared
 * `content-length` first and then counted while the body streams in.
 *
 * Why 5 MiB: `mp3_44100_128` is 128 kbit/s, 16,000 bytes a second. Read aloud never sends more
 * than `MAX_SPEECH_CHARS` (1,500 characters, read-aloud.ts); spoken at an ordinary 15 characters a
 * second that is 100 s (1.6 MB), and at a slow 10 a second 150 s (2.4 MB). 5 MiB is about 330 s,
 * twice the slow case, so no real answer comes near it, while a provider fault (an endless or
 * wrong body) is stopped long before it costs memory or is cached for every learner.
 */
export const MAX_SPEECH_AUDIO_BYTES = 5 * 1024 * 1024;

export interface ElevenLabsOptions {
  readonly apiKey: string;
  readonly voiceId: string;
  /** Null: ElevenLabs' default model, named explicitly so the cache key is stable. */
  readonly modelId: string | null;
  readonly fetch?: (url: string, init: RequestInit) => Promise<Response>;
  readonly timeoutMs?: number;
}

export class ElevenLabsVoice implements Voice {
  readonly provider = 'elevenlabs' as const;
  readonly voiceId: string;
  readonly modelId: string;
  readonly #apiKey: string;
  readonly #fetch: (url: string, init: RequestInit) => Promise<Response>;
  readonly #timeoutMs: number;

  constructor(options: ElevenLabsOptions) {
    if (!options.apiKey) throw new Error('ElevenLabs needs an API key');
    if (!options.voiceId) throw new Error('ElevenLabs needs a voice id');
    this.#apiKey = options.apiKey;
    this.voiceId = options.voiceId;
    this.modelId = options.modelId || DEFAULT_ELEVENLABS_MODEL;
    this.#fetch = options.fetch ?? ((url, init) => fetch(url, init));
    this.#timeoutMs = options.timeoutMs ?? 20_000;
  }

  async synthesize(text: string): Promise<StoredFile> {
    assertText(text);
    const url = `${ELEVENLABS_API}/v1/text-to-speech/${encodeURIComponent(this.voiceId)}?output_format=${ELEVENLABS_OUTPUT_FORMAT}`;
    let response: Response;
    try {
      response = await this.#fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': this.#apiKey,
          'content-type': 'application/json',
          accept: 'audio/mpeg',
        },
        body: JSON.stringify({ text, model_id: this.modelId }),
        signal: AbortSignal.timeout(this.#timeoutMs),
      });
    } catch {
      throw new VoiceUnavailableError(null);
    }
    if (!response.ok) {
      await discard(response);
      throw new VoiceUnavailableError(response.status);
    }
    // A5-14: only the MP3 asked for is kept, and never more of it than the cap.
    if (mediaType(response.headers.get('content-type')) !== SPEECH_AUDIO_TYPE) {
      await discard(response);
      throw new VoiceUnavailableError(response.status, 'not-audio');
    }
    const declared = Number(response.headers.get('content-length') ?? Number.NaN);
    if (Number.isFinite(declared) && declared > MAX_SPEECH_AUDIO_BYTES) {
      await discard(response);
      throw new VoiceUnavailableError(response.status, 'too-large');
    }
    const bytes = await readCapped(response, MAX_SPEECH_AUDIO_BYTES);
    if (bytes.byteLength === 0) throw new VoiceUnavailableError(response.status);
    return { bytes, mimeType: SPEECH_AUDIO_TYPE };
  }
}

/** `audio/mpeg` from `Audio/MPEG; foo=bar`; null when there is no type. */
function mediaType(header: string | null): string | null {
  return header?.split(';')[0]?.trim().toLowerCase() || null;
}

/** Lets go of a body that won't be read, so the connection is freed. */
async function discard(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Already closed or errored: nothing to free.
  }
}

/** The body, read chunk by chunk and abandoned as soon as it passes `max` bytes. */
async function readCapped(response: Response, max: number): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) {
        await reader.cancel().catch(() => undefined);
        throw new VoiceUnavailableError(response.status, 'too-large');
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof VoiceUnavailableError) throw error;
    // The connection dropped or the timeout fired mid-body.
    throw new VoiceUnavailableError(null);
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return bytes;
}
