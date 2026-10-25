import { en } from '@universityflow/content';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Card, EmptyState, Page } from '@/components/ui';
import { UniversityName } from '@/components/university-mark';
import { formatDate } from '@/lib/client/api';
import { applicationSummaries } from '@/lib/server/applications';
import { learnerPlace } from '@/lib/server/learner-place';
import { getServices } from '@/lib/server/services';
import { readyStudent } from '@/lib/server/session';

export const metadata: Metadata = { title: en.applications.title };

/** Stage 2: the application tracker. */
export default async function ApplicationsPage() {
  const signed = await readyStudent();
  const { catalogue } = await getServices();
  const view = catalogue();
  const [{ applications }, place] = await Promise.all([
    applicationSummaries(signed.student, view),
    learnerPlace(signed.student, view),
  ]);

  return (
    <Page title={en.applications.title} lead={en.applications.lead}>
      {applications.length === 0 && place.stage === 'university' ? (
        // Already at university: nothing to shortlist or apply for (A2-68).
        <EmptyState action={{ href: '/modules', label: en.applications.atUniversityAction }}>
          {en.applications.atUniversity}
        </EmptyState>
      ) : applications.length === 0 ? (
        <EmptyState action={{ href: '/results', label: en.dashboard.shortlist.browse }}>
          {en.applications.empty}
        </EmptyState>
      ) : (
        <ul className="grid gap-6 md:grid-cols-2">
          {applications.map((a) => {
            const done = a.checklist.filter((c) => c.done).length;
            return (
              <Card as="li" key={a.university.id} aria-labelledby={`app-${a.university.id}`}>
                <div className="flex flex-col gap-2">
                  <h2 id={`app-${a.university.id}`} className="text-lg">
                    <UniversityName name={a.university.name} short={a.university.shortName} />
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="info">{en.applications.statuses[a.status]}</Badge>
                    <Badge>{en.applications.choices(a.programmes.length)}</Badge>
                    {a.window ? (
                      <Badge tone="warning">
                        {en.applications.closes(formatDate(a.window.closesOn))}
                      </Badge>
                    ) : null}
                  </div>
                  <p>
                    {en.applications.checklist}: {done}/{a.checklist.length}
                  </p>
                  <Link
                    href={`/applications/${a.university.id}`}
                    className="inline-flex min-h-11 items-center"
                  >
                    {en.applications.pack}
                  </Link>
                </div>
              </Card>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
