import type { HomeData, SubjectsResponse } from '@universityflow/ui';
import { describe, expect, it, vi } from 'vitest';
import { agreeAsAdult } from './adult-consent';
import { Browser, type CallOptions } from './harness';

/**
 * `GET /api/home` (docs/design/README.md): the mobile app's home reads the same `HomeData` the
 * web's `/home` renders, over its bearer token, and only for a learner whose data may be processed
 * (hard rule 5). The numbers themselves are tested in home-data.test.ts.
 */

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

const routes = {
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  dob: (await import('../app/api/me/date-of-birth/route')).POST,
  me: await import('../app/api/me/route'),
  home: (await import('../app/api/home/route')).GET,
  subjects: (await import('../app/api/me/subjects/route')).GET,
  reports: (await import('../app/api/reports/route')).POST,
  goal: await import('../app/api/me/goal/route'),
  outbox: (await import('../app/api/dev/outbox/route')).GET,
};

let n = 7_800_000;
/** A synthetic number, built at runtime (hard rule 4). */
const phone = () => `082${String(n++).padStart(7, '0')}`;
const e164 = (local: string) => `+27${local.slice(1)}`;
const NATIVE: CallOptions = { origin: null, headers: { 'x-uf-client': 'native' } };

async function pinFor(local: string) {
  const { body } = await new Browser().json<{ messages: Array<{ to: string; body: string }> }>(
    routes.outbox,
    '/api/dev/outbox',
  );
  return (
    body.messages
      .filter((m) => m.to === e164(local))
      .at(-1)
      ?.body.match(/\b(\d{6})\b/)?.[1] ?? ''
  );
}

/** A learner signed in through the app: a bearer token, no cookie. */
async function appLearner({ ready }: { ready: boolean }) {
  const number = phone();
  const app = new Browser();
  await app.json(routes.requestPin, '/api/auth/request-pin', {
    ...NATIVE,
    json: { phone: number },
  });
  const verified = await app.json<{ token: string }>(routes.verifyPin, '/api/auth/verify-pin', {
    ...NATIVE,
    json: { phone: number, pin: await pinFor(number) },
  });
  const call: CallOptions = { bearer: verified.body.token, origin: null };
  if (ready) {
    await app.json(routes.dob, '/api/me/date-of-birth', {
      ...call,
      json: { dateOfBirth: '2000-02-02' },
    });
    await agreeAsAdult(app, call);
  }
  return { app, call };
}

describe('GET /api/home', () => {
  it('gives a ready learner in the app their home: the stage, the next step, nothing invented', async () => {
    const { app, call } = await appLearner({ ready: true });
    await app.json(routes.me.PATCH, '/api/me', {
      ...call,
      method: 'PATCH',
      json: { displayName: 'Sample', grade: 11 },
    });
    const { status, body } = await app.json<HomeData>(routes.home, '/api/home', call);
    expect(status).toBe(200);
    expect(body.stage).toBe('grade-11');
    expect(body.name).toBe('Sample');
    expect(body.next).toEqual({ id: 'add-report', href: '/documents' });
    // Nothing behind a number: null or empty, never a 0 that isn't true.
    expect(body.qualify).toBeNull();
    expect(body.nextPaperDays).toBeNull();
    expect(body.shortlist).toEqual([]);
    expect(body.marks).toEqual([]);
    // The header's avatar: the default look until the learner makes it theirs.
    expect(body.look).toEqual({ theme: 'mauve', avatar: 'initials' });
  });

  it('carries the learner’s theme and avatar for the header, and nothing else of the look', async () => {
    const { app, call } = await appLearner({ ready: true });
    await app.json(routes.me.PATCH, '/api/me', {
      ...call,
      method: 'PATCH',
      json: { theme: 'jacaranda', avatar: 'pattern:rings', badgeIds: ['night-owl'] },
    });
    const { body } = await app.json<HomeData>(routes.home, '/api/home', call);
    // No tagline or words on the home: the home is for the next step (proposal §2.1).
    expect(body.look).toEqual({ theme: 'jacaranda', avatar: 'pattern:rings' });
  });

  it('refuses a learner whose data may not be processed yet (hard rule 5)', async () => {
    const { app, call } = await appLearner({ ready: false });
    const { status, body } = await app.json(routes.home, '/api/home', call);
    expect(status).toBe(403);
    expect(body).toMatchObject({ error: 'consent' });
  });

  it('refuses a caller who is not signed in', async () => {
    const { status } = await new Browser().json(routes.home, '/api/home', { origin: null });
    expect(status).toBe(401);
  });

  it('in Grade 10 the home is Stage 0, with no applications (G10-4)', async () => {
    const { app, call } = await appLearner({ ready: true });
    await app.json(routes.me.PATCH, '/api/me', { ...call, method: 'PATCH', json: { grade: 10 } });
    const { body } = await app.json<HomeData>(routes.home, '/api/home', call);
    expect(body.stage).toBe('grade-10');
    expect(body.applications).toEqual([]);
    expect(body.subjects).toBeNull();
  });
});

describe('GET /api/me/subjects (G10-4)', () => {
  it('checks nothing before a confirmed report: no subjects, no verdict', async () => {
    const { app, call } = await appLearner({ ready: true });
    const { status, body } = await app.json(routes.subjects, '/api/me/subjects', call);
    expect(status).toBe(200);
    expect(body).toEqual({ report: null, subjects: [], doors: null });
  });

  it('refuses a learner whose data may not be processed yet (hard rule 5)', async () => {
    const { app, call } = await appLearner({ ready: false });
    const { status } = await app.json(routes.subjects, '/api/me/subjects', call);
    expect(status).toBe(403);
  });

  it('refuses a caller who is not signed in', async () => {
    const { status } = await new Browser().json(routes.subjects, '/api/me/subjects', {
      origin: null,
    });
    expect(status).toBe(401);
  });

  it('answers the what-if in the address and shows the goal, the real verdict unchanged', async () => {
    const { app, call } = await appLearner({ ready: true });
    await app.json(routes.reports, '/api/reports', {
      ...call,
      json: {
        kind: 'grade-10-final',
        marks: ['english-hl', 'isizulu-fal', 'mathematical-literacy', 'life-orientation'].map(
          (subject) => ({ subject, percent: 60 }),
        ),
      },
    });
    await app.json(routes.goal.PUT, '/api/me/goal', {
      ...call,
      method: 'PUT',
      json: { programmeId: 'wits-bsc-computer-science' },
    });
    const plain = await app.json<SubjectsResponse>(routes.subjects, '/api/me/subjects', call);
    expect(plain.body.doors?.whatIf).toBeNull();
    expect(plain.body.doors?.goal).toMatchObject({
      course: { id: 'wits-bsc-computer-science' },
      status: 'closed',
    });
    const swapped = await app.json<SubjectsResponse>(
      routes.subjects,
      '/api/me/subjects?drop=mathematical-literacy&take=mathematics',
      call,
    );
    expect(swapped.status).toBe(200);
    expect(swapped.body.doors?.closed).toBe(plain.body.doors?.closed);
    expect(swapped.body.doors?.whatIf).toMatchObject({
      drop: { id: 'mathematical-literacy' },
      take: { id: 'mathematics' },
    });
    expect(swapped.body.doors?.whatIf?.opened.length).toBeGreaterThan(0);
  });

  it('refuses the what-if, like the rest, before consent (hard rule 5)', async () => {
    const { app, call } = await appLearner({ ready: false });
    const { status } = await app.json(
      routes.subjects,
      '/api/me/subjects?drop=mathematical-literacy&take=mathematics',
      call,
    );
    expect(status).toBe(403);
  });
});
