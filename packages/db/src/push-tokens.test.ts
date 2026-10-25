import {
  EXPO_PUSH_RECEIPTS_URL,
  ExpoPushChannel,
  type PushFetch,
  RECEIPT_CHECK,
  RECEIPT_CHECK_DELAY_MS,
  type RecipientGate,
  receiptCheckHandler,
  reminderHandler,
  scheduleReminderJob,
} from '@universityflow/messaging';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Database, rowsOf } from './client';
import {
  ConsentRequiredError,
  InvalidStateError,
  NotFoundError,
  PushTokenHeldError,
} from './errors';
import { PostgresJobScheduler } from './jobs';
import { Store } from './store';
import { signIn, smsCode, syntheticPhone, testDatabase } from './testing';

/**
 * Push tokens (Phase 4d, migration 0008) on real Postgres (PGlite): stored behind row-level
 * security and the consent gate, one learner per token (re-registering moves it), several phones
 * per learner, gone at sign-out, at opt-out and with the account; and the push reminder end to
 * end through the Expo adapter, against a fake Expo, including `DeviceNotRegistered`.
 */

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(async () => {
  await database.close();
});
beforeEach(async () => {
  await database.exec('delete from jobs');
});

let nextToken = 1;
/** A synthetic Expo push token, unique per call. */
const pushToken = () => `ExponentPushToken[test${String(nextToken++).padStart(10, '0')}]`;
const START = new Date('2026-10-13T08:00:00Z'); // 10:00 SAST

function harness() {
  let now = START;
  const clock = () => now;
  const store = new Store(database, {
    secret: 'test-secret-that-is-long-enough-for-hmac-keys',
    clock,
  });
  return {
    store,
    clock,
    advance(ms: number) {
      now = new Date(now.getTime() + ms);
    },
    async adult() {
      const session = await signIn(store, syntheticPhone());
      await store.setDateOfBirth(session.studentId, '2000-01-15');
      await store.consentAsAdult(session.studentId, 'adult-v1-test');
      return { ...session, student: store.forStudent(session.studentId) };
    },
    async minor() {
      const session = await signIn(store, syntheticPhone());
      await store.setDateOfBirth(session.studentId, '2011-03-02');
      return { ...session, student: store.forStudent(session.studentId) };
    },
  };
}

async function tokensOf(studentId: string): Promise<string[]> {
  const rows = rowsOf<{ token: string }>(
    await database.db.execute(
      sql`select token from push_tokens where student_id = ${studentId}::uuid`,
    ),
  );
  return rows.map((r) => r.token);
}

