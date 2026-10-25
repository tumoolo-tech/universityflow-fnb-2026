// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { en } from '@universityflow/content';
import { hydrateRoot } from 'react-dom/client';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The signed-in nav (A2-12, docs/design/README.md): 13 links grouped by stage, a sidebar from a
 * laptop's width. On a phone the same list sits behind a Menu button, so the header is one row
 * and the chat keeps the screen (it was a sideways row under the header).
 */

let pathname = '/offers';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const { NavLinks } = await import('../app/(app)/nav');

const CSS = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');
/** Below a laptop's width, the panel hides while the header's Menu is closed (globals.css). */
const MENU_RULE =
  /@media \(width < 64rem\)\s*\{\s*\.uf-sidebar:not\(:has\(\.uf-menu\[open\]\)\) \.uf-nav-panel\s*\{\s*display: none;/;

beforeEach(() => {
  pathname = '/offers';
});

afterEach(cleanup);

/** The Menu: a `summary` (no ARIA role of its own to query by; it says expanded or collapsed). */
const menu = () => {
  const summary = screen.getByText(en.nav.menu).closest('summary');
  if (!summary) throw new Error('no summary');
  return summary;
};
const isOpen = () => menu().closest('details')?.open === true;
/** A tap on the summary: the browser toggles its details (jsdom may not, so it is done here). */
async function tap() {
  const details = menu().closest('details');
  if (!details) throw new Error('no details');
  const was = details.open;
  fireEvent.click(menu());
  if (details.open === was) details.open = !was;
  // The toggle event is queued; let it run.
  await act(async () => {
    details.dispatchEvent(new Event('toggle'));
  });
}

describe('the nav (A2-12)', () => {
  it('lists every page, the current one marked', () => {
    render(<NavLinks />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(14);
    expect(screen.getByRole('link', { name: en.nav.offers }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(screen.getAllByRole('link', { current: 'page' })).toHaveLength(1);
  });

  it('starts with Home, groups the rest by stage, and ends with About me and Get help', () => {
    render(<NavLinks />);
    expect(screen.getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual([
      '/home',
      '/chat',
      '/results',
      '/subjects',
      '/applications',
      '/funding',
      '/goals',
      '/documents',
      '/offers',
      '/campus',
      '/first-week',
      '/modules',
      '/me',
      '/help',
    ]);
    // Each group's name comes right before its list.
    const group = (name: string) => screen.getByText(name).nextElementSibling?.textContent;
    expect(group(en.nav.groups.before)).toBe(
      [
        en.nav.results,
        en.nav.subjects,
        en.nav.applications,
        en.nav.funding,
        en.nav.goals,
        en.nav.documents,
      ].join(''),
    );
    expect(group(en.nav.groups.university)).toBe(
      [en.nav.offers, en.nav.campus, en.nav.firstWeek, en.nav.modules].join(''),
    );
    expect(group(en.nav.groups.you)).toBe([en.nav.me, en.nav.help].join(''));
    // Never a label: a list named "University" would answer a page's own "University" field.
    expect(screen.queryByLabelText(en.nav.groups.university)).toBeNull();
  });

  it('marks Home current on the home, and a page under a section as that section', () => {
    pathname = '/home';
    render(<NavLinks />);
    expect(screen.getByRole('link', { name: en.nav.home }).getAttribute('aria-current')).toBe(
      'page',
    );
    cleanup();
    pathname = '/applications/uj';
    render(<NavLinks />);
    expect(
      screen.getByRole('link', { name: en.nav.applications }).getAttribute('aria-current'),
    ).toBe('page');
  });

  it('never makes a group name look or act like a link: plain text, styled as a label', () => {
    render(<NavLinks />);
    for (const name of [en.nav.groups.before, en.nav.groups.university, en.nav.groups.you]) {
      const label = screen.getByText(name);
      expect(label.tagName).toBe('P');
      expect(label.closest('a, button')).toBeNull();
      expect(label.getAttribute('tabindex')).toBeNull();
      expect(label.className).toContain('uf-nav-group');
      // Shown wherever the list is, the phone's menu too.
      expect(label.className).not.toContain('hidden');
    }
  });

  it('gives every link a hidden icon, Sign out a row at the foot, and keeps the names', () => {
    render(<NavLinks />);
    for (const link of screen.getAllByRole('link')) {
      expect(link.className).toContain('uf-nav-link');
      const icon = link.querySelector('svg');
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
    }
    expect(screen.getByRole('link', { name: en.nav.firstWeek })).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: en.nav.label });
    const signOut = screen.getByRole('button', { name: en.nav.signOut });
    expect(nav.contains(signOut)).toBe(true);
    expect(signOut.className).toContain('uf-nav-link');
  });

  it('adds My CV at the end of the University group only when the server switch is on (§10.5)', () => {
    render(<NavLinks />);
    expect(screen.queryByRole('link', { name: en.cv.title })).toBeNull();
    cleanup();
    pathname = '/cv';
    render(<NavLinks cvLabel={en.cv.title} />);
    const link = screen.getByRole('link', { name: en.cv.title });
    expect(link.getAttribute('href')).toBe('/cv');
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(link.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    const group = screen.getByText(en.nav.groups.university).nextElementSibling;
    expect(group?.lastElementChild?.contains(link)).toBe(true);
  });

  it('shows the brand it is given beside the Menu button', () => {
    render(<NavLinks brand={<a href="/home">{en.app.name}</a>} />);
    const brand = screen.getByRole('link', { name: en.app.name });
    expect(brand.parentElement?.contains(menu())).toBe(true);
  });
});

describe('the phone menu', () => {
  // A4-15: the Menu was a React button, dead until the page hydrated (0.62–0.67 s after first
  // paint on slow 4G). A `details` disclosure opens with no JavaScript at all.
  it('is a native disclosure that opens the nav with no JavaScript (A4-15)', () => {
    const html = renderToStaticMarkup(<NavLinks />);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const details = doc.querySelector('details');
    expect(details).not.toBeNull();
    expect(details?.hasAttribute('open')).toBe(false);
    const summary = details?.querySelector(':scope > summary');
    expect(summary?.textContent).toBe(en.nav.menu);
    const nav = doc.querySelector(`nav[aria-label="${en.nav.label}"]`);
    expect(summary?.getAttribute('aria-controls')).toBe(nav?.id);
    // The panel is hidden by CSS that follows the disclosure's own state, never by a class
    // only a script could take away.
    const panel = doc.querySelector('[data-testid="nav-panel"]');
    expect(panel?.className).not.toMatch(/(^|\s)(max-lg:)?hidden(\s|$)/);
    expect(panel?.className).toContain('uf-nav-panel');
    expect(MENU_RULE.test(CSS)).toBe(true);
  });

  it('keeps open a menu tapped open before the page hydrated (A4-15)', async () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(<NavLinks />);
    document.body.append(container);
    // The learner opens it from first paint, with no JavaScript yet.
    const details = container.querySelector('details');
    if (!details) throw new Error('no details');
    details.open = true;
    const root = await act(async () => hydrateRoot(container, <NavLinks />));
    try {
      expect(details.open).toBe(true);
      // Escape works on it once the script is there.
      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });
      expect(details.open).toBe(false);
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it('starts closed on a phone; the summary is the phone’s only, from a laptop’s width the sidebar shows', () => {
    render(<NavLinks />);
    expect(isOpen()).toBe(false);
    expect(menu().closest('details')?.className).toContain('lg:hidden');
    expect(menu().closest('details')?.className).toContain('uf-menu');
    expect(screen.getByTestId('nav-panel').className).toContain('lg:flex');
  });

  it('opens and closes on a tap, saying so through its state, not its name', async () => {
    render(<NavLinks />);
    await tap();
    expect(isOpen()).toBe(true);
    await tap();
    expect(isOpen()).toBe(false);
  });

  it('closes on Escape and puts focus back on the summary', async () => {
    render(<NavLinks />);
    await tap();
    screen.getByRole('link', { name: en.nav.campus }).focus();
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(isOpen()).toBe(false);
    expect(document.activeElement).toBe(menu());
  });

  it('ignores other keys, and Escape when it is closed', async () => {
    render(<NavLinks />);
    await tap();
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(isOpen()).toBe(true);
    await tap();
    screen.getByRole('link', { name: en.nav.campus }).focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(screen.getByRole('link', { name: en.nav.campus }));
  });

  it('closes when the page changes', async () => {
    const { rerender } = render(<NavLinks />);
    await tap();
    expect(isOpen()).toBe(true);
    pathname = '/campus';
    rerender(<NavLinks />);
    expect(isOpen()).toBe(false);
    expect(screen.getByRole('link', { name: en.nav.campus }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  // A3-26 (1.4.12): at 320px with wider text spacing the brand and Menu row scrolled sideways
  // 15px. The row now wraps: when both don't fit, the Menu drops under the brand, still at the
  // row's end, instead of past the screen's edge.
  it('lets the brand and the Menu wrap rather than push past a narrow screen (A3-26)', () => {
    render(<NavLinks brand={<a href="/home">{en.app.name}</a>} />);
    const head = screen.getByRole('link', { name: en.app.name }).parentElement;
    expect(head?.className).toMatch(/(^|\s)flex-wrap(\s|$)/);
    expect(menu().closest('details')?.className).toMatch(/(^|\s)ms-auto(\s|$)/);
  });

  it('lets a long list scroll inside the open menu, never the page sideways', () => {
    render(<NavLinks />);
    const nav = screen.getByRole('navigation', { name: en.nav.label });
    expect(nav.className).toContain('max-lg:overflow-y-auto');
    expect(nav.className).not.toContain('overflow-x-auto');
  });
});
