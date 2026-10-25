'use client';

import type { OfferCardArtifact } from '@universityflow/agent';
import { chat, common, nav, offers, qualifications, results } from '@universityflow/content';
import Link from 'next/link';
import { type ReactNode, type Ref, useId } from 'react';
import { Badge, Card, Notice, SourceLink } from '@/components/ui';
import { formatDate } from '@/lib/client/api';
import { programmeArt } from '@/lib/course-art';
import { CARD_ART_SIZES, CardArtLayers } from './card-art';
import { UniversityName } from './university-mark';

/**
 * The offer card (Phase 5a), shared by the chat's artifact panel and the My offers page. What kind
 * of offer it is comes from packages/content in plain words, and only a final offer is ever called
 * one (§8.5). The conditions are the university's words, shown as quoted, never interpreted. The
 * re-check on final results was decided by packages/admissions (hard rule 2). Nothing animates.
 */

const KIND_TONE = {
  provisional: 'warning',
  conditional: 'warning',
  waitlist: 'info',
  final: 'success',
} as const;

/** A date and time in South Africa, e.g. "27 Oct 2026, 18:00". */
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Johannesburg',
  });
}

/** The conditions with their place in the letter: a quoted list, never reordered, words may repeat. */
const numbered = (conditions: ReadonlyArray<string>) =>
  conditions.map((condition, n) => ({ n, condition }));

export function OfferCard({
  artifact,
  remindersOn,
  children,
  headingRef,
  linkToPage,
}: {
  artifact: OfferCardArtifact;
  /** Whether the learner has a channel on; the page knows, the chat doesn't say. */
  remindersOn?: boolean;
  /** The page's actions (accept, decline, remove). */
  children?: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
  /** In the chat: a link to the My offers page. */
  linkToPage?: boolean;
}) {
  const t = offers;
  const titleId = useId();
  const { programme, finalCheck } = artifact;
  const open = artifact.status === 'held';
  return (
    <Card as="article" aria-labelledby={titleId} className="uf-course-card flex flex-col gap-3">
      {/* Its course's field in a picture, as on the course cards (cards9); neutral without one. */}
      <CardArtLayers art={programmeArt(programme)} sizes={CARD_ART_SIZES} />
      {/* The band in a wrapper, so the heading's focus ring (it takes focus) sits on the scrim. */}
      <div className="uf-course-card-band">
        <h2
          id={titleId}
          className="text-lg"
          ref={headingRef}
          tabIndex={headingRef ? -1 : undefined}
        >
          {programme ? programme.name : t.notAvailable}
        </h2>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge>
          <UniversityName name={artifact.universityName} />
        </Badge>
        <Badge tone={KIND_TONE[artifact.offerKind]}>{t.kinds[artifact.offerKind]}</Badge>
        {/* On the white card, the neutral (sunk) chip shows; `surface` is for sunk panels (A2-13). */}
        <Badge>{t.sources[artifact.source]}</Badge>
        {programme?.draft ? <Badge tone="warning">{common.draftBadge}</Badge> : null}
      </div>
      <p data-testid="offer-explain">{t.explain[artifact.offerKind]}</p>
      <p className="font-bold" data-testid="offer-status">
        {t.statuses[artifact.status]}
      </p>

      {open ? (
        <div className="flex flex-col gap-1">
          {artifact.replyBy === null || artifact.daysLeft === null ? (
            <p>{t.noReplyBy}</p>
          ) : artifact.daysLeft < 0 ? (
            <Notice tone="warning">{t.replyByPassed}</Notice>
          ) : (
            <p className="flex flex-wrap items-center gap-2">
              <span>{t.replyBy(formatDate(artifact.replyBy))}</span>
              <Badge tone="accent">{t.daysLeft(artifact.daysLeft)}</Badge>
            </p>
          )}
          {artifact.reminderAt ? (
            <p className="text-sm">{t.reminderSet(formatDateTime(artifact.reminderAt))}</p>
          ) : artifact.replyBy !== null && remindersOn === false ? (
            <p className="text-sm">
              {t.reminderOff} <Link href="/me">{nav.me}</Link>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <h3 className="font-bold">{t.conditionsTitle}</h3>
        {artifact.conditions.length === 0 ? (
          <p className="text-sm text-muted">{t.noConditions}</p>
        ) : (
          <>
            <p className="text-sm text-muted">{t.conditionsLead}</p>
            <ul className="flex flex-col gap-2">
              {numbered(artifact.conditions).map(({ n, condition }) => (
                <li key={n}>
                  <blockquote className="rounded-md border-l-rule border-line-strong bg-sunk p-3">
                    {condition}
                  </blockquote>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {artifact.checksFinal ? (
        <div className="flex flex-col gap-2">
          <h3 className="font-bold">{t.finalTitle}</h3>
          {finalCheck === null ? (
            <p>
              {t.finalWaiting} <Link href="/documents">{t.confirmFinal}</Link>
            </p>
          ) : finalCheck.status === 'met' ? (
            <Notice tone="success">{t.finalMet}</Notice>
          ) : finalCheck.status === 'unavailable' ? (
            <p>{t.finalUnavailable}</p>
          ) : (
            <>
              <Notice tone="warning">{t.finalNotMet}</Notice>
              <h4 className="font-bold">{t.planBTitle}</h4>
              {finalCheck.planB.length === 0 ? (
                <p>{t.noPlanB}</p>
              ) : (
                <>
                  <p className="text-sm">{t.planBLead}</p>
                  <ul className="flex flex-col gap-1">
                    {finalCheck.planB.map((p) => (
                      <li key={p.programmeId}>
                        {p.universityName}: {p.name} ({qualifications[p.qualification]})
                        {p.draft ? (
                          <>
                            {' '}
                            <Badge tone="warning">{common.draftBadge}</Badge>
                          </>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <Link href="/results" className="inline-flex min-h-11 items-center">
                    {chat.artifactOpen}: {results.title}
                  </Link>
                </>
              )}
            </>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {programme ? <SourceLink href={programme.sourceUrl} row /> : null}
        {linkToPage ? (
          <Link href="/offers" className="inline-flex min-h-11 items-center">
            {chat.artifactOpen}: {t.title}
          </Link>
        ) : null}
      </div>
      {children}
    </Card>
  );
}
