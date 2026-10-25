import { catalogueView, examPapersForSuppression } from '@universityflow/catalogue';
import { nextAllowedSend } from '@universityflow/messaging';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Database, rowsOf } from './client';
import { ConsentRequiredError, InvalidStateError } from './errors';
import { TimetablePaperSlots } from './papers';
import { adultStudent, signIn, syntheticPhone, testDatabase, testStore } from './testing';

/**
 * Phase 4b in the data layer: the learner's goal and their exam-subject choices are personal
 * data like any other (row-level security, the consent gate, export, delete), and the papers the
 * reminder pipeline avoids come only from confirmed subjects (hard rule 6).
 */

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(async () => {
  await database.close();
});

const OCT_2026 = new Date('2026-10-01T08:00:00Z');
const END_2026 = new Date('2026-12-01T08:00:00Z');
/** As the app wires it in preview: drafts shown, and every sourced paper held. */
const timetable = {
  shown: () => catalogueView(OCT_2026, { includeDrafts: true }).examPapers,
  forSuppression: () => examPapersForSuppression(),
};
const startsOf = (slots: ReadonlyArray<{ startsAt: Date }>) =>
  slots.map((s) => s.startsAt.toISOString());

async function count(table: string, studentId: string) {
  const [row] = rowsOf<{ n: number }>(
    await database.db.execute(
      sql`select count(*)::int as n from ${sql.identifier(table)} where student_id = ${studentId}::uuid`,
    ),
  );
  return row?.n;
}

describe('the goal', () => {
  it('is set, changed and cleared, with an audit row each time (ids only)', async () => {
    const { store } = testStore(database);
    const { studentId } = await adultStudent(store);
    const student = store.forStudent(studentId);
    expect(await student.goal()).toBeNull();
    const first = await student.setGoal('uj-beng-civil');
    expect(first.programmeId).toBe('uj-beng-civil');
    await student.setGoal('wits-bsc-computer-science');
    expect((await student.goal())?.programmeId).toBe('wits-bsc-computer-science');
    expect((await student.goal())?.setAt).toEqual(first.setAt);
    await student.clearGoal();
    expect(await student.goal()).toBeNull();
    const audit = rowsOf<{ action: string; reason: string | null }>(
      await database.db.execute(
        sql`select action, reason from audit_log where student_id = ${studentId}::uuid and action like 'goal.%' order by id`,
      ),
    );
    expect(audit).toEqual([
      { action: 'goal.set', reason: null },
      { action: 'goal.set', reason: null },
      { action: 'goal.cleared', reason: null },
    ]);
  });

  it('holds a catalogue id only, never free text (hard rule 4)', async () => {
    const { store } = testStore(database);
    const { studentId } = await adultStudent(store);
    const student = store.forStudent(studentId);
    for (const bad of ['Civil Engineering at UJ', 'UJ-BENG', '', 'a', 'x'.repeat(81)]) {
      await expect(student.setGoal(bad)).rejects.toThrow(InvalidStateError);
    }
    await expect(
      database.db.execute(
        sql`insert into goals (student_id, programme_id, set_at, updated_at) values (${studentId}::uuid, 'call me on 082', now(), now())`,
      ),
    ).rejects.toThrow();
  });

  it("refuses a minor's goal before a guardian consents (hard rule 5)", async () => {
    const { store } = testStore(database);
    const { studentId } = await signIn(store, syntheticPhone());
    await store.setDateOfBirth(studentId, '2010-03-03');
    const student = store.forStudent(studentId);
    await expect(student.setGoal('uj-beng-civil')).rejects.toThrow(ConsentRequiredError);
    await expect(student.goal()).rejects.toThrow(ConsentRequiredError);
    await expect(student.setExamSubjectChoice('mathematics', true)).rejects.toThrow(
      ConsentRequiredError,
    );
    expect(await store.messaging().examInputs(studentId)).toBeNull();
  });

  it("keeps one learner's goal from another (row-level security)", async () => {
    const { store } = testStore(database);
    const a = store.forStudent((await adultStudent(store)).studentId);
    const b = store.forStudent((await adultStudent(store)).studentId);
    await a.setGoal('uj-beng-civil');
    expect(await b.goal()).toBeNull();
    await b.clearGoal();
    expect((await a.goal())?.programmeId).toBe('uj-beng-civil');
  });

  it('is exported, and deleted with the account', async () => {
    const { store } = testStore(database);
    const { studentId } = await adultStudent(store);
    const student = store.forStudent(studentId);
    await student.setGoal('uj-beng-civil');
    await student.setExamSubjectChoice('mathematical-literacy', true);
    const exported = await student.exportAll();
    expect(exported.personal?.goal).toMatchObject({ programmeId: 'uj-beng-civil' });
    expect(exported.personal?.examSubjectChoices).toEqual([
      expect.objectContaining({ subject: 'mathematical-literacy', included: true }),
    ]);
    await student.deleteAccount();
    expect(await count('goals', studentId)).toBe(0);
    expect(await count('exam_subject_choices', studentId)).toBe(0);
  });
});

