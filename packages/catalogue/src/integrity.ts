import { appleWalkingLink, MAX_LINK_LENGTH, type MapLocation, walkingLink } from './basics';
import {
  campusSchema,
  facultyOfficeSchema,
  placeSchema,
  registrationCalendarSchema,
} from './campus';
import type { CatalogueRecords } from './catalogue';
import { curriculumSchema } from './curriculum';
import { isUniversitySource, type UniversityId } from './records';
import { safetyAdviceSchema } from './safety';

/**
 * What is wrong with the campus, registration and curriculum records (Phase 5) across files: a
 * record that doesn't validate, an id used twice, a place on a campus that doesn't exist, a
 * curriculum for a programme the catalogue doesn't hold, a source off the university's own site.
 *
 * The catalogue tests run this over `RAW_CATALOGUE`, so a record a researcher adds to a data
 * file is checked without anyone touching a test. Messages name the record; empty means sound.
 */
export function catalogueProblems(raw: CatalogueRecords): string[] {
  return [
    ...campusProblems(raw),
    ...placeProblems(raw),
    ...facultyOfficeProblems(raw),
    ...calendarProblems(raw),
    ...curriculumRecordProblems(raw),
    ...safetyAdviceProblems(raw),
  ];
}

type Parsed = { success: boolean; error?: { issues: unknown[] } };

function invalid(label: string, result: Parsed): string[] {
  return result.success
    ? []
    : [`${label} doesn't validate: ${JSON.stringify(result.error?.issues)}`];
}

/** Whether a walking link to `location` would be withheld for its length (5e-1). */
function tooLongToWalk(location: MapLocation | undefined): boolean {
  if (location === undefined) return false;
  try {
    return walkingLink(location) === null || appleWalkingLink(location) === null;
  } catch {
    // Nothing to go to: the schema check already says so.
    return false;
  }
}

function repeated(kind: string, keys: ReadonlyArray<string>): string[] {
  const seen = new Set<string>();
  const problems: string[] = [];
  for (const key of keys) {
    if (seen.has(key)) problems.push(`${kind} ${key} appears twice`);
    seen.add(key);
  }
  return problems;
}

function campusProblems(raw: CatalogueRecords): string[] {
  const universities = new Set<string>(raw.universities.map((u) => u.id));
  return [
    ...raw.campuses.flatMap((c) => [
      ...invalid(`campus ${c.id}`, campusSchema.safeParse(c)),
      ...(universities.has(c.universityId)
        ? []
        : [`campus ${c.id}: no university ${c.universityId}`]),
    ]),
    ...repeated(
      'campus',
      raw.campuses.map((c) => c.id),
    ),
  ];
}

function placeProblems(raw: CatalogueRecords): string[] {
  const universityOf = new Map<string, UniversityId>(
    raw.campuses.map((c) => [c.id, c.universityId]),
  );
  const one = (p: CatalogueRecords['places'][number]): string[] => {
    const problems = invalid(`place ${p.id}`, placeSchema.safeParse(p));
    const university = universityOf.get(p.campusId);
    if (university === undefined) return [...problems, `place ${p.id}: no campus ${p.campusId}`];
    if (!p.id.startsWith(`${university}-`)) {
      problems.push(`place ${p.id}: id doesn't start with ${university}-`);
    }
    if (!isUniversitySource(university, p.sourceUrl)) {
      problems.push(`place ${p.id}: source isn't on ${university}'s own site`);
    }
    if (p.phoneSourceUrl !== undefined && !isUniversitySource(university, p.phoneSourceUrl)) {
      problems.push(`place ${p.id}: phone source isn't on ${university}'s own site`);
    }
    if (p.arrivalSourceUrl !== undefined && !isUniversitySource(university, p.arrivalSourceUrl)) {
      problems.push(`place ${p.id}: arrival note source isn't on ${university}'s own site`);
    }
    // A link over the limit is withheld from learners (5e-1): a person shortens the query.
    if (tooLongToWalk(p.location)) {
      problems.push(`place ${p.id}: its walking link would be over ${MAX_LINK_LENGTH} characters`);
    }
    if (tooLongToWalk(p.accessibleEntrance?.location)) {
      problems.push(
        `place ${p.id}: its step-free walking link would be over ${MAX_LINK_LENGTH} characters`,
      );
    }
    return problems;
  };
  return [
    ...raw.places.flatMap(one),
    ...repeated(
      'place',
      raw.places.map((p) => p.id),
    ),
  ];
}

