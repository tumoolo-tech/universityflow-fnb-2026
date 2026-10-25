'use client';

import type { ScoreBreakdown as Breakdown, ProgrammeResult } from '@universityflow/admissions';
import type { Artifact } from '@universityflow/agent';
import { type SubjectId, subject } from '@universityflow/catalogue/client';
import {
  applications,
  breakdown as breakdownCopy,
  chat,
  common,
  confirm,
  deadlines,
  funding,
  passTypes,
  reportKinds,
  results as resultsCopy,
} from '@universityflow/content';
import Link from 'next/link';
import { Badge, Card, cx, Notice, SourceLink } from '@/components/ui';
import { formatDate } from '@/lib/client/api';
import { CampusTour, FirstWeekCard } from './campus';
import { CrisisCard } from './crisis-card';
import { ExamCountdown, GoalCard } from './goals';
import { MyModulesCard } from './modules';
import { OfferCard } from './offers';
import { PracticeCard } from './practice';
import { ProgrammeCard } from './programme-card';
import { UniversityName } from './university-mark';
import { WhatINeedCard } from './what-i-need';

/**
 * Renders a tool's artifact by kind. The model never writes these; tools build them from tested
 * code (planning.md §16.3), and an unknown kind renders nothing.
 */
export function ArtifactView({ artifact }: { artifact: Artifact }) {
  switch (artifact.kind) {
    case 'crisis-card':
      return <CrisisCard artifact={artifact} />;
    case 'results-card':
      return <ResultsCard artifact={artifact} />;
    case 'course-explorer':
      return <CourseSummary artifact={artifact} />;
    case 'score-breakdown':
      return <ScoreBreakdownCard result={artifact.result} breakdown={artifact.breakdown} />;
    case 'what-i-need':
      return <WhatINeedCard result={artifact.result} />;
    case 'deadlines':
      return <DeadlinesCard artifact={artifact} />;
    case 'application-pack':
      return <PackSummary artifact={artifact} />;
    case 'funding':
      return <FundingSummary artifact={artifact} />;
    case 'goal-card':
      return <GoalCard artifact={artifact} />;
    case 'exam-countdown':
      return <ExamCountdown artifact={artifact} />;
    case 'practice':
      return <PracticeCard artifact={artifact} />;
    case 'offer-card':
      return <OfferCard artifact={artifact} linkToPage />;
    case 'campus-tour':
      return <CampusTour artifact={artifact} linkToPage />;
    case 'first-week':
      return <FirstWeekCard artifact={artifact} linkToPage />;
    case 'my-modules':
      return <MyModulesCard artifact={artifact} linkToPage />;
    default:
      return null;
  }
}

const name = (id: string) => {
  try {
    return subject(id as SubjectId).name;
  } catch {
    return id;
  }
};

