/**
 * `en`, one section per module (audit A4-10). A browser component imports the sections it reads
 * (`import { offers, common } from '@universityflow/content'`), so its page downloads that copy
 * and nothing else: property access on the one `en` object can't be tree-shaken, and `en` is
 * every string the product has. Server code, the agent, messages and the app keep using `en`,
 * which is composed from these (en.ts), so `en.offers` and `offers` are the same object.
 *
 * Plain strings and string functions only: this package runs under React Native (hard rule 11).
 */

export { adultConsent } from './en/adult-consent';
export { agent } from './en/agent';
export { app } from './en/app';
export { applications } from './en/applications';
export { auth } from './en/auth';
export { breakdown } from './en/breakdown';
export { campus } from './en/campus';
export { chat } from './en/chat';
// Public TVET colleges (planning.md §19.1): Plan B, the filter, "Is this college registered?".
export { colleges } from './en/colleges';
export { common } from './en/common';
export { confirm } from './en/confirm';
export { consent } from './en/consent';
export { crisis } from './en/crisis';
// My CV, made by Mmereko (docs/design/mmereko-api-proposal.md).
export { cv } from './en/cv';
// "Open Mmereko" on My CV: Mmereko's own site in a canvas, 18+ or at university (2026-10-24).
export { cvMmereko } from './en/cv-mmereko';
export { dashboard } from './en/dashboard';
export { deadlines } from './en/deadlines';
// Judge demo mode (docs/deploy/demo.md).
export { demo } from './en/demo';
// The judges' demo (UF_DEPLOYMENT=demo): its made-up learners and the "coming next" cards.
export { demoPersonas } from './en/demo-personas';
// The judge demo's on-screen phone sign-up on made-up 080 numbers (a hackathon exception).
export { demoPhoneSignup } from './en/demo-phone-signup';
// The judge demo's real sign-up (a hackathon exception) and the main site / demo switch.
export { demoSignup } from './en/demo-signup';
// The staging site's banner (docs/deploy/README.md).
export { deploy } from './en/deploy';
export { dev } from './en/dev';
export { documentErrors } from './en/document-errors';
export { documents } from './en/documents';
export { errors } from './en/errors';
export { firstWeek } from './en/first-week';
// Phase 6d: free books on a module card (open books, library search; D5–D7).
export { freeBooks } from './en/free-books';
export { funding } from './en/funding';
export { goals } from './en/goals';
export { home } from './en/home';
export { me } from './en/me';
// Module cards and the mark calculator (Phase 6c).
export { moduleCard } from './en/module-card';
// Module outlines (Phase 6b): upload, check part by part, keep.
export { moduleOutline } from './en/module-outline';
export { modules } from './en/modules';
export { nav } from './en/nav';
export { notifications } from './en/notifications';
export { offerErrors } from './en/offer-errors';
export { offers } from './en/offers';
export { onboarding } from './en/onboarding';
export { passTypes } from './en/pass-types';
export { permissions } from './en/permissions';
export { planMaps } from './en/plan-maps';
export { practice } from './en/practice';
export { privacyPage } from './en/privacy-page';
export { profileLook } from './en/profile-look';
export { profilePhoto } from './en/profile-photo';
// The profile photo's DRAFT consent v4 / adult-v3 lines and privacy section (A11-31). Not live.
export { profilePhotoDraft } from './en/profile-photo-draft';
export { qualifications } from './en/qualifications';
export { recheck } from './en/recheck';
export { reportKinds } from './en/report-kinds';
export { results } from './en/results';
export { safety } from './en/safety';
export { safetyNotes } from './en/safety-notes';
// The school record on My results (planning.md §18.7 C2).
export { schoolRecord } from './en/school-record';
export { subjects } from './en/subjects';
// The neutral university mark (option A, 2026-10-23).
export { universityMark } from './en/university-mark';
export { whatINeed } from './en/what-i-need';