function facultyOfficeProblems(raw: CatalogueRecords): string[] {
  const universityOf = new Map<string, UniversityId>(
    raw.campuses.map((c) => [c.id, c.universityId]),
  );
  const one = (o: CatalogueRecords['facultyOffices'][number]): string[] => {
    const problems = invalid(`faculty office ${o.id}`, facultyOfficeSchema.safeParse(o));
    const faculties = raw.programmes.filter((p) => p.universityId === o.universityId);
    if (!faculties.some((p) => p.faculty === o.faculty)) {
      problems.push(`faculty office ${o.id}: no ${o.universityId} programme is in "${o.faculty}"`);
    }
    if (o.campusId !== undefined && universityOf.get(o.campusId) !== o.universityId) {
      problems.push(`faculty office ${o.id}: no ${o.universityId} campus ${o.campusId}`);
    }
    return problems;
  };
  return [
    ...raw.facultyOffices.flatMap(one),
    ...repeated(
      'faculty office',
      raw.facultyOffices.map((o) => o.id),
    ),
  ];
}

function calendarProblems(raw: CatalogueRecords): string[] {
  const universities = new Set<string>(raw.universities.map((u) => u.id));
  const key = (c: CatalogueRecords['registrationCalendars'][number]) =>
    `${c.universityId} ${c.academicYear}`;
  return [
    ...raw.registrationCalendars.flatMap((c) => [
      ...invalid(`registration calendar ${key(c)}`, registrationCalendarSchema.safeParse(c)),
      ...(universities.has(c.universityId)
        ? []
        : [`registration calendar: no university ${c.universityId}`]),
    ]),
    ...repeated('registration calendar', raw.registrationCalendars.map(key)),
  ];
}

function curriculumRecordProblems(raw: CatalogueRecords): string[] {
  const programmes = new Map(raw.programmes.map((p) => [p.id, p]));
  const key = (c: CatalogueRecords['curricula'][number]) => `${c.programmeId} ${c.academicYear}`;
  const one = (c: CatalogueRecords['curricula'][number]): string[] => {
    const label = `curriculum ${key(c)}`;
    const problems = invalid(label, curriculumSchema.safeParse(c));
    const programme = programmes.get(c.programmeId);
    if (!programme) {
      problems.push(`${label}: no programme ${c.programmeId} in the catalogue`);
    } else if (!isUniversitySource(programme.universityId, c.sourceUrl)) {
      problems.push(`${label}: source isn't on ${programme.universityId}'s own site`);
    }
    return problems;
  };
  return [...raw.curricula.flatMap(one), ...repeated('curriculum', raw.curricula.map(key))];
}

function safetyAdviceProblems(raw: CatalogueRecords): string[] {
  const universities = new Set<string>(raw.universities.map((u) => u.id));
  const campusUniversity = new Map<string, string>(raw.campuses.map((c) => [c.id, c.universityId]));
  const places = new Map(raw.places.map((p) => [p.id, p]));
  const one = (a: CatalogueRecords['safetyAdvice'][number]): string[] => {
    const label = `safety advice ${a.id}`;
    const problems = invalid(label, safetyAdviceSchema.safeParse(a));
    if (!universities.has(a.universityId))
      problems.push(`${label}: no university ${a.universityId}`);
    if (a.campusId !== undefined && campusUniversity.get(a.campusId) !== a.universityId) {
      problems.push(`${label}: no ${a.universityId} campus ${a.campusId}`);
    }
    if (a.placeId !== undefined) {
      const place = places.get(a.placeId);
      if (!place || campusUniversity.get(place.campusId) !== a.universityId) {
        problems.push(`${label}: no ${a.universityId} place ${a.placeId}`);
      } else if (a.campusId !== undefined && place.campusId !== a.campusId) {
        problems.push(`${label}: place ${a.placeId} is not on ${a.campusId}`);
      }
    }
    return problems;
  };
  return [
    ...raw.safetyAdvice.flatMap(one),
    ...repeated(
      'safety advice',
      raw.safetyAdvice.map((a) => a.id),
    ),
  ];
}
