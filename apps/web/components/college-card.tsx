import type { CollegeOption, CollegeOptions } from '@universityflow/admissions';
import { common, colleges as words } from '@universityflow/content';
import { Badge, Card, SourceLink } from '@/components/ui';
import { DEMO_COLLEGE_LOGOS, DEMO_LOGOS_ON, type DemoLogo } from '@/lib/demo-logos';
import { UniversityMark } from './university-mark';

/**
 * One public TVET college in Plan B (planning.md §19.1): its courses for this learner, each with
 * the verdict packages/admissions decided ("you meet the minimum the college prints", or "check
 * the entry rule") and the college's own words and links. Never a verdict code didn't decide.
 *
 * No 'use client': rendered on the server like every results card (A4-03). The college's mark is
 * our neutral one; its own logo shows only on the judge demo (lib/demo-logos.ts).
 */
export function CollegeCard({
  options,
  entries = {},
  demoLogos = DEMO_LOGOS_ON ? DEMO_COLLEGE_LOGOS : null,
}: {
  /** One college's options, in the order packages/admissions sorted them. */
  options: ReadonlyArray<CollegeOption>;
  /**
   * Where each programme type starts, from the catalogue's record (collegeOptions' `entries`,
   * A1-84). A type without one shows its name alone, never a usual grade.
   */
  entries?: CollegeOptions['entries'] | undefined;
  /** For tests only: the judge demo's college logos. */
  demoLogos?: Readonly<Record<string, DemoLogo>> | null;
}) {
  const [first] = options;
  if (!first) return null;
  const headingId = `c-${first.collegeId}`;
  const logo = demoLogos?.[first.collegeId];
  return (
    <Card as="li" className="flex flex-col gap-3" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">
          <span className="uf-university">
            <UniversityMark
              name={first.collegeShortName}
              demoLogos={logo ? { [first.collegeShortName]: logo } : null}
            />
            {words.badge}
          </span>
        </Badge>
        {options.some((o) => o.draft || entries[o.type]?.draft) ? (
          <Badge tone="warning">{common.draftBadge}</Badge>
        ) : null}
      </div>
      <h3 id={headingId} className="text-lg">
        {first.collegeName}
      </h3>
      <p className="text-sm text-muted">
        {first.mainTown ? words.where(first.mainTown, first.province) : first.province} ·{' '}
        {words.courses(options.length)}
      </p>
      <ul className="flex flex-col gap-3">
        {options.map((o) => {
          const entry = entries[o.type];
          const type = entry
            ? `${words.programmeTypes[o.type]}: ${words.programmeTypeEntry(entry.afterGrade, entry.orAfter)}`
            : words.programmeTypes[o.type];
          return (
            <li key={o.programmeId} className="flex flex-col gap-1 border-t border-line pt-3">
              <p className="font-medium">
                {o.nameAtCollege} <span className="text-sm text-muted">({type})</span>
              </p>
              <p>
                <Badge tone={o.verdict === 'meets-minimum' ? 'success' : 'info'}>
                  {words.verdicts[o.verdict]}
                </Badge>
              </p>
              <p className="text-sm">
                {o.verdict === 'meets-minimum' ? words.meetsNote : words.checkNote}
              </p>
              {o.entryQuote && o.entryQuoteUrl ? (
                <figure className="flex flex-col gap-1 text-sm">
                  <figcaption className="font-medium">{words.ruleLabel}</figcaption>
                  <blockquote cite={o.entryQuoteUrl} className="border-l-rule border-line pl-3">
                    {o.entryQuote}
                  </blockquote>
                  <SourceLink href={o.entryQuoteUrl} context={o.nameAtCollege} />
                </figure>
              ) : (
                <p className="text-sm">{words.noRule}</p>
              )}
              {o.campuses ? (
                <p className="text-sm">
                  <span className="font-medium">{words.campuses}: </span>
                  {o.campuses.join(', ')}
                </p>
              ) : null}
              <p className="text-sm text-muted">
                {o.yearPrinted === null ? words.noYear : words.yearPrinted(o.yearPrinted)}
              </p>
              <SourceLink href={o.sourceUrl} context={o.nameAtCollege} row>
                {words.coursePage}
              </SourceLink>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        {first.applyUrl ? (
          <SourceLink href={first.applyUrl} context={first.collegeName} row>
            {words.apply}
          </SourceLink>
        ) : null}
        {first.website ? (
          <SourceLink href={first.website} context={first.collegeName} row>
            {words.website}
          </SourceLink>
        ) : null}
      </div>
    </Card>
  );
}
