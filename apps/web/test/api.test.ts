import { en } from '@universityflow/content';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, errorMessage } from '../lib/client/api';
import { agreeAsAdult } from './adult-consent';
import { Browser } from './harness';

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

const { getServices } = await import('../lib/server/services');

const routes = {
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  signOut: (await import('../app/api/auth/sign-out/route')).POST,
  me: await import('../app/api/me/route'),
  dob: (await import('../app/api/me/date-of-birth/route')).POST,
  guardian: (await import('../app/api/me/guardian/route')).POST,
  exportData: (await import('../app/api/me/export/route')).GET,
  consent: (await import('../app/api/consent/[token]/route')).POST,
  documents: await import('../app/api/documents/route'),
  uploadTicket: (await import('../app/api/documents/uploads/route')).POST,
  reports: (await import('../app/api/reports/route')).POST,
  results: (await import('../app/api/results/route')).GET,
  chat: await import('../app/api/chat/route'),
  shortlist: await import('../app/api/shortlist/route'),
  application: (await import('../app/api/applications/[university]/route')).PATCH,
  checklist: (await import('../app/api/checklist/route')).POST,
  outbox: (await import('../app/api/dev/outbox/route')).GET,
};

let n = 2_000_000;
/** A synthetic number, built at runtime (hard rule 4). */
const phone = () => `082${String(n++).padStart(7, '0')}`;

async function lastSms(browser: Browser, to: string) {
  const { body } = await browser.json<{ messages: Array<{ to: string; body: string }> }>(
    routes.outbox,
    '/api/dev/outbox',
  );
  const e164 = `+27${to.slice(1)}`;
  return body.messages.find((m) => m.to === e164)?.body ?? '';
}

/** Signs a fresh browser in and returns it. */
async function signedIn(number = phone()) {
  const browser = new Browser();
  await browser.json(routes.requestPin, '/api/auth/request-pin', { json: { phone: number } });
  const pin = (await lastSms(browser, number)).match(/\b(\d{6})\b/)?.[1];
  await browser.json(routes.verifyPin, '/api/auth/verify-pin', { json: { phone: number, pin } });
  return { browser, number };
}

async function adult() {
  const session = await signedIn();
  await session.browser.json(routes.dob, '/api/me/date-of-birth', {
    json: { dateOfBirth: '2000-02-02' },
  });
  await agreeAsAdult(session.browser);
  return session;
}

const MARKS = [
  { subject: 'isizulu-hl', percent: 74 },
  { subject: 'english-fal', percent: 68 },
  { subject: 'mathematics', percent: 71 },
  { subject: 'physical-sciences', percent: 66 },
  { subject: 'life-sciences', percent: 70 },
  { subject: 'geography', percent: 63 },
  { subject: 'life-orientation', percent: 80 },
];

