// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { examCountdown, goalCard, practicePlan } from '@universityflow/agent';
import { catalogueView } from '@universityflow/catalogue';
import { en } from '@universityflow/content';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoalsView } from '../app/(app)/goals/goals-view';
import { ArtifactView } from '../components/artifacts';
import { ExamCountdown, GoalCard } from '../components/goals';
import { PracticeCard } from '../components/practice';
import type { ExamsResponse, GoalResponse } from '../lib/server/goals';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const NOW = new Date('2026-10-13T08:00:00Z');
const VIEW = catalogueView(NOW, { includeDrafts: true });
const MARKS = [
  { subject: 'english-fal' as const, percent: 68 },
  { subject: 'mathematics' as const, percent: 71 },
  { subject: 'physical-sciences' as const, percent: 66 },
];
const REPORT = { kind: 'grade-12-june' as const, marks: MARKS };
const card = goalCard(VIEW, 'wits-bsc-computer-science', REPORT);
if (!card) throw new Error('expected the goal card');
const countdown = examCountdown({
  view: VIEW,
  now: NOW,
  grade: 12,
  confirmedSubjects: MARKS.map((m) => m.subject),
  choices: [],
});

describe('GoalCard', () => {
  it('shows the course, the verdict from admissions, a draft label and the pack link', () => {
    render(<GoalCard artifact={card} />);
    expect(screen.getByRole('heading', { name: en.goals.goalTitle })).toBeTruthy();
    expect(screen.getByText(en.goals.verdicts[card.result?.verdict ?? 'qualifies'])).toBeTruthy();
    expect(screen.getAllByText(en.common.draftBadge).length).toBeGreaterThan(0);
    const pack = screen.getByRole('link', { name: en.goals.openPack('Wits') });
    expect(pack.getAttribute('href')).toBe('/applications/wits');
  });

  it('asks for confirmed marks when there are none', () => {
    const noMarks = goalCard(VIEW, 'wits-bsc-computer-science', null);
    if (!noMarks) throw new Error('expected a card');
    render(<GoalCard artifact={noMarks} />);
    expect(screen.getByText(en.goals.noMarks)).toBeTruthy();
  });

  it('renders as a chat artifact too', () => {
    render(<ArtifactView artifact={card} />);
    expect(screen.getByRole('heading', { name: en.goals.goalTitle })).toBeTruthy();
  });
});

describe('ExamCountdown', () => {
  it('lists the next papers with the days left, and labels unverified dates', () => {
    render(<ArtifactView artifact={countdown} />);
    const first = within(screen.getByTestId('paper-nsc-2026-english-fal-p3'));
    expect(first.getByText(en.goals.paper('English First Additional Language', 3))).toBeTruthy();
    expect(first.getByText(en.goals.daysLeft(2))).toBeTruthy();
    expect(first.getByText(en.common.draftBadge)).toBeTruthy();
    expect(screen.getByText(en.common.draftNotice)).toBeTruthy();
    // The 2 November paper carries the open question about the elections.
    expect(screen.getByText(/2 to 5 November/)).toBeTruthy();
  });

  it('says plainly when the timetable is not published, and shows no dates', () => {
    render(
      <ExamCountdown
        artifact={{ ...countdown, examYear: 2027, timetablePublished: false, papers: [] }}
      />,
    );
    expect(screen.getByText(en.goals.notPublished(2027))).toBeTruthy();
    expect(screen.queryByRole('listitem')).toBeNull();
  });

  it('asks for subjects when none are known', () => {
    render(<ExamCountdown artifact={{ ...countdown, subjectCount: 0, papers: [] }} />);
    expect(screen.getByText(en.goals.noSubjects)).toBeTruthy();
  });
});

const practice = practicePlan({
  view: VIEW,
  grade: 12,
  goalProgrammeId: null,
  confirmedReport: REPORT,
});
const goalPractice = practicePlan({
  view: VIEW,
  grade: 12,
  goalProgrammeId: 'wits-bsc-computer-science',
  confirmedReport: REPORT,
});

