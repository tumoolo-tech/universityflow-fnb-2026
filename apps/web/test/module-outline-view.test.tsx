// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { moduleOutline as o } from '@universityflow/content';
import { draftFromModuleOutline, sampleModuleOutline } from '@universityflow/documents';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OutlinesResponse } from '@/lib/server/module-outlines';

/**
 * The module outline page (Phase 6b): the demo's "Use a sample module outline", then the check
 * part by part (how marks work, dates, books, who teaches it), "Not in my outline" for any, and
 * weights that don't add up refused on the page with their total, never changed (hard rule 6).
 */

const { OutlineView } = await import('../app/(app)/modules/outline/outline-view');

const EMPTY: OutlinesResponse = { outlines: [], registration: null, defaultYear: 2027 };
const DRAFT = draftFromModuleOutline(sampleModuleOutline(1));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function api() {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/demo/sample-outline') {
      return Response.json({ documentId: 'd1', outline: DRAFT, sample: true });
    }
    if (url === '/api/module-outlines' && init?.method === 'PUT') {
      return Response.json({ id: 'o1', ...EMPTY });
    }
    return Response.json({ error: 'not-found' }, { status: 404 });
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

async function openSample() {
  render(<OutlineView initial={EMPTY} direct={false} demo />);
  fireEvent.click(screen.getByRole('button', { name: o.useSample }));
  return screen.findByRole('heading', { name: o.sections.components });
}

const part = (name: string) => screen.findByRole('heading', { name });

describe('the module outline page', () => {
  it('offers the SAMPLE outline on the demo only', () => {
    render(<OutlineView initial={EMPTY} direct={false} demo={false} />);
    expect(screen.queryByRole('button', { name: o.useSample })).toBeNull();
    expect(screen.getByText(o.empty)).toBeTruthy();
  });

  it('checks the outline part by part, "Not in my outline" for one, and saves what was confirmed', async () => {
    const fetch = api();
    await openSample();
    expect(screen.getByText(o.step(1, 4))).toBeTruthy();
    expect(screen.getByText(o.components.total(100))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: o.confirmPart }));
    await part(o.sections.dates);
    fireEvent.click(screen.getByRole('button', { name: o.notInOutline }));
    await part(o.sections.books);
    fireEvent.click(screen.getByRole('button', { name: o.confirmPart }));
    await part(o.sections.people);
    fireEvent.click(screen.getByRole('button', { name: o.save }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const [url, init] = fetch.mock.calls[1] ?? [];
    expect(url).toBe('/api/module-outlines');
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      moduleCode: 'DEMO1001',
      academicYear: 2027,
      term: 'S1',
      documentId: 'd1',
      dates: { status: 'not-in-outline' },
      books: { status: 'confirmed', items: [{ isbn: '9780306406157' }, { isbn: null }] },
      people: { status: 'confirmed', items: [{ email: 'a.sample@example.org', phone: null }] },
    });
    expect(body.components.items.map((c: { weight: number }) => c.weight)).toEqual([
      15, 15, 10, 60,
    ]);
    expect(body.components.dpRequirement.percent).toBe(40);
    expect(await screen.findByText(o.saved)).toBeTruthy();
  });

  it('refuses weights that don’t add up, says their total, and changes none of them', async () => {
    const fetch = api();
    await openSample();
    const weight = screen.getByLabelText(o.components.weight(1)) as HTMLInputElement;
    fireEvent.change(weight, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: o.confirmPart }));
    expect((await screen.findAllByText(o.components.notHundred(90))).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: o.sections.components })).toBeTruthy();
    expect(weight.value).toBe('5');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('refuses a lecturer’s cellphone number on the page (D3)', async () => {
    api();
    await openSample();
    fireEvent.click(screen.getByRole('button', { name: o.confirmPart }));
    await part(o.sections.dates);
    fireEvent.click(screen.getByRole('button', { name: o.confirmPart }));
    await part(o.sections.books);
    fireEvent.click(screen.getByRole('button', { name: o.confirmPart }));
    await part(o.sections.people);
    const phone = screen.getByLabelText(o.people.phone(1));
    fireEvent.change(phone, { target: { value: ['082', '555', '0123'].join(' ') } });
    fireEvent.click(screen.getByRole('button', { name: o.save }));
    expect(await screen.findByText(o.people.phoneInvalid)).toBeTruthy();
    expect(phone.getAttribute('aria-invalid')).toBe('true');
  });

  it('says why when the consent doesn’t name module outlines yet (D9)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ error: 'consent-outdated', detail: 'module-outlines' }, { status: 403 }),
      ),
    );
    render(<OutlineView initial={EMPTY} direct={false} demo />);
    fireEvent.click(screen.getByRole('button', { name: o.useSample }));
    expect((await screen.findByRole('alert')).textContent).toBe(o.consentNotYet);
  });
});
