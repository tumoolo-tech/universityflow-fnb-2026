import { en } from '@universityflow/content/app';
import { type ModuleCardData, moduleCardView } from '@universityflow/ui';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MarkCalculator } from '../../components/mark-calculator';
import { ModuleCard } from '../../components/module-card';
import { Body, Button, Notice, PageHeader, Screen } from '../../components/ui';
import { ApiError, api, errorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';

/**
 * One confirmed module's card in the app (Phase 6c), opened from My modules: the server's
 * `GET /api/modules/:registrationId/:code` (the same code as the web page), laid out by the shared
 * view model. The calculator works on the phone from the resolved scheme the card carries, so it
 * keeps working with no data; only saving needs the network.
 */
export default function ModuleCardScreen() {
  const { code, registrationId } = useLocalSearchParams<{ code: string; registrationId: string }>();
  const [data, setData] = useState<ModuleCardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const path = `/api/modules/${encodeURIComponent(registrationId ?? '')}/${encodeURIComponent(code ?? '')}`;

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api<ModuleCardData>(path));
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === 'not-found' ? en.moduleCard.notFound : errorMessage(e),
      );
    }
  }, [path]);

  useEffect(() => {
    void load();
  }, [load]);

  const view = useMemo(() => (data ? moduleCardView(data, formatDate) : null), [data]);
  const title = view
    ? view.name
      ? `${view.code}: ${view.name}`
      : view.code
    : en.moduleCard.pageTitle;

  return (
    <Screen belowHeader>
      <Stack.Screen options={{ title: en.moduleCard.pageTitle }} />
      <PageHeader
        title={title}
        lead={view ? `${view.universityName} · ${view.subtitle}` : undefined}
      />
      {error ? (
        <>
          <Notice tone="danger">{error}</Notice>
          <Button label={en.common.tryAgain} onPress={() => void load()} />
        </>
      ) : !data || !view ? (
        <Body>{en.common.loading}</Body>
      ) : (
        <ModuleCard
          view={view}
          calculator={
            <MarkCalculator
              scheme={data.scheme}
              initial={{ marks: data.marks, target: data.target }}
              saveUrl={path}
              sample={data.sample}
            />
          }
        />
      )}
    </Screen>
  );
}
