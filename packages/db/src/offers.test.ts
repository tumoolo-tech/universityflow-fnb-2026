import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Database, rowsOf } from './client';
import {
  ConsentRequiredError,
  InvalidStateError,
  NotFoundError,
  OfferConflictError,
  PersonalNumberError,
} from './errors';
import type { NewOffer } from './store';
import { adultStudent, signIn, syntheticPhone, testDatabase, testStore } from './testing';

/**
 * Offers in the data layer (Phase 5a, migration 0018): personal data like any other (row-level
 * security, the consent gate, export, deletion, audit rows with ids only), several per learner,
 * at most one accepted (held to it by the database itself), and a reply-by reminder that goes
 * when the offer is accepted, declined or deleted.
 */

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(async () => {
  await database.close();
});

const OFFER: NewOffer = {
  universityId: 'uj',
  programmeId: 'uj-beng-civil',
  kind: 'provisional',
  replyBy: '2027-12-15',
  conditions: ['Synthetic condition, as quoted.'],
};

async function learner() {
  const { store, advance } = testStore(database);
  const { studentId } = await adultStudent(store);
  return { store, studentId, student: store.forStudent(studentId), advance };
}

async function audit(studentId: string) {
  return rowsOf<{ action: string; reason: string | null }>(
    await database.db.execute(
      sql`select action, reason from audit_log where student_id = ${studentId}::uuid and (action like 'offer.%' or action like 'reminder.%') order by id`,
    ),
  );
}

