import { demo as demoCopy, demoPersonas, en } from '@universityflow/content';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DemoStartForm } from '@/components/demo-start-form';
import { SiteFooter } from '@/components/site-footer';
import { Card, Page, PublicPage } from '@/components/ui';
import { DEMO_PERSONAS } from '@/lib/server/demo/personas';
import { isDemo } from '@/lib/server/deployment';
import { pageMetadata } from '@/lib/server/seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = pageMetadata({
  path: '/demo/guide',
  title: demoPersonas.guide.title,
  description: demoPersonas.guide.description,
});

/** Since module cards shipped (A6-06): a learner's further tries, after their first ones. */
const MORE_TRIES: Partial<Record<string, ReadonlyArray<string>>> = demoPersonas.guide.moreTries;

/**
 * The judges' three-minute guide (docs/audits/results/DEMO-walk.md), linked from the picker: what
 * is made up or a stand-in, then for each made-up learner two to four things to try and the same
 * start button as the picker (`DemoStartForm`: a plain form posting to /api/demo/start, so it works
 * before any script loads). Not found anywhere but a demo; it reads nothing about the visitor.
 */
export default async function DemoGuidePage() {
  if (!isDemo()) notFound();
  const guide = demoPersonas.guide;
  return (
    <>
      <PublicPage width="wide" brand={{ name: en.app.name, href: '/' }}>
        <Page title={guide.title} lead={guide.lead}>
          <Card aria-labelledby="guide-honest" className="flex flex-col gap-3">
            <h2 id="guide-honest" className="text-lg">
              {guide.honestTitle}
            </h2>
            <ul className="flex max-w-prose list-disc flex-col gap-2 pl-5">
              {guide.honestNow.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Card>

          <section aria-labelledby="guide-tries" className="flex flex-col gap-4">
            <h2 id="guide-tries" className="text-xl">
              {guide.triesTitle}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {DEMO_PERSONAS.map((p) => (
                <Card key={p.id} aria-labelledby={`guide-${p.id}`} className="flex flex-col gap-3">
                  <div>
                    <h3 id={`guide-${p.id}`} className="text-lg">
                      {guide.personaHeading(p.name, p.stage)}
                    </h3>
                    {p.university ? <p className="text-muted">{p.university}</p> : null}
                  </div>
                  <ol className="flex flex-1 list-decimal flex-col gap-2 pl-5">
                    {[...guide.tries[p.id], ...(MORE_TRIES[p.id] ?? [])].map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ol>
                  <DemoStartForm
                    persona={p.id}
                    label={demoCopy.tryAs(p.name)}
                    startingLabel={demoCopy.startingAs(p.name)}
                    startingNote={demoCopy.startingNote}
                  />
                </Card>
              ))}
            </div>
          </section>

          <Link href="/demo" className="inline-flex min-h-11 items-center self-start font-medium">
            {guide.back}
          </Link>
        </Page>
      </PublicPage>
      <SiteFooter width="wide" />
    </>
  );
}
