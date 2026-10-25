import {
  applications as applicationsCopy,
  common,
  dashboard,
  offers as offersCopy,
  results as resultsCopy,
  subjects as subjectsCopy,
} from '@universityflow/content';
import { type HomeData, homeJourney, journeyStepName, type Verdict } from '@universityflow/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatDate } from '@/lib/client/api';
import { Avatar, lookStyle } from './avatar';
import { GradeCheck } from './grade-check';
import { Icon } from './icons';
import { MarksChart } from './marks-chart';
import { Badge, ButtonLink, buttonLook, Card, cx, Notice, PageHeader } from './ui';
import { UniversityName } from './university-mark';

/**
 * The signed-in home (docs/design/README.md): a dashboard of the learner's own numbers and lists,
 * modelled on a finance dashboard but in the app's own theme. A server component: no JavaScript.
 * Every card shows what `homeData` found, or an honest "not yet" line; nothing is invented.
 */

const VERDICT: Record<Verdict, { label: string; tone: 'success' | 'warning' | 'info' }> = {
  qualifyNow: { label: resultsCopy.groups.qualifyNow, tone: 'success' },
  onTrack: { label: resultsCopy.groups.onTrack, tone: 'success' },
  close: { label: resultsCopy.groups.close, tone: 'warning' },
  planB: { label: resultsCopy.groups.planB, tone: 'info' },
};

