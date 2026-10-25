import { mkdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { Pool, type PoolConfig } from 'pg';
import { MIGRATIONS } from './migrations';
import * as schema from './schema';

/**
 * One way to open the database, whatever is behind it:
 * - `postgres://…` — Postgres (Docker locally, RDS af-south-1 in production; the judge demo's
 *   synthetic database on Supabase, through its transaction pooler: docs/deploy/demo.md).
 * - `pglite:memory` or `pglite:<directory>` — embedded Postgres (tests, and local development
 *   without Docker). It is real Postgres, so row-level security behaves exactly as in production.
 */

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface Database {
  readonly db: Db;
  readonly kind: 'postgres' | 'pglite';
  /** Runs a multi-statement SQL script (migrations). Never with user input. */
  exec(script: string): Promise<void>;
  close(): Promise<void>;
}

/**
 * How a Postgres connection is made, beyond its URL. Unset, the pool is as it always was.
 * - `max`, `idleTimeoutMillis`, `connectionTimeoutMillis`: a serverless function instance keeps a
 *   small pool, lets idle connections go soon, and gives up on a stuck pooler rather than waiting
 *   until the function times out.
 * - `ca`: a PEM certificate the server's must chain to (Supabase's own root CA, which Node does not
 *   trust; RDS's likewise). The server is then always verified against it, hostname included,
 *   whatever the URL's `sslmode` says.
 */
export interface ConnectionOptions {
  readonly max?: number;
  readonly idleTimeoutMillis?: number;
  readonly connectionTimeoutMillis?: number;
  readonly ca?: string | null;
}

/** The pool size when nothing else is asked for. */
const DEFAULT_POOL_MAX = 10;

/** node-postgres reads these from the URL over any `ssl` option, so a CA needs them gone. */
const URL_TLS_PARAMETERS = [
  'ssl',
  'sslmode',
  'sslrootcert',
  'sslcert',
  'sslkey',
  'sslnegotiation',
  'uselibpqcompat',
];

/** The node-postgres pool configuration for a Postgres URL. */
export function poolConfig(url: string, options: ConnectionOptions = {}): PoolConfig {
  const config: PoolConfig = { connectionString: url, max: options.max ?? DEFAULT_POOL_MAX };
  if (options.idleTimeoutMillis !== undefined) config.idleTimeoutMillis = options.idleTimeoutMillis;
  if (options.connectionTimeoutMillis !== undefined) {
    config.connectionTimeoutMillis = options.connectionTimeoutMillis;
  }
  if (options.ca) {
    const parsed = new URL(url);
    for (const name of URL_TLS_PARAMETERS) parsed.searchParams.delete(name);
    config.connectionString = parsed.toString();
    config.ssl = { ca: options.ca, rejectUnauthorized: true };
  }
  return config;
}

export function openDatabase(url: string, options: ConnectionOptions = {}): Database {
  if (url.startsWith('pglite:')) {
    const location = url.slice('pglite:'.length);
    // PGlite creates only the last folder of its path; a fresh checkout has no `.data/` yet.
    if (location !== 'memory') mkdirSync(location, { recursive: true });
    const client = location === 'memory' ? new PGlite() : new PGlite(location);
    return {
      db: drizzlePglite(client, { schema }) as unknown as Db,
      kind: 'pglite',
      exec: async (script) => {
        await client.exec(script);
      },
      close: () => client.close(),
    };
  }
  if (!/^postgres(ql)?:\/\//.test(url)) {
    throw new Error('DATABASE_URL must start with postgres://, postgresql:// or pglite:');
  }
  const pool = new Pool(poolConfig(url, options));
  // A connection the server ends while the pool holds it idle (a restart, a failover, a pooler
  // letting go, `drop database … with (force)`) is an error on the pool; unheard, Node ends the
  // process (gotcha 54). The pool has already dropped that connection and makes a new one when
  // asked. The SQLSTATE code only: the error carries the connection's settings (hard rule 4).
  pool.on('error', (error) => {
    const code = (error as { code?: unknown }).code;
    console.error(
      `database: a pooled connection ended (${typeof code === 'string' ? code : 'no code'})`,
    );
  });
  return {
    db: drizzleNodePg(pool, { schema }) as unknown as Db,
    kind: 'postgres',
    // A query without parameters uses the simple protocol, which runs several statements.
    exec: async (script) => {
      await pool.query(script);
    },
    close: () => pool.end(),
  };
}

/** Rows from a raw query. Both drivers return them as `.rows`; drizzle types them as unknown. */
export function rowsOf<T>(result: unknown): T[] {
  return (result as { rows: T[] }).rows;
}

/**
 * Refuses unless the database has exactly this checkout's migrations: none missing, none extra.
 * For tools run by hand against a deployed database (the review seed, A1-21), which must never
 * migrate it themselves: the deploy is the only migrator. Changes nothing.
 */
export async function assertMigrated(database: Database): Promise<void> {
  const [table] = rowsOf<{ name: string | null }>(
    await database.db.execute(sql`select to_regclass('uf_migrations')::text as name`),
  );
  if (!table?.name) throw new Error('This database is not migrated: deploy the app first');
  const applied = new Set(
    rowsOf<{ id: string }>(await database.db.execute(sql`select id from uf_migrations`)).map(
      (r) => r.id,
    ),
  );
  const expected = new Set(MIGRATIONS.map((m) => m.id));
  const missing = [...expected].filter((id) => !applied.has(id));
  const extra = [...applied].filter((id) => !expected.has(id));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `This database's migrations don't match this checkout (missing: ${missing.join(', ') || 'none'}; ` +
        `not in this checkout: ${extra.join(', ') || 'none'}). Run this from the deployed commit, after the deploy.`,
    );
  }
}

