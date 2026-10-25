import { en } from '@universityflow/content/app';
import {
  PLAN_TEMPLATE_IDS,
  type PlanMapsResponse,
  type PlanStatus,
  type PlanTemplateId,
} from '@universityflow/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, errorMessage } from '../lib/api';
import { theme } from '../lib/theme';
import { Body, Button, Card, Checkbox, Heading, Notice, Radio, RadioGroup } from './ui';

/**
 * My plan maps on the app's My goal screen (docs/design/plan-maps-proposal.md §4, §8.5; D10:
 * after the goal's buttons): the learner's maps and "Start a new map", with the same API as the
 * web. The map itself opens on its own screen (app/plan-map.tsx), as an outline (D6).
 */

const t = en.planMaps;

export function PlanMapsSection({ hasGoal }: { hasGoal: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<PlanMapsResponse | null>(null);
  const [picking, setPicking] = useState(false);
  const [templateId, setTemplateId] = useState<PlanTemplateId>('six-stops');
  const [linksGoal, setLinksGoal] = useState(hasGoal);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api<PlanMapsResponse>('/api/me/plan-maps')
      .then((d) => {
        if (live) setData(d);
      })
      // The goal screen works without its maps: if they can't load, the card isn't shown.
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => setLinksGoal(hasGoal), [hasGoal]);

  if (!data) return null;
  const full = data.maps.length >= data.max;

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const { map } = await api<{ map: { id: string } }>('/api/me/plan-maps', {
        method: 'POST',
        json: { templateId, linksGoal },
      });
      router.push({ pathname: '/plan-map', params: { id: map.id } } as never);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card testID="plan-maps">
      <Heading>{t.title}</Heading>
      <Body pair="cardMuted">{data.wordsAllowed ? t.lead : t.leadTickOnly}</Body>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {data.maps.length === 0 ? <Body pair="cardMuted">{t.empty}</Body> : null}
      {data.maps.map((m) => {
        const name = m.title ?? t.templates[m.templateId].name;
        const counts = t.counts(m.counts.achieved, m.counts.notAchieved, m.counts.planned);
        return (
          <View key={m.id} style={styles.row}>
            <Button
              variant="secondary"
              label={name}
              accessibilityLabel={`${name}, ${counts}`}
              onPress={() => router.push({ pathname: '/plan-map', params: { id: m.id } } as never)}
            />
            <Body pair="cardMuted" small>
              {counts}
            </Body>
          </View>
        );
      })}
      {full ? (
        <Body pair="cardMuted">{t.full}</Body>
      ) : picking ? (
        <View style={styles.picker}>
          <RadioGroup label={t.chooseTemplate} pair="card">
            {PLAN_TEMPLATE_IDS.map((id) => (
              <View key={id}>
                <Radio
                  label={t.templates[id].name}
                  selected={templateId === id}
                  onPress={() => setTemplateId(id)}
                />
                <Body pair="cardMuted" small>
                  {t.templates[id].line}
                </Body>
              </View>
            ))}
          </RadioGroup>
          <Checkbox label={t.useGoal} checked={linksGoal} onPress={() => setLinksGoal((v) => !v)} />
          <Body pair="cardMuted" small>
            {t.useGoalHint}
          </Body>
          <Button label={t.create} busy={busy} onPress={() => void start()} />
          <Button label={t.cancel} variant="quiet" onPress={() => setPicking(false)} />
        </View>
      ) : (
        <Button label={t.start} variant="secondary" onPress={() => setPicking(true)} />
      )}
      <Body pair="cardMuted" small>
        {t.exportNote}
      </Body>
    </Card>
  );
}

/** The status as a glyph beside its word (never colour alone): hidden, the word is read. */
export function StatusGlyph({ status }: { status: PlanStatus }) {
  return (
    <Text
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        theme.text.bodyStrong,
        {
          color:
            status === 'achieved'
              ? theme.color.success
              : status === 'not-achieved'
                ? theme.color.inkMuted
                : theme.color.lineStrong,
        },
      ]}
    >
      {status === 'achieved' ? '✓' : status === 'not-achieved' ? '↺' : '○'}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: { gap: theme.space['1'] },
  picker: { gap: theme.space['3'] },
});
