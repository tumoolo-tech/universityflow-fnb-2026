import { en } from '@universityflow/content/app';
import type { ExamCountdownArtifact, GoalCardArtifact } from '@universityflow/ui';
import { View } from 'react-native';
import { theme } from '../lib/theme';
import { ProgrammeCard } from './programme-card';
import { Badge, Body, Card, Heading, Notice, SourceLink } from './ui';
import { WithUniversityMark } from './university-mark';

/**
 * The Goal card and the Exam countdown in the app (planning.md §3, Stage 3). Every fact was
 * decided on the server by packages/admissions and the sourced timetable (hard rule 2);
 * unverified data is labelled (hard rule 3). Nothing animates.
 */

export function formatDay(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-ZA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Africa/Johannesburg',
  });
}

export function GoalCardView({ card }: { card: GoalCardArtifact }) {
  const t = en.goals;
  const { programme, result } = card;
  return (
    <View style={{ gap: theme.space['3'] }} testID="goal-card">
      <Heading pair="page">{t.goalTitle}</Heading>
      {result ? (
        <>
          <Body strong>{t.verdicts[result.verdict]}</Body>
          <ProgrammeCard result={result} />
        </>
      ) : (
        <Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space['2'] }}>
            <WithUniversityMark name={programme.universityName}>
              <Badge>{programme.universityName}</Badge>
            </WithUniversityMark>
            {programme.draft ? (
              <Badge tone="warning" testID="goal-draft">
                {en.common.draftBadge}
              </Badge>
            ) : null}
          </View>
          <Heading>{programme.name}</Heading>
          <Body pair="cardMuted" small>
            {programme.faculty}
          </Body>
          <Body pair="card">{card.hasMarks ? t.noVerdict : t.noMarks}</Body>
          {/* With a verdict, the programme card above carries this link (A2-09). */}
          <SourceLink url={programme.sourceUrl} context={programme.name} />
        </Card>
      )}
    </View>
  );
}

export function CountdownView({ countdown }: { countdown: ExamCountdownArtifact }) {
  const t = en.goals;
  const drafts = countdown.papers.some((p) => p.draft);
  return (
    <Card testID="exam-countdown">
      <Heading>{t.examsTitle}</Heading>
      {drafts ? <Notice tone="warning">{en.common.draftNotice}</Notice> : null}
      {!countdown.timetablePublished ? (
        <Body pair="card">{t.notPublished(countdown.examYear)}</Body>
      ) : countdown.subjectCount === 0 ? (
        <Body pair="card">{t.noSubjects}</Body>
      ) : countdown.papers.length === 0 ? (
        <Body pair="card">{t.noUpcoming}</Body>
      ) : (
        <>
          <Body pair="cardMuted" small>
            {t.examsLead(countdown.examYear)}
          </Body>
          {countdown.papers.map((p) => (
            <View
              key={p.id}
              testID={`paper-${p.id}`}
              style={{
                gap: theme.space['1'],
                padding: theme.space['3'],
                borderRadius: theme.radius.sm,
                // A panel in its card: the sunk fill and the card edge (RT-04).
                ...theme.panel,
              }}
            >
              <Body pair="sunk" strong>
                {t.paper(p.subjectName, p.paper)}
              </Body>
              <Badge tone="accent">{t.daysLeft(p.daysLeft)}</Badge>
              <Body pair="sunk" small>
                {`${t.when(formatDay(p.date), p.startsAt)} · ${t.duration(p.durationMinutes)}`}
              </Body>
              {p.draft ? (
                <Badge tone="warning" testID={`draft-${p.id}`}>
                  {en.common.draftBadge}
                </Badge>
              ) : null}
              {p.note ? (
                <Body pair="sunk" small>
                  {p.note}
                </Body>
              ) : null}
            </View>
          ))}
          {countdown.papers[0] ? (
            <SourceLink url={countdown.papers[0].sourceUrl} context={t.examsTitle} />
          ) : null}
        </>
      )}
    </Card>
  );
}
