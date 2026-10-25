import { act, fireEvent, render, within } from '@testing-library/react-native';
import { en, SAFETY_TIPS } from '@universityflow/content/app';
import type {
  CampusTourArtifact,
  CrisisCardArtifact,
  FirstWeekArtifact,
  OfferCardArtifact,
} from '@universityflow/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { AccessibilityInfo, Linking, Platform, StyleSheet, type TextStyle } from 'react-native';
import CampusScreen from '../app/campus';
import FirstWeekScreen from '../app/first-week';
import { ArtifactCard, CrisisCard } from '../components/artifact-card';
import { CampusTourView } from '../components/campus';
import { formatInstantDay, formatOfferDate } from '../components/offer-card';
import { CallButton } from '../components/ui';
import { AuthProvider, useAuth } from '../lib/auth';
import { rememberCampus, savedCampus } from '../lib/campus-cache';
import { routeForNotification } from '../lib/push';
import { saveToken } from '../lib/session';
import type { CampusResponse, FirstWeekResponse } from '../lib/types';
import { serve } from '../test-utils/fake-api';

/** Synthetic records only (hard rule 4): made-up places, a zeroed landline-shaped number. */
const tour = (overrides: Partial<CampusTourArtifact> = {}): CampusTourArtifact => ({
  kind: 'campus-tour',
  universityId: 'wits',
  universityName: 'Wits',
  basis: 'accepted-offer',
  beforeYouArrive: true,
  includesDrafts: true,
  campuses: [
    {
      id: 'wits-test-campus',
      name: 'Test Campus',
      city: 'Testville',
      mapUrl: 'https://www.wits.ac.za/test-map.pdf',
      virtualTourUrl: null,
      sourceUrl: 'https://www.wits.ac.za/test-page/',
      draft: false,
      needs: [
        {
          need: 'health-and-safety',
          places: [
            {
              id: 'wits-test-security',
              kind: 'security',
              name: 'Test Security',
              where: 'Gate 1, Test Building',
              hours: '24 hours',
              phone: '011 000 0000',
              mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Test',
              sourceUrl: 'https://www.wits.ac.za/test-page/',
              draft: false,
            },
          ],
        },
        {
          need: 'study',
          places: [
            {
              id: 'wits-test-library',
              kind: 'library',
              name: 'Test Library',
              where: 'Test Building',
              hours: null,
              phone: null,
              mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Library',
              sourceUrl: 'https://www.wits.ac.za/test-page/',
              draft: true,
            },
          ],
        },
      ],
    },
  ],
  ...overrides,
});

const checklist = (overrides: Partial<FirstWeekArtifact> = {}): FirstWeekArtifact => ({
  kind: 'first-week',
  universityId: 'wits',
  universityName: 'Wits',
  basis: 'accepted-offer',
  steps: [
    { id: 'register', doneAt: null },
    { id: 'student-card', doneAt: '2028-02-01T09:00:00.000Z' },
    { id: 'faculty-office', doneAt: null },
    { id: 'email-and-lms', doneAt: null },
    { id: 'check-modules', doneAt: null },
    { id: 'clinic-and-security', doneAt: null },
    { id: 'financial-aid', doneAt: null },
    { id: 'residence-check-in', doneAt: null },
  ],
  calendar: {
    registration: { from: null, to: '2028-02-06' },
    orientation: { from: '2028-01-27', to: '2028-01-31' },
    changeDeadlines: [{ appliesTo: 'S1', lastDay: '2028-02-20' }],
    academicYear: 2028,
    sourceUrl: 'https://www.wits.ac.za/test-page/',
    draft: true,
  },
  facultyOffice: null,
  includesDrafts: true,
  ...overrides,
});

const OPTIONS = [
  { id: 'wits', name: 'Wits' },
  { id: 'uj', name: 'UJ' },
];

