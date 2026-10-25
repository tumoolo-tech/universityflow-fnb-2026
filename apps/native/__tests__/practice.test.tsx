import { fireEvent, render, within } from '@testing-library/react-native';
import { en } from '@universityflow/content/app';
import { TEXT_PAIRS } from '@universityflow/tokens';
import type { PracticeArtifact } from '@universityflow/ui';
import { Linking, StyleSheet } from 'react-native';
import GoalsScreen from '../app/goals';
import { ArtifactCard } from '../components/artifact-card';
import { saveToken } from '../lib/session';
import { theme } from '../lib/theme';
import type { ExamsResponse, GoalResponse } from '../lib/types';
import { serve } from '../test-utils/fake-api';

type Node = { props: { style?: unknown }; parent: Node | null };

/** The background an element is drawn on: its own, or the nearest ancestor's. */
function background(node: Node | null): string | undefined {
  for (let n = node; n; n = n.parent) {
    const bg = (StyleSheet.flatten(n.props.style as never) as { backgroundColor?: string } | null)
      ?.backgroundColor;
    if (bg) return bg;
  }
  return undefined;
}

const practice: PracticeArtifact = {
  kind: 'practice',
  basis: 'goal',
  goal: { programmeId: 'wits-bsc-eng', name: 'BSc Engineering', universityName: 'Wits' },
  includesDrafts: true,
  subjects: [
    {
      subjectId: 'mathematics',
      subjectName: 'Mathematics',
      reason: 'goal-to-raise',
      resources: [
        {
          id: 'siyavula-mathematics-grade-12-textbook',
          kind: 'textbook',
          title: 'Mathematics Grade 12',
          url: 'https://www.siyavula.com/read/za/mathematics/grade-12',
          grades: [12],
          access: 'free',
          sourceUrl: 'https://www.siyavula.com/read',
          draft: true,
        },
        {
          id: 'siyavula-mathematics-practice',
          kind: 'practice',
          title: 'Siyavula Practice: Mathematics',
          url: 'https://www.siyavula.com/products/learners',
          grades: [10, 11, 12],
          access: 'free-with-account',
          sourceUrl: 'https://www.siyavula.com/pricing',
          draft: true,
        },
      ],
    },
    { subjectId: 'history', subjectName: 'History', reason: 'goal-requires', resources: [] },
  ],
};

const noGoal: GoalResponse = { goalId: null, card: null, options: [] };
const exams: ExamsResponse = {
  countdown: {
    kind: 'exam-countdown',
    examYear: 2027,
    timetablePublished: false,
    subjectCount: 0,
    includesDrafts: true,
    papers: [],
  },
  subjects: [],
};

beforeEach(async () => {
  await saveToken('tok');
});

describe('Free practice (Phase 4e)', () => {
  it('renders as a chat artifact: subjects, reasons, what each link is and costs, drafts labelled', async () => {
    const screen = await render(<ArtifactCard artifact={practice} />);
    expect(screen.getByTestId('artifact-practice')).toBeTruthy();
    expect(screen.getByText(en.practice.title)).toBeTruthy();
    expect(screen.getByText(en.practice.lead.goal('BSc Engineering (Wits)'))).toBeTruthy();
    const maths = within(screen.getByTestId('practice-mathematics'));
    expect(maths.getByText(en.practice.reasons['goal-to-raise'])).toBeTruthy();
    expect(maths.getByText(en.practice.access.free)).toBeTruthy();
    expect(maths.getByText(en.practice.access['free-with-account'])).toBeTruthy();
    expect(maths.getByTestId('draft-siyavula-mathematics-grade-12-textbook')).toHaveTextContent(
      en.common.draftBadge,
    );
    expect(screen.getByText(en.common.draftNotice)).toBeTruthy();
    expect(screen.getByText(en.practice.signUpNote)).toBeTruthy();
    expect(
      within(screen.getByTestId('practice-history')).getByText(en.practice.noneYet),
    ).toBeTruthy();
  });

  it('opens a link in the browser with one tap', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const screen = await render(<ArtifactCard artifact={practice} />);
    await fireEvent.press(
      screen.getByRole('link', { name: en.practice.openApp('Mathematics Grade 12') }),
    );
    expect(open).toHaveBeenCalledWith('https://www.siyavula.com/read/za/mathematics/grade-12');
    open.mockRestore();
  });

  it('colours links with the tested brand-on-sunk pair (A2-06, A3-08)', async () => {
    const screen = await render(<ArtifactCard artifact={practice} />);
    const link = within(screen.getByTestId('practice-mathematics')).getByText(
      'Mathematics Grade 12',
    );
    const style = StyleSheet.flatten(link.props.style) as { color?: string };
    expect(style.color).toBe(theme.on('sunkBrand').color);
    expect(theme.on('sunkBrand').backgroundColor).toBe(theme.color.surfaceSunk);
    expect(TEXT_PAIRS).toContainEqual(['brand', 'surfaceSunk']);
  });

  it('sets neutral chips apart from the sunk panel they sit on (A2-07)', async () => {
    const screen = await render(<ArtifactCard artifact={practice} />);
    const panel = screen.getByTestId('practice-mathematics');
    const panelBg = background(panel);
    expect(panelBg).toBe(theme.color.surfaceSunk);
    for (const text of [en.practice.kinds.textbook, en.practice.grades('12')]) {
      const chip = within(panel).getByText(text);
      expect({ text, background: background(chip) }).toEqual({
        text,
        background: theme.color.surface,
      });
    }
  });

  it('shows on My goal and exams', async () => {
    const calls = serve({
      'GET /api/me/goal': { json: noGoal },
      'GET /api/me/exams': { json: exams },
      'GET /api/me/practice': { json: practice },
    });
    const screen = await render(<GoalsScreen />);
    expect(await screen.findByTestId('practice')).toBeTruthy();
    expect(calls.filter((c) => c.key === 'GET /api/me/practice')).toHaveLength(1);
  });

  it('leaves the rest of the screen working when practice can’t load', async () => {
    serve({ 'GET /api/me/goal': { json: noGoal }, 'GET /api/me/exams': { json: exams } });
    const screen = await render(<GoalsScreen />);
    expect(await screen.findByText(en.goals.noGoal)).toBeTruthy();
    expect(screen.queryByTestId('practice')).toBeNull();
  });
});
