import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { en } from '@universityflow/content/app';
import {
  type CampusPlaceView,
  type CampusTourArtifact,
  type CrisisCardArtifact,
  placeSpeech,
  speechPath,
} from '@universityflow/ui';
import { fetch } from 'expo/fetch';
import { AccessibilityInfo, Linking, Platform, StyleSheet, type ViewStyle } from 'react-native';
import { CrisisCard } from '../components/artifact-card';
import { CampusTourView } from '../components/campus';
import { saveToken } from '../lib/session';
import {
  pickSpeech,
  resetSpeechStatus,
  SPEAK_THROUGH_SCREEN_READER,
  screenReaderSpeech,
  voiceSpeech,
} from '../lib/speech';
import { theme } from '../lib/theme';
import { type Call, serve } from '../test-utils/fake-api';
import { audio, CACHE } from '../test-utils/native-modules';

/**
 * Walk there, See it, the step-free route and Read aloud in the app (planning.md §11, Phase 5e-1
 * and 5e-4). Synthetic records (hard rule 4): a made-up place, made-up coordinates.
 */

const t = en.campus;
const GOOGLE =
  'https://www.google.com/maps/dir/?api=1&destination=-26.19%2C28.03&travelmode=walking&dir_action=navigate';
const APPLE = 'https://maps.apple.com/directions?destination=-26.19%2C28.03&mode=walking';
const STREET = 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=-26.19%2C28.03';
const GOOGLE_DOOR =
  'https://www.google.com/maps/dir/?api=1&destination=-26.1901%2C28.0302&travelmode=walking&dir_action=navigate';
const APPLE_DOOR = 'https://maps.apple.com/directions?destination=-26.1901%2C28.0302&mode=walking';

const SECURITY: CampusPlaceView = {
  id: 'wits-test-security',
  kind: 'security',
  name: 'Test Security',
  where: 'Gate 1, Test Building',
  hours: '24 hours',
  phone: '011 000 0000',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=-26.19%2C28.03',
  appleMapsUrl: 'https://maps.apple.com/?ll=-26.19%2C28.03&q=Test%20Security',
  walkUrl: GOOGLE,
  appleWalkUrl: APPLE,
  streetViewUrl: STREET,
  accessibleWalkUrl: GOOGLE_DOOR,
  accessibleAppleWalkUrl: APPLE_DOOR,
  accessibleEntrance: 'East door, by the ramp',
  arrivalNote: 'The ramp is to the left of the main doors.',
  sourceUrl: 'https://www.wits.ac.za/test-page/',
  draft: false,
};

const tour = (
  place: CampusPlaceView = SECURITY,
  more: CampusPlaceView[] = [],
): CampusTourArtifact => ({
  kind: 'campus-tour',
  universityId: 'wits',
  universityName: 'Wits',
  basis: 'chosen',
  beforeYouArrive: false,
  includesDrafts: false,
  campuses: [
    {
      id: 'wits-test-campus',
      name: 'Test Campus',
      city: 'Testville',
      mapUrl: null,
      virtualTourUrl: null,
      sourceUrl: 'https://www.wits.ac.za/test-page/',
      draft: false,
      needs: [
        { need: 'health-and-safety', places: [place] },
        ...(more.length > 0 ? [{ need: 'support' as const, places: more }] : []),
      ],
    },
  ],
});

const named = (label: string, place = 'Test Security') => t.forPlace(label, place);

async function onPlatform<T>(os: 'ios' | 'android', run: () => Promise<T>): Promise<T> {
  const platform = jest.replaceProperty(Platform, 'OS', os);
  try {
    return await run();
  } finally {
    platform.restore();
  }
}

/** The URLs the app asked our server for. */
const asked = () => (fetch as jest.Mock).mock.calls.map(([url]) => String(url));

