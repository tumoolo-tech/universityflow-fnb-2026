/**
 * `@universityflow/content/app`: the copy the phone app bundles (audit A4-18). The main entry
 * (index.ts) holds every string the product has, web-only pages too, and Metro doesn't
 * tree-shake, so apps/native and the packages it bundles (`@universityflow/ui`) import from
 * here; the `native-no-content-barrel` guard keeps them here. Only re-exports, so a web bundle
 * that reaches this entry through `@universityflow/ui` still takes just the sections it reads.
 *
 * Every module reached from here goes into both app bundles: app.test.ts fails if one is
 * web-only. Plain strings and string functions only (hard rule 11).
 */

export { type AppStrings, en } from './app-en';
export {
  FIRST_WEEK_STEPS,
  type FirstWeekStep,
  isFirstWeekStep,
  PLACE_NEED_IDS,
  PLACE_NEEDS,
  type PlaceNeed,
  SAFETY_TIPS,
  type SafetyTip,
} from './campus';
export { crisisSmsWords, crisisWords, type HelplineCover } from './crisis';
// "Report this CV" (A10-58): the reasons the app offers.
export { CV_REPORT_REASONS, type CvReportReason, isCvReportReason } from './cv-reports';
export { adultConsent } from './en/adult-consent';
export { app } from './en/app';
export { applications } from './en/applications';
export { auth } from './en/auth';
export { breakdown } from './en/breakdown';
export { campus } from './en/campus';
export { chat } from './en/chat';
export { common } from './en/common';
export { confirm } from './en/confirm';
export { crisis } from './en/crisis';
// My CV (docs/design/mmereko-api-proposal.md §10.5): the app screen's outline.
export { cv } from './en/cv';
export { dashboard } from './en/dashboard';
export { deadlines } from './en/deadlines';
// The judges' demo's on-screen sign-up (hackathon exception): shown when the demo sends a PIN.
export { demoPhoneSignup } from './en/demo-phone-signup';
export { documents } from './en/documents';
export { errors } from './en/errors';
export { firstWeek } from './en/first-week';
export { funding } from './en/funding';
export { goals } from './en/goals';
export { me } from './en/me';
// Phase 6c: the app's module card screen. Never the free-book words (6d): the server words a
// card's books, so they stay out of both app bundles (A4-13; app.test.ts holds it).
export { moduleCard } from './en/module-card';
export { modules } from './en/modules';
export { nav } from './en/nav';
export { notifications } from './en/notifications';
export { offers } from './en/offers';
export { onboarding } from './en/onboarding';
export { passTypes } from './en/pass-types';
export { permissions } from './en/permissions';
export { planMaps } from './en/plan-maps';
// The phone app's own plan-map words: naming a map, the hub's summary (RT-06, 2026-10-25).
export { planMapsApp } from './en/plan-maps-app';
export { practice } from './en/practice';
export { profileLook } from './en/profile-look';
export { profilePhoto } from './en/profile-photo';
export { qualifications } from './en/qualifications';
export { recheck } from './en/recheck';
export { reportKinds } from './en/report-kinds';
export { results } from './en/results';
export { safety } from './en/safety';
export { safetyNotes } from './en/safety-notes';
export { schoolRecord } from './en/school-record';
export { subjects } from './en/subjects';
export { universityMark } from './en/university-mark';
export { whatINeed } from './en/what-i-need';
export { APP_SCREENS, type AppScreen } from './messages';
export {
  isReplyReportReason,
  REPLY_REPORT_REASONS,
  type ReplyReportReason,
} from './reply-reports';
