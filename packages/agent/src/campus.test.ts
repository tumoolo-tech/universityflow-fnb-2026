import {
  appleWalkingLink,
  catalogueView,
  catalogueViewOf,
  PLACE_KINDS,
  type Place,
  RAW_CATALOGUE,
  streetViewLink,
  walkingLink,
} from '@universityflow/catalogue';
import { en, FIRST_WEEK_STEPS, PLACE_NEED_IDS, PLACE_NEEDS } from '@universityflow/content';
import type { CampusTourArtifact, CrisisCardArtifact, FirstWeekArtifact } from '@universityflow/ui';
import { describe, expect, it } from 'vitest';
import {
  acceptedUniversity,
  arrivalYear,
  campusSafetyLines,
  campusTour,
  campusUniversity,
  firstWeek,
  needOf,
} from './campus';
import { runTurn } from './runner';
import { SampleChatModel } from './sample-model';
import {
  acceptedOffer,
  CAMPUS_TEST_DRAFT_SAFETY_IDS,
  CAMPUS_TEST_PROGRAMME,
  CAMPUS_TEST_TODAY,
  campusTestRecords,
  campusTestView,
  fakeContext,
  ScriptedModel,
} from './testing';
import { runTool } from './tools';

const declined = { ...acceptedOffer('uj', 'uj-beng-civil'), status: 'declined' as const };
/** Where every test place is, as `campusTestRecords` publishes it. */
const TEST_QUERY = 'Test Building, Test Campus, Testville';

/**
 * The test records plus a verified clinic whose source prints a number but no building or
 * location (A13-11), as UKZN's Westville clinic is recorded. Synthetic (hard rule 4).
 */
function unplacedClinicView() {
  const records = campusTestRecords();
  const unplaced: Place = {
    sourceUrl: 'https://www.wits.ac.za/test-contacts/',
    academicYear: 2028,
    verifiedOn: '2027-11-30',
    verifiedBy: 'Test Verifier',
    id: 'wits-test-unplaced-clinic',
    campusId: 'wits-test-campus',
    kind: 'clinic',
    name: 'Test Unplaced Clinic',
    phone: '011 000 0001',
  };
  return catalogueViewOf({ ...records, places: [...records.places, unplaced] }, CAMPUS_TEST_TODAY, {
    includeDrafts: false,
  });
}

describe('which university (never assumed)', () => {
  it('is the accepted offer’s, unless the learner chose another to look around', () => {
    expect(acceptedUniversity([declined])).toBeNull();
    expect(acceptedUniversity([declined, acceptedOffer('wits')])).toBe('wits');
    expect(campusUniversity([acceptedOffer('wits')], undefined)).toEqual({
      universityId: 'wits',
      basis: 'accepted-offer',
    });
    expect(campusUniversity([acceptedOffer('wits')], 'wits')?.basis).toBe('accepted-offer');
    expect(campusUniversity([acceptedOffer('wits')], 'uct')).toEqual({
      universityId: 'uct',
      basis: 'chosen',
    });
    expect(campusUniversity([declined], 'up')).toEqual({ universityId: 'up', basis: 'chosen' });
  });

  it('is nobody when the learner has accepted nothing and chose nothing', () => {
    expect(campusUniversity([], undefined)).toBeNull();
    expect(campusUniversity([declined], null)).toBeNull();
  });
});

describe('places are grouped by need', () => {
  it('every kind of place but "other" is in exactly one need', () => {
    const listed = Object.values(PLACE_NEEDS).flat();
    expect([...listed].sort()).toEqual([...PLACE_KINDS].sort());
    expect(new Set(listed).size).toBe(listed.length);
    for (const kind of PLACE_KINDS) expect(PLACE_NEED_IDS).toContain(needOf(kind));
    expect(needOf('clinic')).toBe('health-and-safety');
    expect(needOf('registration-venue')).toBe('getting-started');
  });
});

