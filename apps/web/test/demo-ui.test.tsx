// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/react';
import { en } from '@universityflow/content';
import { afterEach, describe, expect, it } from 'vitest';
import { bannerOnPath, DemoBanner } from '../components/demo-banner';
import { DemoPicker } from '../components/demo-picker';
import { DEMO_PERSONAS } from '../lib/server/demo/personas';

/**
 * Judge demo mode's banner and persona picker (docs/deploy/demo.md). Both are plain HTML forms, so
 * a judge's first press works before any script has loaded.
 */

afterEach(() => {
  cleanup();
});

const read = (path: string) => readFileSync(join(import.meta.dirname, path), 'utf8');

/** The seed's own cards (names from en.demoPersonas, universities from the catalogue). */
const PERSONAS = DEMO_PERSONAS;

describe('where the demo banner shows (the owner, 2026-10-23: the landing page is the main one)', () => {
  it('stays off the landing page and shows on every other page', () => {
    expect(bannerOnPath('/')).toBe(false);
    for (const path of ['/demo', '/home', '/me', '/sign-in', '/demo/sign-up', null]) {
      expect(bannerOnPath(path)).toBe(true);
    }
  });

  it('is decided in the root layout from the path the proxy passes on', () => {
    const layout = read('../app/layout.tsx');
    expect(layout).toMatch(/bannerOnPath\(/);
    expect(layout).toMatch(/PATH_HEADER/);
  });
});

describe('DemoBanner', () => {
  it('says it is a demo of made-up learners, with "Switch learner" posting to the switch route', () => {
    render(<DemoBanner demo learner />);
    const banner = screen.getByRole('note', { name: en.demo.bannerLabel });
    expect(banner.textContent).toContain(en.demo.bannerNotice);
    const button = within(banner).getByRole('button', { name: en.demo.switchLearner });
    const form = button.closest('form');
    expect(form?.getAttribute('action')).toBe('/api/demo/switch');
    expect(form?.getAttribute('method')).toBe('post');
  });

  it('says the universities’ logos are for the demo only, with no affiliation, when they show', () => {
    render(<DemoBanner demo logos />);
    const banner = screen.getByRole('note', { name: en.demo.bannerLabel });
    expect(banner.textContent).toContain(en.demo.logosNotice);
  });

  it('says nothing about logos when the demo shows none', () => {
    render(<DemoBanner demo logos={false} />);
    const banner = screen.getByRole('note', { name: en.demo.bannerLabel });
    expect(banner.textContent).not.toContain(en.demo.logosNotice);
  });

  // A2-67 (DEMO-walk): "Switch learner" showed on the picker, sign-in, privacy and help pages,
  // where no learner was chosen.
  it('offers "Switch learner" only while a learner is signed in (A2-67)', () => {
    render(<DemoBanner demo learner={false} />);
    const banner = screen.getByRole('note', { name: en.demo.bannerLabel });
    expect(banner.textContent).toContain(en.demo.bannerNotice);
    expect(within(banner).queryByRole('button', { name: en.demo.switchLearner })).toBeNull();
    expect(within(banner).getByRole('link', { name: en.demoSignup.backToMain })).toBeTruthy();
    cleanup();
    render(<DemoBanner demo />);
    expect(screen.queryByRole('button', { name: en.demo.switchLearner })).toBeNull();
  });

  it('is told by the root layout whether a learner is signed in (A2-67)', () => {
    const layout = read('../app/layout.tsx');
    expect(layout).toMatch(/<DemoBanner demo=\{demo\} learner=\{learner\} \/>/);
    expect(layout).toMatch(/demoLearnerSignedIn\(/);
  });

  it('renders nothing outside demo mode', () => {
    const { container } = render(<DemoBanner demo={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('is in the root layout, on every page, and a demo is never indexed', () => {
    const layout = read('../app/layout.tsx');
    expect(layout).toMatch(/<DemoBanner demo=\{demo\}/);
    expect(layout).toMatch(/isDemo\(\)/);
    expect(layout).toMatch(/isStaging\(\) \|\| isDemo\(\)/);
  });
});

describe('DemoPicker', () => {
  it('shows "Try UniversityFlow as…", the line for judges, and one card per learner', () => {
    render(<DemoPicker personas={PERSONAS} />);
    expect(screen.getByRole('heading', { level: 1, name: en.demo.pickerTitle })).toBeTruthy();
    expect(screen.getByText(en.demo.judgesLine)).toBeTruthy();
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(PERSONAS.map((p) => en.demo.tryAs(p.name)));
    for (const p of PERSONAS) {
      expect(screen.getByText(p.tryThis)).toBeTruthy();
      if (p.university) expect(screen.getByText(p.university, { exact: false })).toBeTruthy();
    }
  });

  it('each card is a form posting its persona to /api/demo/start', () => {
    render(<DemoPicker personas={PERSONAS} />);
    const forms = [...document.querySelectorAll('form')];
    expect(forms).toHaveLength(6);
    forms.forEach((form, i) => {
      expect(form.getAttribute('action')).toBe('/api/demo/start');
      expect(form.getAttribute('method')).toBe('post');
      const input = form.querySelector('input[name="persona"]') as HTMLInputElement;
      expect(input.type).toBe('hidden');
      expect(input.value).toBe(PERSONAS[i]?.id);
    });
  });

  it('says why when a start was refused', () => {
    render(<DemoPicker personas={PERSONAS} status="busy" />);
    expect(screen.getByRole('alert').textContent).toBe(en.demo.busy);
    cleanup();
    render(<DemoPicker personas={PERSONAS} status="unavailable" />);
    expect(screen.getByRole('alert').textContent).toBe(en.demo.unavailable);
  });

  it('/sign-in is titled for the demo in demo mode, not "Sign in with your cellphone number"', async () => {
    const { generateMetadata } = await import('../app/sign-in/page');
    const previous = process.env['UF_DEPLOYMENT'];
    try {
      process.env['UF_DEPLOYMENT'] = 'demo';
      expect(generateMetadata().title).toBe(en.demo.signInTitle);
      process.env['UF_DEPLOYMENT'] = '';
      expect(generateMetadata().title).toBe(en.auth.title);
    } finally {
      process.env['UF_DEPLOYMENT'] = previous;
    }
  });

  // The owner, 2026-10-23: `/` is the real landing page on the demo too, and the picker moved to
  // its own route; /sign-in on the demo offers it (demo-signup-ui.test.tsx renders all three).
  it('is what /demo shows, in demo mode only; / and /sign-in link to it', () => {
    const demo = read('../app/demo/page.tsx');
    expect(demo).toMatch(/isDemo\(\)/);
    expect(demo).toMatch(/<DemoPicker/);
    for (const page of ['../app/page.tsx', '../app/sign-in/page.tsx']) {
      const source = read(page);
      expect(source, page).toMatch(/isDemo\(\)/);
      expect(source, page).not.toMatch(/<DemoPicker/);
      expect(source, page).toMatch(/['"]\/demo['"]/);
    }
  });
});
