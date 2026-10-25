import type { Blocker, WhatINeedResult } from '@universityflow/admissions';
import { type SubjectId, subject } from '@universityflow/catalogue/client';
import { en } from '@universityflow/content/app';
import { View } from 'react-native';
import { theme } from '../lib/theme';
import { Badge, Body, Card, Heading, Notice, SourceLink } from './ui';
import { WithUniversityMark } from './university-mark';

/**
 * "What I need per subject" (Phase 4c), exactly as packages/admissions worked it out on the
 * server (hard rule 2), from the learner's latest confirmed report (hard rule 6). A draft is
 * labelled (hard rule 3). Every string from packages/content.
 */

const subjectName = (id: SubjectId) => {
  try {
    return subject(id).name;
  } catch {
    return id;
  }
};

export function blockerText(blocker: Blocker, scoreLabel: string): string {
  const b = en.whatINeed.blockers;
  switch (blocker.kind) {
    case 'subject-not-taken':
      return b.subjectNotTaken(blocker.subjects.map(subjectName).join(' or '));
    case 'not-enough-subjects':
      return b.notEnoughSubjects(blocker.needed, blocker.available);
    case 'no-home-language':
      return b.noHomeLanguage;
    case 'no-english':
      return b.noEnglish;
    case 'score-out-of-reach':
      return b.scoreOutOfReach(scoreLabel, blocker.best, blocker.required);
  }
}

export function WhatINeedPlanCard({ result }: { result: WhatINeedResult }) {
  const { plan } = result;
  const t = en.whatINeed;
  return (
    <Card testID={`what-i-need-${result.programmeId}`}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space['2'] }}>
        <WithUniversityMark name={result.universityName}>
          <Badge>{result.universityName}</Badge>
        </WithUniversityMark>
        {result.draft ? (
          <Badge tone="warning" testID="what-i-need-draft">
            {en.common.draftBadge}
          </Badge>
        ) : null}
      </View>
      <Heading>{result.name}</Heading>
      {result.draft ? <Notice tone="warning">{en.common.draftNotice}</Notice> : null}
      {plan.status === 'qualifies' || plan.status === 'on-track' ? (
        <Notice tone="success">{t.statuses[plan.status]}</Notice>
      ) : plan.status === 'reachable' ? (
        <Notice tone="info">{`${t.statuses.reachable} ${t.totalGap(plan.totalGap)}`}</Notice>
      ) : (
        <View testID="what-i-need-blockers" style={{ gap: theme.space['2'] }}>
          <Notice tone="warning">{t.statuses.unreachable}</Notice>
          {plan.blockers.map((b) => (
            <Body key={JSON.stringify(b)} pair="card">
              {`• ${blockerText(b, plan.score.label)}`}
            </Body>
          ))}
          <Body pair="card">{t.blockers.talkToSomeone}</Body>
        </View>
      )}
      {plan.subjects.map((s) => (
        <View key={s.subject} testID={`target-${s.subject}`} style={{ gap: theme.space['1'] }}>
          <Body pair="card" strong={s.gap > 0}>
            {`${t.row(subjectName(s.subject), s.current, s.target)}${s.gap > 0 ? ` (${t.gapValue(s.gap)})` : ''}`}
          </Body>
          {s.reasons.length > 0 ? (
            <Body pair="cardMuted" small>
              {s.reasons.map((r) => t.reasons[r]).join(' · ')}
            </Body>
          ) : null}
        </View>
      ))}
      <Body pair="card">
        {`${t.score(plan.score.label, plan.score.now, plan.score.atTarget)} · ${
          plan.score.required === null
            ? en.results.noMinimum
            : en.results.needed(plan.score.label, plan.score.required)
        }`}
      </Body>
      <Body pair="card">{t.pass(en.passTypes[plan.pass.atTarget])}</Body>
      <Body pair="cardMuted" small>
        {t.howChosen}
      </Body>
      <Body pair="cardMuted" small>
        {t.notAPromise}
      </Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: theme.space['3'] }}>
        <SourceLink url={result.sourceUrl} context={result.name} />
        <SourceLink url={result.methodSourceUrl}>{en.breakdown.method}</SourceLink>
      </View>
    </Card>
  );
}
