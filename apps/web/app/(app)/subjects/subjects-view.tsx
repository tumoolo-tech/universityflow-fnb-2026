import { reportKinds, subjects as t, whatINeed } from '@universityflow/content';
import {
  filterDoors,
  goalStatusText,
  higherBarText,
  needsText,
  type SubjectsCourse,
  type SubjectsDoors,
  type SubjectsResponse,
  universityGroups,
} from '@universityflow/ui';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { CardArtLayers } from '@/components/card-art';
import { Icon } from '@/components/icons';
import { Badge, Button, Card, EmptyState, Notice, Page, panelLook, Select } from '@/components/ui';
import { UniversityName } from '@/components/university-mark';
import { subjectArt } from '@/lib/subject-art';

/** Two tiles a row on a phone, three from `sm`, in a card at most about 40rem wide. */
const SUBJECT_ART_SIZES = '(min-width: 40rem) 14rem, 50vw';

/**
 * My subjects (G10-4, planning.md §9 item 7; redesigned in round 2, the owner's approved
 * proposal). A server component with no JavaScript of its own: the verdict is never behind a
 * control; the university filter and "Try a different subject" are GET forms with a button (no
 * submit-on-change, WCAG 3.2.2); the course lists are native `details`. Courses are counted from
 * what the learner may see (hard rule 3), so before verification production says it can't check,
 * never "all open". Every number comes from packages/admissions; the motion is CSS, and drops to
 * nothing under reduced motion (globals.css, "My subjects").
 */
