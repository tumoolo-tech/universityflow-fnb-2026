// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { en } from '@universityflow/content';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CvDocument, CvEntry, CvInitial, CvSelectionView } from '../app/(app)/cv/cv-types';
import { CvView } from '../app/(app)/cv/cv-view';
import { cvCopy } from '../lib/server/cv-copy';

/**
 * My CV's page (docs/design/mmereko-api-proposal.md §9, §10.5, §11): the opt-in card, what goes
 * on the CV with where each tick comes from, the learner's projects and skills, Make my CV, the
 * list with its status words, a preview with Download PDF, the gaps and "Check every line is
 * true", Fit it to a job with its ATS score in words, sharing for adults only (D6), and stopping
 * with the download offered first (D15). Its copy comes as props. Synthetic data only.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const copy = cvCopy();
const t = en.cv;

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const emptySelection = {
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
};

const view: CvSelectionView = {
  selection: emptySelection,
  available: {
    school: { name: 'Synthetic High School', endYear: 2027 },
    subjects: [
      { id: 'mathematics', name: 'Mathematics', percent: 71 },
      { id: 'english-hl', name: 'English Home Language', percent: 64 },
    ],
    offer: null,
    modules: [],
    entries: [],
  },
  ready: false,
  missing: ['education'],
  omitted: [],
};

const entry: CvEntry = {
  id: ID(1),
  kind: 'project',
  title: 'Weather station',
  organisation: 'Robotics club',
  role: 'Builder',
  startDate: '2026-02',
  endDate: null,
  description: null,
  highlights: [],
  keywords: [],
  evidence: [],
  linkedModules: [],
  position: 0,
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
    gaps: ['Add a project with a link to your work.'],
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

const optedIn = {
  optedInAt: '2026-10-19T08:00:00.000Z',
  version: 'cv-optin-v1',
  purposes: ['cv.draft', 'cv.tailor', 'cv.ats'],
};

function initial(over: Partial<CvInitial> = {}): CvInitial {
  return {
    optIn: optedIn,
    wordingCovers: true,
    canShare: false,
    entries: [],
    view,
    documents: [],
    shares: [],
    ...over,
  };
}

type Handler = (body: unknown, url: string) => { status?: number; json: unknown };

/** A fake of the CV API behind `fetch`: each "METHOD path" answers; every call is recorded. */
function serve(routes: Record<string, Handler | { status?: number; json: unknown }>) {
  const calls: Array<{ key: string; body: unknown }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const key = `${init.method ?? 'GET'} ${url}`;
      const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      calls.push({ key, body });
      const route = routes[key];
      if (!route) return Response.json({ error: 'not-found' }, { status: 404 });
      const reply = typeof route === 'function' ? route(body, url) : route;
      return Response.json(reply.json, { status: reply.status ?? 200 });
    }),
  );
  return calls;
}

function page(start: CvInitial = initial(), navigate = vi.fn()) {
  return render(<CvView initial={start} copy={copy} pollMs={10} navigate={navigate} />);
}

describe('the opt-in card (§9.2)', () => {
  it('shows the draft wording and, before the opt-in, nothing else', () => {
    page(initial({ optIn: null }));
    const card = screen.getByRole('region', { name: t.optIn.title });
    expect(within(card).getByText(t.optIn.body)).toBeTruthy();
    expect(screen.queryByRole('region', { name: t.what.title })).toBeNull();
    // An under-18 is never offered sharing (D6).
    expect(screen.queryByLabelText(t.optIn.share)).toBeNull();
  });

  it('opts in with one POST and moves focus to "What goes on my CV"', async () => {
    const calls = serve({
      'POST /api/me/cv/opt-in': { json: { optIn: optedIn } },
    });
    page(initial({ optIn: null }));
    fireEvent.click(screen.getByRole('button', { name: t.optIn.agree }));
    const heading = await screen.findByRole('heading', { name: t.what.title });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(calls).toEqual([{ key: 'POST /api/me/cv/opt-in', body: { share: false } }]);
  });

  it('offers an adult sharing too, unticked', async () => {
    const calls = serve({ 'POST /api/me/cv/opt-in': { json: { optIn: optedIn } } });
    page(initial({ optIn: null, canShare: true }));
    const share = screen.getByLabelText(t.optIn.share) as HTMLInputElement;
    expect(share.checked).toBe(false);
    fireEvent.click(share);
    fireEvent.click(screen.getByRole('button', { name: t.optIn.agree }));
    await screen.findByRole('heading', { name: t.what.title });
    expect(calls[0]?.body).toEqual({ share: true });
  });

  it('while the wording doesn’t name Mmereko, says so and offers no button', () => {
    page(initial({ optIn: null, wordingCovers: false }));
    expect(screen.getByText(t.errors['cv-consent'])).toBeTruthy();
    expect(screen.queryByRole('button', { name: t.optIn.agree })).toBeNull();
  });
});

