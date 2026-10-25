import {
  assertKey,
  type FileStore,
  MAX_UPLOAD_BYTES,
  type StoredFile,
} from '@universityflow/documents';
import { type SQL, sql } from 'drizzle-orm';
import { type Database, rowsOf } from './client';

/**
 * Files kept in the app's own Postgres (migration 0033), for a judge demo on Postgres only
 * (docs/deploy/demo.md): it has no S3, and on Vercel each function instance has its own /tmp, so a
 * file written to disk by one instance is missing on the next request. Production and staging
 * never use it (apps/web services.ts: production is S3 only; staging is the embedded database
 * with files on disk).
 *
 * It meets the same contract as memory, disk and S3 (`@universityflow/documents/storage-contract`).
 * Keys are the app's own (`assertKey`), a file is at most the upload limit (`MAX_UPLOAD_BYTES`, or
 * a smaller `maxBytes`), and the database holds both limits too. Rows are written and read by the
 * owner role only, never by a learner's request (row-level security on, no grant to `uf_app`).
 * A file goes when the app deletes its key: with the document, the photo, the judge's copy
 * ("Switch learner", the 24-hour sweep) and the account, each of which returns its keys. Nothing
 * here logs.
 */

export class FileTooLargeError extends Error {
  override readonly name = 'FileTooLargeError';
}

/** A plain media type, such as `application/pdf`: no parameters. */
const MEDIA_TYPE = /^[a-z]+\/[a-z0-9][a-z0-9.+-]{0,99}$/;

export interface PostgresFileStoreOptions {
  /** The largest file kept, in bytes; at most (and by default) `MAX_UPLOAD_BYTES`. */
  readonly maxBytes?: number;
}

export class PostgresFileStore implements FileStore {
  readonly #database: Database;
  readonly #maxBytes: number;

  constructor(database: Database, options: PostgresFileStoreOptions = {}) {
    const maxBytes = options.maxBytes ?? MAX_UPLOAD_BYTES;
    if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_UPLOAD_BYTES) {
      throw new RangeError(`maxBytes is a whole number from 1 to ${MAX_UPLOAD_BYTES}`);
    }
    this.#database = database;
    this.#maxBytes = maxBytes;
  }

  async #rows<T>(query: SQL): Promise<T[]> {
    return rowsOf<T>(await this.#database.db.execute(query));
  }

  async put(key: string, file: StoredFile): Promise<void> {
    assertKey(key);
    if (file.bytes.byteLength > this.#maxBytes) {
      throw new FileTooLargeError(`A stored file is at most ${this.#maxBytes} bytes`);
    }
    if (!MEDIA_TYPE.test(file.mimeType)) throw new TypeError('Not a plain media type');
    const bytes = new Uint8Array(file.bytes);
    await this.#database.db.execute(sql`
      insert into stored_files (key, mime_type, bytes) values (${key}, ${file.mimeType}, ${bytes})
      on conflict (key) do update
        set mime_type = excluded.mime_type, bytes = excluded.bytes, created_at = now()`);
  }

  async get(key: string): Promise<StoredFile | null> {
    assertKey(key);
    const [row] = await this.#rows<{ mime_type: string; bytes: Uint8Array }>(
      sql`select mime_type, bytes from stored_files where key = ${key}`,
    );
    if (!row) return null;
    // `pg` returns a Buffer, PGlite a Uint8Array: a plain copy either way.
    return { bytes: new Uint8Array(row.bytes), mimeType: row.mime_type };
  }

  async delete(key: string): Promise<void> {
    assertKey(key);
    await this.#database.db.execute(sql`delete from stored_files where key = ${key}`);
  }
}
