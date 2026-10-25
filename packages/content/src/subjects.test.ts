import { describe, expect, it } from 'vitest';
import { en } from './en';

/**
 * My subjects' words (G10-4, round 2). Code decides which courses are open (packages/admissions);
 * these hold the wording to what code can honestly claim. All new wording is owed the owner's
 * review.
 */

const t = en.subjects;

describe('My subjects wording', () => {
  it('names the closed courses by what they need, never as what a subject would open', () => {
    // A course closed by two requirements stays shut with one subject: "What would open them"
    // over-promised (the proposal's problem 1).
    expect(t.closesTitle).toBe('Courses your subjects close');
    expect(t.closesTitle).not.toMatch(/open/i);
    expect(t.needs('Mathematics')).toBe('Needs Mathematics');
    expect(t.alsoNeeds('Physical Sciences')).toBe('also needs Physical Sciences');
    expect(t.closesTitleAt('University of Johannesburg')).toMatch(/University of Johannesburg$/);
  });

  it('a group’s summary says what it holds, not "Show": the chevron and the state say that', () => {
    expect(t.needs('Mathematics')).not.toMatch(/show/i);
    expect(t.count(18)).toBe('18 courses');
    expect(t.count(1)).toBe('1 course');
    expect(t.countAt(4, 18)).toBe('4 of 18 courses');
  });

  it('keeps the what-if hypothetical: "if your school lets you", and the report unchanged', () => {
    expect(t.whatIfHeading('Mathematics', 'Mathematical Literacy')).toBe(
      'If your school lets you take Mathematics instead of Mathematical Literacy',
    );
    expect(t.reportUnchanged).toMatch(/report isn’t changed/);
    expect(t.whatIfLead).toMatch(/report isn’t changed/);
    expect(t.whatIfOpens(1)).toBe('1 more course would open.');
    expect(t.whatIfOpens(18)).toBe('18 more courses would open.');
    expect(t.whatIfCloses(2)).toBe('2 courses would close:');
  });

  it('says a higher bar in the catalogue’s numbers, which code passes in', () => {
    expect(t.higherScore('Mathematical Literacy', 26, 24)).toBe(
      'With Mathematical Literacy: a score of 26, not 24.',
    );
    expect(
      t.higherOption(
        t.atBar('Mathematical Literacy', t.level(6)),
        t.atBar('Mathematics', t.level(4)),
      ),
    ).toBe('Mathematical Literacy at level 6, where Mathematics at level 4 would do.');
    expect(t.levelAndPercent(5, 50)).toBe('level 5 (50%)');
    expect(t.percent(60)).toBe('60%');
  });

  it('a university row says its counts in words, so the link names them (WCAG 2.4.4)', () => {
    expect(t.universityClosed(5, 14)).toBe('5 of 14 courses closed');
    expect(t.meterLegend(63, 23)).toBe('63 open · 23 closed');
  });
});
