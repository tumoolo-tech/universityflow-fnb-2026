// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import { en, moduleCard } from '@universityflow/content';
import { afterEach, describe, expect, it } from 'vitest';
import { Dashboard } from '../components/dashboard';
import { formatDate } from '../lib/client/api';
import type { HomeData } from '../lib/server/home';

/**
 * The signed-in home (docs/design/README.md). Headings and landmarks, links named for what they
 * do, and every number shown only when something is behind it: an empty learner sees "not yet"
 * lines, never a 0 that isn't true. Synthetic data only.
 */

afterEach(cleanup);

const t = en.dashboard;

const empty: HomeData = {
  stage: 'grade-11',
  name: null,
  qualify: null,
  nextPaperDays: null,
  subjects: null,
  gradeCheck: null,
  turningEighteen: null,
  goalProgrammeId: null,
  shortlist: [],
  applications: [],
  universityYear: null,
  offers: [],
  registration: null,
  firstWeek: null,
  modules: null,
  marks: [],
  subjectNames: {},
  look: { theme: 'mauve', avatar: 'initials' },
  next: { id: 'add-report', href: '/documents' },
};

const marks = (kind: 'grade-11-final' | 'grade-12-june', math: number, english: number) => ({
  kind,
  average: Math.round((math + english) / 2),
  marks: [
    { subject: 'english-fal', percent: english },
    { subject: 'mathematics', percent: math },
  ],
});

const matric: HomeData = {
  ...empty,
  stage: 'matric',
  name: 'Lerato',
  qualify: { basis: 'admission', now: 12, onTrack: 0, close: 4, planB: 3, checked: 86 },
  nextPaperDays: 9,
  goalProgrammeId: 'uj-beng-civil',
  shortlist: [
    {
      programmeId: 'uj-beng-civil',
      name: 'Sample engineering course',
      universityName: 'UJ',
      verdict: 'close',
      draft: true,
    },
    {
      programmeId: 'wits-bsc',
      name: 'Sample science course',
      universityName: 'Wits',
      verdict: 'qualifyNow',
      draft: false,
    },
  ],
  applications: [
    {
      universityId: 'uj',
      universityName: 'UJ',
      status: 'planning',
      done: 2,
      total: 8,
      closesOn: '2027-09-30',
    },
  ],
  marks: [marks('grade-11-final', 58, 62), marks('grade-12-june', 71, 72)],
  subjectNames: { 'english-fal': 'English First Additional Language', mathematics: 'Mathematics' },
  next: { id: 'checklist', href: '/applications/uj', universityName: 'UJ' },
};

const university: HomeData = {
  ...empty,
  stage: 'university',
  name: 'Kagiso',
  universityYear: { group: 'arriving', yearOfStudy: 1, draft: false },
  offers: [
    {
      kind: 'offer-card',
      id: 'offer-1',
      offerKind: 'final',
      status: 'accepted',
      source: 'learner',
      universityId: 'up',
      universityName: 'University of Pretoria',
      programme: {
        id: 'up-bsc',
        name: 'Sample computing course',
        faculty: 'Sample faculty',
        sourceUrl: 'https://example.org',
        academicYear: 2027,
        draft: false,
      },
      replyBy: null,
      daysLeft: null,
      conditions: [],
      reminderAt: null,
      checksFinal: false,
      finalCheck: null,
    },
  ],
  registration: { days: 103, phase: 'closes' },
  firstWeek: { done: 3, total: 8 },
  modules: null,
  next: { id: 'first-week', href: '/first-week' },
};

describe('a report but no course to check it against (A1-41)', () => {
  it('says it can’t check yet, never "0 courses you qualify for"', () => {
    render(
      <Dashboard
        data={{
          ...matric,
          qualify: { basis: 'admission', now: 0, onTrack: 0, close: 0, planB: 0, checked: 0 },
        }}
      />,
    );
    const card = screen.getByRole('region', { name: t.qualify.title });
    expect(within(card).getByText(en.subjects.card.unknown)).toBeTruthy();
    expect(within(card).queryByTestId('home-number')).toBeNull();
  });
});