export function SubjectsView({
  data,
  university,
}: {
  data: SubjectsResponse;
  /** `?university=`: narrows the closed courses and the higher bar, never the verdict. */
  university?: string | null;
}) {
  const { report, doors } = data;
  if (!report || !doors) {
    return (
      <Page title={t.title} lead={t.intro}>
        <EmptyState action={{ href: '/documents', label: t.add }}>{t.none}</EmptyState>
      </Page>
    );
  }
  const chips = <Chips data={data} kind={report.kind} />;

  if (doors.status === 'unknown') {
    return (
      <Page title={t.title} lead={t.intro}>
        <Card aria-labelledby="subjects-yours" className="flex flex-col gap-3">
          <h2 id="subjects-yours" className="text-lg">
            {t.yours}
          </h2>
          {chips}
        </Card>
        <EmptyState>{t.unknown}</EmptyState>
        <HowItWorks />
      </Page>
    );
  }

  const shown = filterDoors(doors, university);
  const canTry = doors.swap.drop.length > 0 && doors.swap.take.length > 0;

  return (
    <Page title={t.title} lead={t.intro}>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card aria-labelledby="subjects-verdict" className="flex flex-col gap-4 lg:col-span-2">
          <h2 id="subjects-verdict" className="text-xl" data-testid="subjects-summary">
            {doors.status === 'open'
              ? t.allOpen(doors.checked)
              : t.someClosed(doors.closed, doors.checked)}
          </h2>
          <div className="flex flex-col gap-2">
            <div className="uf-meter" data-testid="subjects-meter" aria-hidden="true">
              <div
                className="uf-meter-fill"
                style={{ '--uf-meter-open': doors.open / doors.checked } as CSSProperties}
              />
            </div>
            <p className="text-sm text-muted">{t.meterLegend(doors.open, doors.closed)}</p>
          </div>
          {doors.goal ? <GoalRow goal={doors.goal} /> : null}
          <div className="flex flex-col gap-2">
            <h3 className="uf-caps text-sm text-muted">{t.yours}</h3>
            {chips}
          </div>
        </Card>

        <ByUniversity doors={doors} current={shown.university?.id ?? null} />
      </div>

      {doors.draft ? <Notice tone="warning">{t.draft}</Notice> : null}

      {doors.groups.length > 0 ? <ClosedCourses doors={doors} shown={shown} /> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {shown.higherBar.length > 0 ? <HigherBar courses={shown.higherBar} /> : null}
        {canTry ? <WhatIf doors={doors} university={shown.university?.id ?? null} /> : null}
      </div>

      {doors.status === 'some-closed' && !doors.whatIf ? <Notice>{t.talk}</Notice> : null}
      <HowItWorks />
    </Page>
  );
}

/** The confirmed subjects as chips, the report they come from, and how to put it right. */
function Chips({
  data,
  kind,
}: {
  data: SubjectsResponse;
  kind: NonNullable<SubjectsResponse['report']>['kind'];
}) {
  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="subjects-list">
        {data.subjects.map((s) => (
          // A small card per subject (cards9): its picture across the top, under the course
          // cards' scrim, and its name in the chip below the band. Decoration only.
          <li
            key={s.id}
            className="uf-course-card uf-subject-tile uf-course-card-band flex items-end rounded-md border border-line bg-surface px-2 pb-2"
          >
            {/* The neutral (sunk) chip: `surface` vanishes into its card (A3-31). */}
            <Badge>{s.name}</Badge>
            <CardArtLayers art={subjectArt(s.id)} sizes={SUBJECT_ART_SIZES} />
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">
        {t.fromReport(reportKinds[kind])}{' '}
        <Link href="/documents" className="inline-flex min-h-11 items-center">
          {t.notRight}
        </Link>
      </p>
    </>
  );
}

/** A course's name: a link to What I need when it can show the course, never a dead end. */
function CourseName({ course, children }: { course: SubjectsCourse; children?: ReactNode }) {
  return course.linkable ? (
    <Link
      href={`/results/what-i-need/${course.id}`}
      className="inline-flex min-h-11 flex-col justify-center"
    >
      {course.name}
      {children}
    </Link>
  ) : (
    <span className="inline-flex min-h-11 flex-col justify-center">
      <span>{course.name}</span>
      {children}
    </span>
  );
}

function GoalRow({ goal }: { goal: NonNullable<SubjectsDoors['goal']> }) {
  return (
    <div className={`${panelLook} flex flex-col gap-1 p-4`} data-testid="subjects-goal">
      <h3 className="uf-caps text-sm text-muted">{t.goalLabel}</h3>
      <p className="font-medium">{goal.course.name}</p>
      <p className="text-sm text-muted">
        <UniversityName name={goal.course.universityName} short={goal.course.universityShortName} />
      </p>
      <p>{goalStatusText(goal)}</p>
      {goal.course.linkable ? (
        <Link
          href={`/results/what-i-need/${goal.course.id}`}
          className="inline-flex min-h-11 items-center self-start"
        >
          {whatINeed.open}
        </Link>
      ) : null}
    </div>
  );
}

/** Six rows to compare side by side (a dropdown would show one at a time); each sets the filter. */
function ByUniversity({ doors, current }: { doors: SubjectsDoors; current: string | null }) {
  if (doors.byUniversity.length === 0) return null;
  return (
    <Card aria-labelledby="subjects-universities" className="flex flex-col gap-3">
      <h2 id="subjects-universities" className="text-lg">
        {t.byUniversityTitle}
      </h2>
      <ul className="flex flex-col divide-y divide-line">
        {doors.byUniversity.map((u) => (
          <li key={u.id}>
            <Link
              href={`/subjects?university=${u.id}#subjects-closes`}
              aria-current={u.id === current ? 'true' : undefined}
              className="uf-row flex min-h-11 flex-col justify-center rounded-sm px-2 py-2 no-underline hover:bg-sunk aria-[current=true]:bg-sunk"
            >
              <span className="text-ink underline underline-offset-4">
                <UniversityName name={u.name} short={u.shortName} />
              </span>
              <span className="text-sm text-muted">{t.universityClosed(u.closed, u.checked)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

type Shown = ReturnType<typeof filterDoors>;

/**
 * "Courses your subjects close", grouped by what they need: each group a native `details` whose
 * summary says what it needs and how many (no "Show": the chevron and the state say that). The
 * first group holding the learner's goal starts open (the owner's decision 4).
 */
function ClosedCourses({ doors, shown }: { doors: SubjectsDoors; shown: Shown }) {
  const goalId = doors.goal?.course.id;
  const goalGroup = shown.groups.findIndex((g) => g.programmes.some((p) => p.id === goalId));
  const at = shown.university;
  return (
    <Card
      aria-labelledby="subjects-closes-title"
      id="subjects-closes"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <h2 id="subjects-closes-title" className="text-lg">
          {at ? t.closesTitleAt(at.name) : t.closesTitle}
        </h2>
        <UniversityFilter doors={doors} current={at?.id ?? null} />
      </div>
      {at ? (
        <p className="text-sm text-muted">
          {t.showing(at.name)}{' '}
          <Link href="/subjects#subjects-closes" className="inline-flex min-h-11 items-center">
            {t.showAll}
          </Link>
        </p>
      ) : null}
      {shown.groups.length > 0 ? (
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {shown.groups.map((g, i) => (
            <li key={g.subjects.join('|')}>
              <details className="uf-door" open={i === goalGroup}>
                <summary className="uf-door-summary flex min-h-11 cursor-pointer list-none items-center gap-3 py-2 font-medium [&::-webkit-details-marker]:hidden">
                  <Icon name="chevron" className="uf-door-chevron size-5 shrink-0" />
                  <span>{t.needs(g.subjects.join(t.or))}</span>
                  <span className="ml-auto shrink-0 text-muted">
                    {at ? t.countAt(g.programmes.length, g.total) : t.count(g.total)}
                  </span>
                </summary>
                <div className="grid gap-4 pb-4 pl-8 lg:grid-cols-2">
                  {universityGroups(g.programmes).map((u) => (
                    <div key={u.universityName} className="flex flex-col gap-1">
                      <h3 className="uf-caps text-sm text-muted">
                        <UniversityName
                          name={u.universityName}
                          short={u.courses[0]?.universityShortName}
                        />
                      </h3>
                      <ul className="flex flex-col">
                        {u.courses.map((c) => (
                          <li key={c.id}>
                            <CourseName course={c}>
                              {c.alsoNeeds.length > 0 ? (
                                <span className="block text-sm text-muted">
                                  {t.alsoNeeds(needsText(c.alsoNeeds))}
                                </span>
                              ) : null}
                            </CourseName>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </details>
            </li>
          ))}
        </ul>
      ) : null}
      {shown.groups.length === 0 && at ? <p className="text-muted">{t.noneAt(at.name)}</p> : null}
    </Card>
  );
}

/** "Show courses at": a native select and a Show button, a GET form (no submit-on-change). */
function UniversityFilter({ doors, current }: { doors: SubjectsDoors; current: string | null }) {
  return (
    <form
      method="get"
      action="/subjects#subjects-closes"
      className="flex flex-wrap items-end gap-3"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="subjects-university" className="font-medium">
          {t.filterLabel}
        </label>
        <Select
          id="subjects-university"
          name="university"
          defaultValue={current ?? ''}
          className="w-auto"
        >
          <option value="">{t.allUniversities}</option>
          {doors.byUniversity.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
      </div>
      {doors.whatIf ? (
        // The what-if being looked at stays when the learner filters.
        <>
          <input type="hidden" name="drop" value={doors.whatIf.drop.id} />
          <input type="hidden" name="take" value={doors.whatIf.take.id} />
        </>
      ) : null}
      <Button type="submit" variant="secondary">
        {t.show}
      </Button>
    </form>
  );
}

/** Open, with a higher bar: each course with its reason, in the catalogue's numbers. */
function HigherBar({ courses }: { courses: Shown['higherBar'] }) {
  return (
    <Card aria-labelledby="subjects-higher" className="flex flex-col gap-3">
      <h2 id="subjects-higher" className="text-lg">
        {t.higherTitle}
      </h2>
      <p className="text-muted">{t.higherLead}</p>
      <ul className="flex flex-col gap-3">
        {courses.map((c) => (
          <li key={c.id} className="flex flex-col">
            <CourseName course={c}>
              <span className="block text-sm text-muted">{c.universityName}</span>
            </CourseName>
            {c.reasons.map((r) => (
              <span key={higherBarText(r)} className="text-sm">
                {higherBarText(r)}
              </span>
            ))}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * "Try a different subject": two native selects and a Check button, a GET form. The answer is
 * printed under it and the address lands on it (`#what-if`). The catalogue doesn't know which
 * combinations a school allows, so it says "if your school lets you", and talk to your school.
 */
function WhatIf({ doors, university }: { doors: SubjectsDoors; university: string | null }) {
  const asked = doors.whatIf;
  return (
    <Card aria-labelledby="subjects-what-if" className="flex flex-col gap-4">
      <h2 id="subjects-what-if" className="text-lg">
        {t.whatIfTitle}
      </h2>
      <p className="text-muted">{t.whatIfLead}</p>
      <form method="get" action="/subjects#what-if" className="flex flex-wrap items-end gap-3">
        <SubjectSelect
          id="subjects-drop"
          name="drop"
          label={t.dropLabel}
          options={doors.swap.drop}
          value={asked?.drop.id}
        />
        <SubjectSelect
          id="subjects-take"
          name="take"
          label={t.takeLabel}
          options={doors.swap.take}
          value={asked?.take.id}
        />
        {university ? <input type="hidden" name="university" value={university} /> : null}
        <Button type="submit" variant="secondary">
          {t.check}
        </Button>
      </form>
      {asked ? <WhatIfAnswer asked={asked} /> : null}
    </Card>
  );
}

function SubjectSelect({
  id,
  name,
  label,
  options,
  value,
}: {
  id: string;
  name: string;
  label: string;
  options: SubjectsDoors['swap']['drop'];
  value: string | undefined;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <Select id={id} name={name} defaultValue={value ?? options[0]?.id} className="w-auto">
        {options.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

function WhatIfAnswer({ asked }: { asked: NonNullable<SubjectsDoors['whatIf']> }) {
  const same = asked.opened.length === 0 && asked.closes.length === 0;
  return (
    <section
      id="what-if"
      aria-labelledby="subjects-what-if-result"
      className={`${panelLook} flex flex-col gap-2 p-4`}
    >
      <h3 id="subjects-what-if-result" className="font-bold">
        {t.whatIfHeading(asked.take.name, asked.drop.name)}
      </h3>
      <p>{t.whatIfVerdict(asked.closed, asked.checked)}</p>
      {asked.opened.length > 0 ? <p>{t.whatIfOpens(asked.opened.length)}</p> : null}
      {asked.closes.length > 0 ? (
        <>
          <p>{t.whatIfCloses(asked.closes.length)}</p>
          <ul className="flex flex-col">
            {asked.closes.map((c) => (
              <li key={c.id}>
                <CourseName course={c}>
                  <span className="block text-sm text-muted">{c.universityName}</span>
                </CourseName>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {same ? <p>{t.whatIfSame}</p> : null}
      <p className="text-sm text-muted">{t.reportUnchanged}</p>
      <Notice>{t.talk}</Notice>
    </section>
  );
}

/** The rest of the old lead, for whoever wants it. */
function HowItWorks() {
  return (
    <details className="uf-door">
      <summary className="uf-door-summary flex min-h-11 cursor-pointer list-none items-center gap-3 font-medium [&::-webkit-details-marker]:hidden">
        <Icon name="chevron" className="uf-door-chevron size-5 shrink-0" />
        {t.howItWorks}
      </summary>
      <p className="pb-2 pl-8 text-muted">{t.lead}</p>
    </details>
  );
}
