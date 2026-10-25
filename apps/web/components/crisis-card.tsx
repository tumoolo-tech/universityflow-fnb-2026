import type { Artifact, CrisisCampusLines } from '@universityflow/agent';
import { dialable } from '@universityflow/catalogue/client';
import { crisis, crisisWords } from '@universityflow/content';
import { useId } from 'react';
import { CallLink, CrisisWalk } from '@/components/place-links';
import { ButtonLink, Notice } from '@/components/ui';

/**
 * The crisis card (planning.md §4.3): the chat shows it as an artifact, Get help as its page. No
 * `'use client'`: it needs no browser JavaScript, so Get help renders it on the server and loads
 * none of the chat's artifact code (it was 171 KB).
 */
export function CrisisCard({ artifact }: { artifact: Extract<Artifact, { kind: 'crisis-card' }> }) {
  // Promises only what the lines shown can keep (audit A10-11).
  const lead = crisisWords(artifact.cover, artifact.helplines.length).cardLead;
  // Its own id: a chat can show the card more than once (A3-10).
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="rounded-lg border-thick border-brand bg-surface p-5"
    >
      <h2 id={titleId} className="text-xl">
        {crisis.cardTitle}
      </h2>
      {lead ? <p className="mb-3 text-muted">{lead}</p> : null}
      {artifact.helplines.length === 0 ? (
        <Notice tone="warning">{crisis.noVerifiedNumbers}</Notice>
      ) : null}
      <ul className="flex flex-col gap-3">
        {artifact.helplines.map((line) => (
          <li key={line.id} className="flex flex-col gap-2 rounded-md bg-sunk p-3">
            <p className="font-bold">{line.name}</p>
            <p className="text-sm">
              {line.purpose} {line.hours}.
            </p>
            <div className="flex flex-wrap gap-2">
              {line.numbers.map((n) => (
                <ButtonLink
                  key={`${n.kind}-${n.value}`}
                  href={`${n.kind === 'sms' ? 'sms' : 'tel'}:${dialable(n.value)}`}
                >
                  {n.kind === 'sms'
                    ? crisis.sms(n.value)
                    : n.kind === 'whatsapp'
                      ? crisis.whatsapp(n.value)
                      : crisis.call(n.value)}
                </ButtonLink>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {artifact.campus ? <CrisisCampus campus={artifact.campus} /> : null}
      <p className="mt-3 text-sm">{crisis.campus}</p>
    </section>
  );
}

/** The crisis card's campus lines: verified clinic, counselling and security, each dialable. */
function CrisisCampus({ campus }: { campus: CrisisCampusLines }) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="mt-3 flex flex-col gap-2"
      data-testid="crisis-campus"
    >
      <h3 id={titleId} className="font-bold">
        {crisis.campusTitle(campus.universityName)}
      </h3>
      <p className="text-sm text-muted">{crisis.campusLead}</p>
      <ul className="flex flex-col gap-3">
        {campus.lines.map((line) => (
          <li key={line.id} className="flex flex-col gap-2 rounded-md bg-sunk p-3">
            <p className="font-bold">{line.name}</p>
            <p className="text-sm">
              {line.campusName}
              {line.where ? `: ${line.where}` : ''}
              {line.hours ? `. ${line.hours}` : ''}
            </p>
            {line.phone || line.walkUrl ? (
              <div className="flex flex-wrap items-center gap-3">
                {line.phone ? <CallLink phone={line.phone} label={line.name} /> : null}
                {line.walkUrl ? <CrisisWalk walkUrl={line.walkUrl} place={line.name} /> : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
