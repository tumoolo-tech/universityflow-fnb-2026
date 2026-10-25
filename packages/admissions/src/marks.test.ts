import { describe, expect, it } from 'vitest';
import { byPercentDescending, InvalidMarksError, type SubjectMark, validateMarks } from './marks';

describe('validateMarks (only confirmed, well-formed marks reach a calculator)', () => {
  it('adds the NSC level to each mark', () => {
    expect(validateMarks([{ subject: 'mathematics', percent: 64 }])).toEqual([
      { subject: 'mathematics', percent: 64, level: 5 },
    ]);
  });

  it('refuses an unknown subject', () => {
    expect(() =>
      validateMarks([{ subject: 'astrology', percent: 70 } as unknown as SubjectMark]),
    ).toThrow(InvalidMarksError);
  });

  it('refuses the same subject twice', () => {
    expect(() =>
      validateMarks([
        { subject: 'mathematics', percent: 70 },
        { subject: 'mathematics', percent: 60 },
      ]),
    ).toThrow(/twice/);
  });

  it.each([-1, 101, 64.5, Number.NaN])('refuses %s as a percentage', (percent) => {
    expect(() => validateMarks([{ subject: 'mathematics', percent }])).toThrow(InvalidMarksError);
  });
});

describe('byPercentDescending', () => {
  it('sorts highest first and keeps ties stable', () => {
    const marks: SubjectMark[] = [
      { subject: 'history', percent: 60 },
      { subject: 'mathematics', percent: 80 },
      { subject: 'geography', percent: 60 },
    ];
    expect(byPercentDescending(marks).map((m) => m.subject)).toEqual([
      'mathematics',
      'history',
      'geography',
    ]);
  });
});
