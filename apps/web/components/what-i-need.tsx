import type { Blocker, WhatINeedResult } from '@universityflow/admissions';
import { type SubjectId, subject } from '@universityflow/catalogue/client';
import { breakdown, common, passTypes, results, whatINeed } from '@universityflow/content';
import { Badge, Card, Notice, SourceLink } from '@/components/ui';
import { UniversityName } from './university-mark';

/**
 * "What I need per subject" (Phase 4c): the target mark per subject for one course, exactly as
 * packages/admissions worked it out (hard rule 2). Shared by the chat artifact and the page.
 * Every string from packages/content; a draft is labelled (hard rule 3).
 */

const subjectName = (id: SubjectId) => {
  try {
    return subject(id).name;
  } catch {
    return id;
  }
};

export function blockerText(blocker: Blocker, scoreLabel: string): string {
  const b = whatINeed.blockers;
  switch (blocker.kind) {
    case 'subject-not-taken':
      return b.subjectNotTaken(blocker.subjects.map(subjectName).join(' or '));
    case 'not-enough-subjects':
      return b.notEnoughSubjects(blocker.needed, blocker.available);
    case 'no-home-language':
      return b.noHomeLanguage;
    case 'no-english':
      return b.noEnglish;
    case 'score-out-of-reach':
      return b.scoreOutOfReach(scoreLabel, blocker.best, blocker.required);
  }
}

export function WhatINeedCard({ result }: { result: WhatINeedResult }) {
  const { plan } = result;
  const headingId = `win-${result.programmeId}`;
  const t = whatINeed;
  return (
    <Card aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">
          <UniversityName name={result.universityName} />
        </Badge>
        {result.draft ? <Badge tone="warning">{common.draftBadge}</Badge> : null}
      </div>
      <h2 id={headingId} className="text-xl">
        {t.title}: {result.name}
      </h2>
      {result.draft ? <Notice tone="warning">{common.draftNotice}</Notice> : null}

      {plan.status === 'qualifies' || plan.status === 'on-track' ? (
        <Notice tone="success">{t.statuses[plan.status]}</Notice>
      ) : plan.status === 'reachable' ? (
        <Notice tone="info">
          {t.statuses.reachable} {t.totalGap(plan.totalGap)}
        </Notice>
      ) : (
        <Notice tone="warning" title={t.statuses.unreachable}>
          <ul className="flex list-disc flex-col gap-1 pl-6">
            {plan.blockers.map((b) => (
              <li key={JSON.stringify(b)}>{blockerText(b, plan.score.label)}</li>
            ))}
          </ul>
          <p className="mt-2">{t.blockers.talkToSomeone}</p>
        </Notice>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <caption className="sr-only">
            {t.title}: {result.name}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t.subject}</th>
              <th scope="col" className="text-right">
                {t.now}
              </th>
              <th scope="col" className="text-right">
                {t.target}
              </th>
              <th scope="col" className="text-right">
                {t.gap}
              </th>
            </tr>
          </thead>
          <tbody>
            {plan.subjects.map((s) => (
              <tr
                key={s.subject}
                className={`border-t border-line ${s.gap > 0 ? 'font-medium' : 'text-muted'}`}
              >
                <th scope="row" className="py-2 font-normal">
                  {subjectName(s.subject)}
                  {s.reasons.length > 0 ? (
                    <span className="block text-sm text-muted">
                      {s.reasons.map((r) => t.reasons[r]).join(' · ')}
                    </span>
                  ) : null}
                </th>
                <td className="py-2 text-right">{s.current}%</td>
                <td className="py-2 text-right">{s.target}%</td>
                <td className="py-2 text-right">{t.gapValue(s.gap)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p>
        {t.score(plan.score.label, plan.score.now, plan.score.atTarget)}
        {' · '}
        {plan.score.required === null
          ? results.noMinimum
          : results.needed(plan.score.label, plan.score.required)}
      </p>
      <p>{t.pass(passTypes[plan.pass.atTarget])}</p>
      <p className="text-sm text-muted">{t.howChosen}</p>
      <p className="text-sm text-muted">{t.notAPromise}</p>
      <p className="flex flex-wrap gap-3">
        <SourceLink href={result.sourceUrl} />
        <SourceLink href={result.methodSourceUrl}>{breakdown.method}</SourceLink>
      </p>
    </Card>
  );
}
