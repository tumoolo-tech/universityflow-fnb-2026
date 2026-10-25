import { describe, expect, it } from 'vitest';
import {
  appleMapsLink,
  isSafetyPlaceKind,
  mapsLink,
  normaliseModuleCode,
  offeredIn,
  PLACE_KINDS,
  SAFETY_PLACE_KINDS,
} from './basics';
import {
  type Campus,
  campusSchema,
  type FacultyOffice,
  facultyOfficeSchema,
  type Place,
  placeSchema,
  type RegistrationCalendar,
  registrationCalendarSchema,
} from './campus';
import {
  type CatalogueRecords,
  campusesOf,
  catalogueViewOf,
  curriculumFor,
  facultyOfficeFor,
  placesOn,
  RAW_CATALOGUE,
  registrationCalendarFor,
  safetyPlacesOn,
} from './catalogue';
import type { Curriculum } from './curriculum';

/** Synthetic records only (hard rule 4): made-up names, a landline-shaped number, test pages. */
const TODAY = new Date('2027-12-01T08:00:00Z');
const VERIFIED = { verifiedOn: '2027-11-30', verifiedBy: 'Test Verifier' } as const;
const SOURCE = { sourceUrl: 'https://www.wits.ac.za/test-page/', academicYear: 2028 } as const;

const CAMPUS: Campus = {
  ...SOURCE,
  id: 'wits-test-campus',
  universityId: 'wits',
  name: 'Test Campus',
  city: 'Testville',
  mapUrl: 'https://www.wits.ac.za/test-map.pdf',
};

const place = (id: string, kind: Place['kind'], extra: Partial<Place> = {}): Place => ({
  ...SOURCE,
  id: `wits-${id}`,
  campusId: CAMPUS.id,
  kind,
  name: `Test ${kind}`,
  where: 'Ground floor, Test Building',
  location: { query: 'Test Building, Test Campus' },
  ...extra,
});

const OFFICE: FacultyOffice = {
  ...SOURCE,
  id: 'wits-test-faculty-office',
  universityId: 'wits',
  faculty: 'Science',
  where: 'Room 1, Test Building',
  contactUrl: 'https://www.wits.ac.za/test-contact/',
  email: 'office@example.com',
  phone: '011 000 0000',
};

const CALENDAR: RegistrationCalendar = {
  ...SOURCE,
  universityId: 'wits',
  firstYearRegistration: { from: '2028-01-20', to: '2028-02-05' },
  changeDeadlines: [
    { appliesTo: 'S1', lastDay: '2028-02-20' },
    { appliesTo: 'S2', lastDay: '2028-07-25' },
  ],
  orientation: { from: '2028-02-01', to: '2028-02-07' },
};

describe('place kinds and the maps link', () => {
  it('marks clinic, counselling and security as safety places, and nothing else', () => {
    expect(PLACE_KINDS.filter(isSafetyPlaceKind)).toEqual([...SAFETY_PLACE_KINDS]);
  });

  it('links to the phone’s maps app by coordinates when given, else by the search text', () => {
    expect(mapsLink({ query: 'Test Hall, Testville' })).toBe(
      'https://www.google.com/maps/search/?api=1&query=Test%20Hall%2C%20Testville',
    );
    expect(mapsLink({ query: 'Test Hall', coordinates: { lat: -26.19, lng: 28.03 } })).toBe(
      'https://www.google.com/maps/search/?api=1&query=-26.19%2C28.03',
    );
  });

  it('refuses a location with nothing to search for', () => {
    expect(() => mapsLink({})).toThrow(RangeError);
    expect(() => mapsLink({ query: '  ' })).toThrow(RangeError);
  });

  it('builds the Apple Maps link for an iPhone from the same location (A7-18)', () => {
    expect(appleMapsLink({ query: 'Test Hall, Testville' }, 'Test Clinic')).toBe(
      'https://maps.apple.com/?q=Test%20Hall%2C%20Testville',
    );
    // Coordinates pin the spot; the place's name labels the pin.
    expect(
      appleMapsLink(
        { query: 'Test Hall', coordinates: { lat: -26.19, lng: 28.03 } },
        'Test Clinic & Co',
      ),
    ).toBe('https://maps.apple.com/?ll=-26.19%2C28.03&q=Test%20Clinic%20%26%20Co');
    // No name: the search text labels it, else the coordinates themselves.
    expect(appleMapsLink({ query: 'Test Hall', coordinates: { lat: -26.19, lng: 28.03 } })).toBe(
      'https://maps.apple.com/?ll=-26.19%2C28.03&q=Test%20Hall',
    );
    expect(appleMapsLink({ coordinates: { lat: -26.19, lng: 28.03 } }, '  ')).toBe(
      'https://maps.apple.com/?ll=-26.19%2C28.03&q=-26.19%2C28.03',
    );
    expect(() => appleMapsLink({})).toThrow(RangeError);
    expect(() => appleMapsLink({ query: ' ' }, 'Test Clinic')).toThrow(RangeError);
  });

  it('gives no maps link for a place whose location isn’t published (A13-11)', () => {
    expect(mapsLink(undefined)).toBeNull();
    expect(appleMapsLink(undefined, 'Test Clinic')).toBeNull();
  });
});

