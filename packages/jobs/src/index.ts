/**
 * Scheduled jobs (Phase 4 reminders, matric support), behind an interface (D8). Server-only: it
 * runs in API routes and job runners, never on a device, so the mobile app never depends on it.
 * The contract suite is `@universityflow/jobs/contract`, kept out of this entry so vitest never
 * reaches a server bundle.
 */
export { MemoryJobScheduler } from './memory';
export {
  copyJobPayload,
  defineJobKind,
  type EntityId,
  entityId,
  InvalidJobError,
  InvalidJobPayloadError,
  isEntityId,
  type JobKind,
  type JobPayload,
  type JobPayloadOf,
  MAX_JOB_FIELDS,
  samePayload,
  validateIdempotencyKey,
  validateJobPayload,
} from './payload';
export {
  type CheckedSchedule,
  checkSchedule,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_RUN_LIMIT,
  handle,
  JOB_LEASE_MS,
  JobConflictError,
  type JobContext,
  type JobHandler,
  type JobRunner,
  type JobScheduler,
  type JobStatus,
  type JobView,
  MAX_ATTEMPTS_LIMIT,
  type RunOptions,
  type RunOutcome,
  type RunReport,
  reportOf,
  retryDelayMs,
  runClaimedJob,
  runLimit,
  type ScheduledJob,
  type ScheduleOptions,
} from './scheduler';
