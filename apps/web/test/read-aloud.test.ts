import { campusTour } from '@universityflow/agent';
import {
  CAMPUS_TEST_TODAY,
  campusTestRecords,
  campusTestView,
} from '@universityflow/agent/testing';
import { catalogueViewOf } from '@universityflow/catalogue';
import { MemoryFileStore } from '@universityflow/documents';
import { placeSpeech } from '@universityflow/ui';
import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '../lib/server/http';
import { MAX_SPEECH_CHARS, placeAudio, placeText, speechCacheKey } from '../lib/server/read-aloud';
import { ElevenLabsVoice, FakeVoice, MAX_SPEECH_AUDIO_BYTES } from '../lib/server/voice';

/**
 * What Read aloud sends to the voice (owner's choice of 2026-10-22): a published place's text,
 * built here from the catalogue by its id (hard rule 4: never anything about a learner, and never
 * text a request brings), capped in length, and cached per voice, model and text so the same place
 * is never paid for twice. Synthetic records only.
 */

const VIEW = campusTestView(true);
const PLACE = 'wits-test-security';

function placeView(id: string) {
  const tour = campusTour(VIEW, 'wits', 'chosen');
  return tour?.campuses.flatMap((c) => c.needs.flatMap((n) => n.places)).find((p) => p.id === id);
}

describe('the text of a place, from the catalogue only', () => {
  it('is exactly what the card’s Read aloud says, built from the published record', () => {
    const view = placeView(PLACE);
    if (!view) throw new Error('fixture');
    expect(placeText(VIEW, PLACE)).toBe(placeSpeech(view));
  });

  it('is null for a place the learner may not see or that doesn’t exist', () => {
    expect(placeText(VIEW, 'wits-test-nowhere')).toBeNull();
    // A draft place, outside preview.
    const verifiedOnly = campusTestView(false);
    const draft = VIEW.places.find((p) => !verifiedOnly.places.some((q) => q.id === p.id));
    if (draft) expect(placeText(verifiedOnly, draft.id)).toBeNull();
    // Not a place at all: a university, a programme.
    expect(placeText(VIEW, 'wits')).toBeNull();
    expect(placeText(VIEW, 'toString')).toBeNull();
  });
});

