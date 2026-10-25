import { describe, expect, it } from 'vitest';
import {
  catalogueView,
  programmeById,
  RAW_CATALOGUE,
  universityById,
  windowFor,
} from './catalogue';
import { isDraft } from './provenance';
import {
  applicationWindowSchema,
  helplineSchema,
  isOptionsRequirement,
  isUniversitySource,
  nsfasSchema,
  programmeSchema,
  UNIVERSITY_DOMAINS,
  UNIVERSITY_IDS,
  type UniversityId,
  universitySchema,
} from './records';

const TODAY = new Date('2026-10-13T08:00:00Z');

describe('catalogue data (hard rule 3: every record sourced)', () => {
  it.each(RAW_CATALOGUE.universities.map((u) => [u.id, u]))('%s validates', (_id, record) => {
    expect(universitySchema.parse(record)).toBeTruthy();
  });

  it.each(RAW_CATALOGUE.programmes.map((p) => [p.id, p]))('%s validates', (_id, record) => {
    expect(programmeSchema.parse(record)).toBeTruthy();
  });

  it.each(RAW_CATALOGUE.windows.map((w) => [w.universityId, w]))(
    '%s application window validates',
    (_id, record) => {
      expect(applicationWindowSchema.parse(record)).toBeTruthy();
    },
  );

  it('validates NSFAS and every helpline', () => {
    expect(nsfasSchema.parse(RAW_CATALOGUE.nsfas)).toBeTruthy();
    for (const line of RAW_CATALOGUE.helplines) expect(helplineSchema.parse(line)).toBeTruthy();
  });

  it('covers the six launch universities, each with a window and programmes', () => {
    expect(RAW_CATALOGUE.universities.map((u) => u.id).sort()).toEqual([...UNIVERSITY_IDS].sort());
    for (const id of UNIVERSITY_IDS) {
      expect(RAW_CATALOGUE.windows.filter((w) => w.universityId === id)).toHaveLength(1);
      expect(RAW_CATALOGUE.programmes.filter((p) => p.universityId === id).length).toBeGreaterThan(
        8,
      );
    }
  });

  it('gives every programme a unique id prefixed with its university', () => {
    const ids = RAW_CATALOGUE.programmes.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of RAW_CATALOGUE.programmes)
      expect(p.id.startsWith(`${p.universityId}-`)).toBe(true);
  });

  it('cites only official sources: each record links to its own institution', () => {
    // UKZN's applications run through the CAO, so its application records may cite it.
    const applications = (id: UniversityId, url: string) =>
      isUniversitySource(id, url) || (id === 'ukzn' && new URL(url).hostname.endsWith('cao.ac.za'));
    const records = [
      ...RAW_CATALOGUE.programmes,
      ...RAW_CATALOGUE.windows,
      ...RAW_CATALOGUE.universities,
    ];
    for (const record of records) {
      const id = 'universityId' in record ? record.universityId : record.id;
      expect(applications(id, record.sourceUrl)).toBe(true);
    }
  });

  it('cites only the university’s own site for campus, registration and curriculum records', () => {
    const campusOf = new Map(RAW_CATALOGUE.campuses.map((c) => [c.id, c.universityId]));
    const programmeOf = new Map(RAW_CATALOGUE.programmes.map((p) => [p.id, p.universityId]));
    const cited: ReadonlyArray<readonly [UniversityId | undefined, string]> = [
      ...RAW_CATALOGUE.campuses.map((c) => [c.universityId, c.sourceUrl] as const),
      ...RAW_CATALOGUE.places.map((p) => [campusOf.get(p.campusId), p.sourceUrl] as const),
      ...RAW_CATALOGUE.facultyOffices.flatMap((o) => [
        [o.universityId, o.sourceUrl] as const,
        [o.universityId, o.contactUrl] as const,
      ]),
      ...RAW_CATALOGUE.registrationCalendars.map((c) => [c.universityId, c.sourceUrl] as const),
      ...RAW_CATALOGUE.curricula.map((c) => [programmeOf.get(c.programmeId), c.sourceUrl] as const),
    ];
    for (const [id, url] of cited) {
      expect(id, url).toBeDefined();
      expect(isUniversitySource(id as UniversityId, url), url).toBe(true);
    }
    // The CAO is an application route, not a campus: UKZN's campus records cite ukzn.ac.za.
    expect(isUniversitySource('ukzn', 'https://www.cao.ac.za/')).toBe(false);
    expect(isUniversitySource('ukzn', 'https://applications.ukzn.ac.za/')).toBe(true);
    expect(isUniversitySource('wits', 'https://wits.ac.za.example.com/')).toBe(false);
    expect(Object.keys(UNIVERSITY_DOMAINS).sort()).toEqual([...UNIVERSITY_IDS].sort());
  });

  it('never repeats a subject inside one requirement option', () => {
    for (const p of RAW_CATALOGUE.programmes) {
      for (const r of p.subjectRequirements.filter(isOptionsRequirement)) {
        for (const o of r.options) expect(new Set(o.subjects).size).toBe(o.subjects.length);
      }
    }
  });

  it('holds a programme closing date no later than its university closes', () => {
    for (const p of RAW_CATALOGUE.programmes) {
      const window = RAW_CATALOGUE.windows.find((w) => w.universityId === p.universityId);
      if (p.closesOn && window) expect(p.closesOn <= window.closesOn).toBe(true);
    }
  });
});

describe('catalogueView (unverified never reaches a student)', () => {
  it('holds every researched record as a draft until a person verifies it', () => {
    const records = [
      ...RAW_CATALOGUE.universities,
      ...RAW_CATALOGUE.programmes,
      ...RAW_CATALOGUE.windows,
      ...RAW_CATALOGUE.helplines,
      ...RAW_CATALOGUE.examPapers,
      RAW_CATALOGUE.nsfas,
      ...RAW_CATALOGUE.campuses,
      ...RAW_CATALOGUE.places,
      ...RAW_CATALOGUE.facultyOffices,
      ...RAW_CATALOGUE.registrationCalendars,
      ...RAW_CATALOGUE.curricula,
    ];
    expect(records.every(isDraft)).toBe(true);
  });

  it('shows students nothing while every record is a draft', () => {
    const view = catalogueView(TODAY, { includeDrafts: false });
    expect(view.universities).toEqual([]);
    expect(view.programmes).toEqual([]);
    expect(view.windows).toEqual([]);
    expect(view.helplines).toEqual([]);
    expect(view.campuses).toEqual([]);
    expect(view.places).toEqual([]);
    expect(view.facultyOffices).toEqual([]);
    expect(view.registrationCalendars).toEqual([]);
    expect(view.curricula).toEqual([]);
    expect(view.nsfas).toBeNull();
    expect(view.includesDrafts).toBe(false);
  });

  it('includes drafts only when asked, and says so', () => {
    const view = catalogueView(TODAY, { includeDrafts: true });
    expect(view.universities).toHaveLength(6);
    expect(view.programmes.length).toBe(RAW_CATALOGUE.programmes.length);
    expect(view.includesDrafts).toBe(true);
  });

  it('looks records up by id', () => {
    const view = catalogueView(TODAY, { includeDrafts: true });
    expect(universityById(view, 'uct')?.shortName).toBe('UCT');
    expect(programmeById(view, 'wits-bsc-computer-science')?.minimumScore).toBe(44);
    expect(windowFor(view, 'uj')?.feeZar).toBe(0);
    expect(programmeById(view, 'nope')).toBeUndefined();
  });
});
