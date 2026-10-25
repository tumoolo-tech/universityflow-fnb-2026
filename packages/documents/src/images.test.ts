import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_EDGE, MAX_IMAGE_PIXELS, prepareForReading, targetLongEdge } from './images';
import { sniffType } from './uploads';

/**
 * A1-09: report photos are resized and stripped of metadata before the AI reads them. Every
 * image here is generated in the test: no real photos, nothing personal.
 */

const SYNTHETIC_GPS = { GPSLatitudeRef: 'S', GPSLongitudeRef: 'E' } as const;

/** A flat synthetic "photo" carrying the metadata a phone camera writes. */
async function photo(
  width: number,
  height: number,
  options: { orientation?: number; format?: 'jpeg' | 'png' | 'webp'; alpha?: boolean } = {},
): Promise<Uint8Array> {
  const format = options.format ?? 'jpeg';
  let image = sharp({
    create: {
      width,
      height,
      channels: options.alpha ? 4 : 3,
      background: options.alpha ? { r: 0, g: 0, b: 0, alpha: 0 } : { r: 240, g: 236, b: 220 },
    },
  });
  if (format === 'png') image = image.png();
  else if (format === 'webp') image = image.webp();
  else image = image.jpeg();
  image = image
    .withExif({
      IFD0: { Make: 'SyntheticCam', Model: 'Test 1', Software: 'uf-test' },
      IFD3: SYNTHETIC_GPS,
    })
    .withXmp(
      '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/></x:xmpmeta>',
    );
  if (options.orientation) image = image.withMetadata({ orientation: options.orientation });
  return new Uint8Array(await image.toBuffer());
}

describe('targetLongEdge', () => {
  it('keeps an image within both limits as it is', () => {
    expect(targetLongEdge(1600, 1200)).toBe(1600);
  });

  it('caps a long, thin image by its long edge', () => {
    expect(targetLongEdge(6000, 1000)).toBe(MAX_IMAGE_EDGE);
  });

  it('caps a large 4:3 photo by its area', () => {
    const edge = targetLongEdge(4000, 3000);
    expect(edge).toBeLessThan(MAX_IMAGE_EDGE);
    expect(edge * Math.floor((edge * 3) / 4)).toBeLessThanOrEqual(MAX_IMAGE_PIXELS);
  });
});

describe('prepareForReading', () => {
  it('scales a large photo down within the limits, keeping its aspect ratio', async () => {
    const input = await photo(6000, 4000);
    const out = await prepareForReading({ bytes: input, mimeType: 'image/jpeg' });
    const meta = await sharp(out.bytes).metadata();

    expect(out.mimeType).toBe('image/jpeg');
    expect(sniffType(out.bytes)).toBe('image/jpeg');
    expect(Math.max(meta.width, meta.height)).toBeLessThanOrEqual(MAX_IMAGE_EDGE);
    expect(meta.width * meta.height).toBeLessThanOrEqual(MAX_IMAGE_PIXELS);
    expect(meta.width / meta.height).toBeCloseTo(6000 / 4000, 2);
    expect(out.bytes.length).toBeLessThan(input.length);
  });

  it('caps a panorama by its long edge', async () => {
    const out = await prepareForReading({
      bytes: await photo(8000, 1000),
      mimeType: 'image/jpeg',
    });
    const meta = await sharp(out.bytes).metadata();
    expect(meta.width).toBe(MAX_IMAGE_EDGE);
    expect(meta.width / meta.height).toBeCloseTo(8, 1);
  });

  it('strips EXIF (including GPS), XMP and the orientation tag', async () => {
    const input = await photo(800, 600);
    const before = await sharp(input).metadata();
    expect(before.exif).toBeDefined(); // the fixture really carries metadata
    expect(before.xmp).toBeDefined();

    const out = await prepareForReading({ bytes: input, mimeType: 'image/jpeg' });
    const after = await sharp(out.bytes).metadata();
    expect(after.exif).toBeUndefined();
    expect(after.xmp).toBeUndefined();
    expect(after.iptc).toBeUndefined();
    expect(after.orientation).toBeUndefined();
    // Belt and braces: none of the camera's strings survive anywhere in the file.
    const text = Buffer.from(out.bytes).toString('latin1');
    expect(text).not.toContain('SyntheticCam');
    expect(text).not.toContain('uf-test');
    expect(text).not.toContain('xmpmeta');
  });

  it('does not upscale a small photo', async () => {
    const out = await prepareForReading({ bytes: await photo(640, 480), mimeType: 'image/jpeg' });
    const meta = await sharp(out.bytes).metadata();
    expect([meta.width, meta.height]).toEqual([640, 480]);
  });

  it('turns a photo upright before dropping the orientation tag', async () => {
    // Orientation 6: stored landscape, displayed portrait (a phone held upright).
    const out = await prepareForReading({
      bytes: await photo(400, 200, { orientation: 6 }),
      mimeType: 'image/jpeg',
    });
    const meta = await sharp(out.bytes).metadata();
    expect([meta.width, meta.height]).toEqual([200, 400]);
    expect(meta.orientation).toBeUndefined();
  });

  it('re-encodes PNG and WebP as JPEG, transparent areas on white', async () => {
    const png = await prepareForReading({
      bytes: await photo(300, 200, { format: 'png', alpha: true }),
      mimeType: 'image/png',
    });
    expect(png.mimeType).toBe('image/jpeg');
    expect(sniffType(png.bytes)).toBe('image/jpeg');
    const { data } = await sharp(png.bytes).raw().toBuffer({ resolveWithObject: true });
    expect(Math.min(data[0] ?? 0, data[1] ?? 0, data[2] ?? 0)).toBeGreaterThan(245);

    const webp = await prepareForReading({
      bytes: await photo(300, 200, { format: 'webp' }),
      mimeType: 'image/webp',
    });
    expect(sniffType(webp.bytes)).toBe('image/jpeg');
  });

  it('passes a PDF through untouched', async () => {
    const pdf = new TextEncoder().encode('%PDF-1.7\nsynthetic\n%%EOF');
    const file = { bytes: pdf, mimeType: 'application/pdf' as const };
    expect(await prepareForReading(file)).toBe(file);
  });

  it('rejects bytes that only look like an image', async () => {
    const fake = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8]);
    await expect(prepareForReading({ bytes: fake, mimeType: 'image/jpeg' })).rejects.toThrow();
  });
});
