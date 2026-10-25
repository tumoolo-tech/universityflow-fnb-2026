import { REPORT_KINDS } from '@universityflow/catalogue/client';
import { dashboard, moduleCard, reportKinds } from '@universityflow/content';
import { describe, expect, it } from 'vitest';
import {
  chartKinds,
  chatWelcome,
  daysBetween,
  type JourneyStep,
  journeyStepName,
  journeySteps,
  type LearnerStage,
  learnerStage,
  marksOverTime,
  type NextActionInput,
  nextAction,
  type ReportKind,
  registrationCountdown,
  type UniversityYear,
  universityYear,
} from './home';

/**
 * The signed-in home's rules (docs/design/README.md): which stage a learner is at, the marks
 * chart's points, the registration countdown and the next step. Pure code: the page only shows
 * what these decide, and a number with nothing behind it is left out, never shown as 0.
 */

describe('learnerStage', () => {
  it('is university once an offer is accepted, whatever the grade', () => {
    expect(learnerStage({ grade: 12, offers: [{ status: 'accepted' }], registered: false })).toBe(
      'university',
    );
    expect(learnerStage({ grade: 11, offers: [{ status: 'accepted' }], registered: false })).toBe(
      'university',
    );
    expect(learnerStage({ grade: null, offers: [{ status: 'accepted' }], registered: false })).toBe(
      'university',
    );
  });

  it('is university once a registration is confirmed, even with no accepted offer', () => {
    expect(learnerStage({ grade: 12, offers: [], registered: true })).toBe('university');
  });

  it('is matric in Grade 12 while no offer is accepted (a held or declined one is not a place)', () => {
    expect(learnerStage({ grade: 12, offers: [], registered: false })).toBe('matric');
    expect(
      learnerStage({
        grade: 12,
        offers: [{ status: 'held' }, { status: 'declined' }],
        registered: false,
      }),
    ).toBe('matric');
  });

  it('is grade-11 for Grade 11, or a grade not given', () => {
    expect(learnerStage({ grade: 11, offers: [], registered: false })).toBe('grade-11');
    expect(learnerStage({ grade: null, offers: [{ status: 'held' }], registered: false })).toBe(
      'grade-11',
    );
  });

  it('is grade-10 (Stage 0) in Grade 10 or 9; an accepted offer still means university (G10-4)', () => {
    expect(learnerStage({ grade: 10, offers: [], registered: false })).toBe('grade-10');
    expect(learnerStage({ grade: 9, offers: [], registered: false })).toBe('grade-10');
    expect(learnerStage({ grade: 10, offers: [{ status: 'accepted' }], registered: false })).toBe(
      'university',
    );
  });

  it('names every stage in the words (subtitle and stage)', () => {
    const stages = ['grade-10', 'grade-11', 'matric', 'university'];
    expect(Object.keys(dashboard.subtitle).sort()).toEqual([...stages].sort());
    expect(Object.keys(dashboard.stage).sort()).toEqual([...stages].sort());
  });
});

const report = (kind: ReportKind, at: string, marks: Array<[string, number]>) => ({
  kind,
  confirmedAt: new Date(at),
  marks: marks.map(([subject, percent]) => ({ subject, percent })),
});