describe('offers', () => {
  it('are recorded as confirmed, several per learner, oldest first, with audit rows (ids only)', async () => {
    const { studentId, student, advance } = await learner();
    const first = await student.addOffer(OFFER);
    advance(1000);
    const second = await student.addOffer({
      universityId: 'wits',
      programmeId: 'wits-bsc-computer-science',
      kind: 'waitlist',
      replyBy: null,
      conditions: [],
    });
    const list = await student.offers();
    expect(list.map((o) => o.id)).toEqual([first, second]);
    expect(list[0]).toMatchObject({
      universityId: 'uj',
      programmeId: 'uj-beng-civil',
      kind: 'provisional',
      source: 'learner',
      documentId: null,
      status: 'held',
      replyBy: '2027-12-15',
      conditions: ['Synthetic condition, as quoted.'],
      reminder: null,
    });
    expect(await audit(studentId)).toEqual([
      { action: 'offer.added', reason: 'learner' },
      { action: 'offer.added', reason: 'learner' },
    ]);
  });

  it('one per programme', async () => {
    const { student } = await learner();
    await student.addOffer(OFFER);
    await expect(student.addOffer({ ...OFFER, kind: 'final' })).rejects.toThrow(
      new OfferConflictError('offer-exists'),
    );
  });

  it('from a letter: the source says so, and the letter is marked confirmed', async () => {
    const { student } = await learner();
    const doc = await student.addDocument({
      kind: 'acceptance-letter',
      storageKey: `letter-${crypto.randomUUID()}`,
      mimeType: 'application/pdf',
      sizeBytes: 10,
    });
    await student.addOffer({ ...OFFER, documentId: doc?.id ?? null });
    const [offer] = await student.offers();
    expect(offer).toMatchObject({ source: 'letter', documentId: doc?.id });
    expect((await student.document(doc?.id ?? '')).status).toBe('confirmed');
    // The offer outlives the letter.
    await student.deleteDocument(doc?.id ?? '');
    expect((await student.offers())[0]).toMatchObject({ source: 'letter', documentId: null });
  });

  it('refuses another learner’s letter as its source', async () => {
    const a = await learner();
    const b = await learner();
    const doc = await b.student.addDocument({
      kind: 'acceptance-letter',
      storageKey: `letter-${crypto.randomUUID()}`,
      mimeType: 'application/pdf',
      sizeBytes: 10,
    });
    await expect(a.student.addOffer({ ...OFFER, documentId: doc?.id ?? null })).rejects.toThrow();
  });

  it('hold catalogue ids, known kinds and quoted conditions only (hard rule 4)', async () => {
    const { studentId, student } = await learner();
    for (const bad of [
      { ...OFFER, programmeId: 'Civil Engineering at UJ' },
      { ...OFFER, universityId: 'University of Johannesburg' },
      { ...OFFER, programmeId: 'wits-bsc-computer-science' },
      { ...OFFER, kind: 'accepted' as NewOffer['kind'] },
      { ...OFFER, replyBy: '15 December' },
      { ...OFFER, conditions: [''] },
      { ...OFFER, conditions: ['x'.repeat(501)] },
      { ...OFFER, conditions: ['two\nlines'] },
      { ...OFFER, conditions: Array.from({ length: 21 }, () => 'c') },
    ]) {
      await expect(student.addOffer(bad)).rejects.toThrow(InvalidStateError);
    }
    // The database holds to it whatever the code above it does.
    for (const values of [
      `'uj', 'uj-beng-civil', 'accepted', 'learner', '{}'`,
      `'uj', 'call me', 'final', 'learner', '{}'`,
      `'uj', 'uj-beng-civil', 'final', 'learner', array['two' || chr(10) || 'lines']`,
      `'uj', 'uj-beng-civil', 'final', 'phone', '{}'`,
    ]) {
      await expect(
        database.exec(
          `insert into offers (student_id, university_id, programme_id, kind, source, conditions, created_at, updated_at)
           values ('${studentId}', ${values}, now(), now())`,
        ),
      ).rejects.toThrow();
    }
    // Accepted with no time it was accepted, or a letter id on the learner's own word.
    for (const extra of [
      `status, created_at, updated_at) values ('${studentId}', 'uj', 'uj-beng-civil', 'final', 'learner', 'accepted', now(), now())`,
      `document_id, created_at, updated_at) values ('${studentId}', 'uj', 'uj-beng-civil', 'final', 'learner', gen_random_uuid(), now(), now())`,
    ]) {
      await expect(
        database.exec(
          `insert into offers (student_id, university_id, programme_id, kind, source, ${extra}`,
        ),
      ).rejects.toThrow();
    }
  });

  it('at most one accepted: the store says so, and so does the database', async () => {
    const { studentId, student, advance } = await learner();
    const a = await student.addOffer(OFFER);
    advance(1000);
    const b = await student.addOffer({
      ...OFFER,
      universityId: 'wits',
      programmeId: 'wits-bsc-computer-science',
    });
    await student.acceptOffer(a);
    await expect(student.acceptOffer(b)).rejects.toThrow(
      new OfferConflictError('another-accepted'),
    );
    // Accepting the accepted one again changes nothing.
    await student.acceptOffer(a);
    expect((await student.offers()).map((o) => o.status)).toEqual(['accepted', 'held']);
    // Two accepts racing: the advisory lock, and behind it the unique index.
    await student.declineOffer(a);
    const raced = await Promise.allSettled([student.acceptOffer(a), student.acceptOffer(b)]);
    expect(raced.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await student.offers()).filter((o) => o.status === 'accepted')).toHaveLength(1);
    await expect(
      database.exec(`update offers set status = 'accepted', accepted_at = now(), declined_at = null
        where student_id = '${studentId}'`),
    ).rejects.toThrow();
    // Declining the accepted one frees the other to be accepted.
    const accepted = (await student.offers()).find((o) => o.status === 'accepted');
    await student.declineOffer(accepted?.id ?? '');
    const other = (await student.offers()).find((o) => o.id !== accepted?.id);
    await student.acceptOffer(other?.id ?? '');
    expect((await student.offers()).find((o) => o.id === other?.id)).toMatchObject({
      status: 'accepted',
      declinedAt: null,
    });
  });

  it('dropping the reply-by reminder when accepted, declined or deleted, and handing back its job', async () => {
    for (const close of ['accept', 'decline', 'delete'] as const) {
      const { studentId, student } = await learner();
      const id = await student.addOffer(OFFER);
      const reminderId = await student.createReminder({
        templateId: 'offer.reply-by',
        channel: 'sms',
        desiredAt: new Date('2027-12-12T16:00:00Z'),
        params: { universityId: 'uj' },
      });
      const jobId = crypto.randomUUID();
      await student.setReminderJob(reminderId, jobId);
      await student.setOfferReminder(id, reminderId);
      expect((await student.offers())[0]?.reminder).toMatchObject({
        id: reminderId,
        status: 'scheduled',
      });

      const change =
        close === 'accept'
          ? await student.acceptOffer(id)
          : close === 'decline'
            ? await student.declineOffer(id)
            : await student.deleteOffer(id);
      expect(change.jobIds, close).toEqual([jobId]);
      const reminder = (await student.reminders()).find((r) => r.id === reminderId);
      expect(reminder, close).toMatchObject({ status: 'dropped', outcomeReason: 'offer-closed' });
      expect(await audit(studentId), close).toContainEqual({
        action: 'reminder.cancelled',
        reason: 'offer.reply-by',
      });
      // Nothing more to cancel the second time.
      if (close !== 'delete') {
        expect((await student.declineOffer(id)).jobIds).toEqual([]);
      } else {
        expect(await student.offers()).toEqual([]);
        await expect(student.deleteOffer(id)).rejects.toThrow(NotFoundError);
      }
    }
  });

  it('A11-18: declining or deleting the accepted offer drops its safety pushes and hands back their jobs', async () => {
    for (const close of ['decline', 'delete'] as const) {
      const { studentId, student } = await learner();
      const id = await student.addOffer(OFFER);
      await student.acceptOffer(id);
      const safety: Record<string, { reminderId: string; jobId: string }> = {};
      for (const templateId of ['safety.offer-accepted', 'safety.move-in']) {
        const reminderId = await student.createReminder({
          templateId,
          channel: 'push',
          desiredAt: new Date('2027-01-15T08:00:00Z'),
        });
        const jobId = crypto.randomUUID();
        await student.setReminderJob(reminderId, jobId);
        safety[templateId] = { reminderId, jobId };
      }
      // A reminder that is not about the place stays.
      const other = await student.createReminder({
        templateId: 'reminder.check-in',
        channel: 'push',
        desiredAt: new Date('2027-01-15T08:00:00Z'),
      });

      const change =
        close === 'decline' ? await student.declineOffer(id) : await student.deleteOffer(id);
      expect([...change.jobIds].sort(), close).toEqual(
        Object.values(safety)
          .map((s) => s.jobId)
          .sort(),
      );
      const reminders = await student.reminders();
      for (const [templateId, { reminderId }] of Object.entries(safety)) {
        expect(
          reminders.find((r) => r.id === reminderId),
          `${close} ${templateId}`,
        ).toMatchObject({ status: 'dropped', outcomeReason: 'offer-closed' });
        expect(await audit(studentId), close).toContainEqual({
          action: 'reminder.cancelled',
          reason: templateId,
        });
      }
      expect(reminders.find((r) => r.id === other)?.status, close).toBe('scheduled');
    }
  });

  it('A11-18: the safety pushes stay while an offer is still accepted', async () => {
    const { student, advance } = await learner();
    const accepted = await student.addOffer(OFFER);
    advance(1000);
    const held = await student.addOffer({
      ...OFFER,
      universityId: 'wits',
      programmeId: 'wits-bsc-computer-science',
    });
    await student.acceptOffer(accepted);
    const reminderId = await student.createReminder({
      templateId: 'safety.move-in',
      channel: 'push',
      desiredAt: new Date('2027-01-15T08:00:00Z'),
    });
    // Declining or deleting an offer that was never the accepted one changes nothing.
    expect((await student.declineOffer(held)).jobIds).toEqual([]);
    expect((await student.deleteOffer(held)).jobIds).toEqual([]);
    expect((await student.reminders()).find((r) => r.id === reminderId)?.status).toBe('scheduled');
  });

  /** A registration-day reminder with its job, as the app schedules one (5d, A1-33). */
  async function registrationDayReminder(student: Awaited<ReturnType<typeof learner>>['student']) {
    const reminderId = await student.createReminder({
      templateId: 'offer.registration-day',
      channel: 'sms',
      desiredAt: new Date('2027-01-11T16:00:00Z'),
      params: { universityId: 'uj' },
    });
    const jobId = crypto.randomUUID();
    await student.setReminderJob(reminderId, jobId);
    return { reminderId, jobId };
  }

  it('A1-33: accepting says whether it made the offer the accepted one', async () => {
    const { student } = await learner();
    const id = await student.addOffer(OFFER);
    expect((await student.acceptOffer(id)).newlyAccepted).toBe(true);
    // Accepting the accepted one again changes nothing, so nothing new is scheduled for it.
    expect((await student.acceptOffer(id)).newlyAccepted).toBe(false);
    expect((await student.declineOffer(id)).newlyAccepted).toBe(false);
    expect((await student.acceptOffer(id)).newlyAccepted).toBe(true);
    expect((await student.deleteOffer(id)).newlyAccepted).toBe(false);
  });

  it('A1-33: the registration-day reminder is kept on the accepted offer, with its state, and audited (ids only)', async () => {
    const { studentId, student } = await learner();
    const id = await student.addOffer(OFFER);
    await student.acceptOffer(id);
    expect((await student.offers())[0]?.registrationReminder).toBeNull();
    const { reminderId } = await registrationDayReminder(student);
    expect(await student.setOfferRegistrationReminder(id, reminderId)).toEqual({
      jobIds: [],
      kept: true,
    });
    expect((await student.offers())[0]?.registrationReminder).toEqual({
      id: reminderId,
      status: 'scheduled',
      desiredAt: new Date('2027-01-11T16:00:00Z'),
    });
    // The reply-by reminder is another thing.
    expect((await student.offers())[0]?.reminder).toBeNull();
    expect(await audit(studentId)).toContainEqual({
      action: 'offer.registration-reminder-set',
      reason: null,
    });
  });

  it('A1-33: declining or deleting the accepted offer drops its registration-day reminder and hands back its job', async () => {
    for (const close of ['decline', 'delete'] as const) {
      const { studentId, student } = await learner();
      const id = await student.addOffer(OFFER);
      await student.acceptOffer(id);
      const { reminderId, jobId } = await registrationDayReminder(student);
      await student.setOfferRegistrationReminder(id, reminderId);

      const change =
        close === 'decline' ? await student.declineOffer(id) : await student.deleteOffer(id);
      expect(change.jobIds, close).toEqual([jobId]);
      expect(
        (await student.reminders()).find((r) => r.id === reminderId),
        close,
      ).toMatchObject({ status: 'dropped', outcomeReason: 'offer-closed' });
      expect(await audit(studentId), close).toContainEqual({
        action: 'reminder.cancelled',
        reason: 'offer.registration-day',
      });
      if (close === 'decline') {
        // Dropped, the offer still shows it as such; nothing more to cancel the second time.
        expect((await student.offers())[0]?.registrationReminder?.status).toBe('dropped');
        expect((await student.declineOffer(id)).jobIds).toEqual([]);
      }
    }
  });

  it('A1-33: accepting another offer means declining this one first, which drops it', async () => {
    const { student, advance } = await learner();
    const a = await student.addOffer(OFFER);
    advance(1000);
    const b = await student.addOffer({
      ...OFFER,
      universityId: 'wits',
      programmeId: 'wits-bsc-computer-science',
    });
    await student.acceptOffer(a);
    const { reminderId } = await registrationDayReminder(student);
    await student.setOfferRegistrationReminder(a, reminderId);
    // Refused while a is accepted: the reminder stays.
    await expect(student.acceptOffer(b)).rejects.toThrow(OfferConflictError);
    const status = async () => (await student.reminders()).find((r) => r.id === reminderId)?.status;
    expect(await status()).toBe('scheduled');
    // Declining or deleting an offer that isn't the accepted one leaves it too.
    expect((await student.declineOffer(b)).jobIds).toEqual([]);
    expect(await status()).toBe('scheduled');
    await student.declineOffer(a);
    expect(await status()).toBe('dropped');
    await student.acceptOffer(b);
    expect((await student.offers()).find((o) => o.id === b)?.registrationReminder).toBeNull();
  });

  it('A1-33: a reminder for an offer that is no longer the accepted one is dropped, never kept', async () => {
    for (const state of ['held', 'declined', 'deleted'] as const) {
      const { student } = await learner();
      const id = await student.addOffer(OFFER);
      if (state !== 'held') await student.acceptOffer(id);
      if (state === 'declined') await student.declineOffer(id);
      if (state === 'deleted') await student.deleteOffer(id);
      // As if the learner declined between the accept and the reminder being scheduled.
      const { reminderId, jobId } = await registrationDayReminder(student);
      expect(await student.setOfferRegistrationReminder(id, reminderId), state).toEqual({
        jobIds: [jobId],
        kept: false,
      });
      expect(
        (await student.reminders()).find((r) => r.id === reminderId),
        state,
      ).toMatchObject({ status: 'dropped', outcomeReason: 'offer-closed' });
      if (state !== 'deleted') {
        expect((await student.offers())[0]?.registrationReminder, state).toBeNull();
      }
    }
  });

  it('A1-33: a second registration-day reminder replaces the first', async () => {
    const { student } = await learner();
    const id = await student.addOffer(OFFER);
    await student.acceptOffer(id);
    const first = await registrationDayReminder(student);
    await student.setOfferRegistrationReminder(id, first.reminderId);
    const second = await registrationDayReminder(student);
    expect((await student.setOfferRegistrationReminder(id, second.reminderId)).jobIds).toEqual([
      first.jobId,
    ]);
    const reminders = await student.reminders();
    expect(reminders.find((r) => r.id === first.reminderId)).toMatchObject({
      status: 'dropped',
      outcomeReason: 'replaced',
    });
    expect((await student.offers())[0]?.registrationReminder?.id).toBe(second.reminderId);
  });

  it('A1-33: refuses another learner’s reminder as the registration-day reminder, in the store and the database', async () => {
    const a = await learner();
    const b = await learner();
    const id = await a.student.addOffer(OFFER);
    await a.student.acceptOffer(id);
    const theirs = await b.student.createReminder({
      templateId: 'offer.registration-day',
      channel: 'sms',
      desiredAt: new Date('2027-01-11T16:00:00Z'),
      params: { universityId: 'uj' },
    });
    await expect(a.student.setOfferRegistrationReminder(id, theirs)).rejects.toThrow();
    await expect(
      database.exec(`update offers set registration_reminder_id = '${theirs}' where id = '${id}'`),
    ).rejects.toThrow();
    // b can't set one on a's offer: row-level security hides it, and the reminder is dropped.
    const own = await b.student.createReminder({
      templateId: 'offer.registration-day',
      channel: 'sms',
      desiredAt: new Date('2027-01-11T16:00:00Z'),
      params: { universityId: 'uj' },
    });
    await b.student.setOfferRegistrationReminder(id, own);
    expect((await a.student.offers())[0]?.registrationReminder).toBeNull();
    expect((await b.student.reminders()).find((r) => r.id === own)?.status).toBe('dropped');
  });

  it('A1-33: the registration-day reminder is in the export, and goes with the account', async () => {
    const { studentId, student } = await learner();
    const id = await student.addOffer(OFFER);
    await student.acceptOffer(id);
    const { reminderId } = await registrationDayReminder(student);
    await student.setOfferRegistrationReminder(id, reminderId);
    const exported = await student.exportAll();
    expect(exported.personal?.offers).toEqual([
      expect.objectContaining({ id, registrationReminderId: reminderId }),
    ]);
    expect(exported.personal?.messaging.reminders).toContainEqual(
      expect.objectContaining({ id: reminderId, templateId: 'offer.registration-day' }),
    );
    await student.deleteAccount();
    const [row] = rowsOf<{ n: number }>(
      await database.db.execute(
        sql`select count(*)::int as n from reminders where student_id = ${studentId}::uuid`,
      ),
    );
    expect(row?.n).toBe(0);
  });

  it('A11-17: refuses an ID number or a student number in a quoted condition, in the store and the database', async () => {
    const { studentId, student } = await learner();
    for (const condition of [
      'Applicant 1234567890123: pass Mathematics',
      'ID 123456 7890 123',
      'Student number 22012345 must register by the date given',
      'Student no. 2201234',
      'Ref: 1234567',
      'Your applicant number is 220123456.',
    ]) {
      await expect(
        student.addOffer({ ...OFFER, conditions: [condition] }),
        condition,
      ).rejects.toBeInstanceOf(PersonalNumberError);
      await expect(
        database.exec(
          `insert into offers (student_id, university_id, programme_id, kind, source, conditions, created_at, updated_at)
           values ('${studentId}', 'uj', 'uj-beng-civil', 'final', 'learner', array['${condition}'], now(), now())`,
        ),
        condition,
      ).rejects.toThrow();
    }
    // Ordinary conditions, with marks, dates, module codes and a phone number, are kept as quoted.
    const kept = [
      'Obtain at least 60% for Mathematics in the final NSC examinations',
      'Pass TEST1018A and TEST1036 by 30 November 2027',
      'Submit a certified copy of your ID document',
      'Call 021 000 0000 if you have questions',
      'No later than 15 January 2027',
    ];
    await student.addOffer({ ...OFFER, conditions: kept });
    expect((await student.offers())[0]?.conditions).toEqual(kept);
  });

  it('a reminder sent already is left as it is', async () => {
    const { store, student } = await learner();
    const id = await student.addOffer(OFFER);
    const reminderId = await student.createReminder({
      templateId: 'offer.reply-by',
      channel: 'sms',
      desiredAt: new Date('2026-10-13T08:00:00Z'),
      params: { universityId: 'uj' },
    });
    await student.setOfferReminder(id, reminderId);
    await database.exec(
      `update reminders set status = 'sent', sent_at = now() where id = '${reminderId}'`,
    );
    expect((await student.acceptOffer(id)).jobIds).toEqual([]);
    expect((await store.messaging().reminder(reminderId))?.status).toBe('sent');
  });

  it('refuses another learner’s reminder on an offer', async () => {
    const a = await learner();
    const b = await learner();
    const id = await a.student.addOffer(OFFER);
    const theirs = await b.student.createReminder({
      templateId: 'reminder.check-in',
      channel: 'sms',
      desiredAt: new Date('2027-01-01T08:00:00Z'),
    });
    await expect(a.student.setOfferReminder(id, theirs)).rejects.toThrow();
  });

  it("refuses a minor's offers before a guardian consents (hard rule 5)", async () => {
    const { store } = testStore(database);
    const { studentId } = await signIn(store, syntheticPhone());
    await store.setDateOfBirth(studentId, '2010-03-03');
    const student = store.forStudent(studentId);
    await expect(student.addOffer(OFFER)).rejects.toThrow(ConsentRequiredError);
    await expect(student.offers()).rejects.toThrow(ConsentRequiredError);
  });

  it("keeps one learner's offers from another (row-level security)", async () => {
    const a = await learner();
    const b = await learner();
    const id = await a.student.addOffer(OFFER);
    expect(await b.student.offers()).toEqual([]);
    await expect(b.student.acceptOffer(id)).rejects.toThrow(NotFoundError);
    await expect(b.student.deleteOffer(id)).rejects.toThrow(NotFoundError);
    const seen = await database.db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('uf.student_id', ${b.studentId}, true)`);
      await tx.execute(sql`set local role uf_app`);
      return rowsOf<{ n: number }>(await tx.execute(sql`select count(*)::int as n from offers`));
    });
    expect(seen[0]?.n).toBe(0);
    expect(await a.student.offers()).toHaveLength(1);
  });

  it('are exported, and deleted with the account', async () => {
    const { studentId, student } = await learner();
    await student.addOffer(OFFER);
    const exported = await student.exportAll();
    expect(exported.personal?.offers).toEqual([
      expect.objectContaining({
        programmeId: 'uj-beng-civil',
        kind: 'provisional',
        conditions: ['Synthetic condition, as quoted.'],
      }),
    ]);
    await student.deleteAccount();
    const [row] = rowsOf<{ n: number }>(
      await database.db.execute(
        sql`select count(*)::int as n from offers where student_id = ${studentId}::uuid`,
      ),
    );
    expect(row?.n).toBe(0);
  });
});
