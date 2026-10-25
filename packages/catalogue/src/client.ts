/**
 * `@universityflow/catalogue/client`: what a browser or the phone app may load (audit A4-02).
 *
 * Subject names, provinces, helpline dialling, place kinds and the "open in maps" link, and module
 * codes and terms (Phase 5). No zod and no catalogue records: the package's
 * main entry builds zod schemas when it loads and holds every programme, which put a second zod
 * and the admission data into seven web pages (99 KB gzipped) and both phone bundles.
 * Requirements, deadlines and scores reach a screen only as the server computed them (hard
 * rule 2). client.test.ts keeps this entry free of both.
 */
export {
  appleMapsLink,
  appleWalkingLink,
  dialable,
  isSafetyPlaceKind,
  MAX_LINK_LENGTH,
  type MapLocation,
  MODULE_TERMS,
  type ModuleTerm,
  mapsLink,
  normaliseModuleCode,
  OFFERED_TERMS,
  type OfferedTerm,
  offeredIn,
  PLACE_KINDS,
  type PlaceKind,
  PROVINCES,
  SAFETY_PLACE_KINDS,
  type SafetyPlaceKind,
  streetViewLink,
  walkingLink,
} from './basics';
export {
  currentGrade,
  type GradeOnRecord,
  gradeCheckDue,
  SCHOOL_GRADES,
  type SchoolGrade,
  schoolFinished,
} from './grades';
export {
  ADMISSION_REPORT_KINDS,
  defaultReportKind,
  isAdmissionReport,
  isReportKind,
  printedReportKind,
  REPORT_KINDS,
  type ReportKind,
  reportAboveGrade,
  reportGrade,
} from './reports';
export { SAFETY_ADVICE_KINDS, type SafetyAdviceKind } from './safety-kinds';
export {
  ENGLISH,
  isHomeLanguage,
  isLanguage,
  isSubjectId,
  type LanguageId,
  type LanguageSubject,
  LIFE_ORIENTATION,
  OFFICIAL_LANGUAGES,
  type OtherSubject,
  SUBJECTS,
  type Subject,
  type SubjectId,
  subject,
} from './subjects';
