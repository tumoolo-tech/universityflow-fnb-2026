'use client';

import type { PracticeArtifact } from '@universityflow/agent';
import { common, practice } from '@universityflow/content';
import Link from 'next/link';
import { useId } from 'react';
import { Badge, Card, Notice } from '@/components/ui';

/**
 * Free practice (planning.md §3, Stage 3): links to Siyavula's free textbooks, practice and past
 * papers for the subjects that matter to the learner, chosen on the server by tested code. Links
 * only, from sourced catalogue records; unverified ones appear only in preview, labelled (hard
 * rule 3). No admission fact (hard rule 2): the marks to aim for are on "What I need".
 */
export function PracticeCard({ artifact }: { artifact: PracticeArtifact }) {
  const t = practice;
  const drafts = artifact.subjects.some((s) => s.resources.some((r) => r.draft));
  const lead =
    artifact.basis === 'goal' && artifact.goal
      ? t.lead.goal(`${artifact.goal.name} (${artifact.goal.universityName})`)
      : t.lead[artifact.basis === 'goal' ? 'none' : artifact.basis];
  const needsAccount = artifact.subjects.some((s) =>
    s.resources.some((r) => r.access === 'free-with-account'),
  );
  // The chat can show this twice: each copy names its region by its own heading (A3-05).
  const titleId = useId();
  return (
    <Card aria-labelledby={titleId} className="flex flex-col gap-3">
      <h2 id={titleId} className="text-lg">
        {t.title}
      </h2>
      <p className="text-muted">{lead}</p>
      {drafts ? <Notice tone="warning">{common.draftNotice}</Notice> : null}
      {artifact.subjects.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {artifact.subjects.map((s) => (
            <li
              key={s.subjectId}
              className="flex flex-col gap-2 rounded-md bg-sunk p-3"
              data-testid={`practice-${s.subjectId}`}
            >
              <div>
                <h3 className="font-bold">{s.subjectName}</h3>
                <p className="text-sm">{t.reasons[s.reason]}</p>
              </div>
              {s.resources.length === 0 ? (
                <p className="text-sm">{t.noneYet}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {s.resources.map((r) => (
                    <li key={r.id} className="flex flex-col gap-1">
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center font-medium"
                      >
                        {r.title}
                        <span className="sr-only"> {common.opensInNewTab}</span>
                      </a>
                      <p className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge tone="surface">{t.kinds[r.kind]}</Badge>
                        <Badge tone="success">{t.access[r.access]}</Badge>
                        <span>{t.grades(r.grades.join(', '))}</span>
                        {r.draft ? <Badge tone="warning">{common.draftBadge}</Badge> : null}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {needsAccount ? <p className="text-sm">{t.signUpNote}</p> : null}
      {artifact.goal && artifact.basis === 'goal' ? (
        <Link
          href={`/results/what-i-need/${artifact.goal.programmeId}`}
          className="inline-flex min-h-11 items-center"
        >
          {t.whatINeed}
        </Link>
      ) : null}
    </Card>
  );
}