describe('the notice before the 18th birthday (A11-25)', () => {
  it('names the day and says what changes, as a note with its own heading', () => {
    render(<Dashboard data={{ ...matric, turningEighteen: { on: '2026-11-08' } }} />);
    const heading = screen.getByRole('heading', {
      name: t.turningEighteen.title(formatDate('2026-11-08')),
    });
    const note = heading.closest('[role="note"]') as HTMLElement;
    expect(within(note).getByText(t.turningEighteen.lead)).toBeTruthy();
  });

  it('is not there without a birthday coming', () => {
    render(<Dashboard data={matric} />);
    expect(screen.queryByText(t.turningEighteen.lead)).toBeNull();
  });
});

describe('the home: header, sections and the ask bar', () => {
  it('welcomes the learner by the name they gave, and names the stage', () => {
    render(<Dashboard data={matric} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome, Lerato' })).toBeTruthy();
    expect(screen.getByText(t.subtitle.matric)).toBeTruthy();
  });

  it('says just "Welcome" with no name', () => {
    render(<Dashboard data={empty} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome' })).toBeTruthy();
    expect(screen.getByText(t.subtitle['grade-11'])).toBeTruthy();
  });

  it('names the icon buttons', () => {
    render(<Dashboard data={empty} />);
    expect(screen.getByRole('link', { name: t.reminders }).getAttribute('href')).toBe('/me');
    expect(screen.getByRole('link', { name: t.aboutMe }).getAttribute('href')).toBe('/me');
  });

  it('shows the learner’s avatar on About me, in their theme, still named "About me"', () => {
    render(<Dashboard data={{ ...matric, look: { theme: 'ocean', avatar: 'icon:rocket' } }} />);
    const link = screen.getByRole('link', { name: t.aboutMe });
    const avatar = link.querySelector('[data-avatar="home"]');
    expect(avatar?.getAttribute('aria-hidden')).toBe('true');
    expect(avatar?.querySelector('svg')).toBeTruthy();
    expect(link.getAttribute('style')).toContain('var(--uf-color-profile-ocean)');
  });

  it('shows the initials of the name, or a person without one', () => {
    const { unmount } = render(<Dashboard data={matric} />);
    const named = screen.getByRole('link', { name: t.aboutMe });
    expect(named.querySelector('[data-avatar="home"]')?.textContent).toBe('L');
    unmount();
    render(<Dashboard data={empty} />);
    const unnamed = screen.getByRole('link', { name: t.aboutMe });
    expect(unnamed.querySelector('[data-avatar="home"] svg')).toBeTruthy();
  });

  it('shows the journey as an ordered list, each step’s state in words, only the current one linked', () => {
    render(<Dashboard data={matric} />);
    const journey = screen.getByRole('region', { name: t.journey.label });
    const steps = within(journey).getAllByRole('listitem');
    expect(within(journey).getByRole('list').tagName).toBe('OL');
    expect(steps.map((li) => li.textContent)).toEqual([
      `1${t.journey.steps.report}${t.journey.status.done}`,
      `2${t.journey.steps.shortlist}${t.journey.status.done}`,
      `3${t.journey.steps.goal}${t.journey.status.done}`,
      `4${t.journey.steps.applications}${t.journey.status.current}`,
      `5${t.journey.steps.funding}${t.journey.status.todo}`,
    ]);
    expect(steps[3]?.getAttribute('aria-current')).toBe('step');
    const links = within(journey).getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/applications']);
    cleanup();
    render(<Dashboard data={university} />);
    const uni = screen.getByRole('region', { name: t.journey.label });
    expect(
      within(uni)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      `1${t.journey.steps.offer}${t.journey.status.done}`,
      `2${t.journey.steps['first-week']}${t.journey.status.current}`,
      `3${t.journey.steps.modules}${t.journey.status.todo}`,
    ]);
  });

  it('names each step the same way whatever its state: the word under it says the state', () => {
    render(<Dashboard data={empty} />);
    const [now] = within(screen.getByRole('region', { name: t.journey.label })).getAllByRole(
      'listitem',
    );
    expect(now?.textContent).toBe(`1Report${t.journey.status.current}`);
    cleanup();
    render(<Dashboard data={matric} />);
    const [done] = within(screen.getByRole('region', { name: t.journey.label })).getAllByRole(
      'listitem',
    );
    expect(done?.textContent).toBe(`1Report${t.journey.status.done}`);
    cleanup();
    render(<Dashboard data={university} />);
    const uni = within(screen.getByRole('region', { name: t.journey.label })).getAllByRole(
      'listitem',
    );
    expect(uni.map((li) => li.textContent)).toEqual([
      `1Offer${t.journey.status.done}`,
      `2First week${t.journey.status.current}`,
      `3Modules${t.journey.status.todo}`,
    ]);
  });

  it('draws every step as the same box in equal columns: only the current one has the mauve edge', () => {
    render(<Dashboard data={matric} />);
    const journey = within(screen.getByRole('region', { name: t.journey.label }));
    // One equal column per step from a tablet's width, one per row on a phone.
    expect(journey.getByRole('list').className).toContain('md:grid-cols-5');
    const boxes = journey.getAllByRole('listitem').map((li) => li.firstElementChild as HTMLElement);
    const shape = (el: HTMLElement) =>
      el.className
        .split(' ')
        .filter((c) => !/^(border-(brand|line)|no-underline|hover:)/.test(c))
        .join(' ');
    expect(new Set(boxes.map(shape)).size).toBe(1);
    expect(boxes.map((b) => b.className.includes('border-brand'))).toEqual([
      false,
      false,
      false,
      true,
      false,
    ]);
    cleanup();
    render(<Dashboard data={university} />);
    expect(
      within(screen.getByRole('region', { name: t.journey.label })).getByRole('list').className,
    ).toContain('md:grid-cols-3');
  });

  it('opens the chat from the ask bar, and makes the next step one link with a visible Start', () => {
    render(<Dashboard data={matric} />);
    expect(screen.getByRole('link', { name: t.ask }).getAttribute('href')).toBe('/chat');
    const next = screen.getByRole('region', { name: t.next.label });
    const link = within(next).getByRole('link');
    expect(link.getAttribute('href')).toBe('/applications/uj');
    expect(link.textContent).toContain(t.next.checklist('UJ'));
    expect(link.textContent).toContain(t.next.start);
  });

  it('gives each empty card one clear action, never the same one twice', () => {
    render(<Dashboard data={empty} />);
    const action = (region: string, name: string) =>
      within(screen.getByRole('region', { name: region }))
        .getByRole('link', { name })
        .getAttribute('href');
    expect(action(t.qualify.title, t.qualify.add)).toBe('/documents');
    expect(action(t.shortlist.title, t.shortlist.browse)).toBe('/results');
    expect(action(t.applications.title, t.applications.how)).toBe('/applications');
    expect(action(t.promo.goalTitle, t.promo.chooseGoalAction)).toBe('/goals');
  });
});

describe('the home before university', () => {
  it('shows the learner’s own numbers when they have them', () => {
    render(<Dashboard data={matric} />);
    const card = screen.getByRole('region', { name: t.qualify.title });
    expect(within(card).getByTestId('home-number').textContent).toBe('12');
    expect(within(card).getByText(`${t.qualify.close(4)} · ${t.qualify.planB(3)}`)).toBeTruthy();
    expect(within(card).getByTestId('home-next-paper').textContent).toBe(t.nextPaper(9));
  });

  it('on Grade 10 marks counts the courses on track, never "qualify", and no Plan B (G10-3)', () => {
    render(
      <Dashboard
        data={{
          ...matric,
          qualify: { basis: 'progress', now: 0, onTrack: 15, close: 4, planB: 0, checked: 86 },
        }}
      />,
    );
    expect(screen.queryByRole('region', { name: t.qualify.title })).toBeNull();
    const card = screen.getByRole('region', { name: t.qualify.titleGrade10 });
    expect(within(card).getByTestId('home-number').textContent).toBe('15');
    expect(within(card).getByText(t.qualify.close(4))).toBeTruthy();
    expect(within(card).queryByText(new RegExp(t.qualify.planB(0)))).toBeNull();
  });

  it('shows no number at all with nothing behind it: a "not yet" line instead', () => {
    render(<Dashboard data={empty} />);
    expect(screen.queryByTestId('home-number')).toBeNull();
    expect(screen.queryByTestId('home-next-paper')).toBeNull();
    const card = screen.getByRole('region', { name: t.qualify.title });
    expect(within(card).getByText(t.qualify.none)).toBeTruthy();
    expect(within(card).getByRole('link', { name: t.qualify.add }).getAttribute('href')).toBe(
      '/documents',
    );
    expect(screen.getByText(t.shortlist.empty)).toBeTruthy();
    expect(screen.getByText(t.applications.empty)).toBeTruthy();
    expect(screen.getByText(t.chart.none)).toBeTruthy();
    expect(screen.queryByTestId('marks-chart')).toBeNull();
  });

  it('lists the shortlist with each course’s standing, and labels a draft', () => {
    render(<Dashboard data={matric} />);
    const list = screen.getByRole('region', { name: t.shortlist.title });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0] as HTMLElement).getByText(en.results.groups.close)).toBeTruthy();
    expect(within(rows[0] as HTMLElement).getByText(en.common.draftBadge)).toBeTruthy();
    expect(within(rows[1] as HTMLElement).getByText(en.results.groups.qualifyNow)).toBeTruthy();
    expect(within(rows[1] as HTMLElement).queryByText(en.common.draftBadge)).toBeNull();
  });

  it('shows each application with its status, checklist and closing date', () => {
    render(<Dashboard data={matric} />);
    const apps = screen.getByRole('region', { name: t.applications.title });
    expect(within(apps).getByRole('link', { name: 'UJ' }).getAttribute('href')).toBe(
      '/applications/uj',
    );
    expect(within(apps).getByText(en.applications.statuses.planning)).toBeTruthy();
    expect(within(apps).getByText(t.applications.checklist(2, 8))).toBeTruthy();
  });

  it('points the promo at "what I need" for the goal, or to choosing one', () => {
    render(<Dashboard data={matric} />);
    expect(screen.getByRole('link', { name: t.promo.goalAction }).getAttribute('href')).toBe(
      '/results/what-i-need/uj-beng-civil',
    );
    cleanup();
    render(<Dashboard data={empty} />);
    expect(screen.getByRole('link', { name: t.promo.chooseGoalAction }).getAttribute('href')).toBe(
      '/goals',
    );
  });
});

