import { randomInt } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Database, rowsOf } from './client';
import { RateLimitedError } from './errors';
import { InvalidPhoneError, isTollFreeNumber, normaliseTollFree } from './phone';
import { DEMO_OTP_PER_IP_PER_HOUR, DEMO_STUDENT_TTL_MS, OTP_PER_IP_PER_HOUR, Store } from './store';
import { syntheticPhone, TEST_SECRET, testDatabase } from './testing';

/**
 * The judge demo's on-screen phone sign-up (a hackathon exception, 2026-10-24,
 * docs/deploy/demo.md): judges sign up with made-up South African toll-free numbers (080…), never
 * a cellphone. Only a store built for a demo accepts such a number; an ordinary store (production,
 * staging, local) still takes cellphone numbers only. The account is a demo learner like the
 * made-up learners' copies: its session ends, and the sweep deletes it, 24 hours after it was made.
 */

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(async () => {
  await database.close();
});

const START = new Date('2026-10-24T08:00:00Z');

function stores(start = START) {
  let now = start;
  const clock = () => now;
  return {
    demo: new Store(database, { secret: TEST_SECRET, clock, demo: true }),
    ordinary: new Store(database, { secret: TEST_SECRET, clock }),
    advance(ms: number) {
      now = new Date(now.getTime() + ms);
    },
  };
}

/** A made-up toll-free number, built at runtime (hard rule 4), random so real-Postgres reruns differ. */
function tollFree(): string {
  return `080${String(randomInt(0, 10_000_000)).padStart(7, '0')}`;
}

async function studentExists(id: string): Promise<boolean> {
  const [row] = rowsOf<{ n: number }>(
    await database.db.execute(sql`select count(*)::int as n from students where id = ${id}::uuid`),
  );
  return Number(row?.n) === 1;
}

async function signUpByPhone(store: Store, phone: string) {
  const challenge = await store.requestOtp(phone);
  if (challenge.review) throw new Error('no review number on a demo');
  return store.verifyOtp(phone, challenge.code);
}

describe('PIN requests per address (the owner’s hackathon exception, 2026-10-24)', () => {
  /** Its own address key per test, so real-Postgres reruns don't share a count. */
  const address = () => `test-address-${randomInt(0, 1_000_000_000)}`;

  async function count(store: Store, ip: string, n: number): Promise<number> {
    let allowed = 0;
    for (let i = 0; i < n; i++) {
      try {
        await store.requestOtp(tollFree(), { ip });
        allowed += 1;
      } catch (error) {
        if (!(error instanceof RateLimitedError)) throw error;
      }
    }
    return allowed;
  }

  it('the on-screen sign-up’s demo store allows 100 an hour from one address, then refuses', async () => {
    let now = START;
    const store = new Store(database, {
      secret: TEST_SECRET,
      clock: () => now,
      demo: true,
      demoPhoneSignup: true,
    });
    const ip = address();
    expect(DEMO_OTP_PER_IP_PER_HOUR).toBe(100);
    expect(await count(store, ip, 100)).toBe(100);
    expect(await count(store, ip, 1)).toBe(0);
    now = new Date(now.getTime() + 60 * 60 * 1000 + 1);
    expect(await count(store, ip, 1)).toBe(1);
  }, 120_000);

  it('every other store keeps 10 an hour: a demo without the sign-up, and an ordinary one', async () => {
    const s = stores();
    const ip = address();
    expect(OTP_PER_IP_PER_HOUR).toBe(10);
    expect(await count(s.demo, ip, 11)).toBe(10);
    const cell = address();
    let allowed = 0;
    for (let i = 0; i < 11; i++) {
      try {
        await s.ordinary.requestOtp(syntheticPhone(), { ip: cell });
        allowed += 1;
      } catch (error) {
        if (!(error instanceof RateLimitedError)) throw error;
      }
    }
    expect(allowed).toBe(10);
  });

  it('only a demo store may take the higher limit', () => {
    expect(() => new Store(database, { secret: TEST_SECRET, demoPhoneSignup: true })).toThrow(
      /demo/,
    );
  });
});

describe('toll-free numbers', () => {
  it('normalises a toll-free number in its common forms, and refuses a cellphone number', () => {
    const local = tollFree();
    const e164 = `+27${local.slice(1)}`;
    expect(normaliseTollFree(local)).toBe(e164);
    expect(normaliseTollFree(`${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`)).toBe(
      e164,
    );
    expect(normaliseTollFree(e164)).toBe(e164);
    expect(isTollFreeNumber(local)).toBe(true);
    const cell = syntheticPhone();
    expect(isTollFreeNumber(cell)).toBe(false);
    expect(() => normaliseTollFree(cell)).toThrow(InvalidPhoneError);
    expect(isTollFreeNumber('0860 000 000')).toBe(false);
    expect(isTollFreeNumber('hello')).toBe(false);
  });
});

