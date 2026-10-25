import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  checkPhoto,
  cropPixels,
  heicDecodes,
  InvalidPhotoError,
  MAX_PHOTO_BYTES,
  PHOTO_EDGE,
  prepareProfilePhoto,
  sniffPhotoType,
} from './profile-photo';

/**
 * The profile photo, made safe to keep (profile-look-proposal §5.3): 2 MB at most, JPEG, PNG or
 * HEIC by its own bytes, the learner's crop applied, 512 × 512 black and white out, and nothing of
 * the original's metadata. Every image here is drawn at runtime: no real photo (hard rule 4).
 */

const WHOLE = { x: 0, y: 0, size: 1 };

/** A synthetic photo: two colours side by side, so a crop and a turn can be seen. */
async function photo(
  options: {
    width?: number;
    height?: number;
    format?: 'jpeg' | 'png';
    exif?: boolean;
    orientation?: number;
  } = {},
) {
  const width = options.width ?? 800;
  const height = options.height ?? 600;
  const left = await sharp({
    create: { width: width / 2, height, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
  let image = sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).composite([{ input: left, left: 0, top: 0 }]);
  if (options.exif) {
    image = image
      .withExif({
        IFD0: { Copyright: 'Synthetic test image', Artist: 'Synthetic Artist', Model: 'TestCam' },
        IFD3: {
          GPSLatitudeRef: 'S',
          GPSLatitude: '26/1 11/1 0/1',
          GPSLongitudeRef: 'E',
          GPSLongitude: '28/1 2/1 0/1',
        },
      })
      .withXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF/></x:xmpmeta>');
  }
  if (options.orientation) image = image.withMetadata({ orientation: options.orientation });
  const out =
    options.format === 'png' ? await image.png().toBuffer() : await image.jpeg().toBuffer();
  return new Uint8Array(out);
}

/** The mean brightness (0 black to 255 white) of the stored photo's left and right halves. */
async function halves(bytes: Uint8Array) {
  const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
  let left = 0;
  let right = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const v = data[(y * info.width + x) * info.channels] ?? 0;
      if (x < info.width / 2) left += v;
      else right += v;
    }
  }
  const n = (info.width / 2) * info.height;
  return { left: left / n, right: right / n };
}

const text = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');

/** The first bytes of a HEIC file (an `ftyp` box with the `heic` brand), enough to sniff. */
const HEIC_HEAD = new Uint8Array([
  0,
  0,
  0,
  0x18,
  ...Buffer.from('ftypheic'),
  0,
  0,
  0,
  0,
  ...Buffer.from('mif1heic'),
]);

describe('which photos are taken', () => {
  it('knows a JPEG, a PNG and a HEIC by their bytes, whatever they are called', async () => {
    expect(sniffPhotoType(await photo())).toBe('image/jpeg');
    expect(sniffPhotoType(await photo({ format: 'png' }))).toBe('image/png');
    expect(sniffPhotoType(HEIC_HEAD)).toBe('image/heic');
    // A WebP, a GIF, a PDF and a text file renamed .jpg are not photos it takes.
    const webp = new Uint8Array(
      await sharp(await photo())
        .webp()
        .toBuffer(),
    );
    expect(sniffPhotoType(webp)).toBeNull();
    expect(sniffPhotoType(new Uint8Array(Buffer.from('GIF89a......')))).toBeNull();
    expect(sniffPhotoType(new Uint8Array(Buffer.from('%PDF-1.7')))).toBeNull();
    expect(() => checkPhoto(new Uint8Array(Buffer.from('not a photo at all')))).toThrow(
      expect.objectContaining({ reason: 'unsupported-type' }),
    );
  });

  it('refuses an empty file and anything over 2 MB, before decoding it', () => {
    expect(() => checkPhoto(new Uint8Array())).toThrow(
      expect.objectContaining({ reason: 'empty' }),
    );
    const big = new Uint8Array(MAX_PHOTO_BYTES + 1);
    big.set([0xff, 0xd8, 0xff]);
    expect(() => checkPhoto(big)).toThrow(expect.objectContaining({ reason: 'too-large' }));
    const limit = new Uint8Array(MAX_PHOTO_BYTES);
    limit.set([0xff, 0xd8, 0xff]);
    expect(checkPhoto(limit)).toBe('image/jpeg');
  });

  it('refuses a HEIC with its own reason when this build of sharp can’t decode it', () => {
    expect(() => checkPhoto(HEIC_HEAD, { heic: false })).toThrow(
      expect.objectContaining({ reason: 'heic-unsupported' }),
    );
    expect(checkPhoto(HEIC_HEAD, { heic: true })).toBe('image/heic');
  });

  it('runs on a sharp that can’t decode HEIC (revisit the web’s HEIC message if this changes)', () => {
    expect(heicDecodes()).toBe(false);
  });

  it('refuses a photo that isn’t one inside, and a crop off the photo', async () => {
    const broken = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5]);
    await expect(prepareProfilePhoto(broken, WHOLE)).rejects.toThrow(InvalidPhotoError);
    await expect(prepareProfilePhoto(broken, WHOLE)).rejects.toMatchObject({
      reason: 'unreadable',
    });
    const good = await photo();
    for (const box of [
      { x: -0.1, y: 0, size: 1 },
      { x: 0, y: 0, size: 0 },
      { x: 0, y: 0, size: 1.5 },
      { x: 0, y: 0, size: 0.1 },
      { x: Number.NaN, y: 0, size: 1 },
    ]) {
      await expect(prepareProfilePhoto(good, box), JSON.stringify(box)).rejects.toMatchObject({
        reason: 'bad-crop',
      });
    }
  });
});