describe('the home in Grade 10 (Stage 0, G10-4)', () => {
  const grade10: HomeData = {
    ...empty,
    stage: 'grade-10',
    qualify: { basis: 'progress', now: 0, onTrack: 15, close: 4, planB: 0, checked: 86 },
    subjects: { status: 'some-closed', checked: 80, closed: 31, draft: true },
    shortlist: matric.shortlist,
    applications: [],
    next: { id: 'goal', href: '/goals' },
  };

  it('names the stage, and walks report, subjects, goal, study in four equal columns', () => {
    render(<Dashboard data={grade10} />);
    expect(screen.getByText(t.subtitle['grade-10'])).toBeTruthy();
    const journey = within(screen.getByRole('region', { name: t.journey.label }));
    expect(journey.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      `1${t.journey.steps.report}${t.journey.status.done}`,
      `2${t.journey.steps.subjects}${t.journey.status.done}`,
      `3${t.journey.steps.goal}${t.journey.status.current}`,
      `4${t.journey.steps.study}${t.journey.status.todo}`,
    ]);
    expect(journey.getByRole('list').className).toContain('md:grid-cols-4');
  });

  it('shows the subjects card in place of the applications, linking to My subjects', () => {
    render(<Dashboard data={grade10} />);
    expect(screen.queryByRole('region', { name: t.applications.title })).toBeNull();
    const card = screen.getByRole('region', { name: en.subjects.card.title });
    expect(within(card).getByTestId('home-subjects').textContent).toBe(en.subjects.card.closed(31));
    expect(within(card).getByText(en.common.draftBadge)).toBeTruthy();
    expect(
      within(card).getByRole('link', { name: en.subjects.card.action }).getAttribute('href'),
    ).toBe('/subjects');
  });

  it('never claims every door is open when nothing could be checked', () => {
    render(
      <Dashboard
        data={{ ...grade10, subjects: { status: 'unknown', checked: 0, closed: 0, draft: false } }}
      />,
    );
    const card = screen.getByRole('region', { name: en.subjects.card.title });
    expect(within(card).getByText(en.subjects.card.unknown)).toBeTruthy();
    expect(within(card).queryByText(en.subjects.card.open)).toBeNull();
  });

  it('before a report the card says "not yet" alone: the headline card offers the report', () => {
    render(<Dashboard data={{ ...grade10, qualify: null, subjects: null }} />);
    const card = screen.getByRole('region', { name: en.subjects.card.title });
    expect(within(card).getByText(en.subjects.card.none)).toBeTruthy();
    expect(within(card).queryByRole('link')).toBeNull();
  });

  it('before a report the headline card already speaks of Grade 10: on track, never "qualify" (G10-5)', () => {
    render(<Dashboard data={{ ...grade10, qualify: null, subjects: null }} />);
    expect(screen.queryByRole('region', { name: t.qualify.title })).toBeNull();
    const card = screen.getByRole('region', { name: t.qualify.titleGrade10 });
    expect(within(card).getByRole('link', { name: t.qualify.add }).getAttribute('href')).toBe(
      '/documents',
    );
  });

  it('the next step to study goes to My goal’s practice', () => {
    render(<Dashboard data={{ ...grade10, next: { id: 'study', href: '/goals#practice' } }} />);
    const link = within(screen.getByRole('region', { name: t.next.label })).getByRole('link');
    expect(link.getAttribute('href')).toBe('/goals#practice');
    expect(link.textContent).toContain(t.next.study);
  });
});

