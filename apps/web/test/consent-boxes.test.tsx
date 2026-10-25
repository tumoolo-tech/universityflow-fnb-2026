// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { en } from '@universityflow/content';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The launch standard: every consent form has a required, unticked box and a link to the privacy
 * policy. On the web there are two: a guardian's permission (/consent/[token]) and an adult's own
 * agreement (onboarding, and again at 18). Nothing is sent until the box is ticked.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

const { ConsentForm } = await import('../app/consent/[token]/consent-form');
const { OnboardingSteps } = await import('../app/onboarding/steps');

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubFetch() {
  const fetch = vi.fn(async () => Response.json({ status: 'granted', ok: true }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function expectPolicyLink() {
  const link = screen.getByRole('link', { name: en.privacyPage.consentLink });
  expect(link.getAttribute('href')).toBe('/privacy');
}

describe('a guardian’s permission', () => {
  it('has an unticked, required box, the privacy link, and sends nothing until it is ticked', async () => {
    const fetch = stubFetch();
    render(
      <ConsentForm
        token="synthetic"
        status="open"
        relationship="parent"
        learnerPhoneMasked="***000"
      />,
    );
    const box = screen.getByRole('checkbox', { name: en.consent.agreeConfirm }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(box.required).toBe(true);
    expectPolicyLink();

    const agree = screen.getByRole('button', { name: en.consent.agree }) as HTMLButtonElement;
    expect(agree.disabled).toBe(true);
    fireEvent.click(agree);
    expect(fetch).not.toHaveBeenCalled();

    fireEvent.click(box);
    expect(agree.disabled).toBe(false);
    fireEvent.click(agree);
    expect(await screen.findByText(en.consent.granted)).toBeTruthy();
  });
});

describe.each([
  ['an adult’s own agreement', 'adult'],
  ['the agreement at 18', 'adult-turned-18'],
] as const)('%s', (_, step) => {
  it('has an unticked, required box, the privacy link, and sends nothing until it is ticked', async () => {
    const fetch = stubFetch();
    render(<OnboardingSteps step={step} courses={[]} />);
    const box = screen.getByRole('checkbox', {
      name: en.privacyPage.adultConfirm,
    }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(box.required).toBe(true);
    expectPolicyLink();

    const agree = screen.getByRole('button', { name: en.adultConsent.agree });
    expect(agree.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(agree);
    expect(fetch).not.toHaveBeenCalled();
    // Says why, next to the box.
    expect(screen.getByText(en.privacyPage.adultConfirmNeeded)).toBeTruthy();

    fireEvent.click(box);
    expect(agree.getAttribute('aria-disabled')).toBe('false');
    fireEvent.click(agree);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });
});
