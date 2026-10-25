import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { en } from '@universityflow/content/app';
import type { HomeData } from '@universityflow/ui';
import { useRouter } from 'expo-router';
import { AccessibilityInfo } from 'react-native';
import HomeScreen from '../app/index';
import { HomeDashboard } from '../components/home';
import { AuthProvider } from '../lib/auth';
import { formatDate } from '../lib/format';
import { nativeRoute } from '../lib/routes';
import { saveToken } from '../lib/session';
import { theme } from '../lib/theme';
import { serve } from '../test-utils/fake-api';
import { home, me } from '../test-utils/fixtures';

/**
 * The app's home (docs/design/README.md §4): the web's dashboard on a phone, from the same
 * `HomeData` and the same shared rules. Every link opens the app's own screen; a step the app
 * has no screen for says to use the web instead of linking nowhere. Synthetic data only.
 */

const t = en.dashboard;

const matric: HomeData = home({
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
  marks: [
    { kind: 'grade-11-final', average: 60, marks: [] },
    { kind: 'grade-12-june', average: 72, marks: [] },
  ],
  next: { id: 'checklist', href: '/applications/uj', universityName: 'UJ' },
});

const university: HomeData = home({
  stage: 'university',
  name: 'Kagiso',
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
  next: { id: 'first-week', href: '/first-week' },
});

async function show(data: HomeData) {
  const go = jest.fn();
  const screen = await render(<HomeDashboard data={data} go={go} />);
  return { screen, go };
}

