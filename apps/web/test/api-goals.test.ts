import type { PracticeArtifact } from '@universityflow/agent';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { ExamsResponse, GoalResponse } from '@/lib/server/goals';
import { agreeAsAdult } from './adult-consent';
import { Browser } from './harness';

/**
 * Phase 4b over the real route handlers and an embedded database: the goal API (guards, CSRF,
 * consent, export and delete), the exam countdown from confirmed subjects only, and the paper
 * source the reminder pipeline reads.
 *
 * The clock (Date only) is pinned to 13 October 2026, inside the 2026 NSC exams, which the
 * preview catalogue (UF_CATALOGUE_PREVIEW=1 in the harness) holds as drafts.
 */

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-10-13T08:00:00Z'));
afterAll(() => {
  vi.useRealTimers();
});

const { getServices } = await import('../lib/server/services');

const routes = {
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  me: await import('../app/api/me/route'),
  dob: (await import('../app/api/me/date-of-birth/route')).POST,
  guardian: (await import('../app/api/me/guardian/route')).POST,
  consent: (await import('../app/api/consent/[token]/route')).POST,
  exportData: (await import('../app/api/me/export/route')).GET,
  reports: (await import('../app/api/reports/route')).POST,
  documents: await import('../app/api/documents/route'),
  shortlist: await import('../app/api/shortlist/route'),
  goal: await import('../app/api/me/goal/route'),
  exams: await import('../app/api/me/exams/route'),
  practice: (await import('../app/api/me/practice/route')).GET,
  outbox: (await import('../app/api/dev/outbox/route')).GET,
};

let n = 7_000_000;
const phone = () => `082${String(n++).padStart(7, '0')}`;

async function lastSms(to: string) {
  const { body } = await new Browser().json<{ messages: Array<{ to: string; body: string }> }>(
    routes.outbox,
    '/api/dev/outbox',
  );
  return body.messages.findLast((m) => m.to === `+27${to.slice(1)}`)?.body ?? '';
}

async function signedIn() {
  const number = phone();
  const browser = new Browser();
  await browser.json(routes.requestPin, '/api/auth/request-pin', { json: { phone: number } });
  const pin = (await lastSms(number)).match(/\b(\d{6})\b/)?.[1];
  const verified = await browser.json<{ studentId?: string }>(
    routes.verifyPin,
    '/api/auth/verify-pin',
    { json: { phone: number, pin } },
  );
  return { browser, number, verified };
}

async function adult(grade = 12) {
  const session = await signedIn();
  await session.browser.json(routes.dob, '/api/me/date-of-birth', {
    json: { dateOfBirth: '2000-02-02' },
  });
  await agreeAsAdult(session.browser);
  await session.browser.json(routes.me.PATCH, '/api/me', { method: 'PATCH', json: { grade } });
  return session;
}

const confirm = (browser: Browser, marks: Array<{ subject: string; percent: number }>) =>
  browser.json(routes.reports, '/api/reports', { json: { kind: 'grade-12-june', marks } });

const MARKS = [
  { subject: 'english-fal', percent: 68 },
  { subject: 'mathematics', percent: 71 },
  { subject: 'physical-sciences', percent: 66 },
  { subject: 'life-orientation', percent: 80 },
];