describe('marksOverTime', () => {
  it('is empty with no confirmed report', () => {
    expect(marksOverTime([])).toEqual([]);
  });

  it('gives each report its average, rounded, in the order the school year runs', () => {
    const points = marksOverTime([
      report('grade-12-june', '2027-07-01', [
        ['mathematics', 71],
        ['english-fal', 72],
      ]),
      report('grade-11-final', '2026-12-10', [
        ['mathematics', 58],
        ['english-fal', 63],
      ]),
    ]);
    expect(points.map((p) => [p.kind, p.average])).toEqual([
      ['grade-11-final', 61],
      ['grade-12-june', 72],
    ]);
    expect(points[0]?.marks).toEqual([
      { subject: 'english-fal', percent: 63 },
      { subject: 'mathematics', percent: 58 },
    ]);
  });

  it('keeps only the newest report of a kind: a second one is a correction', () => {
    const points = marksOverTime([
      report('grade-11-final', '2026-12-10', [['mathematics', 50]]),
      report('grade-11-final', '2026-12-12', [['mathematics', 60]]),
    ]);
    expect(points).toHaveLength(1);
    expect(points[0]?.average).toBe(60);
  });

  it('leaves out a report with no marks rather than plot it at 0', () => {
    expect(marksOverTime([report('grade-12-june', '2027-07-01', [])])).toEqual([]);
  });

  it('names every report kind, in the catalogue’s order (G10-2)', () => {
    expect(Object.keys(reportKinds)).toEqual([...REPORT_KINDS]);
    expect(Object.keys(dashboard.chart.short)).toEqual([...REPORT_KINDS]);
  });

  it('puts a Grade 10 report first, and the chart starts at Grade 10 only when there is one (G10-2)', () => {
    const g11 = report('grade-11-final', '2026-12-10', [['mathematics', 60]]);
    const g10 = report('grade-10-final', '2026-12-12', [['mathematics', 52]]);
    const withG10 = marksOverTime([g11, g10]);
    expect(withG10.map((p) => p.kind)).toEqual(['grade-10-final', 'grade-11-final']);
    expect(chartKinds(withG10)[0]).toBe('grade-10-final');
    expect(chartKinds(withG10)).toHaveLength(5);
    const without = marksOverTime([g11]);
    expect(chartKinds(without)).toEqual([
      'grade-11-final',
      'grade-12-june',
      'grade-12-september',
      'grade-12-final',
    ]);
  });

  it('shows a June or September report below Grade 12 only when the learner confirmed one (§18.7 C2)', () => {
    const g11 = report('grade-11-final', '2026-12-10', [['mathematics', 60]]);
    const june = report('grade-11-june', '2026-07-01', [['mathematics', 55]]);
    const g10june = report('grade-10-june', '2025-07-01', [['mathematics', 48]]);
    const points = marksOverTime([g11, june, g10june]);
    expect(points.map((p) => p.kind)).toEqual(['grade-10-june', 'grade-11-june', 'grade-11-final']);
    expect(chartKinds(points)).toEqual([
      'grade-10-june',
      'grade-10-final',
      'grade-11-june',
      'grade-11-final',
      'grade-12-june',
      'grade-12-september',
      'grade-12-final',
    ]);
  });
});

describe('daysBetween', () => {
  it('counts South African calendar days', () => {
    expect(daysBetween('2027-01-10', '2027-01-10')).toBe(0);
    expect(daysBetween('2027-01-10', '2027-02-01')).toBe(22);
    expect(daysBetween('2027-02-01', '2027-01-10')).toBe(-22);
  });
});

describe('registrationCountdown', () => {
  const calendar = (from: string | null, to: string) => ({ registration: { from, to } });

  it('counts to the day registration opens while it is ahead', () => {
    expect(registrationCountdown(calendar('2027-01-20', '2027-02-05'), '2027-01-10')).toEqual({
      days: 10,
      phase: 'opens',
    });
  });

  it('counts to the closing day once open, or when only the closing day is published', () => {
    expect(registrationCountdown(calendar('2027-01-20', '2027-02-05'), '2027-01-25')).toEqual({
      days: 11,
      phase: 'closes',
    });
    expect(registrationCountdown(calendar(null, '2027-02-05'), '2027-01-10')).toEqual({
      days: 26,
      phase: 'closes',
    });
    expect(registrationCountdown(calendar(null, '2027-02-05'), '2027-02-05')).toEqual({
      days: 0,
      phase: 'closes',
    });
  });

  it('is null with no published calendar, or once registration has closed', () => {
    expect(registrationCountdown(null, '2027-01-10')).toBeNull();
    expect(registrationCountdown(calendar('2027-01-20', '2027-02-05'), '2027-02-06')).toBeNull();
  });
});

const before: NextActionInput = {
  stage: 'grade-11',
  universityYear: null,
  today: '2026-10-24',
  hasReport: true,
  shortlisted: 2,
  hasGoal: true,
  applications: [
    { universityId: 'uj', universityName: 'UJ', done: 8, total: 8, closesOn: '2026-10-31' },
  ],
  firstWeek: null,
  modules: null,
};