describe('a demo store signs up a toll-free number', () => {
  it('issues and checks its PIN, and makes the account', async () => {
    const s = stores();
    const phone = tollFree();
    const signed = await signUpByPhone(s.demo, phone);
    expect(signed.isNewStudent).toBe(true);
    expect(await s.demo.sessionStudent(signed.token)).toBe(signed.studentId);
    // The same number signs in to the same account (within its 24 hours; past the PIN cooldown).
    s.advance(5 * 60 * 1000);
    const again = await signUpByPhone(s.demo, phone);
    expect(again.studentId).toBe(signed.studentId);
    expect(again.isNewStudent).toBe(false);
  });

  it('says whether a toll-free number already has an account (demo stores only)', async () => {
    const s = stores();
    const phone = tollFree();
    expect(await s.demo.demoPhoneHasAccount(phone)).toBe(false);
    await signUpByPhone(s.demo, phone);
    expect(await s.demo.demoPhoneHasAccount(phone)).toBe(true);
    // Any common form of the same number.
    expect(await s.demo.demoPhoneHasAccount(`+27${phone.slice(1)}`)).toBe(true);
    await expect(s.ordinary.demoPhoneHasAccount(phone)).rejects.toThrow(/demo/);
  });

  it('an ordinary store refuses a toll-free number, for sign-in and for a guardian', async () => {
    const s = stores();
    await expect(s.ordinary.requestOtp(tollFree())).rejects.toThrow(InvalidPhoneError);
    await expect(s.ordinary.verifyOtp(tollFree(), '123456')).rejects.toThrow(InvalidPhoneError);
    const minor = await signUpByPhone(s.ordinary, syntheticPhone());
    await s.ordinary.setDateOfBirth(minor.studentId, '2011-05-05');
    await expect(
      s.ordinary.requestGuardianConsent(
        minor.studentId,
        { name: 'Made-up Guardian', phone: tollFree(), relationship: 'parent' },
        'v1',
      ),
    ).rejects.toThrow(InvalidPhoneError);
  });

  it('a demo store still takes cellphone numbers (the made-up learners’ copies use them)', async () => {
    const s = stores();
    const signed = await signUpByPhone(s.demo, syntheticPhone());
    expect(signed.isNewStudent).toBe(true);
  });

  it('its session ends 24 hours after the account was made, even when signed in again later', async () => {
    const s = stores();
    const phone = tollFree();
    const first = await signUpByPhone(s.demo, phone);
    s.advance(20 * 60 * 60 * 1000);
    const later = await signUpByPhone(s.demo, phone);
    expect(await s.demo.sessionStudent(later.token)).toBe(first.studentId);
    s.advance(4 * 60 * 60 * 1000 + 1);
    expect(await s.demo.sessionStudent(first.token)).toBeNull();
    expect(await s.demo.sessionStudent(later.token)).toBeNull();
  });

  it('the demo sweep deletes the account 24 hours after it was made', async () => {
    const s = stores();
    const signed = await signUpByPhone(s.demo, tollFree());
    s.advance(DEMO_STUDENT_TTL_MS - 60_000);
    await s.demo.sweepDemoStudents();
    expect(await studentExists(signed.studentId)).toBe(true);
    s.advance(60_001);
    await s.demo.sweepDemoStudents();
    expect(await studentExists(signed.studentId)).toBe(false);
  });

  it('a minor’s data waits for the made-up guardian, asked on a toll-free number (hard rule 5)', async () => {
    const s = stores();
    const minor = await signUpByPhone(s.demo, tollFree());
    expect(await s.demo.setDateOfBirth(minor.studentId, '2011-05-05')).toBe('pending');
    expect(await s.demo.forStudent(minor.studentId).mayProcess()).toBe(false);
    const { token, guardianPhone } = await s.demo.requestGuardianConsent(
      minor.studentId,
      { name: 'Made-up Guardian', phone: tollFree(), relationship: 'parent' },
      'v1',
    );
    expect(isTollFreeNumber(guardianPhone)).toBe(true);
    expect(await s.demo.forStudent(minor.studentId).mayProcess()).toBe(false);
    await s.demo.grantConsent(token);
    expect(await s.demo.forStudent(minor.studentId).mayProcess()).toBe(true);
  });
});