let open: jest.SpyInstance;
beforeEach(() => {
  open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  (fetch as jest.Mock).mockReset();
  resetSpeechStatus();
});
afterEach(() => {
  open.mockRestore();
  // No tap, destination or position ever reaches our server (5e-1). Since Read aloud became
  // the ElevenLabs voice (2026-10-22), a card asks once whether Read aloud is offered (GET
  // /api/speech, which carries nothing); a place's audio is asked for only in the Read aloud
  // tests below, by id, when the learner presses it.
  for (const url of asked()) {
    expect(url).toMatch(/\/api\/speech(\/[a-z0-9-]+)?$/);
  }
});

/** Read aloud offered (the server has an ElevenLabs voice), the place's audio, and a session. */
async function voiceOffered(extra: Record<string, Parameters<typeof serve>[0][string]> = {}) {
  await saveToken('test-session-token');
  return serve({
    'GET /api/speech': { json: { available: true } },
    [`GET ${speechPath('wits-test-security')}`]: { bytes: new Uint8Array([0xff, 0xfb, 1, 2]) },
    ...extra,
  });
}

const audioCalls = (calls: Call[]) => calls.filter((c) => c.key.startsWith('GET /api/speech/'));

describe('Walk there and See it (5e-1)', () => {
  it('offers Apple’s and Google’s walk on an iPhone, each saying which it opens', async () => {
    await onPlatform('ios', async () => {
      const screen = await render(<CampusTourView tour={tour()} />);
      const place = within(screen.getByTestId('place-wits-test-security'));
      const apple = place.getByRole('link', { name: named(t.walkThereIn.apple) });
      expect(apple.props.accessibilityHint).toBe(t.walkHint);
      await fireEvent.press(apple);
      await fireEvent.press(place.getByRole('link', { name: named(t.walkThereIn.google) }));
      await fireEvent.press(place.getByRole('link', { name: named(t.seeIt) }));
      expect(open.mock.calls.map(([url]) => url)).toEqual([APPLE, GOOGLE, STREET]);
      expect(place.queryByRole('link', { name: named(t.walkThere) })).toBeNull();
    });
  });

  it('offers Google’s walk on Android, and Street View, which is Google’s on both', async () => {
    await onPlatform('android', async () => {
      const screen = await render(<CampusTourView tour={tour()} />);
      const place = within(screen.getByTestId('place-wits-test-security'));
      await fireEvent.press(place.getByRole('link', { name: named(t.walkThere) }));
      await fireEvent.press(place.getByRole('link', { name: named(t.seeIt) }));
      expect(open.mock.calls.map(([url]) => url)).toEqual([GOOGLE, STREET]);
      expect(place.queryByRole('link', { name: named(t.walkThereIn.apple) })).toBeNull();
    });
  });

  it('the step-free route goes to the accessible entrance, with the entrance and arrival note as text', async () => {
    await onPlatform('ios', async () => {
      const screen = await render(<CampusTourView tour={tour()} />);
      const place = within(screen.getByTestId('place-wits-test-security'));
      expect(place.getByText(`${t.accessibleEntrance}: East door, by the ramp`)).toBeTruthy();
      expect(
        place.getByText(`${t.arrival}: The ramp is to the left of the main doors.`),
      ).toBeTruthy();
      const stepFree = place.getByRole('link', { name: named(t.stepFreeIn.apple) });
      expect(stepFree.props.accessibilityHint).toBe(t.stepFreeHint);
      await fireEvent.press(stepFree);
      await fireEvent.press(place.getByRole('link', { name: named(t.stepFreeIn.google) }));
      expect(open.mock.calls.map(([url]) => url)).toEqual([APPLE_DOOR, GOOGLE_DOOR]);
    });
    open.mockClear();
    await onPlatform('android', async () => {
      const screen = await render(<CampusTourView tour={tour()} />);
      await fireEvent.press(screen.getByRole('link', { name: named(t.stepFree) }));
      expect(open).toHaveBeenCalledWith(GOOGLE_DOOR);
    });
  });

  it.each(['ios', 'android'] as const)(
    'on %s: no See it without coordinates, no step-free route without an entrance',
    async (os) => {
      await onPlatform(os, async () => {
        const bare = {
          ...SECURITY,
          streetViewUrl: null,
          accessibleWalkUrl: null,
          accessibleAppleWalkUrl: null,
          accessibleEntrance: null,
          arrivalNote: null,
        };
        const screen = await render(<CampusTourView tour={tour(bare)} />);
        const place = within(screen.getByTestId('place-wits-test-security'));
        expect(place.queryByRole('link', { name: new RegExp(`^${t.seeIt}`) })).toBeNull();
        expect(place.queryByRole('link', { name: new RegExp(`^${t.stepFree}`) })).toBeNull();
        expect(place.queryByText(new RegExp(`^${t.arrival}:`))).toBeNull();
        expect(place.getAllByRole('link', { name: new RegExp(`^${t.walkThere}`) }).length).toBe(
          os === 'ios' ? 2 : 1,
        );
      });
    },
  );

  it('a card saved before Walk there shows none, and keeps Open in maps', async () => {
    const { walkUrl: _w, appleWalkUrl: _a, streetViewUrl: _s, ...old } = SECURITY;
    const screen = await render(<CampusTourView tour={tour(old)} />);
    expect(screen.queryByRole('link', { name: new RegExp(`^${t.walkThere}`) })).toBeNull();
    expect(screen.getByRole('link', { name: `${t.openInMaps}: Test Security` })).toBeTruthy();
  });

  it('each control is at least the touch target', async () => {
    await voiceOffered();
    const screen = await render(<CampusTourView tour={tour()} />);
    for (const control of [
      ...screen.getAllByRole('link', {
        name: new RegExp(`^(${t.walkThere}|${t.seeIt}|${t.stepFree})`),
      }),
      await screen.findByRole('button', { name: named(t.readAloud) }),
    ]) {
      const style = StyleSheet.flatten(
        typeof control.props.style === 'function'
          ? control.props.style({ pressed: false })
          : control.props.style,
      ) as ViewStyle;
      expect(style.minHeight).toBeGreaterThanOrEqual(theme.target);
    }
  });
});

