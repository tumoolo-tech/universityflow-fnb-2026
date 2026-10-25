import type { JobSchedulerHarness } from '@universityflow/jobs/contract';
import { type Database, migrate, openDatabase } from './client';
import { PostgresJobScheduler } from './jobs';
import { type OtpChallenge, Store, type StoreOptions } from './store';

/**
 * Test helpers. The database is real Postgres (PGlite), so row-level security and constraints
 * behave exactly as in production. Starting one takes a few seconds, so a test file opens one
 * (`testDatabase`) and each test gets its own Store and clock over it (`testStore`); tests stay
 * independent by using their own synthetic phone numbers.
 */

export async function testDatabase(): Promise<Database> {
  const database = openDatabase('pglite:memory');
  await migrate(database);
  return database;
}

/** The AUTH_SECRET every test store uses. */
export const TEST_SECRET = 'test-secret-that-is-long-enough-for-hmac-keys';

export function testStore(
  database: Database,
  start = new Date('2026-10-13T08:00:00Z'),
  options: Pick<StoreOptions, 'review' | 'reviewAlerts'> = {},
) {
  let now = start;
  const store = new Store(database, {
    secret: TEST_SECRET,
    clock: () => now,
    ...options,
  });
  return {
    database,
    store,
    advance(ms: number) {
      now = new Date(now.getTime() + ms);
    },
  };
}

/**
 * The job scheduler contract's harness over one database: the table is emptied first (each
 * contract test starts with no due jobs, so never point it at a database whose jobs matter), and
 * two schedulers over the same database stand for two servers' runners.
 */
export function postgresJobHarness(database: Database) {
  return async (): Promise<JobSchedulerHarness> => {
    await database.exec('delete from jobs');
    let now = new Date('2026-10-13T08:00:00Z');
    const clock = () => now;
    const scheduler = new PostgresJobScheduler(database, { clock });
    return {
      scheduler,
      runners: [scheduler, new PostgresJobScheduler(database, { clock })],
      now: clock,
      advance(ms) {
        now = new Date(now.getTime() + ms);
      },
    };
  };
}

let next = 1_000_000;
/** A synthetic cellphone number, unique per call, built at runtime (no real number in source). */
export function syntheticPhone(n = next++): string {
  return `+2782${String(n).padStart(7, '0')}`;
}

/**
 * For a database that outlives the test run (TEST_DATABASE_URL, A1-40): start this run's numbers
 * in a block of 1,000 no recent run used (one block per second, reused after ~2 hours), so a
 * second run neither signs in to the first run's students nor meets their PIN cooldown.
 */
export function freshSyntheticPhones(nowMs = Date.now()): void {
  next = 1_000_000 + (Math.floor(nowMs / 1000) % 8_000) * 1_000;
}

/** The PIN an ordinary challenge sent by SMS. A store-review challenge has none: it fails. */
export function smsCode(challenge: OtpChallenge): string {
  if (challenge.review) throw new Error('A store-review challenge sends no PIN');
  return challenge.code;
}

/** Signs a new student in and returns their id and session token. */
export async function signIn(store: Store, phone: string = syntheticPhone()) {
  const code = smsCode(await store.requestOtp(phone));
  return store.verifyOtp(phone, code);
}

/**
 * An adult student who has agreed in their own name (A7-04) to wording that covers everything,
 * letters and proofs included (adult-v2, A11-13), ready to use.
 */
export async function adultStudent(store: Store) {
  const session = await signIn(store);
  await store.setDateOfBirth(session.studentId, '2000-01-15');
  await store.consentAsAdult(session.studentId, 'adult-v2-test');
  return session;
}
