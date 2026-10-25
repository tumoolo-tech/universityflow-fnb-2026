import { describe, expect, it } from 'vitest';
import { en } from './en';
import { demo } from './sections';

/**
 * Judge demo mode's words (docs/deploy/demo.md): the banner the owner chose, and six made-up
 * learners shown by first name only.
 */

describe('en.demo', () => {
  it('sits in en after the sections that were there before it', () => {
    const keys = Object.keys(en);
    expect(keys.indexOf('demo')).toBeGreaterThan(keys.indexOf('planMaps'));
    expect(keys.indexOf('demoPersonas')).toBeGreaterThan(keys.indexOf('planMaps'));
    expect(en.demo).toBe(demo);
  });

  it('the banner says what the owner chose, word for word', () => {
    expect(demo.bannerNotice).toBe('Demo: made-up learners. Don’t type real personal details.');
    expect(demo.switchLearner).toBe('Switch learner');
    expect(demo.pickerTitle).toBe('Try UniversityFlow as…');
  });

  it('the demo’s /sign-in title names no phone sign-in, and the learners’ cards live in demoPersonas', () => {
    expect(demo.signInTitle).toBe('Try UniversityFlow');
    expect(demo.signInTitle).not.toMatch(/cellphone|phone/i);
    expect(demo).not.toHaveProperty('personas');
    expect(Object.keys(en.demoPersonas.personas)).toHaveLength(6);
  });

  it('the judges’ guide has two to four things to try for every learner, and says what is made up', () => {
    const guide = en.demoPersonas.guide;
    expect(Object.keys(guide.tries)).toEqual(Object.keys(en.demoPersonas.personas));
    for (const [id, tries] of Object.entries(guide.tries)) {
      expect(tries.length, id).toBeGreaterThanOrEqual(2);
      expect(tries.length, id).toBeLessThanOrEqual(4);
    }
    expect(guide.honest.some((line) => /made up/.test(line))).toBe(true);
    expect(guide.personaHeading('Thabo', 'Grade 10')).toBe('Thabo, Grade 10');
  });
});
