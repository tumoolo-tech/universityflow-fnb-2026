import type { ProgrammeResult } from '@universityflow/admissions';
import { isReportKind, reportGrade } from '@universityflow/catalogue/client';
import { en } from '@universityflow/content/app';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProgrammeCard } from '../components/programme-card';
import { RecheckCard } from '../components/recheck-card';
import { SchoolRecordCard } from '../components/school-record';
import { Body, Button, EmptyState, Heading, Notice, PageHeader, Screen } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { formatDate } from '../lib/format';
import { theme } from '../lib/theme';
import type { RecheckResponse, ResultsResponse } from '../lib/types';

/**
 * My results: Qualify now, Close and Plan B, exactly as packages/admissions grouped them on the
 * server (hard rule 2). Unverified data is labelled on every card and above the list (hard
 * rule 3). With no confirmed report yet, it leads to the report upload (Phase 4d).
 */

interface Section {
  readonly key: string;
  readonly title: string;
  readonly lead: string;
  readonly data: ReadonlyArray<ProgrammeResult>;
}

export default function ResultsScreen() {
  const router = useRouter();
  const [data, setData] = useState<ResultsResponse | null>(null);
  const [recheck, setRecheck] = useState<RecheckResponse['recheck']>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api<ResultsResponse>('/api/results'));
    } catch (e) {
      setError(errorMessage(e));
      return;
    }
    // "Since your June report…" is extra: the results stand without it.
    try {
      setRecheck((await api<RecheckResponse>('/api/rechecks')).recheck);
    } catch {
      setRecheck(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const header = <Stack.Screen options={{ title: en.results.title }} />;

  if (!data) {
    return (
      <Screen belowHeader>
        {header}
        <PageHeader title={en.results.title} />
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

  if (!data.results) {
    return (
      <Screen belowHeader>
        {header}
        <PageHeader title={en.results.title} lead={en.results.lead} />
        <EmptyState
          action={{ label: en.documents.uploadReport, onPress: () => router.push('/upload') }}
        >
          {en.results.noReport}
        </EmptyState>
      </Screen>
    );
  }

  const { results, report } = data;
  const close: Section = {
    key: 'close',
    title: en.results.groups.close,
    lead: en.results.groups.closeLead,
    data: results.close,
  };
  // On Grade 10 marks there is no Qualify now and no Plan B: one On track group (G10-3).
  const grade10 = results.basis === 'progress';
  const sections: Section[] = grade10
    ? [
        {
          key: 'on-track',
          title: en.results.groups.onTrack,
          lead: en.results.groups.onTrackLead,
          data: results.onTrack,
        },
        close,
      ]
    : [
        {
          key: 'qualify-now',
          title: en.results.groups.qualifyNow,
          lead: en.results.groups.qualifyNowLead,
          data: results.qualifyNow,
        },
        close,
        {
          key: 'plan-b',
          title: en.results.groups.planB,
          lead: en.results.groups.planBLead,
          data: results.planB,
        },
      ];
  const kind = en.reportKinds[report.kind as keyof typeof en.reportKinds] ?? report.kind;
  // Grade 11's June and September reports have their own lead (§18.7 C2).
  const lead = !grade10
    ? en.results.lead
    : isReportKind(report.kind) && reportGrade(report.kind) === 11
      ? en.schoolRecord.resultsLeadInterim
      : en.results.leadGrade10;

  return (
    <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
      {header}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.programmeId}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={styles.gap}>
            <PageHeader title={en.results.title} lead={lead} />
            <Body pair="pageMuted" small>
              {en.results.reportFrom(kind, formatDate(report.confirmedAt))}
            </Body>
            <Body>{`${en.results.projectedPass}: ${en.passTypes[results.passProjected]}`}</Body>
            {recheck ? <RecheckCard recheck={recheck} /> : null}
            {results.includesDrafts ? (
              <View testID="drafts-notice">
                <Notice tone="warning">{`${en.common.draftBadge}. ${en.common.draftNotice}`}</Notice>
              </View>
            ) : null}
            <Body small pair="pageMuted">
              {en.results.checked(results.checked)}
            </Body>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader} testID={`section-${section.key}`}>
            <Heading pair="page">{`${section.title} (${section.data.length})`}</Heading>
            <Body pair="pageMuted" small>
              {section.lead}
            </Body>
            {section.data.length === 0 ? <EmptyState>{en.results.groups.empty}</EmptyState> : null}
          </View>
        )}
        renderItem={({ item }) => <ProgrammeCard result={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListFooterComponent={
          <View style={styles.footer}>
            {data.record ? (
              <SchoolRecordCard record={data.record} onCorrect={() => router.push('/upload')} />
            ) : null}
            <Body small>{en.common.verifyOnSite}</Body>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.canvas },
  list: {
    padding: theme.space['4'],
    gap: theme.space['3'],
    width: '100%',
    maxWidth: theme.maxWidth,
    alignSelf: 'center',
  },
  gap: { gap: theme.space['3'] },
  footer: { gap: theme.space['3'], paddingTop: theme.space['5'] },
  sectionHeader: {
    gap: theme.space['1'],
    paddingTop: theme.space['5'],
    paddingBottom: theme.space['2'],
  },
  separator: { height: theme.space['3'] },
});
