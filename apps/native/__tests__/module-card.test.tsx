import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { en } from '@universityflow/content/app';
import {
  calculate,
  calculatorFields,
  calculatorWords,
  initialValues,
  type ModuleCardData,
} from '@universityflow/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { AccessibilityInfo, Platform } from 'react-native';
import ModuleCardScreen from '../app/module/[code]';
import { MARK_ANNOUNCE_DELAY_MS, markKeyboard } from '../components/mark-calculator';
import { MyModulesCard } from '../components/my-modules-card';
import { formatDate } from '../lib/format';
import { saveToken } from '../lib/session';
import { serve } from '../test-utils/fake-api';

/**
 * The module card screen in the app (Phase 6c): the server's card, laid out by the shared view
 * model, every rule with its source; the calculator worked out on the phone as marks are typed
 * (no request: it works offline); no "needed to pass" number when the pass mark isn't published;
 * saving is the only request. RNTL v14: `render` and `fireEvent` are awaited. Synthetic data.
 */

const t = en.moduleCard;
const c = t.calculator;
const REGISTRATION_ID = '00000000-0000-4000-8000-0000000000aa';
const PATH = `GET /api/modules/${REGISTRATION_ID}/DEMO1001`;
const outline = {
  level: 'outline' as const,
  academicYear: 2027,
  confirmedOn: '2027-02-03',
  draft: false,
};

function card(overrides: Partial<ModuleCardData> = {}): ModuleCardData {
  return {
    registrationId: REGISTRATION_ID,
    module: {
      code: 'DEMO1001',
      name: 'Sample module 1 (demo)',
      term: 'S1',
      academicYear: 2027,
      universityName: 'UJ',
    },
    sample: true,
    scheme: {
      universityId: 'uj',
      moduleCode: 'DEMO1001',
      academicYear: 2027,
      weighting: {
        value: {
          components: [
            { name: 'Test 1', kind: 'test', weight: 15 },
            { name: 'Test 2', kind: 'test', weight: 15 },
            { name: 'Assignment', kind: 'assignment', weight: 10 },
            { name: 'Final examination', kind: 'exam', weight: 60, subminimum: 40 },
          ],
        },
        source: outline,
      },
      examAdmission: { value: { minimumYearMark: 40, conditions: [] }, source: outline },
      examSubminimum: { value: 40, source: outline },
      otherRules: [],
      includesDrafts: false,
    },
    records: {},
    outline: {
      confirmedOn: '2027-02-03',
      dates: { status: 'confirmed', items: [{ label: 'Test 1', date: '2027-03-15' }] },
      books: { status: 'not-in-outline' },
      people: { status: 'not-in-outline' },
    },
    calendar: null,
    // As the server words them (the app never bundles the free-book words, A4-13).
    books: {
      free: {
        title: 'Free books (test)',
        lead: 'Lead (test)',
        books: [
          {
            label: 'Not your prescribed book (test)',
            title: 'Open Test Book',
            link: 'Open Open Test Book (test)',
            url: 'https://openstax.org/details/books/test',
            details: ['First-year level (test)'],
            draft: false,
          },
        ],
        none: null,
        onlyLegal: 'Only legal (test)',
      },
      library: null,
      noLibrary: null,
    },
    office: null,
    marks: [{ component: 'Assignment', attempt: 1, percent: 70 }],
    target: null,
    today: '2027-03-01',
    ...overrides,
  };
}

beforeEach(async () => {
  await saveToken('tok');
  (useLocalSearchParams as jest.Mock).mockReturnValue({
    code: 'DEMO1001',
    registrationId: REGISTRATION_ID,
  });
});

afterEach(() => jest.restoreAllMocks());

