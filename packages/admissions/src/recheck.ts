import type { CatalogueView } from '@universityflow/catalogue';
import type { ScoredReport } from './basis';
import { assessAll, type Results } from './results';

/**
 * Re-checks after a new report (planning.md §11, Phase 4c): the learner's results on their
 * previous confirmed report and on the new one, both against the same catalogue today, and which
 * programmes moved between Stage 1's groups. Pure code; the apps only show it.
 */

/**
 * Where a programme sits in a learner's results. `not-yet` is everything My results leaves out;
 * `on-track` is Grade 10's (G10-3): meeting the minimums on marks no university admits on, so
 * from on track to qualify now on a Grade 11 report is a move up.
 */
export type Standing = 'qualify-now' | 'on-track' | 'close' | 'plan-b' | 'not-yet';

const RANK: Readonly<Record<Standing, number>> = {
  'not-yet': 0,
  close: 1,
  'on-track': 1.5,
  'qualify-now': 2,
  'plan-b': 2,
};

export interface Move {
  readonly programmeId: string;
  readonly from: Standing;
  readonly to: Standing;
  /** Up: nearer to qualifying. Down: further away. */
  readonly direction: 'up' | 'down';
}

export interface RecheckSummary {
  /** Every programme that changed group, ups first, then by programme id. */
  readonly moves: ReadonlyArray<Move>;
  readonly counts: Readonly<
    Record<
      'qualifyNow' | 'onTrack' | 'close' | 'planB',
      { readonly before: number; readonly after: number }
    >
  >;
  readonly includesDrafts: boolean;
}

function standings(results: Results): Map<string, Standing> {
  const map = new Map<string, Standing>();
  for (const r of results.qualifyNow) map.set(r.programmeId, 'qualify-now');
  for (const r of results.onTrack) map.set(r.programmeId, 'on-track');
  for (const r of results.close) map.set(r.programmeId, 'close');
  for (const r of results.planB) map.set(r.programmeId, 'plan-b');
  return map;
}

/** Compares two sets of results computed against the same catalogue. */
export function compareResults(before: Results, after: Results): RecheckSummary {
  const was = standings(before);
  const is = standings(after);
  const ids = [...new Set([...was.keys(), ...is.keys()])];
  const moves = ids
    .map((programmeId): Move | null => {
      const from = was.get(programmeId) ?? 'not-yet';
      const to = is.get(programmeId) ?? 'not-yet';
      if (from === to) return null;
      return { programmeId, from, to, direction: RANK[to] > RANK[from] ? 'up' : 'down' };
    })
    .filter((m): m is Move => m !== null)
    .sort(
      (a, b) =>
        Number(b.direction === 'up') - Number(a.direction === 'up') ||
        a.programmeId.localeCompare(b.programmeId),
    );
  return {
    moves,
    counts: {
      qualifyNow: { before: before.qualifyNow.length, after: after.qualifyNow.length },
      onTrack: { before: before.onTrack.length, after: after.onTrack.length },
      close: { before: before.close.length, after: after.close.length },
      planB: { before: before.planB.length, after: after.planB.length },
    },
    includesDrafts: after.includesDrafts,
  };
}

/** Both reports' results against today's catalogue, compared. */
export function recheck(
  view: CatalogueView,
  previous: ScoredReport,
  latest: ScoredReport,
): RecheckSummary {
  return compareResults(assessAll(view, previous), assessAll(view, latest));
}
