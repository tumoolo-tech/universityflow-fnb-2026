/**
 * `en` for the phone app: the sections it shows, the same objects as the full `en` (en.ts), so
 * `en.offers.title` reads the same in both. Built from the section modules directly, never from
 * en.ts or sections.ts: Metro doesn't tree-shake, so importing either would bundle every string
 * the product has (audit A4-18). Left out: the web-only pages and the server's words (the
 * privacy policy but its consent lines, the landing page, the guardian's consent page, the
 * agent, the demo, the staging banner, dev pages and the web routes' errors). A section the app
 * starts to show is added here; app.test.ts fails if a web-only module comes in.
 */

import { adultConsent } from './en/adult-consent';
import { app } from './en/app';
import { applications } from './en/applications';
import { auth } from './en/auth';
import { breakdown } from './en/breakdown';
import { campus } from './en/campus';
import { chat } from './en/chat';
import { common } from './en/common';
import { confirm } from './en/confirm';
import { crisis } from './en/crisis';
import { cv } from './en/cv';
import { dashboard } from './en/dashboard';
import { deadlines } from './en/deadlines';
import { demoPhoneSignup } from './en/demo-phone-signup';
import { documents } from './en/documents';
import { errors } from './en/errors';
import { firstWeek } from './en/first-week';
import { funding } from './en/funding';
import { goals } from './en/goals';
import { me } from './en/me';
import { moduleCard } from './en/module-card';
import { modules } from './en/modules';
import { nav } from './en/nav';
import { notifications } from './en/notifications';
import { offers } from './en/offers';
import { onboarding } from './en/onboarding';
import { passTypes } from './en/pass-types';
import { permissions } from './en/permissions';
import { planMaps } from './en/plan-maps';
import { planMapsApp } from './en/plan-maps-app';
import { practice } from './en/practice';
import { privacyConsent } from './en/privacy-consent';
import { profileLook } from './en/profile-look';
import { profilePhoto } from './en/profile-photo';
import { qualifications } from './en/qualifications';
import { recheck } from './en/recheck';
import { reportKinds } from './en/report-kinds';
import { results } from './en/results';
import { safety } from './en/safety';
import { safetyNotes } from './en/safety-notes';
import { schoolRecord } from './en/school-record';
import { subjects } from './en/subjects';
import { universityMark } from './en/university-mark';
import { whatINeed } from './en/what-i-need';

export const en = {
  app,
  common,
  nav,
  dashboard,
  auth,
  onboarding,
  adultConsent,
  chat,
  crisis,
  results,
  subjects,
  breakdown,
  whatINeed,
  recheck,
  offers,
  campus,
  firstWeek,
  safety,
  safetyNotes,
  modules,
  passTypes,
  qualifications,
  reportKinds,
  documents,
  confirm,
  me,
  profileLook,
  applications,
  funding,
  goals,
  practice,
  deadlines,
  notifications,
  permissions,
  errors,
  /** The privacy policy's consent lines only; the policy itself is on the web (/privacy). */
  privacyPage: privacyConsent,
  profilePhoto,
  universityMark,
  planMaps,
  schoolRecord,
  /** My CV's outline screen (§10.5). */
  cv,
  /** Phase 6c: the module card screen. */
  moduleCard,
  /**
   * The judges' demo's on-screen sign-up (a hackathon exception, docs/deploy/demo.md §4b): shown
   * only when the demo's server returns a PIN or a guardian's link for the screen, or on a
   * judges' build (EXPO_PUBLIC_UF_DEMO). Plain strings; undone with the rest of the exception.
   */
  demoPhoneSignup,
  // The phone app's own plan-map words: naming a map, the hub's summary (RT-06, 2026-10-25).
  planMapsApp,
  // Not `freeBooks`: packages/ui's module card imports it by name (app.ts). Every web page that
  // reaches this `en` (ui's speech) would otherwise ship the free-book providers to the browser,
  // and the client-chunk budget refuses catalogue words there.
} as const;

export type AppStrings = typeof en;
