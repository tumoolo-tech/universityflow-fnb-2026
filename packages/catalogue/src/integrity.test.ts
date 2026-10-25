import { describe, expect, it } from 'vitest';
import type { Campus, FacultyOffice, Place, RegistrationCalendar } from './campus';
import { type CatalogueRecords, RAW_CATALOGUE } from './catalogue';
import type { Curriculum } from './curriculum';
import { catalogueProblems } from './integrity';

/**
 * The research agents add Phase 5 records to data/<university>-orientation.ts and
 * data/<university>-curricula.ts only. These tests run `catalogueProblems` over the whole
 * catalogue, so whatever they add is validated here without a test being touched; the synthetic
 * cases prove each check fires.
 */

const SOURCE = { sourceUrl: 'https://www.uct.ac.za/test-page/', academicYear: 2028 } as const;
const CAMPUS: Campus = {
  ...SOURCE,
  id: 'uct-test-campus',
  universityId: 'uct',
  name: 'Test Campus',
  city: 'Testville',
};
const PLACE: Place = {
  ...SOURCE,
  id: 'uct-test-library',
  campusId: CAMPUS.id,
  kind: 'library',
  name: 'Test Library',
  where: 'Test Building',
  location: { query: 'Test Library, Testville' },
};
const programme = RAW_CATALOGUE.programmes.find((p) => p.universityId === 'uct');
if (!programme) throw new Error('fixture programme missing');
const OFFICE: FacultyOffice = {
  ...SOURCE,
  id: 'uct-test-office',
  universityId: 'uct',
  faculty: programme.faculty,
  campusId: CAMPUS.id,
  where: 'Test Building',
  contactUrl: 'https://www.uct.ac.za/test-contact/',
};
const CALENDAR: RegistrationCalendar = {
  ...SOURCE,
  universityId: 'uct',
  firstYearRegistration: { from: '2028-01-20', to: '2028-02-05' },
  changeDeadlines: [{ appliesTo: 'all', lastDay: '2028-02-20' }],
};
const CURRICULUM: Curriculum = {
  ...SOURCE,
  programmeId: programme.id,
  yearOfStudy: 1,
  modules: [{ code: 'TEST101', name: 'Test', semester: 'S1', credits: 18, compulsory: true }],
  electiveGroups: [],
  totalCredits: { min: 18, max: 18 },
};

const plus = (over: Partial<CatalogueRecords>): CatalogueRecords => ({
  ...RAW_CATALOGUE,
  campuses: [CAMPUS],
  places: [PLACE],
  facultyOffices: [OFFICE],
  registrationCalendars: [CALENDAR],
  curricula: [CURRICULUM],
  // Safety notes have their own synthetic cases (safety.test.ts).
  safetyAdvice: [],
  ...over,
});

describe('every campus, registration and curriculum record in the data files', () => {
  it('validates, cites its university’s own site and points at records that exist', () => {
    expect(catalogueProblems(RAW_CATALOGUE)).toEqual([]);
  });

  it('accepts a sound synthetic set of one of each', () => {
    expect(catalogueProblems(plus({}))).toEqual([]);
  });

  it('a curriculum whose note says unlisted modules count records open elective credits (A1-27)', () => {
    const open = /any other Faculty|any Level 1 elective|not a closed list|"suggested"/i;
    const saying = RAW_CATALOGUE.curricula.filter((c) => c.note && open.test(c.note));
    expect(saying.length).toBeGreaterThan(0);
    for (const c of saying) expect(c.openElectiveCredits, c.programmeId).toBeDefined();
  });

  it('no curriculum note still says a group can’t hold a learner to a whole pair (A13-05)', () => {
    for (const c of RAW_CATALOGUE.curricula) {
      expect(c.note ?? '', c.programmeId).not.toMatch(/can.t hold a learner to a whole pair/);
    }
  });
});

