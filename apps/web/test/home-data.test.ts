import { catalogueView, catalogueViewOf, RAW_CATALOGUE } from '@universityflow/catalogue';
import type { StudentStore } from '@universityflow/db';
import { describe, expect, it } from 'vitest';
import { homeData } from '@/lib/server/home';

/**
 * The signed-in home's numbers and lists (docs/design/README.md), from a fake store with
 * synthetic records. Each number is the learner's own, worked out by the same code as the page it
 * comes from, and left out (null, or an empty list) when nothing is behind it.
 */

const NOW = new Date('2026-10-19T08:00:00Z');
const VIEW = catalogueView(NOW, { includeDrafts: true });

const MARKS = [
  { subject: 'isizulu-hl', percent: 74 },
  { subject: 'english-fal', percent: 68 },
  { subject: 'mathematics', percent: 71 },
  { subject: 'physical-sciences', percent: 66 },
  { subject: 'life-sciences', percent: 70 },
  { subject: 'geography', percent: 63 },
  { subject: 'life-orientation', percent: 80 },
];

interface Records {
  grade?: number | null;
  displayName?: string | null;
  reports?: Array<{ kind: string; confirmedAt: Date; marks: typeof MARKS }>;
  shortlist?: string[];
  goal?: string | null;
  offers?: Array<{ programmeId: string; universityId: string; status: string; kind?: string }>;
  registration?: { programmeId: string; universityId: string } | null;
  firstWeekDone?: string[];
}

function store(r: Records): StudentStore {
  const reports = [...(r.reports ?? [])].sort(
    (a, b) => b.confirmedAt.getTime() - a.confirmedAt.getTime(),
  );
  const fake = {
    profile: async () => ({ grade: r.grade ?? null, displayName: r.displayName ?? null }),
    offers: async () =>
      (r.offers ?? []).map((o, i) => ({
        id: `offer-${i}`,
        universityId: o.universityId,
        programmeId: o.programmeId,
        kind: o.kind ?? 'final',
        source: 'learner',
        documentId: null,
        status: o.status,
        replyBy: null,
        conditions: [],
        createdAt: NOW,
        updatedAt: NOW,
        acceptedAt: o.status === 'accepted' ? NOW : null,
        declinedAt: null,
        reminder: null,
        registrationReminder: null,
      })),
    registration: async () =>
      r.registration
        ? {
            id: 'registration-1',
            universityId: r.registration.universityId,
            programmeId: r.registration.programmeId,
            academicYear: 2027,
            yearOfStudy: 1,
            modules: [
              { code: 'TEST101', name: 'Sample module one', term: 'S1', credits: 16 },
              { code: 'TEST102', name: 'Sample module two', term: 'S1', credits: 16 },
            ],
            documentId: null,
            confirmedAt: NOW,
            updatedAt: NOW,
            reminder: null,
          }
        : null,
    recentReports: async (limit: number) =>
      reports.slice(0, limit).map((rep, i) => ({ id: `report-${i}`, ...rep })),
    latestReport: async () => (reports[0] ? { id: 'report-0', ...reports[0] } : null),
    shortlist: async () => (r.shortlist ?? []).map((programmeId, rank) => ({ programmeId, rank })),
    goal: async () => (r.goal ? { programmeId: r.goal } : null),
    examSubjectChoices: async () => [],
    applications: async () => [],
    checklist: async () => [],
    firstWeekSteps: async () => (r.firstWeekDone ?? []).map((step) => ({ step, doneAt: NOW })),
  };
  return fake as unknown as StudentStore;
}

const june = (marks = MARKS) => ({
  kind: 'grade-12-june',
  confirmedAt: new Date('2026-07-10T10:00:00Z'),
  marks,
});
const grade11 = (marks = MARKS) => ({
  kind: 'grade-11-final',
  confirmedAt: new Date('2025-12-10T10:00:00Z'),
  marks,
});

describe('the home for a learner with nothing yet', () => {
  it('leaves every number out, and asks for a report first', async () => {
    const data = await homeData(store({ grade: 11 }), VIEW, NOW);
    expect(data.stage).toBe('grade-11');
    expect(data.name).toBeNull();
    expect(data.qualify).toBeNull();
    expect(data.nextPaperDays).toBeNull();
    expect(data.shortlist).toEqual([]);
    expect(data.applications).toEqual([]);
    expect(data.marks).toEqual([]);
    expect(data.offers).toEqual([]);
    expect(data.registration).toBeNull();
    expect(data.firstWeek).toBeNull();
    expect(data.modules).toBeNull();
    expect(data.next).toEqual({ id: 'add-report', href: '/documents' });
  });

  it('treats a name of spaces as no name', async () => {
    expect((await homeData(store({ displayName: '  ' }), VIEW, NOW)).name).toBeNull();
    expect((await homeData(store({ displayName: 'Sipho' }), VIEW, NOW)).name).toBe('Sipho');
  });
});

