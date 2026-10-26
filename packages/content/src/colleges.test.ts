import { describe, expect, it } from 'vitest';
import { en } from './en';
import { colleges } from './sections';

/**
 * The colleges' words (planning.md §19.1). The section sits after the sections that were there
 * before it (gotcha 48), promises no place, says nothing about funding (out of scope; any NSFAS
 * wording is a plan-drift flag), and holds no admission fact of its own (hard rule 2).
 */
describe('en.colleges', () => {
  it('is appended after the sections that were there before it', () => {
    const keys = Object.keys(en);
    expect(keys.indexOf('colleges')).toBeGreaterThan(keys.indexOf('moduleOutline'));
    expect(en.colleges).toBe(colleges);
  });

  it('never promises a place, and says the college decides', () => {
    expect(colleges.meetsNote).toMatch(/isn’t a place: the college decides/);
    expect(JSON.stringify(colleges)).not.toMatch(/guarantee|you qualify|you will get/i);
  });

  it('says nothing about funding (not in scope)', () => {
    expect(JSON.stringify(colleges)).not.toMatch(/nsfas|bursar|fund/i);
  });

  it('holds no entry rule or date of its own (hard rule 2)', () => {
    const words = JSON.stringify(colleges);
    expect(words).not.toMatch(/\d+%/);
    expect(words).not.toMatch(/\b20\d\d\b/);
    expect(colleges.yearPrinted(2027)).toBe('The college printed this for 2027.');
  });

  // A1-84 / A10-67: the entry level of a programme type is the catalogue's sourced record; the
  // words only take it.
  it('writes no entry level of its own: the grade comes from the catalogue', () => {
    const words = JSON.stringify(colleges);
    expect(words).not.toMatch(/Grade \d|matric|N3/);
    expect(colleges.programmeTypeEntry(9, null)).toBe('Starts after Grade 9');
    expect(colleges.programmeTypeEntry(12, 'N3')).toBe('Starts after matric or N3');
    expect(colleges.groupAfter(9)).toBe('College courses after Grade 9');
    expect(colleges.groupLeadAfter(9)).toBe(
      'NC(V) courses at public TVET colleges start after Grade 9. These are the ones your report doesn’t rule out.',
    );
  });

  it('warns plainly when a name is not on the list, and never as a yes', () => {
    expect(colleges.check.notFound('Example')).toBe(
      'We didn’t find “Example” on DHET’s list of public TVET colleges.',
    );
    expect(colleges.check.notFoundWarning).toMatch(/Don’t pay any fee/);
    expect(colleges.check.similar).toMatch(/these are not a match/);
  });

  it('names each closed count once, singular or plural', () => {
    expect(colleges.closed(1, 'TC 0153')).toMatch(/^1 more college course isn’t shown/);
    expect(colleges.closed(3, 'TC 0153')).toMatch(/^3 more college courses aren’t shown/);
    expect(colleges.courses(1)).toBe('1 course');
    expect(colleges.courses(2)).toBe('2 courses');
  });
});