describe('module codes and terms', () => {
  it('compares codes without case or spaces', () => {
    expect(normaliseModuleCode(' test 101a ')).toBe('TEST101A');
    expect(normaliseModuleCode('TEST-101')).toBe('TEST-101');
  });

  it('lets an either-semester module run in S1 or S2, and nothing else', () => {
    expect(offeredIn('either', 'S1')).toBe(true);
    expect(offeredIn('either', 'S2')).toBe(true);
    expect(offeredIn('either', 'Y')).toBe(false);
    expect(offeredIn('S1', 'S1')).toBe(true);
    expect(offeredIn('S1', 'S2')).toBe(false);
  });
});

describe('campusSchema', () => {
  it('accepts a sourced campus', () => {
    expect(campusSchema.safeParse(CAMPUS).success).toBe(true);
  });

  it('refuses a source off the university’s own site', () => {
    expect(
      campusSchema.safeParse({ ...CAMPUS, sourceUrl: 'https://www.example.com/wits' }).success,
    ).toBe(false);
  });

  it('refuses an id without its university prefix, and a campus without a source', () => {
    expect(campusSchema.safeParse({ ...CAMPUS, id: 'test-campus' }).success).toBe(false);
    const { sourceUrl: _omitted, ...rest } = CAMPUS;
    expect(campusSchema.safeParse(rest).success).toBe(false);
  });
});

