import { describe, expect, it } from 'vitest';
import { en } from './en';
import { moduleOutline } from './sections';

/**
 * Module outlines' words (Phase 6b). The section sits after the sections that were there before
 * it (gotcha 48: other agents append after it), and says what the build does: weights that don't
 * add up are refused, never changed; lecturers' work details only (D3); "not in my outline" is an
 * answer.
 */

describe('en.moduleOutline', () => {
  it('is appended after the sections that were there before it', () => {
    const keys = Object.keys(en);
    expect(keys.indexOf('moduleOutline')).toBeGreaterThan(keys.indexOf('demoPhoneSignup'));
    expect(en.moduleOutline).toBe(moduleOutline);
  });

  it('says weights that don’t add up are checked by the learner, never changed for them', () => {
    expect(moduleOutline.components.notHundred(90)).toBe(
      'The parts add up to 90%, not 100%. Check them against your outline: we won’t change them for you.',
    );
    expect(moduleOutline.warnings['weights-dont-add-up']).toMatch(/won’t change them/);
  });

  it('promises work details only for lecturers (D3)', () => {
    expect(moduleOutline.sectionLeads.people).toMatch(
      /never keep a personal cellphone number or email/,
    );
    expect(moduleOutline.people.phoneInvalid).toMatch(/never keep a cellphone number/);
  });

  it('names the four parts in the order the learner checks them, each with "not in my outline"', () => {
    expect(Object.keys(moduleOutline.sections)).toEqual(['components', 'dates', 'books', 'people']);
    expect(moduleOutline.notInOutline).toBe('Not in my outline');
    expect(moduleOutline.step(1, 4)).toBe('Part 1 of 4');
  });

  it('never states a pass mark, DP or subminimum of its own (hard rule 2)', () => {
    const words = JSON.stringify(moduleOutline);
    expect(words).not.toMatch(/\b(?:40|50)%/);
    expect(moduleOutline.dpLine(45)).toBe('To write the exam (DP): a year mark of 45%');
  });
});
