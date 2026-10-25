import { describe, expect, it } from 'vitest';
import {
  buildCvProfile,
  type CvEntryRecord,
  type CvSelection,
  type CvSources,
  EMPTY_SELECTION,
} from './build';
import { validateCvProfile } from './profile';

/**
 * `buildCvProfile` (§3.3, §10.1): the learner's confirmed rows and own entries, mapped to
 * `uf-cv-profile/1`, only what they ticked. Hard rule 3: a catalogue name only from a verified
 * record. Hard rule 6: only confirmed rows. D11: marks off unless ticked. D9: contact details only
 * as typed on the CV page. Synthetic learners only.
 */

const verified = (name: string) => ({ name, verified: true });
const draft = (name: string) => ({ name, verified: false });

const project: CvEntryRecord = {
  id: 'e1',
  kind: 'project',
  title: 'Campus bus tracker',
  organisation: null,
  role: 'Solo developer',
  startDate: '2027-03',
  endDate: '2027-05',
  description: 'Shows when the next campus bus leaves.',
  highlights: ['Used by my residence'],
  keywords: ['Python'],
  evidence: [{ kind: 'repository', url: 'https://github.com/example-learner/bus', label: 'Code' }],
  linkedModules: ['EXA1A10'],
  position: 0,
};

function sources(overrides: Partial<CvSources> = {}): CvSources {
  return {
    firstName: 'Thandi',
    schoolName: 'Example High School',
    schoolEndYear: 2026,
    report: {
      id: 'r1',
      confirmed: true,
      marks: [
        { subjectId: 'mathematics', subjectName: 'Mathematics', percent: 78 },
        { subjectId: 'english-hl', subjectName: 'English Home Language', percent: 66 },
      ],
    },
    acceptedOffer: null,
    registrations: [],
    entries: [project],
    ...overrides,
  };
}

const select = (overrides: Partial<CvSelection> = {}): CvSelection => ({
  ...EMPTY_SELECTION,
  includeSchool: true,
  ...overrides,
});