/** A synthetic offer, as the chat's offer card carries it. */
const offerCard = (): OfferCardArtifact => ({
  kind: 'offer-card',
  id: '00000000-0000-4000-8000-000000000001',
  offerKind: 'provisional',
  status: 'held',
  source: 'learner',
  universityId: 'uj',
  universityName: 'UJ',
  programme: {
    id: 'uj-beng-civil',
    name: 'BEng Civil Engineering',
    faculty: 'Engineering and the Built Environment',
    sourceUrl: 'https://www.uj.ac.za/',
    academicYear: 2027,
    draft: true,
  },
  replyBy: '2026-10-30',
  daysLeft: 16,
  conditions: ['Synthetic condition, as quoted.'],
  reminderAt: null,
  checksFinal: true,
  finalCheck: null,
});

beforeEach(async () => {
  await saveToken('tok');
});

describe('My campus', () => {
  it('shows the accepted offer’s campus by need, each number dialable, drafts labelled', async () => {
    serve({ 'GET /api/campus': { json: { tour: tour(), accepted: 'wits', options: OPTIONS } } });
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const screen = await render(<CampusScreen />);
    const security = within(await screen.findByTestId('place-wits-test-security'));
    expect(security.getByText('Where: Gate 1, Test Building')).toBeTruthy();
    await fireEvent.press(security.getByRole('link', { name: /^Call 011 000 0000/ }));
    expect(open).toHaveBeenCalledWith('tel:0110000000');
    await fireEvent.press(
      security.getByRole('link', { name: `${en.campus.openInMaps}: Test Security` }),
    );
    expect(open).toHaveBeenCalledWith('https://www.google.com/maps/search/?api=1&query=Test');
    const library = within(screen.getByTestId('place-wits-test-library'));
    expect(library.getByText(en.common.draftBadge)).toBeTruthy();
    expect(screen.getByText(en.campus.beforeYouArriveTitle)).toBeTruthy();
    for (const tip of SAFETY_TIPS) expect(screen.getByText(en.safety.tips[tip].title)).toBeTruthy();
    open.mockRestore();
  });

  it('asks which university to look around when none is accepted, and loads the one chosen', async () => {
    const calls = serve({
      'GET /api/campus': { json: { tour: null, accepted: null, options: OPTIONS } },
      'GET /api/campus?university=uj': {
        json: {
          tour: tour({
            universityId: 'uj',
            universityName: 'UJ',
            basis: 'chosen',
            campuses: [],
            beforeYouArrive: false,
          }),
          accepted: null,
          options: OPTIONS,
        } satisfies CampusResponse,
      },
    });
    const screen = await render(<CampusScreen />);
    expect(await screen.findByText(en.campus.chooseTitle)).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: en.campus.choose('UJ') }));
    expect(await screen.findByText(en.campus.notCheckedYet)).toBeTruthy();
    expect(screen.queryByText(en.campus.beforeYouArriveTitle)).toBeNull();
    expect(calls.some((c) => c.key === 'GET /api/campus?university=uj')).toBe(true);
  });

  it('says which university it now shows, and keeps the choice there, selected (A3-16)', async () => {
    serve({
      'GET /api/campus': { json: { tour: tour(), accepted: 'wits', options: OPTIONS } },
      'GET /api/campus?university=uj': {
        json: {
          tour: tour({ universityId: 'uj', universityName: 'UJ', basis: 'chosen', campuses: [] }),
          accepted: 'wits',
          options: OPTIONS,
        } satisfies CampusResponse,
      },
    });
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
    const screen = await render(<CampusScreen />);
    await screen.findByTestId('place-wits-test-security');
    expect(screen.getByRole('radio', { name: en.campus.choose('Wits') })).toBeChecked();
    const uj = screen.getByRole('radio', { name: en.campus.choose('UJ') });
    expect(uj).not.toBeChecked();
    await fireEvent.press(uj);
    expect(await screen.findByText(en.campus.notCheckedYet)).toBeTruthy();
    expect(announce).toHaveBeenCalledWith(en.campus.exploring('UJ'));
    // The pressed control is still there, now selected: focus has somewhere to stay.
    expect(screen.getByRole('radio', { name: en.campus.choose('UJ') })).toBeChecked();
    announce.mockRestore();
  });

  it('its need groups and its campuses are headings (A3-15)', async () => {
    serve({ 'GET /api/campus': { json: { tour: tour(), accepted: 'wits', options: OPTIONS } } });
    const screen = await render(<CampusScreen />);
    await screen.findByTestId('place-wits-test-security');
    expect(
      screen.getByRole('header', { name: en.campus.needs['health-and-safety'].title }),
    ).toBeTruthy();
    expect(screen.getByRole('header', { name: en.campus.needs.study.title })).toBeTruthy();
    const tip = SAFETY_TIPS[0];
    if (!tip) throw new Error('fixture');
    expect(screen.getByRole('header', { name: en.safety.tips[tip].title })).toBeTruthy();
  });

  it('"First week" opens the checklist for the university being looked at (A2-15)', async () => {
    serve({
      'GET /api/campus': { json: { tour: null, accepted: null, options: OPTIONS } },
      'GET /api/campus?university=uj': {
        json: {
          tour: tour({ universityId: 'uj', universityName: 'UJ', basis: 'chosen' }),
          accepted: null,
          options: OPTIONS,
        },
      },
    });
    const screen = await render(<CampusScreen />);
    await fireEvent.press(await screen.findByRole('radio', { name: en.campus.choose('UJ') }));
    await fireEvent.press(await screen.findByRole('button', { name: en.campus.firstWeekLink }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/first-week',
      params: { university: 'uj' },
    });
  });

  it('a campus name is a step below the university name (A2-20)', async () => {
    const screen = await render(<CampusTourView tour={tour()} />);
    const university = screen.getByRole('header', { name: 'Wits' });
    const campus = screen.getByRole('header', {
      name: en.campus.campusOf('Test Campus', 'Testville'),
    });
    expect(fontSize(campus)).toBeLessThan(fontSize(university));
  });
});

