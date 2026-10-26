import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { type Database, migrate, openDatabase, rowsOf } from './client';
import { actAsLearner } from './learner';

/**
 * Acting as a learner costs one round trip, not two (the judge demo's slow start, 2026-10-25:
 * its functions are in Cape Town and its database in London, about 160 ms apart, and every
 * learner request paid for `scopeToLearner` and `set local role uf_app` separately).
 */

let database: Database;

beforeAll(async () => {
  database = openDatabase('pglite:memory');
  await migrate(database);
});

afterAll(async () => {
  await database.close();
});

const STUDENT = '00000000-0000-4000-8000-000000000001';

describe('actAsLearner', () => {
  it('scopes to the learner and drops to uf_app in one statement', async () => {
    const seen = await database.db.transaction(async (tx) => {
      const execute = vi.spyOn(tx, 'execute');
      await actAsLearner(tx, STUDENT, new Date('2026-10-25T10:00:00Z'));
      const statements = execute.mock.calls.length;
      execute.mockRestore();
      const [row] = rowsOf<{ who: string; student: string; today: string }>(
        await tx.execute(
          sql`select current_user as who, current_setting('uf.student_id') as student, current_setting('uf.today') as today`,
        ),
      );
      return { statements, ...row };
    });
    expect(seen).toEqual({
      statements: 1,
      who: 'uf_app',
      student: STUDENT,
      today: '2026-10-25',
    });
  });

  it('lasts only for its transaction, as set local role does', async () => {
    await database.db.transaction(async (tx) => {
      await actAsLearner(tx, STUDENT, new Date('2026-10-25T10:00:00Z'));
    });
    const [row] = rowsOf<{ who: string; student: string | null }>(
      await database.db.execute(
        sql`select current_user as who, nullif(current_setting('uf.student_id', true), '') as student`,
      ),
    );
    expect(row?.who).not.toBe('uf_app');
    expect(row?.student).toBeNull();
  });
});
