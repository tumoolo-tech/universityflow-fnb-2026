import { expect, it } from 'vitest';
import { type Voice, VoiceUnavailableError } from '../lib/server/voice';

/**
 * The contract every Read aloud voice meets: the fake and ElevenLabs (D8). Each voice's tests run
 * it, so the fake can't promise what ElevenLabs doesn't do. ElevenLabs runs it against a stand-in
 * for its HTTP API: no test ever calls ElevenLabs.
 */
export interface VoiceHarness {
  make(): Voice;
  /** The provider refuses or can't be reached from now on. */
  breakIt(): void;
  /** How many times the provider was asked to speak. */
  calls(): number;
}

/** Synthetic public text, as `placeSpeech` builds it (hard rule 4: nothing about a learner). */
const TEXT = 'Test Clinic, Clinic. Where: Ground floor, Test Building.';

export function voiceContract(make: () => VoiceHarness) {
  it('turns text into MP3 audio, and says which voice and model it is', async () => {
    const harness = make();
    const voice = harness.make();
    const audio = await voice.synthesize(TEXT);
    expect(audio.mimeType).toBe('audio/mpeg');
    expect(audio.bytes.byteLength).toBeGreaterThan(0);
    expect(voice.voiceId).toMatch(/\S/);
    expect(voice.modelId).toMatch(/\S/);
    expect(harness.calls()).toBe(1);
  });

  it('refuses empty text without asking the provider', async () => {
    const harness = make();
    await expect(harness.make().synthesize('   ')).rejects.toThrow(RangeError);
    expect(harness.calls()).toBe(0);
  });

  it('a provider failure is a VoiceUnavailableError that carries neither the text nor a key', async () => {
    const harness = make();
    const voice = harness.make();
    harness.breakIt();
    const error = await voice.synthesize(TEXT).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(VoiceUnavailableError);
    expect(String((error as Error).message)).not.toContain('Test Clinic');
    expect(String((error as Error).message)).not.toMatch(/key/i);
  });
}
