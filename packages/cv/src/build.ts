import type { CvEntryKind, EvidenceKind } from './limits';
import { CV_SCHEMA_VERSION } from './limits';
import type { CvProfile } from './profile';

/**
 * `buildCvProfile` (docs/design/mmereko-api-proposal.md §3.3, §10.1): the learner's confirmed rows
 * and their own entries, mapped to `uf-cv-profile/1`, and only what they ticked (§7.1). Pure: the
 * server reads the rows (as the learner, under their consent) and hands them in; nothing here
 * reads a database, a clock or the network.
 *
 * - **Hard rule 3.** A university, course or module name from the catalogue goes on a CV only when
 *   its record is verified (`CatalogueName.verified`). A learner's own confirmed module name is
 *   theirs and goes as they confirmed it. An offer whose university isn't verified is left off.
 * - **Hard rule 6.** Only confirmed rows: a report, offer or registration not confirmed by the
 *   learner is left off, whatever was ticked.
 * - **D11.** Marks are off unless the learner ticks the subject.
 * - **D9.** E-mail, phone and city only as typed on the CV page, never the sign-in phone (which is
 *   not even an input here).
 */

/** A name read from a catalogue record, with whether that record is verified (hard rule 3). */
export interface CatalogueName {
  readonly name: string;
  readonly verified: boolean;
}

export interface CvEvidence {
  readonly kind: EvidenceKind;
  readonly url: string;
  readonly label: string | null;
}

/** One `cv_entries` row: the learner's own words (§10.4). */
export interface CvEntryRecord {
  readonly id: string;
  readonly kind: CvEntryKind;
  /** The project, skill, job title, award, language or certificate. */
  readonly title: string;
  /** Where: the employer, the organisation, the awarder, the issuer. */
  readonly organisation: string | null;
  /** The learner's role (a project, work, volunteering), or a language's fluency. */
  readonly role: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly description: string | null;
  readonly highlights: ReadonlyArray<string>;
  readonly keywords: ReadonlyArray<string>;
  readonly evidence: ReadonlyArray<CvEvidence>;
  readonly linkedModules: ReadonlyArray<string>;
  /** The order the learner gave it. */
  readonly position: number;
}

export interface CvMark {
  readonly subjectId: string;
  /** From the fixed subject list (packages/catalogue SUBJECTS), not a sourced record. */
  readonly subjectName: string;
  readonly percent: number;
}

export interface CvReportSource {
  readonly id: string;
  readonly confirmed: boolean;
  readonly marks: ReadonlyArray<CvMark>;
}

export interface CvOfferSource {
  readonly id: string;
  /** Accepted, as the learner confirmed it. */
  readonly confirmed: boolean;
  readonly universityId: string;
  readonly programmeId: string;
  readonly institution: CatalogueName | null;
  readonly programme: CatalogueName | null;
  /** The year the learner starts, when a confirmed row says it; never guessed. */
  readonly startYear: number | null;
}

export interface CvModuleSource {
  readonly code: string;
  /** The name as the learner confirmed it from their proof, or null. */
  readonly name: string | null;
  readonly catalogueName: CatalogueName | null;
  readonly term: string | null;
  readonly credits: number | null;
}

export interface CvRegistrationSource {
  readonly id: string;
  readonly confirmed: boolean;
  readonly universityId: string;
  readonly programmeId: string;
  readonly academicYear: number;
  readonly institution: CatalogueName | null;
  readonly programme: CatalogueName | null;
  readonly modules: ReadonlyArray<CvModuleSource>;
}

/** What the server reads for a CV: the learner's own rows, never another learner's. */
export interface CvSources {
  /** The learner's first name (their profile). */
  readonly firstName: string | null;
  /** The school as the learner typed it on their profile. */
  readonly schoolName: string | null;
  /** The year the learner finishes (or finished) Grade 12, when known. */
  readonly schoolEndYear: number | null;
  /** The learner's latest report (`LATEST_REPORT_FIRST`), or null. */
  readonly report: CvReportSource | null;
  readonly acceptedOffer: CvOfferSource | null;
  readonly registrations: ReadonlyArray<CvRegistrationSource>;
  readonly entries: ReadonlyArray<CvEntryRecord>;
}

