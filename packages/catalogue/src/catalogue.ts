import type { AcademicCalendar, AssessmentRules, ModuleAssessment } from './assessment';
import { isSafetyPlaceKind, type SafetyPlaceKind } from './basics';
import type { Bursary } from './bursary';
import type { Campus, FacultyOffice, Place, RegistrationCalendar } from './campus';
import type { Curriculum } from './curriculum';
import { bursaries } from './data/bursaries';
import { nscFinal2026 } from './data/nsc-exams-2026';
import { siyavulaResources } from './data/siyavula';
import { helplines, nsfas } from './data/support';
import { tut, tutProgrammes, tutWindow } from './data/tut';
import { tutAssessment } from './data/tut-assessment';
import { tutCurricula } from './data/tut-curricula';
import {
  tutCampuses,
  tutFacultyOffices,
  tutPlaces,
  tutRegistrationCalendars,
} from './data/tut-orientation';
import { uct, uctProgrammes, uctWindow } from './data/uct';
import { uctAssessment } from './data/uct-assessment';
import { uctCurricula } from './data/uct-curricula';
import {
  uctCampuses,
  uctFacultyOffices,
  uctPlaces,
  uctRegistrationCalendars,
} from './data/uct-orientation';
import { uj, ujProgrammes, ujWindow } from './data/uj';
import { ujAssessment } from './data/uj-assessment';
import { ujCurricula } from './data/uj-curricula';
import {
  ujCampuses,
  ujFacultyOffices,
  ujPlaces,
  ujRegistrationCalendars,
} from './data/uj-orientation';
import { ujSafetyAdvice } from './data/uj-safety';
import { ukzn, ukznProgrammes, ukznWindow } from './data/ukzn';
import { ukznAssessment } from './data/ukzn-assessment';
import { ukznCurricula } from './data/ukzn-curricula';
import {
  ukznCampuses,
  ukznFacultyOffices,
  ukznPlaces,
  ukznRegistrationCalendars,
} from './data/ukzn-orientation';
import { up, upProgrammes, upWindow } from './data/up';
import { upAssessment } from './data/up-assessment';
import { upCurricula } from './data/up-curricula';
import {
  upCampuses,
  upFacultyOffices,
  upPlaces,
  upRegistrationCalendars,
} from './data/up-orientation';
import { wits, witsProgrammes, witsWindow } from './data/wits';
import { witsAssessment } from './data/wits-assessment';
import { witsCurricula } from './data/wits-curricula';
import {
  witsCampuses,
  witsFacultyOffices,
  witsPlaces,
  witsRegistrationCalendars,
} from './data/wits-orientation';
import { type ExamPaper, examPaperSchema } from './exams';
import type { PracticeResource } from './practice';
import { isPublishable, type Provenance, provenanceSchema } from './provenance';
import type {
  ApplicationWindow,
  Helpline,
  Nsfas,
  Programme,
  University,
  UniversityId,
} from './records';
import { isAdviceCurrent, type SafetyAdvice } from './safety';

/** Phase 6a: each university's assessment records (data/<id>-assessment.ts). */
const ASSESSMENT = [
  witsAssessment,
  ujAssessment,
  upAssessment,
  uctAssessment,
  tutAssessment,
  ukznAssessment,
];

/**
 * Everything the catalogue knows, and the one way to read it.
 *
 * `catalogueView` is the gate hard rule 3 describes: it returns only records a person has
 * verified, as of `today`. Drafts (researched, not yet verified) come back only when the caller
 * asks for them, and the web app refuses to ask in production; anywhere they appear, the
 * interface labels them as unverified.
 *
 * Safety places (campus clinic, counselling, security) are stricter: like a crisis line, a
 * learner may reach for one in an emergency, so the view returns one only once it is verified,
 * whether or not drafts were asked for.
 */