describe('the marks chart', () => {
  it('draws two reports as decoration, with the table as the readable version', () => {
    render(<Dashboard data={matric} />);
    const chart = screen.getByRole('region', { name: t.chart.title });
    expect(within(chart).getByTestId('marks-chart').getAttribute('aria-hidden')).toBe('true');
    const table = within(chart).getByRole('table', { hidden: false });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((c) => c.textContent),
    ).toEqual([t.chart.subject, t.chart.short['grade-11-final'], t.chart.short['grade-12-june']]);
    const maths = within(table).getByRole('row', { name: /Mathematics/ });
    expect(maths.textContent).toBe('Mathematics58%71%');
    expect(within(table).getByRole('row', { name: /Average/ }).textContent).toBe('Average60%72%');
  });

  // A2-63 (DEMO-walk): all eight report kinds along the bottom could not fit a 360 px phone, and
  // their labels' min-content widened the whole home to 410 px (sideways scroll, WCAG 1.4.10).
  // The axis is `chartKinds`: from Grade 11, interim reports below Grade 12 only when held.
  it('runs its axis over the reports that matter, each label free to shrink (A2-63)', () => {
    render(<Dashboard data={matric} />);
    const axis = screen.getByTestId('marks-axis');
    const labels = Array.from(axis.children) as HTMLElement[];
    expect(labels.map((l) => l.textContent)).toEqual([
      t.chart.short['grade-11-final'],
      t.chart.short['grade-12-june'],
      t.chart.short['grade-12-september'],
      t.chart.short['grade-12-final'],
    ]);
    for (const label of labels) expect(label.className).toContain('min-w-0');
  });

  it('with one report, says so in words: no line to draw', () => {
    render(<Dashboard data={{ ...matric, marks: [marks('grade-11-final', 58, 62)] }} />);
    expect(screen.getByText(t.chart.one(en.reportKinds['grade-11-final'], 60))).toBeTruthy();
    expect(screen.queryByTestId('marks-chart')).toBeNull();
  });
});

