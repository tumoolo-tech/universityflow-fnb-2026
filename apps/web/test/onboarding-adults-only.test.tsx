// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { en } from '@universityflow/content';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The judge demo's real sign-up is adults only (a hackathon exception, docs/deploy/demo.md): a
 * date of birth under 18 is refused, the server deletes the account and signs the browser out,
 * and the step says so plainly, with the way to the made-up learners instead.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

const { OnboardingSteps } = await import('../app/onboarding/steps');

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ADULTS_ONLY = {
  message: en.demoSignup.adultsOnly,
  action: en.demoSignup.adultsOnlyAction,
};

describe('onboarding: the demo sign-up is adults only', () => {
  it('says why, that the account was deleted, and offers the made-up learners', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'state', detail: 'adults-only' }, { status: 409 })),
    );
    render(<OnboardingSteps step="dob" courses={[]} adultsOnly={ADULTS_ONLY} />);
    fireEvent.change(screen.getByLabelText(en.onboarding.dobLabel), {
      target: { value: '2010-06-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: en.common.continue }));
    expect(await screen.findByText(en.demoSignup.adultsOnly)).toBeTruthy();
    expect(
      screen.getByRole('link', { name: en.demoSignup.adultsOnlyAction }).getAttribute('href'),
    ).toBe('/demo');
    // Nothing more to do on this step: the account is gone.
    expect(screen.queryByLabelText(en.onboarding.dobLabel)).toBeNull();
  });

  it('the onboarding page passes the words only on a demo with the sign-up on', () => {
    const page = readFileSync(join(import.meta.dirname, '../app/onboarding/page.tsx'), 'utf8');
    expect(page).toMatch(/adultsOnly=/);
    expect(page).toMatch(/demoSignupOrNull\(process\.env\)/);
    expect(page).toMatch(/isDemo\(\)/);
  });
});
