import { REPORT_KINDS } from '@universityflow/catalogue';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ageOn, eighteenthBirthdaySoon, sastDate } from './age';
import type { Database } from './client';
import { migrate, rowsOf } from './client';
import { hashToken } from './crypto';
import {
  ConsentRequiredError,
  InvalidCodeError,
  InvalidStateError,
  NotFoundError,
  PinLockedError,
  RateLimitedError,
  TooYoungError,
} from './errors';
import { InvalidPhoneError, maskPhone, normalisePhone } from './phone';
import type { ReportKind } from './schema';
import {
  OTP_MAX_ATTEMPTS,
  OTP_MAX_PER_WINDOW,
  OTP_MAX_WRONG_PINS,
  OTP_PER_IP_PER_HOUR,
  OTP_REFUNDS_PER_HOUR,
  OTP_TTL_MS,
  SESSION_TTL_MS,
} from './store';
import { adultStudent, signIn, smsCode, syntheticPhone, testDatabase, testStore } from './testing';

let database: Database;
let h: ReturnType<typeof testStore>;

beforeAll(async () => {
  database = await testDatabase();
});
afterAll(async () => {
  await database.close();
});
beforeEach(() => {
  h = testStore(database);
});

/** The database's own error message (drizzle wraps it as `cause`). */
async function dbError(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    const cause = (error as { cause?: { message?: string } }).cause;
    return cause?.message ?? (error as Error).message;
  }
  throw new Error('expected the database to refuse');
}

