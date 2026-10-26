import { applications, common, funding } from '@universityflow/content';
import { useId } from 'react';
import { formatDate } from '@/lib/client/api';
import type { DemoLogo } from '@/lib/demo-logos';
import type { FundingWindow } from '@/lib/funding-window';
import { Icon } from './icons';
import { Badge, ButtonLink, Card, cx, panelLook, SourceLink } from './ui';
import { DemoLogoImage } from './university-mark';

/** One key fact a learner scans for: a short lead (optional) and the record's words. */
export interface FundingFact {
  readonly lead?: string | undefined;
  readonly text: string;
}

export interface FundingCardProps {
  /** The bursary's name, as the page's words give it. */
  readonly title: string;
  readonly academicYear: number;
  readonly draft: boolean;
  /** From the record's dates (`fundingWindow`). */
  readonly window: FundingWindow;
  /** The two or three facts that decide whether to apply, worded from the record. */
  readonly facts: ReadonlyArray<FundingFact>;
  readonly applyUrl: string;
  readonly sourceUrl: string;
  /** The longer rule (NSFAS's N+), shown behind a disclosure. */
  readonly detail?: { readonly title: string; readonly body: string } | undefined;
  /** More of the same, each behind its own disclosure (a bursary's how to apply, its work-back). */
  readonly details?: ReadonlyArray<{ readonly title: string; readonly body: string }> | undefined;
  /** The funder's logo (the judge demo's logo mechanism, lib/demo-logos.ts); decorative. */
  readonly logo?: DemoLogo | null | undefined;
  /** Under the title: who funds it, and who runs it for them. */
  readonly subtitle?: string | undefined;
  /** What the funder's page says about the window, beside or instead of its dates. */
  readonly windowNote?: string | null | undefined;
  /** 2 on its own (NSFAS); 3 inside a list that has its own h2 (the other bursaries). */
  readonly level?: 2 | 3 | undefined;
}

/** The site a learner applies on, as its address reads ("my.nsfas.org.za"). */
const siteOf = (url: string) => new URL(url).host;

/**
 * A bursary on the Funding page (RT-05, the owner's run-through, 2026-10-25: the NSFAS card
 * "feels like reading one thing"). In order of what matters: the deadline, big, with the days
 * left while it is open; the key facts as a short list to scan; "Apply on …" as the one primary
 * button, with the official source beside it; the longer rule behind a disclosure. Every fact is
 * the record's (hard rule 2), every word from `en.funding`. Built for any bursary record of
 * NSFAS's shape; no 'use client', no state.
 */
export function FundingCard({
  title,
  academicYear,
  draft,
  window,
  facts,
  applyUrl,
  sourceUrl,
  detail,
  details = [],
  logo,
  subtitle,
  windowNote,
  level = 2,
}: FundingCardProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const deadlineId = `${id}-deadline`;
  const factsId = `${id}-facts`;
  const Title = level === 2 ? 'h2' : 'h3';
  const Part = level === 2 ? 'h3' : 'h4';
  const disclosures = [...(detail ? [detail] : []), ...details];
  return (
    <Card aria-labelledby={titleId} className="uf-funding flex flex-col gap-4">
      <div className="uf-card-head flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          {logo ? (
            <span className="uf-demo-logo" data-backing={logo.backing}>
              <DemoLogoImage logo={logo} />
            </span>
          ) : null}
          <Title id={titleId} className="text-lg">
            {title}
          </Title>
          <Badge>{academicYear}</Badge>
          {draft ? <Badge tone="warning">{common.draftBadge}</Badge> : null}
        </div>
        {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
      </div>

      <section
        aria-labelledby={deadlineId}
        className={cx(panelLook, 'uf-funding-deadline flex flex-col gap-1 p-4')}
        data-state={window.state}
      >
        <Part id={deadlineId} className="uf-funding-label">
          {funding.deadline}
        </Part>
        {/* With no published dates, the funder's own words are the answer, not "not published". */}
        {window.state === 'unknown' && windowNote ? null : <Deadline window={window} />}
        {windowNote ? (
          <p className={window.state === 'unknown' ? 'text-lg font-bold' : 'text-sm text-muted'}>
            {windowNote}
          </p>
        ) : null}
      </section>

      {facts.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Part id={factsId} className="font-bold">
            {funding.who}
          </Part>
          <ul aria-labelledby={factsId} className="uf-funding-facts">
            {facts.map((fact) => (
              <li key={fact.text} className="uf-funding-fact">
                {fact.lead ? <span className="font-medium">{fact.lead}</span> : null}
                {fact.lead ? <span className="text-sm text-muted">{fact.text}</span> : fact.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <ButtonLink href={applyUrl} newTab>
          {funding.applyOn(siteOf(applyUrl))}
          <span className="sr-only"> {common.opensInNewTab}</span>
        </ButtonLink>
        <SourceLink href={sourceUrl} row />
      </div>

      {disclosures.map((item) => (
        // My subjects' disclosure: the chevron turns, the panel grows (0ms under reduced motion).
        <details key={item.title} className="uf-door uf-funding-detail">
          <summary className="uf-door-summary flex min-h-11 cursor-pointer list-none items-center gap-3 font-medium [&::-webkit-details-marker]:hidden">
            <Icon name="chevron" className="uf-door-chevron size-5 shrink-0" />
            {item.title}
          </summary>
          <p className="pb-2 pl-8 text-muted">{item.body}</p>
        </details>
      ))}
    </Card>
  );
}

function Deadline({ window }: { window: FundingWindow }) {
  switch (window.state) {
    case 'open':
      return (
        <>
          <p className="text-2xl font-bold">{applications.closes(formatDate(window.closesOn))}</p>
          <p>
            <Badge tone="accent">{funding.daysLeft(window.daysLeft)}</Badge>
          </p>
          {window.opensOn ? (
            <p className="text-sm text-muted">{funding.openedOn(formatDate(window.opensOn))}</p>
          ) : null}
        </>
      );
    case 'upcoming':
      return (
        <>
          <p className="text-2xl font-bold">{applications.opens(formatDate(window.opensOn))}</p>
          <p>
            <Badge tone="info">{funding.opensIn(window.daysToOpen)}</Badge>
          </p>
          <p className="text-sm text-muted">{applications.closes(formatDate(window.closesOn))}</p>
        </>
      );
    case 'closed':
      return (
        <>
          <p className="text-2xl font-bold">{funding.closedOn(formatDate(window.closesOn))}</p>
          <p className="text-sm text-muted">{funding.closedNext}</p>
        </>
      );
    default:
      return <p className="text-lg font-bold">{funding.datesUnknown}</p>;
  }
}
