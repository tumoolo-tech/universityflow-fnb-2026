import { describe, expect, it } from 'vitest';
import { en } from './en';
import * as index from './index';
import * as sections from './sections';

/**
 * The sections `en` had as one object before the split (audit A4-10), in order, and those added
 * since (each placed beside its kin: `safetyNotes`, Phase 5e-3, after `safety`; `dashboard`,
 * the signed-in home, after `home`; `subjects`, G10-4, after `results`; `profileLook`, the
 * About me card, after `me`).
 */
const SECTIONS = [
  'app',
  'common',
  'nav',
  'home',
  'dashboard',
  'auth',
  'onboarding',
  'consent',
  'adultConsent',
  'chat',
  'crisis',
  'results',
  'subjects',
  'breakdown',
  'whatINeed',
  'recheck',
  'offers',
  'campus',
  'firstWeek',
  'safety',
  'safetyNotes',
  'modules',
  'passTypes',
  'qualifications',
  'reportKinds',
  'documents',
  'confirm',
  'me',
  'profileLook',
  'applications',
  'funding',
  'goals',
  'practice',
  'deadlines',
  'dev',
  'notifications',
  'permissions',
  'errors',
  'agent',
  // Appended since: the privacy policy template and the ECTA s43 footer.
  'privacyPage',
  'deploy',
  'profilePhoto',
  // The neutral university mark (option A, 2026-10-23).
  'universityMark',
  'planMaps',
  // Judge demo mode (docs/deploy/demo.md).
  'demo',
  // The judges' demo: its six made-up learners, and the university years' "coming next" cards.
  'demoPersonas',
  // The school record on My results (planning.md §18.7 C2).
  'schoolRecord',
  // The judge demo's real sign-up (a hackathon exception) and the main site / demo switch.
  'demoSignup',
  // My CV, made by Mmereko (docs/design/mmereko-api-proposal.md).
  'cv',
  // The profile photo's DRAFT consent v4 / adult-v3 lines and privacy section (A11-31).
  'profilePhotoDraft',
  // The judge demo's on-screen phone sign-up on made-up 080 numbers (a hackathon exception).
  'demoPhoneSignup',
  // Phase 6d: free books on a module card.
  'freeBooks',
  // Module outlines (Phase 6b): upload, check part by part, keep.
  'moduleOutline',
  // Module cards and the mark calculator (Phase 6c).
  'moduleCard',
  // Public TVET colleges (planning.md §19.1): Plan B, the filter, "Is this college registered?".
  'colleges',
  // "Open Mmereko" on My CV: Mmereko's own site in a canvas, 18+ or at university (2026-10-24).
  'cvMmereko',
] as const;

const bySection = new Map<string, unknown>(Object.entries(sections));
const fromIndex = new Map<string, unknown>(Object.entries(index));

describe('en, composed from its sections (A4-10)', () => {
  it('has exactly the sections it had as one object, in the same order', () => {
    expect(Object.keys(en)).toEqual([...SECTIONS]);
  });

  it('is the sections themselves, so en.x and the section x can never disagree', () => {
    for (const key of SECTIONS) expect(en[key], key).toBe(bySection.get(key));
    expect(en.offers.errors).toBe(sections.offerErrors);
    expect(en.documents.errors).toBe(sections.documentErrors);
  });

  it('exports every section, and nothing else, from the sections barrel and the package', () => {
    expect([...bySection.keys()].sort()).toEqual(
      [...SECTIONS, 'offerErrors', 'documentErrors'].sort(),
    );
    for (const [name, section] of bySection) expect(fromIndex.get(name), name).toBe(section);
  });

  it('kept these strings word for word through the move', () => {
    expect(en.app.name).toBe('UniversityFlow');
    expect(en.common.skipToContent).toBe('Skip to main content');
    expect(en.common.rand(12500)).toBe(`R${(12500).toLocaleString('en-ZA')}`);
    expect(en.auth.title).toBe('Sign in with your cellphone number');
    expect(en.auth.pinLead('082 *** 4567')).toBe(
      'We sent a 6-digit PIN to 082 *** 4567. It works for 10 minutes.',
    );
    expect(en.auth.errors.rateLimited).toBe('Too many tries. Wait a few minutes and try again.');
    expect(en.offers.errors['offer-exists']).toBe('You’ve already added an offer for this course.');
    expect(en.documents.errors['too-large']).toBe(
      'That file is bigger than 10 MB. Try a smaller photo.',
    );
    expect(en.confirm.errors.duplicate).toBe('Each subject can only appear once.');
    expect(en.nav.modules).toBe('My modules');
    expect(en.errors.consent).toBe('A parent or guardian needs to agree before you can do this.');
  });
});
