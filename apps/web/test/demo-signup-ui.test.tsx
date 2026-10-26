// @vitest-environment jsdom

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/react';
import { en } from '@universityflow/content';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The switch between the main site and the judge demo, and the demo's real sign-up (a hackathon
 * exception the owner approved on 2026-10-23, docs/deploy/demo.md):
 * - production's landing page is unchanged, except a "Demo for judges" link to the demo when
 *   NEXT_PUBLIC_UF_DEMO_URL is set;
 * - on the demo, `/` is the real landing page, with the judges' entry to the picker (now at
 *   `/demo`), and its ways in lead to the real sign-up when it is on, else to the picker;
 * - the demo banner has "Back to UniversityFlow" beside "Switch learner";
 * - the sign-up page says what is stored, where and for how long before anything else, and is the
 *   only page that loads the Firebase SDK.
 */

let signedIn = false;
vi.mock('@/lib/server/session', () => ({
  currentStudent: async () => (signedIn ? { studentId: 's1' } : null),
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
const { DemoBanner } = await import('../components/demo-banner');

const copy = en.demoSignup;
/**
 * A demo the server accepts: the picker and the sign-up page check (demo-entry.test.tsx covers a
 * refused one).
 */
const DEMO = {
  UF_DEPLOYMENT: 'demo',
  UF_DEMO_PROJECT: '1',
  UF_PROVIDERS: 'local',
  AUTH_SECRET: 'demo-signup-ui-test-secret-long-enough-0123456789',
  ELEVENLABS_API_KEY: '',
  ELEVENLABS_VOICE_ID: '',
  UF_PROFILE_PHOTO: '',
  UF_MINDMAP_WORDS: '',
  UF_CATALOGUE_E2E_FIXTURES: '',
};
const FAKE = { ...DEMO, UF_DEMO_SIGNUP: 'fake' };

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  signedIn = false;
});

function stub(env: Record<string, string>) {
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
}

const hrefs = (links: HTMLElement[]) => links.map((l) => l.getAttribute('href'));

describe('production’s landing page', () => {
  it('shows no judges’ entry unless NEXT_PUBLIC_UF_DEMO_URL is set, and nothing else changes', async () => {
    stub({ UF_DEPLOYMENT: '', NEXT_PUBLIC_UF_DEMO_URL: '' });
    const { container } = render(await FrontDoor());
    expect(screen.queryByText(copy.judgeEntryTitle)).toBeNull();
    const before = hrefs(screen.getAllByRole('link'));
    cleanup();

    stub({ NEXT_PUBLIC_UF_DEMO_URL: 'https://universityflow-demo.vercel.app' });
    render(await FrontDoor());
    const entry = screen.getByRole('navigation', { name: copy.judgeEntryTitle });
    const link = within(entry).getByRole('link', { name: copy.judgeEntryTitle });
    expect(link.getAttribute('href')).toBe('https://universityflow-demo.vercel.app');
    expect(link.getAttribute('rel')).toContain('noopener');
    // The lead is the button's description, not a card's paragraph.
    const lead = document.getElementById(link.getAttribute('aria-describedby') ?? '');
    expect(lead?.textContent).toBe(copy.judgeEntryLead);
    // Every other link is exactly as before.
    const after = hrefs(screen.getAllByRole('link')).filter(
      (h) => h !== 'https://universityflow-demo.vercel.app',
    );
    expect(after).toEqual(before);
    expect(container).toBeTruthy();
  });

  it('ignores a malformed NEXT_PUBLIC_UF_DEMO_URL (no broken link)', async () => {
    stub({ NEXT_PUBLIC_UF_DEMO_URL: 'http://not-https.example' });
    render(await FrontDoor());
    expect(screen.queryByText(copy.judgeEntryTitle)).toBeNull();
  });
});

describe('the demo’s landing page', () => {
  it('is the real landing page, with the judges’ entry to the picker at /demo', async () => {
    stub(DEMO);
    render(await FrontDoor());
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual([
      en.home.headline,
    ]);
    const entry = screen.getByRole('navigation', { name: copy.judgeEntryTitle });
    expect(
      within(entry).getByRole('link', { name: copy.judgeEntryTitle }).getAttribute('href'),
    ).toBe('/demo');
  });

  it('the judges’ entry is a small button in the landing page’s bar, not a card', async () => {
    stub(DEMO);
    render(await FrontDoor());
    const bar = screen.getByRole('region', { name: en.home.barLabel });
    expect(within(bar).getByRole('navigation', { name: copy.judgeEntryTitle })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: copy.judgeEntryTitle })).toBeNull();
  });

  it('its ways in lead to the picker when the sign-up is off', async () => {
    stub(DEMO);
    render(await FrontDoor());
    const bar = screen.getByRole('region', { name: en.home.barLabel });
    expect(within(bar).getByRole('link', { name: en.home.start }).getAttribute('href')).toBe(
      '/demo',
    );
    expect(within(bar).getByRole('link', { name: en.home.signIn }).getAttribute('href')).toBe(
      '/demo',
    );
    const tiles = screen.getByRole('region', { name: en.home.tilesTitle });
    for (const link of within(tiles).getAllByRole('link')) {
      expect(link.getAttribute('href')).toBe('/demo');
    }
  });

  it('and to the real sign-up when it is on', async () => {
    stub(FAKE);
    render(await FrontDoor());
    const bar = screen.getByRole('region', { name: en.home.barLabel });
    expect(within(bar).getByRole('link', { name: en.home.start }).getAttribute('href')).toBe(
      '/demo/sign-up',
    );
    expect(within(bar).getByRole('link', { name: en.home.signIn }).getAttribute('href')).toBe(
      '/demo/sign-up',
    );
  });

  it('a judge already on a learner sees the landing page too, with a way back to them', async () => {
    stub(DEMO);
    signedIn = true;
    render(await FrontDoor());
    const entry = screen.getByRole('navigation', { name: copy.judgeEntryTitle });
    expect(
      within(entry).getByRole('link', { name: copy.backToYourLearner }).getAttribute('href'),
    ).toBe('/home');
  });

  it('production still sends a signed-in learner to their home', async () => {
    signedIn = true;
    await expect(FrontDoor()).rejects.toThrow('redirect /home');
  });
});

