import { en } from '@universityflow/content/app';
import type { CampusPlaceView } from './artifacts';

/**
 * Read aloud (planning.md §11, Phase 5e-4): one interface, a version per platform (D8), each in
 * the app that has it.
 *
 * Owner's choice of 2026-10-22, replacing that of 2026-10-19 ("the screen reader and the phone's
 * own voice only, never a cloud voice"): Read aloud speaks **only in an ElevenLabs voice**. The
 * browser's `speechSynthesis` and the phone's `expo-speech` are gone; with no ElevenLabs key on
 * the server there is no Read aloud button at all, never a fallback voice. The learner's own screen
 * reader stays (it is their assistive technology, not a default voice): the app speaks through it
 * when it's on, a one-line choice in apps/native/lib/speech.ts the owner can turn off.
 *
 * - `voice`: the ElevenLabs voice. The browser or the phone asks our server for a place's audio
 *   by the place's id only (`speechPath`); the server builds the text from the catalogue and holds
 *   the key. Nothing about the learner is ever sent (hard rule 4). apps/web and apps/native.
 * - `screen-reader`: VoiceOver or TalkBack is on, so speak the text through it
 *   (`announceForAccessibility`), in the learner's own voice and speed. apps/native only.
 * - `fakeSpeech` (below) for tests: records what was spoken and by which version.
 *
 * Types and plain functions only: no DOM and no React Native here (hard rule 11).
 */

export type SpeechVersion = 'screen-reader' | 'voice';

/**
 * What to read: a published place. The voice sends only `placeId` to our server; the screen
 * reader speaks `text` on the device. Both are the same words (`placeSpeech`).
 */
export interface SpeechItem {
  readonly placeId: string;
  readonly text: string;
}

/** How speaking ended: finished or stopped (`done`), or it couldn't play (`failed`). */
export type SpeechOutcome = 'done' | 'failed';

export interface Speech {
  readonly version: SpeechVersion;
  /**
   * Says `item`, replacing anything still being said. `onDone` runs once, when it finishes, is
   * stopped or fails (at once for a screen reader, which reads it in its own time).
   */
  speak(item: SpeechItem, onDone?: (outcome: SpeechOutcome) => void): void;
  /** Stops speaking now. Safe when nothing is being said. */
  stop(): void;
}

export interface SpeechVersions {
  /** Null: the screen-reader route is turned off, so the voice is always used. */
  readonly screenReader: Speech | null;
  readonly voice: Speech;
}

/**
 * The version to speak with, chosen when the learner presses Read aloud (a screen reader can be
 * turned on or off at any time): theirs when it's on, otherwise the ElevenLabs voice. When the
 * check fails, the voice, which works with or without a screen reader.
 */
export async function chooseSpeech(
  screenReaderOn: () => Promise<boolean>,
  versions: SpeechVersions,
): Promise<Speech> {
  if (!versions.screenReader) return versions.voice;
  let on = false;
  try {
    on = await screenReaderOn();
  } catch {
    on = false;
  }
  return on ? versions.screenReader : versions.voice;
}

/** Whether Read aloud is offered: the server has an ElevenLabs voice (GET `SPEECH_STATUS_PATH`). */
export interface SpeechStatus {
  readonly available: boolean;
}

export const SPEECH_STATUS_PATH = '/api/speech';

/** Where a place's audio comes from: its id, never its words. */
export function speechPath(placeId: string): string {
  return `${SPEECH_STATUS_PATH}/${encodeURIComponent(placeId)}`;
}

/** One thing a fake said. */
export interface SpeechRecord extends SpeechItem {
  readonly version: SpeechVersion;
}

export interface FakeSpeech extends Speech {
  /** What this fake said, in order (shared when given a log). */
  readonly spoken: SpeechRecord[];
  readonly speaking: boolean;
  readonly stops: number;
  /** Finishes what is being said, as the engine would. */
  finish(): void;
  /** What is being said couldn't play (the network, the server). */
  fail(): void;
}

/** A Speech for tests: says nothing aloud, records everything. */
export function fakeSpeech(version: SpeechVersion, log: SpeechRecord[] = []): FakeSpeech {
  let pending: ((outcome: SpeechOutcome) => void) | undefined;
  let stops = 0;
  const end = (outcome: SpeechOutcome) => {
    const done = pending;
    pending = undefined;
    done?.(outcome);
  };
  return {
    version,
    spoken: log,
    get speaking() {
      return pending !== undefined;
    },
    get stops() {
      return stops;
    },
    speak(item, onDone) {
      end('done');
      log.push({ placeId: item.placeId, text: item.text, version });
      pending = onDone ?? (() => undefined);
    },
    stop() {
      stops += 1;
      end('done');
    },
    finish: () => end('done'),
    fail: () => end('failed'),
  };
}

/**
 * What Read aloud says for a place: its name and kind, where, hours, the step-free entrance, the
 * arrival note and how to get there, from content's templates (hard rule 8) filled with the
 * place's record. Everything said is also on the card as text. Unpublished parts are left out.
 * The server builds the voice's text with this too, from the catalogue, never from the request.
 */
export function placeSpeech(place: CampusPlaceView): string {
  const s = en.campus.speech;
  const parts = [s.place(place.name, en.campus.kinds[place.kind])];
  if (place.where) parts.push(s.where(place.where));
  if (place.hours) parts.push(s.hours(place.hours));
  if (place.accessibleEntrance) parts.push(s.entrance(place.accessibleEntrance));
  if (place.arrivalNote) parts.push(s.arrival(place.arrivalNote));
  if (place.walkUrl) {
    parts.push(s.canWalk);
    if (place.accessibleWalkUrl) parts.push(s.stepFreeRoute);
  } else if (!place.mapsUrl) {
    // No location at all. (A card saved before Walk there still has its maps link: then nothing.)
    parts.push(s.noLocation);
  }
  return parts.join(' ');
}