/** What the learner ticked and typed on the CV page (`cv_selections`). */
export interface CvSelection {
  readonly surname: string | null;
  readonly label: string | null;
  readonly summary: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly city: string | null;
  readonly region: string | null;
  readonly includeSchool: boolean;
  /** Subjects whose mark goes on the CV (D11): none by default. */
  readonly subjectIds: ReadonlyArray<string>;
  readonly includeOffer: boolean;
  /** Registered modules, by code. */
  readonly moduleCodes: ReadonlyArray<string>;
  readonly entryIds: ReadonlyArray<string>;
}

export const EMPTY_SELECTION: CvSelection = {
  surname: null,
  label: null,
  summary: null,
  email: null,
  phone: null,
  city: null,
  region: null,
  includeSchool: false,
  subjectIds: [],
  includeOffer: false,
  moduleCodes: [],
  entryIds: [],
};

/** Something ticked that couldn't go on: ids and reasons only. */
export interface CvOmission {
  readonly source: 'report' | 'offer' | 'registration' | 'module';
  readonly reason: 'unconfirmed' | 'unverified';
}

export interface BuiltCvProfile {
  readonly profile: CvProfile;
  /** A name and at least one education entry (§11): "Make my CV" waits until both are there. */
  readonly ready: boolean;
  readonly missing: ReadonlyArray<'name' | 'education'>;
  readonly omitted: ReadonlyArray<CvOmission>;
}

type Education = NonNullable<CvProfile['education']>[number];

/** A catalogue name, only when its record is verified (hard rule 3). */
function named(name: CatalogueName | null): string | null {
  return name?.verified === true ? orNull(name.name) : null;
}

function present<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

const orNull = (value: string | null | undefined) => (value?.trim() ? value.trim() : null);

function registrationEntry(
  registration: CvRegistrationSource,
  codes: ReadonlySet<string>,
  omitted: CvOmission[],
): Education | null {
  const institution = named(registration.institution);
  if (!institution) {
    omitted.push({ source: 'registration', reason: 'unverified' });
    return null;
  }
  const modules = registration.modules
    .filter((m) => codes.has(m.code))
    .map((m) => {
      // The learner's own confirmed name first; a catalogue name only when verified (hard rule
      // 3); else the code stands as the name (Mmereko's contract needs one; the code is true).
      const known = orNull(m.name) ?? named(m.catalogueName);
      return {
        code: m.code,
        name: known ?? m.code,
        named: known !== null,
        year: registration.academicYear,
        term: m.term ?? null,
        credits: m.credits,
        result: null,
      };
    });
  const area = named(registration.programme);
  return {
    institution,
    ...(area ? { area } : {}),
    startDate: String(registration.academicYear),
    endDate: null,
    ...(modules.length > 0
      ? {
          courses: modules.map((m) => (m.named ? `${m.code} ${m.name}` : m.code)),
          xModules: modules.map(({ named: _named, ...m }) => m),
        }
      : {}),
    xSource: 'confirmed-registration',
  };
}

function offerEntry(offer: CvOfferSource, omitted: CvOmission[]): Education | null {
  const institution = named(offer.institution);
  if (!institution) {
    omitted.push({ source: 'offer', reason: 'unverified' });
    return null;
  }
  const area = named(offer.programme);
  return {
    institution,
    ...(area ? { area } : {}),
    startDate: offer.startYear ? String(offer.startYear) : null,
    endDate: null,
    xSource: 'confirmed-offer',
  };
}

function schoolEntry(
  sources: CvSources,
  selection: CvSelection,
  omitted: CvOmission[],
): Education | null {
  const institution = orNull(sources.schoolName);
  if (!institution) return null;
  const ticked = new Set(selection.subjectIds);
  const report = sources.report;
  let subjects: Array<{ name: string; result: string }> = [];
  // Only a report the learner confirmed (hard rule 6), whatever was ticked.
  if (report && !report.confirmed && ticked.size > 0) {
    omitted.push({ source: 'report', reason: 'unconfirmed' });
  } else if (report && ticked.size > 0) {
    subjects = report.marks
      .filter((m) => ticked.has(m.subjectId))
      .map((m) => ({ name: m.subjectName, result: `${m.percent}%` }));
  }
  return {
    institution,
    studyType: 'National Senior Certificate',
    ...(sources.schoolEndYear ? { endDate: `${sources.schoolEndYear}-12` } : {}),
    ...(subjects.length > 0 ? { xSubjects: subjects } : {}),
    xSource: subjects.length > 0 ? 'confirmed-report' : 'learner',
  };
}

const span = (e: CvEntryRecord) => ({
  startDate: e.startDate,
  endDate: e.endDate,
});

