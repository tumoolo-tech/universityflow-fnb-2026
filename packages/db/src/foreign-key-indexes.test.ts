import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Database, rowsOf } from './client';
import { testDatabase } from './testing';

/**
 * Audit A4-11 (migration 0022): a foreign key declared `on delete set null` makes Postgres find
 * the referencing rows on every delete of the row it points at. With no index on the referencing
 * column that is a scan of the whole table, every learner's rows, per deleted document or
 * reminder (measured 16-21 ms against 0.4-0.9 ms at 200,000 offers). Every such key must have an
 * index whose first column is the key's column.
 */

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(async () => {
  await database.close();
});

describe('foreign keys that set null on delete (A4-11)', () => {
  it('each has an index led by its column', async () => {
    const unindexed = rowsOf<{ key: string }>(
      await database.db.execute(sql`
        select c.conrelid::regclass::text || '.' || a.attname as key
        from pg_constraint c
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
        where c.contype = 'f'
          and c.confdeltype = 'n'
          and cardinality(c.conkey) = 1
          and not exists (
            select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1]
          )
        order by 1
      `),
    ).map((r) => r.key);
    expect(unindexed).toEqual([]);
  });

  it('include the Phase 5 keys, so the check above is checking something', async () => {
    const keys = rowsOf<{ key: string }>(
      await database.db.execute(sql`
        select c.conrelid::regclass::text || '.' || a.attname as key
        from pg_constraint c
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
        where c.contype = 'f' and c.confdeltype = 'n'
      `),
    ).map((r) => r.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'offers.document_id',
        'offers.reminder_id',
        // The registration-day reminder (migration 0023, A1-33).
        'offers.registration_reminder_id',
        'registrations.document_id',
        'registrations.reminder_id',
      ]),
    );
  });
});
