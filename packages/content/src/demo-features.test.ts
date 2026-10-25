import { describe, expect, it } from 'vitest';
import { en } from './en';

/**
 * The words the judge demo's three hackathon exceptions of 2026-10-24 add (My CV on the stand-in,
 * plan-map words, Read aloud): honest about what is made up and what is a stand-in.
 */
describe('en.demoPersonas: the demo’s My CV words', () => {
  it('the made-up learners’ school is plainly not a real one', () => {
    expect(en.demoPersonas.schoolName).toMatch(/Sample/);
    expect(en.demoPersonas.schoolName).toMatch(/\(demo\)$/);
  });

  it('says the CVs come from a stand-in, never Mmereko, and no AI writes them', () => {
    const line = en.demoPersonas.cvStandIn;
    expect(line).toMatch(/stand-in/);
    expect(line).toMatch(/not by Mmereko/);
    expect(line).toMatch(/no AI/);
  });

  it('keeps the keys that were there before it in their place', () => {
    const keys = Object.keys(en.demoPersonas);
    for (const before of ['personas', 'guardianName', 'sampleModule', 'comingNext', 'guide']) {
      expect(keys.indexOf('schoolName')).toBeGreaterThan(keys.indexOf(before));
      expect(keys.indexOf('cvStandIn')).toBeGreaterThan(keys.indexOf(before));
    }
  });
});
