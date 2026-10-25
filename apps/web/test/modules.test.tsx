// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { RegistrationDifference } from '@universityflow/admissions';
import {
  type AgentRegistration,
  explainDifference,
  type MyModulesArtifact,
  myModules,
} from '@universityflow/agent';
import { catalogueViewOf, RAW_CATALOGUE } from '@universityflow/catalogue';
import { en } from '@universityflow/content';
import { draftFromRegistration, SAMPLE_REGISTRATION } from '@universityflow/documents';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModulesView } from '../app/(app)/modules/modules-view';
import { ArtifactView } from '../components/artifacts';
import { MyModulesCard } from '../components/modules';
import { E2E_CURRICULUM, withE2eFixtures } from '../lib/server/e2e-fixtures';
import type { RegistrationResponse } from '../lib/server/registration';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const NOW = new Date('2026-10-14T16:00:00Z');
const VIEW = catalogueViewOf(withE2eFixtures(RAW_CATALOGUE), NOW, { includeDrafts: true });
const m = en.modules;

/** Synthetic (hard rule 4): the stand-in proof's TEST modules. */
const REGISTRATION: AgentRegistration = {
  id: '00000000-0000-4000-8000-000000000005',
  universityId: 'up',
  programmeId: E2E_CURRICULUM.programmeId,
  academicYear: 2027,
  yearOfStudy: 1,
  modules: [
    { code: 'TEST101', name: 'Sample module one', term: 'S1', credits: 16 },
    { code: 'TEST102', name: 'Sample module two', term: 'S1', credits: 16 },
    { code: 'TEST103', name: 'Sample module three', term: 'S2', credits: 16 },
  ],
  confirmedAt: NOW,
  reminder: null,
};

const artifact = (overrides: Partial<AgentRegistration> = {}): MyModulesArtifact =>
  myModules(VIEW, { ...REGISTRATION, ...overrides }, NOW);

describe('MyModulesCard', () => {
  it('shows each difference in content’s words, who to see, the message and the deadline', () => {
    const a = artifact();
    const { container } = render(<MyModulesCard artifact={a} remindersOn={false} />);
    const text = container.textContent ?? '';
    expect(text).toContain(m.differencesTitle(1));
    expect(text).toContain(a.differences[0]?.text ?? 'missing');
    expect(screen.getByTestId('modules-office').textContent).toContain(
      m.whoLead('Engineering, Built Environment and Information Technology'),
    );
    expect(screen.getByTestId('modules-message').textContent).toBe(a.message);
    expect(screen.getByTestId('modules-deadline').textContent).toContain(m.deadlineScopes.S2);
    // Unverified records are labelled (preview only).
    expect(text).toContain(en.common.draftBadge);
    // No reminder channel: the card says how to get one.
    expect(text).toContain(m.reminderOff);
  });

  it('every kind of difference renders its own explanation', () => {
    const module = E2E_CURRICULUM.modules[0] as (typeof E2E_CURRICULUM.modules)[number];
    const all: RegistrationDifference[] = [
      { kind: 'missing-compulsory', module },
      { kind: 'wrong-semester', module, registered: { code: 'TEST101', semester: 'S2' } },
      { kind: 'not-in-curriculum', registered: { code: 'X999' } },
      {
        kind: 'registered-twice',
        code: 'TEST101',
        registered: [{ code: 'TEST101' }, { code: 'TEST101' }],
      },
      {
        kind: 'elective-group-unsatisfied',
        group: { label: 'Choose one', choose: { count: 1 }, from: ['TEST201'] },
        groupIndex: 0,
        chosen: [],
        short: { count: 1 },
      },
      { kind: 'credits-short', registered: 32, min: 48, short: 16 },
      { kind: 'credits-over', registered: 80, max: 64, over: 16 },
    ];
    const a = {
      ...artifact(),
      differences: all.map((difference) => ({ difference, text: explainDifference(difference) })),
    };
    render(<MyModulesCard artifact={a} />);
    const items = screen.getByTestId('modules-differences').querySelectorAll('li');
    expect([...items].map((li) => li.textContent)).toEqual(all.map(explainDifference));
    // The heavy side rule is the `border.rule` token, as on native (A2-16, A2-17).
    for (const li of items) {
      expect(li.className).toContain('border-l-rule');
      expect(li.className).not.toMatch(/\bborder-l-\d/);
    }
  });

  it('a clean registration says it matches, with no message', () => {
    const a = artifact({
      modules: [...REGISTRATION.modules, { code: 'TEST104', name: null, term: 'S2', credits: 16 }],
    });
    render(<MyModulesCard artifact={a} />);
    expect(screen.getByText(m.matches)).toBeTruthy();
    expect(screen.queryByTestId('modules-message')).toBeNull();
  });

  it('no verdict without a curriculum record: says so, and still who to see', () => {
    const a = artifact({ programmeId: 'up-llb' });
    const { container } = render(<MyModulesCard artifact={a} />);
    expect(screen.getByText(m.noCurriculum)).toBeTruthy();
    expect(screen.queryByTestId('modules-differences')).toBeNull();
    expect(container.textContent).not.toContain(m.matches);
    expect(screen.getByTestId('modules-office')).toBeTruthy();
  });

  it('says honestly when no last day is published for the year', () => {
    render(<MyModulesCard artifact={artifact({ academicYear: 2028 })} />);
    expect(screen.getByTestId('modules-deadline').textContent).toBe(m.noDeadline(2028));
  });

  it('shows "term not printed" and a module’s alternative codes, never a guessed term', () => {
    const a = artifact();
    const expected = [
      { ...a.expected[0], alternativeCodes: ['TEST101S'] },
      { code: 'TEST105', name: 'Sample five', credits: 8, compulsory: false, registered: false },
    ] as MyModulesArtifact['expected'];
    const { container } = render(<MyModulesCard artifact={{ ...a, expected }} />);
    const text = container.textContent ?? '';
    expect(text).toContain('TEST101 / TEST101S');
    expect(text).toContain(`${m.termNotPrinted} · ${m.credits(8)}`);
    expect(text).not.toMatch(/undefined/);
  });

  it('copies the message', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const a = artifact();
    render(<MyModulesCard artifact={a} />);
    fireEvent.click(screen.getByRole('button', { name: m.copy }));
    await waitFor(() => expect(screen.getByText(m.copied)).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith(a.message);
  });

  it('no badge sits on a background of its own colour (A2-13)', () => {
    const { container } = render(<MyModulesCard artifact={artifact()} />);
    const badges = [...container.querySelectorAll('span.rounded-full')];
    expect(badges.length).toBeGreaterThanOrEqual(3);
    for (const badge of badges) {
      const own = badge.className.match(/\bbg-(surface|sunk)\b/)?.[0];
      const under = badge.parentElement?.closest('.bg-surface, .bg-sunk');
      const theirs = under?.className.match(/\bbg-(surface|sunk)\b/)?.[0];
      if (own) expect(own).not.toBe(theirs);
    }
    expect(screen.getByText(m.registeredFor(2027)).className).toContain('bg-sunk');
  });

  it('opens in the chat panel with a link to My modules', () => {
    render(<ArtifactView artifact={artifact()} />);
    expect(screen.getByRole('link', { name: `${en.chat.artifactOpen}: ${m.title}` })).toBeTruthy();
  });
});