describe('push tokens', () => {
  it('registers a phone, several phones per learner, and counts them', async () => {
    const h = harness();
    const a = await h.adult();
    const [one, two] = [pushToken(), pushToken()];
    await a.student.registerPushToken({ token: one, platform: 'android', sessionToken: a.token });
    // A second phone, signed in separately.
    const again = await signInAgain(h, a.studentId);
    await a.student.registerPushToken({ token: two, platform: 'ios', sessionToken: again });
    expect((await tokensOf(a.studentId)).sort()).toEqual([one, two].sort());
    expect(await a.student.pushDeviceCount()).toBe(2);
    // Registering the same phone again changes nothing but its time.
    await a.student.registerPushToken({ token: one, platform: 'android', sessionToken: a.token });
    expect(await a.student.pushDeviceCount()).toBe(2);
  });

  it('A5-04: one token per session: a new registration on the same session replaces the old', async () => {
    const h = harness();
    const a = await h.adult();
    const [first, second] = [pushToken(), pushToken()];
    await a.student.registerPushToken({ token: first, platform: 'ios', sessionToken: a.token });
    h.advance(1000);
    await a.student.registerPushToken({ token: second, platform: 'ios', sessionToken: a.token });
    expect(await tokensOf(a.studentId)).toEqual([second]);
    // And the database holds to it, whatever the code above it does.
    await expect(
      database.exec(
        `insert into push_tokens (token, student_id, session_id, platform, created_at, updated_at)
         select '${pushToken()}', student_id, session_id, 'ios', now(), now()
         from push_tokens where token = '${second}'`,
      ),
    ).rejects.toThrow();
  });

  it('A5-04: at most five phones per learner: a sixth evicts the one registered longest ago', async () => {
    const h = harness();
    const a = await h.adult();
    const phones = [pushToken()];
    await a.student.registerPushToken({
      token: phones[0] as string,
      platform: 'ios',
      sessionToken: a.token,
    });
    for (let i = 1; i < 6; i += 1) {
      h.advance(5 * 60 * 1000); // past the PIN limits
      const session = await signInAgain(h, a.studentId);
      const token = pushToken();
      phones.push(token);
      await a.student.registerPushToken({ token, platform: 'android', sessionToken: session });
    }
    expect((await tokensOf(a.studentId)).sort()).toEqual(phones.slice(1).sort());
    expect(await a.student.pushDeviceCount()).toBe(5);
    const audit = rowsOf<{ action: string }>(
      await database.db.execute(
        sql`select action from audit_log where student_id = ${a.studentId}::uuid order by id`,
      ),
    );
    expect(audit.map((r) => r.action)).toContain('push.token-evicted');
  });

  it('A5-05: a token moves to another learner only once its holder’s session is over', async () => {
    const h = harness();
    const a = await h.adult();
    const b = await h.adult();
    const shared = pushToken();
    await a.student.registerPushToken({
      token: shared,
      platform: 'android',
      sessionToken: a.token,
    });
    // a is still signed in on it: no proof b's phone made it, so it stays a's.
    const refused = b.student.registerPushToken({
      token: shared,
      platform: 'android',
      sessionToken: b.token,
    });
    await expect(refused).rejects.toThrow(PushTokenHeldError);
    await expect(refused).rejects.toThrow(InvalidStateError);
    expect(await tokensOf(a.studentId)).toEqual([shared]);
    expect(await tokensOf(b.studentId)).toEqual([]);
    // a's session runs out (signing out deletes it, and the token with it): now it moves.
    await database.db.execute(
      sql`update sessions set expires_at = ${h.clock().toISOString()}::timestamptz
          where student_id = ${a.studentId}::uuid`,
    );
    await b.student.registerPushToken({
      token: shared,
      platform: 'android',
      sessionToken: b.token,
    });
    expect(await tokensOf(a.studentId)).toEqual([]);
    expect(await tokensOf(b.studentId)).toEqual([shared]);
    const audit = rowsOf<{ action: string }>(
      await database.db.execute(
        sql`select action from audit_log where student_id = ${a.studentId}::uuid order by id`,
      ),
    );
    expect(audit.map((r) => r.action)).toContain('push.token-moved');
  });

  it('refuses a minor without guardian consent, in the store and in the database (hard rule 5)', async () => {
    const h = harness();
    const m = await h.minor();
    await expect(
      m.student.registerPushToken({ token: pushToken(), platform: 'ios', sessionToken: m.token }),
    ).rejects.toThrow(ConsentRequiredError);
    expect(await tokensOf(m.studentId)).toEqual([]);
    // And the database itself refuses the row, whatever the code above it does.
    await expect(
      database.db.transaction(async (tx) => {
        await tx.execute(sql`select set_config('uf.student_id', ${m.studentId}, true)`);
        await tx.execute(sql`set local role uf_app`);
        await tx.execute(sql`
          insert into push_tokens (token, student_id, session_id, platform, created_at, updated_at)
          select ${pushToken()}, ${m.studentId}::uuid, id, 'ios', now(), now()
          from sessions where student_id = ${m.studentId}::uuid limit 1`);
      }),
    ).rejects.toThrow();
  });

  it('keeps each learner’s tokens from every other learner (row-level security)', async () => {
    const h = harness();
    const a = await h.adult();
    const b = await h.adult();
    const mine = pushToken();
    await a.student.registerPushToken({ token: mine, platform: 'ios', sessionToken: a.token });
    const seen = await database.db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('uf.student_id', ${b.studentId}, true)`);
      await tx.execute(sql`set local role uf_app`);
      return rowsOf<{ token: string }>(await tx.execute(sql`select token from push_tokens`));
    });
    expect(seen).toEqual([]);
    // Nor can b remove it.
    expect(await b.student.removePushToken(mine)).toBe(false);
    expect(await tokensOf(a.studentId)).toEqual([mine]);
  });

  it('refuses a malformed token or platform, another learner’s session, and an unknown one', async () => {
    const h = harness();
    const a = await h.adult();
    const b = await h.adult();
    await expect(
      a.student.registerPushToken({ token: 'nope', platform: 'ios', sessionToken: a.token }),
    ).rejects.toThrow(InvalidStateError);
    await expect(
      a.student.registerPushToken({
        token: pushToken(),
        platform: 'windows' as 'ios',
        sessionToken: a.token,
      }),
    ).rejects.toThrow(InvalidStateError);
    await expect(
      a.student.registerPushToken({ token: pushToken(), platform: 'ios', sessionToken: b.token }),
    ).rejects.toThrow(NotFoundError);
    await expect(
      a.student.registerPushToken({ token: pushToken(), platform: 'ios', sessionToken: 'x' }),
    ).rejects.toThrow(NotFoundError);
    // The database refuses a token against another learner's session, too.
    const bSession = rowsOf<{ id: string }>(
      await database.db.execute(
        sql`select id from sessions where student_id = ${b.studentId}::uuid`,
      ),
    )[0]?.id;
    await expect(
      database.exec(
        `insert into push_tokens (token, student_id, session_id, platform, created_at, updated_at)
         values ('${pushToken()}', '${a.studentId}', '${bSession}', 'ios', now(), now())`,
      ),
    ).rejects.toThrow(/own sessions/);
  });

  it('is removed at sign-out (with its session), when the phone turns it off, and at opt-out', async () => {
    const h = harness();
    const a = await h.adult();
    const [one, two, three] = [pushToken(), pushToken(), pushToken()];
    await a.student.registerPushToken({ token: one, platform: 'ios', sessionToken: a.token });
    await h.store.signOut(a.token);
    expect(await tokensOf(a.studentId)).toEqual([]);

    const s2 = await signInAgain(h, a.studentId);
    await a.student.registerPushToken({ token: two, platform: 'ios', sessionToken: s2 });
    expect(await a.student.removePushToken(two)).toBe(true);
    expect(await a.student.removePushToken(two)).toBe(false);
    expect(await a.student.removePushToken('junk')).toBe(false);

    await a.student.registerPushToken({ token: three, platform: 'ios', sessionToken: s2 });
    await a.student.setChannelOptIn('push', true);
    await a.student.setChannelOptIn('push', false);
    expect(await tokensOf(a.studentId)).toEqual([]);
  });

  it('can be removed after a guardian withdraws consent; deleted and exported with the account', async () => {
    const h = harness();
    const m = await h.minor();
    const { token: link } = await h.store.requestGuardianConsent(
      m.studentId,
      {
        name: 'Test Guardian',
        phone: syntheticPhone(),
        relationship: 'parent',
      },
      'v1',
    );
    await h.store.grantConsent(link);
    const t = pushToken();
    await m.student.registerPushToken({ token: t, platform: 'android', sessionToken: m.token });
    const exported = await m.student.exportAll();
    expect(exported.personal?.messaging.pushTokens).toEqual([
      expect.objectContaining({ token: t, platform: 'android' }),
    ]);
    expect(exported.personal?.messaging.pushTokens[0]).not.toHaveProperty('sessionId');

    // Withdrawal ends the learner's sessions, and their phones' tokens go with them; asking to
    // remove one afterwards is still allowed, and simply finds nothing.
    await h.store.withdrawConsent(link);
    expect(await tokensOf(m.studentId)).toEqual([]);
    expect(await m.student.removePushToken(t)).toBe(false);

    const a = await h.adult();
    const u = pushToken();
    await a.student.registerPushToken({ token: u, platform: 'ios', sessionToken: a.token });
    await a.student.deleteAccount();
    expect(await tokensOf(a.studentId)).toEqual([]);
  });
});

describe('the push gate and the push reminder', () => {
  it('mayMessage: only a token on a live session of a consented learner opted in to push', async () => {
    const h = harness();
    const messaging = h.store.messaging();
    const a = await h.adult();
    const t = pushToken();
    await a.student.registerPushToken({ token: t, platform: 'ios', sessionToken: a.token });
    expect(await messaging.mayMessage('push', t)).toBe(false); // not opted in yet
    await a.student.setChannelOptIn('push', true);
    expect(await messaging.mayMessage('push', t)).toBe(true);
    expect(await messaging.mayMessage('push', pushToken())).toBe(false);
    expect(await messaging.mayMessage('push', 'junk')).toBe(false);
    // A session that has expired doesn't count.
    h.advance(31 * 24 * 60 * 60 * 1000);
    expect(await messaging.mayMessage('push', t)).toBe(false);
  });

  it('sends a push reminder to every phone through Expo, and forgets a phone Expo says is gone', async () => {
    const h = harness();
    const messaging = h.store.messaging();
    const scheduler = new PostgresJobScheduler(database, { clock: h.clock });
    const a = await h.adult();
    const [phoneA, phoneB] = [pushToken(), pushToken()];
    await a.student.registerPushToken({ token: phoneA, platform: 'ios', sessionToken: a.token });
    const second = await signInAgain(h, a.studentId);
    h.advance(1000);
    await a.student.registerPushToken({ token: phoneB, platform: 'android', sessionToken: second });
    await a.student.setChannelOptIn('push', true);

    const accepted: Array<{ to: string; body: string }> = [];
    const receipts: Record<string, unknown> = {};
    const expo: PushFetch = async (url, init) => {
      if (url === EXPO_PUSH_RECEIPTS_URL) {
        return { ok: true, status: 200, json: async () => ({ data: receipts }) };
      }
      const messages = JSON.parse(init.body) as Array<{ to: string; body: string }>;
      const data = messages.map((message) => {
        accepted.push(message);
        return { status: 'ok', id: `ticket-${accepted.length}` };
      });
      return { ok: true, status: 200, json: async () => ({ data }) };
    };
    const gate: RecipientGate = (channel, to) => messaging.mayMessage(channel, to);
    const push = new ExpoPushChannel({
      gate,
      clock: h.clock,
      fetch: expo,
      forgetAddress: async (token) => void (await messaging.forgetPushToken(token)),
    });
    const channels = { push };
    const handler = reminderHandler({
      store: messaging,
      channels,
      scheduler,
      papers: { slotsFor: async () => [] },
      resolve: () => ({}),
      clock: h.clock,
    });
    const checks = receiptCheckHandler({ store: messaging, channels });

    const id = await a.student.createReminder({
      templateId: 'reminder.check-in',
      channel: 'push',
      desiredAt: h.clock(),
    });
    await a.student.setReminderJob(id, await scheduleReminderJob(scheduler, id, h.clock(), 0));
    await scheduler.runDue([handler, checks]);

    // Both phones, the most recent first; the lock-screen text has no name in it.
    expect(accepted.map((m) => m.to)).toEqual([phoneB, phoneA]);
    expect(accepted[0]?.body).not.toMatch(/Hi /);
    const [row] = rowsOf<{ status: string; receipt_id: string }>(
      await database.db.execute(
        sql`select status, receipt_id from reminders where id = ${id}::uuid`,
      ),
    );
    expect(row).toEqual({ status: 'sent', receipt_id: 'ticket-1' });

    // A quarter of an hour later the receipt says phone B is gone: its token is forgotten.
    receipts['ticket-1'] = {
      status: 'error',
      details: { error: 'DeviceNotRegistered', expoPushToken: phoneB },
    };
    receipts['ticket-2'] = { status: 'ok' };
    h.advance(RECEIPT_CHECK_DELAY_MS);
    await scheduler.runDue([handler, checks]);
    expect(await tokensOf(a.studentId)).toEqual([phoneA]);
    // Phone A still got it (A11-07: every phone's receipt counts).
    const [after] = rowsOf<{ delivery_status: string }>(
      await database.db.execute(sql`select delivery_status from reminders where id = ${id}::uuid`),
    );
    expect(after?.delivery_status).toBe('delivered');
    expect(await messaging.forgetPushToken('junk')).toBe(false);
    expect(await messaging.forgetPushToken(phoneB)).toBe(false);
  });

  it('A11-07: checks every phone’s receipt, and forgets a phone that is gone though its ticket was not the first', async () => {
    const h = harness();
    const s = await twoPhonesSent(h);
    // ticket-1 went to phone B (the most recent), ticket-2 to phone A.
    s.receipts['ticket-1'] = { status: 'ok' };
    s.receipts['ticket-2'] = { status: 'error', details: { error: 'DeviceNotRegistered' } };
    h.advance(RECEIPT_CHECK_DELAY_MS);
    await s.run();
    expect(await tokensOf(s.studentId)).toEqual([s.phoneB]);
    const [after] = rowsOf<{ delivery_status: string }>(
      await database.db.execute(
        sql`select delivery_status from reminders where id = ${s.reminderId}::uuid`,
      ),
    );
    expect(after?.delivery_status).toBe('delivered');
    // Checked: nothing is left for account deletion to cancel.
    expect(await s.student.scheduledJobIds()).toEqual([]);
  });

  it('A11-11: account deletion finds the pending receipt check, so a hosted scheduler can cancel it', async () => {
    const h = harness();
    const s = await twoPhonesSent(h);
    const jobIds = await s.student.scheduledJobIds();
    expect(jobIds).toHaveLength(1);
    const [receiptJob] = jobIds as [string];
    expect((await s.scheduler.get(receiptJob))?.kind).toBe(RECEIPT_CHECK.name);
    // What DELETE /api/me does: cancel each, then delete.
    for (const id of jobIds) expect(await s.scheduler.cancel(id)).toBe(true);
    expect((await s.scheduler.get(receiptJob))?.status).toBe('cancelled');
  });

  it('drops a push reminder for a learner with no phones', async () => {
    const h = harness();
    const messaging = h.store.messaging();
    const scheduler = new PostgresJobScheduler(database, { clock: h.clock });
    const a = await h.adult();
    await a.student.setChannelOptIn('push', true);
    const push = new ExpoPushChannel({
      gate: (c, to) => messaging.mayMessage(c, to),
      fetch: async () => {
        throw new Error('must not be called');
      },
    });
    const handler = reminderHandler({
      store: messaging,
      channels: { push },
      scheduler,
      papers: { slotsFor: async () => [] },
      resolve: () => ({}),
      clock: h.clock,
    });
    const id = await a.student.createReminder({
      templateId: 'reminder.check-in',
      channel: 'push',
      desiredAt: h.clock(),
    });
    await scheduleReminderJob(scheduler, id, h.clock(), 0);
    await scheduler.runDue([handler]);
    const [row] = rowsOf<{ status: string; outcome_reason: string }>(
      await database.db.execute(
        sql`select status, outcome_reason from reminders where id = ${id}::uuid`,
      ),
    );
    expect(row).toEqual({ status: 'dropped', outcome_reason: 'no-address' });
  });
});

/**
 * A learner with two phones (A, then B) and a push reminder already sent to both through a fake
 * Expo that issues ticket-1, ticket-2, … in order. Receipts are whatever the test sets.
 */
async function twoPhonesSent(h: ReturnType<typeof harness>) {
  const messaging = h.store.messaging();
  const scheduler = new PostgresJobScheduler(database, { clock: h.clock });
  const a = await h.adult();
  const [phoneA, phoneB] = [pushToken(), pushToken()];
  await a.student.registerPushToken({ token: phoneA, platform: 'ios', sessionToken: a.token });
  const second = await signInAgain(h, a.studentId);
  h.advance(1000);
  await a.student.registerPushToken({ token: phoneB, platform: 'android', sessionToken: second });
  await a.student.setChannelOptIn('push', true);
  const receipts: Record<string, unknown> = {};
  let next = 1;
  const push = new ExpoPushChannel({
    gate: (channel, to) => messaging.mayMessage(channel, to),
    clock: h.clock,
    fetch: async (url, init) => {
      if (url === EXPO_PUSH_RECEIPTS_URL) {
        return { ok: true, status: 200, json: async () => ({ data: receipts }) };
      }
      const messages = JSON.parse(init.body) as unknown[];
      const data = messages.map(() => ({ status: 'ok', id: `ticket-${next++}` }));
      return { ok: true, status: 200, json: async () => ({ data }) };
    },
    forgetAddress: async (token) => void (await messaging.forgetPushToken(token)),
  });
  const channels = { push };
  const handlers = [
    reminderHandler({
      store: messaging,
      channels,
      scheduler,
      papers: { slotsFor: async () => [] },
      resolve: () => ({}),
      clock: h.clock,
    }),
    receiptCheckHandler({ store: messaging, channels }),
  ];
  const reminderId = await a.student.createReminder({
    templateId: 'reminder.check-in',
    channel: 'push',
    desiredAt: h.clock(),
  });
  await a.student.setReminderJob(
    reminderId,
    await scheduleReminderJob(scheduler, reminderId, h.clock(), 0),
  );
  const run = () => scheduler.runDue(handlers);
  await run();
  return { ...a, phoneA, phoneB, receipts, scheduler, reminderId, run };
}

/** A second sign-in for the same learner (another phone): a new session token. */
async function signInAgain(
  h: { store: Store; advance(ms: number): void },
  studentId: string,
): Promise<string> {
  const [row] = rowsOf<{ phone: string }>(
    await database.db.execute(sql`select phone from students where id = ${studentId}::uuid`),
  );
  if (!row) throw new Error('no such student');
  h.advance(61_000); // past the PIN cooldown
  const code = smsCode(await h.store.requestOtp(row.phone));
  return (await h.store.verifyOtp(row.phone, code)).token;
}