describe('the module card screen', () => {
  it('shows the card with its sources, and says it is a sample on the demo', async () => {
    serve({ [PATH]: { json: card() } });
    const screen = await render(<ModuleCardScreen />);
    await waitFor(() => expect(screen.getByText(t.demoSample)).toBeTruthy());
    const how = within(screen.getByTestId('card-how'));
    expect(how.getByText(t.how.title)).toBeTruthy();
    // Every rule here came from the SAMPLE outline, and says so.
    expect(
      how.getAllByText(t.sources.sampleOutline(formatDate('2027-02-03'))).length,
    ).toBeGreaterThan(0);
    // The pass mark isn't published: who to ask, never a number.
    expect(
      within(screen.getByTestId('card-how-passMark')).getByText(t.how.notPublishedOffice),
    ).toBeTruthy();
    expect(screen.getByText(t.people.notPublished)).toBeTruthy();
    // The free books come from the server, already in words.
    expect(screen.getByText('Not your prescribed book (test)')).toBeTruthy();
    expect(screen.getByLabelText('Open Open Test Book (test)')).toBeTruthy();
  });

  it('works the calculator out on the phone as marks are typed: no request but the card’s', async () => {
    const calls = serve({ [PATH]: { json: card() } });
    const screen = await render(<ModuleCardScreen />);
    await waitFor(() => expect(screen.getByTestId('mark-calculator')).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId('mark-0:1'), '60');
    await fireEvent.changeText(screen.getByTestId('mark-1:1'), '70');
    await fireEvent.changeText(screen.getByTestId('mark-target'), '60');
    const target = within(screen.getByTestId('calculator-target'));
    expect(target.getByText(c.needed(56))).toBeTruthy();
    expect(target.getByText(c.roundedUp('55.8'))).toBeTruthy();
    expect(screen.getByTestId('calculator-dp').props.children).toBe(c.dp.met(c.admissionTerm, 40));
    // No "needed to pass" number: this scheme prints no pass mark (gotcha 40).
    const pass = within(screen.getByTestId('calculator-pass'));
    expect(pass.getByText(c.passNotPublished)).toBeTruthy();
    expect(pass.queryByText(/You need \d/)).toBeNull();
    expect(calls.map((x) => x.key)).toEqual([PATH]);
  });

  it('marks a bad mark and saves good ones with one request', async () => {
    const calls = serve({
      [PATH]: { json: card() },
      [`PUT /api/modules/${REGISTRATION_ID}/DEMO1001`]: { json: card() },
    });
    const screen = await render(<ModuleCardScreen />);
    await waitFor(() => expect(screen.getByTestId('mark-calculator')).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId('mark-0:1'), '101');
    expect(screen.getByText(c.markInvalid)).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('mark-0:1'), '18/24');
    await fireEvent.press(screen.getByText(c.save));
    await waitFor(() => expect(screen.getByText(c.saved)).toBeTruthy());
    const saved = calls.find((x) => x.key.startsWith('PUT'));
    expect(saved?.body).toEqual({
      marks: [
        { component: 'Test 1', attempt: 1, percent: 75 },
        { component: 'Assignment', attempt: 1, percent: 70 },
      ],
      target: null,
    });
  });

  it('a mark field opens a keyboard that can type “18/24”: a decimal pad has no “/” (A7-24)', async () => {
    expect(markKeyboard('ios')).toBe('numbers-and-punctuation');
    expect(markKeyboard('android')).toBe('default');
    serve({ [PATH]: { json: card() } });
    const screen = await render(<ModuleCardScreen />);
    await waitFor(() => expect(screen.getByTestId('mark-calculator')).toBeTruthy());
    for (const id of ['mark-0:1', 'mark-1:1', 'mark-2:1']) {
      const field = screen.getByTestId(id);
      expect(field.props.keyboardType).toBe(markKeyboard(Platform.OS));
      expect(field.props.autoCorrect).toBe(false);
      expect(field.props.autoCapitalize).toBe('none');
    }
    // The target is a percentage only: the decimal pad is right for it.
    expect(screen.getByTestId('mark-target').props.keyboardType).toBe('decimal-pad');
  });

  it('says what the marks mean once, after typing stops, on one channel (A7-25)', async () => {
    const said = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
    // The preset's AccessibilityInfo is already a mock: only this test's calls count.
    said.mockClear();
    jest.useFakeTimers();
    try {
      serve({ [PATH]: { json: card() } });
      const screen = await render(<ModuleCardScreen />);
      await waitFor(() => expect(screen.getByTestId('mark-calculator')).toBeTruthy());
      const words = calculatorWords();
      const scheme = card().scheme;
      const summaryOf = (test1: string) => {
        const values = initialValues(calculatorFields(scheme, words).fields, card().marks);
        return calculate({ scheme, values: { ...values, '0:1': test1 }, target: '' }, words)
          .summary;
      };
      const summaries = () =>
        said.mock.calls
          .map(([text]) => text)
          .filter((text) => text !== t.demoSample && text !== c.sampleMarks);
      // Opening the card says nothing about marks nobody has typed yet.
      await act(async () => {
        jest.advanceTimersByTime(MARK_ANNOUNCE_DELAY_MS * 2);
      });
      expect(summaries()).toEqual([]);
      // "6" then "62": one announcement, of "62", once typing stops.
      await fireEvent.changeText(screen.getByTestId('mark-0:1'), '6');
      await act(async () => {
        jest.advanceTimersByTime(MARK_ANNOUNCE_DELAY_MS - 100);
      });
      await fireEvent.changeText(screen.getByTestId('mark-0:1'), '62');
      await act(async () => {
        jest.advanceTimersByTime(MARK_ANNOUNCE_DELAY_MS - 100);
      });
      expect(summaries()).toEqual([]);
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
      expect(summaries()).toEqual([summaryOf('62')]);
      expect(summaryOf('62')).not.toBe(summaryOf('6'));
      // No Android live region as well: TalkBack would say it twice.
      expect(screen.getByTestId('calculator-result').props.accessibilityLiveRegion).toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });

  it('says a module that isn’t theirs isn’t found', async () => {
    serve({});
    const screen = await render(<ModuleCardScreen />);
    await waitFor(() => expect(screen.getByText(t.notFound)).toBeTruthy());
  });
});

describe('My modules', () => {
  it('opens each registered module’s card', async () => {
    const screen = await render(
      <MyModulesCard
        artifact={
          {
            kind: 'my-modules',
            registrationId: REGISTRATION_ID,
            academicYear: 2027,
            yearOfStudy: 1,
            confirmedAt: '2027-02-01T08:00:00.000Z',
            programme: null,
            status: 'no-programme',
            curriculum: null,
            registered: [
              {
                code: 'DEMO1001',
                name: 'Sample module 1',
                term: 'S1',
                credits: null,
                inCurriculum: null,
              },
            ],
            expected: [],
            differences: [],
            credits: null,
            office: null,
            deadlines: {
              status: 'none',
              deadlines: [],
              unpublishedTerms: [],
              next: null,
              sourceUrl: null,
              draft: false,
            },
            reminderAt: null,
            message: null,
            includesDrafts: false,
          } as never
        }
      />,
    );
    await fireEvent.press(screen.getByLabelText(t.openFor('DEMO1001')));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/module/[code]',
      params: { code: 'DEMO1001', registrationId: REGISTRATION_ID },
    });
  });
});