describe('ModulesView', () => {
  const data = (modules: MyModulesArtifact | null = null): RegistrationResponse => ({
    modules,
    acceptedProgrammeId: E2E_CURRICULUM.programmeId,
    options: [
      { id: E2E_CURRICULUM.programmeId, name: 'Synthetic BSc', universityName: 'UP' },
      { id: 'up-llb', name: 'Synthetic LLB', universityName: 'UP' },
    ],
    remindersOn: true,
    defaultYear: 2027,
  });

  it('typed in: nothing is sent until every row is a module code; then exactly the confirmed rows', async () => {
    const fetch = vi.fn(async () => Response.json(data(artifact())));
    vi.stubGlobal('fetch', fetch);
    render(<ModulesView initial={data()} direct={false} />);
    expect(screen.getByText(m.empty)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: m.typeIn }));
    fireEvent.change(screen.getByLabelText(m.moduleCode(1)), { target: { value: '*?' } });
    fireEvent.click(screen.getByRole('button', { name: m.confirm }));
    expect(screen.getByText(m.invalidCode)).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(m.moduleCode(1)), { target: { value: 'TEST101' } });
    fireEvent.change(screen.getByLabelText(m.moduleTerm(1)), { target: { value: 'S1' } });
    fireEvent.click(screen.getByRole('button', { name: m.addModule }));
    fireEvent.change(screen.getByLabelText(m.moduleCode(2)), { target: { value: 'TEST102' } });
    fireEvent.change(screen.getByLabelText(m.moduleCredits(2)), { target: { value: '16' } });
    fireEvent.click(screen.getByRole('button', { name: m.confirm }));
    await waitFor(() => expect(screen.getByText(m.saved)).toBeTruthy());
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/registration');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(String(init.body))).toEqual({
      programmeId: E2E_CURRICULUM.programmeId,
      academicYear: 2027,
      yearOfStudy: null,
      modules: [
        { code: 'TEST101', name: null, term: 'S1', credits: null },
        { code: 'TEST102', name: null, term: null, credits: 16 },
      ],
      documentId: null,
    });
    // The check is shown.
    expect(screen.getByTestId('modules-differences')).toBeTruthy();
  });

  it('a bad code is marked on its own row, named in the summary and focused (A3-14)', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    render(<ModulesView initial={data()} direct={false} />);
    fireEvent.click(screen.getByRole('button', { name: m.typeIn }));
    fireEvent.change(screen.getByLabelText(m.moduleCode(1)), { target: { value: 'TEST101' } });
    fireEvent.click(screen.getByRole('button', { name: m.addModule }));
    fireEvent.click(screen.getByRole('button', { name: m.addModule }));
    fireEvent.change(screen.getByLabelText(m.moduleCode(2)), { target: { value: 'TEST102' } });
    fireEvent.change(screen.getByLabelText(m.moduleCode(3)), { target: { value: 'BAD$$CODE' } });
    fireEvent.click(screen.getByRole('button', { name: m.confirm }));
    expect(fetch).not.toHaveBeenCalled();
    const bad = screen.getByLabelText(m.moduleCode(3));
    expect(bad.getAttribute('aria-invalid')).toBe('true');
    expect(bad.getAttribute('aria-describedby')).toContain(screen.getByText(m.invalidCode).id);
    expect(screen.getByLabelText(m.moduleCode(1)).getAttribute('aria-invalid')).toBeNull();
    expect(screen.getByText(m.checkRows([3]))).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(bad));
  });

  it('no course chosen: the course field says so and gets focus (A3-14)', async () => {
    vi.stubGlobal('fetch', vi.fn());
    render(<ModulesView initial={{ ...data(), acceptedProgrammeId: null }} direct={false} />);
    fireEvent.click(screen.getByRole('button', { name: m.typeIn }));
    fireEvent.change(screen.getByLabelText(m.moduleCode(1)), { target: { value: 'TEST101' } });
    fireEvent.click(screen.getByRole('button', { name: m.confirm }));
    const course = screen.getByLabelText(m.programme);
    expect(course.getAttribute('aria-invalid')).toBe('true');
    await waitFor(() => expect(document.activeElement).toBe(course));
  });

  it('focus follows each step: the form’s heading, a removed row, then the check (A3-13, A3-17)', async () => {
    const fetch = vi.fn(async () => Response.json(data(artifact())));
    vi.stubGlobal('fetch', fetch);
    render(<ModulesView initial={data()} direct={false} />);
    const status = screen.getByRole('status');
    fireEvent.click(screen.getByRole('button', { name: m.typeIn }));
    const formTitle = screen.getByRole('heading', { name: m.confirmTitle });
    await waitFor(() => expect(document.activeElement).toBe(formTitle));
    fireEvent.click(screen.getByRole('button', { name: m.addModule }));
    fireEvent.click(screen.getByRole('button', { name: m.removeModule(2) }));
    // The last row went: focus goes back to the row before it.
    const remaining = screen.getByRole('button', { name: m.removeModule(1) });
    await waitFor(() => expect(document.activeElement).toBe(remaining));
    fireEvent.change(screen.getByLabelText(m.moduleCode(1)), { target: { value: 'TEST101' } });
    fireEvent.click(screen.getByRole('button', { name: m.confirm }));
    await waitFor(() => expect(status.textContent).toBe(m.saved));
    // The same region, mounted before the click (the card brings its own for "Copied").
    expect(status.isConnected).toBe(true);
    const programme = artifact().programme;
    if (!programme) throw new Error('fixture');
    const checkTitle = screen.getByRole('heading', { name: programme.name });
    await waitFor(() => expect(document.activeElement).toBe(checkTitle));
  });

  it('Cancel returns focus to the page heading (A3-13)', async () => {
    render(<ModulesView initial={data()} direct={false} />);
    fireEvent.click(screen.getByRole('button', { name: m.typeIn }));
    const formTitle = screen.getByRole('heading', { name: m.confirmTitle });
    await waitFor(() => expect(document.activeElement).toBe(formTitle));
    fireEvent.click(screen.getByRole('button', { name: en.common.cancel }));
    const pageTitle = screen.getByRole('heading', { name: m.title });
    await waitFor(() => expect(document.activeElement).toBe(pageTitle));
  });

  it('from a proof: the sample is labelled, rows are prefilled, and a removed row is not sent', async () => {
    const registration = draftFromRegistration(SAMPLE_REGISTRATION);
    const documentId = '00000000-0000-4000-8000-000000000009';
    const fetch = vi.fn(async (url: string) =>
      url === '/api/documents'
        ? Response.json({ documentId, registration, sample: true })
        : Response.json(data(artifact())),
    );
    vi.stubGlobal('fetch', fetch);
    const { container } = render(<ModulesView initial={data()} direct={false} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['%PDF-1.7'], 'proof.pdf', { type: 'application/pdf' })] },
    });
    await waitFor(() => expect(screen.getByText(m.sampleLead)).toBeTruthy());
    // The check form is announced by moving focus to its heading (A3-13).
    const formTitle = screen.getByRole('heading', { name: m.confirmTitle });
    await waitFor(() => expect(document.activeElement).toBe(formTitle));
    expect((screen.getByLabelText(m.programme) as HTMLSelectElement).value).toBe(
      E2E_CURRICULUM.programmeId,
    );
    expect((screen.getByLabelText(m.moduleCode(3)) as HTMLInputElement).value).toBe('TEST103');
    expect((screen.getByLabelText(m.moduleTerm(3)) as HTMLSelectElement).value).toBe('S2');
    fireEvent.click(screen.getByRole('button', { name: m.removeModule(3) }));
    fireEvent.click(screen.getByRole('button', { name: m.confirm }));
    await waitFor(() => expect(screen.getByText(m.saved)).toBeTruthy());
    const [, init] = fetch.mock.calls[1] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.documentId).toBe(documentId);
    expect(body.modules.map((r: { code: string }) => r.code)).toEqual(['TEST101', 'TEST102']);
  });
});