describe('nextAction', () => {
  it('asks for a report first: nothing else can be worked out without marks', () => {
    expect(nextAction({ ...before, hasReport: false, shortlisted: 0 })).toEqual({
      id: 'add-report',
      href: '/documents',
    });
  });

  it('then a shortlist, then a goal', () => {
    expect(nextAction({ ...before, shortlisted: 0, applications: [] })).toEqual({
      id: 'shortlist',
      href: '/results',
    });
    expect(nextAction({ ...before, hasGoal: false })).toEqual({ id: 'goal', href: '/goals' });
  });

  it('then the first application with checklist items left', () => {
    expect(
      nextAction({
        ...before,
        applications: [
          { universityId: 'uj', universityName: 'UJ', done: 8, total: 8, closesOn: null },
          { universityId: 'wits', universityName: 'Wits', done: 2, total: 8, closesOn: null },
        ],
      }),
    ).toEqual({ id: 'checklist', href: '/applications/wits', universityName: 'Wits' });
  });

  // A2-69 (DEMO-walk): the next step sent a learner to finish an application whose window had
  // closed (Wits, 30 September, on a judging day in October).
  it('skips an unfinished application whose window has closed (A2-69)', () => {
    const wits = { universityId: 'wits', universityName: 'Wits', done: 5, total: 8 };
    const uj = { universityId: 'uj', universityName: 'UJ', done: 2, total: 8 };
    expect(
      nextAction({
        ...before,
        applications: [
          { ...wits, closesOn: '2026-09-30' },
          { ...uj, closesOn: '2026-10-31' },
        ],
      }),
    ).toEqual({ id: 'checklist', href: '/applications/uj', universityName: 'UJ' });
    // Every unfinished one closed: nothing to finish, so the chat.
    expect(nextAction({ ...before, applications: [{ ...wits, closesOn: '2026-09-30' }] })).toEqual({
      id: 'chat',
      href: '/chat',
    });
    // Closing today is still open; no published closing date is never treated as closed.
    expect(nextAction({ ...before, applications: [{ ...wits, closesOn: '2026-10-24' }] })).toEqual({
      id: 'checklist',
      href: '/applications/wits',
      universityName: 'Wits',
    });
    expect(nextAction({ ...before, applications: [{ ...wits, closesOn: null }] })).toEqual({
      id: 'checklist',
      href: '/applications/wits',
      universityName: 'Wits',
    });
  });

  it('with everything done before university, it points to the chat', () => {
    expect(nextAction(before)).toEqual({ id: 'chat', href: '/chat' });
    expect(nextAction({ ...before, stage: 'matric' })).toEqual({ id: 'chat', href: '/chat' });
  });

  const university: NextActionInput = {
    ...before,
    stage: 'university',
    universityYear: 'arriving',
    firstWeek: { done: 8, total: 8 },
    modules: { confirmed: 6, toFix: 0 },
  };

  it('at university: first-week steps, then confirming the modules, then fixing them', () => {
    expect(nextAction({ ...university, firstWeek: { done: 3, total: 8 } })).toEqual({
      id: 'first-week',
      href: '/first-week',
    });
    expect(nextAction({ ...university, modules: null })).toEqual({
      id: 'modules',
      href: '/modules',
    });
    expect(nextAction({ ...university, modules: { confirmed: 6, toFix: 2 } })).toEqual({
      id: 'fix-modules',
      href: '/modules',
    });
  });

  it('in Grade 10: a report, then a goal, then study; never a shortlist or an application (G10-4)', () => {
    const g10: NextActionInput = { ...before, stage: 'grade-10', shortlisted: 0, applications: [] };
    expect(nextAction({ ...g10, hasReport: false })).toEqual({
      id: 'add-report',
      href: '/documents',
    });
    expect(nextAction({ ...g10, hasGoal: false })).toEqual({ id: 'goal', href: '/goals' });
    expect(nextAction(g10)).toEqual({ id: 'study', href: '/goals#practice' });
    expect(
      nextAction({
        ...g10,
        applications: [
          { universityId: 'wits', universityName: 'Wits', done: 2, total: 8, closesOn: null },
        ],
      }),
    ).toEqual({ id: 'study', href: '/goals#practice' });
    expect(dashboard.next.study).toBeTruthy();
  });

  it('at university with no first-week checklist, the modules come next; all done, the campus', () => {
    expect(nextAction({ ...university, firstWeek: null, modules: null })).toEqual({
      id: 'modules',
      href: '/modules',
    });
    expect(nextAction(university)).toEqual({ id: 'campus', href: '/campus' });
  });

  // A2-66 (DEMO-walk): a second- or final-year student was sent to tick off first-week steps and
  // find their way around campus "before your first day", as if they were arriving.
  it('in a second year (like Sipho): never the first week; the modules, then the plan for the degree (A2-66)', () => {
    const second: NextActionInput = {
      ...university,
      universityYear: 'middle',
      firstWeek: { done: 0, total: 8 },
    };
    expect(nextAction({ ...second, modules: null })).toEqual({ id: 'modules', href: '/modules' });
    expect(nextAction({ ...second, modules: { confirmed: 6, toFix: 1 } })).toEqual({
      id: 'fix-modules',
      href: '/modules',
    });
    expect(nextAction(second)).toEqual({ id: 'plan', href: '/goals' });
    expect(dashboard.next.plan).toBeTruthy();
  });

  it('in a final year (like Kagiso): the same, never the first week or the campus tour (A2-66)', () => {
    const final: NextActionInput = { ...university, universityYear: 'final', firstWeek: null };
    expect(nextAction(final)).toEqual({ id: 'plan', href: '/goals' });
    expect(nextAction({ ...final, modules: null })).toEqual({ id: 'modules', href: '/modules' });
  });
});