describe('the audio of a place', () => {
  it('asks the voice once, then serves the cached audio: the same place is never paid for twice', async () => {
    const voice = new FakeVoice();
    const files = new MemoryFileStore();
    const first = await placeAudio({ voice, files, view: VIEW, placeId: PLACE });
    const again = await placeAudio({ voice, files, view: VIEW, placeId: PLACE });
    expect(first.mimeType).toBe('audio/mpeg');
    expect(again).toEqual(first);
    expect(voice.spoken).toEqual([placeText(VIEW, PLACE)]);
    // Shared by every learner: the key is the voice, the model and the words, nothing else.
    const key = speechCacheKey(voice, placeText(VIEW, PLACE) ?? '');
    expect(key).toMatch(/^speech-[0-9a-f]{64}$/);
    expect(await files.get(key)).toEqual(first);
  });

  it('a new voice, model or wording is new audio', () => {
    const a = new FakeVoice();
    const b = Object.assign(new FakeVoice(), { voiceId: 'other-voice' });
    const c = Object.assign(new FakeVoice(), { modelId: 'other-model' });
    const keys = new Set([
      speechCacheKey(a, 'One.'),
      speechCacheKey(b, 'One.'),
      speechCacheKey(c, 'One.'),
      speechCacheKey(a, 'Two.'),
    ]);
    expect(keys.size).toBe(4);
  });

  it('refuses a place whose text is longer than the cap, without asking the voice', async () => {
    const records = campusTestRecords();
    const long = {
      ...records,
      places: records.places.map((p) =>
        p.id === PLACE ? { ...p, arrivalNote: 'A long note. '.repeat(200) } : p,
      ),
    };
    const view = catalogueViewOf(long, CAMPUS_TEST_TODAY, { includeDrafts: true });
    expect((placeText(view, PLACE) ?? '').length).toBeGreaterThan(MAX_SPEECH_CHARS);
    const voice = new FakeVoice();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const error = await placeAudio({
        voice,
        files: new MemoryFileStore(),
        view,
        placeId: PLACE,
      }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HttpError);
      expect(error).toMatchObject({ status: 422, code: 'invalid', detail: 'too-long' });
      expect(voice.spoken).toEqual([]);
      // The log names the place by id only.
      expect(warn.mock.calls.map((c) => String(c[0])).join('\n')).not.toContain('A long note');
    } finally {
      warn.mockRestore();
    }
  });

  it('an unknown place is not found, and the voice is never asked', async () => {
    const voice = new FakeVoice();
    const error = await placeAudio({
      voice,
      files: new MemoryFileStore(),
      view: VIEW,
      placeId: 'wits-test-nowhere',
    }).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 404, code: 'not-found' });
    expect(voice.spoken).toEqual([]);
  });

  // A5-14: learners pressing Read aloud together on an uncached place buy the words once.
  it('concurrent misses for one place share a single call to the voice', async () => {
    const voice = new FakeVoice();
    const files = new MemoryFileStore();
    const all = await Promise.all(
      Array.from({ length: 5 }, () => placeAudio({ voice, files, view: VIEW, placeId: PLACE })),
    );
    expect(voice.spoken).toHaveLength(1);
    for (const audio of all) expect(audio).toEqual(all[0]);
    // Settled: the next miss (the cache emptied) asks the voice again rather than reusing it.
    await files.delete(speechCacheKey(voice, placeText(VIEW, PLACE) ?? ''));
    await placeAudio({ voice, files, view: VIEW, placeId: PLACE });
    expect(voice.spoken).toHaveLength(2);
  });

  it('a shared failure is 503 for every waiter, and isn’t remembered', async () => {
    const broken = new FakeVoice();
    broken.breakIt();
    const files = new MemoryFileStore();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const results = await Promise.all(
        Array.from({ length: 3 }, () =>
          placeAudio({ voice: broken, files, view: VIEW, placeId: PLACE }).catch((e: unknown) => e),
        ),
      );
      expect(broken.spoken).toHaveLength(1);
      for (const r of results) expect(r).toMatchObject({ status: 503, code: 'speech-unavailable' });
    } finally {
      error.mockRestore();
    }
    // Same voice, model and words (so the same key): the next request tries again and succeeds.
    const working = new FakeVoice();
    const audio = await placeAudio({ voice: working, files, view: VIEW, placeId: PLACE });
    expect(audio.mimeType).toBe('audio/mpeg');
    expect(working.spoken).toHaveLength(1);
  });

  it('an oversized or non-audio answer from ElevenLabs is 503 and never cached', async () => {
    const text = placeText(VIEW, PLACE) ?? '';
    const answers = [
      () => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }),
      () =>
        new Response(new Uint8Array(MAX_SPEECH_AUDIO_BYTES + 1), {
          status: 200,
          headers: { 'content-type': 'audio/mpeg' },
        }),
    ];
    for (const answer of answers) {
      const voice = new ElevenLabsVoice({
        apiKey: 'test-elevenlabs-key-not-real',
        voiceId: 'TestVoice0001',
        modelId: null,
        fetch: async () => answer(),
      });
      const files = new MemoryFileStore();
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        const result = await placeAudio({ voice, files, view: VIEW, placeId: PLACE }).catch(
          (e: unknown) => e,
        );
        expect(result).toMatchObject({ status: 503, code: 'speech-unavailable' });
        const lines = error.mock.calls.map((c) => c.map(String).join(' ')).join('\n');
        expect(lines).toContain(PLACE);
        expect(lines).not.toContain(text.slice(0, 12));
        expect(await files.get(speechCacheKey(voice, text))).toBeNull();
      } finally {
        error.mockRestore();
      }
    }
  });

  it('a voice failure is 503 speech-unavailable, logged by place id only, and nothing is cached', async () => {
    const voice = new FakeVoice();
    voice.breakIt();
    const files = new MemoryFileStore();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const result = await placeAudio({ voice, files, view: VIEW, placeId: PLACE }).catch(
        (e: unknown) => e,
      );
      expect(result).toMatchObject({ status: 503, code: 'speech-unavailable' });
      const lines = error.mock.calls.map((c) => c.map(String).join(' ')).join('\n');
      expect(lines).toContain(PLACE);
      expect(lines).not.toContain('Test security');
      expect(await files.get(speechCacheKey(voice, placeText(VIEW, PLACE) ?? ''))).toBeNull();
    } finally {
      error.mockRestore();
    }
  });
});
