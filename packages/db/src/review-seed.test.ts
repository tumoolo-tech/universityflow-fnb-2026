import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { migrate, openDatabase, rowsOf } from './client';
import { syntheticPhone } from './testing';

/**
 * A1-21: the owner's seed (`pnpm --filter @universityflow/db review:seed`) never migrates. Run
 * from a feature branch it would put an unreviewed migration on production; the deploy is the
 * only migrator. Runs the real script, as the owner would, against an on-disk embedded database.
 */

const PACKAGE = fileURLToPath(new URL('..', import.meta.url));
const JITI = fileURLToPath(new URL('../../../node_modules/jiti/lib/jiti-cli.mjs', import.meta.url));

function seed(databaseUrl: string) {
  return spawnSync(process.execPath, [JITI, 'scripts/review-seed.ts'], {
    cwd: PACKAGE,
    encoding: 'utf8',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      AUTH_SECRET: 's'.repeat(40),
      UF_REVIEW_PHONE: syntheticPhone(8_300_000),
    },
  });
}

async function ids(url: string) {
  const database = openDatabase(url);
  try {
    return rowsOf<{ id: string }>(await database.db.execute(sql`select id from uf_migrations`))
      .map((r) => r.id)
      .sort();
  } finally {
    await database.close();
  }
}

// Each test migrates an on-disk database and runs the seed as a child process that opens and
// checks it again, so its time grows with every migration. At 0019 one took 76 s inside the
// pre-push hook (every package testing at once), past the old 60 s; alone it takes ~20 s.
const SEED_TIMEOUT = 180_000;

describe('review:seed and migrations (A1-21)', () => {
  it(
    'refuses, with a non-zero exit and nothing changed, a database that is a migration behind',
    async () => {
      const dir = mkdtempSync(join(tmpdir(), 'uf-seed-'));
      const url = `pglite:${dir}`;
      try {
        const database = openDatabase(url);
        await migrate(database);
        await database.db.execute(sql`delete from uf_migrations where id = '0010_review_account'`);
        await database.close();
        const before = await ids(url);

        const run = seed(url);
        expect(run.status).not.toBe(0);
        expect(run.stderr).toMatch(/0010_review_account/);
        expect(await ids(url)).toEqual(before);

        const check = openDatabase(url);
        const students = rowsOf<{ n: number }>(
          await check.db.execute(sql`select count(*)::int as n from students`),
        );
        await check.close();
        expect(students[0]?.n).toBe(0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    SEED_TIMEOUT,
  );

  it(
    'seeds a database the deploy has migrated',
    async () => {
      const dir = mkdtempSync(join(tmpdir(), 'uf-seed-'));
      const url = `pglite:${dir}`;
      try {
        const database = openDatabase(url);
        await migrate(database);
        await database.close();
        const run = seed(url);
        expect(run.status).toBe(0);
        expect(run.stdout).toMatch(/^review account created: [0-9a-f-]{36}$/m);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    SEED_TIMEOUT,
  );
});