/** Every record of every type: the shape of `RAW_CATALOGUE`, and what `catalogueViewOf` reads. */
export interface CatalogueRecords {
  readonly universities: ReadonlyArray<University>;
  readonly programmes: ReadonlyArray<Programme>;
  readonly windows: ReadonlyArray<ApplicationWindow>;
  readonly nsfas: Nsfas;
  readonly helplines: ReadonlyArray<Helpline>;
  readonly examPapers: ReadonlyArray<ExamPaper>;
  readonly practice: ReadonlyArray<PracticeResource>;
  readonly campuses: ReadonlyArray<Campus>;
  readonly places: ReadonlyArray<Place>;
  readonly facultyOffices: ReadonlyArray<FacultyOffice>;
  readonly registrationCalendars: ReadonlyArray<RegistrationCalendar>;
  readonly curricula: ReadonlyArray<Curriculum>;
  /** Each university's own safety advice, quoted and expiring (Phase 5e-3, data/<id>-safety.ts). */
  readonly safetyAdvice: ReadonlyArray<SafetyAdvice>;
  /** How marks work (Phase 6a, data/<id>-assessment.ts): general and faculty rules. */
  readonly assessmentRules?: ReadonlyArray<AssessmentRules>;
  /** Modules' published assessment schemes, where the university prints one (Phase 6a). */
  readonly moduleAssessments?: ReadonlyArray<ModuleAssessment>;
  /** Exam, supplementary and DP-list dates per university and year (Phase 6a). */
  readonly academicCalendars?: ReadonlyArray<AcademicCalendar>;
  /** Well-known bursaries beside NSFAS (data/bursaries.ts), drafts until a person verifies them. */
  readonly bursaries?: ReadonlyArray<Bursary>;
}

const ALL: CatalogueRecords = {
  universities: [wits, uj, up, uct, tut, ukzn],
  programmes: [
    ...witsProgrammes,
    ...ujProgrammes,
    ...upProgrammes,
    ...uctProgrammes,
    ...tutProgrammes,
    ...ukznProgrammes,
  ],
  windows: [witsWindow, ujWindow, upWindow, uctWindow, tutWindow, ukznWindow],
  nsfas,
  helplines,
  /** The NSC exam timetable, one record per paper. The 2027 timetable isn't published yet. */
  examPapers: [...nscFinal2026],
  /** Free practice and open textbooks (Siyavula), one record per book or service and subject. */
  practice: [...siyavulaResources],
  // Phase 5: one orientation file and one curricula file per university (data/<id>-*.ts).
  campuses: [
    ...witsCampuses,
    ...ujCampuses,
    ...upCampuses,
    ...uctCampuses,
    ...tutCampuses,
    ...ukznCampuses,
  ],
  places: [...witsPlaces, ...ujPlaces, ...upPlaces, ...uctPlaces, ...tutPlaces, ...ukznPlaces],
  facultyOffices: [
    ...witsFacultyOffices,
    ...ujFacultyOffices,
    ...upFacultyOffices,
    ...uctFacultyOffices,
    ...tutFacultyOffices,
    ...ukznFacultyOffices,
  ],
  registrationCalendars: [
    ...witsRegistrationCalendars,
    ...ujRegistrationCalendars,
    ...upRegistrationCalendars,
    ...uctRegistrationCalendars,
    ...tutRegistrationCalendars,
    ...ukznRegistrationCalendars,
  ],
  curricula: [
    ...witsCurricula,
    ...ujCurricula,
    ...upCurricula,
    ...uctCurricula,
    ...tutCurricula,
    ...ukznCurricula,
  ],
  safetyAdvice: [...ujSafetyAdvice],
  // Phase 6a: one assessment file per university (data/<id>-assessment.ts).
  assessmentRules: ASSESSMENT.flatMap((a) => a.rules),
  moduleAssessments: ASSESSMENT.flatMap((a) => a.modules),
  academicCalendars: ASSESSMENT.flatMap((a) => a.calendars),
  bursaries,
};

/** Every record, drafts included. For tests and the data-verification checklist only. */
export const RAW_CATALOGUE = ALL;

