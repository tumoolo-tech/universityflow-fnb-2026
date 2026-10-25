/**
 * The neutral university mark (the owner's decision, option A, 2026-10-23): beside every
 * university's name, our own letters ("Wits", "UJ", "UCT") in our own greys, never the
 * university's logo or colours. Its real logo shows only where the catalogue holds the
 * university's written permission (`logoPermission`, packages/catalogue logo-permission.ts).
 * React-Native-safe (hard rule 11): plain values only, drawn by each app's `UniversityMark`.
 */
import type { ColorToken } from '@universityflow/tokens';

/** The most letters a mark holds: "UKZN" still fits a small square. */
export const MONOGRAM_MAX = 4;

/** Small words a set of initials leaves out ("University of the Witwatersrand" → "UW"). */
const SMALL_WORDS = new Set(['of', 'the', 'and', 'for', 'in', 'at']);

/**
 * The mark's letters, from a university's short name as the catalogue gives it: a short name of
 * one word up to four letters is used as it is (Wits, UJ, UP, UCT, TUT, UKZN); a longer name gives
 * its initials, at most four. Whole characters, so a name in any script keeps its first letter.
 */
export function universityMonogram(shortName: string): string {
  const words = shortName.normalize('NFC').trim().split(/\s+/).filter(Boolean);
  const [only] = words;
  if (only === undefined) return '?';
  if (words.length === 1) return Array.from(only).slice(0, MONOGRAM_MAX).join('');
  return words
    .filter((w) => !SMALL_WORDS.has(w.toLowerCase()))
    .map((w) => (Array.from(w)[0] ?? '').toUpperCase())
    .slice(0, MONOGRAM_MAX)
    .join('');
}

/**
 * The logos the web app may serve, by the university's short name: exactly the catalogue's
 * `logoPermission` records (`/logos/<id>.png`, `logoWebPath`), held equal to them by
 * university-mark.test.ts. Empty: no university has given written permission. A person adds an
 * entry only with the record and the file (docs/brand/logo-permissions.md); the app reaches the
 * same path on the web app. A copy, not a lookup, so neither app loads the catalogue (A4-02).
 */
export const UNIVERSITY_LOGOS: Readonly<Record<string, string>> = {};

export interface UniversityMarkView {
  /** Our letters for the university: shown whenever there is no logo. */
  readonly monogram: string;
  /** The web path of its permitted logo, or null (every university today). */
  readonly logo: string | null;
}

/** What to draw beside a university's name (its short name, as views carry it). */
export function universityMark(
  shortName: string,
  logos: Readonly<Record<string, string>> = UNIVERSITY_LOGOS,
): UniversityMarkView {
  return { monogram: universityMonogram(shortName), logo: logos[shortName] ?? null };
}

/**
 * The mark's colours, all neutral greys from the tokens: the letters (`ink`) on a sunk tile
 * (`surfaceSunk`, a tested text pair) with a strong hairline (`lineStrong`, a tested non-text
 * pair) so the tile shows on any card. Never a university's colours.
 */
export const UNIVERSITY_MARK_COLORS = {
  ground: 'surfaceSunk',
  ink: 'ink',
  edge: 'lineStrong',
} as const satisfies Record<string, ColorToken>;
