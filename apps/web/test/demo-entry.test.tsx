// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import { en } from '@universityflow/content';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigError } from '../lib/server/config';

/**
 * The judge demo's ways in (the owner, 2026-10-23, late: "nothing works" on the live demo). On a
 * demo, "Get started", "I already have an account" and /sign-in never show a phone form: they lead
 * to the judges' sign-up when it is on, else to the made-up learners, and the landing page says
 * plainly that this is a demo with made-up learners. A configuration the server refuses never
 * leaves a judge on a raw error: the picker says the demo isn't set up yet, and the server's log
 * says why (demo-entry-api.test.ts). Production's landing page and /sign-in are exactly as before.
 */

type Session = 'out' | 'in' | 'refused';
let session: Session = 'out';
vi.mock('@/lib/server/session', () => ({
  currentStudent: async () => {
    if (session === 'refused') {
      const { ConfigError: Refused } = await import('../lib/server/config');
      throw new Refused('AUTH_SECRET must be a long random value on a demo');
    }
    return session === 'in' ? { studentId: 's1' } : null;
  },
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
const SignUpPage = (await import('../app/demo/sign-up/page')).default;
const { DemoPicker, demoStatus } = await import('../components/demo-picker');
const { DEMO_PERSONAS } = await import('../lib/server/demo/personas');

const copy = en.demoSignup;
/** A demo the server accepts (readConfig only reads these; nothing is opened). */
const DEMO = {
  UF_DEPLOYMENT: 'demo',
  UF_DEMO_PROJECT: '1',
  UF_PROVIDERS: 'local',
  AUTH_SECRET: 'demo-entry-test-secret-long-enough-0123456789',
  DATABASE_URL: 'pglite:memory',
  // Whatever this shell has set: a demo refuses these.
  ELEVENLABS_API_KEY: '',
  ELEVENLABS_VOICE_ID: '',
  UF_PROFILE_PHOTO: '',
  UF_MINDMAP_WORDS: '',
  UF_CATALOGUE_E2E_FIXTURES: '',
  UF_DEMO_SIGNUP: '',
  NEXT_PUBLIC_FIREBASE_API_KEY: '',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: '',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: '',
};
const FIREBASE = {
  ...DEMO,
  UF_DEMO_SIGNUP: 'firebase',
  NEXT_PUBLIC_FIREBASE_API_KEY: `AIza${'x'.repeat(35)}`,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'uf-demo-test.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'uf-demo-test',
};
/** The same demo with a setting the server refuses (too short a secret). */
const REFUSED = { ...DEMO, AUTH_SECRET: 'short' };
const PRODUCTION = {
  UF_DEPLOYMENT: '',
  UF_DEMO_PROJECT: '',
  UF_DEMO_SIGNUP: '',
  NEXT_PUBLIC_UF_DEMO_URL: '',
  NEXT_PUBLIC_FIREBASE_API_KEY: '',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: '',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: '',
};

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  session = 'out';
});

function stub(env: Record<string, string>) {
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
}

const PHONE_FIELD = 'input[type="tel"], input[inputmode="tel"], input[inputmode="numeric"]';

/** Every sentence-length word the demo has: none may show on production's pages. */
const DEMO_WORDS = [...Object.values(en.demo), ...Object.values(copy)]
  .flatMap((value) => (Array.isArray(value) ? value : [value]))
  .filter((value): value is string => typeof value === 'string' && value.length > 12);

describe('the demo’s landing page says plainly what it is', () => {
  it('one sentence: a demo with made-up learners, not the real service, beside the ways in', async () => {
    stub(DEMO);
    render(await FrontDoor());
    const bar = screen.getByRole('region', { name: en.home.barLabel });
    expect(within(bar).getByText(copy.landingDemoLine)).toBeTruthy();
    expect(copy.landingDemoLine).toMatch(/made up/);
    expect(copy.landingDemoLine).toMatch(/not the real service/);
  });

  it('“Get started” and “I already have an account” lead to the sign-up when it is on', async () => {
    stub(FIREBASE);
    render(await FrontDoor());
    const bar = screen.getByRole('region', { name: en.home.barLabel });
    expect(within(bar).getByRole('link', { name: en.home.start }).getAttribute('href')).toBe(
      '/demo/sign-up',
    );
    expect(within(bar).getByRole('link', { name: en.home.signIn }).getAttribute('href')).toBe(
      '/demo/sign-up',
    );
    expect(document.querySelector(PHONE_FIELD)).toBeNull();
  });

  it('a stale session on a refused configuration still shows the landing page', async () => {
    stub(REFUSED);
    session = 'refused';
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(await FrontDoor());
    expect(screen.getByRole('heading', { level: 1, name: en.home.headline })).toBeTruthy();
    expect(log.mock.calls.flat().join('\n')).toMatch(/ConfigError.*AUTH_SECRET/);
  });
});

/**
 * Where the information is (the owner, 2026-10-25). "Your information stays in South Africa" is the
 * real service's promise; the demo's database (Supabase) and, since hackathon exception J, its
 * functions are in London, and a judge's own sign-up puts real details there. So the demo's front
 * door says where real learners' information will be and where the demo runs; production's is
 * unchanged.
 */
describe('the front door says truthfully where information is kept', () => {
  it('on the demo: real learners’ information will stay in South Africa; this demo runs in London', async () => {
    stub(DEMO);
    const { container } = render(await FrontDoor());
    const bar = screen.getByRole('region', { name: en.home.barLabel });
    expect(within(bar).getByText(en.home.barHereDemo)).toBeTruthy();
    expect(within(bar).getByText(en.home.barHereDemoWhere)).toBeTruthy();
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/stays in South Africa/);
    expect(text).not.toContain(en.home.barHere);
    expect(text).not.toContain(en.home.free);
  });

  it('in production: “Your information stays in South Africa”, and no demo wording', async () => {
    stub(PRODUCTION);
    const { container } = render(await FrontDoor());
    const bar = screen.getByRole('region', { name: en.home.barLabel });
    expect(within(bar).getByText('Your information stays in South Africa')).toBeTruthy();
    const text = container.textContent ?? '';
    for (const words of [en.home.barHereDemo, en.home.barHereDemoWhere, en.home.freeDemo]) {
      expect(typeof words).toBe('string');
      expect(text, words).not.toContain(words);
    }
    expect(text).not.toMatch(/London/);
  });
});

