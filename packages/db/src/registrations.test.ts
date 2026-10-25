import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Database, rowsOf } from './client';
import {
  ConsentRequiredError,
  InvalidStateError,
  NotFoundError,
  PersonalNumberError,
} from './errors';
import type { NewRegistration } from './store';
import { adultStudent, signIn, syntheticPhone, testDatabase, testStore } from './testing';

/**
 * Confirmed registrations in the data layer (Phase 5c, migration 0020): personal data like any
 * other (row-level security, the consent gate, export, deletion, audit rows with ids only), one
 * per academic year, replaced when confirmed again, with a change-deadline reminder that goes when
 * the registration is replaced or deleted. No student number is stored, anywhere (D4).
 */

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(async () => {
  await database.close();
});

const REGISTRATION: NewRegistration = {
  universityId: 'up',
  programmeId: 'up-bsc-test',
  academicYear: 2027,
  yearOfStudy: 1,
  modules: [
    { code: 'TEST101', name: 'Synthetic one', term: 'S1', credits: 16 },
    { code: 'TEST102', name: null, term: null, credits: null },
  ],
};

async function learner() {
  const { store, advance } = testStore(database);
  const { studentId } = await adultStudent(store);
  return { store, studentId, student: store.forStudent(studentId), advance };
}

async function audit(studentId: string) {
  return rowsOf<{ action: string; reason: string | null }>(
    await database.db.execute(
      sql`select action, reason from audit_log where student_id = ${studentId}::uuid and (action like 'registration.%' or action like 'reminder.%') order by id`,
    ),
  );
}

async function proof(student: Awaited<ReturnType<typeof learner>>['student']) {
  const doc = await student.addDocument({
    kind: 'proof-of-registration',
    storageKey: `proof-${crypto.randomUUID()}`,
    mimeType: 'application/pdf',
    sizeBytes: 10,
  });
  return doc?.id ?? '';
}