describe('universityYear (A2-66)', () => {
  it('is arriving in a first year, or before the year of study is known', () => {
    expect(universityYear({ yearOfStudy: null, durationYears: 3 })).toBe('arriving');
    expect(universityYear({ yearOfStudy: 1, durationYears: 3 })).toBe('arriving');
    // A one-year course's only year starts as an arrival too.
    expect(universityYear({ yearOfStudy: 1, durationYears: 1 })).toBe('arriving');
  });

  it('is final in the course’s last year (or past it), from the catalogue’s duration', () => {
    expect(universityYear({ yearOfStudy: 3, durationYears: 3 })).toBe('final');
    expect(universityYear({ yearOfStudy: 4, durationYears: 4 })).toBe('final');
    expect(universityYear({ yearOfStudy: 5, durationYears: 4 })).toBe('final');
  });

  it('is a middle year otherwise, and whenever the duration is unknown: never a guessed "final"', () => {
    expect(universityYear({ yearOfStudy: 2, durationYears: 3 })).toBe('middle');
    expect(universityYear({ yearOfStudy: 3, durationYears: 4 })).toBe('middle');
    expect(universityYear({ yearOfStudy: 3, durationYears: null })).toBe('middle');
  });

  it('names each later year in the words', () => {
    expect(Object.keys(dashboard.subtitleYears).sort()).toEqual(['final', 'middle']);
  });
});

describe('chatWelcome (A2-66)', () => {
  it('asks for a school report only before university', () => {
    for (const stage of ['grade-10', 'grade-11', 'matric'] as const) {
      expect(chatWelcome(stage, null)).toBe('school');
    }
    expect(chatWelcome('university', 'arriving')).toBe('arriving');
    expect(chatWelcome('university', null)).toBe('arriving');
    expect(chatWelcome('university', 'middle')).toBe('later-years');
    expect(chatWelcome('university', 'final')).toBe('later-years');
  });
});