describe('what goes on my CV (§10.5, D9, D11)', () => {
  it('groups the ticks, says where each comes from, and leaves marks off by default', () => {
    page();
    const card = screen.getByRole('region', { name: t.what.title });
    const marks = within(card).getByRole('group', { name: t.what.subjects });
    expect(within(marks).getByText(t.what.from.report)).toBeTruthy();
    expect(within(marks).getByText(t.what.subjectsHint)).toBeTruthy();
    for (const box of within(marks).getAllByRole('checkbox')) {
      expect((box as HTMLInputElement).checked).toBe(false);
    }
    const school = within(card).getByRole('group', { name: t.what.school });
    expect(within(school).getByText(t.what.from.profile)).toBeTruthy();
    const contact = within(card).getByRole('group', { name: t.what.contact });
    expect(within(contact).getByText(t.what.contactHint)).toBeTruthy();
    expect(within(contact).getByText(t.what.from.typed)).toBeTruthy();
    // The contact fields start empty: never the sign-in phone (D9).
    expect((within(contact).getByLabelText(t.what.phone) as HTMLInputElement).value).toBe('');
  });

  it('saves the whole selection with one PUT and says so', async () => {
    const calls = serve({
      'PUT /api/me/cv/selection': (body) => ({
        json: { ...view, selection: body, ready: true, missing: [], care: null },
      }),
    });
    page();
    fireEvent.click(screen.getByLabelText('Synthetic High School'));
    fireEvent.click(screen.getByLabelText(t.what.subject('Mathematics', 71)));
    fireEvent.change(screen.getByLabelText(t.what.surname), { target: { value: 'Example' } });
    fireEvent.click(screen.getByRole('button', { name: t.what.save }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(t.what.saved));
    expect(calls[0]?.body).toEqual({
      ...emptySelection,
      surname: 'Example',
      includeSchool: true,
      subjectIds: ['mathematics'],
    });
  });

  it('says what is missing before a CV can be made', () => {
    page();
    expect(screen.getByText(t.what.missingTitle)).toBeTruthy();
    expect(screen.getByText(t.what.missing.education)).toBeTruthy();
  });
});

describe('my projects and skills (§7.5)', () => {
  it('adds an entry with an evidence link in one POST, and lists it', async () => {
    const calls = serve({
      'POST /api/me/cv/entries': (body) => ({
        json: { entry: { ...entry, ...(body as object), id: ID(2) }, care: null },
      }),
    });
    page();
    fireEvent.click(screen.getByRole('button', { name: t.entries.add }));
    const form = screen.getByRole('form', { name: t.entries.add });
    fireEvent.change(within(form).getByLabelText(t.entries.name), {
      target: { value: 'School app' },
    });
    fireEvent.change(within(form).getByLabelText(t.entries.highlights), {
      target: { value: 'Used by 40 learners\n\nWon the science fair' },
    });
    fireEvent.click(within(form).getByRole('button', { name: t.entries.addLink }));
    fireEvent.change(within(form).getByLabelText(t.entries.evidenceUrl), {
      target: { value: 'https://example.org/school-app' },
    });
    fireEvent.click(within(form).getByRole('button', { name: t.entries.save }));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(t.entries.added('School app')),
    );
    expect(calls[0]?.body).toEqual({
      kind: 'project',
      title: 'School app',
      organisation: null,
      role: null,
      startDate: null,
      endDate: null,
      description: null,
      highlights: ['Used by 40 learners', 'Won the science fair'],
      keywords: [],
      evidence: [{ kind: 'repository', url: 'https://example.org/school-app', label: null }],
      linkedModules: [],
    });
    // It can now be ticked for the CV.
    const tick = within(screen.getByRole('group', { name: t.what.entries })).getByLabelText(
      'School app',
    );
    expect((tick as HTMLInputElement).checked).toBe(false);
    // Focus goes to the new entry's Edit button, not the page.
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: t.entries.edit('School app') }),
      ),
    );
  });

  it('shows the crisis card when the API answers with care, and the words are saved anyway', async () => {
    serve({
      'POST /api/me/cv/entries': {
        json: {
          entry: { ...entry, id: ID(3), title: 'A hard year' },
          care: {
            level: 'crisis',
            card: { kind: 'crisis-card', cover: 'none', helplines: [] },
          },
        },
      },
    });
    page();
    fireEvent.click(screen.getByRole('button', { name: t.entries.add }));
    fireEvent.change(screen.getByLabelText(t.entries.name), { target: { value: 'A hard year' } });
    fireEvent.click(screen.getByRole('button', { name: t.entries.save }));
    expect(await screen.findByText(en.planMaps.care.crisisLead)).toBeTruthy();
    expect(screen.getByRole('heading', { name: en.crisis.cardTitle })).toBeTruthy();
    expect(screen.getByRole('button', { name: t.entries.edit('A hard year') })).toBeTruthy();
  });

  it('deletes an entry only after asking in the page', async () => {
    const calls = serve({ [`DELETE /api/me/cv/entries/${ID(1)}`]: { json: { ok: true } } });
    page(initial({ entries: [entry] }));
    fireEvent.click(screen.getByRole('button', { name: t.entries.remove(entry.title) }));
    expect(screen.getByText(t.entries.removeAsk(entry.title))).toBeTruthy();
    expect(calls).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: t.entries.removeYes }));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(t.entries.removed(entry.title)),
    );
    expect(calls.map((c) => c.key)).toEqual([`DELETE /api/me/cv/entries/${ID(1)}`]);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: t.entries.add })),
    );
  });
});

