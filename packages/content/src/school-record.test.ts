import { describe, expect, it } from 'vitest';
import { en } from './en';
import { schoolRecord } from './en/school-record';
import * as index from './index';

describe('schoolRecord (planning.md §18.7 C2)', () => {
  it('is wired into en and the package, appended after the sections before it', () => {
    expect(en.schoolRecord).toBe(schoolRecord);
    expect(index.schoolRecord).toBe(schoolRecord);
    // Appended, never reordered: after `demoPersonas`, the last section before it. Later sections
    // may follow it (gotcha 48).
    const keys = Object.keys(en);
    expect(keys.indexOf('schoolRecord')).toBeGreaterThan(keys.indexOf('demoPersonas'));
  });

  it('says who entered every mark, and names a mark in full for a screen reader', () => {
    expect(schoolRecord.source.learner).toBe('Entered by you');
    expect(
      schoolRecord.markLabel('final Grade 10 report', 'Mathematics', 52, 4, 'Entered by you'),
    ).toBe('Mathematics, final Grade 10 report: 52%, level 4. Entered by you');
  });

  it('writes a change with its sign, and the key to the levels from the numbers given', () => {
    expect(schoolRecord.change(9)).toBe('+9');
    expect(schoolRecord.change(-6)).toBe('−6');
    expect(schoolRecord.change(0)).toBe('0');
    expect(schoolRecord.levelRange(7, 80, 100)).toBe('7: 80–100%');
  });
});