describe('the home, before university', () => {
  it('welcomes a learner with no name, names the stage, and opens the chat from the ask bar', async () => {
    const { screen, go } = await show(home());
    expect(screen.getByRole('header', { name: t.welcome('') })).toBeTruthy();
    expect(screen.getByText(t.subtitle['grade-11'])).toBeTruthy();
    await fireEvent.press(screen.getByRole('link', { name: t.ask }));
    expect(go).toHaveBeenCalledWith('/chat');
  });

  it('on Grade 10 marks counts the courses on track, never "qualify", and no Plan B (G10-3)', async () => {
    const { screen } = await show({
      ...matric,
      qualify: { basis: 'progress', now: 0, onTrack: 15, close: 4, planB: 0, checked: 86 },
    });
    expect(screen.getByText(t.qualify.titleGrade10)).toBeTruthy();
    expect(screen.queryByText(t.qualify.title)).toBeNull();
    expect(screen.getByTestId('home-number')).toHaveTextContent('15');
    expect(screen.getByText(t.qualify.close(4))).toBeTruthy();
  });

  const gradeCheck = (saveGrade: (grade: number) => Promise<void>) =>
    render(
      <HomeDashboard
        data={home({ gradeCheck: { grade: 11 } })}
        go={jest.fn()}
        saveGrade={saveGrade}
      />,
    );

  it('each January asks "Are you in Grade N now?", and yes records it (G10-1)', async () => {
    const saveGrade = jest.fn(async () => undefined);
    const screen = await gradeCheck(saveGrade);
    expect(screen.getByRole('header', { name: t.gradeCheck.title(11) })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: t.gradeCheck.yes(11) }));
    expect(saveGrade).toHaveBeenCalledWith(11);
  });

  it('no lets the learner pick their grade on the card itself (G10-1)', async () => {
    const saveGrade = jest.fn(async () => undefined);
    const screen = await gradeCheck(saveGrade);
    await fireEvent.press(screen.getByRole('button', { name: t.gradeCheck.change }));
    await fireEvent.press(screen.getByRole('radio', { name: en.onboarding.gradeOption(10) }));
    await fireEvent.press(screen.getByRole('button', { name: en.common.save }));
    expect(saveGrade).toHaveBeenCalledWith(10);
  });

  it('with a report but no course to check, says it can’t check yet, never "0" (A1-41)', async () => {
    const { screen } = await show(
      home({
        stage: 'matric',
        qualify: { basis: 'admission', now: 0, onTrack: 0, close: 0, planB: 0, checked: 0 },
      }),
    );
    expect(screen.getByText(en.subjects.card.unknown)).toBeTruthy();
    expect(screen.queryByTestId('home-number')).toBeNull();
  });

  it('in the 30 days before the 18th birthday, names the day and what changes (A11-25)', async () => {
    const { screen } = await show(home({ turningEighteen: { on: '2026-11-08' } }));
    const card = screen.getByTestId('home-turning-eighteen');
    expect(
      within(card).getByRole('header', { name: t.turningEighteen.title(formatDate('2026-11-08')) }),
    ).toBeTruthy();
    expect(within(card).getByText(t.turningEighteen.lead)).toBeTruthy();
    const none = await show(home());
    expect(none.screen.queryByTestId('home-turning-eighteen')).toBeNull();
  });

  it('says what changed: the grade choices on No, and "Saved" after a save (A3-30)', async () => {
    const said = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const saveGrade = jest.fn(async () => undefined);
    const screen = await gradeCheck(saveGrade);
    await fireEvent.press(screen.getByRole('button', { name: t.gradeCheck.change }));
    expect(said).toHaveBeenCalledWith(en.onboarding.grade);
    await fireEvent.press(screen.getByRole('button', { name: en.common.save }));
    await waitFor(() => expect(said).toHaveBeenCalledWith(en.common.saved));
    said.mockRestore();
  });

  it('asks nothing about the grade the rest of the year', async () => {
    const { screen } = await show(home());
    expect(screen.queryByTestId('home-grade-check')).toBeNull();
  });

  it('welcomes a learner by the name they gave', async () => {
    const { screen } = await show(matric);
    expect(screen.getByRole('header', { name: 'Welcome, Lerato' })).toBeTruthy();
  });

  it('makes the next step one link to the app’s own screen (a report: Upload)', async () => {
    const { screen, go } = await show(home());
    const next = screen.getByRole('link', { name: `${t.next.label}: ${t.next['add-report']}` });
    await fireEvent.press(next);
    expect(go).toHaveBeenCalledWith('/upload');
  });

  it('names each journey step the same whatever its state, links only the current one', async () => {
    const { screen, go } = await show(home());
    const journey = within(screen.getByTestId('home-journey'));
    const first = journey.getByRole('link', {
      name: `1. Report, ${t.journey.status.current}`,
    });
    expect(journey.getAllByRole('link')).toHaveLength(1);
    await fireEvent.press(first);
    expect(go).toHaveBeenCalledWith('/upload');
    expect(
      screen.getByLabelText(`2. ${t.journey.steps.shortlist}, ${t.journey.status.todo}`),
    ).toBeTruthy();
    // The same box for every step; only the current one has the mauve edge.
    expect(screen.getByTestId('home-step-box-report')).toHaveStyle({
      borderColor: theme.color.brand,
    });
    for (const id of ['shortlist', 'goal', 'applications', 'funding']) {
      expect(screen.getByTestId(`home-step-box-${id}`)).toHaveStyle({
        borderColor: theme.color.line,
      });
    }
  });

  it('says to use the web for a step the app has no screen for, never a dead link', async () => {
    const { screen } = await show(matric);
    // The next step is UJ's application checklist: the app has no applications screen.
    expect(screen.queryByRole('link', { name: new RegExp(t.next.checklist('UJ')) })).toBeNull();
    const next = within(screen.getByTestId('home-next'));
    expect(next.getByText(t.next.checklist('UJ'))).toBeTruthy();
    expect(next.getByText(en.chat.artifactOnWeb)).toBeTruthy();
    // Its journey step (Applications, Now) is shown, not linked.
    const journey = within(screen.getByTestId('home-journey'));
    expect(journey.queryAllByRole('link')).toHaveLength(0);
    expect(
      journey.getByLabelText(`4. ${t.journey.steps.applications}, ${t.journey.status.current}`),
    ).toBeTruthy();
    expect(journey.getByLabelText(`1. Report, ${t.journey.status.done}`)).toBeTruthy();
  });

  it('shows the headline number, the next paper and the shortlist only when something is behind them', async () => {
    const empty = await show(home());
    expect(empty.screen.queryByTestId('home-number')).toBeNull();
    expect(empty.screen.queryByTestId('home-next-paper')).toBeNull();
    expect(empty.screen.getByText(t.qualify.none)).toBeTruthy();
    expect(empty.screen.getByText(t.shortlist.empty)).toBeTruthy();
    expect(empty.screen.getByText(t.chart.none)).toBeTruthy();

    const { screen } = await show(matric);
    expect(screen.getByTestId('home-number')).toHaveTextContent('12');
    expect(screen.getByTestId('home-next-paper')).toHaveTextContent(t.nextPaper(9));
    const shortlist = within(screen.getByTestId('home-shortlist'));
    expect(shortlist.getByText('Sample engineering course')).toBeTruthy();
    expect(shortlist.getByText(en.results.groups.close)).toBeTruthy();
    expect(shortlist.getByText(en.common.draftBadge)).toBeTruthy();
    const applications = within(screen.getByTestId('home-applications'));
    expect(applications.getByText(t.applications.checklist(2, 8))).toBeTruthy();
  });

  it('opens What do I need for the goal, in the app', async () => {
    const { screen, go } = await show(matric);
    await fireEvent.press(screen.getByRole('button', { name: t.promo.goalAction }));
    expect(go).toHaveBeenCalledWith('/what-i-need/uj-beng-civil');
  });

  it('lists the marks over time, each report read out with its average', async () => {
    const { screen } = await show(matric);
    const marks = within(screen.getByTestId('home-marks'));
    expect(marks.getByLabelText(t.chart.point(t.chart.short['grade-11-final'], 60))).toBeTruthy();
    expect(marks.getByLabelText(t.chart.point(t.chart.short['grade-12-june'], 72))).toBeTruthy();
  });

  it('says one report so far in a sentence, never a one-point chart', async () => {
    const { screen } = await show(
      home({ marks: [{ kind: 'grade-11-final', average: 64, marks: [] }] }),
    );
    expect(screen.getByText(t.chart.one(t.chart.short['grade-11-final'], 64))).toBeTruthy();
  });
});

