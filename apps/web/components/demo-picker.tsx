import { demo as copy, demoPersonas } from '@universityflow/content';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { DemoPersonaCard } from '@/lib/server/demo/types';
import { DemoStartForm } from './demo-start-form';
import { Card, Notice, Page, PublicPage } from './ui';

/** Why the last start was refused; `setup`: the server refuses the demo's configuration. */
export type DemoStatus = 'busy' | 'unavailable' | 'setup';

/** `/demo?demo=busy`, `unavailable` or `setup` (the start route's redirect), else nothing. */
export function demoStatus(value: string | string[] | undefined): DemoStatus | null {
  return value === 'busy' || value === 'unavailable' || value === 'setup' ? value : null;
}

const STATUS_WORDS: Record<DemoStatus, string> = {
  busy: copy.busy,
  unavailable: copy.unavailable,
  setup: copy.notSetUp,
};

/**
 * Judge demo mode's front door (docs/deploy/demo.md), on `/` and `/sign-in`: "Try UniversityFlow
 * as…" and one card per made-up learner. Each card is a plain form posting its persona to
 * /api/demo/start, which makes a private copy and redirects to /home, so the first press works
 * before any script loads. No phone field anywhere.
 */
export function DemoPicker({
  personas,
  status = null,
  brand,
  children,
}: {
  personas: ReadonlyArray<DemoPersonaCard>;
  /** Why the last start was refused, from `/demo?demo=…`, or the demo isn't set up. */
  status?: DemoStatus | null;
  /** The app's name over the page, as on every public page. */
  brand?: { readonly name: string; readonly href?: string } | undefined;
  /** More ways in after the learners (the judges' own sign-up, the phone sign-up), one gap apart. */
  children?: ReactNode;
}) {
  return (
    <PublicPage width="wide" brand={brand}>
      <Page title={copy.pickerTitle} lead={copy.pickerLead}>
        <div className="flex flex-col gap-2">
          <p className="max-w-prose text-muted">{copy.judgesLine}</p>
          {/* The judges' three-minute guide (DEMO-walk): what to try as each learner. */}
          <p>
            <Link href="/demo/guide" className="inline-flex min-h-11 items-center font-medium">
              {demoPersonas.guide.pickerLink}
            </Link>
          </p>
        </div>
        {status ? <Notice tone="danger">{STATUS_WORDS[status]}</Notice> : null}
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {personas.map((p) => (
            <Card as="li" key={p.id} className="flex flex-col gap-3">
              <div>
                <h2 className="text-lg">{p.name}</h2>
                <p className="text-muted">
                  {p.university ? `${p.stage} · ${p.university}` : p.stage}
                </p>
              </div>
              <p className="flex-1">
                <span className="font-semibold">{copy.tryThisLabel}: </span>
                {p.tryThis}
              </p>
              <DemoStartForm
                persona={p.id}
                label={copy.tryAs(p.name)}
                startingLabel={copy.startingAs(p.name)}
                startingNote={copy.startingNote}
              />
            </Card>
          ))}
        </ul>
        {children}
      </Page>
    </PublicPage>
  );
}
