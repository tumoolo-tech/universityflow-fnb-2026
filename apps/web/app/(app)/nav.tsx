'use client';

import { nav } from '@universityflow/content';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Icon, type IconName } from '@/components/icons';
import { cx } from '@/components/ui';
import { api } from '@/lib/client/api';

/**
 * The signed-in pages, grouped by stage (A2-12, docs/design/README.md): Home and Chat first, then
 * School (Grade 10 to matric), then University, and at the foot About me, Get help and Sign out.
 */
const GROUPS: ReadonlyArray<{
  readonly id: 'main' | 'before' | 'university' | 'you';
  readonly label: string | null;
  readonly links: ReadonlyArray<readonly [string, string, IconName]>;
}> = [
  {
    id: 'main',
    label: null,
    links: [
      ['/home', nav.home, 'home'],
      ['/chat', nav.chat, 'chat'],
    ],
  },
  {
    id: 'before',
    label: nav.groups.before,
    links: [
      ['/results', nav.results, 'results'],
      ['/subjects', nav.subjects, 'subjects'],
      ['/applications', nav.applications, 'applications'],
      ['/funding', nav.funding, 'funding'],
      ['/goals', nav.goals, 'goal'],
      ['/documents', nav.documents, 'documents'],
    ],
  },
  {
    id: 'university',
    label: nav.groups.university,
    links: [
      ['/offers', nav.offers, 'offers'],
      ['/campus', nav.campus, 'campus'],
      ['/first-week', nav.firstWeek, 'first-week'],
      ['/modules', nav.modules, 'modules'],
    ],
  },
  {
    id: 'you',
    label: nav.groups.you,
    links: [
      ['/me', nav.me, 'person'],
      ['/help', nav.help, 'help'],
    ],
  },
];

/**
 * The signed-in header and nav. From a laptop's width, a sidebar that fits the screen without
 * scrolling (globals.css `.uf-nav-*`: 32px rows, 28px on a short screen). On a phone, the app's
 * name and a Menu: the same grouped list opens under it (a disclosure, so it pushes the page down
 * and needs no focus trap), and closes on Escape, on a second tap or on a page change.
 * The chat gets the screen's height back (the sideways row it replaced took a second header row).
 *
 * The Menu is a native `details` disclosure (A4-15): it opens from first paint, with no
 * JavaScript, where the old button waited 0.6 s for the page to hydrate. The `details` holds only
 * its summary; the nav panel after the row shows while it is open (globals.css, `:has`), so the
 * sidebar from a laptop's width is the same panel, always shown. Script only adds Escape and
 * closing on a page change. The row wraps: with wider text spacing at 320px the Menu drops under
 * the brand instead of pushing the row past the screen (A3-26).
 *
 * Labels and links never look alike: a group's name is small, uppercase, letter-spaced and muted
 * text (not focusable); a link is body-size ink with an icon, a hover fill, and the current page
 * a mauve pill.
 */
export function NavLinks({
  brand,
  cvLabel,
}: {
  brand?: ReactNode;
  /**
   * My CV's name, given only while the server's `UF_CV` switch is on (the layout reads it): the
   * link ends the University group (docs/design/mmereko-api-proposal.md §10.5). A prop, so the
   * CV's copy never joins every page's bundle.
   */
  cvLabel?: string | null | undefined;
}) {
  const groups = cvLabel
    ? GROUPS.map((group) =>
        group.id === 'university'
          ? { ...group, links: [...group.links, ['/cv', cvLabel, 'cv'] as const] }
          : group,
      )
    : GROUPS;
  const pathname = usePathname();
  const navId = useId();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  /** The page the menu was last closed for. */
  const shownFor = useRef(pathname);

  // A menu the learner opened before the page hydrated stays open (that is the point of A4-15).
  useEffect(() => {
    setOpen(menu.current?.open === true);
  }, []);

  // A tap on a link opens another page: the menu closes behind it.
  useEffect(() => {
    if (shownFor.current === pathname) return;
    shownFor.current = pathname;
    if (menu.current) menu.current.open = false;
  }, [pathname]);

  // Escape closes the open menu and puts focus back on its summary.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !menu.current) return;
      menu.current.open = false;
      setOpen(false);
      summary.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <div className="uf-sidebar-head mx-auto flex w-full max-w-page flex-wrap items-center justify-between gap-x-3 max-lg:px-4 max-lg:py-2 lg:mx-0">
        {brand}
        {/* Only the summary: the panel below shows while this is open (globals.css, web6). */}
        <details
          ref={menu}
          className="uf-menu group/menu ms-auto lg:hidden"
          onToggle={(e) => setOpen(e.currentTarget.open)}
        >
          <summary
            ref={summary}
            aria-controls={navId}
            className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full px-3 font-medium text-ink hover:bg-sunk [&::-webkit-details-marker]:hidden"
          >
            <Icon name="menu" className="size-5 group-open/menu:hidden" />
            <Icon name="close" className="hidden size-5 group-open/menu:block" />
            {nav.menu}
          </summary>
        </details>
      </div>
      <div
        className="uf-nav-panel uf-reveal mx-auto w-full max-w-page lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"
        data-testid="nav-panel"
      >
        <nav
          id={navId}
          aria-label={nav.label}
          className="uf-nav px-2 max-lg:max-h-[70dvh] max-lg:overflow-y-auto max-lg:pb-3 lg:flex lg:flex-1 lg:flex-col lg:px-3"
        >
          <div className="flex flex-col lg:flex-1">
            {groups.map((group) => (
              <div key={group.id} className="flex flex-col">
                {group.label ? (
                  // Text, not a label: a list named "University" would answer a page's own
                  // "University" field label too. Read in order, it still says what follows.
                  <p className="uf-nav-group">{group.label}</p>
                ) : null}
                <ul className="flex flex-col">
                  {group.links.map(([href, label, icon]) => {
                    const current = pathname === href || pathname.startsWith(`${href}/`);
                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          aria-current={current ? 'page' : undefined}
                          className={cx(
                            'uf-nav-link whitespace-nowrap no-underline',
                            current ? 'uf-pill-current font-bold' : 'text-ink hover:bg-sunk',
                          )}
                        >
                          <Icon name={icon} className="uf-nav-icon" />
                          {label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {/* Sign out sits at the foot, with About me and Get help. */}
                {group.id === 'you' ? <SignOutButton /> : null}
              </div>
            ))}
          </div>
        </nav>
      </div>
    </>
  );
}

/**
 * Sign out: a row like the nav's links, at its foot. Then the landing page, or where the server
 * says (the judge demo: its picker), only ever a path on this site.
 */
export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="uf-nav-link w-full cursor-pointer text-ink hover:bg-sunk"
      onClick={async () => {
        const { next } = await api<{ ok: boolean; next?: string }>('/api/auth/sign-out', {
          method: 'POST',
        });
        router.push(next && /^\/(?!\/)/.test(next) ? next : '/');
        router.refresh();
      }}
    >
      <Icon name="sign-out" className="uf-nav-icon" />
      {nav.signOut}
    </button>
  );
}
