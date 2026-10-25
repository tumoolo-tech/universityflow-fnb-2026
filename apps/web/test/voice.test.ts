import { describe, expect, it, vi } from 'vitest';
import { MAX_SPEECH_CHARS } from '../lib/server/read-aloud';
import {
  DEFAULT_ELEVENLABS_MODEL,
  ElevenLabsVoice,
  FakeVoice,
  MAX_SPEECH_AUDIO_BYTES,
  VoiceUnavailableError,
} from '../lib/server/voice';
import { voiceContract } from './voice-contract';

/**
 * Read aloud's voice (owner's choice of 2026-10-22): the fake and the ElevenLabs adapter meet one
 * contract. ElevenLabs is reached only through an injected `fetch`, so no test calls it.
 */

const KEY = 'test-elevenlabs-key-not-real';
const VOICE = 'TestVoice0001';
const MP3 = new Uint8Array([0xff, 0xfb, 0x90, 0x64, 0, 0, 0, 0]);

/** A stand-in for ElevenLabs' text-to-speech endpoint. */
function elevenLabsStandIn() {
  let broken = false;
  const fetch = vi.fn(async (_url: string, _init: RequestInit) =>
    broken
      ? new Response(JSON.stringify({ detail: { status: 'quota_exceeded' } }), { status: 401 })
      : new Response(MP3, { status: 200, headers: { 'content-type': 'audio/mpeg' } }),
  );
  return {
    fetch,
    breakIt: () => {
      broken = true;
    },
  };
}

describe('the fake voice', () => {
  voiceContract(() => {
    const voice = new FakeVoice();
    return { make: () => voice, breakIt: () => voice.breakIt(), calls: () => voice.spoken.length };
  });

  it('records what it was asked to say', async () => {
    const voice = new FakeVoice();
    await voice.synthesize('One.');
    expect(voice.spoken).toEqual(['One.']);
  });
});

