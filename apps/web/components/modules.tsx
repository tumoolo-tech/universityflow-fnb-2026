'use client';

import type { MyModulesArtifact } from '@universityflow/agent';
import { dialable } from '@universityflow/catalogue/client';
import { chat, common, moduleCard, modules, nav } from '@universityflow/content';
import Link from 'next/link';
import { type ReactNode, type Ref, useId, useState } from 'react';
import { Badge, Button, Card, Notice, panelLook, SourceLink } from '@/components/ui';
import { formatDate } from '@/lib/client/api';
import { UniversityName } from './university-mark';

/**
 * My modules (Phase 5c), shared by the chat's artifact panel and the My modules page. Every
 * difference and its wording, who to see, the message and the last day to change were decided by
 * code (packages/admissions, packages/agent's builder, packages/content); this only lays them out.
 * No verdict is shown without a curriculum record. Nothing animates.
 */

const m = modules;

/** A date and time in South Africa, e.g. "16 Feb 2027, 18:00". */
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

/** Rows with their place in the list: never reordered, and a code may repeat (registered twice). */
const numbered = <T,>(items: ReadonlyArray<T>) => items.map((item, n) => ({ n, item }));

const NO_VERDICT = {
  'no-curriculum': m.noCurriculum,
  'no-programme': m.noProgramme,
  'not-first-year': m.notFirstYear,
} as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h3 id={id} className="font-bold">
        {title}
      </h3>
      {children}
    </section>
  );
}

function CopyMessage({ message }: { message: string }) {
  const [status, setStatus] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <pre
        className={`${panelLook} whitespace-pre-wrap p-3 font-sans text-sm`}
        data-testid="modules-message"
      >
        {message}
      </pre>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(message);
              setStatus(m.copied);
            } catch {
              setStatus(m.copyFailed);
            }
          }}
        >
          {m.copy}
        </Button>
        <p role="status" className="text-sm">
          {status}
        </p>
      </div>
    </div>
  );
}

function WhoToSee({ artifact }: { artifact: MyModulesArtifact }) {
  const { office } = artifact;
  return (
    <Section title={m.whoTitle}>
      {office ? (
        <div className="flex flex-col gap-1" data-testid="modules-office">
          <p>
            {m.whoLead(office.faculty)}
            {office.draft ? (
              <>
                {' '}
                <Badge tone="warning">{common.draftBadge}</Badge>
              </>
            ) : null}
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="font-medium">{m.where}</dt>
            <dd>{office.where}</dd>
            {office.hours ? (
              <>
                <dt className="font-medium">{m.hours}</dt>
                <dd>{office.hours}</dd>
              </>
            ) : null}
            {office.email ? (
              <>
                <dt className="font-medium">{m.email}</dt>
                <dd>
                  <a href={`mailto:${office.email}`}>{office.email}</a>
                </dd>
              </>
            ) : null}
            {office.phone ? (
              <>
                <dt className="font-medium">{m.phone}</dt>
                <dd>
                  <a href={`tel:${dialable(office.phone)}`}>{office.phone}</a>
                </dd>
              </>
            ) : null}
          </dl>
          <p>
            <a href={office.contactUrl} rel="noopener noreferrer" target="_blank">
              {m.contactPage}
            </a>
          </p>
        </div>
      ) : (
        <p>{m.noOffice}</p>
      )}
    </Section>
  );
}

function Deadlines({
  artifact,
  remindersOn,
}: {
  artifact: MyModulesArtifact;
  remindersOn?: boolean;
}) {
  const { deadlines } = artifact;
  const unpublished = deadlines.unpublishedTerms.map((t) => m.deadlineScopes[t]).join(', ');
  return (
    <Section title={m.deadlineTitle}>
      {deadlines.status === 'none' ? (
        <p data-testid="modules-deadline">{m.noDeadline(artifact.academicYear)}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-1" data-testid="modules-deadline">
            {deadlines.deadlines.map((d) => (
              <li key={d.appliesTo} className="flex flex-wrap items-center gap-2">
                <span>
                  {m.deadlineScopes[d.appliesTo]}: {formatDate(d.lastDay)}
                </span>
                {d.daysLeft >= 0 ? (
                  <Badge tone="accent">{m.daysLeft(d.daysLeft)}</Badge>
                ) : (
                  <Badge tone="warning">{m.deadlinePassed}</Badge>
                )}
                {deadlines.draft ? <Badge tone="warning">{common.draftBadge}</Badge> : null}
              </li>
            ))}
          </ul>
          {deadlines.sourceUrl ? (
            <SourceLink href={deadlines.sourceUrl}>{m.calendarSource}</SourceLink>
          ) : null}
        </>
      )}
      {unpublished ? <p className="text-sm">{m.unpublished(unpublished)}</p> : null}
      {artifact.reminderAt ? (
        <p className="text-sm">{m.reminderSet(formatDateTime(artifact.reminderAt))}</p>
      ) : artifact.differences.length > 0 && deadlines.next && remindersOn === false ? (
        <p className="text-sm">
          {m.reminderOff} <Link href="/me">{nav.me}</Link>
        </p>
      ) : null}
    </Section>
  );
}

