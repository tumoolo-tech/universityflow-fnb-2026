'use client';

import type { CampusTourArtifact, FirstWeekArtifact } from '@universityflow/agent';
import {
  campus as campusCopy,
  chat,
  common,
  type FirstWeekStep,
  firstWeek,
  SAFETY_TIPS,
  safety,
  safetyNotes,
} from '@universityflow/content';
import Link from 'next/link';
import { type ReactNode, useId } from 'react';
import { CallLink } from '@/components/place-links';
import { NoWarningLine, SafetyNotes } from '@/components/safety-notes';
import { Badge, Card, Checkbox, Notice, SourceLink } from '@/components/ui';
import { UniversityName } from '@/components/university-mark';
import { MobilityNote, PlaceWayfinding } from '@/components/wayfinding';
import { formatDate } from '@/lib/client/api';

/**
 * The campus tour, the first-week checklist and the safety guidance (Phase 5b), shared by the
 * chat's artifact panel and the pages; the crisis card's campus lines are in crisis-card.tsx.
 * Text first, links out: every map is the university's own or the phone's maps app (owner's
 * decisions 1 and 2), so no map tiles, no media and no extra origin. Nothing animates.
 */

/**
 * A link that leaves the app, saying so for screen readers. `context` (the place's name) goes into
 * the accessible name only, so a links list can tell 16 "Open in maps" apart (A3-19).
 */
function OutLink({
  href,
  children,
  context,
}: {
  href: string;
  children: ReactNode;
  context?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center"
    >
      {children}
      {context ? <span className="sr-only">: {context}</span> : null}
      <span className="sr-only"> {common.opensInNewTab}</span>
    </a>
  );
}

