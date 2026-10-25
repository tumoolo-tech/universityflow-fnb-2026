// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { en } from '@universityflow/content';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The judge demo's on-screen phone sign-up (a HACKATHON EXCEPTION the owner approved on
 * 2026-10-24, docs/deploy/demo.md), on screen:
 * - a way in for judges beside the made-up learners (the landing page, the picker, /sign-in),
 *   only with `UF_DEMO_PHONE_SIGNUP=onscreen`; off, the demo's pages are as before;
 * - the sign-up page: the notice first (made-up details, an 080 number, nothing sent, deleted
 *   within 24 hours), then the real phone form, whose PIN is shown where it is typed;
 * - onboarding: the notice, the guardian's 080 hint, and the guardian's link on screen;
 * - production's sign-in form unchanged.
 */

vi.mock('@/lib/server/session', () => ({
  currentStudent: async () => null,
}));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`redirect ${to}`);
  },
  notFound: () => {
    throw new Error('not found');
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

const FrontDoor = (await import('../app/page')).default;
const SignIn = (await import('../app/sign-in/page')).default;
const DemoPage = (await import('../app/demo/page')).default;
const NewLearnerPage = (await import('../app/demo/new-learner/page')).default;
const { SignInForm } = await import('../app/sign-in/sign-in-form');
const { OnboardingSteps } = await import('../app/onboarding/steps');
const { demoPhoneWords } = await import('../app/demo/new-learner/words');

const copy = en.demoPhoneSignup;
const PATH = '/demo/new-learner';
/** A cellphone-looking number, built at runtime (hard rule 4): the demo refuses it. */
const CELL = ['082', '000', '0456'].join('');

const DEMO = {
  UF_DEPLOYMENT: 'demo',
  UF_DEMO_PROJECT: '1',
  UF_PROVIDERS: 'local',
  AUTH_SECRET: 'demo-phone-ui-test-secret-long-enough-0123456789',
  ELEVENLABS_API_KEY: '',
  ELEVENLABS_VOICE_ID: '',
  UF_PROFILE_PHOTO: '',
  UF_MINDMAP_WORDS: '',
  UF_CATALOGUE_E2E_FIXTURES: '',
  UF_DEMO_SIGNUP: '',
};
const ON = { ...DEMO, UF_DEMO_PHONE_SIGNUP: 'onscreen' };

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function stub(env: Record<string, string>) {
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
}

function fakeFetch(answer: (key: string) => Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init: RequestInit = {}) =>
      answer(`${init.method ?? 'GET'} ${path}`),
    ),
  );
}

const linksTo = (href: string) =>
  screen.queryAllByRole('link').filter((l) => l.getAttribute('href') === href);

describe('the way in for judges', () => {
  it('off: no way to the phone sign-up anywhere, and the page is not found', async () => {
    stub(DEMO);
    render(await FrontDoor());
    render(await DemoPage());
    render(await SignIn());
    expect(linksTo(PATH)).toHaveLength(0);
    expect(screen.queryByText(copy.action)).toBeNull();
    await expect(NewLearnerPage()).rejects.toThrow('not found');
  });

  it('on: the landing page, the picker and /sign-in each offer it, beside the made-up learners', async () => {
    stub(ON);
    for (const page of [FrontDoor, DemoPage, SignIn]) {
      render(await page());
      const links = linksTo(PATH);
      expect(links.length).toBeGreaterThan(0);
      expect(links.every((l) => l.textContent === copy.action)).toBe(true);
      cleanup();
    }
  });

  it('on: /sign-in still has no phone form of its own', async () => {
    stub(ON);
    const { container } = render(await SignIn());
    expect(container.querySelector('input[type="tel"]')).toBeNull();
  });

  it('production’s pages never offer it, even with the variable set', async () => {
    stub({ UF_DEPLOYMENT: '', UF_DEMO_PHONE_SIGNUP: 'onscreen', NEXT_PUBLIC_UF_DEMO_URL: '' });
    render(await FrontDoor());
    expect(linksTo(PATH)).toHaveLength(0);
    await expect(NewLearnerPage()).rejects.toThrow('not found');
  });
});

