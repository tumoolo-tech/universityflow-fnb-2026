// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import { en } from '@universityflow/content';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The judges' three-minute guide (DEMO-walk): `/demo/guide`, linked from the picker, demo only.
 * For each made-up learner, two to four things to try and a button that starts that learner, as
 * the picker's does (a plain form, so it works before any script loads); and plainly what is made
 * up or a stand-in. Production has no such page and no link to it.
 */

vi.mock('@/lib/server/session', () => ({ currentStudent: async () => null }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`redirect ${to}`);
  },
  notFound: () => {
    throw new Error('not found');
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

const GuidePage = (await import('../app/demo/guide/page')).default;
const DemoPage = (await import('../app/demo/page')).default;
const FrontDoor = (await import('../app/page')).default;

const guide = en.demoPersonas.guide;

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('/demo/guide', () => {
  it('is not found outside a demo', async () => {
    vi.stubEnv('UF_DEPLOYMENT', '');
    await expect(GuidePage()).rejects.toThrow('not found');
  });

  it('names what is made up or a stand-in, before the learners', async () => {
    vi.stubEnv('UF_DEPLOYMENT', 'demo');
    render(await GuidePage());
    expect(screen.getByRole('heading', { level: 1, name: guide.title })).toBeTruthy();
    const honest = screen.getByRole('region', { name: guide.honestTitle });
    for (const line of guide.honest) expect(within(honest).getByText(line)).toBeTruthy();
  });

  it('gives each learner their things to try and a button that starts them', async () => {
    vi.stubEnv('UF_DEPLOYMENT', 'demo');
    render(await GuidePage());
    for (const [id, persona] of Object.entries(en.demoPersonas.personas)) {
      const card = screen.getByRole('region', {
        name: guide.personaHeading(persona.name, persona.stage),
      });
      const tries = guide.tries[id as keyof typeof guide.tries];
      const items = within(card)
        .getAllByRole('listitem')
        .map((li) => li.textContent);
      expect(items).toEqual([...tries]);
      const start = within(card).getByRole('button', { name: en.demo.tryAs(persona.name) });
      const form = start.closest('form');
      expect(form?.getAttribute('action')).toBe('/api/demo/start');
      expect(form?.getAttribute('method')).toBe('post');
      const input = form?.querySelector<HTMLInputElement>('input[name="persona"]');
      expect(input?.value).toBe(id);
    }
    expect(screen.getByRole('link', { name: guide.back }).getAttribute('href')).toBe('/demo');
  });

  it('is linked from the picker', async () => {
    vi.stubEnv('UF_DEPLOYMENT', 'demo');
    render(await DemoPage());
    expect(screen.getByRole('link', { name: guide.pickerLink }).getAttribute('href')).toBe(
      '/demo/guide',
    );
  });

  it('is never linked from production’s landing page', async () => {
    vi.stubEnv('UF_DEPLOYMENT', '');
    const { container } = render(await FrontDoor());
    expect(container.querySelector('a[href="/demo/guide"]')).toBeNull();
    expect(screen.queryByText(guide.pickerLink)).toBeNull();
  });
});
