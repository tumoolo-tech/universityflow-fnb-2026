import { InvalidKeyError, MAX_UPLOAD_BYTES } from '@universityflow/documents';
import { storageContract } from '@universityflow/documents/storage-contract';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { type Database, migrate, openDatabase, rowsOf } from './client';
import { FileTooLargeError, PostgresFileStore } from './files';
import { testDatabase } from './testing';

/**
 * The file store a judge demo on Postgres keeps its files in (docs/deploy/demo.md): every
 * serverless instance has its own /tmp, so a file on disk written by one is missing on the next.
 * It meets the same contract as memory, disk and S3 (storage.contract.ts).
 */

describe('PostgresFileStore on PGlite', () => {
  let database: Database;
  beforeAll(async () => {
    database = await testDatabase();
  });
  afterAll(async () => {
    await database.close();
  });

  storageContract(async () => new PostgresFileStore(database));

  it('keeps the content type with the bytes', async () => {
    const store = new PostgresFileStore(database);
    const pdf = {
      bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
      mimeType: 'application/pdf',
    };
    await store.put('doc-type-0001', pdf);
    expect(await store.get('doc-type-0001')).toEqual(pdf);
  });

  it('replaces a file put again under the same key', async () => {
    const store = new PostgresFileStore(database);
    await store.put('doc-again-01', { bytes: new Uint8Array([1]), mimeType: 'image/png' });
    await store.put('doc-again-01', { bytes: new Uint8Array([2, 3]), mimeType: 'image/jpeg' });
    expect(await store.get('doc-again-01')).toEqual({
      bytes: new Uint8Array([2, 3]),
      mimeType: 'image/jpeg',
    });
  });

  it('is seen by a second store over the same database (another server instance)', async () => {
    await new PostgresFileStore(database).put('doc-shared-1', {
      bytes: new Uint8Array([9, 8, 7]),
      mimeType: 'image/webp',
    });
    expect(await new PostgresFileStore(database).get('doc-shared-1')).toEqual({
      bytes: new Uint8Array([9, 8, 7]),
      mimeType: 'image/webp',
    });
  });

  it('refuses a file over the upload limit, and stores nothing', async () => {
    const store = new PostgresFileStore(database);
    const big = { bytes: new Uint8Array(MAX_UPLOAD_BYTES + 1), mimeType: 'application/pdf' };
    await expect(store.put('doc-too-big1', big)).rejects.toThrow(FileTooLargeError);
    expect(await store.get('doc-too-big1')).toBeNull();
  });

  it('refuses over a smaller limit it is given', async () => {
    const store = new PostgresFileStore(database, { maxBytes: 4 });
    await expect(
      store.put('doc-small-01', { bytes: new Uint8Array(5), mimeType: 'image/png' }),
    ).rejects.toThrow(FileTooLargeError);
    await store.put('doc-small-01', { bytes: new Uint8Array(4), mimeType: 'image/png' });
  });

  it('never takes a limit above the upload limit', () => {
    expect(() => new PostgresFileStore(database, { maxBytes: MAX_UPLOAD_BYTES + 1 })).toThrow(
      RangeError,
    );
  });

  it('refuses a content type that is not a plain media type', async () => {
    const store = new PostgresFileStore(database);
    await expect(
      store.put('doc-badtype1', { bytes: new Uint8Array([1]), mimeType: 'text/html; x=<y>' }),
    ).rejects.toThrow(TypeError);
  });

  it('holds the limits in the database too, whatever writes the row', async () => {
    const tooBig = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    await expect(
      database.db.execute(
        sql`insert into stored_files (key, mime_type, bytes) values ('doc-raw-big1', 'image/png', ${tooBig})`,
      ),
    ).rejects.toThrow();
    await expect(
      database.db.execute(
        sql`insert into stored_files (key, mime_type, bytes) values ('../escape', 'image/png', ${new Uint8Array([1])})`,
      ),
    ).rejects.toThrow();
    await expect(
      database.db.execute(
        sql`insert into stored_files (key, mime_type, bytes) values ('doc-raw-type', 'not a type', ${new Uint8Array([1])})`,
      ),
    ).rejects.toThrow();
  });

  it('is never readable by the app role a learner’s request runs as', async () => {
    await new PostgresFileStore(database).put('doc-private1', {
      bytes: new Uint8Array([1]),
      mimeType: 'image/png',
    });
    const asApp = database.db.transaction(async (tx) => {
      await tx.execute(sql`set local role uf_app`);
      return rowsOf<{ key: string }>(await tx.execute(sql`select key from stored_files`));
    });
    const refused = await asApp.then(
      () => null,
      (error: Error) => String((error.cause as Error | undefined)?.message ?? error.message),
    );
    expect(refused).toMatch(/permission denied/);
  });

  it('logs nothing, the bytes and the key included', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    try {
      const store = new PostgresFileStore(database);
      await store.put('doc-quiet-01', { bytes: new Uint8Array([5]), mimeType: 'image/png' });
      await store.get('doc-quiet-01');
      await store.delete('doc-quiet-01');
      await store
        .put('doc-quiet-02', { bytes: new Uint8Array(MAX_UPLOAD_BYTES + 1), mimeType: 'image/png' })
        .catch(() => undefined);
      await store.get('BAD').catch(() => undefined);
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });

  it('checks the key before touching the database', async () => {
    await expect(new PostgresFileStore(database).delete('../x')).rejects.toThrow(InvalidKeyError);
  });
});

/** The same contract through the `pg` driver production's Postgres uses (gated, as postgres.test.ts). */
const url = process.env['TEST_DATABASE_URL'];

describe.skipIf(!url)('PostgresFileStore on real Postgres', () => {
  let database: Database;
  beforeAll(async () => {
    database = openDatabase(url ?? '');
    await migrate(database);
  });
  afterAll(async () => {
    await database.exec(`delete from stored_files where key like 'doc-%'`);
    await database.close();
  });

  storageContract(async () => new PostgresFileStore(database));

  it('refuses a file over the upload limit, and stores nothing', async () => {
    const store = new PostgresFileStore(database);
    const big = { bytes: new Uint8Array(MAX_UPLOAD_BYTES + 1), mimeType: 'application/pdf' };
    await expect(store.put('doc-too-big2', big)).rejects.toThrow(FileTooLargeError);
    expect(await store.get('doc-too-big2')).toBeNull();
  });
});