describe('sign-in', () => {
  it('sends a PIN by SMS without ever returning it, and signs in with it', async () => {
    const browser = new Browser();
    const number = phone();
    const requested = await browser.json(routes.requestPin, '/api/auth/request-pin', {
      json: { phone: number },
    });
    expect(requested.status).toBe(200);
    expect(JSON.stringify(requested.body)).not.toMatch(/\d{6}/);
    const sms = await lastSms(browser, number);
    expect(sms).toMatch(/Never share it/);

    const pin = sms.match(/\b(\d{6})\b/)?.[1];
    const wrong = await browser.json(routes.verifyPin, '/api/auth/verify-pin', {
      json: { phone: number, pin: pin === '000000' ? '111111' : '000000' },
    });
    expect(wrong).toMatchObject({ status: 400, body: { error: 'pin' } });

    const ok = await browser.json(routes.verifyPin, '/api/auth/verify-pin', {
      json: { phone: number, pin },
    });
    expect(ok.status).toBe(200);
    expect(browser.jar.get('uf_session')).toBeTruthy();
  });

  it('takes back the PIN when the SMS provider fails, so the learner can ask again at once (A1-11)', async () => {
    const { sms } = await getServices();
    const send = vi.spyOn(sms, 'send').mockRejectedValueOnce(new Error('provider down'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const browser = new Browser();
    const number = phone();
    const failed = await browser.json(routes.requestPin, '/api/auth/request-pin', {
      json: { phone: number },
    });
    expect(failed).toMatchObject({ status: 500, body: { error: 'server' } });
    // The PIN that never went out can't be used (and no SMS reached the number).
    const code = (send.mock.calls[0]?.[0].body ?? '').match(/\b(\d{6})\b/)?.[1];
    const stale = await browser.json(routes.verifyPin, '/api/auth/verify-pin', {
      json: { phone: number, pin: code },
    });
    expect(stale).toMatchObject({ status: 400, body: { error: 'expired' } });
    expect(await lastSms(browser, number)).toBe('');
    // Nothing personal was logged (hard rule 4).
    expect(JSON.stringify(error.mock.calls)).not.toMatch(/\d{6}/);
    error.mockRestore();
    send.mockRestore();

    // Straight away, inside the one-a-minute limit: a new PIN, which works.
    const again = await browser.json(routes.requestPin, '/api/auth/request-pin', {
      json: { phone: number },
    });
    expect(again.status).toBe(200);
    const pin = (await lastSms(browser, number)).match(/\b(\d{6})\b/)?.[1];
    const ok = await browser.json(routes.verifyPin, '/api/auth/verify-pin', {
      json: { phone: number, pin },
    });
    expect(ok.status).toBe(200);
  });

  it('refuses a landline', async () => {
    const result = await new Browser().json(routes.requestPin, '/api/auth/request-pin', {
      json: { phone: '011 555 0000' },
    });
    expect(result).toMatchObject({ status: 400, body: { error: 'phone' } });
  });

  it('signs out', async () => {
    const { browser } = await adult();
    await browser.call(routes.signOut, '/api/auth/sign-out', { method: 'POST' });
    expect((await browser.json(routes.me.GET, '/api/me')).status).toBe(401);
  });

  // Production unchanged by the demo's sign-out (which says where to go next): exactly as before.
  it('sign-out answers { ok: true } and nothing more outside a demo', async () => {
    const { browser } = await adult();
    const out = await browser.json(routes.signOut, '/api/auth/sign-out', { method: 'POST' });
    expect(out).toEqual({ status: 200, body: { ok: true } });
  });
});

describe('security', () => {
  it('gives the session token only to the mobile app, never to page scripts (audit finding 8)', async () => {
    const browser = new Browser();
    const number = phone();
    await browser.json(routes.requestPin, '/api/auth/request-pin', { json: { phone: number } });
    const pin = (await lastSms(browser, number)).match(/\b(\d{6})\b/)?.[1];
    const web = await browser.json<{ token?: string }>(routes.verifyPin, '/api/auth/verify-pin', {
      json: { phone: number, pin },
    });
    expect(web.body.token).toBeUndefined();
    expect(browser.jar.get('uf_session')).toBeTruthy();
  });

  it('refuses an opaque Origin: null with a 403, not a crash (audit finding 8)', async () => {
    const { browser } = await adult();
    const result = await browser.json(routes.me.PATCH, '/api/me', {
      method: 'PATCH',
      json: { goal: 'x' },
      origin: 'null',
    });
    expect(result).toMatchObject({ status: 403, body: { error: 'forbidden' } });
  });

  it('refuses an upload with no declared length before reading it (audit finding 6)', async () => {
    const { browser } = await adult();
    const result = await browser.json(routes.documents.POST, '/api/documents', {
      method: 'POST',
      body: new Uint8Array([0xff, 0xd8, 0xff]),
      headers: { 'content-type': 'multipart/form-data; boundary=x' },
    });
    expect(result.status).toBe(411);
  });

  it('refuses a cookie-authenticated write from another site (CSRF)', async () => {
    const { browser } = await adult();
    const result = await browser.json(routes.me.PATCH, '/api/me', {
      method: 'PATCH',
      json: { goal: 'x' },
      origin: 'https://evil.example',
    });
    expect(result).toMatchObject({ status: 403, body: { error: 'forbidden' } });
  });

  it('refuses a signed-out request', async () => {
    expect((await new Browser().json(routes.results, '/api/results')).status).toBe(401);
  });
});

describe('the grade floor (A1-39: UniversityFlow starts at Grade 10)', () => {
  it('refuses Grade 9 and anything outside 10 to 12', async () => {
    const { browser } = await adult();
    for (const grade of [9, 13]) {
      const refused = await browser.json(routes.me.PATCH, '/api/me', {
        method: 'PATCH',
        json: { grade },
      });
      expect(refused.status, String(grade)).toBe(400);
    }
    const taken = await browser.json(routes.me.PATCH, '/api/me', {
      method: 'PATCH',
      json: { grade: 10 },
    });
    expect(taken.status).toBe(200);
  });
});

describe('the profile’s look (docs/design/profile-look-proposal.md, 0028)', () => {
  const patch = (browser: Browser, json: unknown) =>
    browser.json<{ profile: Record<string, unknown> }>(routes.me.PATCH, '/api/me', {
      method: 'PATCH',
      json,
    });

  it('saves ids from the lists, each word once, and gives them back', async () => {
    const { browser } = await adult();
    const logs = (['log', 'info', 'warn', 'error'] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => undefined),
    );
    const saved = await patch(browser, {
      theme: 'ocean',
      avatar: 'pattern:waves',
      taglineId: 'small-steps',
      badgeIds: ['night-owl', 'bookworm', 'night-owl'],
    });
    // Harmless ids, but there is no reason to log them (hard rule 4).
    const logged = JSON.stringify(logs.flatMap((spy) => spy.mock.calls));
    for (const spy of logs) spy.mockRestore();
    expect(saved.status).toBe(200);
    const look = {
      theme: 'ocean',
      avatar: 'pattern:waves',
      taglineId: 'small-steps',
      badgeIds: ['night-owl', 'bookworm'],
    };
    expect(saved.body.profile).toMatchObject(look);
    expect(logged).not.toMatch(/ocean|waves|small-steps|night-owl/);
    const read = await browser.json<{ profile: unknown }>(routes.me.GET, '/api/me');
    expect(read.body.profile).toMatchObject(look);
  });

  it('refuses anything not on the lists, free text above all (D3)', async () => {
    const { browser } = await adult();
    for (const json of [
      { theme: 'coral' },
      { theme: null },
      { avatar: 'photo' },
      { avatar: 'icon:nothing' },
      { taglineId: 'Call me after school' },
      { badgeIds: ['made-up'] },
      { badgeIds: 'night-owl' },
      { badgeIds: ['night-owl', 'bookworm', 'curious', 'early-bird'] },
    ]) {
      expect((await patch(browser, json)).status, JSON.stringify(json)).toBe(400);
    }
    // Clearing the tagline and the words is a choice too.
    expect((await patch(browser, { taglineId: null, badgeIds: [] })).status).toBe(200);
  });

  it('reads back the default for an id a later list no longer has', async () => {
    const { browser } = await adult();
    const me = await browser.json<{ account: { id: string } }>(routes.me.GET, '/api/me');
    const { store } = await getServices();
    await store.forStudent(me.body.account.id).updateProfile({
      theme: 'retired',
      avatar: 'icon:retired',
      badgeIds: ['retired', 'curious'],
    });
    const read = await browser.json<{ profile: unknown }>(routes.me.GET, '/api/me');
    expect(read.body.profile).toMatchObject({
      theme: 'mauve',
      avatar: 'initials',
      badgeIds: ['curious'],
    });
  });
});

describe('the age floor (A11-24: the stores say 13 and over)', () => {
  it('refuses a date of birth under 13 with its own reason, and records nothing', async () => {
    const { browser } = await signedIn();
    const refused = await browser.json(routes.dob, '/api/me/date-of-birth', {
      json: { dateOfBirth: '2016-06-01' },
    });
    expect(refused.status).toBe(409);
    expect(refused.body).toEqual({ error: 'state', detail: 'too-young' });
    expect(errorMessage(new ApiError(409, 'state', 'too-young'))).toBe(en.errors.tooYoung);
    // Nothing was kept, so a date of birth can still be given (it is set only once).
    const given = await browser.json(routes.dob, '/api/me/date-of-birth', {
      json: { dateOfBirth: '2010-05-05' },
    });
    expect(given.body).toEqual({ consentStatus: 'pending' });
  });
});

describe('guardian consent (hard rule 5, end to end)', () => {
  it('keeps a minor out until the guardian agrees through the SMS link', async () => {
    const { browser } = await signedIn();
    const dob = await browser.json(routes.dob, '/api/me/date-of-birth', {
      json: { dateOfBirth: '2010-05-05' },
    });
    expect(dob.body).toEqual({ consentStatus: 'pending' });

    // Nothing personal can be stored or read yet.
    expect(
      (await browser.json(routes.me.PATCH, '/api/me', { method: 'PATCH', json: { goal: 'law' } }))
        .status,
    ).toBe(403);
    expect((await browser.json(routes.results, '/api/results')).status).toBe(403);
    expect((await browser.json(routes.chat.GET, '/api/chat')).status).toBe(403);

    const guardianPhone = phone();
    // In the day: at night the SMS waits for 07:00 (A12-04, api-guardian-sms.test.ts).
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
    let asked: Awaited<ReturnType<typeof browser.json>>;
    try {
      asked = await browser.json(routes.guardian, '/api/me/guardian', {
        json: { name: 'Test Guardian', phone: guardianPhone, relationship: 'parent' },
      });
    } finally {
      vi.useRealTimers();
    }
    expect(asked.status).toBe(200);
    const link = (await lastSms(browser, guardianPhone)).match(/\/consent\/([\w-]+)/)?.[1];
    expect(link).toBeTruthy();

    const guardian = new Browser();
    const granted = await guardian.json(routes.consent, `/api/consent/${link}`, {
      json: { action: 'grant' },
      params: { token: link ?? '' },
    });
    expect(granted.body).toMatchObject({ status: 'granted' });

    const me = await browser.json<{ ready: boolean }>(routes.me.GET, '/api/me');
    expect(me.body.ready).toBe(true);
    expect(
      (await browser.json(routes.me.PATCH, '/api/me', { method: 'PATCH', json: { goal: 'law' } }))
        .status,
    ).toBe(200);
  });
});

describe('Stage 1: report → confirmed marks → results', () => {
  it('reads an upload into a draft that is not used until confirmed', async () => {
    const { browser } = await adult();
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
    const form = new FormData();
    form.append('file', new Blob([jpeg], { type: 'image/jpeg' }), 'report.jpg');
    const upload = await browser.json<{
      documentId: string;
      draft: { rows: unknown[] };
      sample: boolean;
    }>(routes.documents.POST, '/api/documents', { body: form, method: 'POST' });
    expect(upload.status).toBe(200);
    expect(upload.body.sample).toBe(true);
    expect(upload.body.draft.rows.length).toBeGreaterThan(5);

    // Hard rule 6: nothing has been calculated from the draft.
    expect((await browser.json(routes.results, '/api/results')).body).toEqual({
      report: null,
      results: null,
    });

    const confirmed = await browser.json(routes.reports, '/api/reports', {
      json: { kind: 'grade-11-final', marks: MARKS, documentId: upload.body.documentId },
    });
    expect(confirmed.status).toBe(200);

    const results = await browser.json<{ results: { qualifyNow: unknown[]; checked: number } }>(
      routes.results,
      '/api/results',
    );
    expect(results.body.results.checked).toBeGreaterThan(80);
    expect(results.body.results.qualifyNow.length).toBeGreaterThan(0);
  });

  it('offers no direct-to-storage tickets when files go through our server (local mode)', async () => {
    const { browser } = await adult();
    const result = await browser.json(routes.uploadTicket, '/api/documents/uploads', {
      json: { contentType: 'image/jpeg', size: 10 },
    });
    expect(result).toMatchObject({ status: 404, body: { error: 'not-found' } });
  });

  it('refuses a file that is not an image or PDF', async () => {
    const { browser } = await adult();
    const form = new FormData();
    form.append('file', new Blob([new TextEncoder().encode('<html>')], { type: 'image/jpeg' }));
    const result = await browser.json(routes.documents.POST, '/api/documents', {
      body: form,
      method: 'POST',
    });
    expect(result).toMatchObject({
      status: 400,
      body: { error: 'upload', detail: 'unsupported-type' },
    });
  });

  it('takes a final Grade 10 report, scored on track and never as qualifying (G10-2, G10-3)', async () => {
    const { browser } = await adult();
    const confirmed = await browser.json(routes.reports, '/api/reports', {
      json: { kind: 'grade-10-final', marks: MARKS },
    });
    expect(confirmed.status).toBe(200);
    const results = await browser.json<{
      report: { kind: string };
      results: { basis: string; qualifyNow: unknown[]; onTrack: unknown[]; planB: unknown[] };
    }>(routes.results, '/api/results');
    expect(results.body.report.kind).toBe('grade-10-final');
    expect(results.body.results.basis).toBe('progress');
    expect(results.body.results.qualifyNow).toEqual([]);
    expect(results.body.results.planB).toEqual([]);
    expect(results.body.results.onTrack.length).toBeGreaterThan(0);

    // There is no Grade 10 September kind (§18.8 G10-2 named only June).
    const unknown = await browser.json(routes.reports, '/api/reports', {
      json: { kind: 'grade-10-september', marks: MARKS },
    });
    expect(unknown.status).toBe(400);
  });

  it('gives the school record of every confirmed report, each mark entered by the learner (§18.7 C2)', async () => {
    const { browser } = await adult();
    type Body = {
      report: { kind: string } | null;
      results: { basis: string; qualifyNow: unknown[] } | null;
      record?: {
        reports: Array<{ kind: string; source: string; pass: string }>;
        rows: Array<{ subject: string; marks: Array<{ source: string } | null> }>;
      };
    };
    // A report read from a document but never confirmed is not part of it (hard rule 6).
    const form = new FormData();
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
    form.append('file', new Blob([jpeg], { type: 'image/jpeg' }), 'report.jpg');
    const uploaded = await browser.json(routes.documents.POST, '/api/documents', {
      body: form,
      method: 'POST',
    });
    expect(uploaded.status).toBe(200);
    expect(
      (await browser.json<Body>(routes.results, '/api/results')).body.record ?? null,
    ).toBeNull();

    for (const kind of ['grade-10-final', 'grade-11-june'] as const) {
      const confirmed = await browser.json(routes.reports, '/api/reports', {
        json: { kind, marks: MARKS },
      });
      expect(confirmed.status, kind).toBe(200);
    }
    const { body } = await browser.json<Body>(routes.results, '/api/results');
    // Grade 11's June report is the latest, and still never "Qualify now".
    expect(body.report?.kind).toBe('grade-11-june');
    expect(body.results?.basis).toBe('progress');
    expect(body.results?.qualifyNow).toEqual([]);
    expect(body.record?.reports.map((r) => r.kind)).toEqual(['grade-10-final', 'grade-11-june']);
    expect(body.record?.reports.every((r) => r.source === 'learner')).toBe(true);
    const marks = body.record?.rows.flatMap((r) => r.marks) ?? [];
    expect(marks).toHaveLength(MARKS.length * 2);
    expect(marks.every((m) => m?.source === 'learner')).toBe(true);
  });

  it('refuses a report from a grade above the learner’s (A1-35)', async () => {
    const { browser } = await adult();
    await browser.json(routes.me.PATCH, '/api/me', { method: 'PATCH', json: { grade: 10 } });
    // The June and September reports keep the rule (§18.7 C2).
    for (const kind of [
      'grade-11-june',
      'grade-11-september',
      'grade-11-final',
      'grade-12-final',
    ]) {
      const refused = await browser.json(routes.reports, '/api/reports', {
        json: { kind, marks: MARKS },
      });
      expect(refused.status, kind).toBe(409);
      expect(refused.body).toEqual({ error: 'state', detail: 'report-above-grade' });
    }
    expect(errorMessage(new ApiError(409, 'state', 'report-above-grade'))).toBe(
      en.errors.reportAboveGrade,
    );
    // Nothing was saved, and their own grade's report is taken.
    expect((await browser.json(routes.results, '/api/results')).body).toMatchObject({
      report: null,
    });
    const own = await browser.json(routes.reports, '/api/reports', {
      json: { kind: 'grade-10-final', marks: MARKS },
    });
    expect(own.status).toBe(200);
  });

  it('refuses invalid or duplicate marks', async () => {
    const { browser } = await adult();
    const duplicate = await browser.json(routes.reports, '/api/reports', {
      json: {
        kind: 'grade-11-final',
        marks: [
          { subject: 'mathematics', percent: 60 },
          { subject: 'mathematics', percent: 61 },
        ],
      },
    });
    expect(duplicate.status).toBe(400);
    const outOfRange = await browser.json(routes.reports, '/api/reports', {
      json: { kind: 'grade-11-final', marks: [{ subject: 'mathematics', percent: 101 }] },
    });
    expect(outOfRange.status).toBe(400);
  });
});

describe('the chat', () => {
  async function chat(browser: Browser, message: string) {
    const response = await browser.call(routes.chat.POST, '/api/chat', { json: { message } });
    const events = (await response.text())
      .trim()
      .split('\n')
      .map(
        (line) => JSON.parse(line) as { type: string; delta?: string; artifact?: { kind: string } },
      );
    return { status: response.status, events };
  }

  it('streams an answer with artifacts from tools, and stores both sides', async () => {
    const { browser } = await adult();
    await browser.json(routes.reports, '/api/reports', {
      json: { kind: 'grade-11-final', marks: MARKS },
    });
    const { status, events } = await chat(browser, 'What can I study with my marks?');
    expect(status).toBe(200);
    expect(events.at(-1)).toMatchObject({ type: 'done', crisis: false });
    expect(events.filter((e) => e.type === 'artifact').map((e) => e.artifact?.kind)).toEqual([
      'results-card',
      'course-explorer',
    ]);
    const history = await browser.json<{ messages: Array<{ role: string }> }>(
      routes.chat.GET,
      '/api/chat',
    );
    expect(history.body.messages.map((m) => m.role)).toEqual(['student', 'assistant']);
  });

  it('answers a crisis with helplines and flags the stored message', async () => {
    const { browser } = await adult();
    const { events } = await chat(browser, 'I want to end my life');
    expect(events.at(-1)).toMatchObject({ type: 'done', crisis: true });
    expect(events.some((e) => e.artifact?.kind === 'crisis-card')).toBe(true);
    const history = await browser.json<{ messages: Array<{ crisis: boolean }> }>(
      routes.chat.GET,
      '/api/chat',
    );
    expect(history.body.messages.at(-1)?.crisis).toBe(true);
  });

  it('refuses an empty message', async () => {
    const { browser } = await adult();
    expect(
      (await browser.call(routes.chat.POST, '/api/chat', { json: { message: '  ' } })).status,
    ).toBe(400);
  });
});

describe('Stage 2: shortlist, applications and checklists', () => {
  it('keeps a shortlist of real programmes only', async () => {
    const { browser } = await adult();
    expect(
      (
        await browser.json(routes.shortlist.POST, '/api/shortlist', {
          json: { programmeId: 'uj-ba' },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await browser.json(routes.shortlist.POST, '/api/shortlist', {
          json: { programmeId: 'made-up-1' },
        })
      ).status,
    ).toBe(404);
    expect(
      (await browser.json<{ shortlist: string[] }>(routes.shortlist.GET, '/api/shortlist')).body
        .shortlist,
    ).toEqual(['uj-ba']);
    await browser.json(routes.shortlist.DELETE, '/api/shortlist', {
      method: 'DELETE',
      json: { programmeId: 'uj-ba' },
    });
    expect(
      (await browser.json<{ shortlist: string[] }>(routes.shortlist.GET, '/api/shortlist')).body
        .shortlist,
    ).toEqual([]);
  });

  it('records application progress and refuses unknown universities', async () => {
    const { browser } = await adult();
    const ok = await browser.json<{ application: { status: string } }>(
      routes.application,
      '/api/applications/uj',
      {
        method: 'PATCH',
        json: { status: 'submitted', reference: 'REF-123' },
        params: { university: 'uj' },
      },
    );
    expect(ok.body.application.status).toBe('submitted');
    const bad = await browser.json(routes.application, '/api/applications/mit', {
      method: 'PATCH',
      json: { status: 'submitted' },
      params: { university: 'mit' },
    });
    expect(bad.status).toBe(404);
  });

  it('ticks only known checklist items', async () => {
    const { browser } = await adult();
    const ok = await browser.json(routes.checklist, '/api/checklist', {
      json: { scope: 'application:wits', item: 'certified-id', done: true },
    });
    expect(ok.status).toBe(200);
    const bad = await browser.json(routes.checklist, '/api/checklist', {
      json: { scope: 'application:wits', item: 'bribe-paid', done: true },
    });
    expect(bad.status).toBe(400);
    const funding = await browser.json(routes.checklist, '/api/checklist', {
      json: { scope: 'funding:nsfas', item: 'document-0', done: true },
    });
    expect(funding.status).toBe(200);
  });
});

describe('the learner’s rights', () => {
  it('exports everything as a download, then deletes the account', async () => {
    const { browser } = await adult();
    await browser.json(routes.me.PATCH, '/api/me', { method: 'PATCH', json: { goal: 'teaching' } });
    const exported = await browser.call(routes.exportData, '/api/me/export');
    expect(exported.headers.get('content-disposition')).toMatch(/attachment/);
    const data = (await exported.json()) as { personal: { profile: { goal: string } } };
    expect(data.personal.profile.goal).toBe('teaching');

    const deleted = await browser.json(routes.me.DELETE, '/api/me', { method: 'DELETE' });
    expect(deleted.status).toBe(200);
    expect((await browser.json(routes.me.GET, '/api/me')).status).toBe(401);
  });
});
