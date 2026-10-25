'use client';

import type { ExamCountdownArtifact, GoalCardArtifact } from '@universityflow/agent';
import { common, goals } from '@universityflow/content';
import Link from 'next/link';
import { type ReactNode, type Ref, useId } from 'react';
import { Badge, Card, Notice, SourceLink } from '@/components/ui';
import { formatDate } from '@/lib/client/api';
import { ProgrammeCard } from './programme-card';
import { UniversityName } from './university-mark';

/**
 * The Goal card and the Exam countdown (planning.md §3, Stage 3), shared by the chat's artifact
 * panel and the My goal page. Every fact was decided by tested code on the server (hard rule 2);
 * unverified data is labelled wherever it appears (hard rule 3). Nothing animates.
 */

export function GoalCard({
  artifact,
  children,
  headingRef,
}: {
  artifact: GoalCardArtifact;
  children?: ReactNode;
  /** Where the My goal page puts focus after a save (A3-01). */
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const { programme, result } = artifact;
  const t = goals;
  // The chat can show this twice: each copy names its region by its own heading (A3-05).
  const titleId = useId();
  return (
    <Card aria-labelledby={titleId} className="flex flex-col gap-3">
      <h2 id={titleId} className="text-lg" ref={headingRef} tabIndex={headingRef ? -1 : undefined}>
        {t.goalTitle}
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <Badge>
          <UniversityName name={programme.universityName} />
        </Badge>
        {programme.draft ? <Badge tone="warning">{common.draftBadge}</Badge> : null}
      </div>
      {result ? (
        <>
          <p className="font-medium">{t.verdicts[result.verdict]}</p>
          {/* Inside this card, not a card of its own (A2-10). */}
          <ProgrammeCard result={result} bare />
        </>
      ) : (
        <>
          <p className="text-xl font-bold">{programme.name}</p>
          <p className="text-sm text-muted">{programme.faculty}</p>
          <p>{artifact.hasMarks ? t.noVerdict : t.noMarks}</p>
        </>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/applications/${programme.universityId}`}
          className="inline-flex min-h-11 items-center"
        >
          {t.openPack(programme.universityName)}
        </Link>
        <SourceLink href={programme.sourceUrl} row />
      </div>
      {children}
    </Card>
  );
}

export function ExamCountdown({ artifact }: { artifact: ExamCountdownArtifact }) {
  const t = goals;
  const drafts = artifact.papers.some((p) => p.draft);
  const titleId = useId();
  return (
    <Card aria-labelledby={titleId} className="flex flex-col gap-3">
      <h2 id={titleId} className="text-lg">
        {t.examsTitle}
      </h2>
      {drafts ? <Notice tone="warning">{common.draftNotice}</Notice> : null}
      {!artifact.timetablePublished ? (
        <p>{t.notPublished(artifact.examYear)}</p>
      ) : artifact.subjectCount === 0 ? (
        <p>{t.noSubjects}</p>
      ) : artifact.papers.length === 0 ? (
        <p>{t.noUpcoming}</p>
      ) : (
        <>
          <p className="text-muted">{t.examsLead(artifact.examYear)}</p>
          <ol className="flex flex-col gap-2">
            {artifact.papers.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-1 rounded-md bg-sunk p-3"
                data-testid={`paper-${p.id}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">{t.paper(p.subjectName, p.paper)}</p>
                  <Badge tone="accent">{t.daysLeft(p.daysLeft)}</Badge>
                </div>
                <p className="text-sm">
                  {t.when(formatDate(p.date), p.startsAt)} · {t.duration(p.durationMinutes)}
                </p>
                {p.draft ? (
                  <p>
                    <Badge tone="warning">{common.draftBadge}</Badge>
                  </p>
                ) : null}
                {p.note ? <p className="text-sm">{p.note}</p> : null}
              </li>
            ))}
          </ol>
          {artifact.papers[0] ? (
            <div>
              <SourceLink href={artifact.papers[0].sourceUrl} row />
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