describe('catalogueProblems catches', () => {
  it('a record that doesn’t validate', () => {
    const problems = catalogueProblems(plus({ campuses: [{ ...CAMPUS, name: '' }] }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^campus uct-test-campus doesn't validate/);
    for (const over of [
      { places: [{ ...PLACE, kind: 'gym' as never }] },
      { facultyOffices: [{ ...OFFICE, where: '' }] },
      // Registration that ends before it starts (no change deadline at all is valid: gotcha 40).
      {
        registrationCalendars: [
          { ...CALENDAR, firstYearRegistration: { from: '2028-02-10', to: '2028-01-20' } },
        ],
      },
      { curricula: [{ ...CURRICULUM, modules: [] }] },
    ]) {
      expect(catalogueProblems(plus(over)).join()).toMatch(/doesn't validate/);
    }
  });

  it('an id used twice', () => {
    expect(catalogueProblems(plus({ campuses: [CAMPUS, CAMPUS] }))).toEqual([
      'campus uct-test-campus appears twice',
    ]);
    expect(catalogueProblems(plus({ places: [PLACE, PLACE] }))).toEqual([
      'place uct-test-library appears twice',
    ]);
    expect(catalogueProblems(plus({ facultyOffices: [OFFICE, OFFICE] }))).toEqual([
      'faculty office uct-test-office appears twice',
    ]);
    expect(catalogueProblems(plus({ registrationCalendars: [CALENDAR, CALENDAR] }))).toEqual([
      'registration calendar uct 2028 appears twice',
    ]);
    expect(catalogueProblems(plus({ curricula: [CURRICULUM, CURRICULUM] }))).toEqual([
      `curriculum ${programme.id} 2028 appears twice`,
    ]);
  });

  it('a place on a campus that doesn’t exist, or named for another university', () => {
    expect(catalogueProblems(plus({ places: [{ ...PLACE, campusId: 'uct-nowhere' }] }))).toEqual([
      'place uct-test-library: no campus uct-nowhere',
    ]);
    expect(catalogueProblems(plus({ places: [{ ...PLACE, id: 'wits-test-library' }] }))).toEqual([
      "place wits-test-library: id doesn't start with uct-",
    ]);
  });

  it('a place or curriculum sourced off the university’s own site', () => {
    const offSite = { sourceUrl: 'https://www.wits.ac.za/test-page/' };
    expect(catalogueProblems(plus({ places: [{ ...PLACE, ...offSite }] }))).toEqual([
      "place uct-test-library: source isn't on uct's own site",
    ]);
    expect(catalogueProblems(plus({ curricula: [{ ...CURRICULUM, ...offSite }] }))).toEqual([
      `curriculum ${programme.id} 2028: source isn't on uct's own site`,
    ]);
  });

  it('a place whose phone is sourced off the university’s own site (A13-11)', () => {
    const phone = { phone: '021 000 0000' };
    const own = { ...PLACE, ...phone, phoneSourceUrl: 'https://www.uct.ac.za/test-contacts/' };
    expect(catalogueProblems(plus({ places: [own] }))).toEqual([]);
    const off = { ...own, phoneSourceUrl: 'https://www.wits.ac.za/test-contacts/' };
    expect(catalogueProblems(plus({ places: [off] }))).toEqual([
      "place uct-test-library: phone source isn't on uct's own site",
    ]);
  });

  it('an arrival note sourced off the university’s own site (5e-4)', () => {
    const note = { arrivalNote: 'The ramp is to the left of the main doors.' };
    const own = { ...PLACE, ...note, arrivalSourceUrl: 'https://www.uct.ac.za/test-disability/' };
    expect(catalogueProblems(plus({ places: [own] }))).toEqual([]);
    const off = { ...own, arrivalSourceUrl: 'https://www.wits.ac.za/test-disability/' };
    expect(catalogueProblems(plus({ places: [off] }))).toEqual([
      "place uct-test-library: arrival note source isn't on uct's own site",
    ]);
  });

  it('a place whose walking link would be too long to send (5e-1)', () => {
    const long = { ...PLACE, location: { query: `Test Library ${'a'.repeat(2100)}` } };
    expect(catalogueProblems(plus({ places: [long] }))).toEqual([
      'place uct-test-library: its walking link would be over 2048 characters',
    ]);
    const entrance = {
      ...PLACE,
      accessibleEntrance: { location: { query: `Test door ${'a'.repeat(2100)}` } },
    };
    expect(catalogueProblems(plus({ places: [entrance] }))).toEqual([
      'place uct-test-library: its step-free walking link would be over 2048 characters',
    ]);
    // A location with nothing to go to is the schema's problem, said once.
    const nowhere = catalogueProblems(plus({ places: [{ ...PLACE, location: {} }] }));
    expect(nowhere).toHaveLength(1);
    expect(nowhere[0]).toMatch(/doesn't validate/);
  });

  it('a faculty office for a faculty no programme uses, or on another university’s campus', () => {
    expect(
      catalogueProblems(plus({ facultyOffices: [{ ...OFFICE, faculty: 'Faculty of Testing' }] })),
    ).toEqual(['faculty office uct-test-office: no uct programme is in "Faculty of Testing"']);
    expect(
      catalogueProblems(plus({ facultyOffices: [{ ...OFFICE, campusId: 'uct-elsewhere' }] })),
    ).toEqual(['faculty office uct-test-office: no uct campus uct-elsewhere']);
  });

  it('a record for a university or programme the catalogue doesn’t hold', () => {
    const noUniversity = { ...RAW_CATALOGUE, universities: [] };
    expect(catalogueProblems({ ...plus({}), universities: noUniversity.universities })).toEqual([
      'campus uct-test-campus: no university uct',
      'registration calendar: no university uct',
    ]);
    expect(
      catalogueProblems(plus({ curricula: [{ ...CURRICULUM, programmeId: 'uct-test-nope' }] })),
    ).toEqual(['curriculum uct-test-nope 2028: no programme uct-test-nope in the catalogue']);
  });
});
