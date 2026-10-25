// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { en } from '@universityflow/content';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * A7-04 on the web: after the date of birth, an adult sees what happens to their information
 * (the AI provider outside South Africa, and every messaging company) and agrees explicitly,
 * before anything else. The same wording as the mobile app, from packages/content.
 */

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
}));

const { OnboardingSteps } = await import('../app/onboarding/steps');
const { StudyChoice } = await import('../components/study-choice');

/** Synthetic courses (hard rule 4), under full university names as goalOptions gives them. */
const COURSES = [
  {
    id: 'uj-sample',
    name: 'Sample engineering course',
    universityName: 'University of Johannesburg',
  },
  { id: 'up-sample', name: 'Sample science course', universityName: 'University of Pretoria' },
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  push.mockReset();
});

function fakeApi(responses: Record<string, unknown>) {
  const calls: Array<{ key: string; body: unknown }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init: RequestInit = {}) => {
      const key = `${init.method ?? 'GET'} ${path}`;
      calls.push({ key, body: init.body ? JSON.parse(String(init.body)) : undefined });
      if (!(key in responses)) return Response.json({ error: 'not-found' }, { status: 404 });
      return Response.json(responses[key]);
    }),
  );
  return calls;
}

describe('onboarding: the age floor (A11-24)', () => {
  it('tells a learner under 13 why the date of birth was refused, and stays on the step', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'state', detail: 'too-young' }, { status: 409 })),
    );
    render(<OnboardingSteps step="dob" courses={COURSES} />);
    fireEvent.change(screen.getByLabelText(en.onboarding.dobLabel), {
      target: { value: '2016-06-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: en.common.continue }));
    expect(await screen.findByText(en.errors.tooYoung)).toBeTruthy();
    expect(screen.getByLabelText(en.onboarding.dobLabel)).toBeTruthy();
  });
});

describe('onboarding: waiting for the guardian (Continue after they agree)', () => {
  /** Asks a guardian from the step, as a minor does; lands on "Waiting". */
  async function askGuardian() {
    fakeApi({ 'POST /api/me/guardian': { ok: true } });
    const view = render(<OnboardingSteps step="guardian" courses={COURSES} />);
    fireEvent.change(screen.getByLabelText(en.onboarding.guardianName), {
      target: { value: 'Test Guardian' },
    });
    fireEvent.change(screen.getByLabelText(en.onboarding.guardianPhone), {
      target: { value: '0800000123' },
    });
    fireEvent.click(screen.getByRole('button', { name: en.onboarding.sendRequest }));
    expect(await screen.findByRole('heading', { name: en.onboarding.waitingTitle })).toBeTruthy();
    return view;
  }

  it('moves on to the profile when the server says the guardian agreed (router.refresh)', async () => {
    const { rerender } = await askGuardian();
    // "Continue" refreshes the page: the server now gives the step after the guardian's yes.
    rerender(<OnboardingSteps step="profile" courses={COURSES} />);
    expect(
      screen.getByRole('heading', { level: 1, name: en.onboarding.profileTitle }),
    ).toBeTruthy();
  });

  it('stays on "Waiting" while the guardian hasn’t answered yet', async () => {
    const { rerender } = await askGuardian();
    rerender(<OnboardingSteps step="guardian" courses={COURSES} />);
    expect(screen.getByRole('heading', { name: en.onboarding.waitingTitle })).toBeTruthy();
  });
});

describe('onboarding: the adult consent step (A7-04)', () => {
  it('shows an adult the disclosure and an agree button after the date of birth', async () => {
    const calls = fakeApi({
      'POST /api/me/date-of-birth': { consentStatus: 'not-required' },
      'POST /api/me/adult-consent': { ok: true },
    });
    render(<OnboardingSteps step="dob" courses={COURSES} />);
    fireEvent.change(screen.getByLabelText(en.onboarding.dobLabel), {
      target: { value: '2000-02-02' },
    });
    fireEvent.click(screen.getByRole('button', { name: en.common.continue }));

    expect(
      await screen.findByRole('heading', { level: 1, name: en.adultConsent.title }),
    ).toBeTruthy();
    for (const line of [...en.adultConsent.whatWeDo, ...en.adultConsent.whatWeKeep]) {
      expect(screen.getByText(line)).toBeTruthy();
    }
    // Nothing is agreed until the learner says so.
    expect(calls.some((c) => c.key === 'POST /api/me/adult-consent')).toBe(false);

    fireEvent.click(screen.getByRole('checkbox', { name: en.privacyPage.adultConfirm }));
    fireEvent.click(screen.getByRole('button', { name: en.adultConsent.agree }));
    expect(
      await screen.findByRole('heading', { level: 1, name: en.onboarding.profileTitle }),
    ).toBeTruthy();
    expect(calls.find((c) => c.key === 'POST /api/me/adult-consent')?.body).toEqual({
      version: en.adultConsent.version,
    });
  });

  it('a learner who turned 18 sees the same wording under their own title', async () => {
    const calls = fakeApi({ 'POST /api/me/adult-consent': { ok: true } });
    render(<OnboardingSteps step="adult-turned-18" courses={COURSES} />);
    expect(screen.getByRole('heading', { level: 1, name: en.onboarding.adultTitle })).toBeTruthy();
    expect(screen.getByText(en.adultConsent.whatWeKeep[1] as string)).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: en.privacyPage.adultConfirm }));
    fireEvent.click(screen.getByRole('button', { name: en.adultConsent.agree }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/home'));
    expect(calls.find((c) => c.key === 'POST /api/me/adult-consent')?.body).toEqual({
      version: en.adultConsent.version,
    });
  });
});

describe('"What would you like to study?": a dropdown of courses by university', () => {
  it('offers "I don’t know yet" and every course under its university’s full name', () => {
    render(<OnboardingSteps step="profile" courses={COURSES} />);
    const field = screen.getByLabelText(en.onboarding.goal) as HTMLSelectElement;
    expect(field.tagName).toBe('SELECT');
    expect([...field.options].map((o) => o.textContent)).toEqual([
      en.common.chooseOne,
      en.onboarding.goalUnknown,
      'Sample engineering course',
      'Sample science course',
    ]);
    expect([...field.querySelectorAll('optgroup')].map((g) => g.label)).toEqual([
      'University of Johannesburg',
      'University of Pretoria',
    ]);
  });

  it('saves the course with its university, or "I don’t know yet"', async () => {
    const calls = fakeApi({ 'PATCH /api/me': { profile: {} } });
    render(<OnboardingSteps step="profile" courses={COURSES} />);
    fireEvent.change(screen.getByLabelText(en.onboarding.goal), {
      target: { value: en.onboarding.goalValue('Sample science course', 'University of Pretoria') },
    });
    fireEvent.click(screen.getByRole('button', { name: en.onboarding.finish }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/home'));
    expect(calls.find((c) => c.key === 'PATCH /api/me')?.body).toMatchObject({
      goal: 'Sample science course, University of Pretoria',
    });
  });

  it('keeps an answer typed before the dropdown, so saving the form never drops it', () => {
    render(
      <StudyChoice
        id="goal"
        value="civil engineering"
        onChange={() => undefined}
        options={COURSES}
      />,
    );
    const field = document.getElementById('goal') as HTMLSelectElement;
    expect(field.value).toBe('civil engineering');
    expect([...field.options].map((o) => o.textContent)).toContain('civil engineering');
  });
});
