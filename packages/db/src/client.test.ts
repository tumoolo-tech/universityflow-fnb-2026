import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  assertLearnerRole,
  type Database,
  migrate,
  openDatabase,
  poolConfig,
  rowsOf,
} from './client';
import { MIGRATIONS } from './migrations';

const root = mkdtempSync(join(tmpdir(), 'uf-db-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('openDatabase', () => {
  it('opens an on-disk database whose parent folders do not exist yet', async () => {
    // Regression: a fresh checkout has no `.data/`, and PGlite only creates the last folder.
    const database = openDatabase(`pglite:${join(root, 'not', 'yet', 'here')}`);
    expect(await migrate(database)).toEqual(MIGRATIONS.map((m) => m.id));
    const rows = rowsOf<{ n: number }>(
      await database.db.execute(sql`select count(*)::int as n from uf_migrations`),
    );
    expect(rows[0]?.n).toBe(MIGRATIONS.length);
    await database.close();
    // Creating an on-disk database takes ~15 s alone and over 40 s while the whole gate runs
    // (gotcha 23), more than the package's 30 s default.
  }, 120_000);

  it('refuses a URL it does not understand', () => {
    expect(() => openDatabase('mysql://nope')).toThrow(/DATABASE_URL/);
  });
});

const PEM = '-----BEGIN CERTIFICATE-----\nMIIBsynthetic\n-----END CERTIFICATE-----';

describe('poolConfig: how a Postgres URL becomes the pool', () => {
  it('without options, the URL and pool exactly as before (production unchanged)', () => {
    const url = 'postgres://uf:secret@db.example:5432/uf?sslmode=verify-full';
    expect(poolConfig(url)).toEqual({ connectionString: url, max: 10 });
  });

  it('a serverless pool: its size, idle and connect timeouts', () => {
    const config = poolConfig('postgres://uf@db.example/uf', {
      max: 5,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 15_000,
    });
    expect(config).toMatchObject({
      max: 5,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 15_000,
    });
  });

  // Supabase's certificates come from its own root CA, which Node does not trust; node-postgres
  // reads `sslmode` from the URL over any `ssl` option, so the URL's TLS settings must go.
  it('with a CA, verifies the server against it, whatever the URL says about TLS', () => {
    const config = poolConfig(
      'postgresql://postgres.ref:pw@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?sslmode=require&application_name=uf',
      { ca: PEM },
    );
    expect(config.ssl).toEqual({ ca: PEM, rejectUnauthorized: true });
    expect(config.connectionString).toBe(
      'postgresql://postgres.ref:pw@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?application_name=uf',
    );
    for (const mode of ['disable', 'no-verify', 'prefer']) {
      expect(
        poolConfig(`postgres://h/db?sslmode=${mode}&sslrootcert=/x.crt`, { ca: PEM }),
      ).toMatchObject({
        connectionString: 'postgres://h/db',
        ssl: { ca: PEM, rejectUnauthorized: true },
      });
    }
  });
});

describe('the learner role (SET LOCAL ROLE uf_app)', () => {
  // Postgres 16+: a role made by a CREATEROLE user that isn't a superuser (Supabase's `postgres`,
  // RDS's master user) is granted back without the SET option, so every learner request failed
  // with "permission denied to set role" although migration 0002's membership check passed.
  const answering = (canSet: boolean) =>
    ({
      kind: 'postgres',
      db: { execute: async () => ({ rows: [{ can_set: canSet }] }) },
    }) as unknown as Database;

  it('refuses to start, naming the one-line fix, when the database user may not become uf_app', async () => {
    await expect(assertLearnerRole(answering(false))).rejects.toThrow(
      /grant uf_app to .* with set true/,
    );
    // A code the startup log may print (the message stays out of logs).
    await expect(assertLearnerRole(answering(false))).rejects.toMatchObject({
      code: 'UF_LEARNER_ROLE',
    });
  });

  it('passes when it may, and on the embedded database (a superuser)', async () => {
    await expect(assertLearnerRole(answering(true))).resolves.toBeUndefined();
    const database = openDatabase('pglite:memory');
    await migrate(database);
    await expect(assertLearnerRole(database)).resolves.toBeUndefined();
    await database.close();
  });
});
