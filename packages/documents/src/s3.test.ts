import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { checkArrival, SNIFF_BYTES } from './direct-uploads';
import { DEFAULT_S3_REGION, S3FileStore } from './s3';
import { InvalidKeyError } from './storage';
import { storageContract } from './storage.contract';
import { InvalidUploadError, MAX_UPLOAD_BYTES } from './uploads';

const CREDENTIALS = { accessKeyId: 'test-access-key', secretAccessKey: 'test-secret-key' };
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(40).fill(7)]);

/** A real client whose `send` answers from a map in memory, the way S3 would. */
function fakeS3() {
  const objects = new Map<string, { bytes: Uint8Array; type: string }>();
  const client = new S3Client({ region: DEFAULT_S3_REGION, credentials: CREDENTIALS });
  const missing = (name: string) =>
    Object.assign(new Error(name), { name, $metadata: { httpStatusCode: 404 } });
  const body = (bytes: Uint8Array) => ({ transformToByteArray: async () => bytes });
  const send = vi.spyOn(client, 'send').mockImplementation((async (command: unknown) => {
    if (command instanceof PutObjectCommand) {
      const { Key, Body, ContentType } = command.input;
      objects.set(Key ?? '', { bytes: Body as Uint8Array, type: ContentType ?? '' });
      return {};
    }
    if (command instanceof GetObjectCommand) {
      const object = objects.get(command.input.Key ?? '');
      if (!object) throw missing('NoSuchKey');
      const range = /^bytes=0-(\d+)$/.exec(command.input.Range ?? '');
      const bytes = range ? object.bytes.slice(0, Number(range[1]) + 1) : object.bytes;
      return { Body: body(bytes), ContentType: object.type };
    }
    if (command instanceof HeadObjectCommand) {
      const object = objects.get(command.input.Key ?? '');
      if (!object) throw missing('NotFound');
      return { ContentLength: object.bytes.length };
    }
    if (command instanceof DeleteObjectCommand) {
      objects.delete(command.input.Key ?? '');
      return {};
    }
    throw new Error('unexpected command');
  }) as never);
  return { client, objects, send };
}

function policyOf(fields: Readonly<Record<string, string>>) {
  return JSON.parse(Buffer.from(fields['Policy'] ?? '', 'base64').toString('utf8')) as {
    expiration: string;
    conditions: unknown[];
  };
}

/** The input of the first command sent: a PutObject in these tests. */
function firstInput(send: ReturnType<typeof fakeS3>['send']) {
  const [command] = send.mock.calls[0] ?? [];
  return (command as PutObjectCommand).input;
}

describe('S3FileStore meets the storage contract (S3 emulated in memory)', () => {
  storageContract(async () => new S3FileStore({ bucket: 'uf-docs', client: fakeS3().client }));
});