describe('exam subjects and papers', () => {
  async function learner(grade: number | null) {
    const { store } = testStore(database);
    const { studentId } = await adultStudent(store);
    const student = store.forStudent(studentId);
    if (grade !== null) await student.updateProfile({ grade });
    const source = new TimetablePaperSlots(store.messaging(), timetable);
    return { store, studentId, student, source };
  }

  it('stores only the learner’s own changes, and refuses anything but an NSC subject', async () => {
    const { student } = await learner(12);
    await student.setExamSubjectChoice('mathematics', false);
    await student.setExamSubjectChoice('tourism', true);
    expect(await student.examSubjectChoices()).toEqual([
      { subjectId: 'mathematics', included: false },
      { subjectId: 'tourism', included: true },
    ]);
    await student.setExamSubjectChoice('mathematics', null);
    expect(await student.examSubjectChoices()).toEqual([{ subjectId: 'tourism', included: true }]);
    await expect(student.setExamSubjectChoice('astrology', true)).rejects.toThrow(
      InvalidStateError,
    );
  });

  it('matches papers from the latest confirmed report only', async () => {
    const { studentId, student, source } = await learner(12);
    // No report yet: every session holds (A12-03), but none of it opens an exam period.
    const before = await source.slotsFor(studentId, OCT_2026, END_2026);
    expect(before.length).toBeGreaterThan(2);
    expect(before.every((s) => s.holdOnly === true)).toBe(true);
    await student.saveConfirmedReport({
      kind: 'grade-11-final',
      marks: [{ subject: 'history', percent: 60 }],
    });
    await student.saveConfirmedReport({
      kind: 'grade-12-june',
      marks: [
        { subject: 'mathematics', percent: 64 },
        { subject: 'life-orientation', percent: 80 },
      ],
    });
    const slots = await source.slotsFor(studentId, OCT_2026, END_2026);
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual([
      '2026-10-23T07:00:00.000Z',
      '2026-10-26T07:00:00.000Z',
    ]);
  });

  it('never matches from marks the learner has not confirmed (hard rule 6)', async () => {
    const { store, studentId, student, source } = await learner(12);
    // A report read from a photo but not yet checked by the learner.
    const doc = await student.addDocument({
      kind: 'report',
      storageKey: `k-${studentId}`,
      mimeType: 'image/png',
      sizeBytes: 10,
    });
    await student.setExtraction(
      doc?.id as string,
      { rows: [{ subject: 'mathematics', percent: 64 }] },
      'extracted',
    );
    // Unconfirmed marks name no subjects: the learner gets the no-subjects protection (every
    // session, A12-03), never a match made from Mathematics.
    const slots = await source.slotsFor(studentId, OCT_2026, END_2026);
    const none = await learner(12);
    expect(startsOf(slots)).toEqual(
      startsOf(await none.source.slotsFor(none.studentId, OCT_2026, END_2026)),
    );
    expect(slots.every((s) => s.holdOnly === true)).toBe(true);
    expect((await store.messaging().examInputs(studentId))?.confirmedSubjects).toEqual([]);
  });

  it('adds and removes subjects at the learner’s word', async () => {
    const { studentId, student, source } = await learner(12);
    await student.saveConfirmedReport({
      kind: 'grade-12-june',
      marks: [
        { subject: 'mathematics', percent: 64 },
        { subject: 'english-fal', percent: 70 },
      ],
    });
    await student.setExamSubjectChoice('english-fal', false);
    await student.setExamSubjectChoice('tourism', true);
    const slots = await source.slotsFor(studentId, OCT_2026, END_2026);
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual([
      '2026-10-23T07:00:00.000Z',
      '2026-10-26T07:00:00.000Z',
      '2026-10-30T12:00:00.000Z',
    ]);
  });

  it('A12-02: a profile still saying Grade 11 is protected in the year after too (it may be stale)', async () => {
    // Signed up in Grade 11 last year and never updated: this year is really their matric year.
    const { studentId, student, source } = await learner(11);
    await student.saveConfirmedReport({
      kind: 'grade-11-final',
      marks: [{ subject: 'mathematics', percent: 64 }],
    });
    const slots = await source.slotsFor(studentId, OCT_2026, END_2026);
    expect(slots.length).toBeGreaterThanOrEqual(1);
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual([
      '2026-10-23T07:00:00.000Z',
      '2026-10-26T07:00:00.000Z',
    ]);
    // A guessed year holds messages but never opens an exam period.
    expect(slots.every((s) => s.holdOnly === true)).toBe(true);
  });

  it('A12-01: with production wiring (no paper verified), a Grade 12 learner is not messaged mid-paper', async () => {
    const { store } = testStore(database);
    const { studentId } = await adultStudent(store);
    const student = store.forStudent(studentId);
    await student.updateProfile({ grade: 12 });
    await student.saveConfirmedReport({
      kind: 'grade-12-june',
      marks: [{ subject: 'mathematics', percent: 64 }],
    });
    const midPaper = new Date('2026-10-23T07:30:00Z');
    const source = new TimetablePaperSlots(store.messaging(), {
      shown: () => catalogueView(midPaper, { includeDrafts: false }).examPapers,
      forSuppression: () => examPapersForSuppression(),
    });
    const papers = await source.slotsFor(studentId, OCT_2026, END_2026);
    expect(nextAllowedSend({ now: midPaper, maxPerWeek: 2, recentSends: [], papers })).toEqual({
      kind: 'later',
      at: new Date('2026-10-23T10:30:00Z'),
    });
    // Unverified, so it holds the message but opens no exam period.
    expect(papers.every((s) => s.holdOnly === true)).toBe(true);
  });

  it('A12-03: with no confirmed subjects, every NSC paper session of the exam year holds messages', async () => {
    const { studentId, source } = await learner(12);
    const slots = await source.slotsFor(studentId, OCT_2026, END_2026);
    expect(slots.length).toBeGreaterThanOrEqual(1);
    const midMaths = new Date('2026-10-23T07:30:00Z');
    expect(slots.some((s) => s.startsAt <= midMaths && midMaths <= s.endsAt)).toBe(true);
    // A morning and an afternoon session on one day are two slots, not one long one.
    const oct22 = slots.filter((s) => s.startsAt.toISOString().startsWith('2026-10-22'));
    expect(oct22.map((s) => [s.startsAt.toISOString(), s.endsAt.toISOString()])).toEqual([
      ['2026-10-22T07:00:00.000Z', '2026-10-22T09:00:00.000Z'],
      ['2026-10-22T12:00:00.000Z', '2026-10-22T15:00:00.000Z'],
    ]);
  });

  it('treats a Grade 12 report as Grade 12, whatever grade was typed at sign-up', async () => {
    const { studentId, student, source } = await learner(11);
    await student.saveConfirmedReport({
      kind: 'grade-12-september',
      marks: [{ subject: 'mathematics', percent: 64 }],
    });
    expect(await source.slotsFor(studentId, OCT_2026, END_2026)).toHaveLength(2);
  });

  it('returns only papers inside the window asked about', async () => {
    const { studentId, student, source } = await learner(12);
    await student.saveConfirmedReport({
      kind: 'grade-12-june',
      marks: [{ subject: 'mathematics', percent: 64 }],
    });
    const slots = await source.slotsFor(
      studentId,
      new Date('2026-10-24T00:00:00Z'),
      new Date('2026-10-27T00:00:00Z'),
    );
    expect(slots).toHaveLength(1);
  });

  it('has nothing for an id that is not a learner', async () => {
    const { source } = await learner(12);
    expect(await source.slotsFor('not-a-uuid', OCT_2026, END_2026)).toEqual([]);
  });
});