function Panel({
  id,
  title,
  children,
  action,
  className,
}: {
  id: string;
  title: string;
  children: ReactNode;
  action?: { href: string; label: string };
  className?: string;
}) {
  return (
    <Card aria-labelledby={id} className={cx('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-2">
        <h2 id={id} className="text-lg">
          {title}
        </h2>
        {action ? (
          <Link href={action.href} className="-my-2.5 inline-flex min-h-11 items-center text-sm">
            {action.label}
          </Link>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

function nextText(next: HomeData['next']): string {
  return next.id === 'checklist'
    ? dashboard.next.checklist(next.universityName)
    : dashboard.next[next.id];
}

/** A second or later year at university (A2-66): past the arrival's first weeks. */
function laterYear(data: HomeData): 'middle' | 'final' | null {
  const group = data.universityYear?.group;
  return group === 'middle' || group === 'final' ? group : null;
}

export function Dashboard({ data }: { data: HomeData }) {
  const university = data.stage === 'university';
  const later = laterYear(data);
  return (
    <div className="flex flex-col gap-6">
      {/* The page's header (PageHeader, the 8px under the title every page has, A2-23), and beside it the two icon links. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title={
            data.name ? (
              <>
                {dashboard.welcomeBefore}
                <span className="text-accent">{data.name}</span>
              </>
            ) : (
              dashboard.welcome('')
            )
          }
          lead={later ? dashboard.subtitleYears[later] : dashboard.subtitle[data.stage]}
        />
        <div className="flex gap-2">
          <Link
            href="/me"
            aria-label={dashboard.reminders}
            title={dashboard.reminders}
            className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink hover:bg-sunk"
          >
            <Icon name="bell" />
          </Link>
          {/* The learner's own avatar, in their theme (the About me card); still named "About me". */}
          <Link
            href="/me"
            aria-label={dashboard.aboutMe}
            title={dashboard.aboutMe}
            className="inline-flex size-11 items-center justify-center rounded-full"
            style={lookStyle(data.look.theme)}
          >
            <Avatar avatar={data.look.avatar} name={data.name} marker="home" className="size-11" />
          </Link>
        </div>
      </div>

      {data.gradeCheck ? <GradeCheck grade={data.gradeCheck.grade} /> : null}

      {data.turningEighteen ? (
        <section aria-labelledby="home-turning-eighteen">
          <Notice>
            <h2 id="home-turning-eighteen" className="mb-1 text-lg">
              {dashboard.turningEighteen.title(formatDate(data.turningEighteen.on))}
            </h2>
            <p>{dashboard.turningEighteen.lead}</p>
          </Notice>
        </section>
      ) : null}

      <Journey data={data} />

      <Link
        href="/chat"
        className="flex min-h-12 items-center gap-3 rounded-full border-thick border-line-strong bg-surface px-5 text-muted no-underline hover:border-brand"
      >
        <Icon name="chat" className="size-6 shrink-0 text-brand" />
        <span className="flex-1">{dashboard.ask}</span>
        <Icon name="arrow" className="size-5 shrink-0 text-brand" />
      </Link>

      <section aria-labelledby="home-next">
        <h2 id="home-next" className="sr-only">
          {dashboard.next.label}
        </h2>
        {/* The whole row is one link: what to do, and a visible "Start". */}
        <Link
          href={data.next.href}
          className="group flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line border-l-rule border-l-accent bg-surface p-4 text-ink no-underline hover:border-line-strong"
        >
          <span className="flex flex-col">
            <span aria-hidden="true" className="uf-caps text-muted">
              {dashboard.next.label}
            </span>
            <span className="text-lg font-bold">{nextText(data.next)}</span>
          </span>
          {/* The outline button's look on a span (the whole row is the link, A2-22). */}
          <span className={cx(buttonLook('secondary'), 'group-hover:border-brand')}>
            {dashboard.next.start}
            <Icon name="arrow" className="size-5" />
          </span>
        </Link>
      </section>

      {later ? (
        // A second or final year (A2-66): their year and this year's modules, never the
        // arrival's registration countdown, campus tour, offer and first-week steps.
        <div className="uf-settle grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <YearCard data={data} />
          <PromoCard data={data} />
          <ThisYearPanel data={data} />
          {data.marks.length > 0 ? (
            <MarksChart points={data.marks} subjectNames={data.subjectNames} />
          ) : null}
        </div>
      ) : (
        <div className="uf-settle grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {university ? <RegistrationCard data={data} /> : <QualifyCard data={data} />}
          <PromoCard data={data} />
          {university ? <OffersPanel data={data} /> : <ShortlistPanel data={data} />}
          {university ? (
            <GettingReadyPanel data={data} />
          ) : data.stage === 'grade-10' ? (
            <SubjectsPanel data={data} />
          ) : (
            <ApplicationsPanel data={data} />
          )}
          {/* School marks: at university only with a school report to show (A2-66). */}
          {university && data.marks.length === 0 ? null : (
            <MarksChart points={data.marks} subjectNames={data.subjectNames} />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The stage's steps (`homeJourney`): an ordered list, each step's state in words. Every step is
 * the same box: on a phone a row each (number, name, state), from a tablet's width an equal
 * column each across the whole row (number on top, then the name and state, centred), so the
 * strip never wraps unevenly and "Applications" fits beside the sidebar. The same name style for
 * every step; the number's colour and the word under the name say the state; only the current
 * step has the mauve edge and is a link.
 */
/** One equal column per step from a tablet's width (two in a second or final year, A2-66). */
const JOURNEY_COLUMNS: Readonly<Record<number, string>> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
};

function Journey({ data }: { data: HomeData }) {
  const t = dashboard.journey;
  const steps = homeJourney(data);
  return (
    <section aria-labelledby="home-journey">
      <h2 id="home-journey" className="sr-only">
        {t.label}
      </h2>
      <ol
        className={cx('grid grid-cols-1 gap-2', JOURNEY_COLUMNS[steps.length] ?? 'md:grid-cols-5')}
        data-testid="home-journey"
      >
        {steps.map((step, index) => {
          const current = step.status === 'current';
          const box = cx(
            'flex h-full min-h-14 items-center gap-3 rounded-lg border bg-surface px-3 py-2 md:flex-col md:justify-center md:gap-1.5 md:py-3 md:text-center',
            current ? 'border-brand' : 'border-line',
          );
          const label = (
            <>
              <span
                aria-hidden="true"
                className={cx(
                  'inline-flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                  step.status === 'done' && 'bg-success-soft text-success',
                  current && 'bg-brand text-on-brand',
                  step.status === 'todo' && 'border border-line-strong text-muted',
                )}
              >
                {index + 1}
              </span>
              <span className="flex min-w-0 flex-col leading-tight md:items-center">
                <span className="font-medium text-ink">{journeyStepName(step)}</span>
                <span className="text-sm text-muted">{t.status[step.status]}</span>
              </span>
            </>
          );
          return (
            <li key={step.id} aria-current={current ? 'step' : undefined}>
              {current ? (
                <Link href={step.href} className={cx(box, 'no-underline hover:bg-sunk')}>
                  {label}
                </Link>
              ) : (
                <div className={box}>{label}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * The headline number on a dark card with a soft mauve glow (GLASS_PAIRS: haze over surface).
 * Its text link takes the accent itself; an outline button in it stays calm, as everywhere (A2-21).
 */
function HeadlineCard({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Card glow aria-labelledby={id} className="flex flex-col gap-3 text-ink">
      <h2 id={id} className="uf-caps text-muted">
        {title}
      </h2>
      {children}
    </Card>
  );
}

function QualifyCard({ data }: { data: HomeData }) {
  const t = dashboard.qualify;
  // Grade 10 marks: "on track", and no Plan B (G10-3); before a report, the stage says (G10-5).
  const grade10 = data.qualify ? data.qualify.basis === 'progress' : data.stage === 'grade-10';
  return (
    <HeadlineCard id="home-qualify" title={grade10 ? t.titleGrade10 : t.title}>
      {data.qualify?.checked === 0 ? (
        // No course to check the marks against: never a "0" that isn't true (A1-41).
        <p>{subjectsCopy.card.unknown}</p>
      ) : data.qualify ? (
        <>
          <p className="uf-number" data-testid="home-number">
            {grade10 ? data.qualify.onTrack : data.qualify.now}
          </p>
          <p className="text-muted">
            {t.close(data.qualify.close)}
            {grade10 ? null : <> · {t.planB(data.qualify.planB)}</>}
          </p>
          <Link href="/results" className="inline-flex min-h-11 items-center text-accent">
            {t.open}
          </Link>
        </>
      ) : (
        <>
          <p className="text-muted">{t.none}</p>
          <div className="mt-auto">
            <ButtonLink href="/documents" variant="secondary">
              {t.add}
            </ButtonLink>
          </div>
        </>
      )}
      {data.nextPaperDays !== null ? (
        <p className="font-bold" data-testid="home-next-paper">
          {dashboard.nextPaper(data.nextPaperDays)}
        </p>
      ) : null}
    </HeadlineCard>
  );
}

function RegistrationCard({ data }: { data: HomeData }) {
  const t = dashboard.registration;
  const r = data.registration;
  return (
    <HeadlineCard id="home-registration" title={t.title}>
      {r && !(r.phase === 'closes' && r.days === 0) ? (
        <p className="flex flex-wrap items-baseline gap-3">
          <span className="uf-number" data-testid="home-number">
            {r.days}
          </span>
          <span className="text-muted">
            {r.phase === 'opens' ? t.opens(r.days) : t.closes(r.days)}
          </span>
        </p>
      ) : r ? (
        <p className="text-lg font-bold">{t.closes(0)}</p>
      ) : (
        <p className="text-muted">{t.none}</p>
      )}
    </HeadlineCard>
  );
}

/**
 * A second or final year's headline (A2-66): the year of study they confirmed, and "Your final
 * year" when the course's duration in the catalogue says so (labelled when not yet verified).
 */
function YearCard({ data }: { data: HomeData }) {
  const t = dashboard.year;
  const year = data.universityYear;
  return (
    <HeadlineCard id="home-year" title={t.title}>
      <p className="uf-number" data-testid="home-number">
        {year?.yearOfStudy}
      </p>
      {year?.group === 'final' ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold">{t.final}</p>
          {year.draft ? <Badge tone="warning">{common.draftBadge}</Badge> : null}
        </div>
      ) : null}
    </HeadlineCard>
  );
}

/** A second or final year's modules (A2-66), in place of "Getting ready". */
function ThisYearPanel({ data }: { data: HomeData }) {
  const t = dashboard.gettingReady;
  return (
    <Panel
      id="home-this-year"
      title={dashboard.thisYear.title}
      className="md:col-span-2 xl:col-span-1"
    >
      <div className="flex flex-col gap-1 rounded-md bg-sunk p-3">
        <p className="text-sm text-muted">{t.modules}</p>
        {data.modules ? (
          <>
            <Link href="/modules" className="uf-number" data-testid="home-modules">
              {data.modules.confirmed}
            </Link>
            {data.modules.checked ? (
              <p className="text-sm">
                {data.modules.toFix > 0 ? t.modulesToFix(data.modules.toFix) : t.modulesMatch}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p>{t.modulesNone}</p>
            <div>
              <ButtonLink href="/modules" variant="secondary">
                {t.modulesAction}
              </ButtonLink>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}

/** The promo card's words and link for where the learner is. */
function promo(data: HomeData): { title: string; lead: string; href: string; action: string } {
  const t = dashboard.promo;
  // A second or final year plans the rest of the degree: the campus tour is an arrival's (A2-66).
  if (laterYear(data)) {
    return { title: t.planTitle, lead: t.planLead, href: '/goals', action: t.planAction };
  }
  if (data.stage === 'university') {
    return { title: t.campusTitle, lead: t.campusLead, href: '/campus', action: t.campusAction };
  }
  return data.goalProgrammeId
    ? {
        title: t.goalTitle,
        lead: t.goalLead,
        href: `/results/what-i-need/${data.goalProgrammeId}`,
        action: t.goalAction,
      }
    : { title: t.goalTitle, lead: t.goalLead, href: '/goals', action: t.chooseGoalAction };
}

function PromoCard({ data }: { data: HomeData }) {
  const { title, lead, href, action } = promo(data);
  return (
    <Card aria-labelledby="home-promo" className="flex flex-col justify-between gap-4">
      <div className="flex flex-col gap-2">
        <h2 id="home-promo" className="text-lg">
          {title}
        </h2>
        <p>{lead}</p>
      </div>
      <div>
        <ButtonLink href={href}>{action}</ButtonLink>
      </div>
    </Card>
  );
}

function ShortlistPanel({ data }: { data: HomeData }) {
  const t = dashboard.shortlist;
  return (
    <Panel
      id="home-shortlist"
      title={t.title}
      {...(data.shortlist.length > 0 ? { action: { href: '/results', label: t.open } } : {})}
      className="md:col-span-2 xl:col-span-1"
    >
      {data.shortlist.length === 0 ? (
        <>
          <p className="text-muted">{t.empty}</p>
          <div className="mt-auto">
            <ButtonLink href="/results" variant="secondary">
              {t.browse}
            </ButtonLink>
          </div>
        </>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {data.shortlist.map((row) => (
            <li
              key={row.programmeId}
              className="flex flex-wrap items-center justify-between gap-2 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium">{row.name}</p>
                <p className="text-sm text-muted">
                  <UniversityName name={row.universityName} />
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {row.verdict ? (
                  <Badge tone={VERDICT[row.verdict].tone}>{VERDICT[row.verdict].label}</Badge>
                ) : (
                  <Badge>{t.unchecked}</Badge>
                )}
                {row.draft ? <Badge tone="warning">{common.draftBadge}</Badge> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ApplicationsPanel({ data }: { data: HomeData }) {
  const t = dashboard.applications;
  return (
    <Panel
      id="home-applications"
      title={t.title}
      {...(data.applications.length > 0
        ? { action: { href: '/applications', label: t.open } }
        : {})}
      className="md:col-span-2 xl:col-span-3"
    >
      {data.applications.length === 0 ? (
        <>
          <p className="text-muted">{t.empty}</p>
          <div>
            <ButtonLink href="/applications" variant="secondary">
              {t.how}
            </ButtonLink>
          </div>
        </>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.applications.map((a) => (
            <li key={a.universityId} className="flex flex-col gap-2 rounded-md bg-sunk p-3">
              <Link href={`/applications/${a.universityId}`} className="font-bold">
                <UniversityName name={a.universityName} />
              </Link>
              <div className="flex flex-wrap gap-2">
                <Badge tone="surface">
                  {applicationsCopy.statuses[a.status as keyof typeof applicationsCopy.statuses] ??
                    a.status}
                </Badge>
              </div>
              <p className="text-sm">{t.checklist(a.done, a.total)}</p>
              {a.closesOn ? (
                <p className="text-sm">{applicationsCopy.closes(formatDate(a.closesOn))}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/**
 * Grade 10 (G10-4): what the confirmed report's subjects keep open, in place of the applications
 * (two years away). With no report the headline card already offers to add one, so this card
 * says "not yet" alone (one action per empty card, never the same twice).
 */
function SubjectsPanel({ data }: { data: HomeData }) {
  const t = subjectsCopy.card;
  const s = data.subjects;
  return (
    <Panel
      id="home-subjects"
      title={t.title}
      {...(s ? { action: { href: '/subjects', label: t.action } } : {})}
      className="md:col-span-2 xl:col-span-3"
    >
      {!s ? (
        <p className="text-muted">{t.none}</p>
      ) : s.status === 'unknown' ? (
        <p className="text-muted">{t.unknown}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold" data-testid="home-subjects">
            {s.status === 'some-closed' ? t.closed(s.closed) : t.open}
          </p>
          {s.draft ? <Badge tone="warning">{common.draftBadge}</Badge> : null}
        </div>
      )}
    </Panel>
  );
}

function OffersPanel({ data }: { data: HomeData }) {
  const t = dashboard.offers;
  return (
    <Panel
      id="home-offers"
      title={t.title}
      {...(data.offers.length > 0 ? { action: { href: '/offers', label: t.open } } : {})}
      className="md:col-span-2 xl:col-span-1"
    >
      {data.offers.length === 0 ? (
        <>
          <p className="text-muted">{t.empty}</p>
          <div className="mt-auto">
            <ButtonLink href="/offers" variant="secondary">
              {t.add}
            </ButtonLink>
          </div>
        </>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {data.offers.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="font-medium">{o.programme?.name ?? o.universityName}</p>
                <p className="text-sm text-muted">
                  <UniversityName name={o.universityName} />
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone={o.status === 'accepted' ? 'success' : 'neutral'}>
                  {offersCopy.statuses[o.status]}
                </Badge>
                <Badge>{offersCopy.kinds[o.offerKind]}</Badge>
                {o.programme?.draft ? <Badge tone="warning">{common.draftBadge}</Badge> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function GettingReadyPanel({ data }: { data: HomeData }) {
  const t = dashboard.gettingReady;
  const accepted = data.offers.find((o) => o.status === 'accepted');
  return (
    <Panel id="home-ready" title={t.title} className="md:col-span-2 xl:col-span-3">
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <li className="flex flex-col gap-1 rounded-md bg-sunk p-3 sm:col-span-2 xl:col-span-1">
          <p className="text-sm text-muted">{t.offer}</p>
          {accepted ? (
            <p className="font-bold">
              {accepted.programme?.name ?? accepted.universityName} · {accepted.universityName}
            </p>
          ) : (
            <p>{dashboard.offers.empty}</p>
          )}
        </li>
        <li className="flex flex-col gap-1 rounded-md bg-sunk p-3">
          <p className="text-sm text-muted">{t.firstWeek}</p>
          {data.firstWeek ? (
            <Link href="/first-week" className="uf-number" data-testid="home-first-week">
              {t.firstWeekValue(data.firstWeek.done, data.firstWeek.total)}
            </Link>
          ) : (
            <p>{t.firstWeekNone}</p>
          )}
        </li>
        <li className="flex flex-col gap-1 rounded-md bg-sunk p-3">
          <p className="text-sm text-muted">{t.modules}</p>
          {data.modules ? (
            <>
              <Link href="/modules" className="uf-number" data-testid="home-modules">
                {data.modules.confirmed}
              </Link>
              {data.modules.checked ? (
                <p className="text-sm">
                  {data.modules.toFix > 0 ? t.modulesToFix(data.modules.toFix) : t.modulesMatch}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p>{t.modulesNone}</p>
              <div>
                <ButtonLink href="/modules" variant="secondary">
                  {t.modulesAction}
                </ButtonLink>
              </div>
            </>
          )}
        </li>
      </ul>
    </Panel>
  );
}