describe('PracticeCard (Phase 4e)', () => {
  it('links each subject’s free resources, with what they are and what they cost', () => {
    render(<ArtifactView artifact={practice} />);
    expect(screen.getByRole('heading', { name: en.practice.title })).toBeTruthy();
    const maths = within(screen.getByTestId('practice-mathematics'));
    const book = maths.getByRole('link', { name: /Mathematics Grade 12/ });
    expect(book.getAttribute('href')).toBe('https://www.siyavula.com/read/za/mathematics/grade-12');
    expect(book.getAttribute('target')).toBe('_blank');
    expect(book.getAttribute('rel')).toBe('noopener noreferrer');
    expect(maths.getAllByText(en.practice.kinds.textbook).length).toBeGreaterThan(0);
    expect(maths.getAllByText(en.practice.access['free-with-account']).length).toBe(2);
    expect(maths.getByText(en.practice.reasons.weakest)).toBeTruthy();
    expect(screen.getByText(en.practice.signUpNote)).toBeTruthy();
  });

  it('labels unverified links (preview only)', () => {
    render(<PracticeCard artifact={practice} />);
    expect(screen.getByText(en.common.draftNotice)).toBeTruthy();
    expect(screen.getAllByText(en.common.draftBadge).length).toBeGreaterThan(0);
  });

  it('names the goal and links what I need, without any mark in the panel', () => {
    render(<PracticeCard artifact={goalPractice} />);
    expect(
      screen.getByText(en.practice.lead.goal(`${goalPractice.goal?.name} (Wits)`), {
        exact: false,
      }),
    ).toBeTruthy();
    const need = screen.getByRole('link', { name: en.practice.whatINeed });
    expect(need.getAttribute('href')).toBe('/results/what-i-need/wits-bsc-computer-science');
    expect(document.body.textContent).not.toMatch(/\d+%/);
  });

  it('says what to do when there is nothing to choose from, and says when a subject has none', () => {
    render(
      <PracticeCard
        artifact={{
          kind: 'practice',
          basis: 'none',
          goal: null,
          subjects: [],
          includesDrafts: false,
        }}
      />,
    );
    expect(screen.getByText(en.practice.lead.none)).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
    cleanup();
    render(
      <PracticeCard
        artifact={{
          kind: 'practice',
          basis: 'asked',
          goal: null,
          includesDrafts: false,
          subjects: [
            { subjectId: 'history', subjectName: 'History', reason: 'asked', resources: [] },
          ],
        }}
      />,
    );
    expect(screen.getByText(en.practice.noneYet)).toBeTruthy();
    expect(screen.queryByText(en.common.draftNotice)).toBeNull();
  });
});

describe('shown twice in the chat (A3-05)', () => {
  it('gives every copy its own ids, and each region is named by its own heading', () => {
    const { container } = render(
      <>
        <GoalCard artifact={card} />
        <GoalCard artifact={card} />
        <ExamCountdown artifact={countdown} />
        <ExamCountdown artifact={countdown} />
        <PracticeCard artifact={practice} />
        <PracticeCard artifact={practice} />
      </>,
    );
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
    const regions = [...container.querySelectorAll('[aria-labelledby]')];
    expect(regions.length).toBeGreaterThanOrEqual(6);
    for (const region of regions) {
      const heading = document.getElementById(region.getAttribute('aria-labelledby') ?? '');
      expect(heading).not.toBeNull();
      expect(region.contains(heading)).toBe(true);
    }
    expect(screen.getAllByRole('region', { name: en.goals.examsTitle })).toHaveLength(2);
    expect(screen.getAllByRole('region', { name: en.practice.title })).toHaveLength(2);
  });
});

/** The class every Card carries (components/ui.tsx). */
const CARD = '.rounded-lg.border';