/** The size a text element renders at, its styles flattened. */
const fontSize = (element: { props: { style?: unknown } }): number =>
  (StyleSheet.flatten(element.props.style as TextStyle) as TextStyle).fontSize ?? 0;

/** The network is down: the request never reaches the server. */
const offline = () =>
  serve({
    'GET /api/campus': () => {
      throw new TypeError('Network request failed');
    },
  });

/** My campus loads once with a connection, then the screen closes. */
async function loadOnce(routes: Parameters<typeof serve>[0] = {}) {
  serve({
    'GET /api/campus': { json: { tour: tour(), accepted: 'wits', options: OPTIONS } },
    ...routes,
  });
  const screen = await render(<CampusScreen />);
  await screen.findByTestId('place-wits-test-security');
  return screen;
}

describe('My campus without a connection (A7-17)', () => {
  it('shows the last campus it loaded: the security number, when it was saved, the draft badges', async () => {
    await (await loadOnce()).unmount();
    offline();
    const screen = await render(<CampusScreen />);
    expect(await screen.findByText(en.errors.offline)).toBeTruthy();
    const security = within(await screen.findByTestId('place-wits-test-security'));
    expect(security.getByRole('link', { name: /^Call 011 000 0000/ })).toBeTruthy();
    expect(screen.getByText(en.campus.savedCopy)).toBeTruthy();
    expect(
      screen.getByText(en.campus.lastUpdated(formatInstantDay(new Date().toISOString()))),
    ).toBeTruthy();
    const library = within(screen.getByTestId('place-wits-test-library'));
    expect(library.getByText(en.common.draftBadge)).toBeTruthy();
    // Choosing another university needs the server: not offered from the saved copy.
    expect(screen.queryByText(en.campus.chooseTitle)).toBeNull();
    expect(screen.getByRole('button', { name: en.common.tryAgain })).toBeTruthy();
  });

  it('replaces the saved copy when a fetch succeeds, and drops it once the screen is live again', async () => {
    await (await loadOnce()).unmount();
    serve({
      'GET /api/campus': {
        json: {
          tour: tour({ universityName: 'Wits renamed' }),
          accepted: 'wits',
          options: OPTIONS,
        },
      },
    });
    const live = await render(<CampusScreen />);
    expect(await live.findByRole('header', { name: 'Wits renamed' })).toBeTruthy();
    expect(live.queryByText(en.campus.savedCopy)).toBeNull();
    expect((await savedCampus())?.response.tour?.universityName).toBe('Wits renamed');
  });

  it('keeps the accepted offer’s campus when the learner looks around another university', async () => {
    const screen = await loadOnce({
      'GET /api/campus?university=uj': {
        json: {
          tour: tour({ universityId: 'uj', universityName: 'UJ', basis: 'chosen', campuses: [] }),
          accepted: 'wits',
          options: OPTIONS,
        },
      },
    });
    await fireEvent.press(screen.getByRole('radio', { name: en.campus.choose('UJ') }));
    expect(await screen.findByText(en.campus.notCheckedYet)).toBeTruthy();
    await screen.unmount();
    offline();
    const again = await render(<CampusScreen />);
    expect(await again.findByTestId('place-wits-test-security')).toBeTruthy();
  });

  it('forgets it at sign-out: the next offline open shows no campus', async () => {
    await (await loadOnce()).unmount();
    let signOut: (() => Promise<void>) | null = null;
    function Grab() {
      signOut = useAuth().signOut;
      return null;
    }
    const auth = await render(
      <AuthProvider>
        <Grab />
      </AuthProvider>,
    );
    await act(async () => {
      await signOut?.();
    });
    await auth.unmount();
    expect(await savedCampus()).toBeNull();
    await saveToken('tok');
    offline();
    const screen = await render(<CampusScreen />);
    expect(await screen.findByText(en.errors.offline)).toBeTruthy();
    expect(screen.queryByTestId('campus-tour')).toBeNull();
    expect(screen.queryByText(en.campus.savedCopy)).toBeNull();
  });

  it('forgets it when the server says the session is over (a 401)', async () => {
    await (await loadOnce()).unmount();
    serve({ 'GET /api/campus': { status: 401, json: { error: 'signed-out' } } });
    const ended = await render(<CampusScreen />);
    expect(await ended.findByText(en.errors.signedOut)).toBeTruthy();
    expect(ended.queryByTestId('campus-tour')).toBeNull();
    await ended.unmount();
    await saveToken('tok');
    offline();
    const screen = await render(<CampusScreen />);
    expect(await screen.findByText(en.errors.offline)).toBeTruthy();
    expect(screen.queryByTestId('campus-tour')).toBeNull();
  });

  it('keeps only public catalogue records, a university id and the time it was saved', async () => {
    await rememberCampus({ tour: tour(), accepted: 'wits', options: OPTIONS });
    const saved = await savedCampus();
    expect(Object.keys(saved ?? {}).sort()).toEqual(['response', 'savedAt']);
    expect(Object.keys(saved?.response ?? {}).sort()).toEqual(['accepted', 'options', 'tour']);
    expect(JSON.stringify(saved)).not.toContain('tok');
  });
});

