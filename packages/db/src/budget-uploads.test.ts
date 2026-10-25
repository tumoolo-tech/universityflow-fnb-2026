import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Database, rowsOf } from './client';
import { ConsentRequiredError, NotFoundError } from './errors';
import { adultStudent, signIn, testDatabase, testStore } from './testing';

let database: Database;
let h: ReturnType<typeof testStore>;

beforeAll(async () => {
  database = await testDatabase();
});
afterAll(async () => {
  await database.close();
});
beforeEach(() => {
  h = testStore(database);
});

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
let budgets = 0;
/** Each test counts against its own budget name, so tests stay independent. */
const budget = () => `sms-test-${budgets++}`;

async function eventCount(name: string): Promise<number> {
  const rows = rowsOf<{ n: number }>(
    await database.db.execute(
      sql`select count(*)::int as n from budget_events where budget = ${name}`,
    ),
  );
  return rows[0]?.n ?? -1;
}

describe('takeBudget: the global SMS budget, counted in Postgres (open finding 1)', () => {
  it('allows up to the limit, counts each window, then refuses without recording', async () => {
    const name = budget();
    const windows = [
      { limit: 3, windowMs: HOUR },
      { limit: 10, windowMs: DAY },
    ];
    expect(await h.store.takeBudget(name, windows)).toEqual({ allowed: true, used: [1, 1] });
    expect(await h.store.takeBudget(name, windows)).toEqual({ allowed: true, used: [2, 2] });
    expect(await h.store.takeBudget(name, windows)).toEqual({ allowed: true, used: [3, 3] });
    expect(await h.store.takeBudget(name, windows)).toEqual({ allowed: false, used: [3, 3] });
    expect(await eventCount(name)).toBe(3);
  });

  it('rolls: room comes back as sends leave the window', async () => {
    const name = budget();
    const windows = [{ limit: 2, windowMs: HOUR }];
    await h.store.takeBudget(name, windows);
    h.advance(HOUR / 2);
    await h.store.takeBudget(name, windows);
    expect((await h.store.takeBudget(name, windows)).allowed).toBe(false);
    h.advance(HOUR / 2 + 1);
    expect(await h.store.takeBudget(name, windows)).toEqual({ allowed: true, used: [2] });
  });

  it('holds the daily cap across hours', async () => {
    const name = budget();
    const windows = [
      { limit: 2, windowMs: HOUR },
      { limit: 3, windowMs: DAY },
    ];
    await h.store.takeBudget(name, windows);
    await h.store.takeBudget(name, windows);
    h.advance(HOUR + 1);
    expect(await h.store.takeBudget(name, windows)).toEqual({ allowed: true, used: [1, 3] });
    expect(await h.store.takeBudget(name, windows)).toEqual({ allowed: false, used: [1, 3] });
  });

  it('prunes events older than the longest window', async () => {
    const name = budget();
    const windows = [{ limit: 5, windowMs: HOUR }];
    await h.store.takeBudget(name, windows);
    await h.store.takeBudget(name, windows);
    h.advance(HOUR);
    await h.store.takeBudget(name, windows);
    expect(await eventCount(name)).toBe(1);
  });

  it('lets only one of several racing sends take the last slot', async () => {
    const name = budget();
    const windows = [{ limit: 3, windowMs: HOUR }];
    const results = await Promise.all(
      Array.from({ length: 8 }, () => h.store.takeBudget(name, windows)),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(3);
    expect(await eventCount(name)).toBe(3);
  });

  it('keeps budgets apart by name', async () => {
    const a = budget();
    const b = budget();
    const windows = [{ limit: 1, windowMs: HOUR }];
    expect((await h.store.takeBudget(a, windows)).allowed).toBe(true);
    expect((await h.store.takeBudget(b, windows)).allowed).toBe(true);
    expect((await h.store.takeBudget(a, windows)).allowed).toBe(false);
  });

  it('A1-14: charges a send by its units (SMS segments), and refuses one bigger than the room left', async () => {
    const name = budget();
    const windows = [
      { limit: 5, windowMs: HOUR },
      { limit: 10, windowMs: DAY },
    ];
    expect(await h.store.takeBudget(name, windows, 3)).toEqual({ allowed: true, used: [3, 3] });
    // Two units left: a three-segment send doesn't fit and records nothing.
    expect(await h.store.takeBudget(name, windows, 3)).toEqual({ allowed: false, used: [3, 3] });
    expect(await h.store.peekBudget(name, windows, 2)).toEqual({ allowed: true, used: [3, 3] });
    expect(await h.store.peekBudget(name, windows, 3)).toEqual({ allowed: false, used: [3, 3] });
    expect(await h.store.takeBudget(name, windows, 2)).toEqual({ allowed: true, used: [5, 5] });
    expect(await h.store.takeBudget(name, windows)).toEqual({ allowed: false, used: [5, 5] });
    expect(await eventCount(name)).toBe(2);
  });

  it('refuses a nonsense unit count', async () => {
    const windows = [{ limit: 5, windowMs: HOUR }];
    await expect(h.store.takeBudget(budget(), windows, 0)).rejects.toThrow();
    await expect(h.store.takeBudget(budget(), windows, 1.5)).rejects.toThrow();
  });

  it('needs at least one window', async () => {
    await expect(h.store.takeBudget(budget(), [])).rejects.toThrow();
  });

  it('is out of reach of the per-request role', async () => {
    const { studentId } = await adultStudent(h.store);
    const error = await database.db
      .transaction(async (tx) => {
        await tx.execute(sql`select set_config('uf.student_id', ${studentId}, true)`);
        await tx.execute(sql`set local role uf_app`);
        await tx.execute(sql`select * from budget_events`);
      })
      .then(
        () => '',
        (e: { cause?: { message?: string }; message: string }) => e.cause?.message ?? e.message,
      );
    expect(error).toMatch(/permission denied/);
  });
});

describe('upload intents: direct-to-S3 uploads (open finding 3)', () => {
  const later = () => new Date(Date.now() + 15 * 60 * 1000);
  let keys = 0;
  const key = () => `incoming-${String(keys++).padStart(8, '0')}${Date.now()}`;

  it('is claimed once, by its own student, before it expires', async () => {
    const a = h.store.forStudent((await adultStudent(h.store)).studentId);
    const b = h.store.forStudent((await adultStudent(h.store)).studentId);
    const storageKey = key();
    const { id } = await a.createUploadIntent({
      storageKey,
      mimeType: 'image/jpeg',
      expiresAt: later(),
    });
    await expect(b.claimUploadIntent(id)).rejects.toThrow(NotFoundError);
    expect(await a.claimUploadIntent(id)).toEqual({ storageKey, mimeType: 'image/jpeg' });
    await expect(a.claimUploadIntent(id)).rejects.toThrow(NotFoundError);
  });

  it('expires', async () => {
    const a = h.store.forStudent((await adultStudent(h.store)).studentId);
    const { id } = await a.createUploadIntent({
      storageKey: key(),
      mimeType: 'application/pdf',
      expiresAt: later(),
    });
    await expect(a.claimUploadIntent(id, new Date(Date.now() + 16 * 60 * 1000))).rejects.toThrow(
      NotFoundError,
    );
  });

  it('accepts only the upload types (database check)', async () => {
    const a = h.store.forStudent((await adultStudent(h.store)).studentId);
    await expect(
      a.createUploadIntent({ storageKey: key(), mimeType: 'text/html', expiresAt: later() }),
    ).rejects.toThrow();
  });

  it('is personal data: refused for a minor without consent (hard rule 5)', async () => {
    const { studentId } = await signIn(h.store);
    await h.store.setDateOfBirth(studentId, '2010-01-01');
    await expect(
      h.store
        .forStudent(studentId)
        .createUploadIntent({ storageKey: key(), mimeType: 'image/png', expiresAt: later() }),
    ).rejects.toThrow(ConsentRequiredError);
  });

  it('hands back the keys of uploads never completed when the account is deleted', async () => {
    const student = h.store.forStudent((await adultStudent(h.store)).studentId);
    const claimed = key();
    const pending = key();
    const first = await student.createUploadIntent({
      storageKey: claimed,
      mimeType: 'image/png',
      expiresAt: later(),
    });
    await student.createUploadIntent({
      storageKey: pending,
      mimeType: 'image/png',
      expiresAt: later(),
    });
    await student.claimUploadIntent(first.id);
    const keysToDelete = await student.deleteAccount();
    expect(keysToDelete).toContain(pending);
    expect(keysToDelete).not.toContain(claimed);
    const left = rowsOf<{ n: number }>(
      await database.db.execute(
        sql`select count(*)::int as n from upload_intents where storage_key in (${claimed}, ${pending})`,
      ),
    );
    expect(left[0]?.n).toBe(0);
  });
});