describe('make my CV, and the list (§10.5, §11)', () => {
  const ready = { ...view, ready: true, missing: [] as const };

  it('queues a CV, shows "Being made" with its progress, then "Ready" once the jobs ran', async () => {
    let polls = 0;
    serve({
      'POST /api/me/cv/drafts': {
        status: 202,
        json: { document: doc({ status: 'queued', markdown: null, hasPdf: false, gaps: [] }) },
      },
      'GET /api/me/cv/documents': () => {
        polls += 1;
        return {
          json: {
            documents: [
              polls < 2 ? doc({ status: 'submitted', markdown: null, hasPdf: false }) : doc(),
            ],
          },
        };
      },
    });
    page(initial({ view: ready }));
    fireEvent.click(screen.getByRole('button', { name: t.make.button }));
    const list = await screen.findByRole('region', { name: t.list.title });
    expect(await within(list).findByText(t.status.queued)).toBeTruthy();
    // The only motion: hidden from screen readers, and gone under reduced motion (globals.css).
    const progress = list.querySelector('.uf-cv-progress');
    expect(progress?.getAttribute('aria-hidden')).toBe('true');
    expect(await within(list).findByText(t.status.ready)).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(t.list.ready));
    expect(list.querySelector('.uf-cv-progress')).toBeNull();
  });

  it('says why a CV can’t be made yet, in the words of the reason', async () => {
    serve({
      'POST /api/me/cv/drafts': {
        status: 409,
        json: { error: 'state', detail: 'cv-busy' },
      },
    });
    page(initial({ view: ready }));
    fireEvent.click(screen.getByRole('button', { name: t.make.button }));
    expect(await screen.findByText(t.errors['cv-busy'])).toBeTruthy();
  });

  it('shows the crisis card when the words would worry us, sends nothing, and sends on a second press (A10-56)', async () => {
    const calls = serve({
      'POST /api/me/cv/drafts': (body) =>
        (body as { sendAnyway?: boolean } | undefined)?.sendAnyway
          ? {
              status: 202,
              json: {
                document: doc({ status: 'queued', markdown: null, hasPdf: false }),
                care: null,
              },
            }
          : {
              json: {
                document: null,
                care: {
                  level: 'crisis',
                  card: { kind: 'crisis-card', cover: 'none', helplines: [] },
                },
              },
            },
      'GET /api/me/cv/documents': { json: { documents: [] } },
    });
    page(initial({ view: ready }));
    fireEvent.click(screen.getByRole('button', { name: t.make.button }));
    expect(await screen.findByText(en.planMaps.care.crisisLead)).toBeTruthy();
    expect(screen.getByRole('heading', { name: en.crisis.cardTitle })).toBeTruthy();
    expect(screen.getByText(t.make.held)).toBeTruthy();
    expect(screen.queryByText(t.status.queued)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: t.make.button }));
    expect(await screen.findByText(t.status.queued)).toBeTruthy();
    expect(calls.filter((c) => c.key === 'POST /api/me/cv/drafts').map((c) => c.body)).toEqual([
      undefined,
      { sendAnyway: true },
    ]);
  });

  it('says a CV that failed can be made again, in words', () => {
    page(initial({ documents: [doc({ status: 'failed', markdown: null, hasPdf: false })] }));
    expect(screen.getByText(t.status.failed)).toBeTruthy();
  });
});