describe('Open in maps (A7-18)', () => {
  const withApple = (): CampusTourArtifact => {
    const base = tour();
    return {
      ...base,
      campuses: base.campuses.map((c) => ({
        ...c,
        needs: c.needs.map((n) => ({
          ...n,
          places: n.places.map((p) => ({
            ...p,
            appleMapsUrl: `https://maps.apple.com/?q=${p.id}`,
          })),
        })),
      })),
    };
  };

  async function pressOpenInMaps(os: 'ios' | 'android') {
    const platform = jest.replaceProperty(Platform, 'OS', os);
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    try {
      const screen = await render(<CampusTourView tour={withApple()} />);
      await fireEvent.press(
        screen.getByRole('link', { name: `${en.campus.openInMaps}: Test Security` }),
      );
      return open.mock.calls.map(([url]) => url);
    } finally {
      open.mockRestore();
      platform.restore();
    }
  }

  it('opens Apple Maps on an iPhone', async () => {
    expect(await pressOpenInMaps('ios')).toEqual(['https://maps.apple.com/?q=wits-test-security']);
  });

  it('opens Google Maps on Android', async () => {
    expect(await pressOpenInMaps('android')).toEqual([
      'https://www.google.com/maps/search/?api=1&query=Test',
    ]);
  });

  it('opens the Google link on an iPhone for a card saved before the Apple link existed', async () => {
    const platform = jest.replaceProperty(Platform, 'OS', 'ios');
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    try {
      const screen = await render(<CampusTourView tour={tour()} />);
      await fireEvent.press(
        screen.getByRole('link', { name: `${en.campus.openInMaps}: Test Security` }),
      );
      expect(open).toHaveBeenCalledWith('https://www.google.com/maps/search/?api=1&query=Test');
    } finally {
      open.mockRestore();
      platform.restore();
    }
  });
});