const words = (list: ReadonlyArray<string>) => (list.length > 0 ? { highlights: [...list] } : {});
const tags = (list: ReadonlyArray<string>) => (list.length > 0 ? { keywords: [...list] } : {});

/** The learner's entries, by section, in the order they gave them. */
function sections(entries: ReadonlyArray<CvEntryRecord>) {
  const of = (kind: CvEntryKind) =>
    entries.filter((e) => e.kind === kind).sort((a, b) => a.position - b.position);
  return {
    projects: of('project').map((e) => ({
      name: e.title,
      description: e.description,
      ...words(e.highlights),
      ...tags(e.keywords),
      ...span(e),
      ...(e.evidence[0] ? { url: e.evidence[0].url } : {}),
      ...(e.role ? { roles: [e.role] } : {}),
      ...(e.evidence.length > 0
        ? { xEvidence: e.evidence.map((x) => ({ kind: x.kind, url: x.url, label: x.label })) }
        : {}),
      ...(e.linkedModules.length > 0 ? { xLinkedModules: [...e.linkedModules] } : {}),
    })),
    skills: of('skill').map((e) => ({ name: e.title, ...tags(e.keywords) })),
    work: of('work').map((e) => ({
      name: e.organisation ?? e.title,
      position: e.organisation ? e.title : e.role,
      summary: e.description,
      ...span(e),
      ...words(e.highlights),
    })),
    volunteer: of('volunteer').map((e) => ({
      organization: e.organisation ?? e.title,
      position: e.organisation ? e.title : e.role,
      summary: e.description,
      ...span(e),
      ...words(e.highlights),
    })),
    awards: of('award').map((e) => ({
      title: e.title,
      date: e.endDate ?? e.startDate,
      awarder: e.organisation,
      summary: e.description,
    })),
    languages: of('language').map((e) => ({ language: e.title, fluency: e.role })),
    certificates: of('certificate').map((e) => ({
      name: e.title,
      date: e.endDate ?? e.startDate,
      issuer: e.organisation,
      ...(e.evidence[0] ? { url: e.evidence[0].url } : {}),
    })),
  };
}

export function buildCvProfile(sources: CvSources, selection: CvSelection): BuiltCvProfile {
  const omitted: CvOmission[] = [];
  const codes = new Set(selection.moduleCodes);
  const confirmedRegistrations = sources.registrations.filter((r) => {
    if (r.confirmed) return true;
    omitted.push({ source: 'registration', reason: 'unconfirmed' });
    return false;
  });
  const registrations = confirmedRegistrations
    .filter((r) => r.modules.some((m) => codes.has(m.code)))
    .map((r) => registrationEntry(r, codes, omitted))
    .filter(present);
  let offer = sources.acceptedOffer;
  if (offer && !offer.confirmed) {
    if (selection.includeOffer) omitted.push({ source: 'offer', reason: 'unconfirmed' });
    offer = null;
  }
  const covered = confirmedRegistrations.some(
    (r) =>
      offer &&
      r.universityId === offer.universityId &&
      r.programmeId === offer.programmeId &&
      r.modules.some((m) => codes.has(m.code)),
  );
  const offerEducation =
    selection.includeOffer && offer && !covered ? offerEntry(offer, omitted) : null;
  const school = selection.includeSchool ? schoolEntry(sources, selection, omitted) : null;
  const education = [...registrations, offerEducation, school].filter(present);

  const ticked = new Set(selection.entryIds);
  const entries = sections(sources.entries.filter((e) => ticked.has(e.id)));
  const name = [orNull(sources.firstName), orNull(selection.surname)].filter(present).join(' ');
  const city = orNull(selection.city);
  const region = orNull(selection.region);

  const profile: CvProfile = {
    schemaVersion: CV_SCHEMA_VERSION,
    basics: {
      name,
      ...(orNull(selection.label) ? { label: orNull(selection.label) } : {}),
      email: orNull(selection.email),
      phone: orNull(selection.phone),
      ...(orNull(selection.summary) ? { summary: orNull(selection.summary) } : {}),
      ...(city || region ? { location: { city, region, countryCode: 'ZA' as const } } : {}),
    },
    education,
    ...Object.fromEntries(Object.entries(entries).filter(([, list]) => list.length > 0)),
  };
  const missing = [
    ...(name === '' ? (['name'] as const) : []),
    ...(education.length === 0 ? (['education'] as const) : []),
  ];
  return { profile, ready: missing.length === 0, missing, omitted };
}