describe('the ElevenLabs voice', () => {
  voiceContract(() => {
    const standIn = elevenLabsStandIn();
    return {
      make: () =>
        new ElevenLabsVoice({ apiKey: KEY, voiceId: VOICE, modelId: null, fetch: standIn.fetch }),
      breakIt: standIn.breakIt,
      calls: () => standIn.fetch.mock.calls.length,
    };
  });

  it('calls the documented endpoint: the voice in the path, the key in xi-api-key, MP3 asked for', async () => {
    const standIn = elevenLabsStandIn();
    const voice = new ElevenLabsVoice({
      apiKey: KEY,
      voiceId: VOICE,
      modelId: null,
      fetch: standIn.fetch,
    });
    expect(voice.modelId).toBe(DEFAULT_ELEVENLABS_MODEL);
    await voice.synthesize('Hello.');
    const [url, init] = standIn.fetch.mock.calls[0] ?? [];
    expect(url).toBe(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`,
    );
    expect(init?.method).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('xi-api-key')).toBe(KEY);
    expect(headers.get('content-type')).toBe('application/json');
    expect(JSON.parse(String(init?.body))).toEqual({
      text: 'Hello.',
      model_id: DEFAULT_ELEVENLABS_MODEL,
    });
  });

  it('uses the configured model', async () => {
    const standIn = elevenLabsStandIn();
    const voice = new ElevenLabsVoice({
      apiKey: KEY,
      voiceId: VOICE,
      modelId: 'eleven_flash_v2_5',
      fetch: standIn.fetch,
    });
    await voice.synthesize('Hello.');
    expect(JSON.parse(String(standIn.fetch.mock.calls[0]?.[1]?.body)).model_id).toBe(
      'eleven_flash_v2_5',
    );
  });

  it('a network failure or an empty answer is unavailable too', async () => {
    const offline = new ElevenLabsVoice({
      apiKey: KEY,
      voiceId: VOICE,
      modelId: null,
      fetch: async () => {
        throw new TypeError('fetch failed');
      },
    });
    await expect(offline.synthesize('Hello.')).rejects.toThrow(VoiceUnavailableError);
    const empty = new ElevenLabsVoice({
      apiKey: KEY,
      voiceId: VOICE,
      modelId: null,
      fetch: async () => new Response(new Uint8Array(), { status: 200 }),
    });
    await expect(empty.synthesize('Hello.')).rejects.toThrow(VoiceUnavailableError);
  });

  // A5-14: a provider fault must never be cached and replayed to every learner as "audio".
  it('refuses an answer that isn’t the MP3 it asked for', async () => {
    for (const type of ['text/html; charset=utf-8', 'application/json', 'audio/wav', null]) {
      const voice = new ElevenLabsVoice({
        apiKey: KEY,
        voiceId: VOICE,
        modelId: null,
        fetch: async () =>
          new Response(MP3, { status: 200, headers: type ? { 'content-type': type } : {} }),
      });
      const error = await voice.synthesize('Hello.').catch((e: unknown) => e);
      expect(error, String(type)).toBeInstanceOf(VoiceUnavailableError);
      expect((error as Error).message).toContain('not-audio');
    }
    // The type's parameters and case don't matter.
    const fine = new ElevenLabsVoice({
      apiKey: KEY,
      voiceId: VOICE,
      modelId: null,
      fetch: async () =>
        new Response(MP3, { status: 200, headers: { 'content-type': 'Audio/MPEG; foo=bar' } }),
    });
    expect((await fine.synthesize('Hello.')).bytes).toEqual(MP3);
  });

  it('stops reading an answer that grows past the cap, without buffering the rest', async () => {
    const chunk = new Uint8Array(256 * 1024).fill(0xff);
    let sent = 0;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          sent += chunk.byteLength;
          controller.enqueue(chunk);
        },
        cancel() {
          cancelled = true;
        },
      },
      { highWaterMark: 0 },
    );
    const voice = new ElevenLabsVoice({
      apiKey: KEY,
      voiceId: VOICE,
      modelId: null,
      fetch: async () =>
        new Response(body, { status: 200, headers: { 'content-type': 'audio/mpeg' } }),
    });
    const error = await voice.synthesize('Hello.').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(VoiceUnavailableError);
    expect((error as Error).message).toContain('too-large');
    expect(cancelled).toBe(true);
    // An endless body: it stopped one chunk past the cap.
    expect(sent).toBeLessThanOrEqual(MAX_SPEECH_AUDIO_BYTES + chunk.byteLength);
  });

  it('an answer exactly at the cap is kept', async () => {
    const voice = new ElevenLabsVoice({
      apiKey: KEY,
      voiceId: VOICE,
      modelId: null,
      fetch: async () =>
        new Response(new Uint8Array(MAX_SPEECH_AUDIO_BYTES), {
          status: 200,
          headers: { 'content-type': 'audio/mpeg' },
        }),
    });
    expect((await voice.synthesize('Hello.')).bytes.byteLength).toBe(MAX_SPEECH_AUDIO_BYTES);
  });

  it('refuses a declared Content-Length over the cap before reading a byte', async () => {
    let pulled = 0;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pulled += 1;
          controller.enqueue(MP3);
        },
        cancel() {
          cancelled = true;
        },
      },
      { highWaterMark: 0 },
    );
    const voice = new ElevenLabsVoice({
      apiKey: KEY,
      voiceId: VOICE,
      modelId: null,
      fetch: async () =>
        new Response(body, {
          status: 200,
          headers: {
            'content-type': 'audio/mpeg',
            'content-length': String(MAX_SPEECH_AUDIO_BYTES + 1),
          },
        }),
    });
    const error = await voice.synthesize('Hello.').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(VoiceUnavailableError);
    expect((error as Error).message).toContain('too-large');
    expect(pulled).toBe(0);
    expect(cancelled).toBe(true);
  });

  it('the cap fits the longest text Read aloud sends, with room for slow speech', () => {
    // 128 kbit/s is 16,000 bytes a second; 1,500 characters at a slow 10 a second is 150 s.
    expect(MAX_SPEECH_AUDIO_BYTES).toBeGreaterThanOrEqual((MAX_SPEECH_CHARS / 10) * 16_000);
    expect(MAX_SPEECH_AUDIO_BYTES).toBeLessThanOrEqual(8 * 1024 * 1024);
  });

  it('never needs a key or a voice it wasn’t given', () => {
    expect(
      () => new ElevenLabsVoice({ apiKey: '', voiceId: VOICE, modelId: null, fetch: vi.fn() }),
    ).toThrow();
    expect(
      () => new ElevenLabsVoice({ apiKey: KEY, voiceId: '', modelId: null, fetch: vi.fn() }),
    ).toThrow();
  });
});
