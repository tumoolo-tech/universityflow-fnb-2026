import { sql } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { type Database, migrate, openDatabase, rowsOf } from './client';
import { syntheticPhone } from './testing';

/**
 * What a migration does to rows written before it: each test migrates a fresh database up to the
 * migration before, writes synthetic rows as they were then (hard rule 4), and runs the rest.
 */

let database: Database | null = null;
afterEach(async () => {
  await database?.close();
  database = null;
});

async function at(through: string) {
  database = openDatabase('pglite:memory');
  await migrate(database, { through });
  return database;
}

/** A student with a profile, written directly as the app would have then (fixed test values). */
async function learner(db: Database, phone: string, profile: Record<string, string>) {
  const [row] = rowsOf<{ id: string }>(
    await db.db.execute(sql.raw(`insert into students (phone) values ('${phone}') returning id`)),
  );
  const columns = Object.keys(profile).join(', ');
  const values = Object.values(profile).join(', ');
  await db.exec(`insert into profiles (student_id, ${columns}) values ('${row?.id}', ${values})`);
  return row?.id as string;
}

async function profileOf(db: Database, id: string) {
  const [row] = rowsOf<{ grade: number | null; given_on: string | null }>(
    await db.db.execute(
      sql`select grade, grade_given_on::text as given_on from profiles where student_id = ${id}::uuid`,
    ),
  );
  return row;
}

describe('migration 0025: when the grade was given (A1-43)', () => {
  it('dates an existing grade by the profile’s last change in South Africa, and no grade not at all', async () => {
    const db = await at('0024_grade_10_report');
    const graded = await learner(db, syntheticPhone(), { grade: '11' });
    // 23:30 UTC on 31 May is 1 June in South Africa.
    await db.exec(
      `update profiles set updated_at = '2025-05-31T23:30:00Z' where student_id = '${graded}'`,
    );
    const ungraded = await learner(db, syntheticPhone(), { display_name: 'null' });
    await migrate(db);
    expect(await profileOf(db, graded)).toEqual({ grade: 11, given_on: '2025-06-01' });
    expect(await profileOf(db, ungraded)).toEqual({ grade: null, given_on: null });
  });
});

describe('migration 0027: UniversityFlow starts at Grade 10 (A1-39)', () => {
  it('clears a Grade 9 given before, keeps the others, and refuses Grade 9 from then on', async () => {
    const db = await at('0026_reply_reports');
    const given = { grade_given_on: `'2026-10-01'` };
    const nine = await learner(db, syntheticPhone(), { grade: '9', ...given });
    const ten = await learner(db, syntheticPhone(), { grade: '10', ...given });
    await migrate(db);
    // Asked again (the app's grade step), never moved up to a grade they didn't give.
    expect(await profileOf(db, nine)).toEqual({ grade: null, given_on: null });
    expect(await profileOf(db, ten)).toEqual({ grade: 10, given_on: '2026-10-01' });
    await expect(
      db.exec(
        `update profiles set grade = 9, grade_given_on = '2026-10-02' where student_id = '${ten}'`,
      ),
    ).rejects.toThrow(/profiles_grade_check/);
  });
});

describe('migration 0028: the profile’s look', () => {
  it('gives every profile written before it the default look', async () => {
    const db = await at('0027_grade_floor');
    const before = await learner(db, syntheticPhone(), { display_name: `'Synthetic'` });
    await migrate(db);
    const [row] = rowsOf<{
      theme: string;
      avatar: string;
      tagline_id: string | null;
      badge_ids: string[];
    }>(
      await db.db.execute(
        sql`select theme, avatar, tagline_id, badge_ids from profiles where student_id = ${before}::uuid`,
      ),
    );
    expect(row).toEqual({ theme: 'mauve', avatar: 'initials', tagline_id: null, badge_ids: [] });
  });
});

describe('migration 0031: the school record’s June and September reports (§18.7 C2)', () => {
  it('keeps every report written before it, takes the three new kinds, and still refuses any other', async () => {
    const db = await at('0030_plan_maps');
    const id = await learner(db, syntheticPhone(), { display_name: `'Synthetic'` });
    const report = (kind: string) =>
      db.exec(
        `insert into reports (student_id, kind, confirmed_at) values ('${id}', '${kind}', now())`,
      );
    for (const kind of ['grade-10-final', 'grade-11-final', 'grade-12-june', 'grade-12-final']) {
      await report(kind);
    }
    // Before it, the new kinds are refused.
    await expect(report('grade-11-june')).rejects.toThrow(/reports_kind_check/);
    await migrate(db);
    for (const kind of ['grade-10-june', 'grade-11-june', 'grade-11-september']) {
      await report(kind);
    }
    const [row] = rowsOf<{ kinds: string[] }>(
      await db.db.execute(
        sql`select array_agg(kind order by kind) as kinds from reports where student_id = ${id}::uuid`,
      ),
    );
    expect(row?.kinds).toEqual([
      'grade-10-final',
      'grade-10-june',
      'grade-11-final',
      'grade-11-june',
      'grade-11-september',
      'grade-12-final',
      'grade-12-june',
    ]);
    for (const kind of ['grade-10-september', 'grade-9-final', 'grade-12-march']) {
      await expect(report(kind)).rejects.toThrow(/reports_kind_check/);
    }
  });
});