describe('the home at university', () => {
  it('counts down to registration, and shows the offer, first week and modules', () => {
    render(<Dashboard data={university} />);
    expect(screen.getByText(t.subtitle.university)).toBeTruthy();
    const reg = screen.getByRole('region', { name: t.registration.title });
    expect(within(reg).getByTestId('home-number').textContent).toBe('103');
    expect(within(reg).getByText(t.registration.closes(103))).toBeTruthy();
    const offers = screen.getByRole('region', { name: t.offers.title });
    expect(within(offers).getByText(en.offers.statuses.accepted)).toBeTruthy();
    const ready = screen.getByRole('region', { name: t.gettingReady.title });
    expect(within(ready).getByTestId('home-first-week').textContent).toBe('3/8');
    expect(within(ready).queryByTestId('home-modules')).toBeNull();
    expect(within(ready).getByText(t.gettingReady.modulesNone)).toBeTruthy();
    expect(screen.getByRole('link', { name: t.promo.campusAction }).getAttribute('href')).toBe(
      '/campus',
    );
  });

  it('with no published registration dates, no countdown: a "not yet" line', () => {
    render(<Dashboard data={{ ...university, registration: null }} />);
    expect(screen.queryByTestId('home-number')).toBeNull();
    expect(screen.getByText(t.registration.none)).toBeTruthy();
  });

  it('says nothing about matching when the modules couldn’t be checked', () => {
    render(
      <Dashboard data={{ ...university, modules: { confirmed: 6, toFix: 0, checked: false } }} />,
    );
    expect(screen.getByTestId('home-modules').textContent).toBe('6');
    expect(screen.queryByText(t.gettingReady.modulesMatch)).toBeNull();
    cleanup();
    render(
      <Dashboard data={{ ...university, modules: { confirmed: 6, toFix: 2, checked: true } }} />,
    );
    expect(screen.getByText(t.gettingReady.modulesToFix(2))).toBeTruthy();
  });

  // A2-66 (DEMO-walk): "My marks over time… once you've confirmed a school report" on the home of
  // a student already at university.
  it('shows no school-marks chart at university without a school report; with one, the chart (A2-66)', () => {
    render(<Dashboard data={university} />);
    expect(screen.queryByRole('region', { name: t.chart.title })).toBeNull();
    expect(screen.queryByText(t.chart.none)).toBeNull();
    cleanup();
    render(<Dashboard data={{ ...university, marks: matric.marks }} />);
    expect(screen.getByRole('region', { name: t.chart.title })).toBeTruthy();
  });
});

