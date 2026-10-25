import { describe, expect, it } from 'vitest';
import type { SubjectMark } from './marks';
import { meetsPass, nscPass, passRank } from './pass-type';

/** A typical seven-subject report, every subject at the same percentage unless overridden. */
function report(base: number, overrides: Partial<Record<SubjectMark['subject'], number>> = {}) {
  const subjects = {
    'isizulu-hl': base,
    'english-fal': base,
    mathematics: base,
    'physical-sciences': base,
    'life-sciences': base,
    geography: base,
    'life-orientation': base,
    ...overrides,
  };
  return Object.entries(subjects).map(([subject, percent]) => ({
    subject,
    percent,
  })) as SubjectMark[];
}

describe('nscPass (DBE pass types)', () => {
  it('awards a bachelor pass at 50% across the board', () => {
    expect(nscPass(report(50))).toBe('bachelor');
  });

  it('awards a diploma pass at 40% across the board', () => {
    expect(nscPass(report(40))).toBe('diploma');
  });

  it('awards a higher certificate with 40% in three and 30% in three', () => {
    expect(
      nscPass(report(30, { 'isizulu-hl': 40, 'english-fal': 40, mathematics: 40, geography: 30 })),
    ).toBe('higher-certificate');
  });

  it('awards no pass below 40% in the home language', () => {
    expect(nscPass(report(60, { 'isizulu-hl': 39 }))).toBe('none');
  });

  it('allows one subject below 30% (six of seven decide the NSC)', () => {
    expect(nscPass(report(55, { 'physical-sciences': 20 }))).toBe('bachelor');
  });

  it('awards no pass when two subjects are below 30%', () => {
    expect(nscPass(report(55, { 'physical-sciences': 20, geography: 25 }))).toBe('none');
  });

  it('needs 30% in English, the language of learning and teaching, for any higher-education pass', () => {
    expect(nscPass(report(70, { 'english-fal': 29 }))).toBe('nsc');
  });

  it('never counts Life Orientation among the four 20-credit subjects', () => {
    // Three 20-credit subjects at 50%+, LO at 90%: not a bachelor pass.
    const marks = report(45, {
      'isizulu-hl': 60,
      mathematics: 55,
      'physical-sciences': 52,
      'life-orientation': 90,
    });
    expect(nscPass(marks)).toBe('diploma');
  });

  it('counts the home language among the four subjects at 50%', () => {
    const marks = report(45, {
      'isizulu-hl': 60,
      'english-fal': 50,
      mathematics: 55,
      'physical-sciences': 52,
    });
    expect(nscPass(marks)).toBe('bachelor');
  });

  it('needs a home language: two FALs and no HL earns nothing', () => {
    const marks: SubjectMark[] = [
      { subject: 'english-fal', percent: 80 },
      { subject: 'afrikaans-fal', percent: 80 },
      { subject: 'mathematics', percent: 80 },
      { subject: 'physical-sciences', percent: 80 },
      { subject: 'life-sciences', percent: 80 },
      { subject: 'geography', percent: 80 },
      { subject: 'life-orientation', percent: 80 },
    ];
    expect(nscPass(marks)).toBe('none');
  });

  it('awards nothing on a report with too few subjects', () => {
    expect(nscPass(report(80).slice(0, 4))).toBe('none');
  });
});

describe('meetsPass', () => {
  it('ranks passes from none to bachelor', () => {
    expect(passRank('none')).toBeLessThan(passRank('nsc'));
    expect(passRank('diploma')).toBeLessThan(passRank('bachelor'));
  });

  it('accepts a higher pass for a lower requirement, never the reverse', () => {
    expect(meetsPass('bachelor', 'diploma')).toBe(true);
    expect(meetsPass('diploma', 'diploma')).toBe(true);
    expect(meetsPass('diploma', 'bachelor')).toBe(false);
    expect(meetsPass('nsc', 'higher-certificate')).toBe(false);
  });
});
