import { en } from '@universityflow/content';
import { useId } from 'react';
import { Badge, Card } from '@/components/ui';
import type { RecheckCard as RecheckData } from '@/lib/server/rechecks';

/** How many moves to list before "and N more". */
const SHOWN = 8;

const kindName = (kind: string) => en.reportKinds[kind as keyof typeof en.reportKinds] ?? kind;

/**
 * "Since your June report…" (Phase 4c): the courses that moved between Qualify now, Close and
 * Plan B when the learner confirmed a new Grade 12 report. Computed by packages/admissions.
 */
export function RecheckCard({ recheck }: { recheck: RecheckData }) {
  const t = en.recheck;
  // Its own ids: the card can be shown more than once on a page or in a chat (A3-10).
  const id = useId();
  const ups = recheck.moves.filter((m) => m.direction === 'up');
  const downs = recheck.moves.filter((m) => m.direction === 'down');
  const list = (title: string, moves: typeof recheck.moves, id: string) =>
    moves.length === 0 ? null : (
      <section aria-labelledby={id} className="flex flex-col gap-1">
        <h3 id={id} className="text-base">
          {title} ({moves.length})
        </h3>
        <ul className="flex list-disc flex-col gap-1 pl-6">
          {moves.slice(0, SHOWN).map((m) => (
            <li key={m.programmeId}>
              <span className="font-medium">
                {m.universityName}: {m.name}
              </span>{' '}
              <span className="text-muted">{t.move(t.standings[m.from], t.standings[m.to])}</span>
            </li>
          ))}
        </ul>
        {moves.length > SHOWN ? (
          <p className="text-sm text-muted">{t.more(moves.length - SHOWN)}</p>
        ) : null}
      </section>
    );
  return (
    <Card aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
      {/* Only when there is a badge: an empty row took a gap of its own above the title. */}
      {recheck.includesDrafts ? (
        <div className="flex flex-wrap gap-2">
          <Badge tone="warning">{en.common.draftBadge}</Badge>
        </div>
      ) : null}
      <h2 id={`${id}-title`} className="text-lg">
        {t.title(kindName(recheck.previousKind))}
      </h2>
      <p className="text-muted">{t.lead(kindName(recheck.reportKind))}</p>
      {recheck.moves.length === 0 ? <p>{t.none}</p> : null}
      {list(t.up, ups, `${id}-up`)}
      {list(t.down, downs, `${id}-down`)}
    </Card>
  );
}