describe('getting around with a disability (5e-4)', () => {
  it('says the app never replaces a cane, a guide dog or mobility training, and points to the unit', async () => {
    const screen = await render(<CampusTourView tour={tour()} />);
    expect(screen.getByRole('header', { name: t.mobility.title })).toBeTruthy();
    expect(screen.getByText(t.mobility.statement)).toBeTruthy();
    expect(screen.getByText(t.mobility.askUnitUnchecked)).toBeTruthy();
    const unit = {
      ...SECURITY,
      id: 'wits-test-unit',
      kind: 'disability-unit' as const,
      name: 'Test Unit',
    };
    const withUnit = await render(<CampusTourView tour={tour(SECURITY, [unit])} />);
    expect(withUnit.getByText(t.mobility.askUnit('Test Unit'))).toBeTruthy();
  });
});

/**
 * Read aloud in the app (owner's choice of 2026-10-22): the ElevenLabs voice, played from our
 * server's audio, or the learner's own screen reader when it's on. These replace the 5e-4 tests
 * of the phone's own voice (expo-speech), which is removed: "otherwise uses the phone's own
 * voice, and Stop stops it" and "turns back into Read aloud when the phone finishes speaking" now
 * play the place's audio and finish it; the versions test now picks the screen reader or the
 * voice. New: the button is hidden without the voice, and a failure is said.
 */
