// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { crisisCard } from '@universityflow/agent';
import { catalogueView } from '@universityflow/catalogue';
import { en } from '@universityflow/content';
import { DEFAULT_LOOK } from '@universityflow/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

const { MeView } = await import('../app/(app)/me/me-view');

/**
 * D9: About me shows the care a saved goal asks for, as a plan map does (D3): the goal is saved,
 * and the crisis card appears at once with focus on its title. Synthetic words.
 */

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const card = crisisCard(
  catalogueView(new Date('2026-10-13T08:00:00Z'), { includeDrafts: true }).helplines,
  ['suicide'],
);

describe('About me, when the goal in their words needs care (D9)', () => {
  it('shows the crisis card after the save, and moves focus to it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ profile: {}, care: { level: 'crisis', card } })),
    );
    render(
      <MeView
        account={{
          id: '00000000-0000-4000-8000-000000000001',
          phoneMasked: '082 *** 0100',
          dateOfBirth: '2000-02-02',
          consentStatus: 'not-required',
          needsAdultConsent: false,
        }}
        messaging={{ channels: [], maxPerWeek: 2, offeredChannels: [] }}
        profile={{ displayName: 'Sipho', grade: 11, schoolName: null, province: null, goal: null }}
        look={DEFAULT_LOOK}
        lookGrade={11}
        memory={[]}
        courses={[]}
        careWords={en.planMaps.care}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: en.common.save }));
    const heading = await screen.findByRole('heading', { name: en.crisis.cardTitle });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(screen.getByText(en.planMaps.care.crisisLead)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.planMaps.care.seen }));
    expect(screen.queryByRole('heading', { name: en.crisis.cardTitle })).toBeNull();
  });
});