export interface CatalogueView {
  readonly universities: ReadonlyArray<University>;
  readonly programmes: ReadonlyArray<Programme>;
  readonly windows: ReadonlyArray<ApplicationWindow>;
  readonly nsfas: Nsfas | null;
  readonly helplines: ReadonlyArray<Helpline>;
  readonly examPapers: ReadonlyArray<ExamPaper>;
  readonly practice: ReadonlyArray<PracticeResource>;
  /** Campuses of the universities shown. */
  readonly campuses: ReadonlyArray<Campus>;
  /**
   * Places on the campuses shown. Safety places (clinic, counselling, security) only once
   * verified, even when drafts are included: `safetyPlacesOn` reads them.
   */
  readonly places: ReadonlyArray<Place>;
  readonly facultyOffices: ReadonlyArray<FacultyOffice>;
  readonly registrationCalendars: ReadonlyArray<RegistrationCalendar>;
  /** First-year curricula of the programmes shown. */
  readonly curricula: ReadonlyArray<Curriculum>;
  /**
   * Safety notes of the universities and campuses shown: verified (drafts only in preview) and
   * current on `today`. An expired note is never returned, preview or not: it waits for a person.
   */
  readonly safetyAdvice: ReadonlyArray<SafetyAdvice>;
  /** Assessment rules of the universities shown (Phase 6a). */
  readonly assessmentRules: ReadonlyArray<AssessmentRules>;
  /** Published module schemes of the universities shown (Phase 6a). */
  readonly moduleAssessments: ReadonlyArray<ModuleAssessment>;
  /** Exam and supplementary calendars of the universities shown (Phase 6a). */
  readonly academicCalendars: ReadonlyArray<AcademicCalendar>;
  /**
   * Bursaries beside NSFAS: verified (drafts only in preview). Optional so a hand-built view in a
   * test needn't carry it; catalogueViewOf always sets it.
   */
  readonly bursaries?: ReadonlyArray<Bursary>;
  /** True when drafts were included, so the interface must label them. */
  readonly includesDrafts: boolean;
}

export interface ViewOptions {
  /** Include researched records nobody has verified yet. Never in production. */
  readonly includeDrafts: boolean;
}

export function catalogueView(today: Date, options: ViewOptions): CatalogueView {
  return catalogueViewOf(ALL, today, options);
}

/**
 * The same gate over records the caller supplies. For tests (a synthetic verified clinic, a
 * synthetic curriculum) and nothing else: production reads `catalogueView`.
 */
export function catalogueViewOf(
  records: CatalogueRecords,
  today: Date,
  options: ViewOptions,
): CatalogueView {
  const keep = <T extends Provenance>(record: T) =>
    isPublishable(record, today) ||
    (options.includeDrafts && provenanceSchema.safeParse(record).success);
  // A safety place is shown verified or not at all (like a crisis line, preview or not).
  const keepPlace = (p: Place) => (isSafetyPlaceKind(p.kind) ? isPublishable(p, today) : keep(p));
  const universities = records.universities.filter(keep);
  const open = new Set<UniversityId>(universities.map((u) => u.id));
  // A programme is only shown when its university is.
  const programmes = records.programmes.filter((p) => keep(p) && open.has(p.universityId));
  const shownProgrammes = new Set(programmes.map((p) => p.id));
  const campuses = records.campuses.filter((c) => keep(c) && open.has(c.universityId));
  const shownCampuses = new Set(campuses.map((c) => c.id));
  return {
    universities,
    programmes,
    windows: records.windows.filter((w) => keep(w) && open.has(w.universityId)),
    nsfas: keep(records.nsfas) ? records.nsfas : null,
    helplines: records.helplines.filter(keep),
    examPapers: records.examPapers.filter(keep),
    practice: records.practice.filter(keep),
    campuses,
    places: records.places.filter((p) => keepPlace(p) && shownCampuses.has(p.campusId)),
    facultyOffices: records.facultyOffices.filter((o) => keep(o) && open.has(o.universityId)),
    registrationCalendars: records.registrationCalendars.filter(
      (c) => keep(c) && open.has(c.universityId),
    ),
    curricula: records.curricula.filter((c) => keep(c) && shownProgrammes.has(c.programmeId)),
    safetyAdvice: records.safetyAdvice.filter(
      (a) =>
        keep(a) &&
        isAdviceCurrent(a, today) &&
        open.has(a.universityId) &&
        (a.campusId === undefined || shownCampuses.has(a.campusId)),
    ),
    assessmentRules: (records.assessmentRules ?? []).filter(
      (r) => keep(r) && open.has(r.universityId),
    ),
    moduleAssessments: (records.moduleAssessments ?? []).filter(
      (m) => keep(m) && open.has(m.universityId),
    ),
    academicCalendars: (records.academicCalendars ?? []).filter(
      (c) => keep(c) && open.has(c.universityId),
    ),
    bursaries: (records.bursaries ?? []).filter(keep),
    includesDrafts: options.includeDrafts,
  };
}

