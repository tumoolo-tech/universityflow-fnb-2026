/**
 * Creates the synthetic store-review account (audit A7-01, docs/store/review-notes.md). Run by
 * the owner, once per database, before a store submission:
 *
 *   DATABASE_URL=… AUTH_SECRET=… UF_REVIEW_PHONE=… pnpm --filter @universityflow/db review:seed
 *
 * A script, not a web route: a route that seeds would be one more way into production, and a dev
 * route (which production refuses) couldn't reach the production database anyway. This runs only
 * where someone already holds DATABASE_URL.
 *
 * Idempotent: an existing review account is left as it is (re-run it after a reviewer deletes
 * the account). It refuses a number that belongs to anyone else. Prints the account's id only,
 * never the number (hard rule 4).
 *
 * It never migrates (A1-21): run from a feature branch, that would put an unreviewed migration on
 * production outside the deploy. It refuses, changing nothing, unless the database has exactly
 * this checkout's migrations: run it from the deployed commit, after the deploy.
 */
import { assertMigrated, openDatabase, Store } from '../src/index';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`review:seed needs ${name}`);
    process.exit(1);
  }
  return value;
}

const database = openDatabase(required('DATABASE_URL'));
try {
  // The deploy is the only migrator: this only checks.
  await assertMigrated(database);
  const store = new Store(database, { secret: required('AUTH_SECRET') });
  const { studentId, created } = await store.seedReviewAccount(required('UF_REVIEW_PHONE'));
  console.log(
    created ? `review account created: ${studentId}` : `review account already there: ${studentId}`,
  );
} catch (error) {
  // The error's name and message only: the store's messages carry no personal data.
  console.error('review:seed failed:', error instanceof Error ? error.message : 'unknown');
  process.exitCode = 1;
} finally {
  await database.close();
}
