import 'server-only';
import type { JobScheduler } from '@universityflow/jobs';

/**
 * The live job schedulers, by the name `UF_JOBS_PROVIDER` selects. Each one implements
 * `JobScheduler` and passes the job scheduler contract (`@universityflow/jobs/contract`) before
 * it is listed here (D8).
 *
 * Empty on purpose: the hosted scheduler (Trigger.dev, spike 5) is connected by the owner at the
 * end, and where its workers run is still an open residency question. Until then
 * `UF_PROVIDERS=live` refuses to start, naming the missing adapter, rather than fall back to the
 * Postgres stand-in.
 */
export type JobAdapterFactory = (env: Record<string, string | undefined>) => JobScheduler;

export const JOB_ADAPTERS: Readonly<Record<string, JobAdapterFactory>> = {};
