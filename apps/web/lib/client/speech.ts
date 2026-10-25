import { type Speech, type SpeechOutcome, speechPath } from '@universityflow/ui';

/** The parts of the browser's audio player Read aloud uses. */
type Player = Pick<HTMLAudioElement, 'play' | 'pause' | 'removeAttribute' | 'addEventListener'>;

/** What the voice version needs from the browser: its audio player, or a stand-in in tests. */
interface AudioScope {
  readonly Audio?: new (src: string) => Player;
}

/**
 * Read aloud on the web (planning.md §11, Phase 5e-4; owner's choice of 2026-10-22): the
 * ElevenLabs voice, played by the browser's own audio player from our server's
 * /api/speech/<place id>. Only the place's id leaves the page; the server builds the words from
 * the catalogue and holds the key. The browser's `speechSynthesis` is not used: with no voice on
 * the server there is no Read aloud button at all (components/read-aloud.tsx).
 */
export function voiceSpeech(
  scope: AudioScope = typeof window === 'undefined' ? {} : (window as AudioScope),
): Speech {
  let current: Player | undefined;
  let pending: ((outcome: SpeechOutcome) => void) | undefined;
  const end = (outcome: SpeechOutcome) => {
    const done = pending;
    pending = undefined;
    const player = current;
    current = undefined;
    if (player) {
      player.pause();
      player.removeAttribute('src');
    }
    done?.(outcome);
  };
  return {
    version: 'voice',
    speak(item, onDone) {
      end('done');
      pending = onDone ?? (() => undefined);
      const Audio = scope.Audio;
      if (!Audio) {
        end('failed');
        return;
      }
      const player = new Audio(speechPath(item.placeId));
      current = player;
      // A replaced player can report its end late: only the current one ends the speaking.
      const finished = (outcome: SpeechOutcome) => () => {
        if (current === player) end(outcome);
      };
      player.addEventListener('ended', finished('done'));
      player.addEventListener('error', finished('failed'));
      player.play().catch(finished('failed'));
    },
    stop() {
      end('done');
    },
  };
}
