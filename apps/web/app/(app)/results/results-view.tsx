import type { CollegeOptions, Results } from '@universityflow/admissions';
import { isReportKind, reportGrade } from '@universityflow/catalogue/client';
import { colleges as collegeWords, en } from '@universityflow/content';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Page, SourceLink } from '@/components/ui';
import { formatDate } from '@/lib/client/api';
import { loadResultsGroup } from './actions';
import { COLLAPSED_GROUPS, resultsGroups } from './results-groups';
import { type LoadGroup, ResultsList } from './results-list';

/**
 * Stage 1's results, rendered on the server (audit A4-03).
 *
 * This was one client component that rendered and hydrated all 86 programme cards: about a
 * second of main-thread work on a budget phone, while taps on "Add to my shortlist" waited.
 * Now each shown card is rendered here once. The browser gets two kinds of island: the filter
 * (`ResultsList`, which only chooses which rendered cards to show) and each card's shortlist
 * button. A collapsed group (Plan B, the colleges' group) sends no cards at all until the learner
 * opens it: the island then asks the page's server action for them (audit A4-19).
 */
export function ResultsView(props: {
  results: Results;
  shortlist: ReadonlyArray<string>;
  reportKind: string;
  confirmedAt: string;
  universities: Array<{ id: string; name: string }>;
  /** "Since your June report…", when the current report changed anything (Phase 4c). */
  recheck?: ReactNode;
  /** Every report the learner confirmed, side by side (planning.md §18.7 C2). */
  schoolRecord?: ReactNode;
  /**
   * Public TVET colleges' courses for this report (packages/admissions collegeOptions): in Plan B
   * on an admission report, in their own group (NC(V) only) on a Grade 10 one. Absent: none.
   */
  colleges?: CollegeOptions | undefined;
  /** For tests only: what fetches a collapsed group's cards (defaults to the server action). */
  loadGroup?: LoadGroup | undefined;
}) {
  // On Grade 10 marks, and Grade 11's June and September ones, there is no Qualify now and no
  // Plan B: one On track group (G10-3, §18.7 C2).
  const grade10 = props.results.basis === 'progress';
  const lead = !grade10
    ? en.results.lead
    : isReportKind(props.reportKind) && reportGrade(props.reportKind) === 11
      ? en.schoolRecord.resultsLeadInterim
      : en.results.leadGrade10;
  const { groups, institutions, cardsOf } = resultsGroups({
    results: props.results,
    shortlist: new Set(props.shortlist),
    colleges: props.colleges,
    universities: props.universities,
  });
  // The shown groups' cards only: a collapsed group's arrive when it opens (A4-19).
  const cards: Record<string, ReactNode> = {};
  for (const { id } of groups) {
    if (COLLAPSED_GROUPS.includes(id)) continue;
    for (const { id: cardId, card } of cardsOf(id)) cards[cardId] = card;
  }
  const closed = props.colleges?.closed ?? [];
  // The colleges' own group (NC(V) only) says where NC(V) starts from its catalogue record
  // (A1-84); with no record a learner may see, it names no grade at all.
  const ncv = props.colleges?.entries.ncv;
  const collegesGroup = ncv
    ? {
        title: collegeWords.groupAfter(ncv.afterGrade),
        lead: collegeWords.groupLeadAfter(ncv.afterGrade),
      }
    : { title: collegeWords.groupNoEntry, lead: collegeWords.groupLeadNoEntry };

  return (
    <Page title={en.results.title} lead={lead}>
      <p className="text-sm text-muted">
        {en.results.reportFrom(
          en.reportKinds[props.reportKind as keyof typeof en.reportKinds] ?? props.reportKind,
          formatDate(props.confirmedAt),
        )}{' '}
        · {en.results.projectedPass}: <strong>{en.passTypes[props.results.passProjected]}</strong> ·{' '}
        <Link href="/documents">{en.results.updateReport}</Link>
      </p>
      {props.recheck ?? null}
      <ResultsList
        groups={groups}
        cards={cards}
        institutions={institutions}
        collegesGroup={collegesGroup}
        loadGroup={props.loadGroup ?? loadResultsGroup}
      />
      {props.colleges ? (
        <div className="flex flex-col gap-1 text-sm text-muted">
          <p>{collegeWords.checked(props.colleges.checked)}</p>
          {closed.map((c) => (
            <p key={c.circular}>
              {collegeWords.closed(c.count, c.circular)}{' '}
              <SourceLink href={c.sourceUrl} context={c.circular}>
                {collegeWords.closedSource}
              </SourceLink>
            </p>
          ))}
          <p>
            <Link href="/colleges/registered">{collegeWords.checkLink}</Link>
          </p>
        </div>
      ) : null}
      {props.schoolRecord ?? null}
      <p className="text-sm text-muted">
        {en.results.checked(props.results.checked)} {en.common.verifyOnSite}
      </p>
    </Page>
  );
}
