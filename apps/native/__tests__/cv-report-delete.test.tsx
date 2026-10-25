import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { en } from '@universityflow/content/app';
import { AccessibilityInfo, Linking } from 'react-native';
import CvScreen from '../app/cv';
import { formatDate } from '../lib/format';
import { saveToken } from '../lib/session';
import { serve } from '../test-utils/fake-api';

/**
 * Wave 5 (2026-10-24), My CV in the app, on the same API as the web:
 * - A10-58 "Report this CV" under a fitted CV's preview (design §11, A10-35's pattern): a reason
 *   from the fixed list, never free text, the thank-you announced; a reported CV says so.
 * - A11-38 Delete on each CV, asked on the screen first, the screen reader moved to the question,
 *   back to Delete on Keep it, and to the list's title once it's gone.
 * - A2-47 the preview's CV as headers, bullet lines and paragraphs, never the Markdown marks.
 * RNTL v14: render and fireEvent are awaited. Synthetic data only.
 */

const t = en.cv;
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const optIn = {
  optedInAt: '2026-10-19T08:00:00.000Z',
  version: 'cv-optin-v1',
  purposes: ['cv.draft', 'cv.tailor', 'cv.ats'],
};
const view = {
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
  profile: {},
  ready: false,
  missing: ['education'],
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
const fitted = (over: object = {}) =>
  doc({ id: ID(8), kind: 'tailored', advertTitle: 'Intern', ...over });

function reads(documents: unknown[], reported: string[] = []) {
  return {
    'GET /api/me/cv/opt-in': {
      json: { optIn, wordingCovers: true, mayShare: false, canShare: false, version: 'x' },
    },
    'GET /api/me/cv/entries': { json: { entries: [] } },
    'GET /api/me/cv/selection': { json: view },
    'GET /api/me/cv/documents': { json: { documents, reported } },
  };
}

function spyFocus() {
  const focus = jest
    .spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
    .mockImplementation(() => {});
  focus.mockClear();
  const said = jest
    .spyOn(AccessibilityInfo, 'announceForAccessibility')
    .mockImplementation(() => {});
  return { focus, said };
}

/** The element the screen reader was last sent to, by its accessible name or text. */
function focused(spy: jest.SpyInstance) {
  const target = spy.mock.calls.at(-1)?.[0] as unknown as { props: Record<string, unknown> };
  expect(spy.mock.calls.at(-1)?.[1]).toBe('focus');
  return target.props.accessibilityLabel ?? target.props.children;
}

beforeEach(async () => {
  await saveToken('tok');
});

describe('Report this CV in the app (A10-58)', () => {
  it('offers it under a fitted CV only, and sends one reason from the list', async () => {
    const { said } = spyFocus();
    const calls = serve({
      ...reads([fitted(), doc()]),
      [`POST /api/me/cv/documents/${ID(8)}/report`]: { json: { status: 'reported' } },
    });
    const screen = await render(<CvScreen />);
    await fireEvent.press(
      await screen.findByRole('button', {
        name: new RegExp(`^${t.list.open} ${t.list.tailored('Intern')}`),
      }),
    );
    const preview = await screen.findByTestId('cv-preview');
    await fireEvent.press(within(preview).getByRole('button', { name: t.report.open }));
    expect(within(preview).getAllByRole('radio')).toHaveLength(3);
    await fireEvent.press(within(preview).getByRole('radio', { name: t.report.reasons.untrue }));
    await fireEvent.press(within(preview).getByRole('button', { name: t.report.send }));
    expect(await within(preview).findByText(t.report.sent)).toBeTruthy();
    expect(said).toHaveBeenCalledWith(t.report.sent);
    expect(calls.find((c) => c.key === `POST /api/me/cv/documents/${ID(8)}/report`)?.body).toEqual({
      reason: 'untrue',
    });

    await fireEvent.press(within(preview).getByRole('button', { name: t.preview.close }));
    await fireEvent.press(
      screen.getByRole('button', { name: new RegExp(`^${t.list.open} ${t.list.draft}`) }),
    );
    const base = await screen.findByTestId('cv-preview');
    expect(within(base).queryByRole('button', { name: t.report.open })).toBeNull();
  });

  it('says a CV already reported is reported, with no button', async () => {
    serve(reads([fitted()], [ID(8)]));
    const screen = await render(<CvScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: /^Open/ }));
    const preview = await screen.findByTestId('cv-preview');
    expect(within(preview).getByText(t.report.reported)).toBeTruthy();
    expect(within(preview).queryByRole('button', { name: t.report.open })).toBeNull();
  });
});