function ResultsCard({ artifact }: { artifact: Extract<Artifact, { kind: 'results-card' }> }) {
  return (
    <Card>
      <h2 className="mb-2 text-lg">{resultsCopy.title}</h2>
      <p className="mb-3 text-sm text-muted">
        {resultsCopy.reportFrom(
          reportKinds[artifact.reportKind as keyof typeof reportKinds] ?? artifact.reportKind,
          formatDate(artifact.confirmedAt),
        )}
      </p>
      <table className="w-full text-left">
        <caption className="sr-only">{resultsCopy.title}</caption>
        <thead>
          <tr>
            <th scope="col">{confirm.subject}</th>
            <th scope="col" className="text-right">
              {confirm.percent}
            </th>
          </tr>
        </thead>
        <tbody>
          {artifact.marks.map((m) => (
            <tr key={m.subject} className="border-t border-line">
              <td className="py-1">{name(m.subject)}</td>
              <td className="py-1 text-right">{m.percent}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3">
        {resultsCopy.projectedPass}: <strong>{passTypes[artifact.passProjected]}</strong>
      </p>
    </Card>
  );
}

function CourseSummary({ artifact }: { artifact: Extract<Artifact, { kind: 'course-explorer' }> }) {
  const { results } = artifact;
  // Grade 10 marks: On track and Close only, never Qualify now (G10-3).
  const grade10 = results.basis === 'progress';
  const first = grade10 ? results.onTrack : results.qualifyNow;
  const groups = grade10
    ? ([
        [resultsCopy.groups.onTrack, results.onTrack],
        [resultsCopy.groups.close, results.close],
      ] as const)
    : ([
        [resultsCopy.groups.qualifyNow, results.qualifyNow],
        [resultsCopy.groups.close, results.close],
        [resultsCopy.groups.planB, results.planB],
      ] as const);
  return (
    <Card>
      <h2 className="mb-3 text-lg">{resultsCopy.title}</h2>
      <dl className={cx('grid gap-3 text-center', grade10 ? 'grid-cols-2' : 'grid-cols-3')}>
        {groups.map(([label, list]) => (
          <div key={label} className="rounded-md bg-sunk p-3">
            <dt className="text-sm">{label}</dt>
            <dd className="text-2xl font-bold">{list.length}</dd>
          </div>
        ))}
      </dl>
      <ul className="mt-3 flex flex-col gap-1">
        {first.slice(0, 5).map((r) => (
          <li key={r.programmeId}>
            {r.universityName}: {r.name}
          </li>
        ))}
      </ul>
      <Link href="/results" className="mt-3 inline-flex min-h-11 items-center">
        {chat.artifactOpen}: {resultsCopy.title}
      </Link>
    </Card>
  );
}

export function ScoreBreakdownCard({
  result,
  breakdown,
}: {
  result: ProgrammeResult;
  breakdown: Breakdown;
}) {
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        <ProgrammeCard result={result} />
      </ul>
      <Card>
        <h2 className="mb-2 text-lg">{breakdownCopy.title}</h2>
        <table className="w-full text-left">
          <caption className="sr-only">{breakdownCopy.title}</caption>
          <thead>
            <tr>
              <th scope="col">{confirm.subject}</th>
              <th scope="col">%</th>
              <th scope="col" className="text-right">
                {breakdown.label}
              </th>
            </tr>
          </thead>
          <tbody>
            {breakdown.lines.map((line) => (
              <tr
                key={line.subject}
                className={`border-t border-line ${line.counted ? '' : 'text-muted'}`}
              >
                <td className="py-1">
                  {name(line.subject)}
                  <span className="block text-sm">{breakdownCopy.reasons[line.reason]}</span>
                </td>
                <td className="py-1">{line.percent}</td>
                <td className="py-1 text-right">{line.counted ? line.points : '–'}</td>
              </tr>
            ))}
            {breakdown.bonuses.map((b) => (
              <tr key={b.rule} className="border-t border-line">
                <td className="py-1">{name(b.subject)}</td>
                <td />
                <td className="py-1 text-right">{breakdownCopy.bonus(b.points)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-thick border-line-strong font-bold">
              <td className="py-1">{breakdownCopy.total}</td>
              <td />
              <td className="py-1 text-right">
                {breakdown.total} / {breakdown.maximum}
              </td>
            </tr>
          </tfoot>
        </table>
        {breakdown.incomplete ? <p className="mt-2 text-sm">{breakdownCopy.incomplete}</p> : null}
        <p className="mt-2">
          <SourceLink href={breakdown.methodSourceUrl}>{breakdownCopy.method}</SourceLink>
        </p>
      </Card>
    </div>
  );
}

function DeadlinesCard({ artifact }: { artifact: Extract<Artifact, { kind: 'deadlines' }> }) {
  const earlier = artifact.windows.find((w) => w.academicYear < artifact.targetIntake);
  return (
    <Card>
      <h2 className="mb-2 text-lg">{deadlines.title}</h2>
      {earlier ? (
        <Notice tone="warning">{applications.lastCycle(earlier.academicYear)}</Notice>
      ) : null}
      {artifact.windows.length === 0 ? <p>{deadlines.none}</p> : null}
      <ul className="mt-3 flex flex-col gap-3">
        {artifact.windows.map((w) => (
          <li key={w.universityId} className="border-t border-line pt-2">
            <p className="font-bold">
              <UniversityName name={w.universityName} />
            </p>
            <p>
              {w.opensOn ? `${applications.opens(formatDate(w.opensOn))} · ` : ''}
              {applications.closes(formatDate(w.closesOn))}
            </p>
            {w.earlierClosings.map((e) => (
              <p key={e.scope} className="text-sm">
                {e.scope}: {formatDate(e.closesOn)}
              </p>
            ))}
            <SourceLink href={w.sourceUrl} row />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PackSummary({ artifact }: { artifact: Extract<Artifact, { kind: 'application-pack' }> }) {
  const open = artifact.checklist.filter((c) => !c.done).length;
  return (
    <Card>
      <h2 className="mb-2 text-lg">
        {applications.pack}: {artifact.university.shortName}
      </h2>
      {artifact.window ? <p>{applications.closes(formatDate(artifact.window.closesOn))}</p> : null}
      <p>
        {applications.checklist}: {artifact.checklist.length - open}/{artifact.checklist.length}
      </p>
      <Link
        href={`/applications/${artifact.university.id}`}
        className="inline-flex min-h-11 items-center"
      >
        {chat.artifactOpen}: {applications.pack}
      </Link>
    </Card>
  );
}

function FundingSummary({ artifact }: { artifact: Extract<Artifact, { kind: 'funding' }> }) {
  return (
    <Card>
      <h2 className="mb-2 text-lg">{funding.nsfas}</h2>
      {artifact.nsfas ? (
        <>
          {artifact.nsfas.closesOn ? (
            <p>{applications.closes(formatDate(artifact.nsfas.closesOn))}</p>
          ) : null}
          <p>{funding.threshold(common.rand(artifact.nsfas.incomeThresholdZar))}</p>
          {artifact.nsfas.academicYear ? <Badge>{artifact.nsfas.academicYear}</Badge> : null}
        </>
      ) : null}
      <Link href="/funding" className="mt-2 inline-flex min-h-11 items-center">
        {chat.artifactOpen}: {funding.title}
      </Link>
    </Card>
  );
}
