import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Database, rowsOf } from './client';
import { AdultsOnlyError, TooYoungError } from './errors';
import { DEMO_SIGNUP_TTL_MS, DEMO_STUDENT_TTL_MS, SESSION_TTL_MS, Store } from './store';
import { adultStudent, signIn, TEST_SECRET, testDatabase } from './testing';

/**
 * The judge demo's real sign-up (a HACKATHON EXCEPTION the owner approved on 2026-10-23,
 * docs/deploy/demo.md): an adult judge signs in with Firebase (email link or Google), and the
 * server, having verified the ID token, finds or creates their UniversityFlow account. Only the
 * Firebase uid and the email are kept; the account is adults only and is deleted 30 days after it
 * was made, with everything in it. Demo stores only. Synthetic uids and example.com addresses.
 */

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(async () => {
  await database.close();
});

const START = new Date('2026-10-23T08:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
let n = 0;
const identity = () => {
  n += 1;
  return { uid: `test-uid-${n}-${Date.now()}`, email: `judge-${n}@example.com` };
};

function stores(start = START) {
  let now = start;
  const clock = () => now;
  return {
    demo: new Store(database, { secret: TEST_SECRET, clock, demo: true }),
    ordinary: new Store(database, { secret: TEST_SECRET, clock }),
    advance(ms: number) {
      now = new Date(now.getTime() + ms);
    },
    now: () => now,
  };
}

async function studentExists(id: string): Promise<boolean> {
  const [row] = rowsOf<{ n: number }>(
    await database.db.execute(sql`select count(*)::int as n from students where id = ${id}::uuid`),
  );
  return Number(row?.n) === 1;
}

async function signupRows(id: string) {
  return rowsOf<{ firebase_uid: string; email: string }>(
    await database.db.execute(
      sql`select firebase_uid, email from demo_signups where student_id = ${id}::uuid`,
    ),
  );
}

/** Sets a row's created_at outright: it is the database's own time. */
async function age(id: string, msAgo: number, from = START) {
  const at = new Date(from.getTime() - msAgo).toISOString();
  await database.db.execute(
    sql`update students set created_at = ${at}::timestamptz where id = ${id}::uuid`,
  );
  await database.db.execute(
    sql`update demo_signups set created_at = ${at}::timestamptz where student_id = ${id}::uuid`,
  );
}

describe('signing in with a verified Firebase identity', () => {
  it('creates an account on first sign-in, keeping only the uid and the email', async () => {
    const s = stores();
    const who = identity();
    const signed = await s.demo.signInDemoSignup(who);
    expect(signed.isNewStudent).toBe(true);
    expect(await s.demo.sessionStudent(signed.token)).toBe(signed.studentId);
    expect(await signupRows(signed.studentId)).toEqual([
      { firebase_uid: who.uid, email: who.email },
    ]);
    expect(await s.demo.isDemoSignup(signed.studentId)).toBe(true);
    // A new account starts at the first onboarding question, like any other.
    const account = await s.demo.account(signed.studentId);
    expect(account.consentStatus).toBe('unknown');
    expect(account.dateOfBirth).toBeNull();
  });

  it('finds the same account again for the same uid, and keeps the email current', async () => {
    const s = stores();
    const who = identity();
    const first = await s.demo.signInDemoSignup(who);
    const again = await s.demo.signInDemoSignup({ uid: who.uid, email: 'renamed@example.com' });
    expect(again.isNewStudent).toBe(false);
    expect(again.studentId).toBe(first.studentId);
    expect(again.token).not.toBe(first.token);
    expect(await signupRows(first.studentId)).toEqual([
      { firebase_uid: who.uid, email: 'renamed@example.com' },
    ]);
  });

  it('gives different people different accounts', async () => {
    const s = stores();
    const a = await s.demo.signInDemoSignup(identity());
    const b = await s.demo.signInDemoSignup(identity());
    expect(a.studentId).not.toBe(b.studentId);
  });

  it('a session never outlives the account: it ends 30 days after the account was made', async () => {
    const s = stores();
    const who = identity();
    const first = await s.demo.signInDemoSignup(who);
    s.advance(29 * DAY);
    const later = await s.demo.signInDemoSignup(who);
    expect(SESSION_TTL_MS).toBeGreaterThan(DAY);
    s.advance(DAY + 1);
    expect(await s.demo.sessionStudent(first.token)).toBeNull();
    expect(await s.demo.sessionStudent(later.token)).toBeNull();
  });

  it('refuses an identity without a uid or an email', async () => {
    const s = stores();
    await expect(s.demo.signInDemoSignup({ uid: '', email: 'x@example.com' })).rejects.toThrow();
    await expect(s.demo.signInDemoSignup({ uid: 'some-uid', email: 'nope' })).rejects.toThrow();
  });

  it('an ordinary store refuses: only a demo deployment has this sign-up', async () => {
    const s = stores();
    await expect(s.ordinary.signInDemoSignup(identity())).rejects.toThrow(/demo/);
    await expect(s.ordinary.sweepDemoSignups()).rejects.toThrow(/demo/);
  });
});

describe('adults only', () => {
  it('a sign-up account aged 13 to 17 is refused, and nothing is recorded', async () => {
    const s = stores();
    const { studentId } = await s.demo.signInDemoSignup(identity());
    await expect(s.demo.setDateOfBirth(studentId, '2010-01-01')).rejects.toBeInstanceOf(
      AdultsOnlyError,
    );
    const account = await s.demo.account(studentId);
    expect(account.dateOfBirth).toBeNull();
    expect(account.consentStatus).toBe('unknown');
  });

  it('under 13 keeps its own refusal', async () => {
    const s = stores();
    const { studentId } = await s.demo.signInDemoSignup(identity());
    await expect(s.demo.setDateOfBirth(studentId, '2016-01-01')).rejects.toBeInstanceOf(
      TooYoungError,
    );
  });

  it('an adult goes on to agree in their own name', async () => {
    const s = stores();
    const { studentId } = await s.demo.signInDemoSignup(identity());
    expect(await s.demo.setDateOfBirth(studentId, '1990-05-05')).toBe('not-required');
    expect((await s.demo.account(studentId)).needsAdultConsent).toBe(true);
  });

  it('the made-up learners are not sign-ups: a minor persona still gets its date of birth', async () => {
    const s = stores();
    const { studentId } = await signIn(s.ordinary);
    expect(await s.demo.isDemoSignup(studentId)).toBe(false);
    expect(await s.demo.setDateOfBirth(studentId, '2010-01-01')).toBe('pending');
  });
});

describe('deleted 30 days after it was made', () => {
  it('the sign-up sweep deletes accounts older than 30 days, with everything in them', async () => {
    const s = stores();
    const old = await s.demo.signInDemoSignup(identity());
    await s.demo.setDateOfBirth(old.studentId, '1990-05-05');
    await s.demo.consentAsAdult(old.studentId, 'adult-v2-test');
    await s.demo.forStudent(old.studentId).addDocument({
      kind: 'grade-11-report',
      storageKey: 'signup-old-key',
      mimeType: 'application/pdf',
      sizeBytes: 10,
    });
    const young = await s.demo.signInDemoSignup(identity());
    await age(old.studentId, DEMO_SIGNUP_TTL_MS + 1000);
    await age(young.studentId, DEMO_SIGNUP_TTL_MS - DAY);
    const swept = await s.demo.sweepDemoSignups();
    expect(swept.students).toBeGreaterThanOrEqual(1);
    expect(swept.fileKeys).toContain('signup-old-key');
    expect(await studentExists(old.studentId)).toBe(false);
    expect(await signupRows(old.studentId)).toEqual([]);
    expect(await studentExists(young.studentId)).toBe(true);
  });

  it('the 24-hour sweep of the made-up learners leaves sign-ups alone', async () => {
    const s = stores();
    const signup = await s.demo.signInDemoSignup(identity());
    const copy = await adultStudent(s.ordinary);
    await age(signup.studentId, DEMO_STUDENT_TTL_MS + 1000);
    await age(copy.studentId, DEMO_STUDENT_TTL_MS + 1000);
    await s.demo.sweepDemoStudents();
    expect(await studentExists(signup.studentId)).toBe(true);
    expect(await studentExists(copy.studentId)).toBe(false);
  });

  it('is 30 days', () => {
    expect(DEMO_SIGNUP_TTL_MS).toBe(30 * DAY);
  });
});
