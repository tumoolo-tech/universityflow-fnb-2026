import { en } from '@universityflow/content/app';
import type { HomeData } from '@universityflow/ui';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { HomeDashboard } from '../components/home';
import { Onboarding, stepFor } from '../components/onboarding';
import { Body, Button, Notice, Screen, Title } from '../components/ui';
import { ApiError, api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Me } from '../lib/types';

/**
 * Home, behind the auth gate. Until the server says this learner is ready (consent recorded,
 * hard rule 5) it is onboarding; then the dashboard (docs/design/README.md §4), from
 * `GET /api/home`: the same numbers and next step as the web's home. It refreshes each time the
 * learner comes back to it, so a step ticked elsewhere shows at once (A4-17: in the background,
 * one request, for a ready learner).
 */
export default function HomeScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [home, setHome] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async (): Promise<Me | null> => {
    setError(null);
    try {
      const next = await api<Me>('/api/me');
      setMe(next);
      if (next.ready) setHome(await api<HomeData>('/api/home'));
      return next;
    } catch (e) {
      setError(errorMessage(e));
      return null;
    }
  }, []);

  /** The last answers, for the focus effect, which must not re-run each time they change. */
  const shown = useRef<{ me: Me | null; home: HomeData | null }>({ me: null, home: null });
  shown.current = { me, home };

  /**
   * A4-17: a ready learner coming back to home sees the last dashboard at once and costs one
   * request: `/api/home` refreshes it in the background (the server checks consent there too).
   * If the server no longer counts them as ready (consent withdrawn elsewhere, hard rule 5) or
   * home is still an onboarding step, it asks `/api/me` again. Any other failure keeps the last
   * data on screen; the next visit tries again.
   */
  const refresh = useCallback(async () => {
    try {
      setHome(await api<HomeData>('/api/home'));
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) await load();
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      const last = shown.current;
      if (last.me && last.home && stepFor(last.me) === null) void refresh();
      else void load();
    }, [load, refresh]),
  );

  if (!me || (me.ready && !home)) {
    return (
      <Screen>
        <Title>{en.app.name}</Title>
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

  // Until consent is recorded, and then until the learner gives their grade (G10-1).
  if (!home || stepFor(me) !== null) return <Onboarding me={me} onChanged={load} />;

  return (
    <Screen testID="home">
      <HomeDashboard
        data={home}
        go={(route) => router.push(route as never)}
        saveGrade={async (grade) => {
          await api('/api/me', { method: 'PATCH', json: { grade } });
          await load();
        }}
        footer={
          <Button
            label={en.nav.signOut}
            variant="quiet"
            busy={signingOut}
            busyLabel={en.common.loading}
            onPress={async () => {
              setSigningOut(true);
              await signOut();
            }}
          />
        }
      />
    </Screen>
  );
}
