import { en, type FirstWeekStep } from '@universityflow/content/app';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FirstWeekView } from '../components/campus';
import { announce, Body, Button, Notice, PageHeader, Screen, useAnnounce } from '../components/ui';
import { UniversityChooser } from '../components/university-chooser';
import { api, errorMessage } from '../lib/api';
import type { FirstWeekResponse } from '../lib/types';

/**
 * The first-week checklist in the app (Phase 5b): steps from content, dates from the university's
 * calendar, each tick saved at once (migration 0019). Same API and server code as the web page.
 * It opens on the university My campus was showing, when it was opened from there (A2-15); one
 * chosen here loads above the chooser, so the screen says which one it now shows (A3-16).
 */
export default function FirstWeekScreen() {
  const params = useLocalSearchParams<{ university?: string }>();
  const [data, setData] = useState<FirstWeekResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState<string | null>(() =>
    typeof params.university === 'string' && params.university !== '' ? params.university : null,
  );
  const [picked, setPicked] = useState(false);
  // Outcomes are said on iOS too, not only through Android's live region (A3-02).
  useAnnounce(status);

  const load = useCallback(async (university: string | null, announced: boolean) => {
    setError(null);
    try {
      const next = await api<FirstWeekResponse>(
        university
          ? `/api/first-week?university=${encodeURIComponent(university)}`
          : '/api/first-week',
      );
      setData(next);
      if (announced && next.checklist) announce(en.campus.exploring(next.checklist.universityName));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load(chosen, picked);
  }, [load, chosen, picked]);

  async function toggle(universityId: string, step: FirstWeekStep, done: boolean) {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      setData(
        await api<FirstWeekResponse>('/api/first-week', {
          method: 'PUT',
          json: { universityId, step, done },
        }),
      );
      setStatus(en.firstWeek.saved);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const t = en.firstWeek;
  const checklist = data?.checklist ?? null;
  return (
    <Screen belowHeader>
      <Stack.Screen options={{ title: t.title }} />
      <PageHeader title={t.title} lead={t.lead} />
      {error ? (
        <>
          <Notice tone="danger">{error}</Notice>
          {data ? null : (
            <Button label={en.common.tryAgain} onPress={() => void load(chosen, false)} />
          )}
        </>
      ) : null}
      {status ? <Body strong>{status}</Body> : null}
      {!data && !error ? <Body>{en.common.loading}</Body> : null}
      {checklist ? (
        <FirstWeekView
          checklist={checklist}
          busy={busy}
          onToggle={(step, done) => void toggle(checklist.universityId, step, done)}
        />
      ) : null}
      {data ? (
        <UniversityChooser
          options={data.options}
          current={checklist?.universityId ?? null}
          hasChoice={checklist !== null}
          onChoose={(id) => {
            setPicked(true);
            setChosen(id);
          }}
        />
      ) : null}
    </Screen>
  );
}
