import type { ProgrammeResult } from '@universityflow/admissions';
import { type SubjectId, subject } from '@universityflow/catalogue/client';
import {
  applications,
  common,
  passTypes,
  qualifications,
  results,
  whatINeed,
} from '@universityflow/content';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge, Button, Card, cx, SourceLink } from '@/components/ui';
import { formatDate } from '@/lib/client/api';
import { courseArt } from '@/lib/course-art';
import { CARD_ART_SIZES, CardArtLayers } from './card-art';
import { UniversityName } from './university-mark';

const subjectName = (id: SubjectId | null, fallback: ReadonlyArray<SubjectId>) =>
  (id ? [id] : fallback).map((s) => subject(s).name).join(' or ');

/**
 * One programme in a results list: verdict, score, exactly what to improve, and its source.
 *
 * No 'use client': on /results it renders on the server, and only `action` (the shortlist
 * button) is a client island (audit A4-03). In the chat it renders inside the client artifacts.
 */
export function ProgrammeCard({
  result,
  shortlisted,
  onShortlist,
  onDetails,
  action,
  bare = false,
}: {
  result: ProgrammeResult;
  /**
   * Inside another card (the Goal card): no card chrome and no list item, so there is no card in
   * a card (A2-10), and no fixed id to repeat when the chat shows it twice (A3-05).
   */
  bare?: boolean;
  shortlisted?: boolean;
  onShortlist?: () => void;
  onDetails?: () => void;
  /** A control rendered where the shortlist button goes, e.g. a client island. */
  action?: ReactNode;
}) {
  const whatINeedHref = `/results/what-i-need/${result.programmeId}`;
  const headingId = `p-${result.programmeId}`;
  const body = (
    <>
      <div className={cx('flex flex-wrap items-center gap-2', !bare && 'uf-course-card-band')}>
        <Badge tone="neutral">
          <UniversityName name={result.universityName} />
        </Badge>
        <Badge tone="info">{qualifications[result.qualification]}</Badge>
        {result.draft ? <Badge tone="warning">{common.draftBadge}</Badge> : null}
      </div>
      <h3 id={bare ? undefined : headingId} className="text-lg">
        {result.name}
      </h3>
      <p className="text-sm text-muted">{result.faculty}</p>
      <p>
        <strong>{results.yourScore(result.scoreLabel, result.score, result.scoreMaximum)}</strong>
        {' · '}
        {result.requiredScore === null
          ? results.noMinimum
          : results.needed(result.scoreLabel, result.requiredScore)}
      </p>
      {result.scoreGap > 0 || result.shortfalls.length > 0 || !result.passMet ? (
        <ul className="flex list-disc flex-col gap-1 pl-6">
          {result.scoreGap > 0 ? (
            <li>{results.pointsShort(result.scoreGap, result.scoreLabel)}</li>
          ) : null}
          {result.shortfalls.map((s) => (
            <li key={`${s.kind}-${s.subjects.join()}`}>
              {s.kind === 'other-subjects'
                ? results.improveOthers(s.count, s.targetPercent)
                : results.improve(subjectName(s.subject, s.subjects), s.percent, s.targetPercent)}
            </li>
          ))}
          {!result.passMet ? <li>{results.passNeeded(passTypes[result.passRequired])}</li> : null}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2 text-sm">
        {result.nbt === 'required' ? <Badge tone="accent">{results.nbtRequired}</Badge> : null}
        {result.closesOn ? <Badge>{results.closes(formatDate(result.closesOn))}</Badge> : null}
      </div>
      {result.scoreBands.length > 0 ? (
        <details>
          <summary className="min-h-11 cursor-pointer py-2">{results.bands}</summary>
          <ul className="flex flex-col gap-1 pl-4 text-sm">
            {result.scoreBands.map((b) => (
              <li key={b.band}>
                <strong>{b.band}</strong>: {b.threshold ?? ''} {results.bandBasis[b.basis]} ·{' '}
                {b.who} · {b.outcome}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {result.selection ? (
        <p className="text-sm">
          <span className="font-medium">{applications.selectionNote}: </span>
          {result.selection}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        {onShortlist ? (
          <Button
            variant={shortlisted ? 'secondary' : 'primary'}
            onClick={onShortlist}
            aria-pressed={shortlisted}
          >
            {shortlisted ? results.shortlisted : results.shortlist}
          </Button>
        ) : null}
        {action ?? null}
        <Link href={whatINeedHref} className="inline-flex min-h-11 items-center">
          {whatINeed.open}
          <span className="sr-only">: {result.name}</span>
        </Link>
        {onDetails ? (
          <Button variant="quiet" onClick={onDetails}>
            {results.details}
          </Button>
        ) : null}
        <SourceLink href={result.sourceUrl} />
      </div>
    </>
  );
  if (bare) return <div className="flex flex-col gap-3">{body}</div>;
  return (
    <Card as="li" className="uf-course-card flex flex-col gap-3" aria-labelledby={headingId}>
      {/* The course's field in a picture (cards8), under the tokens' scrim. */}
      <CardArtLayers art={courseArt(result)} sizes={CARD_ART_SIZES} />
      {body}
    </Card>
  );
}