function ModuleTables({ artifact }: { artifact: MyModulesArtifact }) {
  const term = (t: keyof typeof m.terms | null) => (t ? m.terms[t] : m.notSure);
  return (
    <>
      <Section title={m.registeredTitle}>
        <ul className="flex flex-col gap-1">
          {numbered(artifact.registered).map(({ n, item: r }) => (
            <li key={n} className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{r.code}</span>
              {r.name ? <span>{r.name}</span> : null}
              <span className="text-sm text-muted">{term(r.term)}</span>
              {r.credits !== null ? (
                <span className="text-sm text-muted">{m.credits(r.credits)}</span>
              ) : null}
              {r.inCurriculum === false ? <Badge tone="warning">{m.notInCurriculum}</Badge> : null}
              {/* Phase 6c: each confirmed module opens its card. */}
              <Link
                href={`/modules/${artifact.registrationId}/${encodeURIComponent(r.code)}`}
                aria-label={moduleCard.openFor(r.code)}
                className="inline-flex min-h-11 items-center"
              >
                {moduleCard.open}
              </Link>
            </li>
          ))}
        </ul>
      </Section>
      {artifact.expected.length > 0 ? (
        <Section title={m.expectedTitle}>
          <ul className="flex flex-col gap-1">
            {artifact.expected.map((e) => (
              <li key={e.code} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {[e.code, ...(e.alternativeCodes ?? [])].join(' / ')}
                </span>
                <span>{e.name}</span>
                <span className="text-sm text-muted">
                  {e.semester ? m.terms[e.semester] : m.termNotPrinted} · {m.credits(e.credits)}
                </span>
                <Badge>{e.compulsory ? m.compulsory : m.elective}</Badge>
                <Badge tone={e.registered ? 'success' : 'warning'}>
                  {e.registered ? m.registered : m.notRegistered}
                </Badge>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}

export function MyModulesCard({
  artifact,
  remindersOn,
  children,
  headingRef,
  linkToPage,
}: {
  artifact: MyModulesArtifact;
  remindersOn?: boolean;
  children?: ReactNode;
  /** On the page: where focus goes once a confirmed registration is checked (A3-13). */
  headingRef?: Ref<HTMLHeadingElement>;
  /** In the chat: a link to the My modules page. */
  linkToPage?: boolean;
}) {
  const titleId = useId();
  const { programme, curriculum, credits } = artifact;
  const n = artifact.differences.length;
  return (
    <Card as="article" aria-labelledby={titleId} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2
          id={titleId}
          className="text-lg"
          ref={headingRef}
          tabIndex={headingRef ? -1 : undefined}
        >
          {programme ? programme.name : m.title}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {programme ? (
            <Badge>
              <UniversityName name={programme.universityName} />
            </Badge>
          ) : null}
          {/* On the white card, the neutral (sunk) chip shows; `surface` is for sunk panels (A2-13). */}
          <Badge>{m.registeredFor(artifact.academicYear)}</Badge>
          {artifact.includesDrafts ? <Badge tone="warning">{common.draftBadge}</Badge> : null}
        </div>
      </div>

      {artifact.status === 'checked' && curriculum ? (
        <>
          <p className="text-sm">
            {m.checkedAgainst(curriculum.academicYear)}{' '}
            <SourceLink href={curriculum.sourceUrl}>{m.curriculumSource}</SourceLink>
          </p>
          {n === 0 ? (
            <Notice tone="success">{m.matches}</Notice>
          ) : (
            <Section title={m.differencesTitle(n)}>
              <ul className="flex flex-col gap-2" data-testid="modules-differences">
                {numbered(artifact.differences).map(({ n, item: d }) => (
                  <li
                    key={n}
                    className="rounded-md border-l-rule border-warning bg-warning-soft p-3"
                  >
                    {d.text}
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {credits ? (
            <p className="text-sm">
              {m.totalCredits(credits.registered, credits.min, credits.max)}
              {credits.uncounted.length > 0 ? ` ${m.uncounted(credits.uncounted.join(', '))}` : ''}
            </p>
          ) : null}
        </>
      ) : artifact.status !== 'checked' ? (
        <Notice tone="info">{NO_VERDICT[artifact.status]}</Notice>
      ) : null}

      <WhoToSee artifact={artifact} />
      {artifact.message ? (
        <Section title={m.messageTitle}>
          <p className="text-sm">{m.messageLead}</p>
          <CopyMessage message={artifact.message} />
        </Section>
      ) : null}
      <Deadlines artifact={artifact} {...(remindersOn === undefined ? {} : { remindersOn })} />
      <ModuleTables artifact={artifact} />

      {linkToPage ? (
        <Link href="/modules" className="inline-flex min-h-11 items-center">
          {chat.artifactOpen}: {m.title}
        </Link>
      ) : null}
      {children}
    </Card>
  );
}
