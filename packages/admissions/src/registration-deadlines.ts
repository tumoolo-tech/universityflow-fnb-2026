import {
  CHANGE_DEADLINE_SCOPES,
  daysUntil,
  MODULE_TERMS,
  type ModuleTerm,
  type OfferedTerm,
  type RegistrationCalendar,
} from '@universityflow/catalogue';
import type { RegistrationComparison, RegistrationDifference } from './registration';

/**
 * The last day to change a registration (planning.md §11, Phase 5c), for the differences the
 * registration check found: the university's published change deadlines from its registration
 * calendar, for the terms those differences are about. Code picks the dates; the screens and the
 * AI only show them (hard rule 2).
 *
 * Honest when there is no date: a calendar for another academic year is not this year's, so
 * nothing from it is shown; and a term the calendar gives no deadline for is listed as such,
 * never given a nearby date.
 *
 * Pure: no I/O, no clock beyond the `now` passed in, React-Native-safe (hard rule 11).
 */

export type DeadlineScope = (typeof CHANGE_DEADLINE_SCOPES)[number];

export interface ChangeDeadline {
  /** What the calendar says it applies to: every module, or one term. */
  readonly appliesTo: DeadlineScope;
  /** YYYY-MM-DD, as published. */
  readonly lastDay: string;
  /** South African days until it: 0 is today, negative once passed. */
  readonly daysLeft: number;
}

export interface ChangeDeadlines {
  /**
   * `published`: the calendar for the registration's academic year gives at least one deadline
   * that applies. `none`: there is no calendar for that year (or none applies), so no date is
   * shown at all.
   */
  readonly status: 'published' | 'none';
  /** The deadlines that apply, earliest first, each once. */
  readonly deadlines: ReadonlyArray<ChangeDeadline>;
  /** Terms the differences are about that the calendar gives no deadline for. */
  readonly unpublishedTerms: ReadonlyArray<ModuleTerm>;
  /** The earliest deadline still to come (today counts), or null. */
  readonly next: ChangeDeadline | null;
}

/** The terms a module offered in `offered` can be taken in. */
function termsOf(offered: OfferedTerm): ModuleTerm[] {
  return offered === 'either' ? ['S1', 'S2'] : [offered];
}

/**
 * The terms one difference is about, or `all` when it is about the registration as a whole (or a
 * module whose term nobody knows).
 */
export function termsOfDifference(d: RegistrationDifference): ReadonlyArray<ModuleTerm> | 'all' {
  switch (d.kind) {
    // A module whose term the rule book doesn't print (#71) could be in any term: every deadline.
    case 'missing-compulsory':
      return d.module.semester ? termsOf(d.module.semester) : 'all';
    case 'wrong-semester':
      return d.module.semester
        ? [...new Set([d.registered.semester, ...termsOf(d.module.semester)])]
        : [d.registered.semester];
    case 'not-in-curriculum':
      return d.registered.semester ? [d.registered.semester] : 'all';
    case 'registered-twice': {
      const terms = d.registered.map((r) => r.semester);
      return terms.every((t): t is ModuleTerm => t !== undefined) ? [...new Set(terms)] : 'all';
    }
    case 'elective-group-unsatisfied':
    case 'credits-short':
    case 'credits-over':
      return 'all';
  }
}

/**
 * The change deadlines for a compared registration. `academicYear` is the year the learner
 * registered for; a calendar for any other year gives nothing.
 */
export function changeDeadlinesFor(
  comparison: Pick<RegistrationComparison, 'differences'>,
  calendar: RegistrationCalendar | undefined,
  academicYear: number,
  now: Date,
): ChangeDeadlines {
  const none: ChangeDeadlines = { status: 'none', deadlines: [], unpublishedTerms: [], next: null };
  if (!calendar || calendar.academicYear !== academicYear) return none;

  const involved = comparison.differences.map(termsOfDifference);
  const everyTerm = involved.length === 0 || involved.some((t) => t === 'all');
  const wanted: ReadonlyArray<ModuleTerm> = everyTerm
    ? MODULE_TERMS
    : MODULE_TERMS.filter((term) => involved.some((t) => t !== 'all' && t.includes(term)));

  const byScope = new Map(calendar.changeDeadlines.map((d) => [d.appliesTo, d.lastDay]));
  const chosen = new Map<DeadlineScope, string>();
  const unpublished: ModuleTerm[] = [];
  for (const term of wanted) {
    const own = byScope.get(term);
    const all = byScope.get('all');
    if (own !== undefined) chosen.set(term, own);
    else if (all !== undefined) chosen.set('all', all);
    // Every term, asked about because the whole registration is: only those the calendar names
    // count as unpublished, so a university without quarters isn't said to hide quarter dates.
    else if (!everyTerm) unpublished.push(term);
  }
  if (everyTerm && byScope.has('all')) chosen.set('all', byScope.get('all') as string);

  const deadlines = [...chosen]
    .map(([appliesTo, lastDay]) => ({
      appliesTo,
      lastDay,
      daysLeft: daysUntil({ date: lastDay }, now),
    }))
    .sort((a, b) => a.lastDay.localeCompare(b.lastDay) || scopeRank(a) - scopeRank(b));
  if (deadlines.length === 0) return { ...none, unpublishedTerms: unpublished };
  return {
    status: 'published',
    deadlines,
    unpublishedTerms: unpublished,
    next: deadlines.find((d) => d.daysLeft >= 0) ?? null,
  };
}

const scopeRank = (d: { appliesTo: DeadlineScope }) => CHANGE_DEADLINE_SCOPES.indexOf(d.appliesTo);
