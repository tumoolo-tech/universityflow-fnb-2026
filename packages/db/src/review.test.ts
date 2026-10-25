import { createHmac } from 'node:crypto';
import { isSubjectId } from '@universityflow/catalogue';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from './client';
import { rowsOf } from './client';
import { InvalidCodeError, InvalidStateError } from './errors';
import {
  OTP_MAX_ATTEMPTS,
  REVIEW_DATE_OF_BIRTH,
  REVIEW_MARKS,
  type ReviewSignIn,
  reviewPinHash,
} from './store';
import { signIn, smsCode, syntheticPhone, TEST_SECRET, testDatabase, testStore } from './testing';

/**
 * The store-review sign-in (audit A7-01, docs/store/review-notes.md option A). One number the
 * owner controls signs in with a fixed PIN, held only as a hash, for a synthetic adult account,
 * until a date. Each `describe` is one of the six guards; each test fails without its guard.
 */

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(async () => {
  await database.close();
});

const START = new Date('2026-10-14T08:00:00Z');
// The review window ends at the end of 20 October, South African time.
const UNTIL = new Date('2026-10-20T23:59:59.999+02:00');
const PIN = '246810';

let n = 7_000_000;
/** A fresh review number per test (synthetic, built at runtime: hard rule 4). */
function review(phone = syntheticPhone(n++)): ReviewSignIn {
  return { phone, pinHash: reviewPinHash(phone, PIN, TEST_SECRET), until: UNTIL };
}

function harness(config: ReviewSignIn | null, start = START) {
  return testStore(database, start, { review: config });
}

async function student(id: string) {
  const [row] = rowsOf<{
    review: boolean;
    consent_status: string;
    date_of_birth: string;
  }>(
    await database.db.execute(
      sql`select review, consent_status, date_of_birth::text from students where id = ${id}::uuid`,
    ),
  );
  return row;
}

async function audit(id: string) {
  return rowsOf<{ action: string; actor_type: string; reason: string | null }>(
    await database.db.execute(
      sql`select action, actor_type, reason from audit_log where student_id = ${id}::uuid order by id`,
    ),
  );
}

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

describe('reviewPinHash: the same keyed hash the store keeps for every PIN', () => {
  it('is HMAC-SHA256 of "<E.164 number>:<PIN>" under AUTH_SECRET (the one-line command in review-notes.md)', () => {
    const phone = syntheticPhone(n++);
    const expected = createHmac('sha256', TEST_SECRET).update(`${phone}:${PIN}`).digest('hex');
    expect(reviewPinHash(phone, PIN, TEST_SECRET)).toBe(expected);
    // Any way of writing the number hashes the same.
    expect(reviewPinHash(`0${phone.slice(3)}`, PIN, TEST_SECRET)).toBe(expected);
  });

  it('refuses a PIN that is not six digits', () => {
    expect(() => reviewPinHash(syntheticPhone(n++), '1234', TEST_SECRET)).toThrow();
  });
});

describe('guard 1: off unless configured', () => {
  it('without a review configuration the review number gets an ordinary SMS PIN, and the fixed PIN is refused', async () => {
    const config = review();
    await harness(null).store.seedReviewAccount(config.phone);
    const h = harness(null);
    const challenge = await h.store.requestOtp(config.phone);
    expect(challenge.review).toBe(false);
    if (challenge.review) throw new Error('unreachable');
    expect(challenge.code).toMatch(/^\d{6}$/);
    if (challenge.code !== PIN) {
      await expect(h.store.verifyOtp(config.phone, PIN)).rejects.toThrow(InvalidCodeError);
    }
  });

  it('refuses a malformed configuration when the store is built', () => {
    const config = review();
    expect(() => harness({ ...config, pinHash: 'not-a-hash' })).toThrow(/hash/);
    expect(() => harness({ ...config, phone: 'not a number' })).toThrow();
    expect(() => harness({ ...config, until: new Date(Number.NaN) })).toThrow(/date/);
  });
});

