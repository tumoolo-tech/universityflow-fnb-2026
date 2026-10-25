import { describe, expect, it } from 'vitest';
import { en } from './en';

/**
 * The profile photo's words for learners from Grade 10 (the owner's decision, 2026-10-23: "as long
 * as the picture is not used for anything else"; A11-31). New keys only: the explanation beside
 * the upload, the refusal when the learner's consent doesn't name the photo yet, and the DRAFT
 * lines for guardian consent v4 / adult-v3 and the privacy page, owed legal review. The drafts are
 * not live: the live consent wording, its versions and the privacy page are unchanged.
 */

const t = en.profilePhoto;
const draft = en.profilePhotoDraft;

describe('the photo’s words (A11-31)', () => {
  it('says beside the upload, plainly, that only the learner sees it and it is used for nothing else', () => {
    expect(t.onlyYou).toMatch(/only you/i);
    expect(t.onlyYou).toMatch(/anything else/i);
    expect(t.onlyYou).toMatch(/AI/);
    expect(t.onlyYou).toMatch(/remove/i);
    // Short sentences a 15-year-old reads at a glance.
    for (const sentence of t.onlyYou.split(/(?<=\.)\s+/)) {
      expect(sentence.split(/\s+/).length, sentence).toBeLessThanOrEqual(16);
    }
  });

  it('has a sentence for a learner whose consent doesn’t name the photo yet', () => {
    expect(t.consentNeeded).toMatch(/parent or guardian/i);
    expect(t.consentNeeded).toMatch(/18/);
  });

  it('drafts the consent lines for guardian v4 and adult-v3, marked as owed legal review', () => {
    const d = draft;
    expect(d.status).toMatch(/draft/i);
    expect(d.status).toMatch(/legal review/i);
    for (const line of [d.guardianLine, d.adultLine]) {
      expect(line).toMatch(/anything else/i);
      expect(line).toMatch(/AI/);
      expect(line).toMatch(/South Africa/);
      expect(line).toMatch(/remove/i);
      expect(line).toMatch(/deleted/i);
    }
    expect(d.guardianLine).toMatch(/your child/i);
    expect(d.adultLine).toMatch(/\byou\b/i);
  });

  it('drafts the privacy page section, marked for legal review', () => {
    const p = draft.privacy;
    expect(p.status).toMatch(/draft/i);
    expect(p.status).toMatch(/legal/i);
    expect(p.title).toMatch(/photo/i);
    const text = p.items.join(' ');
    for (const fact of [
      /only you/i,
      /AI/,
      /CV/,
      /South Africa/,
      /512/,
      /remove/i,
      /account/i,
      /withdraw/i,
      /download/i,
    ]) {
      expect(text).toMatch(fact);
    }
  });

  it('leaves the live wording alone: versions unchanged, and no draft line in it or on the privacy page', () => {
    expect(en.consent.version).toMatch(/^v3-/);
    expect(en.adultConsent.version).toMatch(/^adult-v2-/);
    const live = JSON.stringify([en.consent, en.adultConsent, en.privacyPage]);
    for (const line of [draft.guardianLine, draft.adultLine, ...draft.privacy.items]) {
      expect(live).not.toContain(line);
    }
    // The privacy page still lists the photo under "Coming later" until v4 is live.
    expect(en.privacyPage.sections.later.items.join(' ')).toMatch(/photo/i);
  });

  it('the judge demo (UF_DEMO_REAL_PHOTOS, a hackathon exception) says, plainly, a visitor’s own photo is deleted with their copy and used for nothing else', () => {
    const d = en.demo;
    expect(d.realPhotoLead).toMatch(/of yourself only/i);
    expect(d.realPhotoLead).toMatch(/24 hours/);
    expect(d.realPhotoLead).toMatch(/nothing else/i);
    // A judge's own sign-up account is kept 30 days, so its line says so.
    expect(d.realPhotoLeadAccount).toMatch(/of yourself only/i);
    expect(d.realPhotoLeadAccount).toMatch(/30 days/);
    expect(d.realPhotoLeadAccount).toMatch(/nothing else/i);
    expect(d.realPhotoLegend).toMatch(/own photo/i);
  });

  it('keeps the drafts out of the app’s bundle (A4-18): web only', async () => {
    const app = await import('./app');
    expect(Object.keys(app)).not.toContain('profilePhotoDraft');
    expect(Object.keys(app)).toContain('profilePhoto');
  });
});