describe('GoalCard has one card around it, not a card in a card (A2-10)', () => {
  it('renders the programme without its own card chrome, in valid list markup', () => {
    if (!card.result) throw new Error('expected a result');
    const { container } = render(<GoalCard artifact={card} />);
    const cards = [...container.querySelectorAll(CARD)];
    expect(cards).toHaveLength(1);
    expect(cards[0]?.querySelector(CARD)).toBeNull();
    // Whatever it renders, every <li> has a list parent.
    for (const li of container.querySelectorAll('li')) {
      expect(['UL', 'OL']).toContain(li.parentElement?.tagName);
    }
    // The programme's facts are all still there.
    expect(screen.getByRole('heading', { name: card.programme.name })).toBeTruthy();
    expect(screen.getByRole('link', { name: new RegExp(en.whatINeed.open) })).toBeTruthy();
  });
});

describe('PracticeCard badges stand out from their panel (A2-07)', () => {
  it('no neutral badge sits on a panel of its own colour', () => {
    const { container } = render(<PracticeCard artifact={practice} />);
    const panels = [...container.querySelectorAll('.bg-sunk')].filter((el) => el.tagName === 'LI');
    expect(panels.length).toBeGreaterThan(0);
    for (const panel of panels) expect(panel.querySelector('.bg-sunk')).toBeNull();
    const textbook = within(screen.getByTestId('practice-mathematics')).getAllByText(
      en.practice.kinds.textbook,
    )[0];
    expect(textbook?.className).toContain('bg-surface');
  });
});