export function CampusTour({
  artifact,
  linkToPage,
}: {
  artifact: CampusTourArtifact;
  /** In the chat: a link to the My campus page. */
  linkToPage?: boolean;
}) {
  const t = campusCopy;
  const titleId = useId();
  return (
    <Card as="article" aria-labelledby={titleId} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        {/* One card-title size for every Phase 5 artifact, as offers and modules (A2-20). */}
        <h2 id={titleId} className="text-lg">
          <UniversityName name={artifact.universityName} />
        </h2>
        <p className="text-muted">
          {artifact.basis === 'accepted-offer'
            ? t.fromOffer(artifact.universityName)
            : t.exploring(artifact.universityName)}
        </p>
      </div>
      <NoWarningLine />
      {artifact.campuses.length === 0 ? (
        <Notice tone="info">{t.notCheckedYet}</Notice>
      ) : (
        <>
          <p className="text-sm text-muted">{t.checkOnSite}</p>
          <MobilityNote tour={artifact} />
          <SafetyNotes
            notes={artifact.universitySafetyNotes}
            universityName={artifact.universityName}
            title={safetyNotes.wholeUniversity}
            level={3}
          />
          {artifact.campuses.map((campus) => (
            <section
              key={campus.id}
              aria-label={t.campusOf(campus.name, campus.city)}
              className="flex flex-col gap-3 border-t border-line pt-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold">{t.campusOf(campus.name, campus.city)}</h3>
                {campus.draft ? <Badge tone="warning">{common.draftBadge}</Badge> : null}
              </div>
              <div className="flex flex-wrap gap-3">
                {campus.mapUrl ? <OutLink href={campus.mapUrl}>{t.officialMap}</OutLink> : null}
                {campus.virtualTourUrl ? (
                  <OutLink href={campus.virtualTourUrl}>{t.virtualTour}</OutLink>
                ) : null}
              </div>
              {campus.needs.length === 0 ? <p>{t.noPlaces}</p> : null}
              {campus.needs.map(({ need, places }) => (
                <div key={need} className="flex flex-col gap-2">
                  <h4 className="text-sm font-bold">{t.needs[need].title}</h4>
                  <p className="text-sm text-muted">{t.needs[need].lead}</p>
                  <ul className="flex flex-col gap-2">
                    {places.map((p) => (
                      <li
                        key={p.id}
                        className="flex flex-col gap-1 rounded-md bg-sunk p-3"
                        data-testid={`place-${p.id}`}
                      >
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="font-bold">{p.name}</span>
                          <Badge tone="surface">{t.kinds[p.kind]}</Badge>
                          {p.draft ? <Badge tone="warning">{common.draftBadge}</Badge> : null}
                        </p>
                        {/* No building published (A13-11): no "where" line, never an empty one. */}
                        {p.where ? (
                          <p className="text-sm">
                            {t.where}: {p.where}
                          </p>
                        ) : null}
                        {p.hours ? (
                          <p className="text-sm">
                            {t.hours}: {p.hours}
                          </p>
                        ) : null}
                        <PlaceWayfinding place={p} />
                        <div className="flex flex-wrap items-center gap-3">
                          {p.phone ? <CallLink phone={p.phone} label={p.name} /> : null}
                          {p.mapsUrl ? (
                            <OutLink href={p.mapsUrl} context={p.name}>
                              {t.openInMaps}
                            </OutLink>
                          ) : null}
                          <SourceLink href={p.sourceUrl} context={p.name} row />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <SafetyNotes
                notes={campus.safetyNotes}
                universityName={artifact.universityName}
                title={safetyNotes.campusTitle(campus.name)}
              />
            </section>
          ))}
          {artifact.campuses.some((c) =>
            c.needs.some((n) => n.need === 'health-and-safety'),
          ) ? null : (
            <p className="text-sm">{t.safetyNotChecked}</p>
          )}
        </>
      )}
      {artifact.beforeYouArrive ? (
        <SafetyGuidance title={t.beforeYouArriveTitle} lead={t.beforeYouArriveLead} />
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/first-week?university=${artifact.universityId}`}
          className="inline-flex min-h-11 items-center"
        >
          {t.firstWeekLink}
        </Link>
        {linkToPage ? (
          <Link href="/campus" className="inline-flex min-h-11 items-center">
            {chat.artifactOpen}: {t.title}
          </Link>
        ) : null}
      </div>
    </Card>
  );
}

/** The safety and scam guidance (§8.6), each tip as a short titled paragraph. */
export function SafetyGuidance({ title, lead }: { title: string; lead?: string }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2 border-t border-line pt-3">
      <h3 id={titleId} className="font-bold">
        {title}
      </h3>
      {lead ? <p className="text-muted">{lead}</p> : null}
      <ul className="flex flex-col gap-2">
        {SAFETY_TIPS.map((tip) => (
          <li key={tip}>
            <p className="font-bold">{safety.tips[tip].title}</p>
            <p>{safety.tips[tip].body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Where a step links to: My modules (5c) and the campus tour. */
const STEP_LINKS: Partial<Record<FirstWeekStep, { href: string; label: string }>> = {
  'check-modules': { href: '/modules', label: firstWeek.modulesLink },
  'clinic-and-security': { href: '/campus', label: firstWeek.campusLink },
};

export function FirstWeekCard({
  artifact,
  onToggle,
  busy,
  linkToPage,
}: {
  artifact: FirstWeekArtifact;
  /** On the page: ticks or unticks a step. Without it the steps are read-only (the chat). */
  onToggle?: (step: FirstWeekStep, done: boolean) => void;
  busy?: boolean;
  linkToPage?: boolean;
}) {
  const t = firstWeek;
  const titleId = useId();
  const done = artifact.steps.filter((s) => s.doneAt).length;
  const { calendar, facultyOffice } = artifact;
  const scope = (s: keyof typeof t.changeScopes) => t.changeScopes[s];
  return (
    <Card as="article" aria-labelledby={titleId} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className="text-lg">
          {t.title}: {artifact.universityName}
        </h2>
        <p className="font-bold" data-testid="first-week-progress">
          {t.progress(done, artifact.steps.length)}
        </p>
      </div>

      <section className="flex flex-col gap-1" aria-label={t.datesTitle}>
        <h3 className="font-bold">{t.datesTitle}</h3>
        {calendar ? (
          <>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
              {t.datesLead}
              {calendar.draft ? <Badge tone="warning">{common.draftBadge}</Badge> : null}
            </p>
            <ul className="flex flex-col gap-1">
              <li>
                {calendar.registration.from
                  ? t.registration(
                      formatDate(calendar.registration.from),
                      formatDate(calendar.registration.to),
                    )
                  : t.registrationCloses(formatDate(calendar.registration.to))}
              </li>
              {calendar.orientation ? (
                <li>
                  {t.orientation(
                    formatDate(calendar.orientation.from),
                    formatDate(calendar.orientation.to),
                  )}
                </li>
              ) : null}
              {calendar.changeDeadlines.length === 0 ? (
                <li>{t.changeDeadlineUnpublished}</li>
              ) : (
                calendar.changeDeadlines.map((d) => (
                  <li key={d.appliesTo}>
                    {t.changeDeadline(scope(d.appliesTo), formatDate(d.lastDay))}
                  </li>
                ))
              )}
            </ul>
            <div>
              <SourceLink href={calendar.sourceUrl} row />
            </div>
          </>
        ) : (
          <p>{t.noDates}</p>
        )}
      </section>

      <ol className="flex flex-col gap-3">
        {artifact.steps.map((step) => {
          const words = t.steps[step.id];
          const link = STEP_LINKS[step.id];
          const ticked = step.doneAt !== null;
          return (
            <li key={step.id} className="flex flex-col gap-1 rounded-md bg-sunk p-3">
              {onToggle ? (
                <label
                  htmlFor={`${titleId}-${step.id}`}
                  className="flex min-h-11 items-center gap-3 font-bold"
                >
                  {/* Busy: `aria-disabled`, never `disabled`, so the box keeps focus (A3-12). */}
                  <Checkbox
                    id={`${titleId}-${step.id}`}
                    checked={ticked}
                    aria-disabled={busy}
                    onChange={(e) => {
                      if (!busy) onToggle(step.id, e.target.checked);
                    }}
                  />
                  {words.title}
                </label>
              ) : (
                <p className="flex flex-wrap items-center gap-2 font-bold">
                  {words.title}
                  {ticked ? <Badge tone="success">{t.done}</Badge> : null}
                </p>
              )}
              <p className="text-sm">{words.detail}</p>
              {step.doneAt ? (
                <p className="text-sm text-muted">{t.doneOn(formatDate(step.doneAt))}</p>
              ) : null}
              {step.id === 'faculty-office' && facultyOffice ? (
                <div className="flex flex-col gap-1 text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-bold">
                    {t.facultyOfficeTitle}: {facultyOffice.faculty}
                    {facultyOffice.draft ? <Badge tone="warning">{common.draftBadge}</Badge> : null}
                  </p>
                  <p>
                    {campusCopy.where}: {facultyOffice.where}
                  </p>
                  {facultyOffice.hours ? (
                    <p>
                      {campusCopy.hours}: {facultyOffice.hours}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-3">
                    {facultyOffice.phone ? <CallLink phone={facultyOffice.phone} /> : null}
                    {facultyOffice.email ? (
                      <a
                        href={`mailto:${facultyOffice.email}`}
                        className="inline-flex min-h-11 items-center"
                      >
                        {t.email(facultyOffice.email)}
                      </a>
                    ) : null}
                    <OutLink href={facultyOffice.contactUrl}>{t.contactPage}</OutLink>
                  </div>
                </div>
              ) : null}
              {link ? (
                <Link href={link.href} className="inline-flex min-h-11 items-center text-sm">
                  {link.label}
                </Link>
              ) : null}
            </li>
          );
        })}
      </ol>

      <SafetyGuidance title={t.safetyTitle} />
      <SafetyNotes
        notes={artifact.safetyNotes}
        universityName={artifact.universityName}
        title={safetyNotes.title(artifact.universityName)}
        level={3}
      />
      <NoWarningLine />
      {linkToPage ? (
        <Link href="/first-week" className="inline-flex min-h-11 items-center">
          {chat.artifactOpen}: {t.title}
        </Link>
      ) : null}
    </Card>
  );
}
