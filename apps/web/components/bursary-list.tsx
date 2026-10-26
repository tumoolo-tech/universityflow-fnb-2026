import type { Bursary, BursaryStatus } from '@universityflow/catalogue';
import { funding as words } from '@universityflow/content';
import { DEMO_FUNDER_LOGOS, DEMO_LOGOS_ON, type DemoLogo } from '@/lib/demo-logos';
import { fundingWindow } from '@/lib/funding-window';
import { FundingCard, type FundingFact } from './funding-card';

/** One bursary as the page shows it: `status` from packages/catalogue, `draft` from the server. */
export interface BursaryEntry {
  readonly bursary: Bursary;
  readonly status: BursaryStatus;
  readonly draft: boolean;
}

/**
 * Bursaries beside NSFAS on /funding (planning.md §3 Stage 2), each in NSFAS's own card (RT-05):
 * the deadline first, or what the funder says about it; who can apply, what it pays for and any
 * work-back as facts to scan; "Apply on …" as the one primary button; how to apply behind a
 * disclosure. Every word is the funder's published record or `en.funding`; the window is
 * `fundingWindow` on the record's dates, and the list's order is packages/catalogue's
 * `bursariesFor`. No 'use client': rendered on the server.
 *
 * The funder's own logo shows only on the judge demo (lib/demo-logos.ts), on the same chip as the
 * universities'; everywhere else there is none.
 */
export function BursaryList({
  entries,
  today,
  demoLogos = DEMO_LOGOS_ON ? DEMO_FUNDER_LOGOS : null,
}: {
  entries: ReadonlyArray<BursaryEntry>;
  /** Today in South Africa (YYYY-MM-DD, `sastDateOf`), as the NSFAS card takes it. */
  today: string;
  /** For tests only: the judge demo's funder logos. */
  demoLogos?: Readonly<Record<string, DemoLogo>> | null;
}) {
  return (
    <section aria-labelledby="bursaries-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="bursaries-title" className="text-xl">
          {words.bursaries}
        </h2>
        <p className="text-muted">{words.bursariesLead}</p>
        <p className="text-sm">{words.bursaryFree}</p>
      </div>
      {entries.length === 0 ? <p>{words.bursariesNone}</p> : null}
      <div className="flex flex-col gap-6">
        {entries.map(({ bursary: b, draft }) => (
          <FundingCard
            key={b.id}
            level={3}
            title={b.name}
            subtitle={
              b.administeredBy
                ? `${words.funderKinds[b.funderKind]} · ${b.funder} · ${words.bursaryAdministeredBy(b.administeredBy)}`
                : `${words.funderKinds[b.funderKind]} · ${b.funder}`
            }
            academicYear={b.academicYear}
            draft={draft}
            window={fundingWindow(b, today)}
            windowNote={b.windowNote ?? null}
            facts={facts(b)}
            applyUrl={b.applyUrl}
            sourceUrl={b.sourceUrl}
            details={[
              { title: words.bursaryHow, body: b.howToApply },
              ...(b.workBack.kind === 'required'
                ? []
                : [{ title: words.bursaryWorkBack, body: words.bursaryWorkBackNotStated }]),
            ]}
            logo={demoLogos?.[b.id] ?? null}
          />
        ))}
      </div>
    </section>
  );
}

/** What decides whether to apply: who, what you can study, what it pays, and any work-back. */
function facts(b: Bursary): FundingFact[] {
  return [
    ...b.who.map((text) => ({ text })),
    { lead: words.bursaryFields, text: b.fieldsAsPrinted },
    { lead: words.bursaryCovers, text: b.covers ?? words.bursaryCoversUnknown },
    // A work-back is a commitment for years: a fact to see, never hidden behind a disclosure.
    // (The schema refuses a `required` one without its terms.)
    ...(b.workBack.kind === 'required' && b.workBack.terms
      ? [{ lead: words.bursaryWorkBack, text: b.workBack.terms }]
      : []),
  ];
}
