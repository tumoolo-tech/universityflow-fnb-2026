import { jobSchedulerContract } from '@universityflow/jobs/contract';
import { nextAllowedSend, scheduleReminderJob } from '@universityflow/messaging';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { type Database, migrate, openDatabase, rowsOf } from './client';
import { ConsentRequiredError, InvalidStateError, PhotoConsentError } from './errors';
import { PostgresJobScheduler } from './jobs';
import { MIGRATIONS } from './migrations';
import {
  adultStudent,
  freshSyntheticPhones,
  postgresJobHarness,
  signIn,
  smsCode,
  syntheticPhone,
  testStore,
} from './testing';

/**
 * The same guarantees on real Postgres through the `pg` driver, the one production uses (RDS in
 * af-south-1). Runs when TEST_DATABASE_URL points at a scratch database: CI starts one; locally,
 * `pnpm db:up` and TEST_DATABASE_URL=postgres://universityflow:universityflow@localhost:5432/universityflow.
 */
const url = process.env['TEST_DATABASE_URL'];

describe.skipIf(!url)('on real Postgres', () => {
  let database: Database;

  beforeAll(async () => {
    // The database outlives the run: this run's students are new ones (A1-40).
    freshSyntheticPhones();
    database = openDatabase(url ?? '');
    await migrate(database);
  });
  afterAll(async () => {
    await database.close();
  });

  it('migrates idempotently', async () => {
    expect(await migrate(database)).toEqual([]);
  });

  // Serverless (the judge demo on Supabase): every function instance migrates as it starts, and
  // several start at once on a new database. Each migration must run exactly once, through a
  // transaction pooler too (no session state, no session advisory lock).
  it('migrates a new database once when instances start at the same time', async () => {
    const name = `uf_race_${Date.now()}`;
    await database.exec(`create database ${name}`);
    const fresh = new URL(url ?? '');
    fresh.pathname = `/${name}`;
    const instances = Array.from({ length: 6 }, () => openDatabase(fresh.toString()));
    try {
      const ran = await Promise.allSettled(instances.map((instance) => migrate(instance)));
      expect(ran.filter((r) => r.status === 'rejected')).toEqual([]);
      const all = ran.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
      expect(all.sort()).toEqual(MIGRATIONS.map((m) => m.id).sort());
      const [row] = rowsOf<{ n: number }>(
        await (instances[0] as Database).db.execute(
          sql`select count(*)::int as n from uf_migrations`,
        ),
      );
      expect(row?.n).toBe(MIGRATIONS.length);
    } finally {
      await Promise.all(instances.map((instance) => instance.close()));
      // A pool's end resolves before a connection it dropped on an error has finished closing
      // (pg-pool removes it at once and ends it in the background): wait until the server has
      // let every one go, so the drop below terminates nobody (gotcha 54).
      await vi.waitFor(
        async () => {
          const [left] = rowsOf<{ n: number }>(
            await database.db.execute(
              sql`select count(*)::int as n from pg_stat_activity where datname = ${name}`,
            ),
          );
          expect(left?.n).toBe(0);
        },
        { timeout: 5_000, interval: 50 },
      );
      await database.exec(`drop database ${name} with (force)`);
    }
  });

  // Gotcha 54: a pooled connection the server ends (a restart, a failover, a pooler letting go,
  // `drop database … with (force)`) is an error on the pool. Unheard, Node ends the process; heard,
  // the pool drops that connection, makes a new one, and only the error's code is logged.
  it('survives the server ending one of its idle connections', async () => {
    const other = openDatabase(url ?? '', { max: 1 });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const [me] = rowsOf<{ pid: number }>(
        await other.db.execute(sql`select pg_backend_pid() as pid`),
      );
      await database.db.execute(sql`select pg_terminate_backend(${me?.pid ?? 0})`);
      await vi.waitFor(() => expect(errors).toHaveBeenCalled(), { timeout: 5_000 });
      expect(errors.mock.calls.flat().join(' ')).toMatch(/57P01/);
      expect(errors.mock.calls.flat().join(' ')).not.toMatch(/ufreal|password|terminat/i);
      const [row] = rowsOf<{ one: number }>(await other.db.execute(sql`select 1 as one`));
      expect(row?.one).toBe(1);
    } finally {
      errors.mockRestore();
      await other.close();
    }
  });

  it('holds a minor’s data behind consent, in the database itself', async () => {
    const { store } = testStore(database);
    const { studentId } = await signIn(store, syntheticPhone());
    await store.setDateOfBirth(studentId, '2010-01-01');
    await expect(store.forStudent(studentId).profile()).rejects.toThrow(ConsentRequiredError);
  });

  it('lets only the budget through when sends race on separate connections', async () => {
    const { store } = testStore(database);
    const name = `sms-race-${Date.now()}`;
    const windows = [{ limit: 3, windowMs: 60 * 60 * 1000 }];
    const results = await Promise.all(
      Array.from({ length: 12 }, () => store.takeBudget(name, windows)),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(3);
  });

  it('charges racing multi-segment sends by units, never past the limit (A1-14)', async () => {
    const { store } = testStore(database);
    const name = `sms-race-units-${Date.now()}`;
    const windows = [{ limit: 10, windowMs: 60 * 60 * 1000 }];
    const results = await Promise.all(
      Array.from({ length: 12 }, () => store.takeBudget(name, windows, 3)),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(3);
    expect((await store.peekBudget(name, windows)).used).toEqual([9]);
  });

  it('takes back a PIN whose SMS failed, and lets the number ask again (A1-11)', async () => {
    const { store } = testStore(database);
    const phone = syntheticPhone();
    const failed = await store.requestOtp(phone);
    expect(await store.withdrawOtp(failed)).toBe('refunded');
    await expect(store.verifyOtp(phone, smsCode(failed))).rejects.toThrow(/expired/);
    const again = await store.requestOtp(phone);
    await expect(store.verifyOtp(phone, smsCode(again))).resolves.toBeTruthy();
  });

  it('keeps one student’s rows from another', async () => {
    const { store } = testStore(database);
    const a = await adultStudent(store);
    const b = await adultStudent(store);
    await store.forStudent(b.studentId).updateProfile({ goal: 'medicine' });
    const seen = await database.db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('uf.student_id', ${a.studentId}, true)`);
      await tx.execute(sql`set local role uf_app`);
      return rowsOf<{ n: number }>(await tx.execute(sql`select count(*)::int as n from profiles`));
    });
    expect(seen[0]?.n).toBe(0);
  });

  it('lets one message through when claims for one learner race on separate connections', async () => {
    const { store } = testStore(database);
    const { studentId } = await adultStudent(store);
    const student = store.forStudent(studentId);
    await student.setChannelOptIn('sms', true);
    const at = new Date('2026-10-13T08:00:00Z');
    const ids = await Promise.all(
      Array.from({ length: 8 }, () =>
        student.createReminder({ templateId: 'reminder.check-in', channel: 'sms', desiredAt: at }),
      ),
    );
    const messaging = store.messaging();
    const outcomes = await Promise.all(
      ids.map((id) =>
        messaging.claimSend(id, at, ({ recentSends }) =>
          nextAllowedSend({ now: at, maxPerWeek: 7, recentSends, papers: [] }),
        ),
      ),
    );
    expect(outcomes.filter((o) => o.kind === 'send')).toHaveLength(1);
    expect(outcomes.filter((o) => o.kind === 'wait')).toHaveLength(7);
  });

  it('purges the learner’s jobs with the account', async () => {
    const { store } = testStore(database);
    const { studentId } = await adultStudent(store);
    const student = store.forStudent(studentId);
    const id = await student.createReminder({
      templateId: 'reminder.check-in',
      channel: 'sms',
      desiredAt: new Date(),
    });
    const scheduler = new PostgresJobScheduler(database);
    const jobId = await scheduleReminderJob(scheduler, id, new Date(Date.now() + 60_000), 0);
    await student.deleteAccount();
    expect(await scheduler.get(jobId)).toBeNull();
  });

  it('keeps re-checks behind RLS, ids only, and between the learner’s own reports (0007)', async () => {
    const { store } = testStore(database);
    const counts = {
      qualifyNow: { before: 0, after: 1 },
      onTrack: { before: 0, after: 0 },
      close: { before: 1, after: 0 },
      planB: { before: 0, after: 0 },
    };
    const twoReports = async () => {
      const { studentId } = await adultStudent(store);
      const student = store.forStudent(studentId);
      const marks = [{ subject: 'mathematics', percent: 60 }];
      const previous = await student.saveConfirmedReport({ kind: 'grade-11-final', marks });
      const latest = await student.saveConfirmedReport({ kind: 'grade-12-june', marks });
      return { studentId, student, previous, latest };
    };
    const a = await twoReports();
    const b = await twoReports();
    const move = {
      programmeId: 'uj-bcom-accounting',
      from: 'close',
      to: 'qualify-now',
      direction: 'up',
    } as const;
    await a.student.saveRecheck({
      reportId: a.latest,
      previousReportId: a.previous,
      moves: [move],
      counts,
      includesDrafts: false,
    });
    expect((await a.student.latestRecheck())?.moves).toEqual([move]);
    expect(await b.student.latestRecheck()).toBeNull();
    await expect(
      a.student.saveRecheck({
        reportId: a.latest,
        previousReportId: b.previous,
        moves: [],
        counts,
        includesDrafts: false,
      }),
    ).rejects.toThrow();
    await expect(
      database.exec(`insert into rechecks (student_id, report_id, previous_report_id, moves, counts, includes_drafts, created_at)
        values ('${b.studentId}', '${b.latest}', '${b.previous}', '[{"programmeId":"x","from":"close","to":"close","direction":"up","name":"leak"}]', '{}', false, now())`),
    ).rejects.toThrow();
  });

  it('keeps push tokens behind RLS and consent, one learner per token, gone at sign-out (0008)', async () => {
    const { store } = testStore(database);
    const token = `ExponentPushToken[pg${String(Date.now()).slice(-12)}]`;
    const a = await adultStudent(store);
    const b = await adultStudent(store);
    await store.forStudent(a.studentId).registerPushToken({
      token,
      platform: 'ios',
      sessionToken: a.token,
    });
    // b can't see it as themselves.
    const seen = await database.db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('uf.student_id', ${b.studentId}, true)`);
      await tx.execute(sql`set local role uf_app`);
      return rowsOf<{ n: number }>(
        await tx.execute(sql`select count(*)::int as n from push_tokens`),
      );
    });
    expect(seen[0]?.n).toBe(0);
    // b can't take it while a is signed in on it (A5-05); once a signs out, it moves.
    await expect(
      store.forStudent(b.studentId).registerPushToken({
        token,
        platform: 'ios',
        sessionToken: b.token,
      }),
    ).rejects.toThrow(InvalidStateError);
    await store.signOut(a.token);
    await store.forStudent(b.studentId).registerPushToken({
      token,
      platform: 'ios',
      sessionToken: b.token,
    });
    const owner = async () =>
      rowsOf<{ student_id: string }>(
        await database.db.execute(sql`select student_id from push_tokens where token = ${token}`),
      ).map((r) => r.student_id);
    expect(await owner()).toEqual([b.studentId]);
    // A minor without consent gets nothing written, and sign-out takes the token away.
    const minor = await signIn(store, syntheticPhone());
    await store.setDateOfBirth(minor.studentId, '2011-01-01');
    await expect(
      store.forStudent(minor.studentId).registerPushToken({
        token: `ExponentPushToken[pgminor${String(Date.now()).slice(-8)}]`,
        platform: 'android',
        sessionToken: minor.token,
      }),
    ).rejects.toThrow(ConsentRequiredError);
    await store.signOut(b.token);
    expect(await owner()).toEqual([]);
  });

  it('keeps offers behind RLS, one accepted per learner even when accepts race (0018)', async () => {
    const { store, advance } = testStore(database);
    const a = store.forStudent((await adultStudent(store)).studentId);
    const b = store.forStudent((await adultStudent(store)).studentId);
    const offer = {
      universityId: 'uj',
      programmeId: 'uj-beng-civil',
      kind: 'provisional',
      replyBy: null,
      conditions: [],
    } as const;
    const first = await a.addOffer(offer);
    advance(1000);
    const second = await a.addOffer({
      ...offer,
      universityId: 'wits',
      programmeId: 'wits-bsc-computer-science',
    });
    expect(await b.offers()).toEqual([]);
    // Separate connections: the advisory lock, and behind it the unique index.
    const raced = await Promise.allSettled([a.acceptOffer(first), a.acceptOffer(second)]);
    expect(raced.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await a.offers()).filter((o) => o.status === 'accepted')).toHaveLength(1);
  });

  it('never leaves a registration-day reminder waiting when a decline races it (0023, A1-33)', async () => {
    const { store } = testStore(database);
    const a = store.forStudent((await adultStudent(store)).studentId);
    const b = store.forStudent((await adultStudent(store)).studentId);
    const id = await a.addOffer({
      universityId: 'up',
      programmeId: 'up-beng-civil',
      kind: 'final',
      replyBy: null,
      conditions: [],
    });
    await a.acceptOffer(id);
    const reminderId = await a.createReminder({
      templateId: 'offer.registration-day',
      channel: 'sms',
      desiredAt: new Date('2027-01-27T16:00:00Z'),
      params: { universityId: 'up' },
    });
    // Separate connections, either order: the offers lock decides, and the reminder is dropped.
    await Promise.all([a.setOfferRegistrationReminder(id, reminderId), a.declineOffer(id)]);
    expect((await a.reminders()).find((r) => r.id === reminderId)?.status).toBe('dropped');
    expect(await b.offers()).toEqual([]);
  });

  it('keeps first-week steps behind RLS and consent, ids only (0019)', async () => {
    const { store } = testStore(database);
    const a = store.forStudent((await adultStudent(store)).studentId);
    const b = store.forStudent((await adultStudent(store)).studentId);
    await a.setFirstWeekStep('wits', 'register', true);
    expect((await a.firstWeekSteps('wits')).map((s) => s.step)).toEqual(['register']);
    expect(await b.firstWeekSteps('wits')).toEqual([]);
    await expect(a.setFirstWeekStep('wits', 'not-a-step', true)).rejects.toThrow(InvalidStateError);
    const { studentId } = await signIn(store, syntheticPhone());
    await store.setDateOfBirth(studentId, '2010-03-03');
    await expect(
      store.forStudent(studentId).setFirstWeekStep('wits', 'register', true),
    ).rejects.toThrow(ConsentRequiredError);
  });

  it('keeps registrations behind RLS, one per year even when confirms race (0020)', async () => {
    const { store } = testStore(database);
    const a = store.forStudent((await adultStudent(store)).studentId);
    const b = store.forStudent((await adultStudent(store)).studentId);
    const registration = {
      universityId: 'up',
      programmeId: 'up-bsc-test',
      academicYear: 2027,
      yearOfStudy: 1,
      modules: [{ code: 'TEST101', name: null, term: 'S1', credits: 16 }],
    };
    // Separate connections: the advisory lock, and behind it the unique (learner, year).
    const raced = await Promise.allSettled([
      a.saveRegistration(registration),
      a.saveRegistration(registration),
    ]);
    expect(raced.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    const ids = raced.flatMap((r) => (r.status === 'fulfilled' ? [r.value.id] : []));
    expect(new Set(ids).size).toBe(1);
    expect(await b.registration()).toBeNull();
    expect((await a.registration())?.modules).toEqual(registration.modules);
  });

  it('keeps a photo only under consent wording that names it, and deletes it at withdrawal (0037, A11-31)', async () => {
    const { store } = testStore(database);
    // Unique per run (the database outlives it), synthetic, the shape the app makes.
    const stamp = Date.now().toString(16).padStart(28, '0');
    const key = (n: number) => `photo-${stamp}${n.toString(16).padStart(4, '0')}`;
    const rawSet = (studentId: string, value: string, preview: boolean) =>
      database.db.transaction(async (tx) => {
        if (preview) await tx.execute(sql`select set_config('uf.profile_photo', 'preview', true)`);
        await tx.execute(
          sql`insert into profiles (student_id, photo_key) values (${studentId}::uuid, ${value})
              on conflict (student_id) do update set photo_key = ${value}`,
        );
      });

    // adult-v2 (live today): refused by the store and by the database, even as its owner.
    const older = (await adultStudent(store)).studentId;
    await expect(store.forStudent(older).setPhoto(key(1))).rejects.toThrow(PhotoConsentError);
    // The driver wraps the database's refusal ("Failed query: …"); its cause says why.
    const refused = await rawSet(older, key(2), false).then(
      () => null,
      (error: Error & { cause?: Error }) => `${error.message} ${error.cause?.message ?? ''}`,
    );
    expect(refused).toMatch(/consent does not name the profile photo/);
    // The preview's stand-in, for its own transaction only.
    await rawSet(older, key(3), true);
    expect(await store.forStudent(older).photoKey()).toBeNull(); // never served without it
    expect(await store.forStudent(older).removePhoto()).toBe(key(3));

    // adult-v3: kept and served.
    const { studentId: named } = await signIn(store, syntheticPhone());
    await store.setDateOfBirth(named, '2000-01-15');
    await store.consentAsAdult(named, 'adult-v3-test');
    await store.forStudent(named).setPhoto(key(4));
    expect(await store.forStudent(named).photoKey()).toBe(key(4));

    // A minor under guardian v4: withdrawal deletes it and hands back the key.
    const { studentId: minor } = await signIn(store, syntheticPhone());
    await store.setDateOfBirth(minor, '2010-03-03');
    const { token } = await store.requestGuardianConsent(
      minor,
      { name: 'Test Guardian', phone: syntheticPhone(), relationship: 'parent' },
      'v4-test',
    );
    await store.grantConsent(token);
    await store.forStudent(minor).setPhoto(key(5));
    expect((await store.withdrawConsent(token)).fileKeys).toEqual([key(5)]);
    const [row] = rowsOf<{ photo_key: string | null }>(
      await database.db.execute(
        sql`select photo_key from profiles where student_id = ${minor}::uuid`,
      ),
    );
    expect(row?.photo_key).toBeNull();
  });

  // Racing runners on separate connections, for real: skip locked, not a single-connection queue.
  describe('the job scheduler contract', () => {
    jobSchedulerContract(() => postgresJobHarness(database)());
  });
});
