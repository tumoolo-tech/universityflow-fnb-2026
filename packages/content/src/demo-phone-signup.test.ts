import { describe, expect, it } from 'vitest';
import { en } from './en';
import { demoPhoneSignup } from './sections';

/**
 * The judge demo's on-screen phone sign-up (a hackathon exception the owner approved on
 * 2026-10-24, docs/deploy/demo.md). The notice must say: made-up details only, a made-up 080
 * number and never a cellphone, nothing is sent (the PIN and the guardian's link on screen), and
 * the account is deleted after 24 hours. Never "within 24 hours": on a daily cron (Vercel Hobby)
 * a copy can stand for up to 49 hours when nobody visits (docs/deploy/demo.md §7).
 */
describe('en.demoPhoneSignup', () => {
  it('is its own section, after the sections before it', () => {
    const keys = Object.keys(en);
    expect(keys.indexOf('demoPhoneSignup')).toBeGreaterThan(keys.indexOf('demoSignup'));
    expect(keys.indexOf('demoPhoneSignup')).toBeGreaterThan(keys.indexOf('profilePhotoDraft'));
    expect(en.demoPhoneSignup).toBe(demoPhoneSignup);
  });

  it('the notice says made-up details, an 080 number, nothing sent, deleted after 24 hours', () => {
    const notice = demoPhoneSignup.noticePoints.join(' ');
    expect(notice).toMatch(/made-up details only/);
    expect(notice).toMatch(/080/);
    expect(notice).toMatch(/never a cellphone number/);
    expect(notice).toMatch(/Nothing is sent/);
    expect(notice).toMatch(/shown on screen/);
    expect(notice).toMatch(/deleted after 24 hours/);
  });

  it('no demo words promise deletion within a set time the daily sweep cannot keep', () => {
    const all = JSON.stringify({ phone: en.demoPhoneSignup, demo: en.demo });
    expect(all).not.toMatch(/within 24 hours/);
    expect(all).not.toMatch(/within 30 days/);
  });

  it('the way in says the details are made up', () => {
    expect(demoPhoneSignup.action).toMatch(/new learner/);
    expect(demoPhoneSignup.action).toMatch(/made-up details/);
  });

  it('the refusal of any other number says to use a made-up 080 number', () => {
    expect(demoPhoneSignup.only080).toMatch(/made-up number that starts with 080/);
    expect(demoPhoneSignup.only080).toMatch(/Cellphone numbers are refused/);
  });

  it('a number another judge took says to pick another made-up 080 number', () => {
    expect(demoPhoneSignup.numberTaken).toMatch(/already/);
    expect(demoPhoneSignup.numberTaken).toMatch(/another made-up number that starts with 080/);
  });

  it('the PIN on screen says it would come by SMS, and that nothing is sent', () => {
    const line = demoPhoneSignup.pinOnScreen('123456');
    expect(line.startsWith('123456')).toBe(true);
    expect(line).toMatch(/SMS/);
    expect(line).toMatch(/nothing is sent/);
  });

  it('the onboarding line and the guardian’s link say what happens', () => {
    expect(demoPhoneSignup.onboardingNotice).toMatch(/deleted after 24 hours/);
    expect(demoPhoneSignup.guardianLinkLead).toMatch(/by SMS/);
    expect(demoPhoneSignup.guardianLinkLead).toMatch(/made-up guardian/);
    expect(demoPhoneSignup.guardianPhoneHint).toMatch(/080/);
  });
});
