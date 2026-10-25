import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { PHOTO_EDGE, prepareProfilePhoto } from './profile-photo';
import {
  isSamplePhotoId,
  prepareSamplePhoto,
  SAMPLE_MARK_BOX,
  SAMPLE_PHOTO_IDS,
  samplePhotoPng,
  samplePhotoSvg,
} from './sample-photos';

/**
 * The judge demo's SAMPLE photos (owner's decision, 2026-10-23): drawn by code, so no real
 * person is ever pictured, each with a visible "SAMPLE" mark that no crop can take off.
 */

/** Pixels in the mark's box of a picture: how many are near black and how many near white. */
async function markPixels(bytes: Uint8Array) {
  const { left, top, width, height } = SAMPLE_MARK_BOX;
  const { data, info } = await sharp(bytes)
    .extract({ left, top, width, height })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let dark = 0;
  let light = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const v = data[i] ?? 0;
    if (v < 40) dark++;
    if (v > 215) light++;
  }
  return { dark, light, all: data.length / info.channels };
}

describe('the sample photos', () => {
  it('are a handful, with ids that say so', () => {
    expect(SAMPLE_PHOTO_IDS.length).toBeGreaterThanOrEqual(4);
    expect(SAMPLE_PHOTO_IDS.length).toBeLessThanOrEqual(6);
    for (const id of SAMPLE_PHOTO_IDS) expect(id).toMatch(/^sample-\d$/);
    expect(isSamplePhotoId('sample-1')).toBe(true);
    for (const v of ['sample-9', 'photo-1', '', null, 1, '../sample-1']) {
      expect(isSamplePhotoId(v)).toBe(false);
    }
  });

  it('are shapes drawn here: no embedded picture, no link out, no text that needs a font', () => {
    const drawn = SAMPLE_PHOTO_IDS.map(samplePhotoSvg);
    for (const svg of drawn) {
      expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
      expect(svg).not.toMatch(/<image|<text|href|<script|url\(|data:/i);
    }
    expect(new Set(drawn).size).toBe(drawn.length);
  });

  it('each renders to a 512 × 512 picture with the SAMPLE mark in its corner', async () => {
    for (const id of SAMPLE_PHOTO_IDS) {
      const png = await samplePhotoPng(id);
      expect(await sharp(png).metadata(), id).toMatchObject({
        format: 'png',
        width: PHOTO_EDGE,
        height: PHOTO_EDGE,
      });
      const mark = await markPixels(png);
      // A dark plate with light letters on it: mostly plate, a good share of letter.
      expect(mark.dark / mark.all, id).toBeGreaterThan(0.4);
      expect(mark.light / mark.all, id).toBeGreaterThan(0.1);
    }
  });
});

describe('prepareSamplePhoto', () => {
  it('goes through the photo pipeline: 512 × 512, black and white, no metadata', async () => {
    const out = await prepareSamplePhoto('sample-1', { x: 0, y: 0, size: 1 });
    expect(out.mimeType).toBe('image/jpeg');
    const meta = await sharp(out.bytes).metadata();
    expect(meta).toMatchObject({ format: 'jpeg', width: 512, height: 512, channels: 1 });
    expect(meta.exif).toBeUndefined();
  });

  it('keeps the SAMPLE mark however tightly the judge crops', async () => {
    // The tightest crop, in the top-left corner: far from the mark in the original.
    const box = { x: 0, y: 0, size: 0.25 };
    const plain = await prepareProfilePhoto(await samplePhotoPng('sample-2'), box);
    const plainMark = await markPixels(plain.bytes);
    expect(plainMark.light / plainMark.all).toBeLessThan(0.05);

    const stamped = await prepareSamplePhoto('sample-2', box);
    const mark = await markPixels(stamped.bytes);
    expect(mark.dark / mark.all).toBeGreaterThan(0.4);
    expect(mark.light / mark.all).toBeGreaterThan(0.1);
  });

  it('refuses a crop off the picture, as for any photo', async () => {
    await expect(prepareSamplePhoto('sample-1', { x: 2, y: 0, size: 1 })).rejects.toThrow(
      'bad-crop',
    );
  });
});