describe('Read aloud in the ElevenLabs voice (2026-10-22)', () => {
  let screenReader: jest.SpyInstance;
  let announce: jest.SpyInstance;
  beforeEach(() => {
    screenReader = jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled');
    announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
  });
  afterEach(() => {
    screenReader.mockRestore();
    announce.mockRestore();
  });

  it('is hidden without the voice, even with a screen reader on: no phone voice instead', async () => {
    screenReader.mockResolvedValue(true);
    const calls = serve({ 'GET /api/speech': { json: { available: false } } });
    const screen = await render(<CampusTourView tour={tour()} />);
    await waitFor(() => expect(calls.map((c) => c.key)).toEqual(['GET /api/speech']));
    expect(screen.queryByRole('button', { name: new RegExp(`^${t.readAloud}`) })).toBeNull();
    // The server can't be asked (offline, an old server): hidden too.
    resetSpeechStatus();
    serve({});
    const offline = await render(<CampusTourView tour={tour()} />);
    await act(async () => undefined);
    expect(offline.queryByRole('button', { name: new RegExp(`^${t.readAloud}`) })).toBeNull();
    expect(audio.createAudioPlayer).not.toHaveBeenCalled();
    expect(announce).not.toHaveBeenCalled();
  });

  it('speaks through VoiceOver or TalkBack when it’s on, in the learner’s own voice', async () => {
    screenReader.mockResolvedValue(true);
    const calls = await voiceOffered();
    const screen = await render(<CampusTourView tour={tour()} />);
    const read = await screen.findByRole('button', { name: named(t.readAloud) });
    // Nothing plays by itself.
    expect(announce).not.toHaveBeenCalled();
    expect(read.props.accessibilityHint).toBe(t.readAloudHint);
    await fireEvent.press(read);
    await waitFor(() => expect(announce).toHaveBeenCalledWith(placeSpeech(SECURITY)));
    // Spoken on the phone: nothing is fetched and no audio plays.
    expect(audioCalls(calls)).toEqual([]);
    expect(audio.createAudioPlayer).not.toHaveBeenCalled();
  });

  it('otherwise plays the place’s audio, asked for by id with the session, and Stop stops it', async () => {
    screenReader.mockResolvedValue(false);
    const calls = await voiceOffered();
    const screen = await render(<CampusTourView tour={tour()} />);
    await fireEvent.press(await screen.findByRole('button', { name: named(t.readAloud) }));
    await waitFor(() => expect(audio.players).toHaveLength(1));
    const [call] = audioCalls(calls);
    expect(call?.key).toBe(`GET ${speechPath('wits-test-security')}`);
    expect(call?.headers['authorization']).toBe('Bearer test-session-token');
    // Only the place's id: no body, none of the words, nothing about the learner.
    expect(call?.body).toBeUndefined();
    expect(call?.url).not.toMatch(/ramp|Test Building|\?/i);
    const player = audio.players[0];
    expect(player?.source).toBe(`${CACHE}read-aloud-wits-test-security.mp3`);
    expect(player?.play).toHaveBeenCalled();
    expect(announce).not.toHaveBeenCalled();
    await fireEvent.press(await screen.findByRole('button', { name: named(t.stopReading) }));
    expect(player?.remove).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: named(t.readAloud) })).toBeTruthy();
  });

  it('turns back into Read aloud when the audio finishes', async () => {
    screenReader.mockResolvedValue(false);
    await voiceOffered();
    const screen = await render(<CampusTourView tour={tour()} />);
    await fireEvent.press(await screen.findByRole('button', { name: named(t.readAloud) }));
    await screen.findByRole('button', { name: named(t.stopReading) });
    await waitFor(() => expect(audio.players).toHaveLength(1));
    await act(async () => {
      audio.players[0]?.finish();
    });
    expect(await screen.findByRole('button', { name: named(t.readAloud) })).toBeTruthy();
    expect(screen.queryByText(t.readAloudFailed)).toBeNull();
  });

  it('says so, plainly, when the audio can’t be had', async () => {
    screenReader.mockResolvedValue(false);
    await voiceOffered({
      [`GET ${speechPath('wits-test-security')}`]: {
        status: 429,
        json: { error: 'rate-limited', detail: null },
      },
    });
    const screen = await render(<CampusTourView tour={tour()} />);
    await fireEvent.press(await screen.findByRole('button', { name: named(t.readAloud) }));
    expect(await screen.findByText(t.readAloudFailed)).toBeTruthy();
    expect(screen.getByRole('button', { name: named(t.readAloud) })).toBeTruthy();
    expect(audio.createAudioPlayer).not.toHaveBeenCalled();
  });
});

