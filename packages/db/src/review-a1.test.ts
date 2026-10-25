import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from './client';
import { assertMigrated, openDatabase, rowsOf } from './client';
import { InvalidCodeError } from './errors';
import {
  REVIEW_MAX_WRONG_PINS,
  type ReviewAlerts,
  type ReviewSignIn,
  reviewPinHash,
} from './store';
import { signIn, smsCode, syntheticPhone, TEST_SECRET, testDatabase, testStore } from './testing';

/**
 * The store-review sign-in's gaps found by its A1 review (A1-18 to A1-24, PR #42). Each test
 * started as the reviewer's probe, which passed while the weakness was there, turned round to
 * expect the fix.
 */

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(async () => {
  await database.close();
});

const START = new Date('2026-10-14T08:00:00Z');
const UNTIL = new Date('2026-10-20T23:59:59.999+02:00');
const PIN = '246810';
const DAY = 24 * 60 * 60 * 1000;

let n = 8_200_000;
function review(pin = PIN, phone = syntheticPhone(n++)): ReviewSignIn {
  return { phone, pinHash: reviewPinHash(phone, pin, TEST_SECRET), until: UNTIL };
}

/** Records what the store reports, as the web app's log lines would. */
function recorder() {
  const seen = {
    wrong: [] as Array<{ failures: number; limit: number }>,
    locked: 0,
    misconfigured: [] as string[],
  };
  const alerts: ReviewAlerts = {
    wrongPin: (info) => void seen.wrong.push(info),
    locked: () => void seen.locked++,
    misconfigured: ({ studentId }) => void seen.misconfigured.push(studentId),
  };
  return { seen, alerts };
}

describe('A1-18: a review session ends with the review window', () => {
  it('a session from the last minute of the window stops working when the window closes', async () => {
    const config = review();
    const h = testStore(database, new Date(UNTIL.getTime() - 60_000), { review: config });
    const { studentId } = await h.store.seedReviewAccount(config.phone);
    await h.store.requestOtp(config.phone);
    const { token } = await h.store.verifyOtp(config.phone, PIN);
    expect(await h.store.sessionStudent(token)).toBe(studentId);
    const [row] = rowsOf<{ expires_at: string }>(
      await database.db.execute(
        sql`select expires_at::text from sessions where student_id = ${studentId}::uuid`,
      ),
    );
    expect(new Date(row?.expires_at ?? '').getTime()).toBeLessThanOrEqual(UNTIL.getTime());
    h.advance(2 * 60_000);
    expect(await h.store.sessionStudent(token)).toBeNull();
    // The reviewer's probe: 29 days later, with the configuration removed.
    const later = testStore(database, new Date(UNTIL.getTime() + 29 * DAY));
    expect(await later.store.sessionStudent(token)).toBeNull();
  });

  it('a review session is refused inside the window once the configuration is removed', async () => {
    const config = review();
    const h = testStore(database, START, { review: config });
    await h.store.seedReviewAccount(config.phone);
    await h.store.requestOtp(config.phone);
    const { token } = await h.store.verifyOtp(config.phone, PIN);
    expect(await testStore(database, START).store.sessionStudent(token)).toBeNull();
  });

  it("an ordinary learner's session is untouched", async () => {
    const h = testStore(database, START, { review: review() });
    const { token, studentId } = await signIn(h.store);
    h.advance(29 * DAY);
    expect(await h.store.sessionStudent(token)).toBe(studentId);
  });
});

