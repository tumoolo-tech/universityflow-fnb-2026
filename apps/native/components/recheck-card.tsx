import { en } from '@universityflow/content/app';
import { View } from 'react-native';
import type { RecheckResponse } from '../lib/types';
import { Badge, Body, Card, Heading } from './ui';

const SHOWN = 6;

const kindName = (kind: string) => en.reportKinds[kind as keyof typeof en.reportKinds] ?? kind;

/**
 * "Since your June report…" (Phase 4c): the courses that moved between Qualify now, Close and
 * Plan B when the learner confirmed a new Grade 12 report, as the server computed them.
 */
export function RecheckCard({ recheck }: { recheck: NonNullable<RecheckResponse['recheck']> }) {
  const t = en.recheck;
  const groups = [
    ['up', t.up, recheck.moves.filter((m) => m.direction === 'up')],
    ['down', t.down, recheck.moves.filter((m) => m.direction === 'down')],
  ] as const;
  return (
    <Card testID="recheck-card" emphasis>
      {recheck.includesDrafts ? <Badge tone="warning">{en.common.draftBadge}</Badge> : null}
      <Heading>{t.title(kindName(recheck.previousKind))}</Heading>
      <Body pair="cardMuted">{t.lead(kindName(recheck.reportKind))}</Body>
      {recheck.moves.length === 0 ? <Body pair="card">{t.none}</Body> : null}
      {groups.map(([key, title, moves]) =>
        moves.length === 0 ? null : (
          <View key={key} testID={`recheck-${key}`}>
            <Body pair="card" strong>
              {`${title} (${moves.length})`}
            </Body>
            {moves.slice(0, SHOWN).map((m) => (
              <Body key={m.programmeId} pair="card">
                {`• ${m.universityName}: ${m.name}, ${t.move(t.standings[m.from], t.standings[m.to])}`}
              </Body>
            ))}
            {moves.length > SHOWN ? (
              <Body pair="cardMuted" small>
                {t.more(moves.length - SHOWN)}
              </Body>
            ) : null}
          </View>
        ),
      )}
    </Card>
  );
}