describe('what is kept', () => {
  it('is 512 × 512, black and white, a JPEG', async () => {
    const out = await prepareProfilePhoto(await photo({ width: 1200, height: 800 }), WHOLE);
    const meta = await sharp(out.bytes).metadata();
    expect(out.mimeType).toBe('image/jpeg');
    expect(meta).toMatchObject({ format: 'jpeg', width: PHOTO_EDGE, height: PHOTO_EDGE });
    expect(meta.channels).toBe(1);
    // A PNG too, transparent or not.
    const png = await prepareProfilePhoto(await photo({ format: 'png' }), WHOLE);
    expect(await sharp(png.bytes).metadata()).toMatchObject({ width: 512, height: 512 });
  });

  it('drops every piece of metadata: EXIF, GPS, XMP and ICC', async () => {
    const original = await photo({ exif: true });
    const before = await sharp(original).metadata();
    // The synthetic photo really carries them, location included.
    expect(before.exif).toBeDefined();
    expect(before.xmp).toBeDefined();
    expect(text(original)).toContain('Synthetic Artist');
    // The GPS IFD pointer (tag 0x8825, little-endian) and the latitude's "S".
    expect(Buffer.from(before.exif ?? []).includes(Buffer.from([0x25, 0x88]))).toBe(true);

    const out = await prepareProfilePhoto(original, WHOLE);
    const after = await sharp(out.bytes).metadata();
    expect(after.exif).toBeUndefined();
    expect(after.xmp).toBeUndefined();
    expect(after.icc).toBeUndefined();
    expect(after.orientation).toBeUndefined();
    const kept = text(out.bytes);
    for (const trace of ['Exif', 'GPS', 'Synthetic', 'TestCam', 'xmpmeta', 'ICC_PROFILE']) {
      expect(kept, trace).not.toContain(trace);
    }
  });

  it('applies the learner’s crop: the left half kept is black, the right half white', async () => {
    const original = await photo(); // 800 × 600, black on the left
    // A 300 px square from the black half, then one from the white half.
    const black = await halves(
      (await prepareProfilePhoto(original, { x: 0, y: 0, size: 0.5 })).bytes,
    );
    expect(black.left).toBeLessThan(30);
    expect(black.right).toBeLessThan(30);
    const white = await halves(
      (await prepareProfilePhoto(original, { x: 0.6, y: 0.5, size: 0.5 })).bytes,
    );
    expect(white.left).toBeGreaterThan(225);
    // Centred on the edge between them: half and half.
    const edge = await halves(
      (await prepareProfilePhoto(original, { x: 0.125, y: 0, size: 1 })).bytes,
    );
    expect(edge.left).toBeLessThan(30);
    expect(edge.right).toBeGreaterThan(225);
  });

  it('turns the photo upright from its orientation tag before cropping', async () => {
    // Stored 800 × 600 with black on the left; tag 6 shows it turned a quarter clockwise, so the
    // upright photo is 600 × 800 with black on top.
    const original = await photo({ orientation: 6 });
    const top = await prepareProfilePhoto(original, { x: 0, y: 0, size: 0.5 });
    const { data } = await sharp(top.bytes).raw().toBuffer({ resolveWithObject: true });
    const mean = data.reduce((sum, v) => sum + v, 0) / data.length;
    expect(mean).toBeLessThan(30);
    const bottom = await prepareProfilePhoto(original, { x: 0, y: 0.6, size: 0.5 });
    const lower = await sharp(bottom.bytes).raw().toBuffer();
    expect(lower.reduce((sum, v) => sum + v, 0) / lower.length).toBeGreaterThan(225);
  });

  it('pulls a crop that rounds past the edge back inside the photo', () => {
    expect(cropPixels({ x: 0.999, y: 0.999, size: 1 }, 800, 600)).toEqual({
      left: 200,
      top: 0,
      width: 600,
      height: 600,
    });
  });
});

describe('what is never decoded (A5-13, audit A8-09)', () => {
  /** A flat image: a few KB on disk, however many pixels it has. */
  async function flat(width: number, height: number, sixteenBit = false) {
    const image = sharp({
      create: { width, height, channels: 3, background: { r: 90, g: 90, b: 90 } },
    });
    return new Uint8Array(
      await (sixteenBit ? image.toColourspace('rgb16') : image)
        .png({ compressionLevel: 9 })
        .toBuffer(),
    );
  }

  /** 49 megapixels, made once: encoding it is the slow part on a small CI runner, not the check. */
  let huge: Uint8Array;
  beforeAll(async () => {
    huge = await flat(7000, 7000);
  });

  it('refuses an image of more than about 16 megapixels, small as its file is', async () => {
    expect(huge.length).toBeLessThan(MAX_PHOTO_BYTES);
    await expect(prepareProfilePhoto(huge, WHOLE)).rejects.toMatchObject({ reason: 'too-large' });
  });

  it('still takes a 12-megapixel phone photo', async () => {
    const phone = await prepareProfilePhoto(await flat(4000, 3000), WHOLE);
    expect((await sharp(phone.bytes).metadata()).width).toBe(PHOTO_EDGE);
  });

  it('refuses more than 8 bits a channel (a 16-bit PNG decodes to twice the memory)', async () => {
    const deep = await flat(600, 400, true);
    expect((await sharp(deep).metadata()).depth).toBe('ushort');
    await expect(prepareProfilePhoto(deep, WHOLE)).rejects.toMatchObject({ reason: 'unreadable' });
  });

  it('decides from the metadata alone, before the image is decoded', async () => {
    const started = performance.now();
    await expect(prepareProfilePhoto(huge, WHOLE)).rejects.toThrow(InvalidPhotoError);
    // Decoding and resizing 49 megapixels takes far longer than reading a header.
    expect(performance.now() - started).toBeLessThan(500);
  });
});
