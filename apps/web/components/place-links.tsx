import { dialable } from '@universityflow/catalogue/client';
import { campus as campusCopy, common } from '@universityflow/content';
import { useId } from 'react';
import { ButtonLink } from '@/components/ui';

/**
 * The call and maps links a campus place or a crisis line carries. No `'use client'`: they need no
 * browser JavaScript, so a server page (Get help) can render the crisis card without the chat's
 * artifact code, and the client components (the campus tour, wayfinding) share them.
 */

const t = campusCopy;

/** Calls a number; `label` (the place's name) goes into the accessible name only. */
export function CallLink({ phone, label }: { phone: string; label?: string }) {
  return (
    <ButtonLink
      href={`tel:${dialable(phone)}`}
      aria-label={label ? `${t.call(phone)}: ${label}` : undefined}
    >
      {t.call(phone)}
    </ButtonLink>
  );
}

/** One maps link, named for the place it goes to (A3-19), with the hint. */
export function MapsButton({
  href,
  label,
  place,
  hintId,
}: {
  href: string;
  label: string;
  place: string;
  hintId?: string;
}) {
  return (
    <ButtonLink
      href={href}
      variant="secondary"
      newTab
      aria-label={`${t.forPlace(label, place)} ${common.opensInNewTab}`}
      aria-describedby={hintId}
    >
      {label}
    </ButtonLink>
  );
}

/** Walk there on a crisis card's campus line. */
export function CrisisWalk({ walkUrl, place }: { walkUrl: string; place: string }) {
  const hintId = useId();
  return (
    <>
      <span id={hintId} className="sr-only">
        {t.walkHint}
      </span>
      <MapsButton href={walkUrl} label={t.walkThere} place={place} hintId={hintId} />
    </>
  );
}