describe('A1-19: wrong review PINs are counted across the whole window, and each one is reported', () => {
  it(`after ${REVIEW_MAX_WRONG_PINS} wrong PINs across challenges the review sign-in is refused, even with the right PIN, and survives a restart`, async () => {
    const config = review();
    const { seen, alerts } = recorder();
    const h = testStore(database, START, { review: config, reviewAlerts: alerts });
    await h.store.seedReviewAccount(config.phone);
    let wrong = 0;
    for (let challenge = 0; challenge < 3; challenge++) {
      await h.store.requestOtp(config.phone);
      for (let i = 0; i < 5 && wrong < REVIEW_MAX_WRONG_PINS + 1; i++, wrong++) {
        await expect(h.store.verifyOtp(config.phone, '135790')).rejects.toThrow(InvalidCodeError);
      }
      h.advance(5 * 60_000);
    }
    expect(seen.wrong.map((w) => w.failures)).toEqual(
      Array.from({ length: REVIEW_MAX_WRONG_PINS }, (_, i) => i + 1),
    );
    await h.store.requestOtp(config.phone);
    await expect(h.store.verifyOtp(config.phone, PIN)).rejects.toThrow(/expired/);
    expect(seen.locked).toBeGreaterThanOrEqual(1);

    // A restart (a new store, the same configuration) is still refused: it lives in the database.
    const restarted = testStore(database, new Date(START.getTime() + DAY), { review: config });
    await restarted.store.requestOtp(config.phone);
    await expect(restarted.store.verifyOtp(config.phone, PIN)).rejects.toThrow(/expired/);

    // A new PIN (a new hash, so a new configuration) opens it again.
    const fresh = { ...config, pinHash: reviewPinHash(config.phone, '864201', TEST_SECRET) };
    const rotated = testStore(database, new Date(START.getTime() + 2 * DAY), { review: fresh });
    await rotated.store.requestOtp(config.phone);
    await expect(rotated.store.verifyOtp(config.phone, '864201')).resolves.toMatchObject({
      review: true,
    });
  });

  it("the reviewer's walk (000000 upward, a challenge every five minutes) no longer opens a PIN of 000059 in an hour", async () => {
    const config = review('000059');
    const h = testStore(database, START, { review: config });
    await h.store.seedReviewAccount(config.phone);
    let guess = 0;
    let opened = false;
    for (let minute = 0; minute < 60 && !opened; minute += 5) {
      await h.store.requestOtp(config.phone, { ip: `198.51.100.${minute}` });
      for (let i = 0; i < 5 && !opened; i++) {
        const pin = String(guess++).padStart(6, '0');
        opened = await h.store.verifyOtp(config.phone, pin).then(
          () => true,
          () => false,
        );
      }
      h.advance(5 * 60_000);
    }
    expect(opened).toBe(false);
  });
});

describe('A1-20: a review number that belongs to a learner never blocks their SMS', () => {
  it('takes the ordinary SMS path and reports the misconfiguration with ids only', async () => {
    const plain = testStore(database, START);
    const learnerPhone = syntheticPhone(n++);
    const learner = await signIn(plain.store, learnerPhone);
    const { seen, alerts } = recorder();
    const h = testStore(database, new Date(START.getTime() + 60 * 60_000), {
      review: review(PIN, learnerPhone),
      reviewAlerts: alerts,
    });
    const challenge = await h.store.requestOtp(learnerPhone);
    expect(challenge.review).toBe(false);
    const signed = await h.store.verifyOtp(learnerPhone, smsCode(challenge));
    expect(signed).toMatchObject({ studentId: learner.studentId, review: false });
    expect(seen.misconfigured).toEqual([learner.studentId]);
  });
});

describe('A1-21: nothing but the deploy migrates', () => {
  it('assertMigrated passes on a migrated database', async () => {
    await expect(assertMigrated(database)).resolves.toBeUndefined();
  });

  it('refuses a database missing a migration, and changes nothing', async () => {
    const behind = testStore(await testDatabase()).database;
    await behind.db.execute(sql`delete from uf_migrations where id = '0010_review_account'`);
    const before = rowsOf<{ id: string }>(
      await behind.db.execute(sql`select id from uf_migrations`),
    );
    await expect(assertMigrated(behind)).rejects.toThrow(/0010_review_account/);
    const after = rowsOf<{ id: string }>(
      await behind.db.execute(sql`select id from uf_migrations`),
    );
    expect(after).toEqual(before);
    await behind.close();
  });

  it('refuses a database ahead of this checkout, or never migrated', async () => {
    const ahead = await testDatabase();
    await ahead.db.execute(sql`insert into uf_migrations (id) values ('9999_from_a_branch')`);
    await expect(assertMigrated(ahead)).rejects.toThrow(/9999_from_a_branch/);
    await ahead.close();
    const empty = openDatabase('pglite:memory');
    await expect(assertMigrated(empty)).rejects.toThrow(/not migrated/);
    // It looked, and created nothing.
    const [table] = rowsOf<{ name: string | null }>(
      await empty.db.execute(sql`select to_regclass('uf_migrations')::text as name`),
    );
    expect(table?.name).toBeNull();
    await empty.close();
  });
});

describe('A1-24: the seed says what to do when the number already has an ordinary account', () => {
  it('names the remedy', async () => {
    const config = review();
    const h = testStore(database, START, { review: config });
    const { studentId } = await h.store.seedReviewAccount(config.phone);
    await h.store.forStudent(studentId).deleteAccount();
    const after = testStore(database, new Date(UNTIL.getTime() + 1), { review: config });
    await signIn(after.store, config.phone);
    await expect(after.store.seedReviewAccount(config.phone)).rejects.toThrow(
      /Delete that account/,
    );
  });
});
