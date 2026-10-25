import { assessAll, collegeOptions } from '@universityflow/admissions';
import { en } from '@universityflow/content';
import type { Metadata } from 'next';
import { RecheckCard } from '@/components/recheck-card';
import { SchoolRecordSection } from '@/components/school-record';
import { EmptyState, Page } from '@/components/ui';
import { colleges } from '@/lib/server/colleges';
import { currentRecheck } from '@/lib/server/rechecks';
import { schoolRecordOf, scored } from '@/lib/server/scored';
import { getServices } from '@/lib/server/services';
import { readyStudent } from '@/lib/server/session';
import { ResultsView } from './results-view';

export const metadata: Metadata = { title: en.results.title };

/**
 * Stage 1: every course the learner can apply for, close to, or reach through Plan B, from the
 * marks they confirmed. Computed by the same code the agent uses (hard rule 2).
 */
export default async function ResultsPage() {
  const signed = await readyStudent();
  const report = await signed.student.latestReport();
  if (!report) {
    return (
      <Page title={en.results.title} lead={en.results.lead}>
        <EmptyState action={{ href: '/documents', label: en.results.addReport }}>
          {en.results.noReport}
        </EmptyState>
      </Page>
    );
  }
  const { catalogue } = await getServices();
  const view = catalogue();
  const results = assessAll(view, scored(report));
  // Public TVET colleges beside the universities (planning.md §19.1), decided on the server.
  const collegeList = collegeOptions(await colleges(), scored(report), new Date());
  const shortlist = (await signed.student.shortlist()).map((s) => s.programmeId);
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
      colleges={collegeList}
    />
  );
}