/**
 * Refuses unless the database user may become the learner role (`set local role uf_app`, which
 * every request made on a learner's behalf runs under). On Postgres 16 and later, a role made by a
 * user that may create roles but isn't a superuser (Supabase's `postgres`, RDS's master user) is
 * granted back to it without the SET option, so migration 0002's membership check passes and yet
 * every learner request fails. Migration 0038 grants it where the owner made the role; this
 * catches what 0038 can't (a role made by another user). Saying so at start, with the fix, beats
 * a broken app.
 */
export async function assertLearnerRole(database: Database): Promise<void> {
  const [row] = rowsOf<{ can_set: boolean; who?: string }>(
    await database.db.execute(sql`
      select current_user as who,
        case when current_setting('server_version_num')::int >= 160000
          then pg_has_role(current_user, 'uf_app', 'SET')
          else pg_has_role(current_user, 'uf_app', 'MEMBER') end as can_set`),
  );
  if (!row?.can_set) {
    const user = row?.who ? `"${row.who.replace(/"/g, '""')}"` : 'current_user';
    // The code is what the startup log prints; the message (with the fix) is for whoever reads it here.
    throw Object.assign(
      new Error(
        `The database user may not act as the learner role uf_app (Postgres 16+, a user that is not a superuser). Run once, as that user: grant uf_app to ${user} with set true;`,
      ),
      { code: 'UF_LEARNER_ROLE' },
    );
  }
}

/** The table of applied migrations, made once, even by two instances starting together. */
async function ensureMigrationsTable(database: Database): Promise<void> {
  const exists = async () =>
    rowsOf<{ name: string | null }>(
      await database.db.execute(sql`select to_regclass('uf_migrations')::text as name`),
    )[0]?.name;
  if (await exists()) return;
  try {
    await database.db.execute(
      sql`create table if not exists uf_migrations (id text primary key, applied_at timestamptz not null default now())`,
    );
  } catch (error) {
    // Two instances making it at once: the second's catalogue row collides with the first's.
    if (!(await exists())) throw error;
  }
}

/** Another instance applied this migration first: its row was there when ours went in. */
function appliedElsewhere(error: unknown): boolean {
  const e = error as { code?: string; constraint?: string } | null;
  return e?.code === '23505' && e.constraint === 'uf_migrations_pkey';
}

/**
 * Applies every migration not yet applied, in order, each in its own transaction. `through` stops
 * after that migration: only for tests of what a migration does to rows written before it.
 *
 * Safe when several servers start at once on the same database (serverless function instances,
 * each migrating as it starts): a migration's own row goes in first, inside its transaction, so
 * a second instance waits on that row and then finds it taken, and skips the migration. No
 * session state and no session advisory lock, so it holds through a transaction pooler
 * (Supabase's Supavisor, PgBouncer) as on a direct connection.
 */
export async function migrate(
  database: Database,
  options: { readonly through?: string } = {},
): Promise<string[]> {
  if (options.through && !MIGRATIONS.some((m) => m.id === options.through)) {
    throw new Error(`No migration ${options.through}`);
  }
  const { db } = database;
  await ensureMigrationsTable(database);
  const done = rowsOf<{ id: string }>(await db.execute(sql`select id from uf_migrations`));
  const applied = new Set(done.map((r) => r.id));
  const ran: string[] = [];
  for (const migration of MIGRATIONS) {
    if (!applied.has(migration.id)) {
      if (!/^\d{4}_[a-z0-9_]+$/.test(migration.id))
        throw new Error(`Bad migration id ${migration.id}`);
      // One transaction per migration: it applies completely or not at all.
      try {
        await database.exec(
          `begin;\ninsert into uf_migrations (id) values ('${migration.id}');\n${migration.sql}\n;commit;`,
        );
        ran.push(migration.id);
      } catch (error) {
        // The embedded database keeps its one connection: leave it out of the failed transaction.
        // (A Postgres pool drops the connection a query failed on.)
        if (database.kind === 'pglite') await database.exec('rollback').catch(() => undefined);
        if (!appliedElsewhere(error)) throw error;
      }
    }
    if (migration.id === options.through) break;
  }
  if (database.kind === 'postgres' && !options.through) await assertLearnerRole(database);
  return ran;
}