/**
 * Every **sourced** exam paper, drafts included: the papers the reminder pipeline stays quiet
 * for (A12-01). This is for suppression only and must never be shown to a learner: a countdown,
 * a list or anything a learner reads takes `catalogueView(...).examPapers` instead (hard rule 3).
 *
 * It must never filter on verification. A draft date can only make us quieter: holding a message
 * through a paper that turns out to be at another time costs a short delay, while sending one
 * mid-paper because nobody has verified the timetable yet is the harm "never during a paper"
 * exists to prevent. A record with no source (or no valid date) still decides nothing. Paper slots built from a
 * draft hold messages but never open an exam period (`holdOnly`), so they never let more through.
 */
export function examPapersForSuppression(
  papers: ReadonlyArray<ExamPaper> = ALL.examPapers,
): ExamPaper[] {
  return papers.filter((p) => examPaperSchema.safeParse(p).success);
}

export function universityById(view: CatalogueView, id: UniversityId): University | undefined {
  return view.universities.find((u) => u.id === id);
}

export function programmeById(view: CatalogueView, id: string): Programme | undefined {
  return view.programmes.find((p) => p.id === id);
}

export function windowFor(view: CatalogueView, id: UniversityId): ApplicationWindow | undefined {
  return view.windows.find((w) => w.universityId === id);
}

/** A university's campuses, in the order the data lists them. */
export function campusesOf(view: CatalogueView, id: UniversityId): Campus[] {
  return view.campuses.filter((c) => c.universityId === id);
}

/** The places on one campus the learner may see (safety places only once verified). */
export function placesOn(view: CatalogueView, campusId: string): Place[] {
  return view.places.filter((p) => p.campusId === campusId);
}

/**
 * The verified clinic, counselling and security places on one campus: what the crisis card adds
 * once a learner has an accepted offer (planning.md §4.3). Never a draft, even in preview mode.
 */
export function safetyPlacesOn(
  view: CatalogueView,
  campusId: string,
): Array<Place & { kind: SafetyPlaceKind }> {
  return placesOn(view, campusId).filter((p): p is Place & { kind: SafetyPlaceKind } =>
    isSafetyPlaceKind(p.kind),
  );
}

/**
 * A university's safety notes the learner may see: one campus's (`campusId`), or the ones for the
 * whole university (`null`), in the order the data lists them.
 */
export function safetyAdviceOn(
  view: CatalogueView,
  universityId: UniversityId,
  campusId: string | null,
): SafetyAdvice[] {
  return view.safetyAdvice.filter(
    (a) => a.universityId === universityId && (a.campusId ?? null) === campusId,
  );
}

/** The office of the faculty a programme belongs to, if the catalogue has one. */
export function facultyOfficeFor(
  view: CatalogueView,
  programme: Pick<Programme, 'universityId' | 'faculty'>,
): FacultyOffice | undefined {
  return view.facultyOffices.find(
    (o) => o.universityId === programme.universityId && o.faculty === programme.faculty,
  );
}

/**
 * A university's registration calendar for one academic year, or undefined when the catalogue
 * holds none for that year. Never another year's (A13-02): last year's registration close and
 * change deadlines are not this year's, so the learner is told the dates aren't published instead.
 */
export function registrationCalendarFor(
  view: CatalogueView,
  id: UniversityId,
  academicYear: number,
): RegistrationCalendar | undefined {
  return view.registrationCalendars.find(
    (c) => c.universityId === id && c.academicYear === academicYear,
  );
}

/**
 * A programme's first-year curriculum from the rule book for one academic year. Undefined means no
 * registration check: the learner is told so, never guessed for. Never another year's rule book
 * (A1-26): module codes and compulsory lists change from year to year (planning.md §3 Stage 5,
 * "the official curriculum for that year").
 */
export function curriculumFor(
  view: CatalogueView,
  programmeId: string,
  academicYear: number,
): Curriculum | undefined {
  return view.curricula.find(
    (c) => c.programmeId === programmeId && c.academicYear === academicYear,
  );
}