describe('/sign-in on the demo', () => {
  it('says what the demo is, and has no phone field', async () => {
    stub(DEMO);
    const { container } = render(await SignIn());
    expect(screen.getByText(copy.landingDemoLine)).toBeTruthy();
    expect(container.querySelector(PHONE_FIELD)).toBeNull();
  });

  it('a stale session on a refused configuration still shows the ways in', async () => {
    stub(REFUSED);
    session = 'refused';
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(await SignIn());
    expect(screen.getByRole('link', { name: copy.pickerAction }).getAttribute('href')).toBe(
      '/demo',
    );
  });
});

describe('/demo/sign-up when the sign-up is off', () => {
  it('goes to the made-up learners on a demo, never a not-found page', async () => {
    stub(DEMO);
    await expect(SignUpPage()).rejects.toThrow('redirect /demo');
  });

  it('and when the server refuses its configuration, to the picker that says so', async () => {
    stub({ ...FIREBASE, AUTH_SECRET: 'short' });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(SignUpPage()).rejects.toThrow('redirect /demo');
  });

  it('is still not found outside a demo', async () => {
    stub({ ...PRODUCTION, UF_DEMO_SIGNUP: 'fake' });
    await expect(SignUpPage()).rejects.toThrow('not found');
  });
});

describe('the picker when the demo isn’t set up', () => {
  it('reads "setup" from the start route’s redirect', () => {
    expect(demoStatus('setup')).toBe('setup');
  });

  it('says so kindly, with what to do', () => {
    render(<DemoPicker personas={DEMO_PERSONAS} status="setup" />);
    expect(screen.getByRole('alert').textContent).toBe(en.demo.notSetUp);
    expect(en.demo.notSetUp).toMatch(/isn’t set up yet/);
    expect(en.demo.notSetUp).toMatch(/try again later/i);
  });

  it('/demo says so before a judge presses anything, and logs why (variable names only)', async () => {
    stub(REFUSED);
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(await DemoPage());
    expect(screen.getByRole('alert').textContent).toBe(en.demo.notSetUp);
    const logged = log.mock.calls.flat().join('\n');
    expect(logged).toMatch(/ConfigError: AUTH_SECRET must be a long random value on a demo/);
    expect(logged).not.toMatch(/\bshort\b/);
  });

  it('/demo on an accepted configuration shows no notice', async () => {
    stub(DEMO);
    render(await DemoPage());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('production is unchanged (phone sign-in, no demo words)', () => {
  it('/sign-in is the phone sign-in, with no demo words', async () => {
    stub(PRODUCTION);
    const { container } = render(await SignIn());
    expect(screen.getByRole('heading', { level: 1, name: en.auth.title })).toBeTruthy();
    expect(container.querySelector('input[type="tel"], input[autocomplete="tel"]')).toBeTruthy();
    const text = container.textContent ?? '';
    for (const words of DEMO_WORDS) expect(text, words).not.toContain(words);
  });

  it('the landing page’s ways in go to /sign-in, with no demo words', async () => {
    stub(PRODUCTION);
    const { container } = render(await FrontDoor());
    const bar = screen.getByRole('region', { name: en.home.barLabel });
    expect(within(bar).getByRole('link', { name: en.home.start }).getAttribute('href')).toBe(
      '/sign-in',
    );
    expect(within(bar).getByRole('link', { name: en.home.signIn }).getAttribute('href')).toBe(
      '/sign-in',
    );
    const text = container.textContent ?? '';
    for (const words of DEMO_WORDS) expect(text, words).not.toContain(words);
  });

  it('a refused configuration in production is not swallowed by the demo’s pages', async () => {
    stub(PRODUCTION);
    session = 'refused';
    await expect(FrontDoor()).rejects.toThrow(ConfigError);
    await expect(SignIn()).rejects.toThrow(ConfigError);
  });
});