describe('/demo: the picker', () => {
  it('shows the six made-up learners, and the sign-up line only when the sign-up is on', async () => {
    stub(DEMO);
    render(await DemoPage());
    expect(screen.getByRole('heading', { level: 1, name: en.demo.pickerTitle })).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(6);
    expect(screen.queryByText(copy.pickerSignupLine)).toBeNull();
    cleanup();
    stub(FAKE);
    render(await DemoPage());
    expect(screen.getByRole('link', { name: copy.pickerSignupAction }).getAttribute('href')).toBe(
      '/demo/sign-up',
    );
  });

  it('is not found outside a demo', async () => {
    stub({ UF_DEPLOYMENT: '' });
    await expect(DemoPage()).rejects.toThrow('not found');
  });
});

describe('/sign-in on the demo', () => {
  it('offers the picker, and no phone field', async () => {
    stub(DEMO);
    const { container } = render(await SignIn());
    expect(screen.getByRole('link', { name: copy.pickerAction }).getAttribute('href')).toBe(
      '/demo',
    );
    expect(screen.queryByRole('link', { name: copy.ownAccountAction })).toBeNull();
    expect(container.querySelector('input[type="tel"], input[inputmode="tel"]')).toBeNull();
  });

  it('and the real sign-up when it is on', async () => {
    stub(FAKE);
    render(await SignIn());
    expect(screen.getByRole('link', { name: copy.ownAccountAction }).getAttribute('href')).toBe(
      '/demo/sign-up',
    );
  });
});

describe('the demo banner', () => {
  it('has "Back to UniversityFlow" beside "Switch learner": the landing page, or the main site', () => {
    render(<DemoBanner demo learner />);
    const banner = screen.getByRole('note', { name: en.demo.bannerLabel });
    expect(within(banner).getByRole('button', { name: en.demo.switchLearner })).toBeTruthy();
    expect(within(banner).getByRole('link', { name: copy.backToMain }).getAttribute('href')).toBe(
      '/',
    );
    cleanup();
    render(<DemoBanner demo mainUrl="https://universityflow.example" />);
    expect(screen.getByRole('link', { name: copy.backToMain }).getAttribute('href')).toBe(
      'https://universityflow.example',
    );
  });
});