describe('the notice before the 18th birthday (A11-25)', () => {
  // NOW is 19 October 2026 in South Africa.
  const minor = (dateOfBirth: string, consentStatus = 'granted' as const) => ({
    dateOfBirth,
    consentStatus,
  });

  it('names the day, in the 30 days before, while a guardian’s consent covers them', async () => {
    const data = await homeData(store({ grade: 12 }), VIEW, NOW, minor('2008-11-08'));
    expect(data.turningEighteen).toEqual({ on: '2026-11-08' });
  });

  it('says nothing further off, on the day, for an adult, or without an account', async () => {
    const at = async (account: Parameters<typeof homeData>[3]) =>
      (await homeData(store({ grade: 12 }), VIEW, NOW, account)).turningEighteen;
    expect(await at(minor('2008-11-19'))).toBeNull(); // 31 days away
    expect(await at(minor('2008-10-19'))).toBeNull(); // 18 today
    expect(await at({ dateOfBirth: '2000-02-02', consentStatus: 'not-required' })).toBeNull();
    expect(await at(undefined)).toBeNull();
  });
});

describe('the home before university', () => {
  it('counts the courses from the latest confirmed report, as Results does', async () => {
    const data = await homeData(store({ grade: 12, reports: [june()] }), VIEW, NOW);
    expect(data.stage).toBe('matric');
    expect(data.qualify).not.toBeNull();
    const { now, close, planB } = data.qualify ?? { now: -1, close: -1, planB: -1 };
    expect(now + close + planB).toBeGreaterThan(0);
    expect(data.next).toEqual({ id: 'shortlist', href: '/results' });
  });

  it('lists the shortlist with each course’s standing, and one application per university', async () => {
    const data = await homeData(
      store({ grade: 12, reports: [june()], shortlist: ['uj-beng-civil'] }),
      VIEW,
      NOW,
    );
    expect(data.shortlist).toEqual([
      expect.objectContaining({
        programmeId: 'uj-beng-civil',
        name: 'Bachelor of Engineering in Civil Engineering',
        universityName: 'UJ',
        verdict: expect.stringMatching(/^(qualifyNow|close|planB)$/),
      }),
    ]);
    expect(data.applications.map((a) => a.universityId)).toEqual(['uj']);
    expect(data.applications[0]?.total).toBeGreaterThan(0);
    expect(data.applications[0]?.done).toBe(0);
    expect(data.next).toEqual({ id: 'goal', href: '/goals' });
  });

  it('shows a shortlisted course without a standing until there is a report', async () => {
    const data = await homeData(store({ grade: 11, shortlist: ['uj-bcom-accounting'] }), VIEW, NOW);
    expect(data.shortlist).toEqual([
      expect.objectContaining({ programmeId: 'uj-bcom-accounting', verdict: null }),
    ]);
  });

  it('leaves out a shortlisted course the learner may not see (hard rule 3)', async () => {
    const data = await homeData(
      store({ grade: 12, reports: [june()], shortlist: ['no-such-course'] }),
      VIEW,
      NOW,
    );
    expect(data.shortlist).toEqual([]);
    expect(data.next).toEqual({ id: 'shortlist', href: '/results' });
  });

  it('never counts a draft paper: the next-paper number is left out', async () => {
    // The 2026 timetable is preview (draft) data in the catalogue.
    const data = await homeData(store({ grade: 12, reports: [june()] }), VIEW, NOW);
    expect(data.nextPaperDays).toBeNull();
  });

  it('plots one point per report, in the order of the school year', async () => {
    const data = await homeData(store({ grade: 12, reports: [june(), grade11()] }), VIEW, NOW);
    expect(data.marks.map((m) => m.kind)).toEqual(['grade-11-final', 'grade-12-june']);
    expect(data.marks[0]?.average).toBe(70);
  });

  it('a goal the learner may not see is no goal', async () => {
    const data = await homeData(
      store({ grade: 12, reports: [june()], goal: 'no-such-course' }),
      VIEW,
      NOW,
    );
    expect(data.goalProgrammeId).toBeNull();
  });
});