/** Runs raw SQL as `uf_app` for a given student: what the database itself allows. */
async function asStudent<T>(studentId: string, query: ReturnType<typeof sql>): Promise<T[]> {
  return h.database.db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('uf.student_id', ${studentId}, true)`);
    await tx.execute(sql`set local role uf_app`);
    return rowsOf<T>(await tx.execute(query));
  });
}

describe('migrations', () => {
  it('are idempotent', async () => {
    expect(await migrate(h.database)).toEqual([]);
  });
});

describe('phone numbers', () => {
  it('normalises every common way of writing a cellphone number', () => {
    const e164 = syntheticPhone(1234567);
    const national = `0${e164.slice(3)}`;
    expect(normalisePhone(national)).toBe(e164);
    expect(
      normalisePhone(`${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`),
    ).toBe(e164);
    expect(normalisePhone(e164.slice(1))).toBe(e164);
  });

  it('refuses landlines and nonsense', () => {
    expect(() => normalisePhone('011 555 0000')).toThrow(InvalidPhoneError);
    expect(() => normalisePhone('hello')).toThrow(InvalidPhoneError);
  });

  it('masks a number down to its last three digits', () => {
    expect(maskPhone(syntheticPhone(42))).toBe('•••• ••• 042');
  });
});

describe('sign-in with a one-time PIN', () => {
  it('creates the account on first sign-in and reuses it after', async () => {
    const phone = syntheticPhone(1);
    const first = await signIn(h.store, phone);
    expect(first.isNewStudent).toBe(true);
    h.advance(61 * 1000); // one PIN a minute per number
    const second = await signIn(h.store, `0${phone.slice(3)}`);
    expect(second.isNewStudent).toBe(false);
    expect(second.studentId).toBe(first.studentId);
  });

  it('stores the PIN only as a keyed hash', async () => {
    const code = smsCode(await h.store.requestOtp(syntheticPhone(2)));
    const rows = rowsOf<{ code_hash: string }>(
      await h.database.db.execute(sql`select code_hash from otp_challenges`),
    );
    expect(rows[0]?.code_hash).not.toContain(code);
    expect(rows[0]?.code_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses a wrong PIN and locks the challenge after five attempts', async () => {
    const phone = syntheticPhone(3);
    const code = smsCode(await h.store.requestOtp(phone));
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
      await expect(h.store.verifyOtp(phone, wrong)).rejects.toThrow(InvalidCodeError);
    }
    await expect(h.store.verifyOtp(phone, code)).rejects.toThrow(/expired/);
  });

  /** Wrong PINs at a number, `count` of them, across as many PINs as that takes (A5-09). */
  async function wrongPins(phone: string, count: number) {
    const wrongFor = (code: string) => (code === '000000' ? '111111' : '000000');
    let failures = 0;
    while (failures < count) {
      const code = smsCode(await h.store.requestOtp(phone));
      for (let i = 0; i < OTP_MAX_ATTEMPTS && failures < count; i++, failures++) {
        await expect(h.store.verifyOtp(phone, wrongFor(code))).rejects.toThrow(InvalidCodeError);
      }
      h.advance(5 * 60 * 1000 + 1); // within the three-PINs-in-fifteen-minutes limit
    }
  }

  it('A5-09: counts wrong PINs per number across new PINs; past the limit even the right one is refused, and no new PIN is sent', async () => {
    // NIST SP 800-63B rev 4: a new secret must not reset the failed-attempt count, and at most
    // 100 consecutive failures. Before, each new PIN gave five fresh guesses: ~1,440 a day.
    const phone = syntheticPhone(7101);
    await wrongPins(phone, OTP_MAX_WRONG_PINS - 1);
    const last = smsCode(await h.store.requestOtp(phone));
    const wrong = last === '000000' ? '111111' : '000000';
    await expect(h.store.verifyOtp(phone, wrong)).rejects.toThrow(InvalidCodeError);
    // Locked: the right PIN is refused, and no PIN is issued (nothing paid for that can't work).
    await expect(h.store.verifyOtp(phone, last)).rejects.toThrow(PinLockedError);
    h.advance(5 * 60 * 1000 + 1);
    await expect(h.store.requestOtp(phone)).rejects.toThrow(PinLockedError);
    // The number is never stored, only a keyed hash (rule 4).
    const keys = rowsOf<{ key_hash: string }>(
      await h.database.db.execute(
        sql`select key_hash from rate_events where action = 'otp-wrong-pin' limit 1`,
      ),
    );
    expect(keys[0]?.key_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(keys[0]?.key_hash).not.toContain(phone.slice(3));
    // A day after the last wrong PIN, the number signs in again.
    h.advance(24 * 60 * 60 * 1000);
    const fresh = smsCode(await h.store.requestOtp(phone));
    await expect(h.store.verifyOtp(phone, fresh)).resolves.toMatchObject({ review: false });
  });

  it('A5-09 (A1-36): the owner signing in starts the count again, so the limit is of wrong PINs in a row', async () => {
    const phone = syntheticPhone(7104);
    await wrongPins(phone, OTP_MAX_WRONG_PINS - 1);
    const right = smsCode(await h.store.requestOtp(phone));
    await expect(h.store.verifyOtp(phone, right)).resolves.toBeTruthy();
    h.advance(5 * 60 * 1000 + 1);
    // A whole new run of wrong PINs is allowed before the next lock.
    await wrongPins(phone, OTP_MAX_WRONG_PINS - 1);
    const again = smsCode(await h.store.requestOtp(phone));
    await expect(h.store.verifyOtp(phone, again)).resolves.toBeTruthy();
  });

  it('A5-09 (A1-42): a number locked by its wrong PINs never locks another', async () => {
    const victim = syntheticPhone(7102);
    const other = syntheticPhone(7103);
    await wrongPins(other, OTP_MAX_WRONG_PINS);
    await expect(h.store.requestOtp(other)).rejects.toThrow(PinLockedError);
    const mine = smsCode(await h.store.requestOtp(victim));
    await expect(h.store.verifyOtp(victim, mine)).resolves.toBeTruthy();
  });

  it('refuses an expired PIN', async () => {
    const phone = syntheticPhone(4);
    const code = smsCode(await h.store.requestOtp(phone));
    h.advance(OTP_TTL_MS + 1);
    await expect(h.store.verifyOtp(phone, code)).rejects.toThrow(InvalidCodeError);
  });

  it('refuses a PIN that has already been used', async () => {
    const phone = syntheticPhone(5);
    const code = smsCode(await h.store.requestOtp(phone));
    await h.store.verifyOtp(phone, code);
    await expect(h.store.verifyOtp(phone, code)).rejects.toThrow(InvalidCodeError);
  });

  it('allows one PIN a minute and three per number in fifteen minutes', async () => {
    const phone = syntheticPhone(6);
    await h.store.requestOtp(phone);
    await expect(h.store.requestOtp(phone)).rejects.toThrow(RateLimitedError);
    h.advance(61 * 1000);
    await h.store.requestOtp(phone);
    h.advance(61 * 1000);
    await h.store.requestOtp(phone);
    h.advance(61 * 1000);
    await expect(h.store.requestOtp(phone)).rejects.toThrow(RateLimitedError);
    h.advance(15 * 60 * 1000 + 1);
    await expect(h.store.requestOtp(phone)).resolves.toBeTruthy();
  });

  it('caps PIN requests per IP address across many numbers (audit finding 4)', async () => {
    const ip = '203.0.113.7';
    for (let i = 0; i < 10; i++) await h.store.requestOtp(syntheticPhone(), { ip });
    await expect(h.store.requestOtp(syntheticPhone(), { ip })).rejects.toThrow(RateLimitedError);
    await expect(h.store.requestOtp(syntheticPhone(), { ip: '203.0.113.8' })).resolves.toBeTruthy();
  });

  it('counts parallel requests correctly (no race past the limit)', async () => {
    const phone = syntheticPhone();
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => h.store.requestOtp(phone)),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('keeps a general quota per key and action', async () => {
    const key = syntheticPhone();
    expect(await h.store.allow('test-action', key, 2, 60_000)).toBe(true);
    expect(await h.store.allow('test-action', key, 2, 60_000)).toBe(true);
    expect(await h.store.allow('test-action', key, 2, 60_000)).toBe(false);
    expect(await h.store.allow('other-action', key, 2, 60_000)).toBe(true);
    h.advance(60_001);
    expect(await h.store.allow('test-action', key, 2, 60_000)).toBe(true);
  });

  describe('a PIN whose SMS failed (A1-11)', () => {
    it('is no longer usable', async () => {
      const phone = syntheticPhone();
      const challenge = await h.store.requestOtp(phone);
      await h.store.withdrawOtp(challenge);
      await expect(h.store.verifyOtp(phone, smsCode(challenge))).rejects.toThrow(/expired/);
    });

    it("doesn't spend the number's allowance: the learner can ask again at once", async () => {
      const phone = syntheticPhone();
      for (let i = 0; i < OTP_MAX_PER_WINDOW; i++) {
        await h.store.withdrawOtp(await h.store.requestOtp(phone));
      }
      // Neither the one-a-minute nor the three-in-fifteen limit has been touched.
      const challenge = await h.store.requestOtp(phone);
      await expect(h.store.verifyOtp(phone, smsCode(challenge))).resolves.toBeTruthy();
    });

    it('still counts against the IP address, so failing sends never lift that cap', async () => {
      const ip = '203.0.113.9';
      for (let i = 0; i < OTP_PER_IP_PER_HOUR; i++) {
        await h.store.withdrawOtp(await h.store.requestOtp(syntheticPhone(), { ip }));
      }
      await expect(h.store.requestOtp(syntheticPhone(), { ip })).rejects.toThrow(RateLimitedError);
    });

    it('is refunded only a few times an hour per number; after that it counts as sent', async () => {
      const phone = syntheticPhone();
      for (let i = 0; i < OTP_REFUNDS_PER_HOUR; i++) {
        expect(await h.store.withdrawOtp(await h.store.requestOtp(phone))).toBe('refunded');
      }
      const late = await h.store.requestOtp(phone);
      expect(await h.store.withdrawOtp(late)).toBe('voided');
      // Voided, so the PIN is dead, but it still holds the one-a-minute limit.
      await expect(h.store.verifyOtp(phone, smsCode(late))).rejects.toThrow(/expired/);
      await expect(h.store.requestOtp(phone)).rejects.toThrow(RateLimitedError);
    });

    it('withdraws only that challenge, never a newer one or another number’s', async () => {
      const phone = syntheticPhone();
      const first = await h.store.requestOtp(phone);
      await h.store.withdrawOtp({ ...first, phone: syntheticPhone() });
      await expect(h.store.verifyOtp(phone, smsCode(first))).resolves.toBeTruthy();
    });
  });

  it('refuses a non-numeric PIN without comparing it', async () => {
    const phone = syntheticPhone(7);
    await h.store.requestOtp(phone);
    await expect(h.store.verifyOtp(phone, '12ab56')).rejects.toThrow(InvalidCodeError);
  });
});

describe('sessions', () => {
  it('resolves a token to its student, stores only its hash, and ends on sign-out', async () => {
    const { studentId, token } = await signIn(h.store, syntheticPhone(10));
    expect(await h.store.sessionStudent(token)).toBe(studentId);
    const rows = rowsOf<{ token_hash: string }>(
      await h.database.db.execute(
        sql`select token_hash from sessions where student_id = ${studentId}::uuid`,
      ),
    );
    expect(rows[0]?.token_hash).toBe(hashToken(token));
    await h.store.signOut(token);
    expect(await h.store.sessionStudent(token)).toBeNull();
  });

  it('expires after thirty days', async () => {
    const { token } = await signIn(h.store, syntheticPhone(11));
    h.advance(SESSION_TTL_MS + 1);
    expect(await h.store.sessionStudent(token)).toBeNull();
  });

  it('knows nothing of an unknown token', async () => {
    expect(await h.store.sessionStudent('not-a-token')).toBeNull();
  });
});

describe('date of birth and age', () => {
  it('counts age in South African calendar days', () => {
    expect(ageOn('2008-10-13', '2026-10-13')).toBe(18);
    expect(ageOn('2008-10-14', '2026-10-13')).toBe(17);
    // 23:30 UTC on the 12th is already the 13th in South Africa.
    expect(sastDate(new Date('2026-10-12T23:30:00Z'))).toBe('2026-10-13');
  });

  it('names the 18th birthday in the 30 days before it, and not otherwise (A11-25)', () => {
    expect(eighteenthBirthdaySoon('2008-11-08', '2026-10-19')).toBe('2026-11-08');
    expect(eighteenthBirthdaySoon('2008-11-18', '2026-10-19')).toBe('2026-11-18'); // 30 days
    expect(eighteenthBirthdaySoon('2008-11-19', '2026-10-19')).toBeNull(); // 31 days
    expect(eighteenthBirthdaySoon('2008-10-20', '2026-10-19')).toBe('2026-10-20'); // tomorrow
    expect(eighteenthBirthdaySoon('2008-10-19', '2026-10-19')).toBeNull(); // 18 today
    expect(eighteenthBirthdaySoon('2000-02-02', '2026-10-19')).toBeNull(); // an adult
    expect(eighteenthBirthdaySoon('2010-11-08', '2026-10-19')).toBeNull(); // 16
    // Born on 29 February: 18 on 1 March in a year without one, as ageOn counts it.
    expect(eighteenthBirthdaySoon('2008-02-29', '2026-02-10')).toBe('2026-03-01');
    expect(ageOn('2008-02-29', '2026-03-01')).toBe(18);
    expect(ageOn('2008-02-29', '2026-02-28')).toBe(17);
  });

  it('the database counts age exactly as the app does, 29 February included (A1-13)', async () => {
    const cases: Array<[string, string]> = [
      ['2008-10-20', '2026-10-19'],
      ['2008-10-20', '2026-10-20'],
      ['2008-02-29', '2026-02-28'],
      ['2008-02-29', '2026-03-01'],
      ['2008-12-31', '2026-01-01'],
      ['2010-01-01', '2026-12-31'],
    ];
    for (const [dob, on] of cases) {
      const [row] = rowsOf<{ age: number }>(
        await h.database.db.execute(sql`select uf_age_on(${dob}::date, ${on}::date) as age`),
      );
      expect(row?.age, `${dob} on ${on}`).toBe(ageOn(dob, on));
    }
  });

  it('lets an adult carry on without a guardian', async () => {
    const { studentId } = await signIn(h.store, syntheticPhone(20));
    expect(await h.store.setDateOfBirth(studentId, '2007-05-01')).toBe('not-required');
  });

  it('holds a minor until a guardian consents', async () => {
    const { studentId } = await signIn(h.store, syntheticPhone(21));
    expect(await h.store.setDateOfBirth(studentId, '2010-03-03')).toBe('pending');
  });

  it('refuses an impossible or unlikely date', async () => {
    const { studentId } = await signIn(h.store, syntheticPhone(22));
    await expect(h.store.setDateOfBirth(studentId, '2010-13-40')).rejects.toThrow(
      InvalidStateError,
    );
    await expect(h.store.setDateOfBirth(studentId, '2024-01-01')).rejects.toThrow(
      InvalidStateError,
    );
  });

  it('refuses anyone under 13, recording nothing (A11-24: the stores say 13 and over)', async () => {
    const { studentId } = await signIn(h.store, syntheticPhone(23));
    // Today is 13 October 2026 in South Africa: 13 tomorrow is still 12.
    await expect(h.store.setDateOfBirth(studentId, '2013-10-14')).rejects.toThrow(TooYoungError);
    await expect(h.store.setDateOfBirth(studentId, '2016-01-01')).rejects.toThrow(TooYoungError);
    const account = await h.store.account(studentId);
    expect(account.consentStatus).toBe('unknown');
    expect(account.dateOfBirth).toBeNull();
    // 13 today is welcome, with a guardian's consent like any minor.
    expect(await h.store.setDateOfBirth(studentId, '2013-10-13')).toBe('pending');
  });

  it('cannot be changed once an adult has been confirmed', async () => {
    const { studentId } = await adultStudent(h.store);
    await expect(h.store.setDateOfBirth(studentId, '2011-01-01')).rejects.toThrow(
      InvalidStateError,
    );
  });
});

describe('guardian consent (hard rule 5)', () => {
  const guardian = (n: number) => ({
    name: 'Test Guardian',
    phone: syntheticPhone(n),
    relationship: 'parent' as const,
  });

  async function minor(n: number) {
    const session = await signIn(h.store, syntheticPhone(n));
    await h.store.setDateOfBirth(session.studentId, '2010-03-03');
    return session;
  }

  it("refuses to touch a minor's personal data before consent, in the data layer", async () => {
    const { studentId } = await minor(30);
    const student = h.store.forStudent(studentId);
    await expect(student.profile()).rejects.toThrow(ConsentRequiredError);
    await expect(student.updateProfile({ goal: 'Engineering' })).rejects.toThrow(
      ConsentRequiredError,
    );
    // The profile's look too (0028): harmless ids, but still about a minor.
    await expect(student.updateProfile({ theme: 'ocean' })).rejects.toThrow(ConsentRequiredError);
    await expect(
      student.saveConfirmedReport({
        kind: 'grade-11-final',
        marks: [{ subject: 'mathematics', percent: 70 }],
      }),
    ).rejects.toThrow(ConsentRequiredError);
    expect(await student.mayProcess()).toBe(false);
  });

  it('and in the database itself, even if application code is bypassed', async () => {
    const { studentId } = await minor(31);
    expect(
      await dbError(
        asStudent(
          studentId,
          sql`insert into profiles (student_id, goal) values (${studentId}::uuid, 'x')`,
        ),
      ),
    ).toMatch(/row-level security/);
  });

  it('opens processing once the guardian consents through the link', async () => {
    const { studentId } = await minor(32);
    const { token, guardianPhone } = await h.store.requestGuardianConsent(
      studentId,
      guardian(33),
      'v1',
    );
    expect(guardianPhone).toBe(syntheticPhone(33));
    const view = await h.store.consentRequest(token);
    expect(view).toEqual({
      status: 'open',
      guardianName: 'Test Guardian',
      relationship: 'parent',
      learnerPhoneMasked: maskPhone(syntheticPhone(32)),
    });
    await h.store.grantConsent(token);
    expect((await h.store.consentRequest(token)).status).toBe('granted');
    const student = h.store.forStudent(studentId);
    await student.updateProfile({ goal: 'Civil Engineering at UJ' });
    expect((await student.profile())?.goal).toBe('Civil Engineering at UJ');
  });

  it('stops processing and ends every session when the guardian withdraws', async () => {
    const { studentId, token: session } = await minor(34);
    const { token } = await h.store.requestGuardianConsent(studentId, guardian(35), 'v1');
    await h.store.grantConsent(token);
    await h.store.withdrawConsent(token);
    await expect(h.store.forStudent(studentId).profile()).rejects.toThrow(ConsentRequiredError);
    expect(await h.store.sessionStudent(session)).toBeNull();
    expect((await h.store.consentRequest(token)).status).toBe('withdrawn');
  });

  it('refuses an expired link, a used link and an unknown link', async () => {
    const { studentId } = await minor(36);
    const { token } = await h.store.requestGuardianConsent(studentId, guardian(37), 'v1');
    h.advance(15 * 24 * 60 * 60 * 1000);
    expect((await h.store.consentRequest(token)).status).toBe('expired');
    await expect(h.store.grantConsent(token)).rejects.toThrow(InvalidStateError);
    await expect(h.store.grantConsent('made-up')).rejects.toThrow(NotFoundError);
    await expect(h.store.withdrawConsent(token)).rejects.toThrow(InvalidStateError);
  });

  it("refuses the learner's own number as the guardian's", async () => {
    const { studentId } = await minor(38);
    await expect(h.store.requestGuardianConsent(studentId, guardian(38), 'v1')).rejects.toThrow(
      /different/,
    );
  });

  it('allows three consent requests a day', async () => {
    const { studentId } = await minor(39);
    for (let i = 0; i < 3; i++)
      await h.store.requestGuardianConsent(studentId, guardian(40 + i), 'v1');
    await expect(h.store.requestGuardianConsent(studentId, guardian(44), 'v1')).rejects.toThrow(
      RateLimitedError,
    );
  });

  it('is not asked of an adult', async () => {
    const { studentId } = await adultStudent(h.store);
    await expect(h.store.requestGuardianConsent(studentId, guardian(46), 'v1')).rejects.toThrow(
      InvalidStateError,
    );
  });

  it('asks the learner to consent in their own name at 18', async () => {
    const { studentId } = await signIn(h.store, syntheticPhone(47));
    await h.store.setDateOfBirth(studentId, '2008-10-20'); // 17 today, 18 in a week
    const { token } = await h.store.requestGuardianConsent(studentId, guardian(48), 'v1');
    await h.store.grantConsent(token);
    expect((await h.store.account(studentId)).needsAdultConsent).toBe(false);
    h.advance(8 * 24 * 60 * 60 * 1000);
    expect((await h.store.account(studentId)).needsAdultConsent).toBe(true);
    await h.store.consentAsAdult(studentId, 'adult-v2-2026-10');
    expect((await h.store.account(studentId)).consentStatus).toBe('not-required');
    expect((await h.store.account(studentId)).needsAdultConsent).toBe(false);
    await expect(h.store.consentAsAdult(studentId, 'adult-v2-2026-10')).rejects.toThrow(
      InvalidStateError,
    );
  });
});

describe('A7-04: an adult agrees, in their own name, before their data goes to the AI provider', () => {
  it('a new adult must agree after giving a date of birth, and the version is recorded', async () => {
    const { studentId } = await signIn(h.store, syntheticPhone(60));
    expect(await h.store.setDateOfBirth(studentId, '2000-02-02')).toBe('not-required');
    expect((await h.store.account(studentId)).needsAdultConsent).toBe(true);

    await h.store.consentAsAdult(studentId, 'adult-v2-2026-10');
    expect((await h.store.account(studentId)).needsAdultConsent).toBe(false);
    const exported = await h.store.forStudent(studentId).exportAll();
    expect(exported.account).toMatchObject({
      adultConsentVersion: 'adult-v2-2026-10',
      adultConsentedAt: new Date('2026-10-13T08:00:00Z'),
    });
    // Once is enough.
    await expect(h.store.consentAsAdult(studentId, 'adult-v2-2026-10')).rejects.toThrow(
      InvalidStateError,
    );
  });

  it('refuses a consent with no version', async () => {
    const { studentId } = await signIn(h.store, syntheticPhone(61));
    await h.store.setDateOfBirth(studentId, '2000-02-02');
    await expect(h.store.consentAsAdult(studentId, ' ')).rejects.toThrow(InvalidStateError);
    expect((await h.store.account(studentId)).needsAdultConsent).toBe(true);
  });

  it('is not asked of a minor', async () => {
    const { studentId } = await signIn(h.store, syntheticPhone(62));
    await h.store.setDateOfBirth(studentId, '2010-03-03');
    expect((await h.store.account(studentId)).needsAdultConsent).toBe(false);
    await expect(h.store.consentAsAdult(studentId, 'adult-v1-2026-10')).rejects.toThrow(
      InvalidStateError,
    );
  });
});

describe('audit 2026-10-13: consent cannot be escaped or hijacked (hard rule 5)', () => {
  const guardian = () => ({
    name: 'Test Guardian',
    phone: syntheticPhone(),
    relationship: 'parent' as const,
  });

  it('finding 1: a minor waiting for consent cannot re-declare as an adult', async () => {
    const { studentId } = await signIn(h.store);
    await h.store.setDateOfBirth(studentId, '2010-03-01');
    await expect(h.store.setDateOfBirth(studentId, '2000-03-01')).rejects.toThrow(
      InvalidStateError,
    );
    expect(await h.store.forStudent(studentId).mayProcess()).toBe(false);
  });

  it('finding 1: nor after the guardian withdrew and they asked again', async () => {
    const { studentId } = await signIn(h.store);
    await h.store.setDateOfBirth(studentId, '2010-03-01');
    const { token } = await h.store.requestGuardianConsent(studentId, guardian(), 'v1');
    await h.store.grantConsent(token);
    await h.store.withdrawConsent(token);
    await h.store.requestGuardianConsent(studentId, guardian(), 'v1');
    await expect(h.store.setDateOfBirth(studentId, '2000-03-01')).rejects.toThrow(
      InvalidStateError,
    );
    expect(await h.store.forStudent(studentId).mayProcess()).toBe(false);
  });

  it('finding 3: an old guardian link cannot lock out a learner who consented as an adult', async () => {
    const { studentId, token: session } = await signIn(h.store);
    await h.store.setDateOfBirth(studentId, '2008-10-20');
    const { token } = await h.store.requestGuardianConsent(studentId, guardian(), 'v1');
    await h.store.grantConsent(token);
    h.advance(8 * 24 * 60 * 60 * 1000);
    await h.store.consentAsAdult(studentId, 'adult-v1-2026-10');
    await expect(h.store.withdrawConsent(token)).rejects.toThrow(InvalidStateError);
    expect((await h.store.account(studentId)).consentStatus).toBe('not-required');
    expect(await h.store.sessionStudent(session)).toBe(studentId);
  });

  it('finding 3: a stale link cannot grant consent once the status has moved on', async () => {
    const { studentId } = await signIn(h.store);
    await h.store.setDateOfBirth(studentId, '2010-03-01');
    const first = await h.store.requestGuardianConsent(studentId, guardian(), 'v1');
    const second = await h.store.requestGuardianConsent(studentId, guardian(), 'v1');
    await h.store.grantConsent(second.token);
    await h.store.withdrawConsent(second.token);
    // The first link was never used; the guardian who withdrew must ask the learner again.
    await expect(h.store.grantConsent(first.token)).rejects.toThrow(InvalidStateError);
    expect((await h.store.account(studentId)).consentStatus).toBe('withdrawn');
  });
});

describe('row-level security: one student never sees another', () => {
  it('hides every row of another student, even from raw SQL as uf_app', async () => {
    const a = await adultStudent(h.store);
    const b = await adultStudent(h.store);
    const storeB = h.store.forStudent(b.studentId);
    await storeB.saveConfirmedReport({
      kind: 'grade-11-final',
      marks: [{ subject: 'mathematics', percent: 77 }],
    });
    const conversation = await storeB.conversationId();
    await storeB.appendMessage({ conversationId: conversation, role: 'student', content: 'hello' });

    for (const table of [
      'reports',
      'report_marks',
      'messages',
      'conversations',
      'students',
      'sessions',
    ]) {
      const rows = await asStudent<{ n: number }>(
        a.studentId,
        sql`select count(*)::int as n from ${sql.identifier(table)} where ${sql.raw(table === 'students' ? 'id' : 'student_id')} = ${b.studentId}::uuid`,
      );
      expect(rows[0]?.n, table).toBe(0);
    }
    expect(await h.store.forStudent(a.studentId).latestReport()).toBeNull();
  });

  it("refuses to write a row with another student's id", async () => {
    const a = await adultStudent(h.store);
    const b = await adultStudent(h.store);
    expect(
      await dbError(
        asStudent(
          a.studentId,
          sql`insert into memory_notes (student_id, kind, body) values (${b.studentId}::uuid, 'note', 'x')`,
        ),
      ),
    ).toMatch(/row-level security/);
  });

  it("doesn't let a student change their own consent status", async () => {
    const { studentId } = await signIn(h.store, syntheticPhone(54));
    await h.store.setDateOfBirth(studentId, '2010-01-01');
    expect(
      await dbError(asStudent(studentId, sql`update students set consent_status = 'granted'`)),
    ).toMatch(/permission denied/);
  });
});

describe('audit 2026-10-13, finding 8: the per-request role can do only what it needs', () => {
  it('cannot grant itself consent through guardian_consents', async () => {
    const { studentId } = await signIn(h.store);
    await h.store.setDateOfBirth(studentId, '2010-01-01');
    await h.store.requestGuardianConsent(
      studentId,
      { name: 'Test Guardian', phone: syntheticPhone(), relationship: 'parent' },
      'v1',
    );
    expect(
      await dbError(asStudent(studentId, sql`update guardian_consents set granted_at = now()`)),
    ).toMatch(/permission denied/);
  });

  it('cannot write audit rows about another student', async () => {
    const a = await adultStudent(h.store);
    const b = await adultStudent(h.store);
    expect(
      await dbError(
        asStudent(
          a.studentId,
          sql`insert into audit_log (actor_type, student_id, action) values ('student', ${b.studentId}::uuid, 'forged')`,
        ),
      ),
    ).toMatch(/row-level security/);
  });

  it("cannot learn another student's consent status", async () => {
    const a = await adultStudent(h.store);
    const b = await adultStudent(h.store);
    const rows = await asStudent<{ ok: boolean }>(
      a.studentId,
      sql`select uf_may_process(${b.studentId}::uuid) as ok`,
    );
    expect(rows[0]?.ok).toBe(false);
  });

  it('cannot read the rate-limit table', async () => {
    const a = await adultStudent(h.store);
    expect(await dbError(asStudent(a.studentId, sql`select * from rate_events`))).toMatch(
      /permission denied/,
    );
  });
});

describe('audit log', () => {
  it('records actions by id only, and can never be changed or deleted', async () => {
    const { studentId } = await adultStudent(h.store);
    const rows = rowsOf<{ action: string; reason: string | null }>(
      await h.database.db.execute(
        sql`select action, reason from audit_log where student_id = ${studentId}::uuid order by id`,
      ),
    );
    expect(rows.map((r) => r.action)).toEqual([
      'account.created',
      'account.date-of-birth-set',
      'consent.adult',
    ]);
    expect(await dbError(h.database.db.execute(sql`update audit_log set action = 'x'`))).toMatch(
      /append-only/,
    );
    expect(await dbError(h.database.db.execute(sql`delete from audit_log`))).toMatch(/append-only/);
  });
});

describe('student data', () => {
  it('keeps confirmed reports, newest first', async () => {
    const { studentId } = await adultStudent(h.store);
    const student = h.store.forStudent(studentId);
    await student.saveConfirmedReport({
      kind: 'grade-11-final',
      marks: [{ subject: 'mathematics', percent: 60 }],
    });
    h.advance(1000);
    await student.saveConfirmedReport({
      kind: 'grade-12-june',
      marks: [
        { subject: 'mathematics', percent: 65 },
        { subject: 'english-fal', percent: 71 },
      ],
    });
    const latest = await student.latestReport();
    expect(latest?.kind).toBe('grade-12-june');
    expect(latest?.marks).toEqual([
      { subject: 'english-fal', percent: 71 },
      { subject: 'mathematics', percent: 65 },
    ]);
    await expect(
      student.saveConfirmedReport({ kind: 'grade-11-final', marks: [] }),
    ).rejects.toThrow(InvalidStateError);
  });

  it('keeps every report kind, and refuses any other at the database (0024, 0031, G10-2)', async () => {
    const { studentId } = await adultStudent(h.store);
    const student = h.store.forStudent(studentId);
    const marks = [{ subject: 'mathematics', percent: 60 }];
    for (const kind of REPORT_KINDS) {
      h.advance(1000);
      await student.saveConfirmedReport({ kind, marks });
    }
    expect(await student.recentReports(10)).toHaveLength(REPORT_KINDS.length);
    // A kind the list doesn't hold (there is no Grade 10 September kind, and no Grade 9 one).
    for (const kind of ['grade-10-september', 'grade-9-final']) {
      await expect(
        student.saveConfirmedReport({ kind: kind as ReportKind, marks }),
      ).rejects.toThrow();
    }
  });

  it('scores on an admission report even when a Grade 11 June or September one was confirmed after it (§18.7 C2, A1-34)', async () => {
    const { studentId } = await adultStudent(h.store);
    const student = h.store.forStudent(studentId);
    const marks = (percent: number) => [{ subject: 'mathematics', percent }];
    await student.saveConfirmedReport({ kind: 'grade-10-final', marks: marks(50) });
    h.advance(1000);
    await student.saveConfirmedReport({ kind: 'grade-11-june', marks: marks(55) });
    // A Grade 11 interim report comes before Grade 10's, however late the Grade 10 one is added.
    h.advance(1000);
    await student.saveConfirmedReport({ kind: 'grade-10-june', marks: marks(45) });
    expect((await student.latestReport())?.kind).toBe('grade-11-june');
    h.advance(1000);
    await student.saveConfirmedReport({ kind: 'grade-11-final', marks: marks(60) });
    h.advance(1000);
    // Added later, to complete the record: an interim report never becomes the one results use.
    await student.saveConfirmedReport({ kind: 'grade-11-september', marks: marks(58) });
    expect((await student.latestReport())?.kind).toBe('grade-11-final');
    expect((await student.recentReports(5)).map((r) => r.kind)).toEqual([
      'grade-11-final',
      'grade-11-september',
      'grade-11-june',
      'grade-10-june',
      'grade-10-final',
    ]);
  });

  it('gives the school record the newest confirmed report of each kind, and nothing unconfirmed (§18.7 C2, hard rule 6)', async () => {
    const { studentId } = await adultStudent(h.store);
    const student = h.store.forStudent(studentId);
    expect(await student.schoolRecordReports()).toEqual([]);
    // A report read from a document but not confirmed is never part of the record.
    const doc = await student.addDocument({
      kind: 'grade-11-report',
      storageKey: 'synthetic/report.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
    });
    if (!doc) throw new Error('no document');
    await student.setExtraction(
      doc.id,
      { rows: [{ subject: 'mathematics', percent: 99 }], warnings: [] },
      'extracted',
    );
    expect(await student.schoolRecordReports()).toEqual([]);

    await student.saveConfirmedReport({
      kind: 'grade-10-final',
      marks: [{ subject: 'mathematics', percent: 50 }],
    });
    h.advance(1000);
    await student.saveConfirmedReport({
      kind: 'grade-11-final',
      marks: [{ subject: 'mathematics', percent: 60 }],
    });
    h.advance(1000);
    // A correction: the Grade 10 report confirmed again, after the Grade 11 one.
    await student.saveConfirmedReport({
      kind: 'grade-10-final',
      marks: [
        { subject: 'mathematics', percent: 52 },
        { subject: 'english-hl', percent: 64 },
      ],
    });
    const record = await student.schoolRecordReports();
    expect(record.map((r) => r.kind)).toEqual(['grade-10-final', 'grade-11-final']);
    expect(record[0]?.marks).toEqual([
      { subject: 'english-hl', percent: 64 },
      { subject: 'mathematics', percent: 52 },
    ]);
    expect(record.every((r) => r.confirmedAt instanceof Date)).toBe(true);
  });

  it('scores on a Grade 11 or 12 report even when a Grade 10 one was confirmed after it (G10-3)', async () => {
    const { studentId } = await adultStudent(h.store);
    const student = h.store.forStudent(studentId);
    await student.saveConfirmedReport({
      kind: 'grade-10-final',
      marks: [{ subject: 'mathematics', percent: 50 }],
    });
    // Alone, the Grade 10 report is the latest.
    expect((await student.latestReport())?.kind).toBe('grade-10-final');
    h.advance(1000);
    await student.saveConfirmedReport({
      kind: 'grade-11-final',
      marks: [{ subject: 'mathematics', percent: 60 }],
    });
    h.advance(1000);
    // Added later, to complete the record: it still never becomes the report results use.
    await student.saveConfirmedReport({
      kind: 'grade-10-final',
      marks: [{ subject: 'mathematics', percent: 55 }],
    });
    expect((await student.latestReport())?.kind).toBe('grade-11-final');
    expect((await student.recentReports(3)).map((r) => r.kind)).toEqual([
      'grade-11-final',
      'grade-10-final',
      'grade-10-final',
    ]);
  });

  it('takes only the grades UniversityFlow serves, 10 to 12 (A1-39)', async () => {
    const { studentId } = await adultStudent(h.store);
    const student = h.store.forStudent(studentId);
    for (const grade of [9, 13, 10.5]) {
      await expect(student.updateProfile({ grade })).rejects.toThrow(InvalidStateError);
    }
    expect((await student.profile())?.grade ?? null).toBeNull();
    expect((await student.updateProfile({ grade: 10 }))?.grade).toBe(10);
  });

  it('moves the grade up each school year, and asks once a year until confirmed (0025, G10-1)', async () => {
    const { studentId } = await adultStudent(h.store);
    const student = h.store.forStudent(studentId);
    // 13 October 2026: Grade 10.
    await student.updateProfile({ grade: 10 });
    expect(await student.profile()).toMatchObject({
      grade: 10,
      gradeGivenOn: '2026-10-13',
      gradeCheckDue: false,
    });
    // A name change leaves the grade's date alone.
    await student.updateProfile({ displayName: 'Synthetic' });
    expect((await student.profile())?.gradeGivenOn).toBe('2026-10-13');

    // 13 January 2027: Grade 11 without typing anything, and the check is due.
    h.advance(92 * 86_400_000);
    expect(await student.profile()).toMatchObject({ grade: 11, gradeCheckDue: true });
    // Confirming records it afresh: no check again this year.
    await student.updateProfile({ grade: 11 });
    expect(await student.profile()).toMatchObject({
      grade: 11,
      gradeGivenOn: '2027-01-13',
      gradeCheckDue: false,
    });
    // Matric the next year; past it, still 12 and never asked about Grade 13.
    h.advance(365 * 86_400_000);
    expect(await student.profile()).toMatchObject({ grade: 12, gradeCheckDue: true });
    h.advance(365 * 86_400_000);
    expect(await student.profile()).toMatchObject({ grade: 12, gradeCheckDue: false });

    await student.updateProfile({ grade: null });
    expect(await student.profile()).toMatchObject({ grade: null, gradeGivenOn: null });
  });

  it('keeps the learner’s look: a theme, an avatar, a tagline and up to three words (0028)', async () => {
    const { studentId } = await adultStudent(h.store);
    const student = h.store.forStudent(studentId);
    await student.updateProfile({ displayName: 'Synthetic' });
    expect(await student.profile()).toMatchObject({
      theme: 'mauve',
      avatar: 'initials',
      taglineId: null,
      badgeIds: [],
    });
    const look = {
      theme: 'ocean',
      avatar: 'icon:rocket',
      taglineId: 'small-steps',
      badgeIds: ['night-owl', 'bookworm'],
    };
    expect(await student.updateProfile(look)).toMatchObject(look);
    // Changing the name leaves the look alone, and the export carries it (planning.md §8.1).
    await student.updateProfile({ displayName: 'Synthetic Two' });
    expect(await student.profile()).toMatchObject(look);
    expect((await student.exportAll()).personal?.profile).toMatchObject(look);
    await student.updateProfile({ taglineId: null, badgeIds: [] });
    expect(await student.profile()).toMatchObject({
      theme: 'ocean',
      taglineId: null,
      badgeIds: [],
    });
  });

  it('stores only ids for the look, and three words at most, at the database (0028)', async () => {
    const { studentId } = await adultStudent(h.store);
    const student = h.store.forStudent(studentId);
    await student.updateProfile({ theme: 'ocean' });
    expect(
      await dbError(
        student.updateProfile({ badgeIds: ['night-owl', 'bookworm', 'curious', 'early-bird'] }),
      ),
    ).toMatch(/profiles_badge_ids_max/);
    // Free text never fits the shape of an id, even if the API were bypassed (D3).
    const set = (column: string, value: string) =>
      database.exec(`update profiles set ${column} = ${value} where student_id = '${studentId}'`);
    for (const [column, value] of [
      ['theme', `'Ocean Blue'`],
      ['theme', `''`],
      ['avatar', `'photo:me'`],
      ['avatar', `'icon:'`],
      ['tagline_id', `'Call me after school'`],
      ['badge_ids', `array['night-owl', 'Hello there']`],
      ['badge_ids', `array['night-owl', null]`],
      ['badge_ids', `null`],
    ] as const) {
      await expect(set(column, value), `${column} = ${value}`).rejects.toThrow();
    }
    expect(await student.profile()).toMatchObject({ theme: 'ocean', badgeIds: [] });
  });

  it('refuses a grade without the date it was given, at the database (0025)', async () => {
    const { studentId } = await adultStudent(h.store);
    await h.store.forStudent(studentId).updateProfile({ grade: 11 });
    await expect(
      database.exec(`update profiles set grade_given_on = null where student_id = '${studentId}'`),
    ).rejects.toThrow();
  });

  it('refuses a percentage outside 0–100 at the database', async () => {
    const { studentId } = await adultStudent(h.store);
    await expect(
      h.store.forStudent(studentId).saveConfirmedReport({
        kind: 'grade-11-final',
        marks: [{ subject: 'mathematics', percent: 101 }],
      }),
    ).rejects.toThrow();
  });

  it('marks a document confirmed when its report is saved', async () => {
    const { studentId } = await adultStudent(h.store);
    const student = h.store.forStudent(studentId);
    const doc = await student.addDocument({
      kind: 'grade-11-report',
      storageKey: 'k1',
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
    });
    if (!doc) throw new Error('no document');
    await student.setExtraction(doc.id, { subjects: [] }, 'extracted');
    await student.saveConfirmedReport({
      kind: 'grade-11-final',
      marks: [{ subject: 'mathematics', percent: 60 }],
      documentId: doc.id,
    });
    expect((await student.document(doc.id)).status).toBe('confirmed');
    expect(await student.documents()).toHaveLength(1);
    expect(await student.deleteDocument(doc.id)).toBe('k1');
    await expect(student.document(doc.id)).rejects.toThrow(NotFoundError);
  });

  it('keeps one running conversation with its history in order', async () => {
    const { studentId } = await adultStudent(h.store);
    const student = h.store.forStudent(studentId);
    const id = await student.conversationId();
    expect(await student.conversationId()).toBe(id);
    await student.appendMessage({ conversationId: id, role: 'student', content: 'one' });
    h.advance(10);
    await student.appendMessage({
      conversationId: id,
      role: 'assistant',
      content: 'two',
      artifacts: [{ kind: 'results-card' }],
    });
    const history = await student.history(id);
    expect(history.map((m) => m.content)).toEqual(['one', 'two']);
    expect(history[1]?.artifacts).toEqual([{ kind: 'results-card' }]);
  });

  it('keeps memory the student can see and remove', async () => {
    const { studentId } = await adultStudent(h.store);
    const student = h.store.forStudent(studentId);
    const note = await student.remember('goal', '  Become a civil engineer  ');
    expect(note?.body).toBe('Become a civil engineer');
    expect(await student.memory()).toHaveLength(1);
    await student.forget(note?.id ?? '');
    expect(await student.memory()).toHaveLength(0);
    await expect(student.forget(note?.id ?? '')).rejects.toThrow(NotFoundError);
  });

  it('keeps a ranked shortlist, applications and checklists', async () => {
    const { studentId } = await adultStudent(h.store);
    const student = h.store.forStudent(studentId);
    await student.addToShortlist('uj-beng-civil');
    await student.addToShortlist('tut-dip-civil-engineering');
    await student.addToShortlist('uj-beng-civil');
    expect((await student.shortlist()).map((s) => [s.programmeId, s.rank])).toEqual([
      ['uj-beng-civil', 1],
      ['tut-dip-civil-engineering', 2],
    ]);
    await student.removeFromShortlist('uj-beng-civil');
    expect(await student.shortlist()).toHaveLength(1);

    await student.updateApplication('uj', { status: 'in-progress' });
    await student.updateApplication('uj', { status: 'submitted', reference: 'REF-1' });
    const [app] = await student.applications();
    expect(app).toMatchObject({ universityId: 'uj', status: 'submitted', reference: 'REF-1' });

    await student.setChecklistItem('application:uj', 'certified-id', true);
    await student.setChecklistItem('application:uj', 'grade-11-report', false);
    const items = await student.checklist('application:uj');
    expect(items.find((i) => i.item === 'certified-id')?.doneAt).toBeInstanceOf(Date);
    expect(items.find((i) => i.item === 'grade-11-report')?.doneAt).toBeNull();
  });
});

describe('the right to see and delete (planning.md §8.1)', () => {
  it('exports the grade the app shows beside the one stored, and whether school is finished (A11-27)', async () => {
    const { studentId } = await adultStudent(h.store);
    const student = h.store.forStudent(studentId);
    await student.updateProfile({ grade: 10 }); // 13 October 2026
    h.advance(2 * 365 * 86_400_000); // October 2028: matric
    let profile = (await student.exportAll()).personal?.profile;
    expect(profile).toMatchObject({ grade: 10, currentGrade: 12, schoolFinished: false });
    h.advance(100 * 86_400_000); // January 2029: past matric
    profile = (await student.exportAll()).personal?.profile;
    expect(profile).toMatchObject({ grade: 10, currentGrade: 12, schoolFinished: true });
    expect((await student.profile())?.schoolFinished).toBe(true);
  });

  it('exports everything held, including who accessed it', async () => {
    const { studentId } = await adultStudent(h.store);
    const student = h.store.forStudent(studentId);
    await student.updateProfile({ goal: 'Nursing' });
    const exported = await student.exportAll();
    expect(exported.account?.consentStatus).toBe('not-required');
    expect(exported.personal?.profile?.goal).toBe('Nursing');
    expect(exported.accessHistory.map((a) => a.action)).toContain('profile.updated');
  });

  it("lets a minor without consent see what's held, without the personal data", async () => {
    const { studentId } = await signIn(h.store, syntheticPhone(81));
    await h.store.setDateOfBirth(studentId, '2010-01-01');
    const exported = await h.store.forStudent(studentId).exportAll();
    expect(exported.account?.consentStatus).toBe('pending');
    expect(exported.personal).toBeNull();
  });

  it('deletes the account and everything attached, returns file keys, and keeps an id-only audit row', async () => {
    const { studentId, token } = await adultStudent(h.store);
    const student = h.store.forStudent(studentId);
    await student.addDocument({
      kind: 'grade-11-report',
      storageKey: 'k-82',
      mimeType: 'image/png',
      sizeBytes: 5,
    });
    await student.updateProfile({ goal: 'Law' });
    expect(await student.deleteAccount()).toEqual(['k-82']);
    expect(await h.store.sessionStudent(token)).toBeNull();
    await expect(h.store.account(studentId)).rejects.toThrow(NotFoundError);
    const left = rowsOf<{ n: number }>(
      await h.database.db.execute(
        sql`select (select count(*) from profiles where student_id = ${studentId}::uuid) + (select count(*) from documents where student_id = ${studentId}::uuid) as n`,
      ),
    );
    expect(Number(left[0]?.n)).toBe(0);
    const audit = rowsOf<{ action: string }>(
      await h.database.db.execute(
        sql`select action from audit_log where student_id = ${studentId}::uuid and action = 'account.deleted'`,
      ),
    );
    expect(audit).toHaveLength(1);
  });
});
