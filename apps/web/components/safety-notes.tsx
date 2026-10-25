'use client';

import type { SafetyNoteView } from '@universityflow/agent';
import { dialable } from '@universityflow/catalogue/client';
import { common, safetyNotes as t } from '@universityflow/content';
import { useId } from 'react';
import { Badge, ButtonLink, SourceLink } from '@/components/ui';
import { formatDate } from '@/lib/client/api';

/**
 * A university's safety notes (planning.md §11, Phase 5e-3): its own words, quoted as offer
 * conditions are, with its area and dates, what to do, and one-tap calls to campus security,
 * 10111 and 112. Text only: never a zone on a map, never a rating. A note with nobody to call is
 * not shown (the server builds none, and this checks again). Nothing animates.
 */

/** Whether a note can be shown: it always carries campus security and the emergency lines. */
const callable = (note: SafetyNoteView) => note.security.length > 0 && note.emergency.length > 0;

/** The standing line on every campus tour and checklist: no note is not a promise. */
export function NoWarningLine() {
  return <p className="text-sm font-bold">{t.noWarning}</p>;
}

export function SafetyNotes({
  notes,
  universityName,
  title,
  level = 4,
}: {
  notes: ReadonlyArray<SafetyNoteView> | undefined;
  universityName: string;
  title: string;
  /** The heading level where it sits: 3 beside a card's own sections, 4 inside a campus. */
  level?: 3 | 4;
}) {
  const titleId = useId();
  const shown = (notes ?? []).filter(callable);
  if (shown.length === 0) return null;
  const Heading = level === 3 ? 'h3' : 'h4';
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2">
      <Heading id={titleId} className="text-sm font-bold">
        {title}
      </Heading>
      <ul aria-labelledby={titleId} className="flex flex-col gap-3">
        {shown.map((note) => (
          <li
            key={note.id}
            className="flex flex-col gap-2 rounded-md bg-sunk p-3"
            data-testid={`safety-note-${note.id}`}
          >
            <p className="flex flex-wrap items-center gap-2 text-sm">
              {t.says(universityName)}
              {note.draft ? <Badge tone="warning">{common.draftBadge}</Badge> : null}
            </p>
            <blockquote className="border-l-rule border-line-strong bg-surface p-3">
              {note.quote}
            </blockquote>
            {note.area ? <p className="text-sm">{t.area(note.area)}</p> : null}
            {note.days || note.hours ? (
              <p className="text-sm">{t.when(note.days, note.hours)}</p>
            ) : null}
            <p className="text-sm text-muted">
              {note.checkedOn ? t.lastChecked(formatDate(note.checkedOn)) : t.notCheckedYet}
            </p>
            {note.publishedOn ? (
              <p className="text-sm text-muted">{t.publishedOn(formatDate(note.publishedOn))}</p>
            ) : null}
            <p className="text-sm font-bold">{t.whatToDoTitle}</p>
            <p className="text-sm">{t.whatToDo[note.kind]}</p>
            <p className="text-sm font-bold">{t.whoToCallTitle}</p>
            <div className="flex flex-wrap items-center gap-3">
              {[...note.security, ...note.emergency].map((line) => (
                <ButtonLink
                  key={line.id}
                  href={`tel:${dialable(line.phone)}`}
                  aria-label={`${t.call(line.phone)}: ${line.name}${line.campusName ? `, ${line.campusName}` : ''}`}
                >
                  {t.call(line.phone)}
                </ButtonLink>
              ))}
            </div>
            <div>
              <SourceLink href={note.sourceUrl} row />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