describe('registrations', () => {
  it('are recorded as confirmed, with audit rows (ids only)', async () => {
    const { studentId, student } = await learner();
    expect(await student.registration()).toBeNull();
    const { id, jobIds } = await student.saveRegistration(REGISTRATION);
    expect(jobIds).toEqual([]);
    expect(await student.registration()).toMatchObject({
      id,
      universityId: 'up',
      programmeId: 'up-bsc-test',
      academicYear: 2027,
      yearOfStudy: 1,
      modules: REGISTRATION.modules,
      documentId: null,
      reminder: null,
    });
    expect(await audit(studentId)).toEqual([
      { action: 'registration.confirmed', reason: 'learner' },
    ]);
  });

  it('one per academic year: confirming again replaces it; the latest year is the one read', async () => {
    const { student } = await learner();
    const first = await student.saveRegistration(REGISTRATION);
    const again = await student.saveRegistration({
      ...REGISTRATION,
      modules: [{ code: 'TEST103', name: null, term: 'Y', credits: 32 }],
    });
    expect(again.id).toBe(first.id);
    expect((await student.registration())?.modules).toEqual([
      { code: 'TEST103', name: null, term: 'Y', credits: 32 },
    ]);
    await student.saveRegistration({ ...REGISTRATION, academicYear: 2028, yearOfStudy: 2 });
    expect((await student.registration())?.academicYear).toBe(2028);
  });

  it('from a proof: the proof is marked confirmed, and the registration outlives it', async () => {
    const { studentId, student } = await learner();
    const documentId = await proof(student);
    await student.saveRegistration({ ...REGISTRATION, documentId });
    expect((await student.registration())?.documentId).toBe(documentId);
    expect((await student.document(documentId)).status).toBe('confirmed');
    expect(await audit(studentId)).toEqual([{ action: 'registration.confirmed', reason: 'proof' }]);
    await student.deleteDocument(documentId);
    expect((await student.registration())?.documentId).toBeNull();
  });

  it('A11-17: refuses an ID number or a student number in a module name or code, in the store and the database', async () => {
    const { studentId, student } = await learner();
    for (const module of [
      { code: 'TEST101', name: 'Student no 22012345' },
      { code: 'TEST101', name: 'ID 1234567890123' },
      { code: 'TEST101', name: 'Synthetic one (student number: 220123456)' },
      { code: '1234567890123', name: null },
    ]) {
      const row = { ...module, term: null, credits: null };
      await expect(
        student.saveRegistration({ ...REGISTRATION, modules: [row] }),
        JSON.stringify(module),
      ).rejects.toBeInstanceOf(PersonalNumberError);
      await expect(
        database.exec(
          `insert into registrations (student_id, university_id, programme_id, academic_year, modules, confirmed_at, updated_at)
           values ('${studentId}', 'up', 'up-bsc-test', 2030, '${JSON.stringify([row])}', now(), now())`,
        ),
        JSON.stringify(module),
      ).rejects.toThrow();
    }
    // Ordinary module codes and names, numbers in them included, are kept as confirmed.
    const kept = [
      { code: 'TEST1018A', name: 'Synthetic module one', term: 'S1', credits: 18 },
      { code: 'TEST 1036', name: 'Synthetic module II', term: 'S1', credits: 18 },
      { code: 'TEST-2027/1', name: 'Synthetic module 1001 (part 2)', term: 'Y', credits: 32 },
    ] as const;
    await student.saveRegistration({ ...REGISTRATION, modules: kept });
    expect((await student.registration())?.modules).toEqual(kept);
  });

  it('refuses another learner’s proof, or reminder', async () => {
    const a = await learner();
    const b = await learner();
    const theirs = await proof(b.student);
    await expect(
      a.student.saveRegistration({ ...REGISTRATION, documentId: theirs }),
    ).rejects.toThrow();
    const { id } = await a.student.saveRegistration(REGISTRATION);
    const reminder = await b.student.createReminder({
      templateId: 'reminder.check-in',
      channel: 'sms',
      desiredAt: new Date('2027-01-01T08:00:00Z'),
    });
    await expect(a.student.setRegistrationReminder(id, reminder)).rejects.toThrow();
  });

  it('hold catalogue ids, known terms and module rows only (hard rule 4)', async () => {
    const { studentId, student } = await learner();
    const row = REGISTRATION.modules[0] as NewRegistration['modules'][number];
    for (const bad of [
      { ...REGISTRATION, programmeId: 'BSc at UP' },
      { ...REGISTRATION, universityId: 'University of Pretoria' },
      { ...REGISTRATION, programmeId: 'wits-bsc-test' },
      { ...REGISTRATION, academicYear: 27 },
      { ...REGISTRATION, yearOfStudy: 0 },
      { ...REGISTRATION, modules: [] },
      { ...REGISTRATION, modules: Array.from({ length: 41 }, () => row) },
      { ...REGISTRATION, modules: [{ ...row, code: '*?' }] },
      { ...REGISTRATION, modules: [{ ...row, term: 'either' }] },
      { ...REGISTRATION, modules: [{ ...row, credits: 300 }] },
      { ...REGISTRATION, modules: [{ ...row, name: 'two\nlines' }] },
      { ...REGISTRATION, modules: [{ ...row, studentNumber: '12345678' }] },
    ] as NewRegistration[]) {
      await expect(student.saveRegistration(bad)).rejects.toThrow(InvalidStateError);
    }
    // The database holds to it whatever the code above it does.
    const insert = (programme: string, year: string, modules: string) =>
      database.exec(
        `insert into registrations (student_id, university_id, programme_id, academic_year, modules, confirmed_at, updated_at)
         values ('${studentId}', 'up', '${programme}', ${year}, '${modules}'::jsonb, now(), now())`,
      );
    for (const [programme, year, modules] of [
      ['wits-bsc-test', '2027', '[{"code":"TEST101"}]'],
      ['up-bsc-test', '1999', '[{"code":"TEST101"}]'],
      ['up-bsc-test', '2027', '[]'],
      ['up-bsc-test', '2027', '{"code":"TEST101"}'],
      ['up-bsc-test', '2027', '[{"code":"*?"}]'],
      ['up-bsc-test', '2027', '[{"code":"TEST101","term":"either"}]'],
      ['up-bsc-test', '2027', '[{"code":"TEST101","credits":-1}]'],
      ['up-bsc-test', '2027', '[{"code":"TEST101","credits":"16"}]'],
      ['up-bsc-test', '2027', '[{"code":"TEST101","name":""}]'],
      ['up-bsc-test', '2027', '[{"code":"TEST101","studentNumber":"12345678"}]'],
      ['up-bsc-test', '2027', '["TEST101"]'],
    ] as Array<[string, string, string]>) {
      await expect(insert(programme, year, modules), modules).rejects.toThrow();
    }
    await insert('up-bsc-test', '2027', '[{"code":"TEST101","name":null,"term":"Y","credits":0}]');
  });

  it('has no column for a student number, ID number, name, address or fees (D4)', async () => {
    const columns = rowsOf<{ column_name: string }>(
      await database.db.execute(
        sql`select column_name from information_schema.columns where table_name = 'registrations'`,
      ),
    ).map((c) => c.column_name);
    expect(columns.sort()).toEqual(
      [
        'academic_year',
        'confirmed_at',
        'document_id',
        'id',
        'modules',
        'programme_id',
        'reminder_id',
        'student_id',
        'university_id',
        'updated_at',
        'year_of_study',
      ].sort(),
    );
  });

  it('drops the change-deadline reminder when replaced or deleted, and hands back its job', async () => {
    for (const close of ['replace', 'delete'] as const) {
      const { studentId, student } = await learner();
      const { id } = await student.saveRegistration(REGISTRATION);
      const reminderId = await student.createReminder({
        templateId: 'reminder.check-in',
        channel: 'sms',
        desiredAt: new Date('2027-02-16T16:00:00Z'),
      });
      const jobId = crypto.randomUUID();
      await student.setReminderJob(reminderId, jobId);
      await student.setRegistrationReminder(id, reminderId);
      expect((await student.registration())?.reminder).toMatchObject({
        id: reminderId,
        status: 'scheduled',
      });

      const change =
        close === 'replace'
          ? await student.saveRegistration(REGISTRATION)
          : await student.deleteRegistration(id);
      expect(change.jobIds, close).toEqual([jobId]);
      const reminder = (await student.reminders()).find((r) => r.id === reminderId);
      expect(reminder, close).toMatchObject({
        status: 'dropped',
        outcomeReason: 'registration-changed',
      });
      expect(await audit(studentId), close).toContainEqual({
        action: 'reminder.cancelled',
        reason: 'reminder.check-in',
      });
      if (close === 'replace') {
        expect((await student.registration())?.reminder).toBeNull();
        expect((await student.saveRegistration(REGISTRATION)).jobIds).toEqual([]);
      } else {
        expect(await student.registration()).toBeNull();
        await expect(student.deleteRegistration(id)).rejects.toThrow(NotFoundError);
      }
    }
  });

  it("refuses a minor's registration before a guardian consents (hard rule 5)", async () => {
    const { store } = testStore(database);
    const { studentId } = await signIn(store, syntheticPhone());
    await store.setDateOfBirth(studentId, '2010-03-03');
    const student = store.forStudent(studentId);
    await expect(student.saveRegistration(REGISTRATION)).rejects.toThrow(ConsentRequiredError);
    await expect(student.registration()).rejects.toThrow(ConsentRequiredError);
  });

  it("keeps one learner's registration from another (row-level security)", async () => {
    const a = await learner();
    const b = await learner();
    const { id } = await a.student.saveRegistration(REGISTRATION);
    expect(await b.student.registration()).toBeNull();
    await expect(b.student.deleteRegistration(id)).rejects.toThrow(NotFoundError);
    await expect(b.student.setRegistrationReminder(id, crypto.randomUUID())).rejects.toThrow();
    const seen = await database.db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('uf.student_id', ${b.studentId}, true)`);
      await tx.execute(sql`set local role uf_app`);
      return rowsOf<{ n: number }>(
        await tx.execute(sql`select count(*)::int as n from registrations`),
      );
    });
    expect(seen[0]?.n).toBe(0);
    expect(await a.student.registration()).not.toBeNull();
  });

  it('are exported, and deleted with the account', async () => {
    const { studentId, student } = await learner();
    await student.saveRegistration(REGISTRATION);
    const exported = await student.exportAll();
    expect(exported.personal?.registrations).toEqual([
      expect.objectContaining({
        programmeId: 'up-bsc-test',
        academicYear: 2027,
        modules: REGISTRATION.modules,
      }),
    ]);
    expect(JSON.stringify(exported.personal?.registrations)).not.toMatch(/studentNumber|idNumber/);
    await student.deleteAccount();
    const [row] = rowsOf<{ n: number }>(
      await database.db.execute(
        sql`select count(*)::int as n from registrations where student_id = ${studentId}::uuid`,
      ),
    );
    expect(row?.n).toBe(0);
  });
});
