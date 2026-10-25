import { en } from '@universityflow/content/app';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Body, Button, EmptyState, Notice, PageHeader, Screen } from '../../components/ui';
import { WhatINeedPlanCard } from '../../components/what-i-need';
import { ApiError, api, errorMessage } from '../../lib/api';
import type { WhatINeedResponse } from '../../lib/types';

/**
 * "What I need per subject" for one course (Phase 4c): the server computes it with
 * packages/admissions from the latest confirmed report; the app only shows it.
 */
export default function WhatINeedScreen() {
  const { programmeId } = useLocalSearchParams<{ programmeId: string }>();
  const router = useRouter();
  const [data, setData] = useState<WhatINeedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api<WhatINeedResponse>(`/api/what-i-need/${encodeURIComponent(programmeId)}`));
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === 'not-found' ? en.whatINeed.notFound : errorMessage(e),
      );
    }
  }, [programmeId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen belowHeader>
      <Stack.Screen options={{ title: en.whatINeed.title }} />
      <PageHeader title={en.whatINeed.title} lead={en.whatINeed.lead} />
      {error ? (
        <>
          <Notice tone="danger">{error}</Notice>
          <Button label={en.common.tryAgain} onPress={() => void load()} />
        </>
      ) : !data ? (
        <Body>{en.common.loading}</Body>
      ) : !data.result ? (
        // The app uploads a report itself now, as the results screen says (A2-08).
        <EmptyState
          action={{ label: en.documents.uploadReport, onPress: () => router.push('/upload') }}
        >
          {en.results.noReport}
        </EmptyState>
      ) : (
        <WhatINeedPlanCard result={data.result} />
      )}
    </Screen>
  );
}
