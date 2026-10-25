import { en } from '@universityflow/content/app';
import {
  type CampusPlaceView,
  type CampusTourArtifact,
  placeSpeech,
  type Speech,
  type SpeechItem,
} from '@universityflow/ui';
import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { pickSpeech, useReadAloudAvailable } from '../lib/speech';
import { theme } from '../lib/theme';
import { announce, Body, Button, SectionTitle } from './ui';

/**
 * Finding the way in the app (planning.md §11, Phase 5e): Walk there, See it and the step-free
 * route, which hand only the destination to the phone's maps app (it finds "here"; we never see
 * it), the arrival note, and Read aloud. On an iPhone, Apple's and Google's walks are both offered
 * (owner's choice, 2026-10-19); on Android, Google's; Street View is Google's on both (Apple's Look
 * Around has no South African coverage). Every link was built by code from the published record.
 * Nothing is logged; the only thing sent to our server is a place's id, when the learner presses
 * Read aloud (and, once a session, whether Read aloud is offered). Nothing animates or plays by
 * itself.
 */

const t = en.campus;
const open = (url: string) => void Linking.openURL(url).catch(() => undefined);

/** A maps link that looks like a button, named for its place, with a hint (WCAG 2.4.4, 2.5.3). */
function MapsButton({
  url,
  label,
  place,
  hint,
}: {
  url: string;
  label: string;
  place: string;
  hint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={t.forPlace(label, place)}
      accessibilityHint={hint}
      onPress={() => open(url)}
      style={({ pressed }) => [styles.maps, pressed ? styles.pressed : null]}
    >
      <Text style={[theme.text.label, { color: theme.on('sunkBrand').color }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * The walking links for one destination: Apple's and Google's on an iPhone (each saying which),
 * Google's alone elsewhere, or when an older card has no Apple link.
 */
function WalkButtons({
  google,
  apple,
  label,
  place,
  hint,
}: {
  google: string | null | undefined;
  apple: string | null | undefined;
  label: { plain: string; apple: string; google: string };
  place: string;
  hint: string;
}) {
  if (Platform.OS === 'ios' && apple) {
    return (
      <>
        <MapsButton url={apple} label={label.apple} place={place} hint={hint} />
        {google ? <MapsButton url={google} label={label.google} place={place} hint={hint} /> : null}
      </>
    );
  }
  return google ? <MapsButton url={google} label={label.plain} place={place} hint={hint} /> : null;
}

const WALK = { plain: t.walkThere, apple: t.walkThereIn.apple, google: t.walkThereIn.google };
const STEP_FREE = { plain: t.stepFree, apple: t.stepFreeIn.apple, google: t.stepFreeIn.google };

/** A place's walking links, its step-free entrance and arrival note, and Read aloud. */
export function PlaceWayfinding({ place }: { place: CampusPlaceView }) {
  return (
    <>
      {place.accessibleEntrance ? (
        <Body pair="sunk" small>{`${t.accessibleEntrance}: ${place.accessibleEntrance}`}</Body>
      ) : null}
      {place.arrivalNote ? (
        <Body pair="sunk" small>{`${t.arrival}: ${place.arrivalNote}`}</Body>
      ) : null}
      <View style={styles.row}>
        <WalkButtons
          google={place.walkUrl}
          apple={place.appleWalkUrl}
          label={WALK}
          place={place.name}
          hint={t.walkHint}
        />
        <WalkButtons
          google={place.accessibleWalkUrl}
          apple={place.accessibleAppleWalkUrl}
          label={STEP_FREE}
          place={place.name}
          hint={t.stepFreeHint}
        />
        {place.streetViewUrl ? (
          <MapsButton
            url={place.streetViewUrl}
            label={t.seeIt}
            place={place.name}
            hint={t.seeItHint}
          />
        ) : null}
      </View>
      <ReadAloud item={{ placeId: place.id, text: placeSpeech(place) }} place={place.name} />
    </>
  );
}

/**
 * Read aloud, which becomes Stop while it speaks: through VoiceOver or TalkBack when on, else the
 * ElevenLabs voice, chosen at the press (owner's choice of 2026-10-22). Shown only when the server
 * offers the voice: never the phone's own voice instead. No auto-play, no timeout; a line says so
 * when the audio can't be had.
 */
function ReadAloud({ item, place }: { item: SpeechItem; place: string }) {
  const available = useReadAloudAvailable();
  const [speaking, setSpeaking] = useState(false);
  const [failed, setFailed] = useState(false);
  const speech = useRef<Speech | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      speech.current?.stop();
    };
  }, []);
  if (!available) return null;
  const label = speaking ? t.stopReading : t.readAloud;
  return (
    <>
      <Button
        variant="secondary"
        label={label}
        accessibilityLabel={t.forPlace(label, place)}
        {...(speaking ? {} : { hint: t.readAloudHint })}
        onPress={() => {
          if (speaking) {
            speech.current?.stop();
            return;
          }
          setFailed(false);
          void pickSpeech().then((chosen) => {
            if (!mounted.current) return;
            speech.current = chosen;
            setSpeaking(true);
            chosen.speak(item, (outcome) => {
              if (!mounted.current) return;
              setSpeaking(false);
              setFailed(outcome === 'failed');
              // Shown and said: a screen reader user hears it too (A3-02).
              if (outcome === 'failed') announce(t.readAloudFailed);
            });
          });
        }}
      />
      {failed ? (
        <Body pair="sunk" small>
          {t.readAloudFailed}
        </Body>
      ) : null}
    </>
  );
}

/** Walk there on a crisis card's campus line. */
export function CrisisWalk({
  walkUrl,
  appleWalkUrl,
  place,
}: {
  walkUrl: string | null | undefined;
  appleWalkUrl: string | null | undefined;
  place: string;
}) {
  return (
    <View style={styles.row}>
      <WalkButtons
        google={walkUrl}
        apple={appleWalkUrl}
        label={WALK}
        place={place}
        hint={t.walkHint}
      />
    </View>
  );
}

/**
 * Getting around with a disability (5e-4): the app never replaces a cane, a guide dog or mobility
 * training; and who to ask, the disability unit the tour lists, by name.
 */
export function MobilityNote({ tour }: { tour: CampusTourArtifact }) {
  const unit = tour.campuses
    .flatMap((c) => c.needs.flatMap((n) => n.places))
    .find((p) => p.kind === 'disability-unit');
  return (
    <View style={styles.section}>
      <SectionTitle>{t.mobility.title}</SectionTitle>
      <Body pair="card">{t.mobility.statement}</Body>
      <Body pair="card" small>
        {unit ? t.mobility.askUnit(unit.name) : t.mobility.askUnitUnchecked}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: theme.space['2'] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space['2'] },
  maps: {
    minHeight: theme.target,
    minWidth: theme.target,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.space['4'],
    paddingVertical: theme.space['2'],
    borderRadius: theme.radius.md,
    borderWidth: theme.border.thick,
    borderColor: theme.color.brand,
    backgroundColor: theme.color.surfaceSunk,
  },
  pressed: { backgroundColor: theme.color.surface },
});
