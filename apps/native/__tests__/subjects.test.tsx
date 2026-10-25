import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { en } from '@universityflow/content/app';
import type { SubjectsCourse, SubjectsResponse } from '@universityflow/ui';
import { useRouter } from 'expo-router';
import { AccessibilityInfo } from 'react-native';
import SubjectsScreen from '../app/subjects';
import { saveToken } from '../lib/session';
import { serve } from '../test-utils/fake-api';

/**
 * My subjects in the app (G10-4): the same `GET /api/me/subjects` as the web page. It says what
 * code decided and never "all open" without courses to check. Synthetic data only.
 *
 * Rewritten for the approved redesign (round 2): the verdict first, by university, the closed
 * courses as disclosures named by what they need ("Needs Mathematics, 2 courses", was a
 * "Show the courses" button that never changed its name), rows in a list, the university filter
 * as radios, and the what-if, which asks the API with `?drop=&take=` and announces its answer.
 */

const t = en.subjects;

const course = (
  id: string,
  universityId: string,
  universityName: string,
  linkable = true,
): SubjectsCourse => ({ id, name: `Sample ${id}`, universityId, universityName, linkable });

const SAMPLE_U = 'Sample University';
const OTHER_U = 'Other Sample University';

const doors: NonNullable<SubjectsResponse['doors']> = {
  status: 'some-closed',
  checked: 10,
  open: 7,
  closed: 3,
  draft: true,
  byUniversity: [
    { id: 'other', name: OTHER_U, checked: 4, closed: 1 },
    { id: 'sample', name: SAMPLE_U, checked: 6, closed: 2 },
  ],
  groups: [
    {
      subjects: ['Mathematics'],
      programmes: [
        { ...course('engineering', 'sample', SAMPLE_U), alsoNeeds: [['Physical Sciences']] },
        { ...course('commerce', 'sample', SAMPLE_U), alsoNeeds: [] },
        { ...course('accounting', 'other', OTHER_U, false), alsoNeeds: [] },
      ],
    },
  ],
  higherBar: [
    {
      ...course('diploma', 'other', OTHER_U),
      reasons: [{ kind: 'score', subject: 'Mathematical Literacy', score: 26, otherwise: 24 }],
    },
  ],
  goal: null,
  swap: {
    drop: [
      { id: 'english-hl', name: 'English Home Language' },
      { id: 'mathematical-literacy', name: 'Mathematical Literacy' },
    ],
    take: [{ id: 'mathematics', name: 'Mathematics' }],
  },
  whatIf: null,
};

const checked: SubjectsResponse = {
  report: { kind: 'grade-10-final' },
  subjects: [
    { id: 'english-hl', name: 'English Home Language' },
    { id: 'mathematical-literacy', name: 'Mathematical Literacy' },
  ],
  doors,
};

beforeEach(async () => {
  await saveToken('tok');
  (useRouter().push as jest.Mock).mockClear();
});

async function loaded(data: SubjectsResponse = checked) {
  serve({ 'GET /api/me/subjects': { json: data } });
  const screen = await render(<SubjectsScreen />);
  await waitFor(() => expect(screen.getByTestId('subjects-summary')).toBeTruthy());
  return screen;
}

