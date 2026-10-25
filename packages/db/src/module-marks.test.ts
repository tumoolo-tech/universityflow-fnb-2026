import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Database, rowsOf } from './client';
import { InvalidStateError } from './errors';
import { signIn, syntheticPhone, testDatabase, testStore } from './testing';

/**
 * The learner's own marks per component, and their target (Phase 6c, migration 0041; D10, D11).
 * Typed by the learner (hard rule 6: nothing read from a document), so they need consent only
 * (hard rule 5), never the module-outline wording. Each learner sees only their own (row-level
 * security); a mark outside 0–100 is refused by the store and by the database; export and deletion
 * include them; they are kept for the academic year plus one (D10). Audit rows carry ids only.
 * Every value here is synthetic.
 */

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(async () => {
  await database.close();
});

async function adult() {
  const { store } = testStore(database);
  const { studentId } = await signIn(store, syntheticPhone());
  await store.setDateOfBirth(studentId, '2000-01-15');
  await store.consentAsAdult(studentId, 'adult-v2-2026-10');
  return { store, studentId, student: store.forStudent(studentId) };
}

const SHEET = {
  academicYear: 2027,
  moduleCode: 'DEMO1001',
  marks: [
    { component: 'Test 1', attempt: 1, percent: 62 },
    { component: 'Assignment', attempt: 1, percent: 70.5 },
  ],
  target: 60,
};

function raw(statement: string) {
  return database.exec(statement);
}

describe('saving and reading a module’s marks', () => {
  it('keeps the learner’s marks and target per module and year, replacing them on a save', async () => {
    const { student } = await adult();
    expect(await student.moduleMarks(2027, 'DEMO1001')).toEqual({ marks: [], target: null });
    await student.saveModuleMarks(SHEET);
    expect(await student.moduleMarks(2027, 'demo1001')).toEqual({
      marks: [
        { component: 'Assignment', attempt: 1, percent: 70.5 },
        { component: 'Test 1', attempt: 1, percent: 62 },
      ],
      target: 60,
    });
    await student.saveModuleMarks({
      ...SHEET,
      marks: [{ component: 'Test 1', attempt: 1, percent: 64 }],
      target: null,
    });
    expect(await student.moduleMarks(2027, 'DEMO1001')).toEqual({
      marks: [{ component: 'Test 1', attempt: 1, percent: 64 }],
      target: null,
    });
    // Another module and another year are their own.
    expect(await student.moduleMarks(2028, 'DEMO1001')).toEqual({ marks: [], target: null });
    expect(await student.moduleMarks(2027, 'DEMO1002')).toEqual({ marks: [], target: null });
  });

  it('needs consent only: an adult on the wording before module outlines may type marks', async () => {
    const { student } = await adult();
    await expect(student.saveModuleMarks(SHEET)).resolves.toBeUndefined();
  });

  it('refuses a mark outside 0–100, a bad code, a repeated component and a personal number', async () => {
    const { student } = await adult();
    for (const bad of [
      { ...SHEET, marks: [{ component: 'Test 1', attempt: 1, percent: 101 }] },
      { ...SHEET, marks: [{ component: 'Test 1', attempt: 1, percent: -1 }] },
      { ...SHEET, marks: [{ component: 'Test 1', attempt: 1, percent: Number.NaN }] },
      { ...SHEET, target: 120 },
      { ...SHEET, moduleCode: 'not a code!' },
      { ...SHEET, academicYear: 1999 },
      {
        ...SHEET,
        marks: [
          { component: 'Test 1', attempt: 1, percent: 60 },
          { component: 'test  1', attempt: 1, percent: 61 },
        ],
      },
      { ...SHEET, marks: [{ component: 'Test 1', attempt: 0, percent: 60 }] },
      { ...SHEET, marks: [{ component: 'Student no 2027123', attempt: 1, percent: 60 }] },
      { ...SHEET, marks: [{ component: 'X', attempt: 1, percent: 60 }] },
    ]) {
      await expect(student.saveModuleMarks(bad), JSON.stringify(bad)).rejects.toThrow(
        InvalidStateError,
      );
    }
    expect(await student.moduleMarks(2027, 'DEMO1001')).toEqual({ marks: [], target: null });
  });

  it('the database refuses a mark outside 0–100 whatever the code above does', async () => {
    const { studentId } = await adult();
    const insert = (percent: string, component = 'Test 1') =>
      raw(
        `insert into module_marks (student_id, module_code, academic_year, component, attempt, percent, updated_at)
         values ('${studentId}', 'DEMO1001', 2027, '${component}', 1, ${percent}, now())`,
      );
    await expect(insert('100.01')).rejects.toThrow();
    await expect(insert('-0.5')).rejects.toThrow();
    await expect(insert("'NaN'")).rejects.toThrow();
    await expect(insert('60', 'Student no 2027123')).rejects.toThrow();
    await expect(
      raw(
        `insert into module_targets (student_id, module_code, academic_year, percent, updated_at)
         values ('${studentId}', 'DEMO1001', 2027, 101, now())`,
      ),
    ).rejects.toThrow();
    await insert('100');
    await insert('0', 'Test 2');
  });

  it('writes an audit row with ids and fixed words only (hard rule 4)', async () => {
    const { studentId, student } = await adult();
    await student.saveModuleMarks(SHEET);
    const rows = rowsOf<{ action: string; reason: string | null }>(
      await database.db.execute(
        sql`select action, reason from audit_log where student_id = ${studentId}::uuid and action like 'module-marks%'`,
      ),
    );
    expect(rows).toEqual([{ action: 'module-marks.saved', reason: null }]);
  });
});

