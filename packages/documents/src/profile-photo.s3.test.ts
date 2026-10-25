import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { PHOTO_EDGE, prepareProfilePhoto } from './profile-photo';
import { DEFAULT_S3_REGION, S3FileStore } from './s3';

/**
 * The profile photo's whole upload path against a real S3-compatible server (A11-31, the switch-on
 * checklist in docs/deploy/profile-photo.md). The photo is a server upload, not a signed one:
 * /api/me/photo receives it, packages/documents prepares it (crop, 512 × 512, black and white, no
 * metadata), and the files service keeps it under a key the app made. This runs that path on a
 * real server: what is stored is the prepared photo only (no camera details or location), it is
 * encrypted at rest, the learner gets the same bytes back, and "Remove photo" leaves nothing.
 * Runs when TEST_S3_ENDPOINT points at one (a throwaway SeaweedFS container; .env.example), as
 * s3.test.ts does; skipped otherwise. Every photo is drawn at runtime (hard rule 4).
 */

const endpoint = process.env['TEST_S3_ENDPOINT'];
const bucket = process.env['TEST_S3_BUCKET'] ?? 'uf-test';

/**
 * The bucket, made if missing, once the server answers for it (gotcha 54). A container just
 * started can drop its first connections, and s3.test.ts may be making the same bucket at the same
 * moment, so: make it idempotently (another's "already exists" is fine) and wait until HeadBucket
 * answers, each try cut short at a second, inside the hook's own time. (The same helper is in
 * s3.test.ts: a test file can't import another's.)
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

/** A synthetic camera photo, with a camera's details and a location, as a phone would send it. */
async function cameraPhoto() {
  return new Uint8Array(
    await sharp({
      create: { width: 1600, height: 1200, channels: 3, background: { r: 180, g: 60, b: 40 } },
    })
      .withExif({
        IFD0: { Artist: 'Synthetic Artist', Model: 'TestCam' },
        IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '26/1 11/1 0/1' },
      })
      .jpeg()
      .toBuffer(),
  );
}

describe.skipIf(!endpoint)('the profile photo on a real S3-compatible server', () => {
  const client = new S3Client({
    region: process.env['TEST_S3_REGION'] ?? DEFAULT_S3_REGION,
    endpoint: endpoint ?? 'http://127.0.0.1:9',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env['TEST_S3_ACCESS_KEY'] ?? 'uftest',
      secretAccessKey: process.env['TEST_S3_SECRET_KEY'] ?? 'uftest-secret-key',
    },
  });
  const store = new S3FileStore({ bucket, prefix: 'photos/', client });
  const key = `photo-${'5a'.repeat(16)}`;

  beforeAll(async () => {
    await ensureBucket(client, bucket);
  });

  it('keeps only the prepared photo, encrypted, serves the same bytes back, and removes it', async () => {
    const prepared = await prepareProfilePhoto(await cameraPhoto(), { x: 0.1, y: 0, size: 0.75 });
    await store.put(key, prepared);

    // What is at rest: the prepared JPEG, encrypted, with no trace of the camera or the place.
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: `photos/${key}` }));
    expect(head.ServerSideEncryption).toBe('AES256');
    expect(head.ContentType).toBe('image/jpeg');
    const raw = await client.send(new GetObjectCommand({ Bucket: bucket, Key: `photos/${key}` }));
    const atRest = await raw.Body?.transformToByteArray();
    if (!atRest) throw new Error('nothing stored');
    const meta = await sharp(atRest).metadata();
    expect(meta).toMatchObject({ format: 'jpeg', width: PHOTO_EDGE, height: PHOTO_EDGE });
    expect(meta.channels).toBe(1);
    expect(meta.exif).toBeUndefined();
    const text = Buffer.from(atRest).toString('latin1');
    for (const trace of ['Exif', 'Synthetic', 'TestCam']) expect(text).not.toContain(trace);

    // Served to its owner: the same bytes.
    const served = await store.get(key);
    expect(served?.mimeType).toBe('image/jpeg');
    expect(Buffer.from(served?.bytes ?? new Uint8Array()).equals(Buffer.from(prepared.bytes))).toBe(
      true,
    );

    // "Remove photo" (and the account's deletion, and a guardian's withdrawal) leave nothing.
    await store.delete(key);
    expect(await store.get(key)).toBeNull();
    expect(await store.inspect(key)).toBeNull();
  });
});
