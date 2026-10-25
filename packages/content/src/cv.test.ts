import { describe, expect, it } from 'vitest';
import * as app from './app';
import { CV_REPORT_REASONS, isCvReportReason } from './cv-reports';
import { en } from './en';
import { cv } from './sections';

/**
 * `en.cv` (docs/design/mmereko-api-proposal.md §10.5): the CV API's status words and error
 * reasons, so the page and the app say the same thing. The page's own copy (the opt-in card, the
 * sections) is added with the page. Every reason the data layer and the routes give has words.
 */

describe('en.cv', () => {
  it('is wired into en, after the sections that were there before it (gotcha 48)', () => {
    expect(en.cv).toBe(cv);
    const keys = Object.keys(en);
    expect(keys.indexOf('cv')).toBeGreaterThan(keys.indexOf('schoolRecord'));
  });

  it('records the opt-in wording’s version in the shape the database takes', () => {
    expect(cv.optInVersion).toMatch(/^[a-z0-9-]{1,40}$/);
  });

  it('has a status word for every state a CV can be in', () => {
    for (const status of ['queued', 'submitted', 'ready', 'failed'] as const) {
      expect(cv.status[status].length).toBeGreaterThan(0);
    }
    expect(cv.status.queued).toBe(cv.status.submitted);
  });

  it('has words for every reason the API gives', () => {
    for (const reason of [
      'cv-consent',
      'cv-share-age',
      'cv-share-unchecked',
      'cv-busy',
      'cv-limit',
      'cv-not-ready',
      'cv-opted-in',
      'cv-incomplete',
      'personal-number',
      'rate-limited',
      'cv-unavailable',
    ] as const) {
      expect(cv.errors[reason].length, reason).toBeGreaterThan(0);
    }
  });

  it('says plainly what an expired or switched-off share link is', () => {
    expect(cv.share.gone).toMatch(/expired|switched off/);
  });
});

/**
 * The page and the app screen's own words (§10.5, §9.2): the opt-in card is the draft wording of
 * §9.2, owed legal review and the owner's wording review.
 */
describe('en.cv, the page and the screen', () => {
  it('names the page "My CV"', () => {
    expect(cv.title).toBe('My CV');
  });

  it('the opt-in card says what goes to Mmereko, what never does, how long and where (§9.2)', () => {
    expect(cv.optIn.body).toMatch(/Mmereko/);
    expect(cv.optIn.body).toMatch(/only what you tick/);
    expect(cv.optIn.body).toMatch(/never your phone number or ID number/);
    expect(cv.optIn.body).toMatch(/at most one day/);
    expect(cv.optIn.body).toMatch(/South Africa/);
    expect(cv.optIn.body).toMatch(/stop any time/);
  });

  it('says contact details are typed for the CV, never the sign-in phone or an ID (D9)', () => {
    expect(cv.what.contactHint).toMatch(/never use the number you sign in with/);
    expect(cv.what.contactHint).toMatch(/ID or student number/);
  });

  it('says marks stay off unless ticked (D11)', () => {
    expect(cv.what.subjectsHint).toMatch(/unless you tick/);
  });

  it('says where every tickable thing comes from', () => {
    for (const from of [
      'profile',
      'report',
      'offer',
      'registration',
      'entries',
      'typed',
    ] as const) {
      expect(cv.what.from[from].length, from).toBeGreaterThan(0);
    }
  });

  it('has a word for every kind of entry and evidence link', () => {
    for (const kind of [
      'project',
      'skill',
      'work',
      'volunteer',
      'award',
      'language',
      'certificate',
    ] as const) {
      expect(cv.entries.kinds[kind].length, kind).toBeGreaterThan(0);
    }
    for (const kind of ['repository', 'demo', 'document', 'video', 'other'] as const) {
      expect(cv.entries.evidenceKinds[kind].length, kind).toBeGreaterThan(0);
    }
  });

  it('gives the ATS score as a number in words, never colour alone', () => {
    expect(cv.tailor.scoreValue(72)).toMatch(/72%/);
  });

  it('the withdrawal says what happens and offers the download first (§9.2, D15)', () => {
    expect(cv.withdraw.body).toMatch(/switch off your share links/);
    expect(cv.withdraw.body).toMatch(/download your CVs first/);
  });

  it('the share link is shown once and says so', () => {
    expect(cv.sharing.linkOnce).toMatch(/only once/);
  });

  it('says, before an advert is sent, that fitting a CV goes to the AI provider abroad (A11-37)', () => {
    // The opt-in card says "in South Africa", which is Mmereko's part; a fitted CV is written by
    // Anthropic, outside South Africa (D4), so the fitting card says so where the advert is pasted.
    expect(cv.tailor.aiNote).toMatch(/Anthropic/);
    expect(cv.tailor.aiNote).toMatch(/outside South Africa/);
    expect(cv.tailor.aiNote).toMatch(/what you ticked/);
    expect(cv.tailor.aiNote).toMatch(/advert/);
    expect(cv.tailor.aiNote).toMatch(/train/);
  });
});

/**
 * Wave 5 (2026-10-24): "Report this CV" for a fitted CV (A10-58, design §11, A10-35's pattern),
 * deleting one CV (A11-38, D13). Reasons only, never free text (hard rule 4).
 */
describe('en.cv, reporting and deleting one CV', () => {
  it('has words for every reason to report a CV, and a reason for every word', () => {
    expect(Object.keys(cv.report.reasons).sort()).toEqual([...CV_REPORT_REASONS].sort());
    for (const reason of CV_REPORT_REASONS) expect(cv.report.reasons[reason]).toMatch(/\S/);
  });

  it('knows its own reasons and nothing else', () => {
    expect(isCvReportReason('untrue')).toBe(true);
    expect(isCvReportReason('toString')).toBe(false);
    expect(isCvReportReason(1)).toBe(false);
  });

  it('is exported where the app reads it', () => {
    expect(app.CV_REPORT_REASONS).toBe(CV_REPORT_REASONS);
    expect(app.en.cv.report).toBe(cv.report);
  });

  it('says a report goes to a person, and asks before deleting a CV, naming what goes with it', () => {
    expect(cv.report.open).toBe('Report this CV');
    expect(cv.report.sent).toMatch(/person/);
    expect(cv.remove.ask('My CV')).toMatch(/My CV/);
    expect(cv.remove.ask('My CV')).toMatch(/PDF/);
    expect(cv.remove.ask('My CV')).toMatch(/share links/);
    expect(cv.remove.done('My CV')).toMatch(/My CV/);
    expect(cv.remove.name('My CV', '1 Oct 2026')).toMatch(/My CV, 1 Oct 2026/);
  });
});
