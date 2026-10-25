import {
  chooseSpeech,
  SPEECH_STATUS_PATH,
  type Speech,
  type SpeechOutcome,
  type SpeechStatus,
  speechPath,
} from '@universityflow/ui';
import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { api, apiBytes } from './api';
import { onSessionChange } from './session';

/**
 * Read aloud in the app (planning.md §11, Phase 5e-4). Owner's choice of 2026-10-22, replacing
 * that of 2026-10-19: the ElevenLabs voice only. The phone's own voice (expo-speech) is gone; with
 * no voice on the server there is no Read aloud button at all. Picked each time the learner
 * presses Read aloud.
 *
 * The voice: the app asks the web app's signed-in route for a place's audio by the place's id
 * (with its session token, like every other call), keeps it in the phone's cache folder and plays
 * it with expo-audio. The ElevenLabs key never reaches the app; the server builds the words.
 */

/**
 * The owner's one-line choice (2026-10-22): when VoiceOver or TalkBack is on, Read aloud speaks
 * through it, in the learner's own voice and speed. It is the learner's own assistive technology,
 * not a default voice. Set this to `false` to use the ElevenLabs voice for everyone.
 */
export const SPEAK_THROUGH_SCREEN_READER = true;

/**
 * VoiceOver or TalkBack is on: speak through it, in the learner's own voice and speed. It reads in
 * its own time and the learner controls it, so this is done at once and can't be stopped by us.
 */
export const screenReaderSpeech: Speech = {
  version: 'screen-reader',
  speak(item, onDone) {
    AccessibilityInfo.announceForAccessibility(item.text);
    onDone?.('done');
  },
  stop() {
    // The screen reader's own gestures stop it.
  },
};

/** The cached audio file for a place: its id, made safe for a file name. */
function audioFile(placeId: string): File {
  return new File(Paths.cache, `read-aloud-${placeId.replace(/[^a-z0-9-]/g, '-')}.mp3`);
}

/** The ElevenLabs voice: the place's audio from our server, played on the phone. */
export function voiceSpeech(): Speech {
  let call = 0;
  let player: AudioPlayer | undefined;
  let pending: ((outcome: SpeechOutcome) => void) | undefined;
  const end = (outcome: SpeechOutcome) => {
    const done = pending;
    pending = undefined;
    const playing = player;
    player = undefined;
    playing?.remove();
    done?.(outcome);
  };
  return {
    version: 'voice',
    speak(item, onDone) {
      end('done');
      call += 1;
      const mine = call;
      pending = onDone ?? (() => undefined);
      void (async () => {
        try {
          const bytes = await apiBytes(speechPath(item.placeId));
          if (mine !== call) return;
          const file = audioFile(item.placeId);
          if (!file.exists) file.create();
          file.write(bytes);
          // A press of Read aloud is a choice to hear it, so it plays with the ringer off too.
          await setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
          if (mine !== call) return;
          const started = createAudioPlayer(file.uri);
          player = started;
          // A replaced player can report its end late: only the current one ends the speaking.
          started.addListener('playbackStatusUpdate', (status) => {
            if (mine === call && status.didJustFinish) end('done');
          });
          started.play();
        } catch {
          if (mine === call) end('failed');
        }
      })();
    },
    stop() {
      call += 1;
      end('done');
    },
  };
}

const voice = voiceSpeech();

/** The version to speak with now: the screen reader when it's on (and kept), else the voice. */
export function pickSpeech(): Promise<Speech> {
  return chooseSpeech(() => AccessibilityInfo.isScreenReaderEnabled(), {
    screenReader: SPEAK_THROUGH_SCREEN_READER ? screenReaderSpeech : null,
    voice,
  });
}

/**
 * Whether the server offers Read aloud, asked once per session (GET /api/speech carries nothing).
 * Unknown (offline, an old server) counts as no, and is asked again next time.
 */
let status: Promise<boolean> | null = null;

function speechAvailable(): Promise<boolean> {
  status ??= api<SpeechStatus>(SPEECH_STATUS_PATH)
    .then((answer) => answer.available === true)
    .catch(() => {
      status = null;
      return false;
    });
  return status;
}

/** Forgets the answer: a new session asks again. Tests call it between tests. */
export function resetSpeechStatus(): void {
  status = null;
}

onSessionChange(() => resetSpeechStatus());

/** True once the server says Read aloud is offered; false until then, and when it isn't. */
export function useReadAloudAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let live = true;
    void speechAvailable().then((answer) => {
      if (live) setAvailable(answer);
    });
    return () => {
      live = false;
    };
  }, []);
  return available;
}
