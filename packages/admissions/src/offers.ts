import { type CatalogueView, daysUntil, type Programme } from '@universityflow/catalogue';
import type { SubjectMark } from './marks';
import { assessAll, assessOne, type ProgrammeResult } from './results';

/**
 * Offers (planning.md §11, Phase 5a): the code behind "I got in". Pure and React-Native-safe
 * (hard rule 11). Three jobs, each decided here and never by the AI (hard rule 2):
 *
 * - what kind of offer a learner holds, and that only a `final` one is final (§8.5);
 * - matching the programme named in an acceptance letter to catalogue programmes, as a short
 *   list the learner chooses from (never a silent pick);
 * - the January re-check: the programme's own published requirements run again on the learner's
 *   confirmed final results, met or not met, with Stage 1's Plan B when not.
 *
 * The conditions printed in a letter are the university's words. Nothing here reads or
 * interprets them: they are shown as quoted.
 */

export const OFFER_KINDS = ['provisional', 'conditional', 'final', 'waitlist'] as const;
export type OfferKind = (typeof OFFER_KINDS)[number];

export function isOfferKind(value: unknown): value is OfferKind {
  return typeof value === 'string' && (OFFER_KINDS as readonly string[]).includes(value);
}

/** Only a final offer is a place. Provisional, conditional and waitlist offers are not (§8.5). */
export function isFinalOffer(kind: OfferKind): boolean {
  return kind === 'final';
}

/** South African calendar days until a reply-by date (YYYY-MM-DD): 0 on the day, negative after. */
export function replyByDaysLeft(replyBy: string, now: Date): number {
  return daysUntil({ date: replyBy }, now);
}

// ── Matching a letter's programme to the catalogue ──────────────────────────────────────────

/** Lower case, accents and punctuation gone, "&" as "and", spaces collapsed. */
export function normaliseTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Short forms letters print, spelled out the way the catalogue names programmes. */
const ABBREVIATIONS: Readonly<Record<string, ReadonlyArray<string>>> = {
  ba: ['arts'],
  bsc: ['science'],
  bcom: ['commerce'],
  beng: ['engineering'],
  bed: ['education'],
  llb: ['laws'],
  mbchb: ['medicine', 'surgery'],
  bpharm: ['pharmacy'],
  bnurs: ['nursing'],
  dip: ['diploma'],
  cert: ['certificate'],
};

/** Words that say nothing about which programme it is. */
const FILLER = new Set([
  'a',
  'and',
  'bachelor',
  'bachelors',
  'degree',
  'for',
  'in',
  'of',
  'programme',
  'program',
  'the',
  'with',
]);

function words(title: string): Set<string> {
  const out = new Set<string>();
  for (const word of normaliseTitle(title).split(' ')) {
    for (const w of ABBREVIATIONS[word] ?? [word]) if (w && !FILLER.has(w)) out.add(w);
  }
  return out;
}

const containsPhrase = (haystack: string, phrase: string) =>
  phrase !== '' && ` ${haystack} `.includes(` ${phrase} `);

/** How many candidates the learner is shown. */
export const CANDIDATE_LIMIT = 5;

/**
 * The catalogue programmes a letter's words could mean, best first, at most `CANDIDATE_LIMIT`.
 * The learner picks one (or none, and chooses from the full list): this is a short list, never
 * a decision. Only programmes in `view` (the catalogue the learner may see) can appear. Empty
 * when nothing shares a meaningful word with the letter.
 */
export function programmeCandidates(
  view: CatalogueView,
  letter: { readonly university: string | null; readonly programme: string | null },
): string[] {
  const asked = letter.programme ? words(letter.programme) : new Set<string>();
  if (asked.size === 0) return [];
  const exact = normaliseTitle(letter.programme ?? '');
  const university = letter.university ? normaliseTitle(letter.university) : '';
  const universities = university
    ? view.universities.filter(
        (u) =>
          containsPhrase(university, normaliseTitle(u.name)) ||
          containsPhrase(university, normaliseTitle(u.shortName)),
      )
    : [];
  // A university named but not recognised narrows nothing: better a wider list than none.
  const at = new Set(universities.map((u) => u.id));
  const pool: ReadonlyArray<Programme> =
    at.size > 0 ? view.programmes.filter((p) => at.has(p.universityId)) : view.programmes;

  return pool
    .map((p) => {
      const has = words(p.name);
      const shared = [...asked].filter((w) => has.has(w)).length;
      const union = new Set([...asked, ...has]).size;
      const score = normaliseTitle(p.name) === exact ? 2 : shared / union;
      return { id: p.id, name: p.name, shared, score };
    })
    .filter((c) => c.shared > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, CANDIDATE_LIMIT)
    .map((c) => c.id);
}

// ── The January re-check ────────────────────────────────────────────────────────────────────

/** How many Plan B options a re-check that isn't met lists. */
export const FINAL_CHECK_PLAN_B_LIMIT = 5;

export interface FinalCheck {
  /**
   * `met`: the learner's confirmed final results meet every published minimum the catalogue holds
   * for the programme (eligibility, never a promise of a place: the university decides).
   * `not-met`: they don't. `unavailable`: the programme, or its score method, isn't in the
   * catalogue the learner may see (hard rule 3), so nothing is said.
   */
  readonly status: 'met' | 'not-met' | 'unavailable';
  /** The programme's result on the final marks, from the same code as My results. */
  readonly result: ProgrammeResult | null;
  /** Stage 1's Plan B on the same marks, when not met. Empty otherwise. */
  readonly planB: ReadonlyArray<ProgrammeResult>;
}

/**
 * Runs a programme's published requirements on the learner's confirmed final NSC results (as
 * Phase 4c's re-check does, hard rules 2 and 6). Says nothing about the letter's own conditions:
 * those are the university's words, shown as quoted.
 */
export function finalCheck(
  view: CatalogueView,
  programmeId: string,
  finalMarks: ReadonlyArray<SubjectMark>,
): FinalCheck {
  const report = { kind: 'grade-12-final', marks: finalMarks } as const;
  const detail = assessOne(view, programmeId, report);
  if (!detail) return { status: 'unavailable', result: null, planB: [] };
  if (detail.result.verdict === 'qualifies') {
    return { status: 'met', result: detail.result, planB: [] };
  }
  return {
    status: 'not-met',
    result: detail.result,
    planB: assessAll(view, report).planB.slice(0, FINAL_CHECK_PLAN_B_LIMIT),
  };
}
