import { describe, expect, it } from 'vitest';
import { en } from './en';
import { universityMark } from './en/university-mark';
import * as index from './index';

describe('universityMark', () => {
  it('is wired into en and the package, appended after the sections before it', () => {
    expect(en.universityMark).toBe(universityMark);
    expect(index.universityMark).toBe(universityMark);
    // Appended, never reordered: after `deploy`, the last section before it. Later sections
    // may follow it.
    const keys = Object.keys(en);
    expect(keys.indexOf('universityMark')).toBeGreaterThan(keys.indexOf('deploy'));
  });

  it('names a logo shown alone', () => {
    expect(universityMark.logoAlt('UCT')).toBe('UCT logo');
  });
});