describe('My subjects', () => {
  it('with no confirmed report, asks for one and opens Upload', async () => {
    serve({ 'GET /api/me/subjects': { json: { report: null, subjects: [], doors: null } } });
    const screen = await render(<SubjectsScreen />);
    await waitFor(() => expect(screen.getByText(t.none)).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: t.add }));
    expect(useRouter().push).toHaveBeenCalledWith('/upload');
    expect(screen.queryByTestId('subjects-summary')).toBeNull();
  });

  it('says the verdict first, with the subjects, the report and a meter hidden from screen readers', async () => {
    const screen = await loaded();
    expect(screen.getByTestId('subjects-summary')).toHaveTextContent(t.someClosed(3, 10));
    expect(screen.getByRole('header', { name: t.someClosed(3, 10) })).toBeTruthy();
    expect(screen.getByText(t.meterLegend(7, 3))).toBeTruthy();
    const meter = screen.getByTestId('subjects-meter', { includeHiddenElements: true });
    expect(meter.props.accessibilityElementsHidden).toBe(true);
    expect(meter.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(screen.getByText(t.fromReport(en.reportKinds['grade-10-final']))).toBeTruthy();
    expect(screen.getByText('Mathematical Literacy')).toBeTruthy();
    expect(screen.getByText(t.draft)).toBeTruthy();
    expect(screen.getByText(t.talk)).toBeTruthy();
  });

  it('counts each university', async () => {
    const screen = await loaded();
    expect(screen.getByRole('header', { name: t.byUniversityTitle })).toBeTruthy();
    expect(screen.getByText(t.universityClosed(1, 4))).toBeTruthy();
    expect(screen.getByText(t.universityClosed(2, 6))).toBeTruthy();
  });

  it('shows a group’s courses on request: a button named by what they need, its state, a list', async () => {
    const screen = await loaded();
    expect(screen.queryByText('Sample commerce')).toBeNull();
    const group = screen.getByRole('button', { name: t.groupLabel('Mathematics', 3) });
    expect(group.props.accessibilityState).toMatchObject({ expanded: false });
    await fireEvent.press(group);
    expect(
      screen.getByRole('button', { name: t.groupLabel('Mathematics', 3) }).props.accessibilityState,
    ).toMatchObject({ expanded: true });
    // A list to TalkBack and VoiceOver (not one grouped element: each course stays its own link).
    const list = screen.getByTestId('subjects-courses');
    expect(list.props.accessibilityRole).toBe('list');
    expect(within(list).getByRole('header', { name: OTHER_U })).toBeTruthy();
    expect(within(list).getByRole('header', { name: SAMPLE_U })).toBeTruthy();
    expect(within(list).getByText(t.alsoNeeds('Physical Sciences'))).toBeTruthy();
    // What I need can't show this one: plain text, not a dead link.
    expect(within(list).queryByRole('link', { name: /Sample accounting/ })).toBeNull();
    await fireEvent.press(within(list).getByRole('link', { name: /Sample commerce/ }));
    expect(useRouter().push).toHaveBeenCalledWith('/what-i-need/commerce');
  });

  it('opens the group that holds the goal, and says where the goal stands', async () => {
    const goal = course('engineering', 'sample', SAMPLE_U);
    const screen = await loaded({
      ...checked,
      doors: {
        ...doors,
        goal: { course: goal, status: 'closed', needs: [['Mathematics'], ['Physical Sciences']] },
      },
    });
    expect(screen.getByText(t.goalLabel)).toBeTruthy();
    expect(screen.getByText(t.goalNeeds(`Mathematics${t.and}Physical Sciences`))).toBeTruthy();
    expect(
      screen.getByRole('button', { name: t.groupLabel('Mathematics', 3) }).props.accessibilityState,
    ).toMatchObject({ expanded: true });
  });

  it('filters the closed courses by university with radios, never the verdict', async () => {
    const screen = await loaded();
    const filter = screen.getByRole('button', { name: t.filterButton(t.allUniversities) });
    expect(filter.props.accessibilityState).toMatchObject({ expanded: false });
    await fireEvent.press(filter);
    await fireEvent.press(screen.getByRole('radio', { name: OTHER_U }));
    expect(screen.getByRole('radio', { name: OTHER_U }).props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.getByRole('button', { name: t.filterButton(OTHER_U) })).toBeTruthy();
    expect(screen.getByRole('button', { name: t.groupLabel('Mathematics', 1) })).toBeTruthy();
    expect(screen.getByText(t.countAt(1, 3))).toBeTruthy();
    expect(screen.getByTestId('subjects-summary')).toHaveTextContent(t.someClosed(3, 10));
  });

  it('says why a higher bar is higher', async () => {
    const screen = await loaded();
    expect(screen.getByText(t.higherScore('Mathematical Literacy', 26, 24))).toBeTruthy();
  });

  it('tries a different subject through the API and announces the answer', async () => {
    const asked = {
      ...checked,
      doors: {
        ...doors,
        whatIf: {
          drop: { id: 'mathematical-literacy', name: 'Mathematical Literacy' },
          take: { id: 'mathematics', name: 'Mathematics' },
          checked: 10,
          closed: 1,
          opened: [course('commerce', 'sample', SAMPLE_U)],
          closes: [],
        },
      },
    };
    const calls = serve({
      'GET /api/me/subjects': { json: checked },
      'GET /api/me/subjects?drop=mathematical-literacy&take=mathematics': { json: asked },
    });
    const screen = await render(<SubjectsScreen />);
    await waitFor(() => expect(screen.getByTestId('subjects-summary')).toBeTruthy());
    const said = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
    await fireEvent.press(
      screen.getByRole('button', { name: t.dropButton('English Home Language') }),
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Mathematical Literacy' }));
    expect(screen.getByRole('button', { name: t.takeButton('Mathematics') })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: t.check }));
    const heading = t.whatIfHeading('Mathematics', 'Mathematical Literacy');
    expect(await screen.findByRole('header', { name: heading })).toBeTruthy();
    expect(screen.getByText(t.whatIfVerdict(1, 10))).toBeTruthy();
    expect(screen.getByText(t.whatIfOpens(1))).toBeTruthy();
    expect(screen.getByText(t.reportUnchanged)).toBeTruthy();
    expect(said).toHaveBeenCalledWith(`${heading}. ${t.whatIfVerdict(1, 10)}`);
    said.mockRestore();
    expect(calls.map((c) => c.key)).toContain(
      'GET /api/me/subjects?drop=mathematical-literacy&take=mathematics',
    );
    // The real verdict is unchanged.
    expect(screen.getByTestId('subjects-summary')).toHaveTextContent(t.someClosed(3, 10));
  });

  it('never says doors are open when nothing could be checked', async () => {
    serve({
      'GET /api/me/subjects': {
        json: {
          ...checked,
          doors: {
            ...doors,
            status: 'unknown',
            checked: 0,
            open: 0,
            closed: 0,
            draft: false,
            byUniversity: [],
            groups: [],
            higherBar: [],
            swap: { drop: doors.swap.drop, take: [] },
          },
        },
      },
    });
    const screen = await render(<SubjectsScreen />);
    await waitFor(() => expect(screen.getByText(t.unknown)).toBeTruthy());
    expect(screen.queryByTestId('subjects-summary')).toBeNull();
    expect(screen.queryByRole('button', { name: t.check })).toBeNull();
  });
});
