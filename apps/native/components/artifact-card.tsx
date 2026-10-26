import { crisisWords, en } from '@universityflow/content/app';
import type {
  Artifact,
  CampusTourArtifact,
  CrisisCardArtifact,
  ExamCountdownArtifact,
  FirstWeekArtifact,
  GoalCardArtifact,
  MyModulesArtifact,
  OfferCardArtifact,
  PracticeArtifact,
} from '@universityflow/ui';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { theme } from '../lib/theme';
import { CampusTourView, CrisisCampusView, FirstWeekView } from './campus';
import { CountdownView, GoalCardView } from './goals';
import { MyModulesCard } from './my-modules-card';
import { OfferCardView } from './offer-card';
import { PracticeView } from './practice';
import { Body, Button, CallButton, Card, Heading, Notice } from './ui';

/**
 * A tool's artifact, rendered by kind from the shared types in packages/ui. The model never
 * writes one (planning.md §16.3). For now each kind is a titled summary; the crisis card is
 * complete, because it is the one that can't wait for a richer version.
 */

/** The title each kind shows, from packages/content (hard rule 8). */
export function artifactTitle(artifact: Artifact): string {
  switch (artifact.kind) {
    case 'crisis-card':
      return en.crisis.cardTitle;
    case 'results-card':
    case 'course-explorer':
      return en.results.title;
    case 'score-breakdown':
      return en.breakdown.title;
    case 'what-i-need':
      return `${en.whatINeed.title}: ${artifact.result.name}`;
    case 'deadlines':
      return en.deadlines.title;
    case 'application-pack':
      return `${en.applications.pack}: ${artifact.university.shortName}`;
    case 'funding':
      return en.funding.nsfas;
    case 'goal-card':
      return en.goals.goalTitle;
    case 'exam-countdown':
      return en.goals.examsTitle;
    case 'practice':
      return en.practice.title;
    case 'offer-card':
      return en.offers.kinds[artifact.offerKind];
    case 'campus-tour':
      return `${en.campus.title}: ${artifact.universityName}`;
    case 'first-week':
      return `${en.firstWeek.title}: ${artifact.universityName}`;
    case 'my-modules':
      return en.modules.title;
  }
}

function summary(
  artifact: Exclude<
    Artifact,
    | CrisisCardArtifact
    | GoalCardArtifact
    | ExamCountdownArtifact
    | PracticeArtifact
    | OfferCardArtifact
    | CampusTourArtifact
    | FirstWeekArtifact
    | MyModulesArtifact
  >,
): string {
  switch (artifact.kind) {
    case 'results-card':
      return `${en.results.projectedPass}: ${en.passTypes[artifact.passProjected]}`;
    case 'course-explorer':
      // Grade 10 marks: On track and Close only, never Qualify now (G10-3).
      return (
        artifact.results.basis === 'progress'
          ? [
              `${en.results.groups.onTrack}: ${artifact.results.onTrack.length}`,
              `${en.results.groups.close}: ${artifact.results.close.length}`,
            ]
          : [
              `${en.results.groups.qualifyNow}: ${artifact.results.qualifyNow.length}`,
              `${en.results.groups.close}: ${artifact.results.close.length}`,
              `${en.results.groups.planB}: ${artifact.results.planB.length}`,
            ]
      ).join(' · ');
    case 'score-breakdown':
      return `${artifact.result.name}: ${en.results.yourScore(
        artifact.breakdown.label,
        artifact.breakdown.total,
        artifact.breakdown.maximum,
      )}`;
    case 'what-i-need':
      return artifact.result.plan.status === 'qualifies' ||
        artifact.result.plan.status === 'on-track'
        ? en.whatINeed.statuses[artifact.result.plan.status]
        : artifact.result.plan.status === 'reachable'
          ? `${en.whatINeed.statuses.reachable} ${en.whatINeed.totalGap(artifact.result.plan.totalGap)}`
          : en.whatINeed.statuses.unreachable;
    case 'deadlines':
      return artifact.windows.length === 0
        ? en.deadlines.none
        : en.chat.artifactCount(artifact.windows.length);
    case 'application-pack':
      return `${en.applications.checklist}: ${artifact.checklist.filter((c) => c.done).length}/${artifact.checklist.length}`;
    case 'funding':
      return [
        `${en.applications.checklist}: ${artifact.checklist.filter((c) => c.done).length}/${artifact.checklist.length}`,
        // feat/bursaries: how many other bursaries the tool returned; the list is on the web.
        ...(artifact.bursaries?.length
          ? [en.funding.bursariesCount(artifact.bursaries.length)]
          : []),
      ].join(' · ');
  }
}