describe('the goal API', () => {
  it('sets, shows, changes and clears the goal, with the computed verdict', async () => {
    const { browser } = await adult();
    const empty = await browser.json<GoalResponse>(routes.goal.GET, '/api/me/goal');
    expect(empty.status).toBe(200);
    expect(empty.body).toMatchObject({ goalId: null, card: null });
    expect(empty.body.options.length).toBeGreaterThan(80);

    const noMarks = await browser.json<GoalResponse>(routes.goal.PUT, '/api/me/goal', {
      method: 'PUT',
      json: { programmeId: 'wits-bsc-computer-science' },
    });
    expect(noMarks.status).toBe(200);
    expect(noMarks.body.card).toMatchObject({
      kind: 'goal-card',
      programme: { id: 'wits-bsc-computer-science', universityId: 'wits', draft: true },
      result: null,
      hasMarks: false,
    });

    await confirm(browser, MARKS);
    const withMarks = await browser.json<GoalResponse>(routes.goal.GET, '/api/me/goal');
    expect(withMarks.body.card?.result?.verdict).toMatch(/^(qualifies|close|not-yet)$/);

    // The goal is on the shortlist, so its application pack exists.
    const shortlist = await browser.json<{ shortlist: string[] }>(
      routes.shortlist.GET,
      '/api/shortlist',
    );
    expect(JSON.stringify(shortlist.body)).toContain('wits-bsc-computer-science');

    const changed = await browser.json<GoalResponse>(routes.goal.PUT, '/api/me/goal', {
      method: 'PUT',
      json: { programmeId: 'uj-beng-civil' },
    });
    expect(changed.body.goalId).toBe('uj-beng-civil');

    const cleared = await browser.json<GoalResponse>(routes.goal.DELETE, '/api/me/goal', {
      method: 'DELETE',
    });
    expect(cleared.body).toMatchObject({ goalId: null, card: null });
  });

  it('refuses a course the catalogue does not hold, and bad input', async () => {
    const { browser } = await adult();
    expect(
      (
        await browser.json(routes.goal.PUT, '/api/me/goal', {
          method: 'PUT',
          json: { programmeId: 'nowhere-bsc' },
        })
      ).status,
    ).toBe(404);
    for (const json of [{}, { programmeId: 'x' }, { programmeId: 'uj-beng-civil', extra: 1 }]) {
      expect(
        (await browser.json(routes.goal.PUT, '/api/me/goal', { method: 'PUT', json })).status,
      ).toBe(400);
    }
    expect(
      (await browser.json<GoalResponse>(routes.goal.GET, '/api/me/goal')).body.goalId,
    ).toBeNull();
  });

  it('refuses a write from another site (CSRF), and a signed-out caller', async () => {
    const { browser } = await adult();
    for (const origin of ['https://evil.example', null]) {
      const res = await browser.json(routes.goal.PUT, '/api/me/goal', {
        method: 'PUT',
        json: { programmeId: 'uj-beng-civil' },
        origin,
      });
      expect(res.status).toBe(403);
    }
    const del = await browser.json(routes.goal.DELETE, '/api/me/goal', {
      method: 'DELETE',
      origin: 'https://evil.example',
    });
    expect(del.status).toBe(403);
    expect((await new Browser().json(routes.goal.GET, '/api/me/goal')).status).toBe(401);
  });

  it("keeps a minor's goal out until a guardian consents (hard rule 5)", async () => {
    const { browser } = await signedIn();
    await browser.json(routes.dob, '/api/me/date-of-birth', {
      json: { dateOfBirth: '2010-05-05' },
    });
    expect((await browser.json(routes.goal.GET, '/api/me/goal')).status).toBe(403);
    expect(
      (
        await browser.json(routes.goal.PUT, '/api/me/goal', {
          method: 'PUT',
          json: { programmeId: 'uj-beng-civil' },
        })
      ).status,
    ).toBe(403);
    expect((await browser.json(routes.exams.GET, '/api/me/exams')).status).toBe(403);

    const guardianPhone = phone();
    await browser.json(routes.guardian, '/api/me/guardian', {
      json: { name: 'Test Guardian', phone: guardianPhone, relationship: 'parent' },
    });
    const link = (await lastSms(guardianPhone)).match(/\/consent\/([\w-]+)/)?.[1] ?? '';
    await new Browser().json(routes.consent, `/api/consent/${link}`, {
      json: { action: 'grant' },
      params: { token: link },
    });
    expect(
      (
        await browser.json(routes.goal.PUT, '/api/me/goal', {
          method: 'PUT',
          json: { programmeId: 'uj-beng-civil' },
        })
      ).status,
    ).toBe(200);
  });

  it('is in the export, and goes with the account', async () => {
    const { browser } = await adult();
    await browser.json(routes.goal.PUT, '/api/me/goal', {
      method: 'PUT',
      json: { programmeId: 'uj-beng-civil' },
    });
    await browser.json(routes.exams.PUT, '/api/me/exams', {
      method: 'PUT',
      json: { subjectId: 'tourism', included: true },
    });
    const exported = await browser.json<{
      personal: { goal: { programmeId: string }; examSubjectChoices: unknown[] };
    }>(routes.exportData, '/api/me/export');
    expect(exported.body.personal.goal.programmeId).toBe('uj-beng-civil');
    expect(exported.body.personal.examSubjectChoices).toHaveLength(1);

    expect((await browser.json(routes.me.DELETE, '/api/me', { method: 'DELETE' })).status).toBe(
      200,
    );
    expect((await browser.json(routes.goal.GET, '/api/me/goal')).status).toBe(401);
  });
});

