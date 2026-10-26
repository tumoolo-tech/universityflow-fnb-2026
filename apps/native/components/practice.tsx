import { en } from '@universityflow/content/app';
import type { PracticeArtifact } from '@universityflow/ui';
import { Linking, Pressable, Text, View } from 'react-native';
import { theme } from '../lib/theme';
import { Badge, Body, Card, Heading, Notice } from './ui';

/**
 * Free practice in the app (planning.md §3, Stage 3): Siyavula's free textbooks, practice and past
 * papers for the subjects that matter to the learner, chosen on the server by the same code as the
 * agent's tool. Each link opens in the browser. Unverified links appear only in preview, labelled
 * (hard rule 3); no admission fact is shown (hard rule 2). Nothing animates.
 */
export function PracticeView({ practice }: { practice: PracticeArtifact }) {
  const t = en.practice;
  const drafts = practice.subjects.some((s) => s.resources.some((r) => r.draft));
  const lead =
    practice.basis === 'goal' && practice.goal
      ? t.lead.goal(`${practice.goal.name} (${practice.goal.universityName})`)
      : t.lead[practice.basis === 'goal' ? 'none' : practice.basis];
  const needsAccount = practice.subjects.some((s) =>
    s.resources.some((r) => r.access === 'free-with-account'),
  );
  return (
    <Card testID="practice">
      <Heading>{t.title}</Heading>
      <Body pair="cardMuted" small>
        {lead}
      </Body>
      {drafts ? <Notice tone="warning">{en.common.draftNotice}</Notice> : null}
      {practice.subjects.map((s) => (
        <View
          key={s.subjectId}
          testID={`practice-${s.subjectId}`}
          style={{
            gap: theme.space['2'],
            padding: theme.space['3'],
            borderRadius: theme.radius.sm,
            // A panel in its card: the sunk fill and the card edge (RT-04).
            ...theme.panel,
          }}
        >
          <Body pair="sunk" strong>
            {s.subjectName}
          </Body>
          <Body pair="sunk" small>
            {t.reasons[s.reason]}
          </Body>
          {s.resources.length === 0 ? (
            <Body pair="sunk" small>
              {t.noneYet}
            </Body>
          ) : null}
          {s.resources.map((r) => (
            <View key={r.id} style={{ gap: theme.space['1'] }}>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={t.openApp(r.title)}
                onPress={() => void Linking.openURL(r.url).catch(() => undefined)}
                style={{ minHeight: theme.target, justifyContent: 'center' }}
              >
                <Text
                  style={[
                    theme.text.label,
                    { color: theme.on('sunkBrand').color, textDecorationLine: 'underline' },
                  ]}
                >
                  {r.title}
                </Text>
              </Pressable>
              {/* Neutral chips are card-coloured here: a sunk chip vanishes on a sunk panel (A2-07). */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space['2'] }}>
                <Badge tone="card">{t.kinds[r.kind]}</Badge>
                <Badge tone="success">{t.access[r.access]}</Badge>
                <Badge tone="card">{t.grades(r.grades.join(', '))}</Badge>
                {r.draft ? (
                  <Badge tone="warning" testID={`draft-${r.id}`}>
                    {en.common.draftBadge}
                  </Badge>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ))}
      {needsAccount ? (
        <Body pair="card" small>
          {t.signUpNote}
        </Body>
      ) : null}
    </Card>
  );
}
