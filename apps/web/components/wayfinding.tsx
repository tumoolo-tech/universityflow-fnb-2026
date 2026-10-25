'use client';

import type { CampusTourArtifact } from '@universityflow/agent';
import { campus as campusCopy } from '@universityflow/content';
import {
  type CampusPlaceView,
  placeSpeech,
  type Speech,
  type SpeechItem,
} from '@universityflow/ui';
import { useEffect, useId, useRef, useState } from 'react';
import { MapsButton } from '@/components/place-links';
import { useReadAloud } from '@/components/read-aloud';
import { Button } from '@/components/ui';
import { voiceSpeech } from '@/lib/client/speech';

/**
 * Finding the way (planning.md §11, Phase 5e): Walk there, See it and the step-free route, which
 * hand only the destination to Google Maps in a new tab (the maps app finds "here"; we never see
 * it), the arrival note, and Read aloud. Every link was built by code from the published record
 * (packages/agent), never by the AI. Nothing here is logged; the only thing sent to our server is
 * a place's id, when the learner presses Read aloud. Nothing animates or plays by itself.
 */

const t = campusCopy;

/** A place's walking links, its step-free entrance and arrival note, and Read aloud. */
export function PlaceWayfinding({ place }: { place: CampusPlaceView }) {
  const hintId = useId();
  const stepFreeHintId = useId();
  return (
    <>
      {place.accessibleEntrance ? (
        <p className="text-sm">
          {t.accessibleEntrance}: {place.accessibleEntrance}
        </p>
      ) : null}
      {place.arrivalNote ? (
        <p className="text-sm">
          {t.arrival}: {place.arrivalNote}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        {place.walkUrl ? (
          <>
            <span id={hintId} className="sr-only">
              {t.walkHint}
            </span>
            <MapsButton
              href={place.walkUrl}
              label={t.walkThere}
              place={place.name}
              hintId={hintId}
            />
          </>
        ) : null}
        {place.accessibleWalkUrl ? (
          <>
            <span id={stepFreeHintId} className="sr-only">
              {t.stepFreeHint}
            </span>
            <MapsButton
              href={place.accessibleWalkUrl}
              label={t.stepFree}
              place={place.name}
              hintId={stepFreeHintId}
            />
          </>
        ) : null}
        {place.streetViewUrl ? (
          <MapsButton href={place.streetViewUrl} label={t.seeIt} place={place.name} />
        ) : null}
        <ReadAloud item={{ placeId: place.id, text: placeSpeech(place) }} place={place.name} />
      </div>
    </>
  );
}

/**
 * Read aloud and Stop: one button, so focus stays on it. In the ElevenLabs voice only (owner's
 * choice of 2026-10-22), so shown only where the page says the server has it: otherwise no button,
 * never the browser's own voice. Only the place's id goes to our server. No auto-play, no timeout;
 * a status line says so when the audio can't play.
 */
export function ReadAloud({ item, place }: { item: SpeechItem; place: string }) {
  const available = useReadAloud();
  const speech = useRef<Speech | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => () => speech.current?.stop(), []);
  if (!available) return null;
  const label = speaking ? t.stopReading : t.readAloud;
  return (
    <>
      <Button
        variant="secondary"
        aria-label={t.forPlace(label, place)}
        onClick={() => {
          if (speaking) {
            speech.current?.stop();
            return;
          }
          speech.current ??= voiceSpeech();
          setFailed(false);
          setSpeaking(true);
          speech.current.speak(item, (outcome) => {
            setSpeaking(false);
            setFailed(outcome === 'failed');
          });
        }}
      >
        {label}
      </Button>
      <span role="status" className="text-sm">
        {failed ? t.readAloudFailed : ''}
      </span>
    </>
  );
}

/**
 * Getting around with a disability (5e-4): the plain statement that the app never replaces a cane,
 * a guide dog or mobility training, and who to ask: the disability unit the tour lists, by name.
 */
export function MobilityNote({ tour }: { tour: CampusTourArtifact }) {
  const titleId = useId();
  const unit = tour.campuses
    .flatMap((c) => c.needs.flatMap((n) => n.places))
    .find((p) => p.kind === 'disability-unit');
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-1">
      <h3 id={titleId} className="font-bold">
        {t.mobility.title}
      </h3>
      <p>{t.mobility.statement}</p>
      <p className="text-sm">
        {unit ? t.mobility.askUnit(unit.name) : t.mobility.askUnitUnchecked}
      </p>
    </section>
  );
}
