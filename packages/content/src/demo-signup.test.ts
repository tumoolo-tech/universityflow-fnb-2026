import { describe, expect, it } from 'vitest';
import { en } from './en';
import { demoSignup } from './sections';

/**
 * The judge demo's real sign-up (a hackathon exception the owner approved on 2026-10-23,
 * docs/deploy/demo.md) and the switch between the main site and the demo. The notice before
 * sign-up must say what is stored, where, for how long, for whom, and that it is not the real
 * service yet.
 */
describe('en.demoSignup', () => {
  it('is its own section, after the sections before it', () => {
    const keys = Object.keys(en);
    expect(keys.indexOf('demoSignup')).toBeGreaterThan(keys.indexOf('demo'));
    expect(keys.indexOf('demoSignup')).toBeGreaterThan(keys.indexOf('schoolRecord'));
    expect(en.demoSignup).toBe(demoSignup);
  });

  it('the notice says what is stored, where, for how long, for whom, and why', () => {
    const notice = demoSignup.noticePoints.join(' ');
    expect(notice).toMatch(/email address/);
    expect(notice).toMatch(/Google Firebase/);
    expect(notice).toMatch(/demo’s own database/);
    expect(notice).toMatch(/30 days/);
    expect(notice).toMatch(/hackathon/);
    expect(notice).toMatch(/not the real UniversityFlow service/);
    expect(notice).toMatch(/18 or older/);
    expect(notice).toMatch(/someone else’s/);
  });

  it('the refusal for under-18s says why and what was done', () => {
    expect(demoSignup.adultsOnly).toMatch(/18/);
    expect(demoSignup.adultsOnly).toMatch(/deleted/);
  });

  it('the judges’ entry and the way back', () => {
    expect(demoSignup.judgeEntryTitle).toBe('Demo for judges');
    expect(demoSignup.judgeEntryLead).toMatch(/Grade 10 to final-year university/);
    expect(demoSignup.backToMain).toBe('Back to UniversityFlow');
  });
});