describe('the home in Grade 10 (Stage 0, G10-4)', () => {
  const MATHS_LIT = MARKS.map((m) =>
    m.subject === 'mathematics'
      ? { subject: 'mathematical-literacy', percent: 71 }
      : m.subject === 'physical-sciences'
        ? { subject: 'history', percent: 66 }
        : m,
  );
  const grade10 = (marks = MARKS) => ({
    kind: 'grade-10-final',
    confirmedAt: new Date('2025-12-10T10:00:00Z'),
    marks,
  });

  it('is Stage 0, with no subjects check before a confirmed report', async () => {
    const data = await homeData(store({ grade: 10 }), VIEW, NOW);
    expect(data.stage).toBe('grade-10');
    expect(data.subjects).toBeNull();
    expect(data.next).toEqual({ id: 'add-report', href: '/documents' });
  });

  it('checks the confirmed report’s subjects: Mathematical Literacy closes some courses', async () => {
    const data = await homeData(store({ grade: 10, reports: [grade10(MATHS_LIT)] }), VIEW, NOW);
    expect(data.subjects).toMatchObject({ status: 'some-closed', draft: true });
    expect(data.subjects?.closed).toBeGreaterThan(0);
    const maths = await homeData(store({ grade: 10, reports: [grade10()] }), VIEW, NOW);
    expect(maths.subjects?.closed).toBeLessThan(data.subjects?.closed ?? 0);
  });

  it('never shows application tiles, even with a shortlist; next is the goal, then study', async () => {
    const shortlisted = await homeData(
      store({ grade: 10, reports: [grade10()], shortlist: ['uj-beng-civil'] }),
      VIEW,
      NOW,
    );
    expect(shortlisted.applications).toEqual([]);
    expect(shortlisted.next).toEqual({ id: 'goal', href: '/goals' });
    const withGoal = await homeData(
      store({ grade: 10, reports: [grade10()], goal: 'uj-beng-civil' }),
      VIEW,
      NOW,
    );
    expect(withGoal.next).toEqual({ id: 'study', href: '/goals#practice' });
  });

  it('says it can’t check when the learner may see no course (production, before verification)', async () => {
    const verified = catalogueView(NOW, { includeDrafts: false });
    const data = await homeData(store({ grade: 10, reports: [grade10(MATHS_LIT)] }), verified, NOW);
    if (verified.programmes.length === 0) {
      expect(data.subjects).toEqual({ status: 'unknown', checked: 0, closed: 0, draft: false });
    }
  });

  it('says how many courses were checked, so 0 checked is never shown as "0 qualify" (A1-41)', async () => {
    const empty = catalogueViewOf({ ...RAW_CATALOGUE, programmes: [] }, NOW, {
      includeDrafts: true,
    });
    const none = await homeData(store({ grade: 10, reports: [grade10()] }), empty, NOW);
    expect(none.qualify).toMatchObject({ checked: 0 });
    const some = await homeData(store({ grade: 11, reports: [grade11()] }), VIEW, NOW);
    expect(some.qualify?.checked).toBeGreaterThan(0);
  });

  it('has no subjects check outside Grade 10', async () => {
    const data = await homeData(store({ grade: 11, reports: [grade11()] }), VIEW, NOW);
    expect(data.subjects).toBeNull();
  });
});

describe('the home at university', () => {
  const accepted = {
    programmeId: 'up-bsc-computer-science',
    universityId: 'up',
    status: 'accepted',
  };

  it('is the university stage with an accepted offer: the offer, first week, no modules yet', async () => {
    const data = await homeData(store({ grade: 12, offers: [accepted] }), VIEW, NOW);
    expect(data.stage).toBe('university');
    expect(data.offers.map((o) => o.status)).toEqual(['accepted']);
    expect(data.applications).toEqual([]);
    expect(data.qualify).toBeNull();
    expect(data.firstWeek?.done).toBe(0);
    expect(data.firstWeek?.total).toBeGreaterThan(0);
    expect(data.modules).toBeNull();
    expect(data.next).toEqual({ id: 'first-week', href: '/first-week' });
  });

  it('counts first-week steps done and the modules confirmed', async () => {
    const data = await homeData(
      store({
        grade: 12,
        offers: [accepted],
        firstWeekDone: ['register'],
        registration: { programmeId: accepted.programmeId, universityId: 'up' },
      }),
      VIEW,
      NOW,
    );
    expect(data.firstWeek?.done).toBe(1);
    expect(data.modules?.confirmed).toBe(2);
  });

  it('counts down to registration from the published calendar, and leaves it out without one', async () => {
    const data = await homeData(store({ grade: 12, offers: [accepted] }), VIEW, NOW);
    // UP's 2027 calendar is a draft record the preview shows; with it, a countdown; never a guess.
    expect(data.registration).not.toBeNull();
    expect(data.registration?.days).toBeGreaterThan(0);
    expect(['opens', 'closes']).toContain(data.registration?.phase);
    const none = await homeData(
      store({ grade: 12, offers: [accepted] }),
      catalogueView(NOW, { includeDrafts: false }),
      NOW,
    );
    expect(none.registration).toBeNull();
  });

  it('a held offer is not a place: still matric', async () => {
    const data = await homeData(
      store({ grade: 12, offers: [{ ...accepted, status: 'held' }] }),
      VIEW,
      NOW,
    );
    expect(data.stage).toBe('matric');
    expect(data.offers).toEqual([]);
  });
});