describe('placeSchema', () => {
  it('accepts a place with a search query, coordinates, or both', () => {
    expect(placeSchema.safeParse(place('a', 'library')).success).toBe(true);
    const coordinates = { coordinates: { lat: -26.19, lng: 28.03 } };
    expect(placeSchema.safeParse(place('b', 'food', { location: coordinates })).success).toBe(true);
  });

  it('refuses a location with neither, or outside South Africa (a swapped lat/lng)', () => {
    expect(placeSchema.safeParse(place('a', 'library', { location: {} })).success).toBe(false);
    const swapped = { coordinates: { lat: 28.03, lng: -26.19 } };
    expect(placeSchema.safeParse(place('a', 'library', { location: swapped })).success).toBe(false);
  });

  it('takes a phone number as printed, but not one a phone can’t dial', () => {
    expect(
      placeSchema.safeParse(place('a', 'security', { phone: '+27 11 000 0000' })).success,
    ).toBe(true);
    for (const phone of ['+27 (0)11 000 0000', '011 TEST', '011-000-0000']) {
      expect(placeSchema.safeParse(place('a', 'security', { phone })).success).toBe(false);
    }
  });

  it('refuses an unknown kind', () => {
    expect(placeSchema.safeParse(place('a', 'gym' as never)).success).toBe(false);
  });

  it('leaves out a building and location the source doesn’t print (gotcha 40, A13-11)', () => {
    const {
      where: _w,
      location: _l,
      ...unpublished
    } = place('a', 'clinic', {
      phone: '011 000 0000',
    });
    expect(placeSchema.safeParse(unpublished).success).toBe(true);
    // Given, they still have to say something.
    expect(placeSchema.safeParse(place('a', 'clinic', { where: ' ' })).success).toBe(false);
  });

  it('takes a separate https source for the phone, and only with a phone (A13-11)', () => {
    const phoneSourceUrl = 'https://www.wits.ac.za/test-contacts/';
    expect(
      placeSchema.safeParse(place('a', 'clinic', { phone: '011 000 0000', phoneSourceUrl }))
        .success,
    ).toBe(true);
    expect(placeSchema.safeParse(place('a', 'clinic', { phoneSourceUrl })).success).toBe(false);
    const http = { phone: '011 000 0000', phoneSourceUrl: 'http://www.wits.ac.za/test-contacts/' };
    expect(placeSchema.safeParse(place('a', 'clinic', http)).success).toBe(false);
  });

  it('may name a step-free entrance: a published location, with an optional short description (5e-1)', () => {
    const at = { coordinates: { lat: -26.19, lng: 28.03 } };
    expect(
      placeSchema.safeParse(place('a', 'library', { accessibleEntrance: { location: at } }))
        .success,
    ).toBe(true);
    const described = {
      location: { query: 'Test Building east door' },
      description: 'East door, by the ramp',
    };
    expect(
      placeSchema.safeParse(place('a', 'library', { accessibleEntrance: described })).success,
    ).toBe(true);
    // Never required (gotcha 40): a place without one is still a place.
    expect(placeSchema.safeParse(place('a', 'library')).success).toBe(true);
    // Given, it needs somewhere to go, inside South Africa, and words that say something.
    for (const accessibleEntrance of [
      {},
      { location: {} },
      { location: { coordinates: { lat: 28.03, lng: -26.19 } } },
      { location: at, description: ' ' },
      { location: at, description: 'x'.repeat(201) },
    ]) {
      expect(
        placeSchema.safeParse(place('a', 'library', { accessibleEntrance } as never)).success,
        JSON.stringify(accessibleEntrance),
      ).toBe(false);
    }
  });

  it('may carry an arrival note for the last metres, with its own https source (5e-4)', () => {
    const arrivalNote = 'The ramp is to the left of the main doors.';
    expect(placeSchema.safeParse(place('a', 'library', { arrivalNote })).success).toBe(true);
    const arrivalSourceUrl = 'https://www.wits.ac.za/test-disability-unit/';
    expect(
      placeSchema.safeParse(place('a', 'library', { arrivalNote, arrivalSourceUrl })).success,
    ).toBe(true);
    // Too short to guide anyone, a source without a note, or a plain-http source: refused.
    expect(placeSchema.safeParse(place('a', 'library', { arrivalNote: 'Ramp' })).success).toBe(
      false,
    );
    expect(placeSchema.safeParse(place('a', 'library', { arrivalSourceUrl })).success).toBe(false);
    const http = { arrivalNote, arrivalSourceUrl: 'http://www.wits.ac.za/test-disability-unit/' };
    expect(placeSchema.safeParse(place('a', 'library', http)).success).toBe(false);
  });
});

describe('facultyOfficeSchema', () => {
  it('accepts a sourced office', () => {
    expect(facultyOfficeSchema.safeParse(OFFICE).success).toBe(true);
  });

  it('refuses a contact page off the university’s own site', () => {
    const off = { ...OFFICE, contactUrl: 'https://www.example.com/contact' };
    expect(facultyOfficeSchema.safeParse(off).success).toBe(false);
  });

  it('refuses another university’s campus, a bad email and a missing prefix', () => {
    expect(facultyOfficeSchema.safeParse({ ...OFFICE, campusId: 'uj-test' }).success).toBe(false);
    expect(facultyOfficeSchema.safeParse({ ...OFFICE, campusId: 'wits-test' }).success).toBe(true);
    expect(facultyOfficeSchema.safeParse({ ...OFFICE, email: 'not-an-email' }).success).toBe(false);
    expect(facultyOfficeSchema.safeParse({ ...OFFICE, id: 'test-office' }).success).toBe(false);
  });
});

