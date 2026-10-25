import { holdsMobileNumber, looksLikePersonalNumber } from '@universityflow/documents';
import { and, asc, eq, sql } from 'drizzle-orm';
import { type Db, rowsOf } from './client';
import { InvalidStateError } from './errors';
import { moduleMarks, moduleTargets } from './schema';

/**
 * The learner's own marks per component and their target, for one module in one academic year
 * (Phase 6c, migration 0041; docs/plans/phase-6-proposal.md D10, D11). The module card's mark
 * calculator works from them; packages/admissions does the maths (hard rule 2), never this file.
 *
 * Typed or confirmed by the learner (hard rule 6), so consent alone covers them (hard rule 5:
 * `StudentStore` runs each call in the learner's own transaction, behind row-level security). A
 * mark outside 0–100 is refused here and again by the database, never repaired. Audit rows carry
 * fixed words only (hard rule 4).
 */

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export interface ModuleMark {
  /** The component's name as the module's scheme gives it. */
  readonly component: string;
  /** 1 for most components; one per attempt for "the best 2 of 3". */
  readonly attempt: number;
  readonly percent: number;
}

export interface ModuleMarkSheet {
  readonly academicYear: number;
  readonly moduleCode: string;
  readonly marks: ReadonlyArray<ModuleMark>;
  /** The learner's own target for the module, or null without one. */
  readonly target: number | null;
}

export interface ModuleMarksContext {
  readonly tx: Tx;
  readonly studentId: string;
  readonly now: Date;
  readonly audit: (action: string, reason?: string) => Promise<void>;
}

/** As migration 0040 keeps module codes: trimmed, single spaces, upper case. */
export const MODULE_MARKS_CODE = /^[A-Z0-9][A-Z0-9 ./-]{1,23}$/;
/** At most this many marks per module (20 components, a few attempts each). */
export const MAX_MODULE_MARKS = 60;

const code = (c: string) => c.trim().replace(/\s+/g, ' ').toUpperCase();
const words = (c: string) => c.trim().replace(/\s+/g, ' ');
const isPercent = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100;

/** Checks a sheet as the learner sent it; anything not a mark is refused, never repaired. */
export function checkMarkSheet(sheet: ModuleMarkSheet): ModuleMarkSheet {
  const moduleCode = code(sheet.moduleCode);
  if (!MODULE_MARKS_CODE.test(moduleCode)) throw new InvalidStateError('Not a module code');
  if (
    !Number.isInteger(sheet.academicYear) ||
    sheet.academicYear < 2020 ||
    sheet.academicYear > 2100
  ) {
    throw new InvalidStateError('Not an academic year');
  }
  if (sheet.target !== null && !isPercent(sheet.target)) {
    throw new InvalidStateError('A target is a percentage from 0 to 100');
  }
  if (sheet.marks.length > MAX_MODULE_MARKS) throw new InvalidStateError('Too many marks');
  const seen = new Set<string>();
  const marks = sheet.marks.map((m) => {
    const component = words(m.component);
    if (component.length < 2 || component.length > 160) {
      throw new InvalidStateError('Not a component name');
    }
    // The same rules as migration 0041's check (0021's and 0040's SQL).
    if (looksLikePersonalNumber(component) || holdsMobileNumber(component)) {
      throw new InvalidStateError('A component name holds a personal number');
    }
    if (!Number.isInteger(m.attempt) || m.attempt < 1 || m.attempt > 20) {
      throw new InvalidStateError('Not an attempt');
    }
    if (!isPercent(m.percent)) throw new InvalidStateError('A mark is a percentage from 0 to 100');
    const key = `${component.toLowerCase()}#${m.attempt}`;
    if (seen.has(key)) throw new InvalidStateError('A component’s attempt appears twice');
    seen.add(key);
    // Two decimals, as the column keeps them.
    return { component, attempt: m.attempt, percent: Math.round(m.percent * 100) / 100 };
  });
  return { academicYear: sheet.academicYear, moduleCode, marks, target: sheet.target };
}