describe('deleting one CV in the app (A11-38)', () => {
  const date = formatDate(doc().createdAt);

  it('asks on the screen first, moves the screen reader, then deletes with one DELETE', async () => {
    const { focus } = spyFocus();
    const calls = serve({
      ...reads([doc(), fitted()]),
      [`DELETE /api/me/cv/documents/${ID(9)}`]: { json: { deleted: true } },
    });
    const screen = await render(<CvScreen />);
    const remove = await screen.findByRole('button', { name: t.remove.name(t.list.draft, date) });
    await fireEvent.press(remove);
    expect(screen.getByText(t.remove.ask(t.list.draft))).toBeTruthy();
    await waitFor(() => expect(focused(focus)).toBe(t.remove.ask(t.list.draft)));
    await fireEvent.press(screen.getByRole('button', { name: t.remove.keep }));
    await waitFor(() => expect(focused(focus)).toBe(t.remove.name(t.list.draft, date)));
    expect(calls.map((c) => c.key)).not.toContain(`DELETE /api/me/cv/documents/${ID(9)}`);

    await fireEvent.press(screen.getByRole('button', { name: t.remove.name(t.list.draft, date) }));
    await fireEvent.press(screen.getByRole('button', { name: t.remove.yes }));
    expect(await screen.findByText(t.remove.done(t.list.draft))).toBeTruthy();
    expect(calls.map((c) => c.key)).toContain(`DELETE /api/me/cv/documents/${ID(9)}`);
    expect(screen.queryByRole('button', { name: t.remove.name(t.list.draft, date) })).toBeNull();
    await waitFor(() => expect(focused(focus)).toBe(t.list.title));
  });

  it('offers no Delete for a CV still being made, and shows a refusal in the list', async () => {
    serve({
      ...reads([doc({ id: ID(7), status: 'queued', markdown: null }), doc()]),
      [`DELETE /api/me/cv/documents/${ID(9)}`]: {
        status: 409,
        json: { error: 'state', detail: 'cv-busy' },
      },
    });
    const screen = await render(<CvScreen />);
    await screen.findByRole('button', { name: t.remove.name(t.list.draft, date) });
    expect(screen.getAllByRole('button', { name: /^Delete / })).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: t.remove.name(t.list.draft, date) }));
    await fireEvent.press(screen.getByRole('button', { name: t.remove.yes }));
    const list = screen.getByTestId('cv-list');
    expect(await within(list).findByText(t.errors['cv-busy'])).toBeTruthy();
  });
});

describe('the preview’s CV as structure in the app (A2-47)', () => {
  it('shows headers and bullet lines, never the Markdown marks', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const markdown = [
      '# Thandi Example',
      '',
      '## Education',
      '',
      '- Subjects: Mathematics 71%',
      '- **Result:** distinction',
      '',
      '[Code](https://example.org/bus) \\# 2',
    ].join('\n');
    serve(reads([doc({ markdown })]));
    const screen = await render(<CvScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: /^Open/ }));
    const preview = await screen.findByTestId('cv-preview');
    expect(within(preview).getByRole('header', { name: 'Thandi Example' })).toBeTruthy();
    expect(within(preview).getByRole('header', { name: 'Education' })).toBeTruthy();
    expect(within(preview).getByText('Subjects: Mathematics 71%')).toBeTruthy();
    expect(within(preview).getByText('distinction', { exact: false })).toBeTruthy();
    expect(within(preview).queryByText(/^#|\*\*/)).toBeNull();
    await fireEvent.press(within(preview).getByRole('link', { name: 'Code' }));
    expect(open).toHaveBeenCalledWith('https://example.org/bus');
    expect(within(preview).getByText(/# 2/)).toBeTruthy();
  });
});