describe('the home at university', () => {
  it('counts down to registration, lists the offers and links the first week', async () => {
    const { screen, go } = await show(university);
    expect(screen.getByText(t.subtitle.university)).toBeTruthy();
    expect(screen.getByTestId('home-number')).toHaveTextContent('103');
    expect(
      within(screen.getByTestId('home-offers')).getByText(en.offers.statuses.accepted),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('link', {
        name: `${t.gettingReady.firstWeek}: ${t.gettingReady.firstWeekValue(3, 8)}`,
      }),
    );
    expect(go).toHaveBeenCalledWith('/first-week');
    const journey = within(screen.getByTestId('home-journey'));
    expect(journey.getByLabelText(`1. Offer, ${t.journey.status.done}`)).toBeTruthy();
    expect(journey.getByLabelText(`3. Modules, ${t.journey.status.todo}`)).toBeTruthy();
  });

  // A2-66: no "My marks over time… once you've confirmed a school report" at university.
  it('shows no school-marks card without a school report (A2-66)', async () => {
    const { screen } = await show(university);
    expect(screen.queryByTestId('home-marks')).toBeNull();
    expect(screen.queryByText(t.chart.none)).toBeNull();
  });
});

// A2-66 (DEMO-walk): a second- or final-year student got an arriving student's home.
describe('the home in a second or final year (A2-66)', () => {
  const second: HomeData = home({
    ...university,
    name: 'Sipho',
    universityYear: { group: 'middle', yearOfStudy: 2, draft: false },
    registration: null,
    firstWeek: { done: 8, total: 8 },
    modules: { confirmed: 6, toFix: 0, checked: false },
    next: { id: 'plan', href: '/goals' },
  });

  it('a second year (like Sipho): his year, his modules and his plan, never an arrival’s cards', async () => {
    const { screen, go } = await show(second);
    expect(screen.getByText(t.subtitleYears.middle)).toBeTruthy();
    expect(screen.queryByText(t.subtitle.university)).toBeNull();
    expect(screen.queryByText(t.registration.title)).toBeNull();
    expect(screen.queryByTestId('home-offers')).toBeNull();
    expect(screen.queryByTestId('home-ready')).toBeNull();
    expect(screen.queryByText(t.promo.campusLead)).toBeNull();
    expect(screen.getByText(t.year.title)).toBeTruthy();
    expect(screen.getByTestId('home-number')).toHaveTextContent('2');
    expect(screen.queryByText(t.year.final)).toBeNull();
    const thisYear = within(screen.getByTestId('home-this-year'));
    await fireEvent.press(thisYear.getByRole('link', { name: `${t.gettingReady.modules}: 6` }));
    expect(go).toHaveBeenCalledWith('/modules');
    await fireEvent.press(screen.getByRole('button', { name: t.promo.planAction }));
    expect(go).toHaveBeenCalledWith('/goals');
    const journey = within(screen.getByTestId('home-journey'));
    expect(
      journey.getByLabelText(`1. ${t.journey.steps.modules}, ${t.journey.status.done}`),
    ).toBeTruthy();
    // Phase 6c: setting up the semester follows the confirmed modules, then the plan.
    expect(
      journey.getByLabelText(`2. ${en.moduleCard.journeyStep}, ${t.journey.status.current}`),
    ).toBeTruthy();
    expect(
      journey.getByLabelText(`3. ${t.journey.steps.plan}, ${t.journey.status.todo}`),
    ).toBeTruthy();
    expect(screen.getByText(t.next.plan)).toBeTruthy();
  });

  it('a final year (like Kagiso): says so, and labels a course record not yet verified', async () => {
    const { screen } = await show(
      home({ ...second, universityYear: { group: 'final', yearOfStudy: 3, draft: true } }),
    );
    expect(screen.getByText(t.subtitleYears.final)).toBeTruthy();
    expect(screen.getByTestId('home-number')).toHaveTextContent('3');
    expect(screen.getByText(t.year.final)).toBeTruthy();
    expect(screen.getByText(en.common.draftBadge)).toBeTruthy();
  });
});