describe('buildCvProfile (§3.3)', () => {
  it('makes a valid profile from what was ticked, and nothing else', () => {
    const built = buildCvProfile(sources(), select({ entryIds: ['e1'], surname: 'Example' }));
    expect(built.ready).toBe(true);
    expect(validateCvProfile(built.profile)).toMatchObject({ ok: true });
    expect(built.profile.basics.name).toBe('Thandi Example');
    expect(built.profile.projects).toEqual([
      expect.objectContaining({
        name: 'Campus bus tracker',
        url: 'https://github.com/example-learner/bus',
        roles: ['Solo developer'],
        xLinkedModules: ['EXA1A10'],
      }),
    ]);
    const unticked = buildCvProfile(sources(), select());
    expect(unticked.profile.projects ?? []).toEqual([]);
  });

  it('leaves marks off unless the learner ticks a subject (D11)', () => {
    const off = buildCvProfile(sources(), select());
    expect(off.profile.education?.[0]).not.toHaveProperty('xSubjects');
    expect(JSON.stringify(off.profile)).not.toContain('78');
    const on = buildCvProfile(sources(), select({ subjectIds: ['mathematics'] }));
    expect(on.profile.education?.[0]?.xSubjects).toEqual([{ name: 'Mathematics', result: '78%' }]);
    expect(on.profile.education?.[0]?.xSource).toBe('confirmed-report');
  });

  it('never uses a report the learner has not confirmed (hard rule 6)', () => {
    const built = buildCvProfile(
      sources({
        report: {
          id: 'r1',
          confirmed: false,
          marks: [{ subjectId: 'mathematics', subjectName: 'Mathematics', percent: 78 }],
        },
      }),
      select({ subjectIds: ['mathematics'] }),
    );
    expect(JSON.stringify(built.profile)).not.toContain('78%');
    expect(built.omitted).toContainEqual({ source: 'report', reason: 'unconfirmed' });
  });

  it('names a university, course or module from the catalogue only when the record is verified (hard rule 3)', () => {
    const built = buildCvProfile(
      sources({
        acceptedOffer: {
          id: 'o1',
          confirmed: true,
          universityId: 'uni',
          programmeId: 'prog',
          institution: draft('Draft University'),
          programme: verified('BSc Computer Science'),
          startYear: 2027,
        },
        registrations: [
          {
            id: 'g1',
            confirmed: true,
            universityId: 'other',
            programmeId: 'p2',
            academicYear: 2027,
            institution: verified('Example University'),
            programme: draft('Draft Programme'),
            modules: [
              {
                code: 'EXA1A10',
                name: null,
                catalogueName: draft('Draft Module'),
                term: 'S1',
                credits: 15,
              },
              {
                code: 'EXA1B20',
                name: null,
                catalogueName: verified('Data Structures'),
                term: 'S2',
                credits: 15,
              },
              {
                code: 'EXA1C30',
                name: 'My own name for it',
                catalogueName: draft('Other'),
                term: null,
                credits: null,
              },
            ],
          },
        ],
      }),
      select({ includeOffer: true, moduleCodes: ['EXA1A10', 'EXA1B20', 'EXA1C30'] }),
    );
    const text = JSON.stringify(built.profile);
    for (const word of ['Draft University', 'Draft Programme', 'Draft Module', '"Other"']) {
      expect(text).not.toContain(word);
    }
    // The offer's university is a draft: no institution to name, so no offer entry at all.
    expect(built.profile.education?.map((e) => e.xSource)).toEqual([
      'confirmed-registration',
      'learner',
    ]);
    expect(built.omitted).toContainEqual({ source: 'offer', reason: 'unverified' });
    const uni = built.profile.education?.[0];
    expect(uni).toMatchObject({ institution: 'Example University', startDate: '2027' });
    expect(uni).not.toHaveProperty('area');
    expect(uni?.xModules).toEqual([
      // No confirmed or verified name: the code stands as the name (Mmereko needs one).
      { code: 'EXA1A10', name: 'EXA1A10', year: 2027, term: 'S1', credits: 15, result: null },
      {
        code: 'EXA1B20',
        name: 'Data Structures',
        year: 2027,
        term: 'S2',
        credits: 15,
        result: null,
      },
      {
        code: 'EXA1C30',
        name: 'My own name for it',
        year: 2027,
        term: null,
        credits: null,
        result: null,
      },
    ]);
    expect(uni?.courses).toEqual([
      'EXA1A10',
      'EXA1B20 Data Structures',
      'EXA1C30 My own name for it',
    ]);
  });

  it('names the accepted offer when its records are verified and no registration covers it', () => {
    const built = buildCvProfile(
      sources({
        acceptedOffer: {
          id: 'o1',
          confirmed: true,
          universityId: 'uni',
          programmeId: 'prog',
          institution: verified('Example University'),
          programme: verified('BSc Computer Science'),
          startYear: 2027,
        },
      }),
      select({ includeOffer: true }),
    );
    expect(built.profile.education?.[0]).toEqual({
      institution: 'Example University',
      area: 'BSc Computer Science',
      startDate: '2027',
      endDate: null,
      xSource: 'confirmed-offer',
    });
  });

  it('puts contact details on only as the learner typed them on the CV page (D9)', () => {
    const none = buildCvProfile(sources(), select());
    expect(none.profile.basics).toMatchObject({ email: null, phone: null });
    const typed = buildCvProfile(
      sources(),
      select({ email: 'thandi@example.org', phone: `080 ${'555'} ${'0101'}`, city: 'Durban' }),
    );
    expect(typed.profile.basics).toMatchObject({
      email: 'thandi@example.org',
      phone: `080 ${'555'} ${'0101'}`,
      location: { city: 'Durban', countryCode: 'ZA' },
    });
  });

  it('is not ready without a name or any education (§11, partial profile)', () => {
    const nameless = buildCvProfile(sources({ firstName: null }), select());
    expect(nameless.ready).toBe(false);
    expect(nameless.missing).toContain('name');
    const nothing = buildCvProfile(sources({ schoolName: null, report: null }), select());
    expect(nothing.ready).toBe(false);
    expect(nothing.missing).toContain('education');
  });

  it('maps every kind of entry the learner can add', () => {
    const base = {
      organisation: 'Example Org',
      role: 'Helper',
      startDate: '2026-01',
      endDate: null,
      description: 'Words.',
      highlights: [],
      keywords: ['K'],
      evidence: [],
      linkedModules: [],
      position: 0,
    };
    const entries: CvEntryRecord[] = [
      { ...base, id: 'w', kind: 'work', title: 'Shop assistant', position: 1 },
      { ...base, id: 'v', kind: 'volunteer', title: 'Reading buddy', position: 2 },
      { ...base, id: 's', kind: 'skill', title: 'Programming', position: 3 },
      { ...base, id: 'a', kind: 'award', title: 'Science fair', position: 4 },
      { ...base, id: 'l', kind: 'language', title: 'isiZulu', role: 'Native', position: 5 },
      { ...base, id: 'c', kind: 'certificate', title: 'First aid', position: 6 },
    ];
    const built = buildCvProfile(
      sources({ entries }),
      select({ entryIds: entries.map((e) => e.id) }),
    );
    expect(validateCvProfile(built.profile)).toMatchObject({ ok: true });
    expect(built.profile.work).toEqual([
      expect.objectContaining({ name: 'Example Org', position: 'Shop assistant' }),
    ]);
    expect(built.profile.volunteer).toEqual([
      expect.objectContaining({ organization: 'Example Org', position: 'Reading buddy' }),
    ]);
    expect(built.profile.skills).toEqual([{ name: 'Programming', keywords: ['K'] }]);
    expect(built.profile.awards).toEqual([
      expect.objectContaining({ title: 'Science fair', awarder: 'Example Org', date: '2026-01' }),
    ]);
    expect(built.profile.languages).toEqual([{ language: 'isiZulu', fluency: 'Native' }]);
    expect(built.profile.certificates).toEqual([
      expect.objectContaining({ name: 'First aid', issuer: 'Example Org' }),
    ]);
  });
});