describe('migration 0029: the profile photo', () => {
  it('gives every profile written before it no photo', async () => {
    const db = await at('0028_profile_look');
    const before = await learner(db, syntheticPhone(), { display_name: `'Synthetic'` });
    await migrate(db);
    const [row] = rowsOf<{ photo_key: string | null }>(
      await db.db.execute(sql`select photo_key from profiles where student_id = ${before}::uuid`),
    );
    expect(row).toEqual({ photo_key: null });
  });
});

describe('migration 0038: the learner role and Supabase’s API roles (the judge demo)', () => {
  const count = async (db: Database, query: string) =>
    rowsOf<{ n: number }>(await db.db.execute(sql.raw(query)))[0]?.n;

  it('turns row-level security on for the two tables that had none, and the owner still uses them', async () => {
    const db = await at('0036_reply_writers');
    const rls = `select count(*)::int as n from pg_class
      where relname in ('otp_challenges', 'uf_migrations') and relrowsecurity`;
    expect(await count(db, rls)).toBe(0);
    await migrate(db);
    expect(await count(db, rls)).toBe(2);
    // The owner (the app) bypasses it: migrations and sign-in keep working.
    expect(await count(db, 'select count(*)::int as n from uf_migrations')).toBeGreaterThan(35);
    expect(await migrate(db)).toEqual([]);
  });

  it('where Supabase’s anon and authenticated roles exist, takes back every grant and default grant they had', async () => {
    const db = await at('0036_reply_writers');
    // As a new Supabase project does: its API roles get every table, sequence and function.
    await db.exec(`
      create role anon nologin; create role authenticated nologin;
      grant all on all tables in schema public to anon, authenticated;
      grant all on all sequences in schema public to anon, authenticated;
      grant all on all functions in schema public to anon, authenticated;
      alter default privileges in schema public grant all on tables to anon, authenticated;
      alter default privileges in schema public grant all on sequences to anon, authenticated;
      alter default privileges in schema public grant all on functions to anon, authenticated;`);
    const tables = `select count(*)::int as n from information_schema.role_table_grants
      where table_schema = 'public' and grantee in ('anon', 'authenticated')`;
    const routines = `select count(*)::int as n from information_schema.role_routine_grants
      where routine_schema = 'public' and grantee in ('anon', 'authenticated')`;
    const defaults = `select count(*)::int as n from pg_default_acl d, aclexplode(d.defaclacl) a
      join pg_roles r on r.oid = a.grantee where r.rolname in ('anon', 'authenticated')`;
    expect(await count(db, tables)).toBeGreaterThan(0);
    expect(await count(db, routines)).toBeGreaterThan(0);
    expect(await count(db, defaults)).toBeGreaterThan(0);
    await migrate(db);
    expect(await count(db, tables)).toBe(0);
    expect(await count(db, routines)).toBe(0);
    expect(await count(db, defaults)).toBe(0);
  });
});

describe('migration 0039: reports of a fitted CV (A10-58)', () => {
  const grants = async (db: Database, grantee: string) =>
    rowsOf<{ privilege_type: string }>(
      await db.db.execute(
        sql`select privilege_type from information_schema.role_table_grants
            where table_name = 'cv_reports' and grantee = ${grantee} order by privilege_type`,
      ),
    ).map((r) => r.privilege_type);

  it('gives Supabase’s API roles nothing on the new table (0038’s default revoke holds), and the learner’s role only select and insert', async () => {
    const db = await at('0037_profile_photo_consent');
    // As a new Supabase project does, before 0038 ran there.
    await db.exec(`
      create role anon nologin; create role authenticated nologin;
      grant all on all tables in schema public to anon, authenticated;
      alter default privileges in schema public grant all on tables to anon, authenticated;`);
    await migrate(db);
    expect(await grants(db, 'anon')).toEqual([]);
    expect(await grants(db, 'authenticated')).toEqual([]);
    expect(await grants(db, 'uf_app')).toEqual(['INSERT', 'SELECT']);
    const [table] = rowsOf<{ rls: boolean }>(
      await db.db.execute(
        sql`select relrowsecurity as rls from pg_class where relname = 'cv_reports'`,
      ),
    );
    expect(table?.rls).toBe(true);
  });
});

