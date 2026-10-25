import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Database, rowsOf } from './client';
import { suppressionHash } from './crypto';
import { GuardianOptedOutError } from './errors';
import { signIn, syntheticPhone, TEST_SECRET, testDatabase, testStore } from './testing';

/**
 * Audit A12-04: STOP from a number with no account (a guardian sent the consent SMS) is recorded
 * on a suppression list, keyed by an HMAC of the number, never the number itself (hard rule 4).
 * Every SMS and WhatsApp message we start checks it, the guardian consent SMS included.
 */

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(async () => {
  await database.close();
});

const guardian = (phone: string) =>
  ({ name: 'Test Guardian', phone, relationship: 'parent' }) as const;

async function minor(store: ReturnType<typeof testStore>['store'], n: number) {
  const { studentId } = await signIn(store, syntheticPhone(n));
  await store.setDateOfBirth(studentId, '2010-03-03');
  return studentId;
}

describe('the suppression list (A12-04)', () => {
  it('records STOP from a number with no account, without keeping the number', async () => {
    const { store } = testStore(database);
    const messaging = store.messaging();
    const number = syntheticPhone(7101);
    const at = new Date('2026-10-13T08:00:00Z');
    expect(await messaging.receiveInbound({ channel: 'sms', from: number, stop: true, at })).toBe(
      'unknown',
    );
    expect(await messaging.isSuppressed('sms', number)).toBe(true);
    // Per channel, like a learner's STOP.
    expect(await messaging.isSuppressed('whatsapp', number)).toBe(false);
    expect(await messaging.isSuppressed('sms', syntheticPhone(7102))).toBe(false);
    const rows = rowsOf<Record<string, unknown>>(
      await database.db.execute(sql`select * from messaging_suppressions`),
    );
    expect(rows.length).toBeGreaterThan(0);
    const stored = JSON.stringify(rows);
    expect(stored).not.toContain(number.slice(3));
    expect(stored).not.toMatch(/\+27/);
  });

  it('an ordinary message from an unknown number suppresses nothing', async () => {
    const { store } = testStore(database);
    const messaging = store.messaging();
    const number = syntheticPhone(7103);
    const at = new Date('2026-10-13T08:00:00Z');
    await messaging.receiveInbound({ channel: 'sms', from: number, stop: false, at });
    expect(await messaging.isSuppressed('sms', number)).toBe(false);
  });

  it('refuses a guardian consent request to a number that said STOP, and records nothing', async () => {
    const { store } = testStore(database);
    const studentId = await minor(store, 7110);
    const number = syntheticPhone(7111);
    await store
      .messaging()
      .receiveInbound({ channel: 'sms', from: number, stop: true, at: new Date() });
    await expect(store.requestGuardianConsent(studentId, guardian(number), 'v2')).rejects.toThrow(
      GuardianOptedOutError,
    );
    const [count] = rowsOf<{ n: number }>(
      await database.db.execute(
        sql`select count(*)::int as n from guardian_consents where student_id = ${studentId}::uuid`,
      ),
    );
    expect(Number(count?.n)).toBe(0);
    // In any written form of the number.
    await expect(
      store.requestGuardianConsent(studentId, guardian(`0${number.slice(3)}`), 'v2'),
    ).rejects.toThrow(GuardianOptedOutError);
  });

  it('keeps every message we start away from a suppressed number, until its owner opts in again', async () => {
    const start = new Date('2026-10-13T08:00:00Z');
    const h = testStore(database, start);
    const messaging = h.store.messaging();
    const number = syntheticPhone(7120);
    // STOP before the number had an account.
    await messaging.receiveInbound({ channel: 'sms', from: number, stop: true, at: start });
    h.advance(60_000);
    const { studentId } = await signIn(h.store, number);
    await h.store.setDateOfBirth(studentId, '2000-01-15');
    await h.store.consentAsAdult(studentId, 'adult-v1-test');
    // The learner's own, later opt-in in the app is a fresh choice and wins.
    await h.store.forStudent(studentId).setChannelOptIn('sms', true);
    expect(await messaging.mayMessage('sms', number)).toBe(true);
    // A later STOP wins again.
    // The gate reads the list itself: a STOP newer than the opt-in wins, even with the channel
    // row still on.
    const later = new Date(start.getTime() + 120_000);
    await database.db.execute(sql`
      update messaging_suppressions set stopped_at = ${later.toISOString()}::timestamptz
      where channel = 'sms' and number_hash = ${suppressionHash(TEST_SECRET, number)}`);
    expect(await messaging.mayMessage('sms', number)).toBe(false);
    expect(await messaging.mayMessage('whatsapp', number)).toBe(false); // never opted in there
  });

  it('a queued guardian SMS gets a fresh link only while the request is open and the number allowed', async () => {
    const { store } = testStore(database);
    const studentId = await minor(store, 7130);
    const number = syntheticPhone(7131);
    const { consentId, token } = await store.requestGuardianConsent(
      studentId,
      guardian(number),
      'v2',
    );
    const link = await store.guardianLinkToSend(consentId);
    expect(link?.guardianPhone).toBe(number);
    expect(link?.token).not.toBe(token);
    // The new link works; the one never sent doesn't.
    await expect(store.consentRequest(token)).rejects.toThrow();
    expect((await store.consentRequest(link?.token ?? '')).status).toBe('open');

    // Once the guardian's number says STOP, nothing more is sent to it.
    await store
      .messaging()
      .receiveInbound({ channel: 'sms', from: number, stop: true, at: new Date() });
    expect(await store.guardianLinkToSend(consentId)).toBeNull();
  });

  it('no link for a request already answered, or an unknown one', async () => {
    const { store } = testStore(database);
    const studentId = await minor(store, 7140);
    const { consentId, token } = await store.requestGuardianConsent(
      studentId,
      guardian(syntheticPhone(7141)),
      'v2',
    );
    await store.grantConsent(token);
    expect(await store.guardianLinkToSend(consentId)).toBeNull();
    expect(await store.guardianLinkToSend('00000000-0000-4000-8000-000000000000')).toBeNull();
    expect(await store.guardianLinkToSend('not-an-id')).toBeNull();
  });

  it('is the owner’s alone: the learner role can’t read or change it', async () => {
    for (const statement of [
      sql`select * from messaging_suppressions`,
      sql`delete from messaging_suppressions`,
    ]) {
      const error = await database.db
        .transaction(async (tx) => {
          await tx.execute(sql`set local role uf_app`);
          await tx.execute(statement);
        })
        .then(
          () => '',
          (e: { cause?: { message?: string }; message: string }) => e.cause?.message ?? e.message,
        );
      expect(error).toMatch(/permission denied/);
    }
  });
});
