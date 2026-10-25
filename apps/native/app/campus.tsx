import { en } from '@universityflow/content/app';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CampusTourView } from '../components/campus';
import { formatInstantDay } from '../components/offer-card';
import { announce, Body, Button, Notice, PageHeader, Screen } from '../components/ui';
import { UniversityChooser } from '../components/university-chooser';
import { api, errorMessage } from '../lib/api';
import { rememberCampus, type SavedCampus, savedCampus } from '../lib/campus-cache';
import { readToken } from '../lib/session';
import type { CampusResponse } from '../lib/types';

/**
 * My campus in the app (Phase 5b): the accepted offer's university, or one the learner chooses to
 * look around (never assumed). The same API and server code as the web page and the chat's
 * campus_tour tool. A university chosen in the chooser loads above it, so the screen says which
 * one it now shows (A3-16), and "First week" carries it on (A2-15).
 *
 * With no connection it shows the last campus it loaded, kept on the phone, with when that was
 * and the same draft badges, so security and the clinic can still be called (A7-17).
 */
export default function CampusScreen() {
  const router = useRouter();
  const [data, setData] = useState<CampusResponse | null>(null);
  const [saved, setSaved] = useState<SavedCampus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  /** The last response this screen loaded, read inside `load` without re-creating it. */
  const live = useRef<CampusResponse | null>(null);

  const load = useCallback(async (university: string | null) => {
    setError(null);
    setLoading(true);
    try {
      const next = await api<CampusResponse>(
        university ? `/api/campus?university=${encodeURIComponent(university)}` : '/api/campus',
      );
      // Kept only while signed in: a sign-out during the request has already forgotten it.
      if (await readToken()) await rememberCampus(next);
      live.current = next;
      setSaved(null);
      setData(next);
      if (university && next.tour) announce(en.campus.exploring(next.tour.universityName));
    } catch (e) {
      setError(errorMessage(e));
      // Nothing live to show: the copy kept from the last time, if there is one.
      if (!live.current) setSaved(await savedCampus());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(chosen);
  }, [load, chosen]);

  const t = en.campus;
  const tour = data?.tour ?? null;
  const savedTour = !data && saved ? saved.response.tour : null;
  return (
    <Screen belowHeader>
      <Stack.Screen options={{ title: t.title }} />
      <PageHeader title={t.title} lead={t.lead} />
      {error ? (
        <>
          <Notice tone="danger">{error}</Notice>
          <Button label={en.common.tryAgain} onPress={() => void load(chosen)} />
        </>
      ) : null}
      {loading && !error ? <Body>{en.common.loading}</Body> : null}
      {savedTour && saved ? (
        <>
          <Notice tone="info" testID="campus-saved-copy">
            {t.savedCopy}
          </Notice>
          <Body strong>{t.lastUpdated(formatInstantDay(saved.savedAt))}</Body>
          <CampusTourView tour={savedTour} />
        </>
      ) : null}
      {tour ? <CampusTourView tour={tour} /> : null}
      {tour ? (
        <Button
          label={t.firstWeekLink}
          variant="secondary"
          onPress={() =>
            router.push({ pathname: '/first-week', params: { university: tour.universityId } })
          }
        />
      ) : null}
      {data ? (
        <UniversityChooser
          options={data.options}
          current={tour?.universityId ?? null}
          hasChoice={tour !== null}
          onChoose={setChosen}
        />
      ) : null}
    </Screen>
  );
}
