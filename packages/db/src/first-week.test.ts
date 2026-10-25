import { FIRST_WEEK_STEPS } from '@universityflow/content';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Database, rowsOf } from './client';
import { ConsentRequiredError, InvalidStateError } from './errors';
import { adultStudent, signIn, syntheticPhone, testDatabase, testStore } from './testing';

/**
 * The first-week checklist in the data layer (Phase 5b, migration 0019): personal data like any
 * other (row-level security, the consent gate, export, deletion, audit rows with ids only), kept
 * per learner and university, by content's step ids only.
 */

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(async () => {
  await database.close();
});

async function learner() {
  const { store, advance } = testStore(database);
  const { studentId } = await adultStudent(store);
  return { store, studentId, student: store.forStudent(studentId), advance };
}

async function audit(studentId: string) {
  return rowsOf<{ action: string; reason: string | null }>(
    await database.db.execute(
      sql`select action, reason from audit_log where student_id = ${studentId}::uuid and action like 'first-week.%' order by id`,
    ),
  );
}

describe('first-week steps', () => {
  it('are ticked with a time, per university, and unticked by deleting them, with audit rows', async () => {
    const { studentId, student, advance } = await learner();
    await student.setFirstWeekStep('wits', 'register', true);
    advance(60_000);
    await student.setFirstWeekStep('wits', 'student-card', true);
    await student.setFirstWeekStep('uj', 'register', true);
    const wits = await student.firstWeekSteps('wits');
    expect(wits.map((s) => s.step).sort()).toEqual(['register', 'student-card']);
    expect(wits.find((s) => s.step === 'register')?.doneAt).toEqual(
      new Date('2026-10-13T08:00:00Z'),
    );
    // Ticking again keeps the first time, and writes no second audit row.
    advance(60_000);
    await student.setFirstWeekStep('wits', 'register', true);
    expect(
      (await student.firstWeekSteps('wits')).find((s) => s.step === 'register')?.doneAt,
    ).toEqual(new Date('2026-10-13T08:00:00Z'));
    await student.setFirstWeekStep('wits', 'register', false);
    await student.setFirstWeekStep('wits', 'register', false);
    expect((await student.firstWeekSteps('wits')).map((s) => s.step)).toEqual(['student-card']);
    expect((await student.firstWeekSteps('uj')).map((s) => s.step)).toEqual(['register']);
    expect(await audit(studentId)).toEqual([
      { action: 'first-week.ticked', reason: 'register' },
      { action: 'first-week.ticked', reason: 'student-card' },
      { action: 'first-week.ticked', reason: 'register' },
      { action: 'first-week.unticked', reason: 'register' },
    ]);
  });

  it('take content’s steps and catalogue universities only (hard rule 4)', async () => {
    const { studentId, student } = await learner();
    for (const step of FIRST_WEEK_STEPS) await student.setFirstWeekStep('up', step, true);
    expect(await student.firstWeekSteps('up')).toHaveLength(FIRST_WEEK_STEPS.length);
    for (const [university, step] of [
      ['wits', 'call Thandi at res'],
      ['wits', 'toString'],
      ['harvard', 'register'],
      ['University of the Witwatersrand', 'register'],
    ] as const) {
      await expect(student.setFirstWeekStep(university, step, true)).rejects.toThrow(
        InvalidStateError,
      );
    }
    await expect(student.firstWeekSteps('harvard')).rejects.toThrow(InvalidStateError);
    // The database holds to it whatever the code above it does.
    for (const values of [`'wits', 'Call me'`, `'University', 'register'`, `'wits', ''`]) {
      await expect(
        database.exec(
          `insert into first_week_steps (student_id, university_id, step, done_at) values ('${studentId}', ${values}, now())`,
        ),
      ).rejects.toThrow();
    }
  });

  it("refuses a minor's steps before a guardian consents (hard rule 5)", async () => {
    const { store } = testStore(database);
    const { studentId } = await signIn(store, syntheticPhone());
    await store.setDateOfBirth(studentId, '2010-03-03');
    const student = store.forStudent(studentId);
    await expect(student.setFirstWeekStep('wits', 'register', true)).rejects.toThrow(
      ConsentRequiredError,
    );
    await expect(student.firstWeekSteps('wits')).rejects.toThrow(ConsentRequiredError);
  });

  it("keeps one learner's steps from another (row-level security)", async () => {
    const a = await learner();
    const b = await learner();
    await a.student.setFirstWeekStep('wits', 'register', true);
    expect(await b.student.firstWeekSteps('wits')).toEqual([]);
    // b unticking the same step touches only b's own (non-existent) row.
    await b.student.setFirstWeekStep('wits', 'register', false);
    expect(await a.student.firstWeekSteps('wits')).toHaveLength(1);
    const seen = await database.db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('uf.student_id', ${b.studentId}, true)`);
      await tx.execute(sql`set local role uf_app`);
      return rowsOf<{ n: number }>(
        await tx.execute(sql`select count(*)::int as n from first_week_steps`),
      );
    });
    expect(seen[0]?.n).toBe(0);
  });

  it('are exported, and deleted with the account', async () => {
    const { studentId, student } = await learner();
    await student.setFirstWeekStep('wits', 'check-modules', true);
    const exported = await student.exportAll();
    expect(exported.personal?.firstWeek).toEqual([
      expect.objectContaining({ universityId: 'wits', step: 'check-modules' }),
    ]);
    await student.deleteAccount();
    const left = rowsOf<{ n: number }>(
      await database.db.execute(
        sql`select count(*)::int as n from first_week_steps where student_id = ${studentId}::uuid`,
      ),
    );
    expect(left[0]?.n).toBe(0);
  });
});

describe('the SMS and WhatsApp crisis reply’s accepted university', () => {
  it('is the accepted offer’s university, read as the learner, and nothing for anyone else', async () => {
    const { store } = testStore(database);
    const phone = syntheticPhone();
    const { studentId } = await signIn(store, phone);
    await store.setDateOfBirth(studentId, '2000-01-15');
    await store.consentAsAdult(studentId, 'adult-v1-test');
    const student = store.forStudent(studentId);
    const messaging = store.messaging();
    expect(await messaging.acceptedOfferUniversity(phone)).toBeNull();
    const id = await student.addOffer({
      universityId: 'wits',
      programmeId: 'wits-bsc-computer-science',
      kind: 'final',
      replyBy: null,
      conditions: [],
    });
    expect(await messaging.acceptedOfferUniversity(phone)).toBeNull();
    await student.acceptOffer(id);
    expect(await messaging.acceptedOfferUniversity(phone)).toBe('wits');
    expect(await messaging.acceptedOfferUniversity(syntheticPhone())).toBeNull();
  });

  it('is nothing for a minor without a guardian’s consent (hard rule 5)', async () => {
    const { store } = testStore(database);
    const phone = syntheticPhone();
    const { studentId } = await signIn(store, phone);
    await store.setDateOfBirth(studentId, '2000-01-15');
    await store.consentAsAdult(studentId, 'adult-v1-test');
    const id = await store.forStudent(studentId).addOffer({
      universityId: 'uj',
      programmeId: 'uj-beng-civil',
      kind: 'final',
      replyBy: null,
      conditions: [],
    });
    await store.forStudent(studentId).acceptOffer(id);
    expect(await store.messaging().acceptedOfferUniversity(phone)).toBe('uj');
    // The same learner, now recorded as a minor with no guardian's consent: the gate refuses.
    await database.exec(
      `update students set date_of_birth = '2012-01-01', consent_status = 'pending' where id = '${studentId}'`,
    );
    expect(await store.messaging().acceptedOfferUniversity(phone)).toBeNull();
  });
});
