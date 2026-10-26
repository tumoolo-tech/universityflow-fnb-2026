import { en } from '@universityflow/content';
import type { Metadata } from 'next';
import { RecheckCard } from '@/components/recheck-card';
import { SchoolRecordSection } from '@/components/school-record';
import { EmptyState, Page } from '@/components/ui';
import { currentRecheck } from '@/lib/server/rechecks';
import { learnerResults } from '@/lib/server/results';
import { schoolRecordOf } from '@/lib/server/scored';
import { readyStudent } from '@/lib/server/session';
import { ResultsView } from './results-view';

export const metadata: Metadata = { title: en.results.title };

/**
 * Stage 1: every course the learner can apply for, close to, or reach through Plan B, from the
 * marks they confirmed. Computed by the same code the agent uses (hard rule 2), in
 * lib/server/results.ts, which the page's server action shares (A4-19).
 */
export default async function ResultsPage() {
  const signed = await readyStudent();
  const learner = await learnerResults(signed);
  if (!learner) {
    return (
      <Page title={en.results.title} lead={en.results.lead}>
        <EmptyState action={{ href: '/documents', label: en.results.addReport }}>
          {en.results.noReport}
        </EmptyState>
      </Page>
    );
  }
  const { report, view, results, colleges, shortlist } = learner;
  const recheck = await currentRecheck(signed.student, view);
  const record = schoolRecordOf(await signed.student.schoolRecordReports());
  return (
    <ResultsView
      results={results}
      shortlist={shortlist}
      reportKind={report.kind}
      confirmedAt={report.confirmedAt.toISOString()}
      universities={view.universities.map((u) => ({ id: u.id, name: u.shortName }))}
      recheck={recheck ? <RecheckCard recheck={recheck} /> : null}
      schoolRecord={<SchoolRecordSection record={record} />}
      colleges={colleges}
    />
  );
}
