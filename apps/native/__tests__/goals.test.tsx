import { fireEvent, render, within } from '@testing-library/react-native';
import { en } from '@universityflow/content/app';
import type { ExamCountdownArtifact, GoalCardArtifact } from '@universityflow/ui';
import { AccessibilityInfo, Linking } from 'react-native';
import GoalsScreen from '../app/goals';
import { ArtifactCard } from '../components/artifact-card';
import { saveToken } from '../lib/session';
import type { ExamsResponse, GoalResponse } from '../lib/types';
import { serve } from '../test-utils/fake-api';
import { programme } from '../test-utils/fixtures';

const OPTIONS = [
  { id: 'uj-beng-civil', name: 'BEng Civil Engineering', universityName: 'UJ' },
  { id: 'wits-bsc-eng', name: 'BSc Engineering', universityName: 'Wits' },
];

const card: GoalCardArtifact = {
  kind: 'goal-card',
  programme: {
    id: 'wits-bsc-eng',
    name: 'BSc Engineering',
    faculty: 'Engineering and the Built Environment',
    universityId: 'wits',
    universityName: 'Wits',
    sourceUrl: 'https://www.wits.ac.za/',
    academicYear: 2027,
    draft: true,
  },
  result: programme({ verdict: 'close', draft: true }),
  hasMarks: true,
};

const countdown: ExamCountdownArtifact = {
  kind: 'exam-countdown',
  examYear: 2026,
  timetablePublished: true,
  subjectCount: 1,
  includesDrafts: true,
  papers: [
    {
      id: 'nsc-2026-mathematics-p1',
      subjectId: 'mathematics',
      subjectName: 'Mathematics',
      paper: 1,
      date: '2026-10-23',
      startsAt: '09:00',
      durationMinutes: 180,
      session: 'morning',
      daysLeft: 10,
      note: null,
      sourceUrl: 'https://www.kzneducation.gov.za/t.pdf',
      draft: true,
    },
  ],
};

const noGoal: GoalResponse = { goalId: null, card: null, options: OPTIONS };
const exams: ExamsResponse = {
  countdown,
  subjects: [
    { subjectId: 'mathematics', name: 'Mathematics', onReport: true, writes: true, changed: false },
  ],
};

beforeEach(async () => {
  await saveToken('tok');
});

describe('My goal and exams', () => {
  it('shows the countdown with days left, and labels unverified dates', async () => {
    serve({ 'GET /api/me/goal': { json: noGoal }, 'GET /api/me/exams': { json: exams } });
    const screen = await render(<GoalsScreen />);
    const paper = within(await screen.findByTestId('paper-nsc-2026-mathematics-p1'));
    expect(paper.getByText(en.goals.paper('Mathematics', 1))).toBeTruthy();
    expect(paper.getByText(en.goals.daysLeft(10))).toBeTruthy();
    expect(paper.getByTestId('draft-nsc-2026-mathematics-p1')).toHaveTextContent(
      en.common.draftBadge,
    );
    expect(screen.getByText(en.goals.noGoal)).toBeTruthy();
  });

  it('says when the timetable is not published, inventing nothing', async () => {
    serve({
      'GET /api/me/goal': { json: noGoal },
      'GET /api/me/exams': {
        json: {
          ...exams,
          countdown: { ...countdown, examYear: 2027, timetablePublished: false, papers: [] },
        },
      },
    });
    const screen = await render(<GoalsScreen />);
    expect(await screen.findByText(en.goals.notPublished(2027))).toBeTruthy();
    expect(screen.queryByTestId('paper-nsc-2026-mathematics-p1')).toBeNull();
  });

  it('sets a goal: searches the courses, saves through the API, shows the verdict', async () => {
    const calls = serve({
      'GET /api/me/goal': { json: noGoal },
      'GET /api/me/exams': { json: exams },
      'PUT /api/me/goal': { json: { goalId: 'wits-bsc-eng', card, options: OPTIONS } },
    });
    const screen = await render(<GoalsScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: en.goals.setGoal }));
    await fireEvent.changeText(screen.getByTestId('goal-search'), 'wits');
    expect(screen.queryByRole('button', { name: 'UJ: BEng Civil Engineering' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Wits: BSc Engineering' }));
    expect(await screen.findByText(en.goals.verdicts.close)).toBeTruthy();
    expect(screen.getByText(en.common.saved)).toBeTruthy();
    const put = calls.find((c) => c.key === 'PUT /api/me/goal');
    expect(put?.body).toEqual({ programmeId: 'wits-bsc-eng' });
    expect(put?.headers['authorization']).toBe('Bearer tok');
  });

  it('unticking a subject on the report records it as not written', async () => {
    const calls = serve({
      'GET /api/me/goal': { json: noGoal },
      'GET /api/me/exams': { json: exams },
      'PUT /api/me/exams': {
        json: {
          countdown: { ...countdown, papers: [] },
          subjects: [{ ...exams.subjects[0], writes: false, changed: true }],
        },
      },
    });
    const screen = await render(<GoalsScreen />);
    const box = await screen.findByRole('checkbox', { name: en.goals.write('Mathematics') });
    expect(box.props.accessibilityState).toMatchObject({ checked: true });
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
    await fireEvent.press(box);
    await screen.findByText(en.common.saved);
    // VoiceOver hears it too (A3-02): a live region is Android-only.
    expect(announce).toHaveBeenCalledWith(en.common.saved);
    announce.mockRestore();
    expect(calls.find((c) => c.key === 'PUT /api/me/exams')?.body).toEqual({
      subjectId: 'mathematics',
      included: false,
    });
  });

  it('explains a consent refusal with the content string', async () => {
    serve({
      'GET /api/me/goal': { status: 403, json: { error: 'consent', detail: null } },
      'GET /api/me/exams': { json: exams },
    });
    const screen = await render(<GoalsScreen />);
    expect(await screen.findByText(en.errors.consent)).toBeTruthy();
  });
});

describe('the goal and countdown as chat artifacts', () => {
  it('renders both in full', async () => {
    const screen = await render(
      <>
        <ArtifactCard artifact={card} />
        <ArtifactCard artifact={countdown} />
      </>,
    );
    expect(screen.getByTestId('artifact-goal-card')).toBeTruthy();
    expect(screen.getByText(en.goals.verdicts.close)).toBeTruthy();
    expect(screen.getByTestId('artifact-exam-countdown')).toBeTruthy();
    expect(screen.getByText(en.goals.daysLeft(10))).toBeTruthy();
  });
});

describe('official sources, as on the web (A2-09)', () => {
  const source = (context: string) => `${en.common.officialSource}: ${context}`;

  it('links the goal course and the exam timetable to their sources', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const screen = await render(
      <>
        <ArtifactCard artifact={{ ...card, result: null, hasMarks: false }} />
        <ArtifactCard artifact={countdown} />
      </>,
    );
    await fireEvent.press(screen.getByRole('link', { name: source('BSc Engineering') }));
    expect(open).toHaveBeenLastCalledWith('https://www.wits.ac.za/');
    // The visible text stays short; the course is in the accessible name.
    expect(screen.getAllByText(en.common.officialSource)).toHaveLength(2);
    await fireEvent.press(screen.getByRole('link', { name: source(en.goals.examsTitle) }));
    expect(open).toHaveBeenLastCalledWith('https://www.kzneducation.gov.za/t.pdf');
    open.mockRestore();
  });

  it('with a verdict, the programme card carries the one source link', async () => {
    const screen = await render(<ArtifactCard artifact={card} />);
    expect(screen.getAllByRole('link', { name: source('BSc Engineering') })).toHaveLength(1);
  });
});
