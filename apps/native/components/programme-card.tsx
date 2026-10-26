import type { ProgrammeResult } from '@universityflow/admissions';
import { type SubjectId, subject } from '@universityflow/catalogue/client';
import { en } from '@universityflow/content/app';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { theme } from '../lib/theme';
import { Badge, Body, Button, Card, Heading, SourceLink } from './ui';
import { WithUniversityMark } from './university-mark';

const subjectName = (id: SubjectId | null, options: ReadonlyArray<SubjectId>) =>
  (id ? [id] : options)
    .map((s) => {
      try {
        return subject(s).name;
      } catch {
        return s;
      }
    })
    .join(' or ');

/**
 * One programme in a results list: the score, the gap, exactly what to improve, and a visible
 * label while the record or its score method is unverified (hard rule 3). Every fact here was
 * computed by packages/admissions on the server (hard rule 2).
 */
export function ProgrammeCard({ result }: { result: ProgrammeResult }) {
  const router = useRouter();
  const gaps: string[] = [];
  if (result.scoreGap > 0) gaps.push(en.results.pointsShort(result.scoreGap, result.scoreLabel));
  for (const s of result.shortfalls) {
    gaps.push(
      s.kind === 'other-subjects'
        ? en.results.improveOthers(s.count, s.targetPercent)
        : en.results.improve(subjectName(s.subject, s.subjects), s.percent, s.targetPercent),
    );
  }
  if (!result.passMet) gaps.push(en.results.passNeeded(en.passTypes[result.passRequired]));

  return (
    <Card testID={`programme-${result.programmeId}`}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space['2'] }}>
        <WithUniversityMark name={result.universityName}>
          <Badge>{result.universityName}</Badge>
        </WithUniversityMark>
        <Badge tone="info">{en.qualifications[result.qualification]}</Badge>
        {result.draft ? (
          <Badge tone="warning" testID={`draft-${result.programmeId}`}>
            {en.common.draftBadge}
          </Badge>
        ) : null}
      </View>
      <Heading>{result.name}</Heading>
      <Body small pair="cardMuted">
        {result.faculty}
      </Body>
      <Body pair="card" strong>
        {en.results.scoreOn(
          result.universityName,
          result.scoreLabel,
          result.score,
          result.scoreMaximum,
        )}
      </Body>
      {/* How the score stands against the course's minimum (RT-03). */}
      <Body pair="card">
        {result.requiredScore === null
          ? en.results.noMinimum
          : result.score >= result.requiredScore
            ? `${en.results.asksAtLeast(result.requiredScore)} · ${en.results.above(result.score - result.requiredScore)}`
            : en.results.asksAtLeast(result.requiredScore)}
      </Body>
      {gaps.map((gap) => (
        <Body key={gap} pair="card">
          {`• ${gap}`}
        </Body>
      ))}
      {result.nbt === 'required' ? <Badge tone="accent">{en.results.nbtRequired}</Badge> : null}
      <Button
        label={en.whatINeed.open}
        // The course is in the name itself, not only in a hint that can be off (A3-06).
        accessibilityLabel={`${en.whatINeed.open}: ${result.name}`}
        variant="secondary"
        testID={`what-i-need-${result.programmeId}`}
        onPress={() => router.push(`/what-i-need/${result.programmeId}`)}
      />
      <SourceLink url={result.sourceUrl} context={result.name} />
    </Card>
  );
}