describe('another learner, consent, export, deletion and how long they are kept', () => {
  it('another learner never sees them (row-level security)', async () => {
    const owner = await adult();
    const other = await adult();
    await owner.student.saveModuleMarks(SHEET);
    expect(await other.student.moduleMarks(2027, 'DEMO1001')).toEqual({ marks: [], target: null });
    // Saving their own replaces only theirs.
    await other.student.saveModuleMarks({ ...SHEET, marks: [], target: null });
    expect((await owner.student.moduleMarks(2027, 'DEMO1001')).marks).toHaveLength(2);
  });

  it('nothing is read or written for a minor before a guardian consents (hard rule 5)', async () => {
    const { store } = testStore(database);
    const { studentId } = await signIn(store, syntheticPhone());
    await store.setDateOfBirth(studentId, '2010-03-03');
    const student = store.forStudent(studentId);
    await expect(student.moduleMarks(2027, 'DEMO1001')).rejects.toThrow(/consent/i);
    await expect(student.saveModuleMarks(SHEET)).rejects.toThrow(/consent/i);
    // The database's own rule, whatever the store does: the policy asks uf_may_process.
    const [policy] = rowsOf<{ qual: string; check: string }>(
      await database.db.execute(
        sql`select qual, with_check as check from pg_policies where tablename = 'module_marks'`,
      ),
    );
    expect(policy?.qual).toMatch(/uf_may_process\(student_id\)/);
    expect(policy?.check).toMatch(/uf_may_process\(student_id\)/);
  });

  it('the export carries them; deleting the account takes them', async () => {
    const { studentId, student } = await adult();
    await student.saveModuleMarks(SHEET);
    const exported = await student.exportAll();
    expect(exported.personal?.moduleMarks).toEqual([
      {
        academicYear: 2027,
        moduleCode: 'DEMO1001',
        marks: [
          { component: 'Assignment', attempt: 1, percent: 70.5 },
          { component: 'Test 1', attempt: 1, percent: 62 },
        ],
        target: 60,
      },
    ]);
    await student.deleteAccount();
    const [row] = rowsOf<{ marks: number; targets: number }>(
      await database.db.execute(
        sql`select (select count(*)::int from module_marks where student_id = ${studentId}::uuid) as marks,
                   (select count(*)::int from module_targets where student_id = ${studentId}::uuid) as targets`,
      ),
    );
    expect(row).toEqual({ marks: 0, targets: 0 });
  });

  it('keeps them for the academic year plus one (D10), then the sweep deletes them', async () => {
    const { store, student } = await adult();
    await student.saveModuleMarks(SHEET);
    await student.saveModuleMarks({ ...SHEET, academicYear: 2029 });
    // Through 2028 the 2027 marks stay.
    expect(await store.deleteExpiredModuleMarks(new Date('2028-12-31T12:00:00Z'))).toBe(0);
    expect((await student.moduleMarks(2027, 'DEMO1001')).marks).toHaveLength(2);
    // From 1 January 2029 they go; 2029's stay.
    expect(await store.deleteExpiredModuleMarks(new Date('2029-01-01T12:00:00Z'))).toBeGreaterThan(
      0,
    );
    expect(await student.moduleMarks(2027, 'DEMO1001')).toEqual({ marks: [], target: null });
    expect((await student.moduleMarks(2029, 'DEMO1001')).marks).toHaveLength(2);
  });
});