// A2-66 (DEMO-walk): Sipho (second year) and Kagiso (final year) got an arriving student's home:
// "your first weeks at a glance", a registration countdown, "Know your campus… before your first
// day", the offer and the first-week steps.
describe('the home in a second or final year (A2-66)', () => {
  const second: HomeData = {
    ...university,
    name: 'Sipho',
    universityYear: { group: 'middle', yearOfStudy: 2, draft: false },
    registration: null,
    firstWeek: { done: 8, total: 8 },
    modules: { confirmed: 6, toFix: 0, checked: false },
    next: { id: 'plan', href: '/goals' },
  };
  const final: HomeData = {
    ...second,
    name: 'Kagiso',
    universityYear: { group: 'final', yearOfStudy: 3, draft: true },
  };

  it('a second year (like Sipho): his year and his modules, never an arrival’s cards', () => {
    render(<Dashboard data={second} />);
    expect(screen.getByText(t.subtitleYears.middle)).toBeTruthy();
    expect(screen.queryByText(t.subtitle.university)).toBeNull();
    for (const arrival of [t.registration.title, t.gettingReady.title, t.offers.title]) {
      expect(screen.queryByRole('region', { name: arrival })).toBeNull();
    }
    expect(screen.queryByText(t.promo.campusLead)).toBeNull();
    const year = screen.getByRole('region', { name: t.year.title });
    expect(within(year).getByTestId('home-number').textContent).toBe('2');
    expect(within(year).queryByText(t.year.final)).toBeNull();
    const thisYear = screen.getByRole('region', { name: t.thisYear.title });
    expect(within(thisYear).getByTestId('home-modules').textContent).toBe('6');
    expect(within(thisYear).getByTestId('home-modules').getAttribute('href')).toBe('/modules');
    expect(screen.getByRole('link', { name: t.promo.planAction }).getAttribute('href')).toBe(
      '/goals',
    );
    expect(screen.queryByRole('region', { name: t.chart.title })).toBeNull();
  });

  it('a second year’s journey is the modules, setting up the semester (Phase 6c), then the plan, in equal columns', () => {
    render(<Dashboard data={second} />);
    const journey = within(screen.getByRole('region', { name: t.journey.label }));
    expect(journey.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      `1${t.journey.steps.modules}${t.journey.status.done}`,
      `2${moduleCard.journeyStep}${t.journey.status.current}`,
      `3${t.journey.steps.plan}${t.journey.status.todo}`,
    ]);
    expect(journey.getByRole('list').className).toContain('md:grid-cols-3');
    expect(
      journey.getByRole('link', { name: new RegExp(moduleCard.journeyStep) }).getAttribute('href'),
    ).toBe('/modules');
    const next = within(screen.getByRole('region', { name: t.next.label })).getByRole('link');
    expect(next.getAttribute('href')).toBe('/goals');
    expect(next.textContent).toContain(t.next.plan);
  });

  it('a second year with no modules confirmed yet: the modules card asks for them', () => {
    render(
      <Dashboard data={{ ...second, modules: null, next: { id: 'modules', href: '/modules' } }} />,
    );
    const thisYear = screen.getByRole('region', { name: t.thisYear.title });
    expect(within(thisYear).getByText(t.gettingReady.modulesNone)).toBeTruthy();
    expect(
      within(thisYear)
        .getByRole('link', { name: t.gettingReady.modulesAction })
        .getAttribute('href'),
    ).toBe('/modules');
  });

  it('a final year (like Kagiso): says so, and labels a course record not yet verified', () => {
    render(<Dashboard data={final} />);
    expect(screen.getByText(t.subtitleYears.final)).toBeTruthy();
    const year = screen.getByRole('region', { name: t.year.title });
    expect(within(year).getByTestId('home-number').textContent).toBe('3');
    expect(within(year).getByText(t.year.final)).toBeTruthy();
    expect(within(year).getByText(en.common.draftBadge)).toBeTruthy();
    cleanup();
    render(
      <Dashboard
        data={{ ...final, universityYear: { group: 'final', yearOfStudy: 3, draft: false } }}
      />,
    );
    expect(
      within(screen.getByRole('region', { name: t.year.title })).queryByText(en.common.draftBadge),
    ).toBeNull();
  });
});

