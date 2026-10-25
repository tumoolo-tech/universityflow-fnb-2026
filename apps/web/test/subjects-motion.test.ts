import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * My subjects' look and motion (G10-4, round 2; the owner's decision 9: CSS only). A `details`
 * summary styled `inline-flex` loses the browser's marker (the proposal's problem 3): every
 * summary on the page now hides the marker on purpose and shows a chevron instead. Every
 * transition and animation in the page's styles takes a `--uf-duration-*` token, which
 * tokens.css sets to 0ms under reduced motion (hard rule 9), so none can outlast it.
 */

const VIEW = readFileSync(
  join(__dirname, '..', 'app', '(app)', 'subjects', 'subjects-view.tsx'),
  'utf8',
);
const CSS = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');

const START = '/* ---- My subjects (app/(app)/subjects/subjects-view.tsx) ---- */';
const END = '/* ---- end My subjects ---- */';

function section(css: string): string {
  const from = css.indexOf(START);
  const to = css.indexOf(END);
  return from === -1 || to === -1 ? '' : css.slice(from, to);
}

/** Summaries that keep the browser's marker, or have no chevron right inside them. */
function bareSummaries(source: string): string[] {
  const lines = source.split('\n');
  return lines.flatMap((line, i) => {
    if (!/<summary\b/.test(line)) return [];
    const marked = /\blist-none\b/.test(line) && /\[&::-webkit-details-marker\]:hidden/.test(line);
    const chevron = /<Icon name="chevron"/.test(lines[i + 1] ?? '');
    return marked && chevron ? [] : [`line ${i + 1}`];
  });
}

/** `transition` or `animation` declarations whose time is not a duration token. */
function rawTimings(css: string): string[] {
  return (
    [...css.matchAll(/(?:transition|animation)(?:-duration|-delay)?\s*:\s*([^;]+);/g)]
      .map((m) => (m[1] ?? '').trim())
      // `none` (the reduced-motion path) has no time to take.
      .filter((value) => value !== 'none')
      .filter((value) => /\d(?:ms|s)\b/.test(value) || !/var\(--uf-duration-/.test(value))
  );
}

/** Tailwind timing utilities with a hand-typed time (`duration-300`, `delay-[50ms]`). */
const RAW_UTILITY = /\b(?:duration|delay)-(?:\d|\[)/;

describe('My subjects: disclosures and motion', () => {
  it('every summary hides the browser’s marker and shows a chevron instead', () => {
    expect(VIEW.match(/<summary\b/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(bareSummaries(VIEW)).toEqual([]);
  });

  it('has its own styles: the chevron turns when open, and the meter fills from its value', () => {
    const styles = section(CSS);
    expect(styles).not.toBe('');
    expect(styles).toMatch(
      /\.uf-door\[open\]\s*>\s*summary\s+\.uf-door-chevron\s*\{[^}]*rotate\(90deg\)/,
    );
    expect(styles).toMatch(/\.uf-meter-fill\s*\{[^}]*scaleX\(var\(--uf-meter-open\)\)/);
  });

  it('every transition and animation takes a duration token, so reduced motion zeroes it', () => {
    const styles = section(CSS);
    expect(styles).toMatch(/(?:transition|animation)/);
    expect(rawTimings(styles)).toEqual([]);
    expect(RAW_UTILITY.test(VIEW)).toBe(false);
  });

  it('the checks are proven on broken examples', () => {
    expect(
      bareSummaries('<summary className="inline-flex min-h-11 cursor-pointer items-center">'),
    ).toEqual(['line 1']);
    expect(
      bareSummaries(
        '<summary className="list-none [&::-webkit-details-marker]:hidden">\n  {t.needs(x)}',
      ),
    ).toEqual(['line 1']);
    expect(rawTimings('.x { transition: transform 200ms ease; }')).toHaveLength(1);
    expect(rawTimings('.x { animation: fill 0.6s ease-out; }')).toHaveLength(1);
    expect(
      rawTimings('.x { transition: transform var(--uf-duration-fast) ease-out; }'),
    ).toHaveLength(0);
    expect(rawTimings('.x { animation: none; }')).toHaveLength(0);
    expect(rawTimings('.x { transition: background-color ease; }')).toHaveLength(1);
    expect(RAW_UTILITY.test('<div className="transition-transform duration-300">')).toBe(true);
    expect(section('a { }')).toBe('');
  });
});
