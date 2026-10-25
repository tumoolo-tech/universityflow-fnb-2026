import type {
  CollegeOption,
  CollegeOptions,
  ProgrammeResult,
  Results,
} from '@universityflow/admissions';
import { isReportKind, reportGrade } from '@universityflow/catalogue/client';
import { colleges as collegeWords, en } from '@universityflow/content';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CollegeCard } from '@/components/college-card';
import { ProgrammeCard } from '@/components/programme-card';
import { Page, SourceLink } from '@/components/ui';
import { formatDate } from '@/lib/client/api';
import {
  type GroupId,
  type ListedInstitution,
  type ListedProgramme,
  ResultsList,
} from './results-list';
import { ShortlistButton } from './shortlist-button';

/**
 * Stage 1's results, rendered on the server (audit A4-03).
 *
 * This was one client component that rendered and hydrated all 86 programme cards: about a
 * second of main-thread work on a budget phone, while taps on "Add to my shortlist" waited.
 * Now each card is rendered here once. The browser gets two kinds of island: the filter
 * (`ResultsList`, which only chooses which rendered cards to show) and each card's shortlist
 * button.
 */
export function ResultsView(props: {
  results: Results;
  shortlist: string[];
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
}) {
  const shortlist = new Set(props.shortlist);
  // On Grade 10 marks, and Grade 11's June and September ones, there is no Qualify now and no
  // Plan B: one On track group (G10-3, §18.7 C2).
  const grade10 = props.results.basis === 'progress';
  const lead = !grade10
    ? en.results.lead
    : isReportKind(props.reportKind) && reportGrade(props.reportKind) === 11
      ? en.schoolRecord.resultsLeadInterim
      : en.results.leadGrade10;
  const groups: Array<{ id: GroupId; list: ReadonlyArray<ProgrammeResult> }> = grade10
    ? [
        { id: 'on-track', list: props.results.onTrack },
        { id: 'close', list: props.results.close },
      ]
    : [
        { id: 'qualify-now', list: props.results.qualifyNow },
        { id: 'close', list: props.results.close },
        { id: 'plan-b', list: props.results.planB },
      ];
  const cards: Record<string, ReactNode> = {};
  for (const { list } of groups) {
    for (const r of list) {
      cards[r.programmeId] = (
        <ProgrammeCard
          result={r}
          action={
            <ShortlistButton programmeId={r.programmeId} initial={shortlist.has(r.programmeId)} />
          }
        />
      );
    }
  }
  const listed = (r: ProgrammeResult): ListedProgramme => ({
    id: r.programmeId,
    institutionId: r.universityId,
    institutionType: 'university',
    text: `${r.name} ${r.faculty}`.toLowerCase(),
  });

  // Public TVET colleges (planning.md §19.1): one card per college, its courses inside, in the
  // order packages/admissions sorted them. In Plan B on an admission report; their own group on a
  // Grade 10 one (NC(V) starts after Grade 9).
  const byCollege = new Map<string, CollegeOption[]>();
  for (const o of props.colleges?.options ?? []) {
    byCollege.set(o.collegeId, [...(byCollege.get(o.collegeId) ?? []), o]);
  }
  const collegeItems: ListedProgramme[] = [];
  const institutions: ListedInstitution[] = props.universities.map((u) => ({
    ...u,
    type: 'university' as const,
  }));
  for (const [collegeId, options] of byCollege) {
    const [first] = options;
    if (!first) continue;
    const id = `college-${collegeId}`;
    cards[id] = <CollegeCard options={options} />;
    collegeItems.push({
      id,
      institutionId: collegeId,
      institutionType: 'public-tvet-college',
      text: [first.collegeName, first.collegeShortName, first.mainTown ?? '', first.province]
        .concat(options.map((o) => `${o.nameAtCollege} ${o.programme}`))
        .join(' ')
        .toLowerCase(),
    });
    institutions.push({ id: collegeId, name: first.collegeName, type: 'public-tvet-college' });
  }
  const listedGroups = groups.map(({ id, list }) => ({
    id,
    items: id === 'plan-b' ? [...list.map(listed), ...collegeItems] : list.map(listed),
  }));
  if (grade10 && collegeItems.length > 0)
    listedGroups.push({ id: 'colleges', items: collegeItems });
  const closed = props.colleges?.closed ?? [];

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
      <ResultsList groups={listedGroups} cards={cards} institutions={institutions} />
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