describe('a place whose source prints no building or location (A13-11)', () => {
  const unplaced = (): CampusTourArtifact => {
    const base = tour();
    return {
      ...base,
      campuses: base.campuses.map((c) => ({
        ...c,
        needs: c.needs.map((n) => ({
          ...n,
          places: n.places.map((p) =>
            p.id === 'wits-test-security'
              ? { ...p, where: null, mapsUrl: null, appleMapsUrl: null }
              : p,
          ),
        })),
      })),
    };
  };

  it.each(['ios', 'android'] as const)(
    'shows no "where" line and no "Open in maps" on %s, but keeps the number',
    async (os) => {
      const platform = jest.replaceProperty(Platform, 'OS', os);
      try {
        const screen = await render(<CampusTourView tour={unplaced()} />);
        const security = within(screen.getByTestId('place-wits-test-security'));
        expect(security.queryByText(/^Where:/)).toBeNull();
        expect(security.queryByText(en.campus.openInMaps)).toBeNull();
        expect(security.getByRole('link', { name: /^Call 011 000 0000/ })).toBeTruthy();
        // Another place keeps both.
        const library = within(screen.getByTestId('place-wits-test-library'));
        expect(library.getByText('Where: Test Building')).toBeTruthy();
        expect(
          library.getByRole('link', { name: `${en.campus.openInMaps}: Test Library` }),
        ).toBeTruthy();
      } finally {
        platform.restore();
      }
    },
  );

  it('a crisis line shows its campus alone, never an empty "where"', async () => {
    const card: CrisisCardArtifact = {
      kind: 'crisis-card',
      helplines: [],
      cover: 'none',
      campus: {
        universityName: 'Wits',
        lines: [
          {
            id: 'wits-test-clinic',
            kind: 'clinic',
            name: 'Test Clinic',
            campusName: 'Test Campus',
            where: null,
            hours: null,
            phone: '011 000 0001',
          },
        ],
      },
    };
    const screen = await render(<CrisisCard artifact={card} />);
    const campus = within(screen.getByTestId('crisis-campus'));
    expect(campus.getByText('Test Campus')).toBeTruthy();
    expect(campus.queryByText(/Test Campus:|null/)).toBeNull();
    expect(campus.getByRole('link', { name: 'Call 011 000 0001: Test Clinic' })).toBeTruthy();
  });
});

describe('the call button (A2-18)', () => {
  it('dials the printed number, its context in the name', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const screen = await render(<CallButton phone="011 000 0000" context="Test Security" />);
    await fireEvent.press(screen.getByRole('link', { name: 'Call 011 000 0000: Test Security' }));
    expect(open).toHaveBeenCalledWith('tel:0110000000');
    open.mockRestore();
  });

  it('can text a number instead, with the words it is given', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const screen = await render(<CallButton phone="31 393" sms label={en.crisis.sms('31 393')} />);
    await fireEvent.press(screen.getByRole('link', { name: en.crisis.sms('31 393') }));
    expect(open).toHaveBeenCalledWith('sms:31393');
    open.mockRestore();
  });

  it('looks the same on the crisis card as on My campus', async () => {
    const crisis = await render(
      <CrisisCard
        artifact={{
          kind: 'crisis-card',
          cover: 'all-day',
          helplines: [
            {
              id: 'test-line',
              name: 'Test Helpline',
              purpose: 'Synthetic.',
              hours: '24 hours',
              numbers: [{ kind: 'call', value: '011 000 0000' }],
            } as unknown as CrisisCardArtifact['helplines'][number],
          ],
        }}
      />,
    );
    const campus = await render(<CallButton phone="011 000 0000" />);
    const style = (s: { getByRole: typeof crisis.getByRole }) =>
      StyleSheet.flatten(
        (s.getByRole('link', { name: 'Call 011 000 0000' }).props as { style: unknown })
          .style as never,
      );
    expect(style(crisis)).toEqual(style(campus));
  });
});

