import type { FileStore } from '@universityflow/documents';
import {
  defineJobKind,
  entityId,
  handle,
  type JobHandler,
  type JobScheduler,
  type ScheduledJob,
} from '@universityflow/jobs';
import type { Store } from './store';

/**
 * A file deleted after the database has let go of it (audit A1-88; D10: "the file goes once the
 * outline is confirmed").
 *
 * Storage is not the database, so its delete can fail after the outline's save has committed. The
 * save therefore queues the file's key in `file_deletions` (migration 0042) in the same transaction
 * that deletes the document's row. The route then deletes the file at once and forgets the row;
 * if storage fails, the learner still gets their saved outline (200), and a `file.delete` job
 * tries again, with retries, until the file is gone. A row the job finds forgotten is nothing to
 * do, so the route's delete and the job's can't conflict.
 *
 * **What it carries (hard rule 4).** One id: the queue row's, which names a storage key and
 * nothing else (no learner, no name). The key itself never goes into a payload or a log.
 */

export const FILE_DELETION = defineJobKind('file.delete', ['fileDeletionId']);
/** Retried with the scheduler's backoff (1, 2, 4 … minutes, at most an hour): about four hours. */
export const FILE_DELETION_ATTEMPTS = 10;

export interface FileDeletionParts {
  readonly store: Pick<Store, 'queuedFileDeletion' | 'forgetFileDeletion'>;
  readonly files: Pick<FileStore, 'delete'>;
}

/** Deletes the queued file and forgets it; nothing when it is already forgotten. Throws if storage does. */
export async function deleteQueuedFile(parts: FileDeletionParts, id: string): Promise<void> {
  const key = await parts.store.queuedFileDeletion(id);
  if (key === null) return;
  await parts.files.delete(key);
  await parts.store.forgetFileDeletion(id);
}

/** Puts the deletion on the schedule: once per queued file, however often it is asked. */
export function scheduleFileDeletion(
  scheduler: JobScheduler,
  id: string,
  now: Date,
): Promise<ScheduledJob> {
  const fileDeletionId = entityId(id);
  return scheduler.schedule({
    kind: FILE_DELETION,
    payload: { fileDeletionId },
    runAt: now,
    idempotencyKey: `file-delete:${fileDeletionId}`,
    maxAttempts: FILE_DELETION_ATTEMPTS,
  });
}

/** The `file.delete` handler. A failure throws, so the scheduler retries it. */
export function fileDeletionHandler(parts: FileDeletionParts): JobHandler {
  return handle(FILE_DELETION, async ({ fileDeletionId }) => {
    await deleteQueuedFile(parts, fileDeletionId);
  });
}