describe('migration 0040: confirmed module outlines (Phase 6b)', () => {
  const grants = async (db: Database, grantee: string) =>
    rowsOf<{ privilege_type: string }>(
      await db.db.execute(
        sql`select privilege_type from information_schema.role_table_grants
            where table_name = 'module_outlines' and grantee = ${grantee} order by privilege_type`,
      ),
    ).map((r) => r.privilege_type);

  it('gives Supabase’s API roles nothing on the new table, and the learner’s role what it needs behind row-level security', async () => {
    const db = await at('0037_profile_photo_consent');
    // As a new Supabase project does, before 0038 ran there.
    await db.exec(`
      create role anon nologin; create role authenticated nologin;
      grant all on all tables in schema public to anon, authenticated;
      alter default privileges in schema public grant all on tables to anon, authenticated;`);
    await migrate(db);
    expect(await grants(db, 'anon')).toEqual([]);
    expect(await grants(db, 'authenticated')).toEqual([]);
    expect(await grants(db, 'uf_app')).toEqual(['DELETE', 'INSERT', 'SELECT', 'UPDATE']);
    const [table] = rowsOf<{ rls: boolean }>(
      await db.db.execute(
        sql`select relrowsecurity as rls from pg_class where relname = 'module_outlines'`,
      ),
    );
    expect(table?.rls).toBe(true);
  });
});

describe('migration 0041: the learner’s own module marks (Phase 6c)', () => {
  const grants = async (db: Database, table: string, grantee: string) =>
    rowsOf<{ privilege_type: string }>(
      await db.db.execute(
        sql`select privilege_type from information_schema.role_table_grants
            where table_name = ${table} and grantee = ${grantee} order by privilege_type`,
      ),
    ).map((r) => r.privilege_type);

  it('gives Supabase’s API roles nothing on the new tables, and the learner’s role what it needs behind row-level security', async () => {
    // As a new Supabase project does, before 0038 ran there (as 0040's test does).
    const db = await at('0037_profile_photo_consent');
    await db.exec(`
      create role anon nologin; create role authenticated nologin;
      grant all on all tables in schema public to anon, authenticated;
      alter default privileges in schema public grant all on tables to anon, authenticated;`);
    await migrate(db);
    for (const table of ['module_marks', 'module_targets']) {
      expect(await grants(db, table, 'anon'), table).toEqual([]);
      expect(await grants(db, table, 'authenticated'), table).toEqual([]);
      expect(await grants(db, table, 'uf_app'), table).toEqual([
        'DELETE',
        'INSERT',
        'SELECT',
        'UPDATE',
      ]);
      const [row] = rowsOf<{ rls: boolean }>(
        await db.db.execute(
          sql`select relrowsecurity as rls from pg_class where relname = ${table}`,
        ),
      );
      expect(row?.rls, table).toBe(true);
    }
    // The retention sweep is the owner's alone.
    const [sweep] = rowsOf<{ ok: boolean }>(
      await db.db.execute(
        sql`select has_function_privilege('uf_app', 'uf_delete_expired_module_marks(date)', 'execute') as ok`,
      ),
    );
    expect(sweep?.ok).toBe(false);
  });
});

describe('migration 0036: which provider wrote a reply (A10-49)', () => {
  it('leaves every reply and report written before it as not recorded, never a guess', async () => {
    const db = await at('0035_cv');
    const sid = await learner(db, syntheticPhone(), { display_name: `'Synthetic'` });
    const [conversation] = rowsOf<{ id: string }>(
      await db.db.execute(
        sql.raw(`insert into conversations (student_id) values ('${sid}') returning id`),
      ),
    );
    const [reply] = rowsOf<{ id: string }>(
      await db.db.execute(
        sql.raw(
          `insert into messages (conversation_id, student_id, role, content)
           values ('${conversation?.id}', '${sid}', 'assistant', 'A synthetic reply.') returning id`,
        ),
      ),
    );
    await db.exec(
      `insert into reply_reports (student_id, message_id, reason) values ('${sid}', '${reply?.id}', 'wrong')`,
    );

    await migrate(db);

    const rows = rowsOf<{ provider: string | null; model: string | null }>(
      await db.db.execute(
        sql.raw(
          `select reply_provider as provider, reply_model as model from messages
           union all
           select reply_provider, reply_model from reply_reports`,
        ),
      ),
    );
    expect(rows).toEqual([
      { provider: null, model: null },
      { provider: null, model: null },
    ]);
  });
});
