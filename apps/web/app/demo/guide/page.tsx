import { demo as demoCopy, demoPersonas, en } from '@universityflow/content';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteFooter } from '@/components/site-footer';
import { Button, Card, Page, PublicPage } from '@/components/ui';
import { DEMO_PERSONAS } from '@/lib/server/demo/personas';
import { isDemo } from '@/lib/server/deployment';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: demoPersonas.guide.title };

/**
 * The judges' three-minute guide (docs/audits/results/DEMO-walk.md), linked from the picker: what
 * is made up or a stand-in, then for each made-up learner two to four things to try and the same
 * start button as the picker (a plain form posting to /api/demo/start, so it works before any
 * script loads). Not found anywhere but a demo; it reads nothing about the visitor.
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
              {guide.honest.map((line) => (
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
                    {guide.tries[p.id].map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ol>
                  <form action="/api/demo/start" method="post">
                    <input type="hidden" name="persona" value={p.id} />
                    <Button type="submit" className="w-full">
                      {demoCopy.tryAs(p.name)}
                    </Button>
                  </form>
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