describe('journeySteps', () => {
  const none = {
    stage: 'grade-11' as LearnerStage,
    universityYear: null as UniversityYear | null,
    hasReport: false,
    shortlisted: 0,
    hasGoal: false,
    applications: [] as Array<{ done: number; total: number }>,
    offerAccepted: false,
    firstWeek: null as { done: number; total: number } | null,
    modulesConfirmed: false,
  };
  const states = (input: Parameters<typeof journeySteps>[0]) =>
    journeySteps(input).map((s) => `${s.id}:${s.status}`);

  it('before university: report, shortlist, goal, applications, funding; the first not done is current', () => {
    expect(states(none)).toEqual([
      'report:current',
      'shortlist:todo',
      'goal:todo',
      'applications:todo',
      'funding:todo',
    ]);
    expect(states({ ...none, stage: 'matric', hasReport: true, shortlisted: 2 })).toEqual([
      'report:done',
      'shortlist:done',
      'goal:current',
      'applications:todo',
      'funding:todo',
    ]);
  });

  it('applications are done only when every application’s checklist is', () => {
    const base = { ...none, hasReport: true, shortlisted: 1, hasGoal: true };
    expect(states({ ...base, applications: [{ done: 3, total: 9 }] })[3]).toBe(
      'applications:current',
    );
    expect(states({ ...base, applications: [{ done: 9, total: 9 }] })).toEqual([
      'report:done',
      'shortlist:done',
      'goal:done',
      'applications:done',
      'funding:current',
    ]);
  });

  it('a later step done out of order still shows as done', () => {
    expect(states({ ...none, hasGoal: true })[2]).toBe('goal:done');
    expect(states({ ...none, hasGoal: true })[0]).toBe('report:current');
  });

  it('at university: offer accepted, first week, modules confirmed', () => {
    const uni = { ...none, stage: 'university' as const, offerAccepted: true };
    expect(states({ ...uni, firstWeek: { done: 2, total: 8 } })).toEqual([
      'offer:done',
      'first-week:current',
      'modules:todo',
    ]);
    // Phase 6c: with modules confirmed, Stage 6's step follows them.
    expect(states({ ...uni, firstWeek: { done: 8, total: 8 }, modulesConfirmed: true })).toEqual([
      'offer:done',
      'first-week:done',
      'modules:done',
      'semester:current',
    ]);
    // No checklist for the university: that step can't be done, the modules come next.
    expect(states({ ...uni, firstWeek: null })).toEqual([
      'offer:done',
      'first-week:current',
      'modules:todo',
    ]);
  });

  it('in a second or final year: the modules, then the plan for the degree; no offer or first week (A2-66)', () => {
    for (const universityYear of ['middle', 'final'] as const) {
      const later = { ...none, stage: 'university' as const, universityYear, offerAccepted: true };
      // Like Sipho and Kagiso: an accepted offer and every first-week step long behind them.
      expect(
        states({ ...later, firstWeek: { done: 8, total: 8 }, modulesConfirmed: true }),
      ).toEqual(['modules:done', 'semester:current', 'plan:todo']);
      // A later-year student who never ticked a first week is not sent back to it.
      expect(states({ ...later, firstWeek: { done: 0, total: 8 } })).toEqual([
        'modules:current',
        'plan:todo',
      ]);
      expect(journeySteps(later).map((s) => s.href)).toEqual(['/modules', '/goals']);
    }
    expect(dashboard.journey.steps.plan).toBeTruthy();
  });

  it('in Grade 10: report, subjects, goal, study; applications and funding are two years away (G10-4)', () => {
    const g10 = { ...none, stage: 'grade-10' as const };
    expect(states(g10)).toEqual(['report:current', 'subjects:todo', 'goal:todo', 'study:todo']);
    // The subjects check runs on the confirmed report, so it is done once there is one.
    expect(states({ ...g10, hasReport: true })).toEqual([
      'report:done',
      'subjects:done',
      'goal:current',
      'study:todo',
    ]);
    // Study has no record of being done: it becomes the current step last, like Funding.
    expect(states({ ...g10, hasReport: true, hasGoal: true, shortlisted: 3 })).toEqual([
      'report:done',
      'subjects:done',
      'goal:done',
      'study:current',
    ]);
    expect(journeySteps(g10).map((s) => s.href)).toEqual([
      '/documents',
      '/subjects',
      '/goals',
      '/goals#practice',
    ]);
    for (const step of journeySteps(g10)) expect(journeyStepName(step)).toBeTruthy();
  });

  it('adds Stage 6, "Set up your semester", after My modules only once modules are confirmed (Phase 6c)', () => {
    const uni = { ...none, stage: 'university' as const, offerAccepted: true };
    expect(
      states({ ...uni, firstWeek: { done: 8, total: 8 } }).map((s) => s.split(':')[0]),
    ).toEqual(['offer', 'first-week', 'modules']);
    const confirmed = journeySteps({
      ...uni,
      firstWeek: { done: 8, total: 8 },
      modulesConfirmed: true,
    });
    const semester = confirmed.find((s) => s.id === 'semester');
    // Each module's card opens from My modules; the step has no record of being done, like Funding.
    expect(semester).toEqual({ id: 'semester', href: '/modules', status: 'current' });
    expect(journeyStepName(semester as JourneyStep)).toBe(moduleCard.journeyStep);
    expect(journeyStepName(confirmed[0] as JourneyStep)).toBe(dashboard.journey.steps.offer);
  });

  it('links each step to the page where it is done', () => {
    expect(journeySteps(none).map((s) => s.href)).toEqual([
      '/documents',
      '/results',
      '/goals',
      '/applications',
      '/funding',
    ]);
    expect(
      journeySteps({ ...none, stage: 'university', offerAccepted: true }).map((s) => s.href),
    ).toEqual(['/offers', '/first-week', '/modules']);
  });
});