export function ArtifactCard({ artifact }: { artifact: Artifact }) {
  if (artifact.kind === 'crisis-card') return <CrisisCard artifact={artifact} />;
  // Complete in the app: the same views as the My goal screen.
  if (artifact.kind === 'goal-card') {
    return (
      <View testID="artifact-goal-card">
        <GoalCardView card={artifact} />
      </View>
    );
  }
  if (artifact.kind === 'exam-countdown') {
    return (
      <View testID="artifact-exam-countdown">
        <CountdownView countdown={artifact} />
      </View>
    );
  }
  if (artifact.kind === 'offer-card') {
    return (
      <View testID="artifact-offer-card" style={styles.withLink}>
        <OfferCardView offer={artifact} />
        <OpenScreen route="/offers" title={en.offers.title} />
      </View>
    );
  }
  if (artifact.kind === 'campus-tour') {
    return (
      <View testID="artifact-campus-tour" style={styles.withLink}>
        <CampusTourView tour={artifact} />
        <OpenScreen route="/campus" title={en.campus.title} />
      </View>
    );
  }
  if (artifact.kind === 'first-week') {
    return (
      <View testID="artifact-first-week" style={styles.withLink}>
        <FirstWeekView checklist={artifact} />
        <OpenScreen route="/first-week" title={en.firstWeek.title} />
      </View>
    );
  }
  if (artifact.kind === 'my-modules') {
    return (
      <View testID="artifact-my-modules">
        <MyModulesCard artifact={artifact} linkToPage />
      </View>
    );
  }
  if (artifact.kind === 'practice') {
    return (
      <View testID="artifact-practice">
        <PracticeView practice={artifact} />
      </View>
    );
  }
  return (
    <Card testID={`artifact-${artifact.kind}`}>
      <Heading>{artifactTitle(artifact)}</Heading>
      <Body pair="card">{summary(artifact)}</Body>
      <Body pair="cardMuted" small>
        {en.chat.artifactOnWeb}
      </Body>
    </Card>
  );
}

/**
 * The quiet button under a chat card to its own screen, where the learner can act on it (A2-16):
 * the web's `linkToPage`, and what My modules already has.
 */
function OpenScreen({
  route,
  title,
}: {
  route: '/offers' | '/campus' | '/first-week';
  title: string;
}) {
  const router = useRouter();
  return (
    <Button
      label={`${en.chat.artifactOpen}: ${title}`}
      variant="quiet"
      onPress={() => router.push(route)}
    />
  );
}

/**
 * Helplines, prominent, each number shown as text and dialable with one tap (`tel:`, or `sms:`
 * for an SMS line). Shown whenever the crisis protocol answered, whatever else is on screen.
 */
export function CrisisCard({ artifact }: { artifact: CrisisCardArtifact }) {
  // Promises only what the lines shown can keep (audit A10-11).
  const lead = crisisWords(artifact.cover, artifact.helplines.length).cardLead;
  return (
    <Card emphasis testID="crisis-card" accessibilityLabel={en.crisis.cardTitle}>
      <Heading pair="card">{en.crisis.cardTitle}</Heading>
      {lead ? <Body pair="cardMuted">{lead}</Body> : null}
      {artifact.helplines.length === 0 ? (
        <Notice tone="warning">{en.crisis.noVerifiedNumbers}</Notice>
      ) : null}
      {artifact.helplines.map((line) => (
        <View key={line.id} style={styles.line}>
          <Body pair="sunk" strong>
            {line.name}
          </Body>
          <Body pair="sunk" small>
            {`${line.purpose} ${line.hours}.`}
          </Body>
          {line.numbers.map((n) => (
            <CallButton
              key={`${n.kind}-${n.value}`}
              phone={n.value}
              sms={n.kind === 'sms'}
              label={
                n.kind === 'sms'
                  ? en.crisis.sms(n.value)
                  : n.kind === 'whatsapp'
                    ? en.crisis.whatsapp(n.value)
                    : en.crisis.call(n.value)
              }
            />
          ))}
        </View>
      ))}
      {artifact.campus ? <CrisisCampusView campus={artifact.campus} /> : null}
      <Body pair="card" small>
        {en.crisis.campus}
      </Body>
    </Card>
  );
}

const styles = StyleSheet.create({
  withLink: { gap: theme.space['2'] },
  line: {
    gap: theme.space['2'],
    padding: theme.space['3'],
    borderRadius: theme.radius.sm,
    // A panel in its card: the sunk fill and the card edge (RT-04).
    ...theme.panel,
  },
});