describe('guard 2: one number, and nothing sent for it', () => {
  it('a PIN request for the review number returns nothing to send, and its challenge holds the configured hash', async () => {
    const config = review();
    const h = harness(config);
    await h.store.seedReviewAccount(config.phone);
    const challenge = await h.store.requestOtp(config.phone);
    expect(challenge).toEqual({ id: expect.any(String), phone: config.phone, review: true });
    expect(() => smsCode(challenge)).toThrow(/sends no PIN/);
    const [row] = rowsOf<{ code_hash: string; review: boolean }>(
      await database.db.execute(
        sql`select code_hash, review from otp_challenges where id = ${challenge.id}::uuid`,
      ),
    );
    expect(row).toEqual({ code_hash: config.pinHash, review: true });
  });

  it('signs the review account in with the fixed PIN, written any way', async () => {
    const config = review();
    const h = harness(config);
    const { studentId } = await h.store.seedReviewAccount(config.phone);
    await h.store.requestOtp(`0${config.phone.slice(3)}`);
    const signed = await h.store.verifyOtp(config.phone, PIN);
    expect(signed).toMatchObject({ studentId, isNewStudent: false, review: true });
    expect(await h.store.sessionStudent(signed.token)).toBe(studentId);
  });

  it('a normal number is unaffected: it gets its own SMS PIN, and the review PIN does not open it', async () => {
    const config = review();
    const h = harness(config);
    await h.store.seedReviewAccount(config.phone);
    const other = syntheticPhone(n++);
    const challenge = await h.store.requestOtp(other);
    expect(challenge.review).toBe(false);
    if (challenge.review) throw new Error('unreachable');
    if (challenge.code !== PIN) {
      await expect(h.store.verifyOtp(other, PIN)).rejects.toThrow(InvalidCodeError);
    }
    const signed = await h.store.verifyOtp(other, challenge.code);
    expect(signed.review).toBe(false);
    expect(signed.isNewStudent).toBe(true);
    expect((await student(signed.studentId))?.review).toBe(false);
  });
});

describe('guard 3: only the synthetic review account', () => {
  it('seeds an adult flagged review, with synthetic marks confirmed by the seed and recorded as such', async () => {
    const config = review();
    const h = harness(config);
    const { studentId, created } = await h.store.seedReviewAccount(config.phone);
    expect(created).toBe(true);
    expect(await student(studentId)).toEqual({
      review: true,
      consent_status: 'not-required',
      date_of_birth: REVIEW_DATE_OF_BIRTH,
    });
    // Asked to agree in their own name like any adult (A7-04): the reviewer sees the disclosure.
    // Until they do, nothing of theirs is read, by the app or by the database (A1-13).
    expect((await h.store.account(studentId)).needsAdultConsent).toBe(true);
    expect(await h.store.forStudent(studentId).mayProcess()).toBe(false);
    await h.store.consentAsAdult(studentId, 'adult-v1-test');
    // Hard rule 6: the marks are a confirmed report (typed, read from no document), and the audit
    // log says who confirmed them: the owner's seed, not a learner.
    const report = await h.store.forStudent(studentId).latestReport();
    const bySubject = (a: { subject: string }, b: { subject: string }) =>
      a.subject.localeCompare(b.subject);
    expect([...(report?.marks ?? [])].sort(bySubject)).toEqual([...REVIEW_MARKS].sort(bySubject));
    expect(REVIEW_MARKS.every((m) => isSubjectId(m.subject))).toBe(true);
    expect(await audit(studentId)).toEqual([
      { action: 'account.review-seeded', actor_type: 'staff', reason: null },
      { action: 'report.confirmed', actor_type: 'staff', reason: 'review-seed' },
      { action: 'consent.adult', actor_type: 'student', reason: null },
    ]);
  });

  it('is idempotent, and never takes over a real account that holds the number', async () => {
    const config = review();
    const h = harness(config);
    const first = await h.store.seedReviewAccount(config.phone);
    const again = await h.store.seedReviewAccount(config.phone);
    expect(again).toEqual({ studentId: first.studentId, created: false });
    await h.store.consentAsAdult(first.studentId, 'adult-v1-test');
    expect(await h.store.forStudent(first.studentId).recentReports(5)).toHaveLength(1);

    const learner = await signIn(harness(null).store);
    const [row] = rowsOf<{ phone: string }>(
      await database.db.execute(
        sql`select phone from students where id = ${learner.studentId}::uuid`,
      ),
    );
    await expect(h.store.seedReviewAccount(row?.phone ?? '')).rejects.toThrow(InvalidStateError);
    expect((await student(learner.studentId))?.review).toBe(false);
  });

  it('the fixed PIN never creates an account: without the seeded account it is refused', async () => {
    const config = review();
    const h = harness(config);
    await h.store.requestOtp(config.phone);
    await expect(h.store.verifyOtp(config.phone, PIN)).rejects.toThrow(InvalidCodeError);
    const rows = rowsOf<{ n: number }>(
      await database.db.execute(
        sql`select count(*)::int as n from students where phone = ${config.phone}`,
      ),
    );
    expect(rows[0]?.n).toBe(0);
  });

  it('cannot ask a guardian for consent, in the store or in the database', async () => {
    const config = review();
    const h = harness(config);
    const { studentId } = await h.store.seedReviewAccount(config.phone);
    await expect(
      h.store.requestGuardianConsent(
        studentId,
        { name: 'Test Guardian', phone: syntheticPhone(n++), relationship: 'parent' },
        'v2-test',
      ),
    ).rejects.toThrow(InvalidStateError);
    // Straight to the table, as the owner: the database refuses too.
    expect(
      await dbError(
        database.db.execute(sql`
          insert into guardian_consents
            (student_id, guardian_name, guardian_phone, relationship, token_hash, consent_version, expires_at)
          values (${studentId}::uuid, 'Test Guardian', ${syntheticPhone(n++)}, 'parent',
                  ${`hash-${n++}`}, 'v2-test', now() + interval '1 day')`),
      ),
    ).toMatch(/review/);
    // Nor can it become a minor waiting for a guardian.
    expect(
      await dbError(
        database.db.execute(
          sql`update students set consent_status = 'pending' where id = ${studentId}::uuid`,
        ),
      ),
    ).toMatch(/students_review_adult/);
  });

  it('cannot opt in to SMS or WhatsApp, in the store or in the database; push is allowed', async () => {
    const config = review();
    const h = harness(config);
    const { studentId } = await h.store.seedReviewAccount(config.phone);
    await h.store.consentAsAdult(studentId, 'adult-v1-test');
    const me = h.store.forStudent(studentId);
    for (const channel of ['sms', 'whatsapp'] as const) {
      await expect(me.setChannelOptIn(channel, true)).rejects.toThrow(InvalidStateError);
      expect(
        await dbError(
          database.db.execute(sql`
            insert into messaging_channels (student_id, channel, opted_in, opted_in_at, updated_at)
            values (${studentId}::uuid, ${channel}, true, now(), now())`),
        ),
      ).toMatch(/review/);
    }
    // Opting out is always allowed.
    await me.setChannelOptIn('sms', false);
    await me.setChannelOptIn('push', true);
    const prefs = await me.messagingPreferences();
    expect(prefs.channels.filter((c) => c.optedIn).map((c) => c.channel)).toEqual(['push']);
    expect(await me.isReviewAccount()).toBe(true);
    expect(
      await harness(null)
        .store.forStudent((await signIn(h.store)).studentId)
        .isReviewAccount(),
    ).toBe(false);
  });
});

