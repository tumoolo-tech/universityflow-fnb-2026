// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { en } from '@universityflow/content';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CvDocument, CvInitial, CvSelectionView } from '../app/(app)/cv/cv-types';
import { CvView } from '../app/(app)/cv/cv-view';
import { formatDate } from '../lib/client/api';
import { cvCopy } from '../lib/server/cv-copy';

/**
 * Wave 5 (2026-10-24) on the My CV page:
 * - A10-58 "Report this CV" under a fitted CV's preview (design §11, A10-35's pattern): a quiet
 *   button that opens the reasons in place, a reason from the fixed list, a thank-you that takes
 *   the form's place and focus; a reported CV says so; a base CV has none.
 * - A11-38 Delete on each CV in the list, asked on the page first (never `window.confirm`), focus
 *   moved sensibly: to the question, back to Delete on Keep it, to the list's heading once gone.
 * - A2-47 the preview's CV as structure: headings, lists and paragraphs, never the Markdown marks.
 * Synthetic data only.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const copy = cvCopy();
const t = en.cv;
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const view: CvSelectionView = {
  selection: {
    surname: null,
    label: null,
    summary: null,
    email: null,
    phone: null,
    city: null,
    region: null,
    includeSchool: false,
    subjectIds: [],
    includeOffer: false,
    moduleCodes: [],
    entryIds: [],
  },
  available: { school: null, subjects: [], offer: null, modules: [], entries: [] },
  ready: false,
  missing: ['education'],
  omitted: [],
};

function doc(over: Partial<CvDocument> = {}): CvDocument {
  return {
    id: ID(9),
    kind: 'draft',
    status: 'ready',
    problem: null,
    advertTitle: null,
    advertCompany: null,
    markdown: '# Thandi Example\n\nSynthetic High School',
    gaps: [],
    atsCoverage: null,
    atsMatched: [],
    atsMissing: [],
    atsMissingMust: [],
    hasPdf: true,
    bytes: 1200,
    confirmedAt: null,
    createdAt: '2026-10-20T08:00:00.000Z',
    finishedAt: '2026-10-20T08:01:00.000Z',
    ...over,
  };
}

const fitted = (over: Partial<CvDocument> = {}) =>
  doc({ id: ID(8), kind: 'tailored', advertTitle: 'Intern', ...over });

function initial(over: Partial<CvInitial> = {}): CvInitial {
  return {
    optIn: {
      optedInAt: '2026-10-19T08:00:00.000Z',
      version: 'cv-optin-v1',
      purposes: ['cv.draft', 'cv.tailor', 'cv.ats'],
    },
    wordingCovers: true,
    canShare: false,
    entries: [],
    view,
    documents: [],
    shares: [],
    ...over,
  };
}

type Reply = { status?: number; json: unknown };

function serve(routes: Record<string, Reply>) {
  const calls: Array<{ key: string; body: unknown }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const key = `${init.method ?? 'GET'} ${url}`;
      const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      calls.push({ key, body });
      const route = routes[key];
      if (!route) return Response.json({ error: 'not-found' }, { status: 404 });
      return Response.json(route.json, { status: route.status ?? 200 });
    }),
  );
  return calls;
}

function page(start: CvInitial) {
  return render(<CvView initial={start} copy={copy} pollMs={10} navigate={vi.fn()} />);
}

async function openPreview(name: string) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${t.list.open} ${name}`) }));
  return screen.findByRole('region', { name: t.preview.title(name) });
}

describe('Report this CV (A10-58)', () => {
  it('offers it under a fitted CV only, and sends one reason from the list', async () => {
    const calls = serve({
      [`POST /api/me/cv/documents/${ID(8)}/report`]: { json: { status: 'reported' } },
    });
    page(initial({ documents: [fitted(), doc()] }));
    const preview = await openPreview(t.list.tailored('Intern'));
    fireEvent.click(within(preview).getByRole('button', { name: t.report.open }));
    const reasons = within(preview).getByRole('group', { name: t.report.question });
    const first = within(reasons).getByRole('radio', { name: t.report.reasons.untrue });
    await waitFor(() => expect(document.activeElement).toBe(first));
    expect(within(reasons).getAllByRole('radio')).toHaveLength(3);
    // No free text (hard rule 4).
    expect(within(preview).queryByRole('textbox')).toBeNull();
    fireEvent.click(first);
    fireEvent.click(within(preview).getByRole('button', { name: t.report.send }));
    const thanks = await within(preview).findByText(t.report.sent);
    await waitFor(() => expect(document.activeElement).toBe(thanks.closest('[tabindex]')));
    expect(calls).toEqual([
      { key: `POST /api/me/cv/documents/${ID(8)}/report`, body: { reason: 'untrue' } },
    ]);
    // Not "harmful": no help line.
    expect(within(preview).queryByText(t.report.help)).toBeNull();

    fireEvent.click(within(preview).getByRole('button', { name: t.preview.close }));
    const base = await openPreview(t.list.draft);
    expect(within(base).queryByRole('button', { name: t.report.open })).toBeNull();
  });

  it('after "harmful or upsetting", says where to find someone now', async () => {
    serve({ [`POST /api/me/cv/documents/${ID(8)}/report`]: { json: { status: 'reported' } } });
    page(initial({ documents: [fitted()] }));
    const preview = await openPreview(t.list.tailored('Intern'));
    fireEvent.click(within(preview).getByRole('button', { name: t.report.open }));
    fireEvent.click(within(preview).getByRole('radio', { name: t.report.reasons.harmful }));
    fireEvent.click(within(preview).getByRole('button', { name: t.report.send }));
    const help = await within(preview).findByRole('link', { name: t.report.help });
    expect(help.getAttribute('href')).toBe('/help');
  });

  it('says a CV already reported is reported, with no button', async () => {
    page(initial({ documents: [fitted()], reported: [ID(8)] }));
    const preview = await openPreview(t.list.tailored('Intern'));
    expect(within(preview).getByText(t.report.reported)).toBeTruthy();
    expect(within(preview).queryByRole('button', { name: t.report.open })).toBeNull();
  });

  it('Cancel closes it and gives focus back; a failed send says so in place', async () => {
    serve({ [`POST /api/me/cv/documents/${ID(8)}/report`]: { status: 500, json: {} } });
    page(initial({ documents: [fitted()] }));
    const preview = await openPreview(t.list.tailored('Intern'));
    fireEvent.click(within(preview).getByRole('button', { name: t.report.open }));
    fireEvent.click(within(preview).getByRole('radio', { name: t.report.reasons.other }));
    fireEvent.click(within(preview).getByRole('button', { name: t.report.send }));
    expect((await within(preview).findByRole('alert')).textContent).toBe(t.report.error);
    fireEvent.click(within(preview).getByRole('button', { name: t.report.cancel }));
    const open = within(preview).getByRole('button', { name: t.report.open });
    await waitFor(() => expect(document.activeElement).toBe(open));
  });
});

describe('deleting one CV (A11-38)', () => {
  const date = formatDate(doc().createdAt);

  it('asks on the page first, never window.confirm, then deletes with one DELETE', async () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);
    const calls = serve({ [`DELETE /api/me/cv/documents/${ID(9)}`]: { json: { deleted: true } } });
    page(initial({ documents: [doc(), fitted()] }));
    const list = screen.getByRole('region', { name: t.list.title });
    fireEvent.click(within(list).getByRole('button', { name: t.remove.name(t.list.draft, date) }));
    const ask = within(list).getByText(t.remove.ask(t.list.draft));
    await waitFor(() => expect(document.activeElement).toBe(ask));
    expect(calls).toEqual([]);
    fireEvent.click(within(list).getByRole('button', { name: t.remove.yes }));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(t.remove.done(t.list.draft)),
    );
    expect(calls).toEqual([{ key: `DELETE /api/me/cv/documents/${ID(9)}`, body: undefined }]);
    expect(confirm).not.toHaveBeenCalled();
    // Gone from the list; focus to the list's heading, since its button went with it.
    expect(within(list).queryByText(t.list.draft)).toBeNull();
    expect(within(list).getByText(t.list.tailored('Intern'))).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(list).getByRole('heading', { name: t.list.title }),
      ),
    );
  });

  it('Keep it takes the question away and gives focus back to Delete', async () => {
    const calls = serve({});
    page(initial({ documents: [doc()] }));
    const list = screen.getByRole('region', { name: t.list.title });
    fireEvent.click(within(list).getByRole('button', { name: t.remove.name(t.list.draft, date) }));
    fireEvent.click(within(list).getByRole('button', { name: t.remove.keep }));
    const again = within(list).getByRole('button', { name: t.remove.name(t.list.draft, date) });
    await waitFor(() => expect(document.activeElement).toBe(again));
    expect(within(list).queryByText(t.remove.ask(t.list.draft))).toBeNull();
    expect(calls).toEqual([]);
  });

  it('offers no Delete for a CV still being made, and shows a refusal in the list', async () => {
    serve({
      [`DELETE /api/me/cv/documents/${ID(9)}`]: {
        status: 409,
        json: { error: 'state', detail: 'cv-busy' },
      },
    });
    page(initial({ documents: [doc({ id: ID(7), status: 'queued', markdown: null }), doc()] }));
    const list = screen.getByRole('region', { name: t.list.title });
    expect(within(list).getAllByRole('button', { name: /^Delete / })).toHaveLength(1);
    fireEvent.click(within(list).getByRole('button', { name: t.remove.name(t.list.draft, date) }));
    fireEvent.click(within(list).getByRole('button', { name: t.remove.yes }));
    expect((await within(list).findByRole('alert')).textContent).toBe(t.errors['cv-busy']);
  });

  it('closes the preview of the CV it deletes', async () => {
    serve({ [`DELETE /api/me/cv/documents/${ID(9)}`]: { json: { deleted: true } } });
    page(initial({ documents: [doc()] }));
    await openPreview(t.list.draft);
    const list = screen.getByRole('region', { name: t.list.title });
    fireEvent.click(within(list).getByRole('button', { name: t.remove.name(t.list.draft, date) }));
    fireEvent.click(within(list).getByRole('button', { name: t.remove.yes }));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: t.preview.title(t.list.draft) })).toBeNull(),
    );
  });
});

describe('the preview’s CV as structure (A2-47)', () => {
  it('shows headings, lists and paragraphs, never the Markdown marks', async () => {
    const markdown = [
      '# Thandi Example',
      '',
      'Grade 12 learner',
      '',
      '## Education',
      '',
      '### Example High School',
      '',
      '- Subjects: Mathematics 71%',
      '- **Result:** *distinction*',
      '',
      '## Projects',
      '',
      '[Code](https://example.org/bus) · 1 \\# 2',
    ].join('\n');
    page(initial({ documents: [doc({ markdown })] }));
    const preview = await openPreview(t.list.draft);
    expect(within(preview).getByRole('heading', { level: 3, name: 'Thandi Example' })).toBeTruthy();
    expect(within(preview).getByRole('heading', { level: 4, name: 'Education' })).toBeTruthy();
    expect(
      within(preview).getByRole('heading', { level: 5, name: 'Example High School' }),
    ).toBeTruthy();
    const items = within(preview)
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(items).toEqual(['Subjects: Mathematics 71%', 'Result: distinction']);
    expect(within(preview).getByText('Result:').tagName).toBe('STRONG');
    expect(within(preview).getByText('distinction').tagName).toBe('EM');
    const link = within(preview).getByRole('link', { name: 'Code' });
    expect(link.getAttribute('href')).toBe('https://example.org/bus');
    expect(within(preview).getByText('Grade 12 learner').tagName).toBe('P');
    // An escaped mark prints as itself; no "#" or "**" is left over anywhere else.
    expect(preview.textContent).toContain('1 # 2');
    expect(preview.textContent).not.toMatch(/##|\*\*|^# /m);
  });

  it('never makes a link of an unsafe one, and never renders HTML in the text', async () => {
    const markdown = '[click](javascript:alert(1)) [local](https://localhost/x) <b>bold</b>';
    page(initial({ documents: [doc({ markdown })] }));
    const preview = await openPreview(t.list.draft);
    expect(within(preview).queryByRole('link')).toBeNull();
    expect(preview.querySelector('b')).toBeNull();
    expect(preview.textContent).toContain('<b>bold</b>');
  });
});