describe('the Speech versions (2026-10-22)', () => {
  it('picks the screen reader when it’s on, the ElevenLabs voice when it’s off or unknown', async () => {
    // The owner's one-line choice: the learner's screen reader stays (it can be turned off).
    expect(SPEAK_THROUGH_SCREEN_READER).toBe(true);
    const check = jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled');
    try {
      check.mockResolvedValueOnce(true);
      expect((await pickSpeech()).version).toBe('screen-reader');
      check.mockResolvedValueOnce(false);
      expect((await pickSpeech()).version).toBe('voice');
      check.mockRejectedValueOnce(new Error('unavailable'));
      expect((await pickSpeech()).version).toBe('voice');
    } finally {
      check.mockRestore();
    }
  });

  it('the screen-reader version announces and is done at once; the voice waits for the audio', async () => {
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
    const done = jest.fn();
    screenReaderSpeech.speak({ placeId: 'wits-test-one', text: 'One' }, done);
    expect(announce).toHaveBeenCalledWith('One');
    expect(done).toHaveBeenCalledWith('done');
    screenReaderSpeech.stop();
    announce.mockRestore();

    await saveToken('test-session-token');
    serve({
      'GET /api/speech/wits-test-two': { bytes: new Uint8Array([1]) },
      'GET /api/speech/wits-test-three': { bytes: new Uint8Array([2]) },
    });
    const speech = voiceSpeech();
    expect(speech.version).toBe('voice');
    const first = jest.fn();
    speech.speak({ placeId: 'wits-test-two', text: 'Two' }, first);
    await waitFor(() => expect(audio.players).toHaveLength(1));
    const second = jest.fn();
    speech.speak({ placeId: 'wits-test-three', text: 'Three' }, second);
    expect(first).toHaveBeenCalledWith('done');
    expect(audio.players[0]?.remove).toHaveBeenCalled();
    await waitFor(() => expect(audio.players).toHaveLength(2));
    // The first one's late "finished" doesn't end the second.
    audio.players[0]?.finish();
    expect(second).not.toHaveBeenCalled();
    speech.stop();
    speech.stop();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe('the crisis card’s campus lines (5e-1)', () => {
  const card = (): CrisisCardArtifact => ({
    kind: 'crisis-card',
    helplines: [],
    cover: 'none',
    campus: {
      universityName: 'Wits',
      lines: [
        {
          id: 'wits-test-security',
          kind: 'security',
          name: 'Test Security',
          campusName: 'Test Campus',
          where: null,
          hours: null,
          phone: '011 000 0000',
          walkUrl: GOOGLE,
          appleWalkUrl: APPLE,
        },
      ],
    },
  });

  it('Walk there: Apple’s and Google’s on an iPhone, Google’s on Android', async () => {
    await onPlatform('ios', async () => {
      const screen = await render(<CrisisCard artifact={card()} />);
      await fireEvent.press(screen.getByRole('link', { name: named(t.walkThereIn.apple) }));
      await fireEvent.press(screen.getByRole('link', { name: named(t.walkThereIn.google) }));
    });
    await onPlatform('android', async () => {
      const screen = await render(<CrisisCard artifact={card()} />);
      await fireEvent.press(screen.getByRole('link', { name: named(t.walkThere) }));
    });
    expect(open.mock.calls.map(([url]) => url)).toEqual([APPLE, GOOGLE, GOOGLE]);
  });
});
