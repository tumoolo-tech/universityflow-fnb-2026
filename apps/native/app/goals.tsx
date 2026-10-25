import { en } from '@universityflow/content/app';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { CountdownView, GoalCardView } from '../components/goals';
import { PlanMapsSection } from '../components/plan-maps';
import { PracticeView } from '../components/practice';
import {
  Body,
  Button,
  Card,
  Checkbox,
  Field,
  Heading,
  Notice,
  PageHeader,
  Screen,
  useAnnounce,
} from '../components/ui';
import { api, errorMessage } from '../lib/api';
import type { ExamsResponse, GoalResponse, PracticeResponse } from '../lib/types';

/**
 * My goal and exams: the target course and where the learner stands for it, the exam countdown,
 * the subjects it is matched from, and free practice for the subjects that matter. The same API and
 * the same server code as the web page.
 */

const MAX_OPTIONS = 20;

export default function GoalsScreen() {
  const [goal, setGoal] = useState<GoalResponse | null>(null);
  const [exams, setExams] = useState<ExamsResponse | null>(null);
  const [practice, setPractice] = useState<PracticeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [query, setQuery] = useState('');
  const t = en.goals;
  // "Saved" and "Goal removed" are said on iOS too, not only through Android's live region (A3-02).
  useAnnounce(status);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [g, e] = await Promise.all([
        api<GoalResponse>('/api/me/goal'),
        api<ExamsResponse>('/api/me/exams'),
      ]);
      setGoal(g);
      setExams(e);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  // Practice is a helper, not the page: if it can't load, the rest of the screen still works.
  const loadPractice = useCallback(async () => {
    try {
      setPractice(await api<PracticeResponse>('/api/me/practice'));
    } catch {
      setPractice(null);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadPractice();
  }, [load, loadPractice]);

  async function run<T>(call: () => Promise<T>, apply: (v: T) => void, done: string) {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      apply(await call());
      setStatus(done);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const header = <Stack.Screen options={{ title: t.title }} />;

  if (!goal || !exams) {
    return (
      <Screen belowHeader>
        {header}
        <PageHeader title={t.title} />
        {error ? (
          <>
            <Notice tone="danger">{error}</Notice>
            <Button label={en.common.tryAgain} onPress={() => void load()} />
          </>
        ) : (
          <Body>{en.common.loading}</Body>
        )}
      </Screen>
    );
  }

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const options = goal.options
    .filter((o) => words.every((w) => `${o.universityName} ${o.name}`.toLowerCase().includes(w)))
    .slice(0, MAX_OPTIONS);

  return (
    <Screen belowHeader>
      {header}
      <PageHeader title={t.title} lead={t.lead} />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {status ? <Body strong>{status}</Body> : null}

      {goal.card ? (
        <GoalCardView card={goal.card} />
      ) : (
        <Card>
          <Heading>{t.goalTitle}</Heading>
          <Body pair="cardMuted">{goal.goalId ? t.notAvailable : t.noGoal}</Body>
        </Card>
      )}

      {choosing ? (
        <Card testID="goal-chooser">
          <Field
            label={t.choose}
            hint={t.chooseHint}
            value={query}
            onChangeText={setQuery}
            testID="goal-search"
          />
          {options.map((o) => (
            <Button
              key={o.id}
              variant="secondary"
              label={`${o.universityName}: ${o.name}`}
              disabled={busy}
              onPress={() =>
                void run(
                  () =>
                    api<GoalResponse>('/api/me/goal', {
                      method: 'PUT',
                      json: { programmeId: o.id },
                    }),
                  (next) => {
                    setGoal(next);
                    setChoosing(false);
                    setQuery('');
                    // A new goal changes which subjects matter.
                    void loadPractice();
                  },
                  en.common.saved,
                )
              }
            />
          ))}
          <Button label={en.common.cancel} variant="quiet" onPress={() => setChoosing(false)} />
        </Card>
      ) : (
        <Button
          label={goal.goalId ? t.change : t.setGoal}
          variant="secondary"
          onPress={() => setChoosing(true)}
        />
      )}
      {goal.goalId && !choosing ? (
        <Button
          label={t.clear}
          variant="quiet"
          disabled={busy}
          onPress={() =>
            void run(
              () => api<GoalResponse>('/api/me/goal', { method: 'DELETE' }),
              (next) => {
                setGoal(next);
                void loadPractice();
              },
              t.cleared,
            )
          }
        />
      ) : null}

      {/* My plan maps (D10): after the goal's buttons, before the countdown. */}
      <PlanMapsSection hasGoal={goal.goalId !== null} />

      <CountdownView countdown={exams.countdown} />

      {practice ? <PracticeView practice={practice} /> : null}

      {exams.subjects.length > 0 ? (
        <Card>
          <Heading>{t.subjectsTitle}</Heading>
          <Body pair="cardMuted" small>
            {t.subjectsLead}
          </Body>
          {exams.subjects.map((s) => (
            <View key={s.subjectId}>
              <Checkbox
                label={t.write(s.name)}
                checked={s.writes}
                disabled={busy}
                onPress={() =>
                  void run(
                    () =>
                      api<ExamsResponse>('/api/me/exams', {
                        method: 'PUT',
                        json: {
                          subjectId: s.subjectId,
                          // Back to what the report says: forget the change.
                          included: !s.writes === s.onReport ? null : !s.writes,
                        },
                      }),
                    setExams,
                    en.common.saved,
                  )
                }
              />
              <Body pair="cardMuted" small>
                {s.onReport ? t.fromReport : t.addedByMe}
              </Body>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