describe('the home in Grade 10 (Stage 0, G10-4)', () => {
  const grade10: HomeData = home({
    stage: 'grade-10',
    qualify: { basis: 'progress', now: 0, onTrack: 15, close: 4, planB: 0, checked: 86 },
    subjects: { status: 'some-closed', checked: 80, closed: 31, draft: true },
    next: { id: 'study', href: '/goals#practice' },
  });

  it('names the stage and walks report, subjects, goal, study', async () => {
    const { screen } = await show(grade10);
    expect(screen.getByText(t.subtitle['grade-10'])).toBeTruthy();
    const journey = within(screen.getByTestId('home-journey'));
    expect(
      journey.getByLabelText(`2. ${t.journey.steps.subjects}, ${t.journey.status.done}`),
    ).toBeTruthy();
    expect(
      journey.getByLabelText(`4. ${t.journey.steps.study}, ${t.journey.status.todo}`),
    ).toBeTruthy();
  });

  it('shows the subjects card in place of the applications, opening My subjects', async () => {
    const { screen, go } = await show(grade10);
    expect(screen.queryByTestId('home-applications')).toBeNull();
    expect(screen.getByTestId('home-subjects')).toHaveTextContent(en.subjects.card.closed(31));
    expect(screen.getByText(en.common.draftBadge)).toBeTruthy();
    await fireEvent.press(screen.getByRole('link', { name: en.subjects.card.action }));
    expect(go).toHaveBeenCalledWith('/subjects');
  });

  it('never claims every door is open when nothing could be checked', async () => {
    const { screen } = await show({
      ...grade10,
      subjects: { status: 'unknown', checked: 0, closed: 0, draft: false },
    });
    expect(screen.getByText(en.subjects.card.unknown)).toBeTruthy();
    expect(screen.queryByText(en.subjects.card.open)).toBeNull();
  });

  it('before a report the headline card already speaks of Grade 10: on track, never "qualify" (G10-5)', async () => {
    const { screen } = await show({ ...grade10, qualify: null, subjects: null });
    expect(screen.getByText(t.qualify.titleGrade10)).toBeTruthy();
    expect(screen.queryByText(t.qualify.title)).toBeNull();
  });

  it('the next step to study opens My goal, where the practice is', async () => {
    const { screen, go } = await show(grade10);
    await fireEvent.press(
      within(screen.getByTestId('home-next')).getByRole('link', {
        name: `${t.next.label}: ${t.next.study}`,
      }),
    );
    expect(go).toHaveBeenCalledWith('/goals');
  });
});

describe('every section, grouped by stage', () => {
  it('lists the app’s screens under the web’s group names', async () => {
    const { screen, go } = await show(home());
    const sections = within(screen.getByTestId('home-sections'));
    for (const name of [en.nav.groups.before, en.nav.groups.university, en.nav.groups.you]) {
      expect(sections.getByText(name)).toBeTruthy();
    }
    await fireEvent.press(sections.getByRole('link', { name: en.nav.campus }));
    expect(go).toHaveBeenCalledWith('/campus');
    await fireEvent.press(sections.getByRole('link', { name: en.nav.me }));
    expect(go).toHaveBeenCalledWith('/account');
  });
});