describe('First week', () => {
  it('shows the steps and dates, ticks a step through the API, and says it saved', async () => {
    const ticked = checklist({
      steps: checklist().steps.map((s) =>
        s.id === 'register' ? { ...s, doneAt: '2028-02-02T09:00:00.000Z' } : s,
      ),
    });
    const calls = serve({
      'GET /api/first-week': {
        json: {
          checklist: checklist(),
          accepted: 'wits',
          options: OPTIONS,
        } satisfies FirstWeekResponse,
      },
      'PUT /api/first-week': { json: { checklist: ticked, accepted: 'wits', options: OPTIONS } },
    });
    const screen = await render(<FirstWeekScreen />);
    expect(await screen.findByText(en.firstWeek.progress(1, 8))).toBeTruthy();
    expect(screen.getByText(/^First-year registration closes:/)).toBeTruthy();
    expect(screen.getByText(/^Last day to change modules \(first semester\):/)).toBeTruthy();
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
    await fireEvent.press(
      screen.getByRole('checkbox', { name: en.firstWeek.steps.register.title }),
    );
    expect(await screen.findByText(en.firstWeek.progress(2, 8))).toBeTruthy();
    expect(announce).toHaveBeenCalledWith(en.firstWeek.saved);
    announce.mockRestore();
    expect(calls.find((c) => c.key === 'PUT /api/first-week')?.body).toEqual({
      universityId: 'wits',
      step: 'register',
      done: true,
    });
  });

  it('links the modules step to My modules', async () => {
    serve({
      'GET /api/first-week': {
        json: { checklist: checklist(), accepted: 'wits', options: OPTIONS },
      },
    });
    const screen = await render(<FirstWeekScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: en.firstWeek.modulesLink }));
    expect(router.push).toHaveBeenCalledWith('/modules');
  });

  it('says so when the dates aren’t checked yet', async () => {
    serve({
      'GET /api/first-week': {
        json: { checklist: checklist({ calendar: null }), accepted: 'wits', options: OPTIONS },
      },
    });
    const screen = await render(<FirstWeekScreen />);
    expect(await screen.findByText(en.firstWeek.noDates)).toBeTruthy();
  });

  it('opens on the university My campus was showing (A2-15)', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ university: 'uj' });
    const calls = serve({
      'GET /api/first-week?university=uj': {
        json: {
          checklist: checklist({ universityId: 'uj', universityName: 'UJ', basis: 'chosen' }),
          accepted: null,
          options: OPTIONS,
        },
      },
    });
    try {
      const screen = await render(<FirstWeekScreen />);
      expect(await screen.findByText(`${en.firstWeek.title}: UJ`)).toBeTruthy();
      expect(calls.map((c) => c.key)).toEqual(['GET /api/first-week?university=uj']);
    } finally {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});
    }
  });

  it('says the day a step was ticked in South Africa: 00:30 SAST is that day, not the one before (A7-16)', async () => {
    serve({
      'GET /api/first-week': {
        json: {
          checklist: checklist({
            steps: checklist().steps.map((s) =>
              s.id === 'register' ? { ...s, doneAt: '2028-02-01T22:30:00.000Z' } : s,
            ),
          }),
          accepted: 'wits',
          options: OPTIONS,
        },
      },
    });
    const screen = await render(<FirstWeekScreen />);
    const step = within(await screen.findByTestId('step-register'));
    expect(step.getByText(en.firstWeek.doneOn(formatOfferDate('2028-02-02')))).toBeTruthy();
  });

  it('its section titles are headings (A3-15)', async () => {
    serve({
      'GET /api/first-week': {
        json: {
          checklist: checklist({
            facultyOffice: {
              faculty: 'Synthetic Faculty',
              where: 'Test Building',
              hours: null,
              phone: null,
              email: null,
              contactUrl: 'https://www.wits.ac.za/test-page/',
              sourceUrl: 'https://www.wits.ac.za/test-page/',
              draft: true,
            },
          }),
          accepted: 'wits',
          options: OPTIONS,
        },
      },
    });
    const screen = await render(<FirstWeekScreen />);
    await screen.findByTestId('first-week');
    expect(screen.getByRole('header', { name: en.firstWeek.datesTitle })).toBeTruthy();
    expect(
      screen.getByRole('header', { name: `${en.firstWeek.facultyOfficeTitle}: Synthetic Faculty` }),
    ).toBeTruthy();
  });
});

