import { describe, expect, it } from 'vitest';
import { achievementLevel } from './nsc-levels';

describe('achievementLevel', () => {
  // Every whole percentage, so a band edge can never drift unnoticed.
  const expected = (percent: number) =>
    percent >= 80
      ? 7
      : percent >= 70
        ? 6
        : percent >= 60
          ? 5
          : percent >= 50
            ? 4
            : percent >= 40
              ? 3
              : percent >= 30
                ? 2
                : 1;

  it('maps every percentage from 0 to 100 to its band', () => {
    for (let percent = 0; percent <= 100; percent++) {
      expect(achievementLevel(percent), `${percent}%`).toBe(expected(percent));
    }
  });

  it.each([
    [29, 1],
    [30, 2],
    [49, 3],
    [50, 4],
    [59, 4],
    [60, 5],
    [79, 6],
    [80, 7],
  ])('puts %i%% in level %i (band edges)', (percent, level) => {
    expect(achievementLevel(percent)).toBe(level);
  });

  it.each([-1, 101, 59.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects %s instead of guessing',
    (percent) => {
      expect(() => achievementLevel(percent)).toThrow(RangeError);
    },
  );
});
