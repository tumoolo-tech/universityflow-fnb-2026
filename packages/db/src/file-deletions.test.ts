import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from './client';
import {
  deleteQueuedFile,
  FILE_DELETION,
  FILE_DELETION_ATTEMPTS,
  fileDeletionHandler,
  scheduleFileDeletion,
} from './file-deletions';
import { PostgresJobScheduler } from './jobs';
import { signIn, syntheticPhone, testDatabase, testStore } from './testing';

/**
 * The file an outline was read from goes once the outline is confirmed (D10). Storage is not the
 * database: its delete can fail after the outline is saved (A1-88). The key is queued in the same
 * transaction as the save, and a job carrying only the queue row's id deletes it, retried, so a
 * learner never gets an error for an outline that was saved and no file is left that nothing
 * points at. Every value here is synthetic.
 */

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(async () => {
  await database.close();
});
beforeEach(async () => {
  await database.exec('delete from jobs');
});

const START = new Date('2027-03-01T08:00:00Z');

/** A file store that fails the first `failures` deletes, then records them. */
function files(failures = 0) {
  const deleted: string[] = [];
  let left = failures;
  return {
    deleted,
    store: {
      put: async () => {},
      get: async () => null,
      delete: async (key: string) => {
        if (left > 0) {
          left--;
          throw new Error('storage is down');
        }
        deleted.push(key);
      },
    },
  };
}

async function queued() {
  const h = testStore(database, START);
  const { studentId } = await signIn(h.store, syntheticPhone());
  await h.store.setDateOfBirth(studentId, '2000-01-15');
  await h.store.consentAsAdult(studentId, 'adult-v3-test');
  const student = h.store.forStudent(studentId);
  const document = await student.addDocument({
    kind: 'module-outline',
    storageKey: `outline-${crypto.randomUUID()}`,
    mimeType: 'application/pdf',
    sizeBytes: 10,
  });
  const saved = await student.saveModuleOutline({
    moduleCode: 'FILE1001',
    moduleName: null,
    academicYear: 2027,
    term: null,
    components: { status: 'not-in-outline' },
    dates: { status: 'not-in-outline' },
    books: { status: 'not-in-outline' },
    people: { status: 'not-in-outline' },
    documentId: document?.id ?? null,
  });
  return { ...h, id: saved.fileDeletionId as string, key: document?.storageKey as string };
}

describe('the file.delete job (A1-88)', () => {
  it('carries the queue row’s id and nothing else (hard rule 4), retried', async () => {
    const { store, id, advance } = await queued();
    let now = START;
    const scheduler = new PostgresJobScheduler(database, { clock: () => now });
    const job = await scheduleFileDeletion(scheduler, id, now);
    expect(await scheduler.get(job.id)).toMatchObject({
      kind: FILE_DELETION.name,
      payload: { fileDeletionId: id },
    });
    // Scheduling it again (a retried request) is the same job.
    expect((await scheduleFileDeletion(scheduler, id, now)).id).toBe(job.id);

    // Storage is down for the first run: the job fails, the file stays queued, a retry follows.
    const storage = files(1);
    const handler = fileDeletionHandler({ store, files: storage.store });
    expect((await scheduler.runDue([handler])).completed).toEqual([]);
    expect(await store.queuedFileDeletion(id)).not.toBeNull();
    now = new Date(START.getTime() + 60 * 60 * 1000);
    advance(60 * 60 * 1000);
    expect((await scheduler.runDue([handler])).completed).toEqual([job.id]);
    expect(storage.deleted).toHaveLength(1);
    expect(await store.queuedFileDeletion(id)).toBeNull();
    expect(FILE_DELETION_ATTEMPTS).toBeGreaterThan(3);
  });

  it('deletes the file and forgets the row; a row already forgotten is nothing to do', async () => {
    const { store, id, key } = await queued();
    const storage = files();
    await deleteQueuedFile({ store, files: storage.store }, id);
    expect(storage.deleted).toEqual([key]);
    await deleteQueuedFile({ store, files: storage.store }, id);
    expect(storage.deleted).toEqual([key]);
  });

  it('keeps the row when storage fails, so the job can try again', async () => {
    const { store, id } = await queued();
    await expect(deleteQueuedFile({ store, files: files(1).store }, id)).rejects.toThrow();
    expect(await store.queuedFileDeletion(id)).not.toBeNull();
  });
});
