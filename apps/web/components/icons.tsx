import type { ReactNode } from 'react';

/**
 * Simple stroke icons, drawn for the split stage and the home (docs/design/README.md). Decoration
 * only: always `aria-hidden`, beside a visible label or inside a link named by its text or
 * `aria-label`. They take the text colour (`currentColor`), so they follow every theme and
 * forced-colours mode.
 */

export type IconName =
  | 'results'
  | 'subjects'
  | 'applications'
  | 'funding'
  | 'campus'
  | 'goal'
  | 'first-week'
  | 'modules'
  | 'offers'
  | 'documents'
  | 'chat'
  | 'bell'
  | 'person'
  | 'shield'
  | 'heart'
  | 'arrow'
  | 'home'
  | 'help'
  | 'sign-out'
  | 'alert'
  | 'menu'
  | 'close'
  | 'chevron'
  | 'cv';

const PATHS: Record<IconName, ReactNode> = {
  // A report card with a tick.
  results: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6" />
      <path d="m9 16 2 2 4-4" />
    </>
  ),
  // An open book.
  subjects: (
    <>
      <path d="M12 6.5c-2.2-1.6-5.2-2.1-8-1.6v13c2.8-.5 5.8 0 8 1.6 2.2-1.6 5.2-2.1 8-1.6v-13c-2.8-.5-5.8 0-8 1.6Z" />
      <path d="M12 6.5v13" />
    </>
  ),
  // A paper going into an envelope.
  applications: (
    <>
      <path d="M3 9.5 12 15l9-5.5" />
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V4h8v3" />
    </>
  ),
  // A banknote.
  funding: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.75" />
      <path d="M6 9.5v5M18 9.5v5" />
    </>
  ),
  // A building with columns.
  campus: (
    <>
      <path d="M3 9 12 4l9 5" />
      <path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8" />
      <path d="M3 20h18" />
    </>
  ),
  // A target.
  goal: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.75" />
    </>
  ),
  // A calendar with a tick.
  'first-week': (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="m9 15 2 2 4-4" />
    </>
  ),
  // Stacked books.
  modules: (
    <>
      <rect x="4" y="4" width="16" height="5" rx="1" />
      <rect x="4" y="10" width="16" height="5" rx="1" />
      <rect x="4" y="16" width="16" height="4" rx="1" />
    </>
  ),
  // An open letter with a star.
  offers: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="m3 8 9 6 9-6" />
      <path d="m12 2.5.9 1.9 2 .2-1.5 1.4.4 2-1.8-1-1.8 1 .4-2L9.1 4.6l2-.2Z" />
    </>
  ),
  // A page with a folded corner.
  documents: (
    <>
      <path d="M6 3h8l4 4v14H6Z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </>
  ),
  // A speech bubble.
  chat: (
    <>
      <path d="M4 5h16v11H9l-5 4Z" />
      <path d="M8 9.5h8M8 12.5h5" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  heart: (
    <path d="M12 20s-7.5-4.6-7.5-10A4.25 4.25 0 0 1 12 7.5 4.25 4.25 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z" />
  ),
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  // A house.
  home: <path d="M4 11 12 4l8 7M6.5 9.5V20h11V9.5M10 20v-5h4v5" />,
  // Three lines: the phone's menu, closed.
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  // A cross: the phone's menu, open.
  close: <path d="m6 6 12 12M18 6 6 18" />,
  // A chevron pointing right: a disclosure, closed (it turns down when open, in CSS).
  chevron: <path d="m9 6 6 6-6 6" />,
  // A lifebuoy.
  help: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="m6 6 3.5 3.5M18 6l-3.5 3.5M6 18l3.5-3.5M18 18l-3.5-3.5" />
    </>
  ),
  // A warning triangle.
  alert: (
    <>
      <path d="M12 4 2.5 20h19Z" />
      <path d="M12 10v4.5M12 17.5v.01" />
    </>
  ),
  // A door with an arrow leaving it.
  'sign-out': (
    <>
      <path d="M14 4H6v16h8" />
      <path d="M10 12h10m-3-3 3 3-3 3" />
    </>
  ),
  // A page with a head and shoulders at the top, and lines under them: a CV.
  cv: (
    <>
      <path d="M6 3h12v18H6Z" />
      <circle cx="12" cy="8" r="2" />
      <path d="M8.5 13a3.5 3.5 0 0 1 7 0M9 16.5h6M9 19h4" />
    </>
  ),
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'size-6 shrink-0'}
    >
      {PATHS[name]}
    </svg>
  );
}
