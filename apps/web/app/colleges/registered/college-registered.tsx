import { type CollegeView, collegeName, type RegistrationCheck } from '@universityflow/catalogue';
import { DHET_COLLEGE_LIST } from '@universityflow/catalogue/colleges';
import { en, colleges as words } from '@universityflow/content';
import Link from 'next/link';
import { SiteFooter } from '@/components/site-footer';
import { Badge, Button, Input, Notice, SourceLink } from '@/components/ui';

/** The longest name the box takes: a college's name, never a paragraph. */
export const MAX_QUERY = 120;

/** The page itself, from a view and a check: what test/college-registered.test.tsx renders. */
export function CollegeRegistered({
  view,
  query,
  check,
}: {
  view: CollegeView;
  query: string | null;
  check: RegistrationCheck | null;
}) {
  const c = words.check;
  return (
    <>
      <main id="main" className="mx-auto flex max-w-prose flex-col gap-6 px-5 py-10">
        <Link href="/" className="text-lg font-bold no-underline">
          {en.app.name}
        </Link>
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl">{c.title}</h1>
          <p>{c.lead}</p>
        </header>
        {view.includesDrafts ? <Badge tone="warning">{c.draftNotice}</Badge> : null}
        <form method="get" action="/colleges/registered" className="flex flex-col gap-2">
          <label htmlFor="college-name" className="font-medium">
            {c.label}
          </label>
          <p id="college-name-hint" className="text-sm text-muted">
            {c.hint}
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              id="college-name"
              name="name"
              type="search"
              maxLength={MAX_QUERY}
              defaultValue={query ?? ''}
              aria-describedby="college-name-hint"
              autoComplete="off"
              className="min-w-0 flex-1"
            />
            <Button type="submit">{c.submit}</Button>
          </div>
        </form>
        <section aria-live="polite" className="flex flex-col gap-4">
          {check ? <Outcome check={check} /> : null}
        </section>
        <section aria-labelledby="dhet-links" className="flex flex-col gap-2">
          <h2 id="dhet-links" className="text-xl">
            {c.dhetTitle}
          </h2>
          <p className="text-sm text-muted">
            {c.source(
              DHET_COLLEGE_LIST.title,
              DHET_COLLEGE_LIST.datePrinted,
              DHET_COLLEGE_LIST.count,
            )}
          </p>
          <ul className="flex flex-col gap-1">
            <li>
              <SourceLink href={DHET_COLLEGE_LIST.tvetCollegesPage} row>
                {c.dhetTvet}
              </SourceLink>
            </li>
            <li>
              <SourceLink href={DHET_COLLEGE_LIST.registersPage} row>
                {c.dhetRegisters}
              </SourceLink>
            </li>
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function Outcome({ check }: { check: RegistrationCheck }) {
  const c = words.check;
  switch (check.status) {
    case 'empty':
      return <p className="text-muted">{c.empty}</p>;
    case 'unavailable':
      return <Notice tone="warning">{c.unavailable}</Notice>;
    case 'listed':
      return (
        <Notice tone="success" title={c.listed(collegeName(check.college))}>
          <p>{c.listedAs(check.college.dhetName, check.college.province)}</p>
          <p>{c.listedNote}</p>
          {check.college.site?.website ? (
            <p>
              <SourceLink href={check.college.site.website} context={collegeName(check.college)}>
                {words.website}
              </SourceLink>
            </p>
          ) : null}
        </Notice>
      );
    case 'not-found':
      return (
        <>
          <Notice tone="danger" title={c.notFound(check.query.trim())}>
            <p>{c.notFoundWarning}</p>
          </Notice>
          {check.similar.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="font-medium">{c.similar}</p>
              <ul className="flex list-disc flex-col gap-1 pl-6">
                {check.similar.map((college) => (
                  <li key={college.id}>
                    {college.dhetName} ({college.province})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      );
  }
}
