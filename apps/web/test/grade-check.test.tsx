// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { en } from '@universityflow/content';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from '../components/dashboard';
import type { HomeData } from '../lib/server/home';

/**
 * G10-1: the grade moves up each school year, and each January the home asks "Are you in Grade N
 * now?". Yes records it afresh (PATCH /api/me); No goes to About me's grade. Synthetic data only.
 */

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  refresh.mockReset();
});

const t = en.dashboard.gradeCheck;

const home = (gradeCheck: HomeData['gradeCheck']): HomeData => ({
  stage: 'grade-11',
  name: null,
  qualify: null,
  nextPaperDays: null,
  subjects: null,
  gradeCheck,
  turningEighteen: null,
  goalProgrammeId: null,
  shortlist: [],
  applications: [],
  universityYear: null,
  offers: [],
  registration: null,
  firstWeek: null,
  modules: null,
  marks: [],
  subjectNames: {},
  look: { theme: 'mauve', avatar: 'initials' },
  next: { id: 'add-report', href: '/documents' },
});

describe('the January grade check on the home (G10-1)', () => {
  it('asks once the grade has moved up; yes records it and says so where focus was (A3-29)', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ profile: {} }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    render(<Dashboard data={home({ grade: 11 })} />);
    const card = screen.getByRole('region', { name: t.title(11) });
    expect(within(card).getByText(t.lead)).toBeTruthy();
    expect(within(card).getByRole('link', { name: t.change }).getAttribute('href')).toBe(
      '/me#grade',
    );

    const yes = within(card).getByRole('button', { name: t.yes(11) });
    yes.focus();
    fireEvent.click(yes);
    // The card says it is saved, and focus moves there, never falling to <body> (2.4.3, 4.1.3).
    const saved = await within(card).findByRole('status');
    expect(saved.textContent).toBe(en.common.saved);
    await waitFor(() => expect(document.activeElement).toBe(saved));
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/me');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({ grade: 11 });
  });

  it('asks nothing the rest of the year', () => {
    render(<Dashboard data={home(null)} />);
    expect(screen.queryByRole('region', { name: t.title(11) })).toBeNull();
  });
});
