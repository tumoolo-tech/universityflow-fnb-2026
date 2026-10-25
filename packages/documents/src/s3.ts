import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import {
  type Arrival,
  type DirectUploads,
  SNIFF_BYTES,
  type TicketRequest,
  type UploadTicket,
} from './direct-uploads';
import { assertKey, type FileStore, type StoredFile } from './storage';

/**
 * Uploaded documents in S3 (planning.md §16.1): a private bucket in af-south-1, every object
 * encrypted at rest, no public ACL ever, and access only through short-lived signed forms.
 *
 * Credentials come from the AWS SDK's default provider chain (the deployment's role, or the
 * standard AWS_* variables): this class never reads or holds a key itself.
 */

export const DEFAULT_S3_REGION = 'af-south-1';

export interface S3FileStoreOptions {
  readonly bucket: string;
  /** Default af-south-1: student data stays in South Africa. */
  readonly region?: string;
  /** Encrypt with this KMS key (SSE-KMS). Without one, S3-managed keys (SSE-S3, AES-256). */
  readonly kmsKeyId?: string | null;
  /** A folder inside the bucket, e.g. `documents/`. Lower-case segments, each ending in `/`. */
  readonly prefix?: string;
  /** An S3-compatible server instead of AWS (tests only). Uses path-style addressing. */
  readonly endpoint?: string | null;
  /** A client to use instead of building one (tests). */
  readonly client?: S3Client;
}

const PREFIX = /^(?:[a-z0-9][a-z0-9-]*\/)*$/;
const BUCKET = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

/** The SDK's "not there" answers: NoSuchKey for a GET, a bare 404 for a HEAD. */
function isMissing(error: unknown): boolean {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === 'NoSuchKey' || e?.name === 'NotFound' || e?.$metadata?.httpStatusCode === 404;
}

export class S3FileStore implements FileStore, DirectUploads {
  readonly #client: S3Client;
  readonly #bucket: string;
  readonly #prefix: string;
  readonly #kmsKeyId: string | null;
  readonly region: string;

  constructor(options: S3FileStoreOptions) {
    if (!BUCKET.test(options.bucket)) throw new Error('Not a valid S3 bucket name');
    const prefix = options.prefix ?? '';
    if (!PREFIX.test(prefix)) throw new Error('An S3 prefix is lower-case segments ending in /');
    this.#bucket = options.bucket;
    this.#prefix = prefix;
    this.#kmsKeyId = options.kmsKeyId || null;
    this.region = options.region ?? DEFAULT_S3_REGION;
    this.#client =
      options.client ??
      new S3Client({
        region: this.region,
        ...(options.endpoint ? { endpoint: options.endpoint, forcePathStyle: true } : {}),
      });
  }

  #key(key: string): string {
    assertKey(key);
    return `${this.#prefix}${key}`;
  }

  /** Server-side encryption on every write, as request headers. */
  #encryption() {
    return this.#kmsKeyId
      ? { ServerSideEncryption: 'aws:kms' as const, SSEKMSKeyId: this.#kmsKeyId }
      : { ServerSideEncryption: 'AES256' as const };
  }

  async put(key: string, file: StoredFile): Promise<void> {
    await this.#client.send(
      new PutObjectCommand({
        Bucket: this.#bucket,
        Key: this.#key(key),
        Body: file.bytes,
        ContentType: file.mimeType,
        ContentLength: file.bytes.length,
        ...this.#encryption(),
      }),
    );
  }

  async get(key: string): Promise<StoredFile | null> {
    const Key = this.#key(key);
    try {
      const object = await this.#client.send(new GetObjectCommand({ Bucket: this.#bucket, Key }));
      const bytes = (await object.Body?.transformToByteArray()) ?? new Uint8Array();
      return {
        bytes: new Uint8Array(bytes),
        mimeType: object.ContentType ?? 'application/octet-stream',
      };
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    // S3 deletes are idempotent: a missing key is not an error.
    await this.#client.send(new DeleteObjectCommand({ Bucket: this.#bucket, Key: this.#key(key) }));
  }

  /**
   * A signed POST policy for one object: this key only, exactly this type, 1 byte to `maxBytes`,
   * encrypted, and no ACL field accepted (the bucket's own private setting applies).
   */
  async ticket(key: string, request: TicketRequest): Promise<UploadTicket> {
    const Key = this.#key(key);
    const encryption: Record<string, string> = this.#kmsKeyId
      ? {
          'x-amz-server-side-encryption': 'aws:kms',
          'x-amz-server-side-encryption-aws-kms-key-id': this.#kmsKeyId,
        }
      : { 'x-amz-server-side-encryption': 'AES256' };
    // Every field becomes an exact-match condition of the policy (the SDK adds them, with the
    // bucket and the key), so the browser can't change the type or drop the encryption.
    const { url, fields: signed } = await createPresignedPost(this.#client, {
      Bucket: this.#bucket,
      Key,
      Fields: { 'Content-Type': request.contentType, ...encryption },
      Conditions: [['content-length-range', 1, request.maxBytes]],
      Expires: request.expiresInSeconds,
    });
    return {
      url,
      fields: signed,
      expiresAt: new Date(Date.now() + request.expiresInSeconds * 1000),
    };
  }

  async inspect(key: string): Promise<Arrival | null> {
    const Key = this.#key(key);
    try {
      const head = await this.#client.send(new HeadObjectCommand({ Bucket: this.#bucket, Key }));
      const size = head.ContentLength ?? 0;
      if (size === 0) return { size, head: new Uint8Array() };
      const first = await this.#client.send(
        new GetObjectCommand({ Bucket: this.#bucket, Key, Range: `bytes=0-${SNIFF_BYTES - 1}` }),
      );
      const bytes = (await first.Body?.transformToByteArray()) ?? new Uint8Array();
      return { size, head: new Uint8Array(bytes).slice(0, SNIFF_BYTES) };
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }
}