describe('the exam countdown API', () => {
  it('matches papers from the confirmed report only (hard rule 6)', async () => {
    const { browser } = await adult();
    const before = await browser.json<ExamsResponse>(routes.exams.GET, '/api/me/exams');
    expect(before.body.countdown).toMatchObject({ examYear: 2026, subjectCount: 0, papers: [] });

    // A report read from a photo is a draft until the learner confirms it: no papers from it.
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
    const form = new FormData();
    form.append('file', new Blob([jpeg], { type: 'image/jpeg' }), 'report.jpg');
    form.append('kind', 'grade-12-june');
    await browser.json(routes.documents.POST, '/api/documents', { body: form });
    expect(
      (await browser.json<ExamsResponse>(routes.exams.GET, '/api/me/exams')).body.countdown
        .subjectCount,
    ).toBe(0);

    await confirm(browser, MARKS);
    const after = await browser.json<ExamsResponse>(routes.exams.GET, '/api/me/exams');
    expect(after.body.countdown.subjectCount).toBe(3);
    expect(after.body.countdown.papers.map((p) => [p.id, p.daysLeft, p.draft])).toEqual([
      ['nsc-2026-english-fal-p3', 2, true],
      ['nsc-2026-mathematics-p1', 10, true],
      ['nsc-2026-mathematics-p2', 13, true],
      ['nsc-2026-english-fal-p1', 15, true],
      ['nsc-2026-physical-sciences-p1', 17, true],
      ['nsc-2026-physical-sciences-p2', 20, true],
      ['nsc-2026-english-fal-p2', 37, true],
    ]);
    expect(after.body.subjects.map((s) => s.subjectId)).toEqual([
      'english-fal',
      'mathematics',
      'physical-sciences',
    ]);
  });

  it('adds, removes and undoes subjects at the learner’s word', async () => {
    const { browser } = await adult();
    await confirm(browser, MARKS);
    const put = (subjectId: string, included: boolean | null) =>
      browser.json<ExamsResponse>(routes.exams.PUT, '/api/me/exams', {
        method: 'PUT',
        json: { subjectId, included },
      });
    await put('physical-sciences', false);
    const added = await put('tourism', true);
    expect(added.body.subjects.find((s) => s.subjectId === 'physical-sciences')).toMatchObject({
      onReport: true,
      writes: false,
      changed: true,
    });
    expect(added.body.countdown.papers.map((p) => p.subjectId)).toContain('tourism');
    expect(added.body.countdown.papers.map((p) => p.subjectId)).not.toContain('physical-sciences');
    const undone = await put('physical-sciences', null);
    expect(undone.body.subjects.find((s) => s.subjectId === 'physical-sciences')?.writes).toBe(
      true,
    );
    expect((await put('astrology', true)).status).toBe(400);
    expect((await put('mathematics', 'yes' as never)).status).toBe(400);
  });

  it('feeds the reminder pipeline the learner’s papers', async () => {
    const { browser } = await adult();
    await confirm(browser, MARKS);
    const me = await browser.json<{ account: { id: string } }>(routes.me.GET, '/api/me');
    const { papers } = await getServices();
    const slots = await papers.slotsFor(
      me.body.account.id,
      new Date('2026-10-22T00:00:00Z'),
      new Date('2026-10-24T00:00:00Z'),
    );
    expect(slots).toEqual([
      { startsAt: new Date('2026-10-23T07:00:00Z'), endsAt: new Date('2026-10-23T10:00:00Z') },
    ]);
  });
});

describe('the practice API (Phase 4e)', () => {
  it('chooses nothing before marks are confirmed, then the weakest, then the goal’s subjects', async () => {
    const { browser } = await adult();
    const before = await browser.json<PracticeArtifact>(routes.practice, '/api/me/practice');
    expect(before.status).toBe(200);
    expect(before.body).toMatchObject({ kind: 'practice', basis: 'none', subjects: [] });

    await confirm(browser, [
      { subject: 'english-hl', percent: 72 },
      { subject: 'afrikaans-fal', percent: 70 },
      { subject: 'mathematics', percent: 48 },
      { subject: 'physical-sciences', percent: 45 },
      { subject: 'geography', percent: 75 },
      { subject: 'history', percent: 68 },
      { subject: 'life-orientation', percent: 40 },
    ]);
    const weakest = await browser.json<PracticeArtifact>(routes.practice, '/api/me/practice');
    expect(weakest.body.basis).toBe('weakest');
    expect(weakest.body.subjects.map((s) => s.subjectId)).toEqual([
      'physical-sciences',
      'mathematics',
      'history',
    ]);
    // Grade 12 (from the June report): Grade 12 material, drafts labelled in preview.
    const maths = weakest.body.subjects.find((s) => s.subjectId === 'mathematics');
    expect(maths?.resources[0]).toMatchObject({
      id: 'siyavula-mathematics-grade-12-textbook',
      draft: true,
    });

    await browser.json(routes.goal.PUT, '/api/me/goal', {
      method: 'PUT',
      json: { programmeId: 'wits-bsceng-civil' },
    });
    const goal = await browser.json<PracticeArtifact>(routes.practice, '/api/me/practice');
    expect(goal.body.basis).toBe('goal');
    expect(goal.body.goal?.programmeId).toBe('wits-bsceng-civil');
    expect(goal.body.subjects[0]?.reason).toBe('goal-to-raise');
    expect(JSON.stringify(goal.body)).not.toMatch(/percent|minimum|"gap"/);
  });

  it('refuses a signed-out request and a minor without guardian consent', async () => {
    expect((await new Browser().json(routes.practice, '/api/me/practice')).status).toBe(401);
    const { browser } = await signedIn();
    await browser.json(routes.dob, '/api/me/date-of-birth', {
      json: { dateOfBirth: '2010-05-05' },
    });
    expect((await browser.json(routes.practice, '/api/me/practice')).status).toBe(403);
  });
});