describe('/demo/sign-up', () => {
  // The demo's ways in (2026-10-23, late): on a demo with the sign-up off, the picker rather than
  // a not-found page (demo-entry.test.tsx); still not found anywhere but a demo.
  it('goes to the picker on a demo with the sign-up off, and is not found outside a demo', async () => {
    stub(DEMO);
    await expect(SignUpPage()).rejects.toThrow('redirect /demo');
    vi.unstubAllEnvs();
    stub({ UF_DEPLOYMENT: '', UF_DEMO_SIGNUP: 'fake' });
    await expect(SignUpPage()).rejects.toThrow('not found');
  });

  it('a signed-in judge goes to their home', async () => {
    stub(FAKE);
    signedIn = true;
    await expect(SignUpPage()).rejects.toThrow('redirect /home');
  });

  it('says what is stored, where and for how long before the form, with an unticked box', async () => {
    stub(FAKE);
    const { container } = render(await SignUpPage());
    expect(screen.getByRole('heading', { level: 1, name: copy.title })).toBeTruthy();
    const notice = screen.getByRole('region', { name: copy.noticeTitle });
    for (const point of copy.noticePoints) expect(within(notice).getByText(point)).toBeTruthy();
    const box = screen.getByRole('checkbox', { name: copy.agreeLabel }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    // The notice comes before the form in reading order.
    const form = container.querySelector('form');
    expect(form).toBeTruthy();
    expect(
      notice.compareDocumentPosition(form as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('the fake shows its local-test note and loads no Firebase', async () => {
    stub(FAKE);
    render(await SignUpPage());
    expect(screen.getByText(copy.fakeNote)).toBeTruthy();
    expect(screen.queryByRole('button', { name: copy.google })).toBeNull();
  });

  it('Firebase shows the email link and Google', async () => {
    stub({
      ...DEMO,
      UF_DEMO_SIGNUP: 'firebase',
      NEXT_PUBLIC_FIREBASE_API_KEY: `AIza${'x'.repeat(35)}`,
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'uf-demo-test.firebaseapp.com',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'uf-demo-test',
    });
    render(await SignUpPage());
    expect(screen.getByRole('button', { name: copy.sendLink })).toBeTruthy();
    expect(screen.getByRole('button', { name: copy.google })).toBeTruthy();
    expect(screen.getByLabelText(copy.emailLabel)).toBeTruthy();
  });
});

describe('the Firebase SDK is loaded only on the sign-up page', () => {
  const WEB = join(import.meta.dirname, '..');
  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sources(path);
      return /\.(ts|tsx|mjs|js)$/.test(name) ? [path] : [];
    });
  }

  it('no other source file imports firebase', () => {
    const importers = ['app', 'components', 'lib', 'proxy.ts', 'instrumentation-client.ts']
      .flatMap((entry) => {
        const path = join(WEB, entry);
        try {
          return statSync(path).isDirectory() ? sources(path) : [path];
        } catch {
          return [];
        }
      })
      .filter((file) =>
        /from ['"]@?firebase|import\(['"]@?firebase/.test(readFileSync(file, 'utf8')),
      )
      .map((file) => relative(WEB, file).replace(/\\/g, '/'));
    expect(importers).toEqual(['app/demo/sign-up/signup-form.tsx']);
  });

  it('the sign-up form loads it only when it is needed (a dynamic import)', () => {
    const form = readFileSync(join(WEB, 'app/demo/sign-up/signup-form.tsx'), 'utf8');
    expect(form).not.toMatch(/^import[^;]*from ['"]@?firebase/m);
    expect(form).toMatch(/import\(['"]@firebase\/app['"]\)/);
    expect(form).toMatch(/import\(['"]@firebase\/auth['"]\)/);
  });

  it('pins the two SDK packages it uses to exact versions, never the umbrella (A8-12)', () => {
    const pkg = JSON.parse(readFileSync(join(WEB, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies['@firebase/app']).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.dependencies['@firebase/auth']).toMatch(/^\d+\.\d+\.\d+$/);
    // The umbrella brings Firestore and gRPC, which nothing here imports.
    expect(pkg.dependencies['firebase']).toBeUndefined();
    const root = JSON.parse(readFileSync(join(WEB, '../../package.json'), 'utf8')) as {
      pnpm: { overrides: Record<string, string>; auditConfig: { ignoreGhsas: string[] } };
    };
    expect(Object.keys(root.pnpm.overrides).filter((k) => /firestore|grpc/.test(k))).toEqual([]);
    // A8-13: braces' GHSA-vfj7-8cjw-p6xm was withdrawn; no dead ignore entry.
    expect(root.pnpm.auditConfig.ignoreGhsas).not.toContain('GHSA-vfj7-8cjw-p6xm');
  });
});