describe('registrationCalendarSchema', () => {
  it('accepts a calendar, with or without orientation week', () => {
    expect(registrationCalendarSchema.safeParse(CALENDAR).success).toBe(true);
    const { orientation: _o, ...withoutOrientation } = CALENDAR;
    expect(registrationCalendarSchema.safeParse(withoutOrientation).success).toBe(true);
  });

  it('refuses a window that ends before it starts', () => {
    const bad = { ...CALENDAR, firstYearRegistration: { from: '2028-02-05', to: '2028-01-20' } };
    expect(registrationCalendarSchema.safeParse(bad).success).toBe(false);
  });

  it('takes a closing date alone, so an unpublished opening date is never filled in', () => {
    const closeOnly = { ...CALENDAR, firstYearRegistration: { to: '2028-02-05' } };
    expect(registrationCalendarSchema.safeParse(closeOnly).success).toBe(true);
    const noClose = { ...CALENDAR, firstYearRegistration: { from: '2028-01-20' } };
    expect(registrationCalendarSchema.safeParse(noClose).success).toBe(false);
  });

  it('refuses two deadlines for one scope', () => {
    const twice = {
      ...CALENDAR,
      changeDeadlines: [
        { appliesTo: 'all', lastDay: '2028-02-20' },
        { appliesTo: 'all', lastDay: '2028-02-21' },
      ],
    };
    expect(registrationCalendarSchema.safeParse(twice).success).toBe(false);
  });

  it('takes a calendar that publishes no change deadline, rather than forcing a guessed one (gotcha 40)', () => {
    // UJ's 2027 calendar prints registration but no last day to change modules.
    expect(registrationCalendarSchema.safeParse({ ...CALENDAR, changeDeadlines: [] }).success).toBe(
      true,
    );
  });

  it('refuses dates outside the academic year, and a deadline before registration opens', () => {
    const late = { ...CALENDAR, orientation: { from: '2029-02-01', to: '2029-02-07' } };
    expect(registrationCalendarSchema.safeParse(late).success).toBe(false);
    const early = { ...CALENDAR, changeDeadlines: [{ appliesTo: 'all', lastDay: '2028-01-01' }] };
    expect(registrationCalendarSchema.safeParse(early).success).toBe(false);
  });

  it('refuses a source off the university’s own site', () => {
    const off = { ...CALENDAR, sourceUrl: 'https://www.uj.ac.za/test-page/' };
    expect(registrationCalendarSchema.safeParse(off).success).toBe(false);
  });
});

