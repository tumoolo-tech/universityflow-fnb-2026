import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { en } from '@universityflow/content/app';
import { useRouter } from 'expo-router';
import { AccessibilityInfo, Linking } from 'react-native';
import AccountScreen from '../app/account';
import CvScreen from '../app/cv';
import { formatDate } from '../lib/format';
import { saveToken } from '../lib/session';
import { serve } from '../test-utils/fake-api';

/**
 * My CV in the app (docs/design/mmereko-api-proposal.md §10.5): the web page's sections as an
 * outline, on the same API. The PDF opens through its 60-second link in the phone's own viewer
 * (`Linking`, no new native module). Sharing only for an adult in their own name (D6); stopping
 * offers each CV's download first (D15). Nothing animates in the app. RNTL v14: render and
 * fireEvent are awaited. Synthetic data only.
 */

const t = en.cv;
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const optIn = {
  optedInAt: '2026-10-19T08:00:00.000Z',
  version: 'cv-optin-v1',
  purposes: ['cv.draft', 'cv.tailor', 'cv.ats'],
};
const state = (over: object = {}) => ({
  optIn,
  wordingCovers: true,
  mayShare: false,
  canShare: false,
  version: 'cv-optin-v1',
  ...over,
});

const selection = {
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
const view = {
  selection,
  available: {
    school: { name: 'Synthetic High School', endYear: 2027 },
    subjects: [{ id: 'mathematics', name: 'Mathematics', percent: 71 }],
    offer: null,
    modules: [],
    entries: [],
  },
  profile: {},
  ready: true,
  missing: [],
  omitted: [],
};

function doc(over: object = {}) {
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

/** The reads the screen makes once the learner has opted in. */
function reads(over: { documents?: unknown[]; shares?: unknown[]; opt?: object } = {}) {
  return {
    'GET /api/me/cv/opt-in': { json: state(over.opt) },
    'GET /api/me/cv/entries': { json: { entries: [] } },
    'GET /api/me/cv/selection': { json: view },
    'GET /api/me/cv/documents': { json: { documents: over.documents ?? [] } },
    'GET /api/me/cv/shares': { json: { shares: over.shares ?? [] } },
  };
}

beforeEach(async () => {
  await saveToken('tok');
});

describe('My CV in the app', () => {
  it('says it isn’t available while the server’s switch is off', async () => {
    serve({});
    const screen = await render(<CvScreen />);
    expect(await screen.findByText(t.unavailable)).toBeTruthy();
  });

  it('shows the opt-in card first, with no sharing for an under-18, and opts in with one POST', async () => {
    const calls = serve({
      ...reads(),
      'GET /api/me/cv/opt-in': { json: state({ optIn: null }) },
      'POST /api/me/cv/opt-in': { json: { optIn } },
    });
    const screen = await render(<CvScreen />);
    expect(await screen.findByText(t.optIn.body)).toBeTruthy();
    expect(screen.queryByText(t.optIn.share)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: t.optIn.agree }));
    expect(await screen.findByText(t.what.title)).toBeTruthy();
    expect(calls.find((c) => c.key === 'POST /api/me/cv/opt-in')?.body).toEqual({ share: false });
  });

  it('while the wording doesn’t name Mmereko, says so and offers no button', async () => {
    serve({ 'GET /api/me/cv/opt-in': { json: state({ optIn: null, wordingCovers: false }) } });
    const screen = await render(<CvScreen />);
    expect(await screen.findByText(t.errors['cv-consent'])).toBeTruthy();
    expect(screen.queryByRole('button', { name: t.optIn.agree })).toBeNull();
  });

  it('lists what can go on the CV with where it comes from, marks unticked, and saves with one PUT', async () => {
    const calls = serve({
      ...reads(),
      'PUT /api/me/cv/selection': { json: { ...view, care: null } },
    });
    const screen = await render(<CvScreen />);
    const marks = await screen.findByRole('checkbox', { name: t.what.subject('Mathematics', 71) });
    expect(marks.props.accessibilityState.checked).toBe(false);
    expect(screen.getByText(t.what.from.report)).toBeTruthy();
    expect(screen.getByText(t.what.contactHint)).toBeTruthy();
    await fireEvent.press(marks);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Synthetic High School' }));
    await fireEvent.press(screen.getByRole('button', { name: t.what.save }));
    await waitFor(() =>
      expect(calls.find((c) => c.key === 'PUT /api/me/cv/selection')?.body).toEqual({
        ...selection,
        includeSchool: true,
        subjectIds: ['mathematics'],
      }),
    );
  });

  it('adds a project with a link in one POST', async () => {
    const calls = serve({
      ...reads(),
      'POST /api/me/cv/entries': (call) => ({
        json: {
          entry: { ...(call.body as object), id: ID(2), position: 0 },
          care: null,
        },
      }),
    });
    const screen = await render(<CvScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: t.entries.add }));
    await fireEvent.changeText(screen.getByLabelText(t.entries.name), 'School app');
    await fireEvent.changeText(
      screen.getByLabelText(t.entries.evidenceUrl),
      'https://example.org/school-app',
    );
    await fireEvent.press(screen.getByRole('button', { name: t.entries.save }));
    // Listed, with its own Delete, and ready to tick for the CV.
    expect(
      await screen.findByRole('button', { name: t.entries.remove('School app') }),
    ).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'School app' })).toBeTruthy();
    expect(calls.find((c) => c.key === 'POST /api/me/cv/entries')?.body).toEqual({
      kind: 'project',
      title: 'School app',
      organisation: null,
      role: null,
      startDate: null,
      endDate: null,
      description: null,
      highlights: [],
      keywords: [],
      evidence: [{ kind: 'other', url: 'https://example.org/school-app', label: null }],
      linkedModules: [],
    });
  });

  it('makes a CV and shows its status word', async () => {
    serve({
      ...reads(),
      'POST /api/me/cv/drafts': {
        status: 202,
        json: { document: doc({ status: 'queued', markdown: null, hasPdf: false }) },
      },
    });
    const screen = await render(<CvScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: t.make.button }));
    expect(await screen.findByText(t.status.queued)).toBeTruthy();
  });

  it('shows the crisis card when the words would worry us, sends nothing, and sends on a second press (A10-56)', async () => {
    const card = { kind: 'crisis-card', cover: 'none', helplines: [] };
    const calls = serve({
      ...reads(),
      'POST /api/me/cv/drafts': (call) =>
        (call.body as { sendAnyway?: boolean } | undefined)?.sendAnyway
          ? {
              status: 202,
              json: {
                document: doc({ status: 'queued', markdown: null, hasPdf: false }),
                care: null,
              },
            }
          : { json: { document: null, care: { level: 'crisis', card } } },
    });
    const screen = await render(<CvScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: t.make.button }));
    expect(await screen.findByText(en.planMaps.care.crisisLead)).toBeTruthy();
    expect(screen.getByText(t.make.held)).toBeTruthy();
    expect(screen.queryByText(t.status.queued)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: t.make.button }));
    expect(await screen.findByText(t.status.queued)).toBeTruthy();
    expect(calls.filter((c) => c.key === 'POST /api/me/cv/drafts').map((c) => c.body)).toEqual([
      undefined,
      { sendAnyway: true },
    ]);
  });

  it('holds an advert with crisis words: the card, nothing sent, then a second press (A10-55)', async () => {
    const card = { kind: 'crisis-card', cover: 'none', helplines: [] };
    const calls = serve({
      ...reads(),
      'POST /api/me/cv/tailorings': (call) =>
        (call.body as { sendAnyway?: boolean }).sendAnyway
          ? {
              status: 202,
              json: {
                document: doc({ kind: 'tailored', status: 'queued', advertTitle: 'Intern' }),
                care: null,
              },
            }
          : { json: { document: null, care: { level: 'crisis', card } } },
    });
    const screen = await render(<CvScreen />);
    await fireEvent.changeText(await screen.findByLabelText(t.tailor.jobTitle), 'Intern');
    await fireEvent.changeText(screen.getByLabelText(t.tailor.advert), 'Synthetic words.');
    await fireEvent.press(screen.getByRole('button', { name: t.tailor.button }));
    expect(await screen.findByText(en.planMaps.care.crisisLead)).toBeTruthy();
    expect(screen.getByText(t.make.held)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: t.tailor.button }));
    await waitFor(() =>
      expect(
        calls.filter((c) => c.key === 'POST /api/me/cv/tailorings').map((c) => c.body),
      ).toEqual([
        { advert: { title: 'Intern', company: null, text: 'Synthetic words.' } },
        { advert: { title: 'Intern', company: null, text: 'Synthetic words.' }, sendAnyway: true },
      ]),
    );
  });

  it('says a fitted CV was written by an AI and is the learner’s to check (A10-57)', async () => {
    const fitted = doc({ kind: 'tailored', advertTitle: 'Intern' });
    serve({
      ...reads({ documents: [fitted] }),
      [`GET /api/me/cv/documents/${ID(9)}`]: { json: { document: fitted, pdf: null } },
    });
    const screen = await render(<CvScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: /^Open/ }));
    const preview = await screen.findByTestId('cv-preview');
    expect(within(preview).getByText(t.preview.tailoredNote)).toBeTruthy();
  });

  it('opens a ready CV, and its PDF through the 60-second link in the phone’s viewer', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const pdf = { url: 'https://example.org/api/cv/pdf/x?exp=1&sig=s', expiresAt: '' };
    serve({
      ...reads({ documents: [doc()] }),
      [`GET /api/me/cv/documents/${ID(9)}`]: { json: { document: doc(), pdf } },
    });
    const screen = await render(<CvScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: /^Open/ }));
    const preview = await screen.findByTestId('cv-preview');
    expect(within(preview).getByText(/Thandi Example/)).toBeTruthy();
    expect(within(preview).getByText(/Add a project with a link to your work\./)).toBeTruthy();
    await fireEvent.press(within(preview).getByRole('button', { name: t.preview.download }));
    await waitFor(() => expect(open).toHaveBeenCalledWith(pdf.url));
  });

  it('never offers an under-18 sharing (D6)', async () => {
    serve(reads({ documents: [doc({ confirmedAt: '2026-10-21T08:00:00.000Z' })] }));
    const screen = await render(<CvScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: /^Open/ }));
    expect(screen.queryByText(t.sharing.title)).toBeNull();
  });

  it('gives an adult a link once, for a checked CV', async () => {
    const calls = serve({
      ...reads({
        documents: [doc({ confirmedAt: '2026-10-21T08:00:00.000Z' })],
        opt: { canShare: true, optIn: { ...optIn, purposes: [...optIn.purposes, 'cv.share'] } },
      }),
      'POST /api/me/cv/shares': {
        status: 201,
        json: {
          share: {
            id: ID(20),
            documentId: ID(9),
            createdAt: '2026-10-21T08:00:00.000Z',
            expiresAt: '2026-11-20T08:00:00.000Z',
            revokedAt: null,
            viewCount: 0,
          },
          url: 'https://example.org/cv/s/synthetic-token',
        },
      },
    });
    const screen = await render(<CvScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: /^Open/ }));
    expect(screen.getByText(t.sharing.title)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: t.sharing.create }));
    expect(await screen.findByText('https://example.org/cv/s/synthetic-token')).toBeTruthy();
    expect(screen.getByText(t.sharing.linkOnce)).toBeTruthy();
    expect(calls.find((c) => c.key === 'POST /api/me/cv/shares')?.body).toEqual({
      documentId: ID(9),
      days: 30,
    });
  });

  it('stopping offers each CV’s download first, then deletes with one DELETE', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const calls = serve({
      ...reads({ documents: [doc()] }),
      [`GET /api/me/cv/documents/${ID(9)}`]: {
        json: { document: doc(), pdf: { url: 'https://example.org/pdf', expiresAt: '' } },
      },
      'DELETE /api/me/cv/opt-in': { json: { optIn: null, deleted: { cvs: 1 } } },
    });
    const screen = await render(<CvScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: t.withdraw.start }));
    expect(screen.getByText(t.withdraw.body)).toBeTruthy();
    const card = screen.getByTestId('cv-withdraw');
    await fireEvent.press(within(card).getByRole('button', { name: /^Download PDF/ }));
    await waitFor(() => expect(open).toHaveBeenCalledWith('https://example.org/pdf'));
    await fireEvent.press(screen.getByRole('button', { name: t.withdraw.confirm }));
    expect(await screen.findByText(t.withdraw.done)).toBeTruthy();
    expect(calls.map((c) => c.key)).toContain('DELETE /api/me/cv/opt-in');
    expect(await screen.findByText(t.optIn.body)).toBeTruthy();
  });
});