describe('a CV’s preview (§10.5)', () => {
  it('shows the text, then downloads the PDF through a fresh 60-second link', async () => {
    const navigate = vi.fn();
    const pdf = {
      url: 'http://localhost/api/cv/pdf/x?exp=1&sig=s',
      expiresAt: '2026-10-20T08:02:00.000Z',
    };
    serve({ [`GET /api/me/cv/documents/${ID(9)}`]: { json: { document: doc(), pdf } } });
    page(initial({ documents: [doc()] }), navigate);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${t.list.open} `) }));
    const preview = await screen.findByRole('region', { name: t.preview.title(t.list.draft) });
    await waitFor(() =>
      expect(document.activeElement).toBe(within(preview).getByRole('heading', { level: 2 })),
    );
    expect(within(preview).getByText(/Synthetic High School/)).toBeTruthy();
    expect(within(preview).getByText('Add a project with a link to your work.')).toBeTruthy();
    fireEvent.click(within(preview).getByRole('button', { name: t.preview.download }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(pdf.url));
  });

  it('records "every line is true" with one POST', async () => {
    const calls = serve({
      [`POST /api/me/cv/documents/${ID(9)}/confirm`]: {
        json: { document: doc({ confirmedAt: '2026-10-21T08:00:00.000Z' }) },
      },
    });
    page(initial({ documents: [doc()] }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${t.list.open} `) }));
    fireEvent.click(await screen.findByRole('button', { name: t.preview.confirm }));
    const line = await screen.findByText(/You checked every line on/);
    // The button goes; focus moves to the line that replaces it.
    await waitFor(() => expect(document.activeElement).toBe(line));
    expect(calls.map((c) => c.key)).toEqual([`POST /api/me/cv/documents/${ID(9)}/confirm`]);
  });

  it('a fitted CV shows its ATS score as a number and its missing keywords as a list', async () => {
    const fitted = doc({
      kind: 'tailored',
      advertTitle: 'Junior developer',
      advertCompany: 'Example Labs',
      atsCoverage: 64,
      atsMissing: ['SQL', 'Git'],
      atsMissingMust: ['SQL'],
    });
    page(initial({ documents: [fitted] }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${t.list.open} `) }));
    const name = t.list.tailoredAt('Junior developer', 'Example Labs');
    const preview = await screen.findByRole('region', { name: t.preview.title(name) });
    expect(within(preview).getByText(t.tailor.scoreValue(64))).toBeTruthy();
    const meter = within(preview).getByLabelText(t.tailor.score) as HTMLMeterElement;
    expect(meter.tagName).toBe('METER');
    expect(meter.value).toBe(64);
    expect(meter.max).toBe(100);
    const missing = within(preview).getByRole('list', { name: t.tailor.missing });
    expect(
      within(missing)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['SQL', 'Git']);
  });

  it('fits a CV to a pasted advert with one POST', async () => {
    const calls = serve({
      'POST /api/me/cv/tailorings': {
        status: 202,
        json: { document: doc({ kind: 'tailored', status: 'queued', advertTitle: 'Intern' }) },
      },
      'GET /api/me/cv/documents': { json: { documents: [] } },
    });
    page(initial({ view: { ...view, ready: true, missing: [] } }));
    const card = screen.getByRole('region', { name: t.tailor.title });
    fireEvent.change(within(card).getByLabelText(t.tailor.jobTitle), {
      target: { value: 'Intern' },
    });
    fireEvent.change(within(card).getByLabelText(t.tailor.advert), {
      target: { value: 'We want someone who knows SQL.' },
    });
    fireEvent.click(within(card).getByRole('button', { name: t.tailor.button }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(t.tailor.started));
    expect(calls[0]).toEqual({
      key: 'POST /api/me/cv/tailorings',
      body: { advert: { title: 'Intern', company: null, text: 'We want someone who knows SQL.' } },
    });
  });

  it('holds an advert with crisis words: the card, nothing sent, then a second press (A10-55)', async () => {
    const calls = serve({
      'POST /api/me/cv/tailorings': (body) =>
        (body as { sendAnyway?: boolean }).sendAnyway
          ? {
              status: 202,
              json: {
                document: doc({ kind: 'tailored', status: 'queued', advertTitle: 'Intern' }),
                care: null,
              },
            }
          : {
              json: {
                document: null,
                care: {
                  level: 'crisis',
                  card: { kind: 'crisis-card', cover: 'none', helplines: [] },
                },
              },
            },
      'GET /api/me/cv/documents': { json: { documents: [] } },
    });
    page(initial({ view: { ...view, ready: true, missing: [] } }));
    const card = screen.getByRole('region', { name: t.tailor.title });
    fireEvent.change(within(card).getByLabelText(t.tailor.jobTitle), {
      target: { value: 'Intern' },
    });
    fireEvent.change(within(card).getByLabelText(t.tailor.advert), {
      target: { value: 'Synthetic words that worry us.' },
    });
    fireEvent.click(within(card).getByRole('button', { name: t.tailor.button }));
    expect(await within(card).findByText(en.planMaps.care.crisisLead)).toBeTruthy();
    expect(within(card).getByText(t.make.held)).toBeTruthy();
    // The advert stays in the box, to change or to send.
    expect((within(card).getByLabelText(t.tailor.advert) as HTMLTextAreaElement).value).toBe(
      'Synthetic words that worry us.',
    );
    fireEvent.click(within(card).getByRole('button', { name: t.tailor.button }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(t.tailor.started));
    expect(calls.filter((c) => c.key === 'POST /api/me/cv/tailorings').map((c) => c.body)).toEqual([
      { advert: { title: 'Intern', company: null, text: 'Synthetic words that worry us.' } },
      {
        advert: { title: 'Intern', company: null, text: 'Synthetic words that worry us.' },
        sendAnyway: true,
      },
    ]);
  });

  it('says a fitted CV was written by an AI and is the learner’s to check; a base CV doesn’t (A10-57)', async () => {
    const fitted = doc({ kind: 'tailored', advertTitle: 'Intern', advertCompany: null });
    page(initial({ documents: [fitted] }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${t.list.open} `) }));
    const preview = await screen.findByRole('region', {
      name: t.preview.title(t.list.tailored('Intern')),
    });
    expect(within(preview).getByText(t.preview.tailoredNote)).toBeTruthy();
    cleanup();
    page(initial({ documents: [doc()] }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${t.list.open} `) }));
    const base = await screen.findByRole('region', { name: t.preview.title(t.list.draft) });
    expect(within(base).queryByText(t.preview.tailoredNote)).toBeNull();
  });
});

describe('sharing (§9.3, D6)', () => {
  it('is never offered to an under-18', () => {
    page(initial({ documents: [doc({ confirmedAt: '2026-10-21T08:00:00.000Z' })] }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${t.list.open} `) }));
    expect(screen.queryByRole('region', { name: t.sharing.title })).toBeNull();
    expect(screen.queryByText(t.optIn.addShare)).toBeNull();
  });

  it('gives an adult a link once, to copy, and switches it off', async () => {
    const share = {
      id: ID(20),
      documentId: ID(9),
      createdAt: '2026-10-21T08:00:00.000Z',
      expiresAt: '2026-11-20T08:00:00.000Z',
      revokedAt: null,
      viewCount: 0,
    };
    const calls = serve({
      'POST /api/me/cv/shares': {
        status: 201,
        json: { share, url: 'http://localhost/cv/s/synthetic-token' },
      },
      'DELETE /api/me/cv/shares': { json: { ok: true } },
    });
    page(
      initial({
        canShare: true,
        optIn: { ...optedIn, purposes: [...optedIn.purposes, 'cv.share'] },
        documents: [doc({ confirmedAt: '2026-10-21T08:00:00.000Z' })],
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${t.list.open} `) }));
    const card = await screen.findByRole('region', { name: t.sharing.title });
    expect((within(card).getByLabelText(t.sharing.days) as HTMLSelectElement).value).toBe('30');
    fireEvent.click(within(card).getByRole('button', { name: t.sharing.create }));
    const link = (await within(card).findByLabelText(t.sharing.link)) as HTMLInputElement;
    expect(link.value).toBe('http://localhost/cv/s/synthetic-token');
    expect(link.readOnly).toBe(true);
    expect(within(card).getByText(t.sharing.linkOnce)).toBeTruthy();
    expect(calls[0]?.body).toEqual({ documentId: ID(9), days: 30 });
    fireEvent.click(within(card).getByRole('button', { name: /^Switch off/ }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(t.sharing.switchedOff));
    expect(calls[1]).toEqual({ key: 'DELETE /api/me/cv/shares', body: { id: ID(20) } });
  });

  it('asks an adult to check every line before a link can be made', () => {
    page(
      initial({
        canShare: true,
        optIn: { ...optedIn, purposes: [...optedIn.purposes, 'cv.share'] },
        documents: [doc()],
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${t.list.open} `) }));
    const card = screen.getByRole('region', { name: t.sharing.title });
    expect(within(card).getByText(t.errors['cv-share-unchecked'])).toBeTruthy();
    expect(within(card).queryByRole('button', { name: t.sharing.create })).toBeNull();
  });
});

