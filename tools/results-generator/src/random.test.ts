import { describe, expect, it } from 'vitest';
import { pick, seeded, shuffled } from './random';

describe('the seeded random numbers', () => {
  it('repeat for a seed, and stay in [0, 1)', () => {
    const a = seeded('seed');
    const b = seeded('seed');
    const values = Array.from({ length: 200 }, () => a());
    expect(Array.from({ length: 200 }, () => b())).toEqual(values);
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it('shuffle without losing or adding anything', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    expect([...shuffled(seeded('s'), items)].sort((x, y) => x - y)).toEqual(items);
  });

  it('refuse to pick from nothing', () => {
    expect(() => pick(seeded('s'), [])).toThrow(RangeError);
  });
});