describe('S3FileStore', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to af-south-1, so student files stay in South Africa', async () => {
    expect(DEFAULT_S3_REGION).toBe('af-south-1');
    expect(new S3FileStore({ bucket: 'uf-docs' }).region).toBe('af-south-1');
    expect(new S3FileStore({ bucket: 'uf-docs', region: 'eu-west-1' }).region).toBe('eu-west-1');
  });

  it('encrypts every object with S3-managed keys, never sets an ACL, and prefixes the key', async () => {
    const { client, send } = fakeS3();
    const store = new S3FileStore({ bucket: 'uf-docs', prefix: 'documents/', client });
    await store.put('doc-00000001', { bytes: JPEG, mimeType: 'image/jpeg' });
    const input = firstInput(send);
    expect(input).toMatchObject({
      Bucket: 'uf-docs',
      Key: 'documents/doc-00000001',
      ContentType: 'image/jpeg',
      ContentLength: JPEG.length,
      ServerSideEncryption: 'AES256',
    });
    expect(input).not.toHaveProperty('ACL');
    expect(input).not.toHaveProperty('SSEKMSKeyId');
  });

  it('encrypts with the configured KMS key when there is one', async () => {
    const { client, send } = fakeS3();
    const store = new S3FileStore({ bucket: 'uf-docs', kmsKeyId: 'alias/uf-documents', client });
    await store.put('doc-00000001', { bytes: JPEG, mimeType: 'image/jpeg' });
    expect(firstInput(send)).toMatchObject({
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: 'alias/uf-documents',
    });
  });

  it('passes on any error other than a missing object', async () => {
    const { client, send } = fakeS3();
    send.mockRejectedValueOnce(
      Object.assign(new Error('AccessDenied'), {
        name: 'AccessDenied',
        $metadata: { httpStatusCode: 403 },
      }),
    );
    const store = new S3FileStore({ bucket: 'uf-docs', client });
    await expect(store.get('doc-00000001')).rejects.toThrow('AccessDenied');
    send.mockRejectedValueOnce(new Error('network'));
    await expect(store.inspect('doc-00000001')).rejects.toThrow('network');
  });

  it('treats an answer with no body, type or length as empty', async () => {
    const { client, send } = fakeS3();
    const store = new S3FileStore({ bucket: 'uf-docs', client });
    send.mockResolvedValueOnce({} as never);
    expect(await store.get('doc-00000001')).toEqual({
      bytes: new Uint8Array(),
      mimeType: 'application/octet-stream',
    });
    send.mockResolvedValueOnce({ ContentLength: 3 } as never).mockResolvedValueOnce({} as never);
    expect(await store.inspect('doc-00000001')).toEqual({ size: 3, head: new Uint8Array() });
    send.mockResolvedValueOnce({} as never);
    expect(await store.inspect('doc-00000001')).toEqual({ size: 0, head: new Uint8Array() });
  });

  it('refuses a bad bucket name or prefix', () => {
    expect(() => new S3FileStore({ bucket: 'Not_A_Bucket' })).toThrow();
    expect(() => new S3FileStore({ bucket: 'uf-docs', prefix: '../x/' })).toThrow();
    expect(() => new S3FileStore({ bucket: 'uf-docs', prefix: 'no-slash' })).toThrow();
  });

  it('uses path-style addressing against an S3-compatible endpoint', async () => {
    // Credentials come from the SDK's default chain, here the standard variables.
    vi.stubEnv('AWS_ACCESS_KEY_ID', CREDENTIALS.accessKeyId);
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', CREDENTIALS.secretAccessKey);
    try {
      const store = new S3FileStore({ bucket: 'uf-docs', endpoint: 'http://127.0.0.1:9' });
      const ticket = await store.ticket('incoming-00000001', {
        contentType: 'image/jpeg',
        maxBytes: 10,
        expiresInSeconds: 60,
      });
      expect(ticket.url).toBe('http://127.0.0.1:9/uf-docs');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('S3FileStore direct uploads', () => {
  it('signs a POST policy for one key, one type, 1 byte to the limit, encrypted, no ACL', async () => {
    const store = new S3FileStore({
      bucket: 'uf-docs',
      prefix: 'documents/',
      client: new S3Client({ region: DEFAULT_S3_REGION, credentials: CREDENTIALS }),
    });
    const before = Date.now();
    const ticket = await store.ticket('incoming-00000001', {
      contentType: 'image/png',
      maxBytes: MAX_UPLOAD_BYTES,
      expiresInSeconds: 300,
    });
    expect(ticket.url).toBe('https://uf-docs.s3.af-south-1.amazonaws.com/');
    expect(ticket.fields).toMatchObject({
      key: 'documents/incoming-00000001',
      'Content-Type': 'image/png',
      'x-amz-server-side-encryption': 'AES256',
    });
    expect(Object.keys(ticket.fields).map((k) => k.toLowerCase())).not.toContain('acl');

    const policy = policyOf(ticket.fields);
    expect(policy.conditions).toContainEqual(['content-length-range', 1, MAX_UPLOAD_BYTES]);
    expect(policy.conditions).toContainEqual({ bucket: 'uf-docs' });
    expect(policy.conditions).toContainEqual({ key: 'documents/incoming-00000001' });
    expect(policy.conditions).toContainEqual({ 'Content-Type': 'image/png' });
    expect(policy.conditions).toContainEqual({ 'x-amz-server-side-encryption': 'AES256' });
    const expires = new Date(policy.expiration).getTime();
    expect(expires - before).toBeGreaterThan(295_000);
    expect(expires - before).toBeLessThan(310_000);
    expect(ticket.expiresAt.getTime()).toBeGreaterThanOrEqual(expires - 1000);
  });

  it('puts the KMS key into the policy when there is one', async () => {
    const store = new S3FileStore({
      bucket: 'uf-docs',
      kmsKeyId: 'alias/uf-documents',
      client: new S3Client({ region: DEFAULT_S3_REGION, credentials: CREDENTIALS }),
    });
    const ticket = await store.ticket('incoming-00000001', {
      contentType: 'application/pdf',
      maxBytes: 100,
      expiresInSeconds: 60,
    });
    expect(policyOf(ticket.fields).conditions).toContainEqual({
      'x-amz-server-side-encryption-aws-kms-key-id': 'alias/uf-documents',
    });
  });

  it('refuses a bad key before signing anything', async () => {
    const store = new S3FileStore({ bucket: 'uf-docs', client: fakeS3().client });
    await expect(
      store.ticket('../escape', { contentType: 'image/png', maxBytes: 1, expiresInSeconds: 1 }),
    ).rejects.toThrow(InvalidKeyError);
  });

  it('inspects only the first bytes of what arrived', async () => {
    const { client, send } = fakeS3();
    const store = new S3FileStore({ bucket: 'uf-docs', client });
    await store.put('incoming-00000001', { bytes: JPEG, mimeType: 'image/jpeg' });
    const arrival = await store.inspect('incoming-00000001');
    expect(arrival?.size).toBe(JPEG.length);
    expect(arrival?.head).toEqual(JPEG.slice(0, SNIFF_BYTES));
    const ranged = send.mock.calls
      .map((c) => c[0])
      .find((c) => c instanceof GetObjectCommand) as GetObjectCommand;
    expect(ranged.input.Range).toBe(`bytes=0-${SNIFF_BYTES - 1}`);
    expect(checkArrival(arrival ?? { size: 0, head: new Uint8Array() }, 'image/jpeg')).toBe(
      'image/jpeg',
    );
  });

  it('reports nothing for a key nobody uploaded to, and an empty object as empty', async () => {
    const { client } = fakeS3();
    const store = new S3FileStore({ bucket: 'uf-docs', client });
    expect(await store.inspect('incoming-00000002')).toBeNull();
    await store.put('incoming-00000003', { bytes: new Uint8Array(), mimeType: 'image/jpeg' });
    const empty = await store.inspect('incoming-00000003');
    expect(empty).toEqual({ size: 0, head: new Uint8Array() });
    expect(() => checkArrival(empty ?? { size: 1, head: JPEG }, 'image/jpeg')).toThrow(
      InvalidUploadError,
    );
  });
});

/**
 * The same contract, and the signed-upload policy, against a real S3-compatible server. Runs when
 * TEST_S3_ENDPOINT points at one (a throwaway container; see the comment in .env.example), the
 * way the db package runs against real Postgres when TEST_DATABASE_URL is set.
 */
const endpoint = process.env['TEST_S3_ENDPOINT'];
const bucket = process.env['TEST_S3_BUCKET'] ?? 'uf-test';

/**
 * The bucket, made if missing, once the server answers for it (gotcha 54). A container just
 * started can drop its first connections, and profile-photo.s3.test.ts may be making the same
 * bucket at the same moment, so: make it idempotently (another's "already exists" is fine) and
 * wait until HeadBucket answers, each try cut short at a second, inside the hook's own time.
 * (The same helper is in profile-photo.s3.test.ts: a test file can't import another's.)
 */
async function ensureBucket(client: S3Client, name: string, withinMs = 8_000): Promise<void> {
  const until = Date.now() + withinMs;
  const quick = () => ({ abortSignal: AbortSignal.timeout(1_000) });
  for (;;) {
    try {
      await client.send(new HeadBucketCommand({ Bucket: name }), quick());
      return;
    } catch (error) {
      if (Date.now() > until) throw error;
    }
    await client.send(new CreateBucketCommand({ Bucket: name }), quick()).catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

describe.skipIf(!endpoint)('on a real S3-compatible server', () => {
  const client = new S3Client({
    region: process.env['TEST_S3_REGION'] ?? DEFAULT_S3_REGION,
    endpoint: endpoint ?? 'http://127.0.0.1:9',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env['TEST_S3_ACCESS_KEY'] ?? 'uftest',
      secretAccessKey: process.env['TEST_S3_SECRET_KEY'] ?? 'uftest-secret-key',
    },
  });
  const store = () => new S3FileStore({ bucket, prefix: 'contract/', client });

  beforeAll(async () => {
    await ensureBucket(client, bucket);
  });

  storageContract(async () => store());

  it('stores objects encrypted at rest', async () => {
    await store().put('doc-encrypted', { bytes: JPEG, mimeType: 'image/jpeg' });
    const head = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: 'contract/doc-encrypted' }),
    );
    expect(head.ServerSideEncryption).toBe('AES256');
    await store().delete('doc-encrypted');
  });

  async function post(
    ticket: { url: string; fields: Readonly<Record<string, string>> },
    bytes: Uint8Array,
    type: string,
  ) {
    const form = new FormData();
    for (const [name, value] of Object.entries(ticket.fields)) form.append(name, value);
    form.append('file', new Blob([new Uint8Array(bytes)], { type }));
    return fetch(ticket.url, { method: 'POST', body: form });
  }

  it('accepts a browser upload inside the policy, and inspects it', async () => {
    const s = store();
    const ticket = await s.ticket('incoming-real0001', {
      contentType: 'image/jpeg',
      maxBytes: 1024,
      expiresInSeconds: 60,
    });
    const response = await post(ticket, JPEG, 'image/jpeg');
    expect(response.status, await response.clone().text()).toBeLessThan(300);
    const arrival = await s.inspect('incoming-real0001');
    expect(arrival?.size).toBe(JPEG.length);
    expect(checkArrival(arrival ?? { size: 0, head: new Uint8Array() }, 'image/jpeg')).toBe(
      'image/jpeg',
    );
    await s.delete('incoming-real0001');
  });

  it('refuses an upload over the size limit or of another type', async () => {
    const s = store();
    const ticket = await s.ticket('incoming-real0002', {
      contentType: 'image/jpeg',
      maxBytes: 16,
      expiresInSeconds: 60,
    });
    // Refused by the policy itself, not because the signature or the key was wrong.
    const refusedBy = async (response: Response) => {
      expect(response.status).toBeGreaterThanOrEqual(400);
      const body = await response.text();
      expect(body).not.toMatch(/InvalidAccessKeyId|SignatureDoesNotMatch/);
      return body;
    };
    expect(await refusedBy(await post(ticket, JPEG, 'image/jpeg'))).toMatch(
      /EntityTooLarge|content-length|AccessDenied/i,
    );
    const typed = await s.ticket('incoming-real0003', {
      contentType: 'image/jpeg',
      maxBytes: 1024,
      expiresInSeconds: 60,
    });
    const swapped = { ...typed, fields: { ...typed.fields, 'Content-Type': 'text/html' } };
    expect(await refusedBy(await post(swapped, JPEG, 'text/html'))).toMatch(
      /AccessDenied|condition|policy/i,
    );
    expect(await s.inspect('incoming-real0002')).toBeNull();
    expect(await s.inspect('incoming-real0003')).toBeNull();
  });
});