describe('the home in the shared look (docs/design/README.md, "One rhythm")', () => {
  // A2-21: `[&_a]:text-accent` on the headline card painted its empty state's outline button pink.
  it('keeps the headline card’s outline button calm: ink, never the accent (A2-21)', () => {
    render(<Dashboard data={empty} />);
    const card = screen.getByRole('region', { name: t.qualify.title });
    const add = within(card).getByRole('link', { name: t.qualify.add });
    expect(add.className).toContain('text-ink');
    for (let el: HTMLElement | null = add; el; el = el.parentElement) {
      expect(el.className).not.toContain('[&_a]:text-accent');
    }
    // "Not yet" is one muted sentence, as on every other empty card.
    expect(within(card).getByText(t.qualify.none).className).toContain('text-muted');
  });

  it('gives the accent to the headline card’s text link only (A2-21)', () => {
    render(<Dashboard data={matric} />);
    const card = screen.getByRole('region', { name: t.qualify.title });
    expect(within(card).getByRole('link', { name: t.qualify.open }).className).toContain(
      'text-accent',
    );
  });

  // A2-23: the home re-spelled Card and PageHeader: 16px padding, `text-xl` titles, a 4px gap.
  it('titles the home with PageHeader: the 8px gap under the title every page has (A2-23)', () => {
    render(<Dashboard data={matric} />);
    const header = screen.getByRole('heading', { level: 1 }).closest('header');
    expect(header?.className).toContain('flex flex-col gap-2');
    expect(header?.querySelector('p')?.textContent).toBe(t.subtitle.matric);
  });

  it.each([
    ['before university', matric],
    ['with nothing yet', empty],
    ['at university', university],
  ])(
    'builds every titled card on Card: its padding, and one card-title size (%s, A2-23)',
    (_, data) => {
      render(<Dashboard data={data} />);
      const cards = [...document.querySelectorAll<HTMLElement>('section[aria-labelledby]')].filter(
        (section) => {
          const title = document.getElementById(section.getAttribute('aria-labelledby') ?? '');
          return title && !title.className.includes('sr-only') && !title.closest('[role="note"]');
        },
      );
      expect(cards.length).toBeGreaterThanOrEqual(4);
      for (const card of cards) {
        expect(card.className).toMatch(/(^|\s)rounded-lg border border-line(\s|$)/);
        expect(card.className).toMatch(/(^|\s)p-5(\s|$)/);
        const title = document.getElementById(card.getAttribute('aria-labelledby') ?? '');
        // A headline card's title is a caps label; every other card title is the one size.
        if (!title?.className.includes('uf-caps')) expect(title?.className).toContain('text-lg');
        expect(title?.className).not.toContain('text-xl');
      }
    },
  );

  it('puts the marks chart’s lead 8px under its title, as PageHeader does (A2-23)', () => {
    render(<Dashboard data={matric} />);
    const chart = screen.getByRole('region', { name: t.chart.title });
    expect(within(chart).getByText(t.chart.lead).className).not.toContain('mt-1');
    expect(within(chart).getByText(t.chart.lead).parentElement?.className).toContain('gap-2');
  });
});