/**
 * Audit CV-A11 and CV-A2 (docs/audits/results/CV-A11.md, CV-A2.md): the fitting card says the AI
 * abroad writes a fitted CV; an error shows in the card whose press it answers; the screen
 * reader's focus moves when the pressed control goes; the share hint is read once.
 */
describe('audit CV-A11 and CV-A2 in the app', () => {
  const refuse = { status: 422, json: { error: 'invalid', detail: 'personal-number' } };

  /** The element the screen reader was last sent to, by its accessible name or text. */
  function focused(spy: jest.SpyInstance) {
    const target = spy.mock.calls.at(-1)?.[0] as unknown as { props: Record<string, unknown> };
    expect(spy.mock.calls.at(-1)?.[1]).toBe('focus');
    return target.props.accessibilityLabel ?? target.props.children;
  }

  function spyFocus() {
    const focus = jest
      .spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      .mockImplementation(() => {});
    focus.mockClear();
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    return focus;
  }

  it('says on the fitting card that a fitted CV is written by the AI abroad (A11-37)', async () => {
    serve(reads());
    const screen = await render(<CvScreen />);
    expect(await screen.findByText(t.tailor.aiNote)).toBeTruthy();
  });

  it('shows a refused save in its own card, once, not at the top of the screen (A2-43)', async () => {
    serve({ ...reads(), 'PUT /api/me/cv/selection': refuse, 'POST /api/me/cv/entries': refuse });
    const screen = await render(<CvScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: t.what.save }));
    const what = screen.getByTestId('cv-what');
    expect(await within(what).findByText(t.errors['personal-number'])).toBeTruthy();
    expect(screen.getAllByText(t.errors['personal-number'])).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: t.entries.add }));
    await fireEvent.changeText(screen.getByLabelText(t.entries.name), 'Club');
    await fireEvent.press(screen.getByRole('button', { name: t.entries.save }));
    const entries = screen.getByTestId('cv-entries');
    expect(await within(entries).findByText(t.errors['personal-number'])).toBeTruthy();
    expect(screen.getAllByText(t.errors['personal-number'])).toHaveLength(1);
  });

  it('moves the screen reader to the preview when it opens, and back to Open when it closes (A2-45)', async () => {
    serve(reads({ documents: [doc()] }));
    const focus = spyFocus();
    const screen = await render(<CvScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: /^Open/ }));
    await waitFor(() => expect(focus).toHaveBeenCalledTimes(1));
    expect(focused(focus)).toBe(t.preview.title(t.list.draft));
    await fireEvent.press(screen.getByRole('button', { name: t.preview.close }));
    await waitFor(() => expect(focus).toHaveBeenCalledTimes(2));
    expect(focused(focus)).toBe(t.list.openName(t.list.draft, formatDate(doc().createdAt)));
  });

  it('moves the screen reader when Delete, Add and Stop using Mmereko take their button away (A2-45)', async () => {
    serve({
      ...reads(),
      'GET /api/me/cv/entries': {
        json: { entries: [{ id: ID(1), kind: 'project', title: 'Club', organisation: null }] },
      },
    });
    const focus = spyFocus();
    const screen = await render(<CvScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: t.entries.remove('Club') }));
    await waitFor(() => expect(focus).toHaveBeenCalledTimes(1));
    expect(focused(focus)).toBe(t.entries.removeYes);
    await fireEvent.press(screen.getByRole('button', { name: t.entries.keep }));
    await waitFor(() => expect(focus).toHaveBeenCalledTimes(2));
    expect(focused(focus)).toBe(t.entries.remove('Club'));
    await fireEvent.press(screen.getByRole('button', { name: t.entries.add }));
    await waitFor(() => expect(focus).toHaveBeenCalledTimes(3));
    expect(focused(focus)).toBe(t.entries.kind);
    await fireEvent.press(screen.getByRole('button', { name: t.entries.cancel }));
    await waitFor(() => expect(focus).toHaveBeenCalledTimes(4));
    expect(focused(focus)).toBe(t.entries.add);
    await fireEvent.press(screen.getByRole('button', { name: t.withdraw.start }));
    await waitFor(() => expect(focus).toHaveBeenCalledTimes(5));
    expect(focused(focus)).toBe(t.withdraw.body);
    await fireEvent.press(screen.getByRole('button', { name: t.withdraw.keep }));
    await waitFor(() => expect(focus).toHaveBeenCalledTimes(6));
    expect(focused(focus)).toBe(t.withdraw.start);
  });

  it('reads the sharing hint once, not as a hint and again as text (A2-50)', async () => {
    serve({ 'GET /api/me/cv/opt-in': { json: state({ optIn: null, canShare: true }) } });
    const screen = await render(<CvScreen />);
    const box = await screen.findByRole('checkbox', { name: t.optIn.share });
    expect(box.props.accessibilityHint).toBeUndefined();
    expect(screen.getByText(t.optIn.shareHint)).toBeTruthy();
  });
});

describe('About me in the app', () => {
  it('links to My CV only when the server’s switch is on', async () => {
    serve({ 'GET /api/me/cv/opt-in': { json: state() } });
    const screen = await render(<AccountScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: t.title }));
    expect(useRouter().push).toHaveBeenCalledWith('/cv');
  });

  it('shows no link while it is off', async () => {
    serve({});
    const screen = await render(<AccountScreen />);
    await waitFor(() => expect(screen.getByText(en.me.deleteTitle)).toBeTruthy());
    expect(screen.queryByRole('button', { name: t.title })).toBeNull();
  });
});