describe('guard 4: expires', () => {
  it('a review PIN asked for in the window is refused once UF_REVIEW_UNTIL has passed', async () => {
    const config = review();
    const h = harness(config, new Date(UNTIL.getTime() - 60_000));
    await h.store.seedReviewAccount(config.phone);
    await h.store.requestOtp(config.phone);
    h.advance(2 * 60_000);
    await expect(h.store.verifyOtp(config.phone, PIN)).rejects.toThrow(/expired/);
  });

  it('after UF_REVIEW_UNTIL the number is an ordinary one: an SMS PIN, and the fixed PIN refused', async () => {
    const config = review();
    const h = harness(config, new Date(UNTIL.getTime() + 1));
    await h.store.seedReviewAccount(config.phone);
    const challenge = await h.store.requestOtp(config.phone);
    expect(challenge.review).toBe(false);
    if (challenge.review) throw new Error('unreachable');
    if (challenge.code !== PIN) {
      await expect(h.store.verifyOtp(config.phone, PIN)).rejects.toThrow(InvalidCodeError);
    }
  });

  it('a challenge made for the review number is refused if the configuration is removed', async () => {
    const config = review();
    const h = harness(config);
    await h.store.seedReviewAccount(config.phone);
    await h.store.requestOtp(config.phone);
    await expect(harness(null).store.verifyOtp(config.phone, PIN)).rejects.toThrow(/expired/);
  });
});

describe('guard 5: limited and visible', () => {
  it('five wrong PINs lock the review sign-in, like every sign-in', async () => {
    const config = review();
    const h = harness(config);
    await h.store.seedReviewAccount(config.phone);
    await h.store.requestOtp(config.phone);
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
      await expect(h.store.verifyOtp(config.phone, '135790')).rejects.toThrow(/not right/);
    }
    await expect(h.store.verifyOtp(config.phone, PIN)).rejects.toThrow(/expired/);
  });

  it('the same per-number limits apply to asking for the review PIN', async () => {
    const config = review();
    const h = harness(config);
    await h.store.seedReviewAccount(config.phone);
    await h.store.requestOtp(config.phone);
    await expect(h.store.requestOtp(config.phone)).rejects.toThrow(/Too many/);
  });

  it('every review sign-in writes its own audit row', async () => {
    const config = review();
    const h = harness(config);
    const { studentId } = await h.store.seedReviewAccount(config.phone);
    await h.store.requestOtp(config.phone);
    await h.store.verifyOtp(config.phone, PIN);
    expect((await audit(studentId)).map((r) => r.action)).toContain('auth.review-signed-in');
  });
});