/** The learner's marks and target for one module and year, by component and attempt. */
export async function readModuleMarks(
  tx: Tx,
  academicYear: number,
  moduleCode: string,
): Promise<{ marks: ModuleMark[]; target: number | null }> {
  const c = code(moduleCode);
  const rows = await tx
    .select({
      component: moduleMarks.component,
      attempt: moduleMarks.attempt,
      percent: moduleMarks.percent,
    })
    .from(moduleMarks)
    .where(and(eq(moduleMarks.academicYear, academicYear), eq(moduleMarks.moduleCode, c)))
    .orderBy(asc(moduleMarks.component), asc(moduleMarks.attempt));
  const [target] = await tx
    .select({ percent: moduleTargets.percent })
    .from(moduleTargets)
    .where(and(eq(moduleTargets.academicYear, academicYear), eq(moduleTargets.moduleCode, c)));
  return {
    marks: rows.map((r) => ({ ...r, percent: Number(r.percent) })),
    target: target ? Number(target.percent) : null,
  };
}

/** Every sheet the learner has, for their export (POPIA s23). */
export async function exportModuleMarks(tx: Tx): Promise<ModuleMarkSheet[]> {
  const marks = await tx
    .select()
    .from(moduleMarks)
    .orderBy(
      asc(moduleMarks.academicYear),
      asc(moduleMarks.moduleCode),
      asc(moduleMarks.component),
      asc(moduleMarks.attempt),
    );
  const targets = await tx.select().from(moduleTargets);
  const sheets = new Map<
    string,
    { academicYear: number; moduleCode: string; marks: ModuleMark[]; target: number | null }
  >();
  const sheet = (academicYear: number, moduleCode: string) => {
    const key = `${academicYear}:${moduleCode}`;
    let s = sheets.get(key);
    if (!s) {
      s = { academicYear, moduleCode, marks: [], target: null };
      sheets.set(key, s);
    }
    return s;
  };
  for (const m of marks) {
    sheet(m.academicYear, m.moduleCode).marks.push({
      component: m.component,
      attempt: m.attempt,
      percent: Number(m.percent),
    });
  }
  for (const t of targets) sheet(t.academicYear, t.moduleCode).target = Number(t.percent);
  return [...sheets.values()].sort(
    (a, b) => a.academicYear - b.academicYear || a.moduleCode.localeCompare(b.moduleCode),
  );
}

/** Replaces the learner's marks and target for one module and year with the ones they saved. */
export async function saveModuleMarks(
  ctx: ModuleMarksContext,
  input: ModuleMarkSheet,
): Promise<void> {
  const sheet = checkMarkSheet(input);
  const { tx, now } = ctx;
  const where = (table: typeof moduleMarks | typeof moduleTargets) =>
    and(eq(table.academicYear, sheet.academicYear), eq(table.moduleCode, sheet.moduleCode));
  await tx.delete(moduleMarks).where(where(moduleMarks));
  await tx.delete(moduleTargets).where(where(moduleTargets));
  if (sheet.marks.length > 0) {
    await tx.insert(moduleMarks).values(
      sheet.marks.map((m) => ({
        studentId: ctx.studentId,
        moduleCode: sheet.moduleCode,
        academicYear: sheet.academicYear,
        component: m.component,
        attempt: m.attempt,
        percent: String(m.percent),
        updatedAt: now,
      })),
    );
  }
  if (sheet.target !== null) {
    await tx.insert(moduleTargets).values({
      studentId: ctx.studentId,
      moduleCode: sheet.moduleCode,
      academicYear: sheet.academicYear,
      percent: String(sheet.target),
      updatedAt: now,
    });
  }
  await ctx.audit('module-marks.saved');
}

/** D10: deletes every learner's marks past the academic year plus one. The owner's, for the sweep. */
export async function deleteExpiredModuleMarks(db: Db, today: string): Promise<number> {
  const [row] = rowsOf<{ n: number }>(
    await db.execute(sql`select uf_delete_expired_module_marks(${today}::date) as n`),
  );
  return Number(row?.n ?? 0);
}