describe('the chat, the crisis card and the safety notifications', () => {
  it('says so when the calendar publishes no last day to change modules (gotcha 40)', async () => {
    const base = checklist();
    if (!base.calendar) throw new Error('fixture');
    const screen = await render(
      <ArtifactCard
        artifact={checklist({ calendar: { ...base.calendar, changeDeadlines: [] } })}
      />,
    );
    expect(screen.getByText(en.firstWeek.changeDeadlineUnpublished)).toBeTruthy();
  });

  it('renders the tour and the checklist artifacts in full, read-only', async () => {
    const screen = await render(<ArtifactCard artifact={tour()} />);
    expect(screen.getByTestId('artifact-campus-tour')).toBeTruthy();
    const week = await render(<ArtifactCard artifact={checklist()} />);
    expect(week.getByTestId('artifact-first-week')).toBeTruthy();
    expect(week.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('the crisis card adds the campus lines it is given, each dialable', async () => {
    const card: CrisisCardArtifact = {
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
            where: 'Gate 1',
            hours: '24 hours',
            phone: '011 000 0000',
          },
        ],
      },
    };
    const screen = await render(<CrisisCard artifact={card} />);
    const campus = within(screen.getByTestId('crisis-campus'));
    expect(campus.getByText(en.crisis.campusTitle('Wits'))).toBeTruthy();
    expect(campus.getByRole('link', { name: 'Call 011 000 0000: Test Security' })).toBeTruthy();
    const { campus: _lines, ...withoutCampus } = card;
    const none = await render(<CrisisCard artifact={withoutCampus} />);
    expect(none.queryByTestId('crisis-campus')).toBeNull();
  });

  it('the crisis card’s campus section is a step below the card’s own title (A2-20)', async () => {
    const screen = await render(
      <CrisisCard
        artifact={{
          kind: 'crisis-card',
          helplines: [],
          cover: 'none',
          campus: { universityName: 'Wits', lines: [] },
        }}
      />,
    );
    const title = screen.getByRole('header', { name: en.crisis.cardTitle });
    const campus = screen.getByRole('header', { name: en.crisis.campusTitle('Wits') });
    expect(fontSize(campus)).toBeLessThan(fontSize(title));
  });

  it.each([
    ['offer', '/offers', en.offers.title],
    ['campus tour', '/campus', en.campus.title],
    ['first week', '/first-week', en.firstWeek.title],
  ] as const)('the %s card opens its screen from the chat (A2-16)', async (kind, route, title) => {
    const artifact = kind === 'offer' ? offerCard() : kind === 'campus tour' ? tour() : checklist();
    const screen = await render(<ArtifactCard artifact={artifact} />);
    await fireEvent.press(
      screen.getByRole('button', { name: `${en.chat.artifactOpen}: ${title}` }),
    );
    expect(router.push).toHaveBeenCalledWith(route);
  });

  it('the screens themselves don’t link to themselves', async () => {
    serve({ 'GET /api/campus': { json: { tour: tour(), accepted: 'wits', options: OPTIONS } } });
    const screen = await render(<CampusScreen />);
    await screen.findByTestId('place-wits-test-security');
    expect(
      screen.queryByRole('button', { name: `${en.chat.artifactOpen}: ${en.campus.title}` }),
    ).toBeNull();
  });

  it('a tapped safety notification opens My campus or First week', () => {
    expect(routeForNotification({ screen: 'campus' })).toBe('/campus');
    expect(routeForNotification({ screen: 'first-week' })).toBe('/first-week');
  });
});
