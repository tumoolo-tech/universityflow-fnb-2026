import { demoPersonas } from '@universityflow/content';
import type { HomeData } from '@universityflow/ui';
import { Card } from './ui';

/**
 * The university years' "coming next" cards (judge demo spec): one honest card for each part of
 * Stages 6 to 8 that isn't built yet (a study coach, marks and weak spots, a plan that fits your
 * life, a year-to-year portfolio). Shown on the home once a university student's first week is
 * behind them; true for real students as much as for the demo's. A server component: no
 * JavaScript, no motion, nothing to press, and no date promised.
 */

/**
 * At university, with the first week behind them: every first-week step done, or in a second or
 * final year (A2-66), whose first week was a year or more ago whatever the checklist says.
 */
export function showsComingNext(
  data: Pick<HomeData, 'stage' | 'firstWeek' | 'universityYear'>,
): boolean {
  if (data.stage !== 'university') return false;
  const group = data.universityYear?.group;
  if (group === 'middle' || group === 'final') return true;
  return (
    data.firstWeek !== null &&
    data.firstWeek.total > 0 &&
    data.firstWeek.done >= data.firstWeek.total
  );
}

export function ComingNext() {
  const t = demoPersonas.comingNext;
  // Module marks shipped with the module card (#129): weak spots are what is still to come (A6-06).
  const items = {
    studyCoach: t.items.studyCoach,
    weakSpots: t.weakSpots,
    lifePlan: t.items.lifePlan,
    portfolio: t.items.portfolio,
  };
  return (
    // On Card, the home's one card (20px inside, the one card-title size).
    <Card aria-labelledby="home-coming-next" className="flex flex-col gap-3">
      <h2 id="home-coming-next" className="text-lg">
        {t.title}
      </h2>
      <p className="text-muted">{t.lead}</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {Object.entries(items).map(([key, item]) => (
          <li key={key} className="flex flex-col gap-1 rounded-md border border-line bg-sunk p-3">
            <h3 className="text-base font-semibold">{t.label(item.name)}</h3>
            <p className="text-sm text-muted">{item.line}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