describe('nativeRoute', () => {
  it('maps the web’s pages to the app’s screens, and nothing it has no screen for', () => {
    expect(nativeRoute('/documents')).toBe('/upload');
    expect(nativeRoute('/me')).toBe('/account');
    expect(nativeRoute('/first-week')).toBe('/first-week');
    expect(nativeRoute('/results/what-i-need/uj-bsc')).toBe('/what-i-need/uj-bsc');
    expect(nativeRoute('/applications')).toBeNull();
    expect(nativeRoute('/applications/uj')).toBeNull();
    expect(nativeRoute('/funding')).toBeNull();
    // G10-4: My subjects, and a page's section opens its screen.
    expect(nativeRoute('/subjects')).toBe('/subjects');
    expect(nativeRoute('/goals#practice')).toBe('/goals');
  });
});

describe('the home screen', () => {
  beforeEach(async () => {
    await saveToken('tok');
    (useRouter().push as jest.Mock).mockClear();
  });

  it('loads the home once the learner is ready, and opens a screen with the router', async () => {
    const calls = serve({
      'GET /api/me': { json: me({ consentStatus: 'not-required' }, true) },
      'GET /api/home': { json: home() },
    });
    const screen = await render(
      <AuthProvider>
        <HomeScreen />
      </AuthProvider>,
    );
    await fireEvent.press(await screen.findByRole('link', { name: t.ask }));
    expect(useRouter().push).toHaveBeenCalledWith('/chat');
    expect(calls.map((c) => c.key)).toContain('GET /api/home');
  });

  it('never asks for the home before the learner is ready (hard rule 5)', async () => {
    const calls = serve({ 'GET /api/me': { json: me({}, false) } });
    const screen = await render(
      <AuthProvider>
        <HomeScreen />
      </AuthProvider>,
    );
    await screen.findByText(en.onboarding.dobTitle);
    expect(calls.map((c) => c.key)).not.toContain('GET /api/home');
  });

  /** The learner comes back to home (expo-router's mock in jest.setup.ts). */
  const focusAgain = () =>
    act(async () => {
      (jest.requireMock('expo-router') as { __focusAgain: () => void }).__focusAgain();
    });

  it('a ready learner coming back to home costs one request, and the dashboard stays on screen meanwhile (A4-17)', async () => {
    let name: string | null = null;
    const calls = serve({
      'GET /api/me': { json: me({ consentStatus: 'not-required' }, true) },
      'GET /api/home': () => ({ json: home({ name }) }),
    });
    const screen = await render(
      <AuthProvider>
        <HomeScreen />
      </AuthProvider>,
    );
    await screen.findByRole('header', { name: t.welcome('') });
    const before = calls.length;
    name = 'Lerato';
    await focusAgain();
    // Never back to "Loading…": the last data stays while the fresh one comes.
    expect(screen.queryByText(en.common.loading)).toBeNull();
    expect(await screen.findByRole('header', { name: 'Welcome, Lerato' })).toBeTruthy();
    expect(calls.slice(before).map((c) => c.key)).toEqual(['GET /api/home']);
  });

  it('coming back after consent was withdrawn elsewhere, asks who the learner is again (hard rule 5)', async () => {
    let ready = true;
    serve({
      'GET /api/me': () => ({
        json: me({ consentStatus: ready ? 'not-required' : 'withdrawn' }, ready),
      }),
      'GET /api/home': () =>
        ready ? { json: home() } : { status: 403, json: { error: 'consent', detail: null } },
    });
    const screen = await render(
      <AuthProvider>
        <HomeScreen />
      </AuthProvider>,
    );
    await screen.findByRole('header', { name: t.welcome('') });
    ready = false;
    await focusAgain();
    await waitFor(() => expect(screen.queryByTestId('home')).toBeNull());
    expect(screen.queryByRole('header', { name: t.welcome('') })).toBeNull();
  });

  it('says so, with Try again, when the home can’t load', async () => {
    serve({
      'GET /api/me': { json: me({ consentStatus: 'not-required' }, true) },
      'GET /api/home': { status: 500, json: { error: 'server', detail: null } },
    });
    const screen = await render(
      <AuthProvider>
        <HomeScreen />
      </AuthProvider>,
    );
    expect(await screen.findByRole('button', { name: en.common.tryAgain })).toBeTruthy();
  });
});
