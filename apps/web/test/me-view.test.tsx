// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { en } from '@universityflow/content';
import { DEFAULT_LOOK } from '@universityflow/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

const { MeView } = await import('../app/(app)/me/me-view');

/**
 * About me (A1-38): saving the grade records it afresh, so it moves up from today (G10-1). It is
 * sent only when the learner changed it: a name changed in January must not silently "confirm" a
 * grade the home is asking about, nor send last year's grade with this year's date.
 */

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stub() {
  const bodies: unknown[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_path: string, init: RequestInit = {}) => {
      if (init.method === 'PATCH') bodies.push(JSON.parse(String(init.body)));
      return Response.json({ ok: true });
    }),
  );
  return bodies;
}

const view = () =>
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
    />,
  );

describe('About me sends the grade only when it changed (A1-38)', () => {
  it('a new name alone sends no grade', async () => {
    const bodies = stub();
    view();
    fireEvent.change(screen.getByLabelText(en.onboarding.displayName), {
      target: { value: 'Thandi' },
    });
    fireEvent.click(screen.getByRole('button', { name: en.common.save }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ displayName: 'Thandi', goal: null });
  });

  it('a changed grade is sent, and saving again without a change sends it no more', async () => {
    const bodies = stub();
    view();
    fireEvent.change(screen.getByLabelText(en.onboarding.grade), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: en.common.save }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ grade: 12 });
    fireEvent.click(screen.getByRole('button', { name: en.common.save }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).not.toHaveProperty('grade');
  });
});
