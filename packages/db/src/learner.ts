import { sql } from 'drizzle-orm';
import { sastDate } from './age';
import type { Db } from './client';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * Scopes a transaction to one learner before it drops to their role (`uf_app`): who they are
 * (`uf.student_id`, which row-level security filters by) and today's date in South Africa by
 * this store's clock (`uf.today`, which the consent rule `uf_may_process` counts their age on,
 * migration 0014). Both are transaction-local. The date comes from the same clock as
 * `Store.account`, so the app and the database agree at a birthday.
 */
export async function scopeToLearner(tx: Tx, studentId: string, now: Date): Promise<void> {
  await tx.execute(
    sql`select set_config('uf.student_id', ${studentId}, true), set_config('uf.today', ${sastDate(now)}, true)`,
  );
}