describe('the campus tour', () => {
  const tourOf = (includeDrafts: boolean, basis: 'accepted-offer' | 'chosen' = 'accepted-offer') =>
    campusTour(campusTestView(includeDrafts), 'wits', basis) as CampusTourArtifact;

  it('shows a learner verified places only, grouped by need in order, with maps links', () => {
    const tour = tourOf(false);
    expect(tour.kind).toBe('campus-tour');
    expect(tour.universityName).toBe('Wits');
    expect(tour.includesDrafts).toBe(false);
    expect(tour.campuses.map((c) => c.id)).toEqual(['wits-test-campus']);
    const [campus] = tour.campuses;
    expect(campus?.needs.map((n) => n.need)).toEqual(['health-and-safety', 'daily-life']);
    const places = campus?.needs.flatMap((n) => n.places) ?? [];
    // In the order the data lists them, within each need.
    expect(places.map((p) => p.id)).toEqual([
      'wits-test-security',
      'wits-test-clinic',
      'wits-test-counselling',
      'wits-test-food',
    ]);
    expect(places.every((p) => !p.draft)).toBe(true);
    expect(places[0]?.mapsUrl).toBe(
      'https://www.google.com/maps/search/?api=1&query=Test%20Building%2C%20Test%20Campus%2C%20Testville',
    );
    // The same place for an iPhone's Maps app (A7-18).
    expect(places[0]?.appleMapsUrl).toBe(
      'https://maps.apple.com/?q=Test%20Building%2C%20Test%20Campus%2C%20Testville',
    );
    expect(campus?.mapUrl).toBe('https://www.wits.ac.za/test-map.pdf');
    expect(campus?.virtualTourUrl).toBe('https://www.wits.ac.za/test-tour/');
  });

  it('shows drafts only in preview, labelled, and never a draft clinic or security place', () => {
    const tour = tourOf(true);
    expect(tour.includesDrafts).toBe(true);
    const ids = tour.campuses.flatMap((c) => c.needs.flatMap((n) => n.places.map((p) => p.id)));
    expect(ids).toContain('wits-test-library');
    for (const id of CAMPUS_TEST_DRAFT_SAFETY_IDS) expect(ids).not.toContain(id);
    const library = tour.campuses
      .flatMap((c) => c.needs.flatMap((n) => n.places))
      .find((p) => p.id === 'wits-test-library');
    expect(library?.draft).toBe(true);
    expect(tour.campuses.find((c) => c.id === 'wits-test-draft-campus')?.draft).toBe(true);
  });

  it('gives no "where" and no maps links for a place whose source prints neither (A13-11)', () => {
    const view = unplacedClinicView();
    const tour = campusTour(view, 'wits', 'chosen') as CampusTourArtifact;
    const places = tour.campuses.flatMap((c) => c.needs.flatMap((n) => n.places));
    const unplaced = places.find((p) => p.id === 'wits-test-unplaced-clinic');
    expect(unplaced).toMatchObject({ where: null, mapsUrl: null, appleMapsUrl: null });
    expect(unplaced?.phone).toBe('011 000 0001');
    // A place with a location still has both links.
    const clinic = places.find((p) => p.id === 'wits-test-clinic');
    expect(clinic?.mapsUrl).toMatch(/^https:\/\/www\.google\.com\/maps\//);
    expect(clinic?.where).toBe('Ground floor, Test Building');
  });

  it('says "before you arrive" only for the accepted offer’s university', () => {
    expect(tourOf(false).beforeYouArrive).toBe(true);
    expect(tourOf(false, 'chosen').beforeYouArrive).toBe(false);
  });

  it('is honest about a university nobody has checked yet: no campuses at all', () => {
    const view = catalogueView(CAMPUS_TEST_TODAY, { includeDrafts: false });
    // Nothing in the real catalogue is verified yet, so a learner sees no university at all.
    expect(campusTour(view, 'up', 'chosen')).toBeNull();
    const records = campusTestView(false);
    expect(campusTour(records, 'up', 'chosen')).toBeNull();
    const preview = campusTour(campusTestView(true), 'uj', 'chosen');
    expect(preview?.campuses).toEqual([]);
  });
});

describe('the first-week checklist', () => {
  it('lists every step in order, with the learner’s ticks', () => {
    const at = new Date('2028-02-01T09:00:00Z');
    const list = firstWeek(
      campusTestView(false),
      'wits',
      'accepted-offer',
      [{ step: 'student-card', doneAt: at }],
      CAMPUS_TEST_PROGRAMME,
      2028,
    ) as FirstWeekArtifact;
    expect(list.steps.map((s) => s.id)).toEqual([...FIRST_WEEK_STEPS]);
    expect(list.steps.find((s) => s.id === 'student-card')?.doneAt).toBe(at.toISOString());
    expect(list.steps.filter((s) => s.doneAt)).toHaveLength(1);
  });

  it('takes its dates from the calendar, and never guesses an opening date', () => {
    const list = firstWeek(campusTestView(false), 'wits', 'chosen', [], null, 2028);
    expect(list?.calendar).toEqual({
      registration: { from: null, to: '2028-02-06' },
      orientation: { from: '2028-01-27', to: '2028-01-31' },
      changeDeadlines: [{ appliesTo: 'S1', lastDay: '2028-02-20' }],
      academicYear: 2028,
      sourceUrl: 'https://www.wits.ac.za/test-page/',
      draft: false,
    });
    // A chosen university has no programme, so no faculty office.
    expect(list?.facultyOffice).toBeNull();
  });

  it('names the faculty office of the accepted offer’s programme', () => {
    const list = firstWeek(
      campusTestView(false),
      'wits',
      'accepted-offer',
      [],
      CAMPUS_TEST_PROGRAMME,
      2028,
    );
    expect(list?.facultyOffice?.where).toBe('Room 1, Test Building');
    expect(list?.facultyOffice?.draft).toBe(false);
  });

  it('shows only the calendar for the year the learner arrives, never last year’s (A13-02)', () => {
    // UCT's calendar is for 2026; verified here as printed, and a learner arriving in 2027.
    const verified = <T extends object>(r: T): T => ({
      ...r,
      verifiedOn: '2026-12-01',
      verifiedBy: 'Test Verifier',
    });
    const today = new Date('2027-01-10T08:00:00Z');
    const view = catalogueViewOf(
      {
        ...RAW_CATALOGUE,
        universities: RAW_CATALOGUE.universities.filter((u) => u.id === 'uct').map(verified),
        registrationCalendars: RAW_CATALOGUE.registrationCalendars
          .filter((c) => c.universityId === 'uct')
          .map(verified),
      },
      today,
      { includeDrafts: false },
    );
    expect(view.registrationCalendars.map((c) => c.academicYear)).toEqual([2026]);
    const arriving = firstWeek(view, 'uct', 'accepted-offer', [], null, 2027);
    expect(arriving?.calendar).toBeNull();
    // The year it is for still shows it.
    expect(firstWeek(view, 'uct', 'accepted-offer', [], null, 2026)?.calendar).toMatchObject({
      academicYear: 2026,
      draft: false,
    });
  });

  it('the year the learner arrives: their registration’s at that university, else the next intake', () => {
    const registration = { universityId: 'uct', academicYear: 2026 };
    const jan = new Date('2027-01-10T08:00:00Z');
    expect(arrivalYear(jan, 'uct', registration)).toBe(2026);
    // A registration at another university says nothing about this one.
    expect(arrivalYear(jan, 'wits', registration)).toBe(2027);
    expect(arrivalYear(jan, 'uct', null)).toBe(2027);
    // From March, first-year registration is over: the next intake is next year's.
    expect(arrivalYear(new Date('2027-02-28T21:00:00Z'), 'uct', null)).toBe(2027);
    expect(arrivalYear(new Date('2027-02-28T22:30:00Z'), 'uct', null)).toBe(2028); // 1 March SAST
    expect(arrivalYear(new Date('2027-10-17T08:00:00Z'), 'uct', null)).toBe(2028);
  });

  it('has no dates when the calendar isn’t checked, and nothing for an unknown university', () => {
    const preview = firstWeek(campusTestView(true), 'uj', 'chosen', [], null, 2028);
    expect(preview?.calendar).toBeNull();
    expect(firstWeek(campusTestView(false), 'uj', 'chosen', [], null, 2028)).toBeNull();
  });
});

describe('Walk there, See it, the step-free route and the arrival note (5e-1, 5e-4)', () => {
  /**
   * The test records plus a verified library with published coordinates, a step-free entrance and
   * an arrival note. Synthetic (hard rule 4): made-up names, a test page, made-up coordinates.
   */
  function accessibleView() {
    const records = campusTestRecords();
    const library: Place = {
      sourceUrl: 'https://www.wits.ac.za/test-page/',
      academicYear: 2028,
      verifiedOn: '2027-11-30',
      verifiedBy: 'Test Verifier',
      id: 'wits-test-step-free-library',
      campusId: 'wits-test-campus',
      kind: 'library',
      name: 'Test Step-free Library',
      location: { query: 'Test Library', coordinates: { lat: -26.19, lng: 28.03 } },
      accessibleEntrance: {
        location: { coordinates: { lat: -26.1901, lng: 28.0302 } },
        description: 'East door, by the ramp',
      },
      arrivalNote: 'The ramp is to the left of the main doors.',
    };
    return catalogueViewOf(
      { ...records, places: [...records.places, library] },
      CAMPUS_TEST_TODAY,
      { includeDrafts: false },
    );
  }
  const placesOf = (tour: CampusTourArtifact | null) =>
    tour?.campuses.flatMap((c) => c.needs.flatMap((n) => n.places)) ?? [];

  it('a place with coordinates and a step-free entrance gets every link, from code', () => {
    const library = placesOf(campusTour(accessibleView(), 'wits', 'chosen')).find(
      (p) => p.id === 'wits-test-step-free-library',
    );
    const at = { query: 'Test Library', coordinates: { lat: -26.19, lng: 28.03 } };
    const door = { coordinates: { lat: -26.1901, lng: 28.0302 } };
    expect(library).toMatchObject({
      walkUrl: walkingLink(at),
      appleWalkUrl: appleWalkingLink(at),
      streetViewUrl: streetViewLink(at),
      accessibleWalkUrl: walkingLink(door),
      accessibleAppleWalkUrl: appleWalkingLink(door),
      accessibleEntrance: 'East door, by the ramp',
      arrivalNote: 'The ramp is to the left of the main doors.',
    });
    expect(library?.streetViewUrl).toMatch(/map_action=pano/);
  });

  it('a place with only a search text: walking links, but no Street View and no step-free route', () => {
    const security = placesOf(campusTour(campusTestView(false), 'wits', 'chosen'))[0];
    expect(security).toMatchObject({
      walkUrl: walkingLink({ query: TEST_QUERY }),
      appleWalkUrl: appleWalkingLink({ query: TEST_QUERY }),
      streetViewUrl: null,
      accessibleWalkUrl: null,
      accessibleAppleWalkUrl: null,
      accessibleEntrance: null,
      arrivalNote: null,
    });
  });

  it('a place with no published location: no link of any kind (A13-11)', () => {
    const unplaced = placesOf(campusTour(unplacedClinicView(), 'wits', 'chosen')).find(
      (p) => p.id === 'wits-test-unplaced-clinic',
    );
    expect(unplaced).toMatchObject({
      walkUrl: null,
      appleWalkUrl: null,
      streetViewUrl: null,
      accessibleWalkUrl: null,
    });
  });

  it('the model sees no link and no coordinates, and is told never to write one', async () => {
    const { context } = fakeContext({
      today: CAMPUS_TEST_TODAY,
      catalogue: accessibleView(),
      offers: [acceptedOffer('wits')],
    });
    const result = await runTool(context, 'campus_tour', {});
    const forModel = JSON.stringify(result.forModel);
    expect(forModel).not.toMatch(/https?:|-26\.19|28\.03/);
    expect(forModel).toMatch(/Never write a map, directions or Street View link/);
  });
});

describe('the crisis card’s campus lines (planning.md §4.3)', () => {
  it('are the verified clinic, counselling and security, security first', () => {
    for (const includeDrafts of [false, true]) {
      const lines = campusSafetyLines(campusTestView(includeDrafts), 'wits');
      expect(lines?.universityName).toBe('Wits');
      expect(lines?.lines.map((l) => l.id)).toEqual([
        'wits-test-security',
        'wits-test-clinic',
        'wits-test-counselling',
      ]);
      expect(lines?.lines[0]).toMatchObject({
        kind: 'security',
        campusName: 'Test Campus',
        phone: '011 000 0000',
      });
    }
  });

  it('carry no "where" for a verified place whose source prints no building (A13-11)', () => {
    const lines = campusSafetyLines(unplacedClinicView(), 'wits');
    expect(lines?.lines.find((l) => l.id === 'wits-test-unplaced-clinic')).toEqual({
      id: 'wits-test-unplaced-clinic',
      kind: 'clinic',
      name: 'Test Unplaced Clinic',
      campusName: 'Test Campus',
      where: null,
      hours: null,
      phone: '011 000 0001',
      // No location published: no walking directions either (5e-1).
      walkUrl: null,
      appleWalkUrl: null,
    });
  });

  it('carry Walk there, built by code from the published location (5e-1)', () => {
    const lines = campusSafetyLines(campusTestView(false), 'wits');
    expect(lines?.lines[0]?.walkUrl).toBe(walkingLink({ query: TEST_QUERY }));
    expect(lines?.lines[0]?.appleWalkUrl).toBe(appleWalkingLink({ query: TEST_QUERY }));
  });

  it('never include a draft, even in preview, and are absent without a verified one', () => {
    const preview = campusSafetyLines(campusTestView(true), 'wits');
    for (const id of CAMPUS_TEST_DRAFT_SAFETY_IDS) {
      expect(preview?.lines.map((l) => l.id)).not.toContain(id);
    }
    // UP's real records are drafts today: preview shows its campuses, but no crisis line.
    const real = catalogueView(new Date('2026-10-16T08:00:00Z'), { includeDrafts: true });
    expect(RAW_CATALOGUE.places.some((p) => p.id.startsWith('up-'))).toBe(true);
    expect(campusSafetyLines(real, 'up')).toBeUndefined();
    expect(campusSafetyLines(campusTestView(true), null)).toBeUndefined();
    expect(campusSafetyLines(campusTestView(false), 'uj')).toBeUndefined();
  });
});

describe('the campus_tour and first_week tools', () => {
  it('ask which university when the learner has accepted nothing and named nothing', async () => {
    const { context } = fakeContext({ catalogue: campusTestView(false) });
    for (const name of ['campus_tour', 'first_week']) {
      const result = await runTool(context, name, {});
      expect(result.artifacts).toEqual([]);
      expect(result.forModel).toMatchObject({ status: 'no-university' });
    }
  });

  it('show the accepted offer’s university, and tell the model never to give a fact from memory', async () => {
    const { context, tickFirstWeek } = fakeContext({
      today: CAMPUS_TEST_TODAY,
      catalogue: campusTestView(false),
      offers: [acceptedOffer('wits')],
    });
    tickFirstWeek('wits', 'register');
    const tour = await runTool(context, 'campus_tour', {});
    expect(tour.artifacts[0]?.kind).toBe('campus-tour');
    expect(tour.forModel).toMatchObject({
      university: 'Wits',
      because: 'the offer they accepted',
      not_checked_yet: false,
      before_you_arrive_safety_guidance: true,
      unverified_preview_data: false,
    });
    expect(JSON.stringify(tour.forModel)).toMatch(/Never give a building, room, phone number/);
    const week = await runTool(context, 'first_week', {});
    expect(week.artifacts[0]?.kind).toBe('first-week');
    expect(week.forModel).toMatchObject({
      steps_done: ['register'],
      arrival_year: 2028,
      dates: { first_year_registration_from: 'not published' },
    });
  });

  it('first_week gives no dates for another year’s calendar, and uses the registration’s year (A13-02)', async () => {
    // October 2026: the next intake is 2027, and the only calendar held is for 2028.
    const early = fakeContext({
      today: new Date('2026-10-13T08:00:00Z'),
      catalogue: campusTestView(false),
      offers: [acceptedOffer('wits')],
    });
    const none = await runTool(early.context, 'first_week', {});
    expect(none.forModel).toMatchObject({ arrival_year: 2027 });
    expect(none.forModel).toMatchObject({ dates: expect.stringMatching(/^not published/) });
    expect((none.artifacts[0] as FirstWeekArtifact).calendar).toBeNull();
    // A confirmed registration at that university for 2028 settles the year.
    const registered = fakeContext({
      today: new Date('2026-10-13T08:00:00Z'),
      catalogue: campusTestView(false),
      offers: [acceptedOffer('wits')],
      registration: {
        id: 'registration-1',
        universityId: 'wits',
        programmeId: CAMPUS_TEST_PROGRAMME,
        academicYear: 2028,
        yearOfStudy: 1,
        modules: [],
        confirmedAt: new Date('2026-10-13T08:00:00Z'),
        reminder: null,
      },
    });
    const dated = await runTool(registered.context, 'first_week', {});
    expect(dated.forModel).toMatchObject({ arrival_year: 2028, dates: { academic_year: 2028 } });
  });

  it('carry the preview flag for drafts (A10-13), and look around a university the learner names', async () => {
    const { context } = fakeContext({ catalogue: campusTestView(true) });
    const tour = await runTool(context, 'campus_tour', { university_id: 'wits' });
    expect(tour.forModel).toMatchObject({ because: 'they asked to look around' });
    expect(tour.forModel).toMatchObject({ unverified_preview_data: true });
    const empty = await runTool(context, 'campus_tour', { university_id: 'uj' });
    expect(empty.forModel).toMatchObject({ not_checked_yet: true });
  });

  it('refuse an unknown university', async () => {
    const { context } = fakeContext();
    await expect(runTool(context, 'campus_tour', { university_id: 'nope' })).rejects.toThrow(
      /Invalid input/,
    );
  });
});

describe('the local stand-in model', () => {
  const ask = async (message: string, offers = [acceptedOffer('wits')]) => {
    const { context } = fakeContext({ catalogue: campusTestView(false), offers });
    return runTurn({ model: new SampleChatModel(), context, history: [], message, emit: () => {} });
  };

  it('opens the tour and the checklist, and asks which university when it doesn’t know', async () => {
    expect((await ask('Where is the clinic on campus?')).artifacts[0]?.kind).toBe('campus-tour');
    expect((await ask('What do I do in my first week?')).artifacts[0]?.kind).toBe('first-week');
    const unsure = await ask('Show me the campus', []);
    expect(unsure.artifacts).toEqual([]);
    expect(unsure.text).toBe(en.agent.sample.campusAsk);
  });
});

describe('every crisis surface in chat adds the campus lines, verified only', () => {
  const card = (artifacts: ReadonlyArray<{ kind: string }>) =>
    artifacts.find((a) => a.kind === 'crisis-card') as CrisisCardArtifact | undefined;

  it('the crisis reply’s card, the concern card and the crisis_card tool', async () => {
    const offers = [acceptedOffer('wits')];
    for (const message of ['I want to kill myself', 'I feel so hopeless about everything']) {
      const { context } = fakeContext({ catalogue: campusTestView(true), offers });
      const result = await runTurn({
        model: new ScriptedModel([{ say: 'I hear you.' }]),
        context,
        history: [],
        message,
        emit: () => {},
      });
      const lines = card(result.artifacts)?.campus?.lines.map((l) => l.id) ?? [];
      expect(lines, message).toEqual([
        'wits-test-security',
        'wits-test-clinic',
        'wits-test-counselling',
      ]);
    }
    const { context } = fakeContext({ catalogue: campusTestView(true), offers });
    const tool = await runTool(context, 'crisis_card', { topics: ['distress'] });
    expect(card(tool.artifacts)?.campus?.universityName).toBe('Wits');
    expect(tool.forModel).toMatchObject({
      campus_lines: [
        'Test security security (Test Campus)',
        'Test clinic clinic (Test Campus)',
        'Test counselling counselling (Test Campus)',
      ],
    });
  });

  it('none without an accepted offer, and none when the campus has only drafts', async () => {
    const { context } = fakeContext({ catalogue: campusTestView(true) });
    const result = await runTool(context, 'crisis_card', { topics: ['suicide'] });
    expect(card(result.artifacts)?.campus).toBeUndefined();
    const real = fakeContext({ offers: [acceptedOffer('up', 'up-bsc-test')] });
    const turn = await runTurn({
      model: new ScriptedModel([]),
      context: real.context,
      history: [],
      message: 'i want to die',
      emit: () => {},
    });
    expect(card(turn.artifacts)?.campus).toBeUndefined();
  });

  it('still shows the helplines when the offers can’t be read', async () => {
    const { context } = fakeContext({ catalogue: campusTestView(true) });
    const broken = { ...context, offers: () => Promise.reject(new Error('down')) };
    const turn = await runTurn({
      model: new ScriptedModel([]),
      context: broken,
      history: [],
      message: 'i want to die',
      emit: () => {},
    });
    expect(card(turn.artifacts)?.helplines.length).toBeGreaterThan(0);
    expect(card(turn.artifacts)?.campus).toBeUndefined();
  });
});