describe('the view over campus records (hard rule 3)', () => {
  const programme = RAW_CATALOGUE.programmes.find((p) => p.id === 'wits-bsc-computer-science');
  if (!programme) throw new Error('fixture programme missing');
  const curriculum: Curriculum = {
    ...SOURCE,
    programmeId: programme.id,
    yearOfStudy: 1,
    modules: [
      { code: 'TEST101', name: 'Test Module', semester: 'S1', credits: 18, compulsory: true },
    ],
    electiveGroups: [],
    totalCredits: { min: 18, max: 18 },
  };
  const verified = <T>(r: T): T => ({ ...r, ...VERIFIED });
  const wits = verified(RAW_CATALOGUE.universities.find((u) => u.id === 'wits'));
  if (!wits) throw new Error('fixture university missing');

  const records = (over: Partial<CatalogueRecords>): CatalogueRecords => ({
    ...RAW_CATALOGUE,
    universities: [wits],
    programmes: [verified(programme)],
    ...over,
  });

  it('hides draft campus records from learners, and shows them only in preview', () => {
    const all = records({
      campuses: [CAMPUS],
      places: [place('library', 'library')],
      facultyOffices: [OFFICE],
      registrationCalendars: [CALENDAR],
      curricula: [curriculum],
    });
    const learners = catalogueViewOf(all, TODAY, { includeDrafts: false });
    expect(learners.campuses).toEqual([]);
    expect(learners.places).toEqual([]);
    expect(learners.facultyOffices).toEqual([]);
    expect(learners.registrationCalendars).toEqual([]);
    expect(learners.curricula).toEqual([]);
    const preview = catalogueViewOf(all, TODAY, { includeDrafts: true });
    expect(preview.campuses).toHaveLength(1);
    expect(preview.places).toHaveLength(1);
    expect(preview.facultyOffices).toHaveLength(1);
    expect(preview.registrationCalendars).toHaveLength(1);
    expect(preview.curricula).toHaveLength(1);
  });

  it('never returns a draft clinic, counselling or security place, even in preview', () => {
    const drafts = SAFETY_PLACE_KINDS.map((kind) => place(`draft-${kind}`, kind));
    const all = records({ campuses: [verified(CAMPUS)], places: drafts });
    for (const includeDrafts of [false, true]) {
      const view = catalogueViewOf(all, TODAY, { includeDrafts });
      expect(view.places).toEqual([]);
      expect(safetyPlacesOn(view, CAMPUS.id)).toEqual([]);
    }
  });

  it('returns a verified safety place, but not one verified in the future', () => {
    const clinic = verified(place('clinic', 'clinic', { phone: '011 000 0000' }));
    const tomorrow = { ...clinic, id: 'wits-later', verifiedOn: '2027-12-02' };
    const all = records({ campuses: [verified(CAMPUS)], places: [clinic, tomorrow] });
    for (const includeDrafts of [false, true]) {
      const view = catalogueViewOf(all, TODAY, { includeDrafts });
      expect(safetyPlacesOn(view, CAMPUS.id).map((p) => p.id)).toEqual([clinic.id]);
    }
  });

  it('keeps safety places apart from the rest of the campus', () => {
    const all = records({
      campuses: [CAMPUS],
      places: [verified(place('security', 'security')), place('library', 'library')],
    });
    const view = catalogueViewOf(all, TODAY, { includeDrafts: true });
    expect(placesOn(view, CAMPUS.id).map((p) => p.kind)).toEqual(['security', 'library']);
    expect(safetyPlacesOn(view, CAMPUS.id).map((p) => p.kind)).toEqual(['security']);
  });

  it('shows a place only with its campus, and a campus only with its university', () => {
    const all = records({
      universities: [RAW_CATALOGUE.universities.find((u) => u.id === 'wits') as never],
      campuses: [verified(CAMPUS)],
      places: [verified(place('library', 'library'))],
      registrationCalendars: [verified(CALENDAR)],
      facultyOffices: [verified(OFFICE)],
    });
    const view = catalogueViewOf(all, TODAY, { includeDrafts: false });
    expect(view.campuses).toEqual([]);
    expect(view.places).toEqual([]);
    expect(view.registrationCalendars).toEqual([]);
    expect(view.facultyOffices).toEqual([]);
  });

  it('shows a curriculum only with its programme', () => {
    const all = records({ programmes: [programme], curricula: [verified(curriculum)] });
    expect(catalogueViewOf(all, TODAY, { includeDrafts: false }).curricula).toEqual([]);
  });

  it('looks campus records up', () => {
    const older = { ...CALENDAR, academicYear: 2027 };
    const all = records({
      campuses: [CAMPUS],
      places: [place('library', 'library')],
      facultyOffices: [OFFICE],
      registrationCalendars: [older, CALENDAR],
      curricula: [curriculum, { ...curriculum, academicYear: 2027 }],
    });
    const view = catalogueViewOf(all, TODAY, { includeDrafts: true });
    expect(campusesOf(view, 'wits').map((c) => c.id)).toEqual([CAMPUS.id]);
    expect(campusesOf(view, 'uj')).toEqual([]);
    expect(facultyOfficeFor(view, programme)?.id).toBe(OFFICE.id);
    expect(facultyOfficeFor(view, { ...programme, faculty: 'Test Faculty' })).toBeUndefined();
    // A record for the year asked about, never another year's (A1-26, A13-02).
    expect(registrationCalendarFor(view, 'wits', 2028)?.academicYear).toBe(2028);
    expect(registrationCalendarFor(view, 'wits', 2027)?.academicYear).toBe(2027);
    expect(registrationCalendarFor(view, 'wits', 2029)).toBeUndefined();
    expect(registrationCalendarFor(view, 'uj', 2028)).toBeUndefined();
    expect(curriculumFor(view, programme.id, 2028)?.academicYear).toBe(2028);
    expect(curriculumFor(view, programme.id, 2027)?.academicYear).toBe(2027);
    expect(curriculumFor(view, programme.id, 2029)).toBeUndefined();
    expect(curriculumFor(view, 'wits-nope', 2028)).toBeUndefined();
  });
});
