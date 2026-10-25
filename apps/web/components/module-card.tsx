import { common, moduleCard, modules } from '@universityflow/content';
import type { ModuleCardView, SourceView } from '@universityflow/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge, Card, Notice, SourceLink } from '@/components/ui';

/**
 * A module card (Phase 6c), rendered on the server from `moduleCardView` (packages/ui): How marks
 * work, Dates, Books and Who teaches it. Every value and its wording was decided by code and
 * packages/content; this only lays them out. The calculator is the one client part (`calculator`).
 * Nothing animates.
 *
 * `picture`: the slot for the picture behind the card. Integrator: `<CardArtLayers>` and
 * `moduleArt` from branch `phase-5/more-card-pictures` go here once the owner approves it; the
 * card renders the same without it.
 */
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3" data-testid={id}>
      <h2 id={id} className="text-lg">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Source({ source, context }: { source: SourceView; context: string }) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
      <span>{source.text}</span>
      {source.checked ? <span>{source.checked}</span> : null}
      {source.draft ? <Badge tone="warning">{common.draftBadge}</Badge> : null}
      {source.url ? <SourceLink href={source.url} context={context} /> : null}
    </p>
  );
}

export function ModuleCard({
  view,
  calculator,
  picture,
}: {
  view: ModuleCardView;
  calculator: ReactNode;
  /** The picture behind the card: see the file comment. */
  picture?: ReactNode;
}) {
  const { how, dates, books, people } = view;
  return (
    <div className="flex flex-col gap-6">
      {picture ?? null}
      {view.sampleNotice ? <Notice tone="warning">{view.sampleNotice}</Notice> : null}
      {view.previewNotice ? <Notice tone="warning">{view.previewNotice}</Notice> : null}

      <Card className="flex flex-col gap-4">
        <Section id="card-how" title={how.title}>
          <p className="text-sm text-muted">{how.lead}</p>
          <dl className="flex flex-col gap-3">
            {how.rows.map((row) => (
              <div key={row.id} className="flex flex-col gap-1" data-testid={`card-how-${row.id}`}>
                <dt className="font-medium">{row.label}</dt>
                <dd className="flex flex-col gap-1">
                  {row.lines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                  {row.source ? <Source source={row.source} context={row.label} /> : null}
                  {row.conflict ? (
                    <span className="rounded-md border-l-rule border-warning bg-warning-soft p-2 text-sm">
                      <strong>{row.conflict.text}</strong> {row.conflict.other}
                      {row.conflict.source.url ? (
                        <>
                          {' '}
                          <SourceLink href={row.conflict.source.url} context={row.label} />
                        </>
                      ) : null}
                    </span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
          {how.otherRules.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="font-bold">{moduleCard.how.otherRulesTitle}</h3>
              <ul className="flex flex-col gap-2">
                {how.otherRules.map((r) => (
                  <li key={`${r.source.text}:${r.quote}`} className="flex flex-col gap-1">
                    <q>{r.quote}</q>
                    <Source source={r.source} context={view.code} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Section>
      </Card>

      <Card className="flex flex-col gap-4">{calculator}</Card>

      <Card className="flex flex-col gap-4">
        <Section id="card-dates" title={dates.title}>
          {dates.outline ? (
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted">{dates.outline.source}</p>
              <ul className="flex flex-col gap-1">
                {dates.outline.items.map((d) => (
                  <li key={`${d.label}:${d.date}`} className="flex flex-wrap items-center gap-2">
                    <span>
                      {d.label}: {d.date}
                    </span>
                    {d.past ? <Badge>{modules.deadlinePassed}</Badge> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {dates.calendar ? (
            <div className="flex flex-col gap-2">
              <Source source={dates.calendar.source} context={dates.title} />
              {dates.calendar.groups.map((g) => (
                <div key={g.label} className="flex flex-col gap-1">
                  <h3 className="font-medium">{g.label}</h3>
                  <ul className="flex flex-col gap-1 text-sm">
                    {g.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
          {dates.none ? <p>{dates.none}</p> : null}
        </Section>
      </Card>

      <Card className="flex flex-col gap-4">
        <Section id="card-books" title={books.title}>
          {books.outline.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {books.outline.map((b) => (
                <li key={`${b.role}:${b.title}`} className="flex flex-col gap-0.5">
                  <span>
                    <Badge>{b.role}</Badge> <span className="font-medium">{b.title}</span>
                  </span>
                  {b.details.length > 0 ? (
                    <span className="text-sm text-muted">{b.details.join(' · ')}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {books.outlineNote ? <p>{books.outlineNote}</p> : null}
          {books.addOutline ? (
            <p>
              <Link href="/modules/outline" className="inline-flex min-h-11 items-center">
                {books.addOutline}
              </Link>
            </p>
          ) : null}
          <div className="flex flex-col gap-2" data-testid="card-free-books">
            <h3 className="font-bold">{books.free.title}</h3>
            <p className="text-sm text-muted">{books.free.lead}</p>
            {books.free.books.map((b) => (
              <div key={b.url} className="flex flex-col gap-1 rounded-md bg-sunk p-3">
                <p className="flex flex-wrap items-center gap-2">
                  <Badge tone="info">{b.label}</Badge>
                  {b.draft ? <Badge tone="warning">{common.draftBadge}</Badge> : null}
                </p>
                <a href={b.url} target="_blank" rel="noopener noreferrer">
                  {b.link}
                  <span className="sr-only"> {common.opensInNewTab}</span>
                </a>
                <p className="text-sm text-muted">{b.details.join(' · ')}</p>
              </div>
            ))}
            {books.free.none ? <p>{books.free.none}</p> : null}
            <p className="text-sm text-muted">{books.free.onlyLegal}</p>
          </div>
          {books.library ? (
            <div className="flex flex-col gap-1">
              <ul className="flex flex-col gap-1">
                {books.library.links.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer">
                      {l.label}
                      <span className="sr-only"> {common.opensInNewTab}</span>
                    </a>
                    {books.library?.draft ? (
                      <>
                        {' '}
                        <Badge tone="warning">{common.draftBadge}</Badge>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted">{books.library.note}</p>
            </div>
          ) : null}
          {books.noLibrary ? <p className="text-sm">{books.noLibrary}</p> : null}
        </Section>
      </Card>

      <Card className="flex flex-col gap-4">
        <Section id="card-people" title={people.title}>
          {people.source ? <p className="text-sm text-muted">{people.source}</p> : null}
          {people.people.map((p) => (
            <div key={p.name} className="flex flex-col gap-1">
              <p className="font-medium">
                {p.name}
                {p.role ? <span className="font-normal text-muted">, {p.role}</span> : null}
              </p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                {p.details.map((d) => (
                  <div key={d.label} className="contents">
                    <dt className="font-medium">{d.label}</dt>
                    <dd>{d.href ? <a href={d.href}>{d.value}</a> : d.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
          {people.notPublished ? <p>{people.notPublished}</p> : null}
          {people.askOffice && people.office ? (
            <div className="flex flex-col gap-1" data-testid="card-office">
              <p>
                {people.askOffice}
                {people.office.draft ? (
                  <>
                    {' '}
                    <Badge tone="warning">{common.draftBadge}</Badge>
                  </>
                ) : null}
              </p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="font-medium">{modules.where}</dt>
                <dd>{people.office.where}</dd>
                {people.office.hours ? (
                  <>
                    <dt className="font-medium">{modules.hours}</dt>
                    <dd>{people.office.hours}</dd>
                  </>
                ) : null}
                {people.office.email ? (
                  <>
                    <dt className="font-medium">{modules.email}</dt>
                    <dd>
                      <a href={`mailto:${people.office.email}`}>{people.office.email}</a>
                    </dd>
                  </>
                ) : null}
              </dl>
              <p>
                <a href={people.office.contactUrl} target="_blank" rel="noopener noreferrer">
                  {modules.contactPage}
                  <span className="sr-only"> {common.opensInNewTab}</span>
                </a>
              </p>
            </div>
          ) : null}
          {people.noOffice ? <p className="text-sm">{people.noOffice}</p> : null}
        </Section>
      </Card>
    </div>
  );
}
