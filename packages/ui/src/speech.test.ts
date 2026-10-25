import { en } from '@universityflow/content';
import { describe, expect, it } from 'vitest';
import {
  type CampusPlaceView,
  type CampusSafetyLine,
  chooseSpeech,
  fakeSpeech,
  placeSpeech,
  SPEECH_STATUS_PATH,
  type SpeechItem,
  type SpeechRecord,
  type SpeechVersion,
  speechPath,
} from './index';

/** Synthetic (hard rule 4): a made-up place on a test page. */
const PLACE = {
  id: 'wits-test-clinic',
  kind: 'clinic',
  name: 'Test Clinic',
  where: 'Ground floor, Test Building',
  hours: 'Mon–Fri 08:00–16:00',
  phone: '011 000 0000',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=-26.19%2C28.03',
  appleMapsUrl: null,
  walkUrl: 'https://www.google.com/maps/dir/?api=1&destination=-26.19%2C28.03',
  appleWalkUrl: 'https://maps.apple.com/directions?destination=-26.19%2C28.03&mode=walking',
  streetViewUrl: 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=-26.19%2C28.03',
  accessibleWalkUrl: 'https://www.google.com/maps/dir/?api=1&destination=-26.1901%2C28.0302',
  accessibleAppleWalkUrl: null,
  accessibleEntrance: 'East door, by the ramp',
  arrivalNote: 'The ramp is to the left of the main doors.',
  sourceUrl: 'https://www.wits.ac.za/test-page/',
  draft: false,
} satisfies CampusPlaceView;

describe('the walking links on a place and a crisis line (5e-1)', () => {
  it('survive a saved chat message, and an old card without them still type-checks', () => {
    expect(JSON.parse(JSON.stringify(PLACE))).toEqual(PLACE);
    const { walkUrl: _w, appleWalkUrl: _a, streetViewUrl: _s, ...old } = PLACE;
    const before: CampusPlaceView = old;
    expect(before.walkUrl).toBeUndefined();
    const line = {
      id: PLACE.id,
      kind: 'clinic',
      name: PLACE.name,
      campusName: 'Test Campus',
      where: null,
      hours: null,
      phone: PLACE.phone,
      walkUrl: PLACE.walkUrl,
      appleWalkUrl: PLACE.appleWalkUrl,
    } satisfies CampusSafetyLine;
    expect(JSON.parse(JSON.stringify(line))).toEqual(line);
  });
});

describe('what "Read aloud" says (5e-4)', () => {
  it('the name, where, hours, the step-free entrance, the arrival note and how to get there', () => {
    const s = en.campus.speech;
    expect(placeSpeech(PLACE)).toBe(
      [
        s.place('Test Clinic', en.campus.kinds.clinic),
        s.where('Ground floor, Test Building'),
        s.hours('Mon–Fri 08:00–16:00'),
        s.entrance('East door, by the ramp'),
        s.arrival('The ramp is to the left of the main doors.'),
        s.canWalk,
        s.stepFreeRoute,
      ].join(' '),
    );
  });

  it('leaves out what isn’t published, and says when there are no directions', () => {
    const bare: CampusPlaceView = {
      ...PLACE,
      where: null,
      hours: null,
      mapsUrl: null,
      walkUrl: null,
      appleWalkUrl: null,
      streetViewUrl: null,
      accessibleWalkUrl: null,
      accessibleEntrance: null,
      arrivalNote: null,
    };
    expect(placeSpeech(bare)).toBe(
      `${en.campus.speech.place('Test Clinic', en.campus.kinds.clinic)} ${en.campus.speech.noLocation}`,
    );
    // A card saved before the walking links existed has no Walk there to point at, but it has a
    // maps link: it never says the location isn't published.
    const { walkUrl: _w, ...old } = PLACE;
    const said = placeSpeech({ ...old, mapsUrl: PLACE.mapsUrl });
    expect(said).not.toContain(en.campus.speech.canWalk);
    expect(said).not.toContain(en.campus.speech.noLocation);
  });
});

const ITEM = (n: string): SpeechItem => ({ placeId: `wits-test-${n}`, text: `Text ${n}` });

describe('the Speech interface and its fake', () => {
  it('records what was spoken and by which version, and stops', () => {
    const log: SpeechRecord[] = [];
    const speech = fakeSpeech('voice', log);
    const outcomes: string[] = [];
    speech.speak(ITEM('one'), (outcome) => outcomes.push(outcome));
    expect(log).toEqual([{ placeId: 'wits-test-one', text: 'Text one', version: 'voice' }]);
    expect(speech.speaking).toBe(true);
    speech.stop();
    expect(speech.speaking).toBe(false);
    expect(speech.stops).toBe(1);
    expect(outcomes).toEqual(['done']);
    // Finishing on its own calls back too, once; so does failing.
    speech.speak(ITEM('two'), (outcome) => outcomes.push(outcome));
    speech.finish();
    speech.finish();
    speech.speak(ITEM('three'), (outcome) => outcomes.push(outcome));
    speech.fail();
    speech.fail();
    expect(outcomes).toEqual(['done', 'done', 'failed']);
  });

  it('speaks through the screen reader when it’s on, else in the ElevenLabs voice', async () => {
    const log: SpeechRecord[] = [];
    const versions = {
      screenReader: fakeSpeech('screen-reader', log),
      voice: fakeSpeech('voice', log),
    };
    (await chooseSpeech(async () => true, versions)).speak(ITEM('one'));
    (await chooseSpeech(async () => false, versions)).speak(ITEM('two'));
    // Can't tell (the check failed): the voice, which a screen reader doesn't block.
    (
      await chooseSpeech(async () => {
        throw new Error('unavailable');
      }, versions)
    ).speak(ITEM('three'));
    expect(log.map((r) => [r.placeId, r.version])).toEqual([
      ['wits-test-one', 'screen-reader'],
      ['wits-test-two', 'voice'],
      ['wits-test-three', 'voice'],
    ]);
  });

  it('with the screen-reader route turned off, always the voice, and never asks', async () => {
    const voice = fakeSpeech('voice');
    let asked = 0;
    const chosen = await chooseSpeech(
      async () => {
        asked += 1;
        return true;
      },
      { screenReader: null, voice },
    );
    expect(chosen).toBe(voice);
    expect(asked).toBe(0);
  });

  it('there is no on-device or browser voice any more (owner, 2026-10-22)', () => {
    const versions: ReadonlyArray<SpeechVersion> = ['screen-reader', 'voice'];
    expect(versions).toHaveLength(2);
    // @ts-expect-error The phone's own voice is gone.
    const onDevice: SpeechVersion = 'on-device';
    // @ts-expect-error The browser's speechSynthesis is gone.
    const web: SpeechVersion = 'web';
    expect([onDevice, web]).toHaveLength(2);
  });
});

describe('the speech route, shared by the web and the app', () => {
  it('asks for a place by its id only, encoded, never by its text', () => {
    expect(SPEECH_STATUS_PATH).toBe('/api/speech');
    expect(speechPath('wits-test-clinic')).toBe('/api/speech/wits-test-clinic');
    expect(speechPath('a/b?c')).toBe('/api/speech/a%2Fb%3Fc');
    expect(speechPath(PLACE.id)).not.toContain(encodeURIComponent(placeSpeech(PLACE)));
  });
});