describe('stopping (§9.2, D15)', () => {
  it('offers each CV’s download first, then deletes everything with one DELETE', async () => {
    const navigate = vi.fn();
    const calls = serve({
      'DELETE /api/me/cv/opt-in': { json: { optIn: null, deleted: { cvs: 1 } } },
      [`GET /api/me/cv/documents/${ID(9)}`]: {
        json: { document: doc(), pdf: { url: 'http://localhost/pdf', expiresAt: '' } },
      },
    });
    page(initial({ documents: [doc()] }), navigate);
    const card = screen.getByRole('region', { name: t.withdraw.title });
    fireEvent.click(within(card).getByRole('button', { name: t.withdraw.start }));
    expect(within(card).getByText(t.withdraw.body)).toBeTruthy();
    const downloads = within(card).getByRole('list', { name: t.withdraw.downloadFirst });
    fireEvent.click(within(downloads).getByRole('button', { name: /Download PDF/ }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('http://localhost/pdf'));
    fireEvent.click(within(card).getByRole('button', { name: t.withdraw.confirm }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(t.withdraw.done));
    expect(calls.at(-1)?.key).toBe('DELETE /api/me/cv/opt-in');
    const heading = screen.getByRole('heading', { name: t.optIn.title });
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });
});

/**
 * Audit CV-A11 and CV-A2 (docs/audits/results/CV-A11.md, CV-A2.md): what the learner is told
 * before an advert goes to the AI abroad; an error shown where it happened; focus kept when the
 * pressed control goes; long words wrapping at 320px; the progress dots stopping.
 */
describe('audit CV-A11 and CV-A2', () => {
  const ready = { ...view, ready: true, missing: [] as const };
  const refuse = (detail: string) => ({ status: 422, json: { error: 'invalid', detail } });
  const refuseAt = (field: string) => ({
    status: 409,
    json: { error: 'state', detail: 'personal-number', field },
  });

  // A2-52 (3.3.1): a refusal said what was wrong but not where, so no field was marked.
  it('puts an entry’s refusal on the field it names: invalid, with the message under it (A2-52)', async () => {
    serve({ 'POST /api/me/cv/entries': refuseAt('description') });
    page();
    fireEvent.click(screen.getByRole('button', { name: t.entries.add }));
    const form = screen.getByRole('form', { name: t.entries.add });
    fireEvent.change(within(form).getByLabelText(t.entries.name), { target: { value: 'Club' } });
    fireEvent.click(within(form).getByRole('button', { name: t.entries.save }));
    const description = within(form).getByLabelText(t.entries.description);
    await waitFor(() => expect(description.getAttribute('aria-invalid')).toBe('true'));
    const alert = within(form).getByRole('alert');
    expect(alert.textContent).toBe(t.errors['personal-number']);
    expect(description.getAttribute('aria-describedby')?.split(' ')).toContain(alert.id);
    expect(within(form).getByLabelText(t.entries.name).getAttribute('aria-invalid')).toBeNull();
    // Once, on the field: not also in the form's notice.
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('marks an evidence link’s label by its place among the links sent (A2-52)', async () => {
    serve({ 'POST /api/me/cv/entries': refuseAt('evidence.0.label') });
    page();
    fireEvent.click(screen.getByRole('button', { name: t.entries.add }));
    const form = screen.getByRole('form', { name: t.entries.add });
    fireEvent.change(within(form).getByLabelText(t.entries.name), { target: { value: 'Club' } });
    fireEvent.click(within(form).getByRole('button', { name: t.entries.addLink }));
    fireEvent.click(within(form).getByRole('button', { name: t.entries.addLink }));
    const [first, second] = within(form).getAllByRole('group', { name: /^Link \d/ });
    if (!first || !second) throw new Error('two link groups');
    // The first link is left empty, so it isn't sent: the second is evidence 0.
    fireEvent.change(within(second).getByLabelText(t.entries.evidenceUrl), {
      target: { value: 'https://example.org/synthetic' },
    });
    fireEvent.click(within(form).getByRole('button', { name: t.entries.save }));
    const label = within(second).getByLabelText(t.entries.evidenceLabel);
    await waitFor(() => expect(label.getAttribute('aria-invalid')).toBe('true'));
    expect(within(first).getByLabelText(t.entries.evidenceLabel).getAttribute('aria-invalid')).toBe(
      null,
    );
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('puts a refused selection and a refused fitting on their fields (A2-52)', async () => {
    serve({
      'PUT /api/me/cv/selection': refuseAt('summary'),
      'POST /api/me/cv/tailorings': refuseAt('advert.text'),
    });
    page(initial({ view: ready }));
    const what = screen.getByRole('region', { name: t.what.title });
    fireEvent.click(within(what).getByRole('button', { name: t.what.save }));
    const summary = within(what).getByLabelText(t.what.summary);
    await waitFor(() => expect(summary.getAttribute('aria-invalid')).toBe('true'));
    expect(within(what).getByRole('alert').textContent).toBe(t.errors['personal-number']);
    const fit = screen.getByRole('region', { name: t.tailor.title });
    fireEvent.change(within(fit).getByLabelText(t.tailor.jobTitle), {
      target: { value: 'Intern' },
    });
    const advert = within(fit).getByLabelText(t.tailor.advert);
    fireEvent.change(advert, { target: { value: 'SQL.' } });
    fireEvent.click(within(fit).getByRole('button', { name: t.tailor.button }));
    await waitFor(() => expect(advert.getAttribute('aria-invalid')).toBe('true'));
    expect(summary.getAttribute('aria-invalid')).toBeNull();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('keeps a refusal in the card when it names no field the form has (A2-52)', async () => {
    serve({ 'PUT /api/me/cv/selection': refuseAt('somewhereElse') });
    page(initial({ view: ready }));
    const what = screen.getByRole('region', { name: t.what.title });
    fireEvent.click(within(what).getByRole('button', { name: t.what.save }));
    expect((await within(what).findByRole('alert')).textContent).toBe(t.errors['personal-number']);
    for (const box of within(what).getAllByRole('textbox')) {
      expect(box.getAttribute('aria-invalid')).toBeNull();
    }
  });

  it('says where the advert is pasted that a fitted CV is written by the AI abroad (A11-37)', () => {
    page(initial({ view: ready }));
    const card = screen.getByRole('region', { name: t.tailor.title });
    const note = within(card).getByText(t.tailor.aiNote);
    const button = within(card).getByRole('button', { name: t.tailor.button });
    expect(note.id).not.toBe('');
    expect(button.getAttribute('aria-describedby')?.split(' ')).toContain(note.id);
  });

  it('shows a refused entry inside its form, beside Save, and only there (A2-43)', async () => {
    serve({ 'POST /api/me/cv/entries': refuse('personal-number') });
    page();
    fireEvent.click(screen.getByRole('button', { name: t.entries.add }));
    const form = screen.getByRole('form', { name: t.entries.add });
    fireEvent.change(within(form).getByLabelText(t.entries.name), { target: { value: 'Club' } });
    fireEvent.click(within(form).getByRole('button', { name: t.entries.save }));
    const alert = await within(form).findByRole('alert');
    expect(alert.textContent).toBe(t.errors['personal-number']);
    // Once: not also at the top of the page, far from the form on a phone.
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    // Cancelled, it goes, and doesn't come back with the next form.
    fireEvent.click(within(form).getByRole('button', { name: t.entries.cancel }));
    fireEvent.click(screen.getByRole('button', { name: t.entries.add }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a refused selection, a refused fitting and a refused CV in their own cards (A2-43)', async () => {
    serve({
      'PUT /api/me/cv/selection': refuse('personal-number'),
      'POST /api/me/cv/tailorings': refuse('personal-number'),
      'POST /api/me/cv/drafts': { status: 409, json: { error: 'state', detail: 'cv-busy' } },
    });
    page(initial({ view: ready }));
    const what = screen.getByRole('region', { name: t.what.title });
    fireEvent.click(within(what).getByRole('button', { name: t.what.save }));
    expect((await within(what).findByRole('alert')).textContent).toBe(t.errors['personal-number']);
    const make = screen.getByRole('region', { name: t.make.title });
    fireEvent.click(within(make).getByRole('button', { name: t.make.button }));
    expect((await within(make).findByRole('alert')).textContent).toBe(t.errors['cv-busy']);
    const fit = screen.getByRole('region', { name: t.tailor.title });
    fireEvent.change(within(fit).getByLabelText(t.tailor.jobTitle), {
      target: { value: 'Intern' },
    });
    fireEvent.change(within(fit).getByLabelText(t.tailor.advert), { target: { value: 'SQL.' } });
    fireEvent.click(within(fit).getByRole('button', { name: t.tailor.button }));
    expect((await within(fit).findByRole('alert')).textContent).toBe(t.errors['personal-number']);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('keeps focus when Add, Edit and Delete take their own button away (A2-44)', async () => {
    page(initial({ entries: [entry] }));
    fireEvent.click(screen.getByRole('button', { name: t.entries.add }));
    const form = screen.getByRole('form', { name: t.entries.add });
    await waitFor(() =>
      expect(document.activeElement).toBe(within(form).getByLabelText(t.entries.kind)),
    );
    fireEvent.click(within(form).getByRole('button', { name: t.entries.cancel }));
    fireEvent.click(screen.getByRole('button', { name: t.entries.edit(entry.title) }));
    const edit = screen.getByRole('form', { name: t.entries.edit(entry.title) });
    await waitFor(() =>
      expect(document.activeElement).toBe(within(edit).getByLabelText(t.entries.name)),
    );
    fireEvent.click(within(edit).getByRole('button', { name: t.entries.cancel }));
    fireEvent.click(screen.getByRole('button', { name: t.entries.remove(entry.title) }));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByText(t.entries.removeAsk(entry.title))),
    );
  });

  it('keeps focus when a link is removed from an entry (A2-44)', async () => {
    page();
    fireEvent.click(screen.getByRole('button', { name: t.entries.add }));
    const form = screen.getByRole('form', { name: t.entries.add });
    fireEvent.click(within(form).getByRole('button', { name: t.entries.addLink }));
    fireEvent.click(within(form).getByRole('button', { name: t.entries.removeLink(1) }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(form).getByRole('button', { name: t.entries.addLink }),
      ),
    );
  });

  it('keeps focus when a share link is switched off (A2-44)', async () => {
    const share = {
      id: ID(20),
      documentId: ID(9),
      createdAt: '2026-10-21T08:00:00.000Z',
      expiresAt: '2099-11-20T08:00:00.000Z',
      revokedAt: null,
      viewCount: 2,
    };
    serve({ 'DELETE /api/me/cv/shares': { json: { ok: true } } });
    page(
      initial({
        canShare: true,
        optIn: { ...optedIn, purposes: [...optedIn.purposes, 'cv.share'] },
        documents: [doc({ confirmedAt: '2026-10-21T08:00:00.000Z' })],
        shares: [share],
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${t.list.open} `) }));
    const card = await screen.findByRole('region', { name: t.sharing.title });
    fireEvent.click(within(card).getByRole('button', { name: /^Switch off/ }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(card).getByRole('heading', { name: t.sharing.title }),
      ),
    );
  });

  it('says why Make my CV and Fit it to a job do nothing yet, instead of nothing (A2-48)', async () => {
    page();
    fireEvent.click(screen.getByRole('button', { name: t.make.button }));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(t.errors['cv-incomplete']),
    );
  });

  it('wraps long words and links at 320px instead of scrolling sideways (A2-46)', () => {
    const { container } = page(initial({ entries: [entry] }));
    expect(container.firstElementChild?.classList.contains('uf-cv')).toBe(true);
    const css = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');
    const block = css.slice(css.indexOf('/* cv-ui:'), css.indexOf('/* end cv-ui */'));
    expect(block).toMatch(/\.uf-cv\s*\{[^}]*overflow-wrap:\s*anywhere;/);
  });

  it('stops the progress dots within five seconds (WCAG 2.2.2; A2-49)', () => {
    const css = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');
    const block = css.slice(css.indexOf('/* cv-ui:'), css.indexOf('/* end cv-ui */'));
    const rule = block.slice(block.indexOf('.uf-cv-progress span {'));
    const body = rule.slice(0, rule.indexOf('}'));
    expect(body).not.toMatch(/infinite/);
    // 1200ms a cycle (twice --uf-duration-enter, 600ms): four cycles stop at 4.8 seconds.
    expect(body).toMatch(/animation-iteration-count:\s*4;/);
  });
});

describe('the copy and the motion', () => {
  it('sends the page plain strings only, which a prop must be', () => {
    const walk = (value: unknown): boolean =>
      typeof value === 'function'
        ? false
        : typeof value === 'object' && value !== null
          ? Object.values(value).every(walk)
          : true;
    expect(walk(copy)).toBe(true);
    expect(copy.tailor.scoreValue).toContain('{0}');
  });

  it('the status line’s progress is the only motion, and reduced motion stops it (hard rule 9)', () => {
    const css = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');
    const block = css.slice(css.indexOf('/* cv-ui:'), css.indexOf('/* end cv-ui */'));
    expect(block).toMatch(/\.uf-cv-progress/);
    expect(block).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.uf-cv-progress\s*\{\s*display: none;/,
    );
    // Every duration a token, so it is 0ms under reduced motion too (tokens.css).
    expect(block).not.toMatch(/\d+m?s\b/);
  });
});

// A hackathon exception (2026-10-24): on the judge demo the built-in stand-in makes every CV, no
// AI and no Mmereko, so the two lines saying an AI (Anthropic, abroad) fits a CV would be untrue
// there. The page's stand-in notice (en.demoPersonas.cvStandIn) says what happens instead.
describe('on the judge demo, the stand-in makes the CVs (standIn)', () => {
  const readyView = { ...view, ready: true, missing: [] as const };
  const fitted = () => doc({ kind: 'tailored', advertTitle: 'Intern', advertCompany: null });

  it('says nothing of an AI where the advert is pasted, and the button points at nothing missing', () => {
    page(initial({ view: readyView, standIn: true }));
    const card = screen.getByRole('region', { name: t.tailor.title });
    expect(within(card).queryByText(t.tailor.aiNote)).toBeNull();
    const button = within(card).getByRole('button', { name: t.tailor.button });
    for (const id of button.getAttribute('aria-describedby')?.split(' ') ?? []) {
      expect(document.getElementById(id), id).not.toBeNull();
    }
  });

  it('says nothing of an AI above a fitted CV', async () => {
    page(initial({ documents: [fitted()], standIn: true }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${t.list.open} `) }));
    const preview = await screen.findByRole('region', {
      name: t.preview.title(t.list.tailored('Intern')),
    });
    expect(within(preview).queryByText(t.preview.tailoredNote)).toBeNull();
  });

  it('production (no standIn, or false) still shows both lines', async () => {
    for (const standIn of [undefined, false]) {
      page(
        initial({
          view: readyView,
          documents: [fitted()],
          ...(standIn === false ? { standIn } : {}),
        }),
      );
      expect(screen.getByText(t.tailor.aiNote)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${t.list.open} `) }));
      expect(await screen.findByText(t.preview.tailoredNote)).toBeTruthy();
      cleanup();
    }
  });
});