describe('the sign-up page', () => {
  it('says what the demo is before the form, then asks for a made-up 080 number', async () => {
    stub(ON);
    render(await NewLearnerPage());
    expect(screen.getByRole('heading', { level: 1, name: copy.pageTitle })).toBeTruthy();
    const notice = screen.getByRole('region', { name: copy.noticeTitle });
    for (const point of copy.noticePoints) expect(notice.textContent).toContain(point);
    expect(screen.getByLabelText(copy.phoneLabel)).toBeTruthy();
    expect(screen.getByText(copy.phoneHint)).toBeTruthy();
    // One h1: the form's own heading is not a second one.
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});

describe('the phone form on the demo', () => {
  it('shows the PIN where it is typed, and never says one was sent', async () => {
    fakeFetch(() => Response.json({ ok: true, phoneMasked: '•••• ••• 456', demoPin: '123456' }));
    render(<SignInForm demo={demoPhoneWords()} />);
    fireEvent.change(screen.getByLabelText(copy.phoneLabel), { target: { value: '0800000456' } });
    fireEvent.click(screen.getByRole('button', { name: en.auth.sendPin }));
    expect(await screen.findByRole('heading', { name: en.auth.pinTitle })).toBeTruthy();
    const shown = screen.getByRole('status');
    expect(shown.textContent).toContain(copy.pinOnScreenTitle);
    expect(shown.textContent).toContain(copy.pinOnScreen('123456'));
    expect(screen.queryByText(en.auth.pinLead('•••• ••• 456'))).toBeNull();
  });

  it('a number that isn’t 080 is refused with the demo’s sentence', async () => {
    fakeFetch(() => Response.json({ error: 'phone', detail: 'demo-080-only' }, { status: 400 }));
    render(<SignInForm demo={demoPhoneWords()} />);
    fireEvent.change(screen.getByLabelText(copy.phoneLabel), { target: { value: CELL } });
    fireEvent.click(screen.getByRole('button', { name: en.auth.sendPin }));
    expect(await screen.findByText(copy.only080)).toBeTruthy();
  });

  it('a number another judge took says to pick another made-up 080 number', async () => {
    fakeFetch(() => Response.json({ error: 'phone', detail: 'demo-080-taken' }, { status: 409 }));
    render(<SignInForm demo={demoPhoneWords()} />);
    fireEvent.change(screen.getByLabelText(copy.phoneLabel), { target: { value: '0800000000' } });
    fireEvent.click(screen.getByRole('button', { name: en.auth.sendPin }));
    expect(await screen.findByText(copy.numberTaken)).toBeTruthy();
  });

  it('production’s form is unchanged: it says the PIN was sent, and shows none', async () => {
    fakeFetch(() => Response.json({ ok: true, phoneMasked: '•••• ••• 456' }));
    render(<SignInForm />);
    expect(screen.getByRole('heading', { level: 1, name: en.auth.title })).toBeTruthy();
    fireEvent.change(screen.getByLabelText(en.auth.phoneLabel), {
      target: { value: CELL },
    });
    fireEvent.click(screen.getByRole('button', { name: en.auth.sendPin }));
    expect(await screen.findByText(en.auth.pinLead('•••• ••• 456'))).toBeTruthy();
    expect(screen.queryByText(copy.pinOnScreenTitle)).toBeNull();
  });
});

describe('onboarding on a demo sign-up', () => {
  it('says it is the demo, and the guardian’s number is a made-up 080 one', () => {
    render(<OnboardingSteps step="guardian" courses={[]} demoPhone={demoPhoneWords()} />);
    expect(screen.getByText(copy.onboardingNotice)).toBeTruthy();
    expect(screen.getByText(copy.guardianPhoneHint)).toBeTruthy();
  });

  it('shows the guardian’s link on screen once asked, opening apart, with Continue below', async () => {
    fakeFetch(() =>
      Response.json({ ok: true, demoConsentLink: '/consent/made-up-token-0123456789' }),
    );
    render(<OnboardingSteps step="guardian" courses={[]} demoPhone={demoPhoneWords()} />);
    fireEvent.change(screen.getByLabelText(en.onboarding.guardianName), {
      target: { value: 'Made-up Guardian' },
    });
    fireEvent.change(screen.getByLabelText(en.onboarding.guardianPhone), {
      target: { value: '0800000789' },
    });
    fireEvent.click(screen.getByRole('button', { name: en.onboarding.sendRequest }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: copy.guardianLinkTitle })).toBeTruthy(),
    );
    const link = screen.getByRole('link', { name: copy.guardianLinkAction });
    expect(link.getAttribute('href')).toBe('/consent/made-up-token-0123456789');
    expect(link.getAttribute('target')).toBe('_blank');
    // The waiting step's own Continue moves on once the guardian has agreed (onboarding.test.tsx).
    expect(screen.getByRole('button', { name: en.common.continue })).toBeTruthy();
  });

  it('a guardian’s number that isn’t 080 is refused with the demo’s sentence', async () => {
    fakeFetch(() => Response.json({ error: 'phone', detail: 'demo-080-only' }, { status: 400 }));
    render(<OnboardingSteps step="guardian" courses={[]} demoPhone={demoPhoneWords()} />);
    fireEvent.change(screen.getByLabelText(en.onboarding.guardianName), {
      target: { value: 'Made-up Guardian' },
    });
    fireEvent.change(screen.getByLabelText(en.onboarding.guardianPhone), {
      target: { value: CELL },
    });
    fireEvent.click(screen.getByRole('button', { name: en.onboarding.sendRequest }));
    expect(await screen.findByText(copy.only080)).toBeTruthy();
  });

  it('everywhere else, onboarding says nothing about the demo', () => {
    render(<OnboardingSteps step="guardian" courses={[]} />);
    expect(screen.queryByText(copy.onboardingNotice)).toBeNull();
    expect(screen.queryByText(copy.guardianPhoneHint)).toBeNull();
  });
});