describe('GoalsView', () => {
  const goal: GoalResponse = {
    goalId: null,
    card: null,
    options: [
      { id: 'uj-beng-civil', name: 'BEng Civil Engineering', universityName: 'UJ' },
      { id: 'wits-bsc-computer-science', name: 'BSc Computer Science', universityName: 'Wits' },
    ],
  };
  const exams: ExamsResponse = {
    countdown,
    subjects: [
      {
        subjectId: 'mathematics',
        name: 'Mathematics',
        onReport: true,
        writes: true,
        changed: false,
      },
    ],
  };

  it('labels every control', () => {
    render(<GoalsView goal={goal} exams={exams} practice={practice} />);
    expect(screen.getByLabelText(en.goals.choose)).toBeTruthy();
    expect(screen.getByLabelText(en.goals.write('Mathematics'))).toBeTruthy();
    expect(screen.getByLabelText(en.goals.addSubject)).toBeTruthy();
    expect(screen.getByText(en.goals.noGoal)).toBeTruthy();
  });

  it('sets the goal through the API and shows the card the server built', async () => {
    const fetch = vi.fn(async (url: string) =>
      Response.json(
        url === '/api/me/practice' ? goalPractice : { ...goal, goalId: card.programme.id, card },
      ),
    );
    vi.stubGlobal('fetch', fetch);
    render(<GoalsView goal={goal} exams={exams} practice={practice} />);
    fireEvent.change(screen.getByLabelText(en.goals.choose), {
      target: { value: 'wits-bsc-computer-science' },
    });
    fireEvent.click(screen.getByRole('button', { name: en.goals.setGoal }));
    expect(await screen.findByText(en.common.saved)).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith(
      '/api/me/goal',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ programmeId: 'wits-bsc-computer-science' }),
      }),
    );
    expect(screen.getByRole('link', { name: en.goals.openPack('Wits') })).toBeTruthy();
    // A new goal changes which subjects matter: the practice list follows it.
    expect(fetch).toHaveBeenCalledWith('/api/me/practice', expect.anything());
    expect(
      screen.getByText(en.practice.lead.goal(`${goalPractice.goal?.name} (Wits)`), {
        exact: false,
      }),
    ).toBeTruthy();
  });

  it('unticking a subject on the report records it as not written', async () => {
    const fetch = vi.fn(async () => Response.json(exams));
    vi.stubGlobal('fetch', fetch);
    render(<GoalsView goal={goal} exams={exams} practice={practice} />);
    fireEvent.click(screen.getByLabelText(en.goals.write('Mathematics')));
    expect(await screen.findByText(en.common.saved)).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith(
      '/api/me/exams',
      expect.objectContaining({
        body: JSON.stringify({ subjectId: 'mathematics', included: false }),
      }),
    );
  });

  describe('keeps keyboard focus through a save (A3-01, WCAG 2.4.3)', () => {
    /** A fetch that answers only when the test says so, to look at the page mid-request. */
    function held(answer: (url: string) => unknown) {
      const waiting: Array<() => void> = [];
      const fetch = vi.fn(
        (url: string) =>
          new Promise<Response>((resolve) => {
            waiting.push(() => resolve(Response.json(answer(url))));
          }),
      );
      vi.stubGlobal('fetch', fetch);
      return {
        fetch,
        release: async () => {
          while (waiting.length > 0) {
            waiting.shift()?.();
            await new Promise((r) => setTimeout(r, 0));
          }
        },
      };
    }

    it('stays on the exam-subject checkbox while it saves and after "Saved"', async () => {
      const server = held(() => exams);
      render(<GoalsView goal={goal} exams={exams} practice={practice} />);
      const box = screen.getByLabelText(en.goals.write('Mathematics')) as HTMLInputElement;
      box.focus();
      fireEvent.click(box);
      // Busy: not disabled (that drops focus to <body>), only marked and inert.
      expect(box.disabled).toBe(false);
      expect(box.getAttribute('aria-disabled')).toBe('true');
      expect(document.activeElement).toBe(box);
      // A second press while busy sends nothing.
      fireEvent.click(box);
      expect(server.fetch).toHaveBeenCalledTimes(1);
      await server.release();
      expect(await screen.findByText(en.common.saved)).toBeTruthy();
      expect(document.activeElement).toBe(box);
      expect(document.activeElement).not.toBe(document.body);
    });

    it('moves focus to the goal heading after "Make this my goal"', async () => {
      const server = held((url) =>
        url === '/api/me/practice' ? goalPractice : { ...goal, goalId: card.programme.id, card },
      );
      render(<GoalsView goal={goal} exams={exams} practice={practice} />);
      fireEvent.change(screen.getByLabelText(en.goals.choose), {
        target: { value: 'wits-bsc-computer-science' },
      });
      const button = screen.getByRole('button', { name: en.goals.setGoal });
      button.focus();
      fireEvent.click(button);
      expect((button as HTMLButtonElement).disabled).toBe(false);
      expect(document.activeElement).toBe(button);
      await server.release();
      expect(await screen.findByText(en.common.saved)).toBeTruthy();
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { name: en.goals.goalTitle }),
      );
    });

    it('moves focus to the goal heading after "Remove my goal" takes the button away', async () => {
      const withGoal: GoalResponse = { ...goal, goalId: card.programme.id, card };
      const server = held((url) => (url === '/api/me/practice' ? practice : goal));
      render(<GoalsView goal={withGoal} exams={exams} practice={goalPractice} />);
      const remove = screen.getByRole('button', { name: en.goals.clear });
      remove.focus();
      fireEvent.click(remove);
      await server.release();
      expect(await screen.findByText(en.goals.cleared)).toBeTruthy();
      expect(screen.queryByRole('button', { name: en.goals.clear })).toBeNull();
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { name: en.goals.goalTitle }),
      );
    });
  });

  it('says what went wrong when a save fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'consent', detail: null }, { status: 403 })),
    );
    render(<GoalsView goal={goal} exams={exams} practice={practice} />);
    fireEvent.change(screen.getByLabelText(en.goals.choose), {
      target: { value: 'uj-beng-civil' },
    });
    fireEvent.click(screen.getByRole('button', { name: en.goals.setGoal }));
    expect(await screen.findByText(en.errors.consent)).toBeTruthy();
  });
});
