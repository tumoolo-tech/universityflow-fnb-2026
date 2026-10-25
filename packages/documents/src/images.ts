import sharp from 'sharp';
import type { UploadType } from './uploads';

/**
 * Prepares an uploaded report for the AI reader (A1-09). Server-only: `sharp` is native.
 *
 * Photos are re-encoded before they leave our servers:
 * - turned upright from the camera's orientation tag, then **every piece of metadata dropped**
 *   (EXIF, GPS, XMP, ICC). A phone photo's location is personal information (hard rule 4,
 *   POPIA data minimisation) and the reader has no use for it;
 * - scaled down, never up, to fit the model's vision limit: at most 2576 px on the long edge and
 *   3.75 megapixels, the most Claude Opus 5 looks at (anything larger is downscaled by the API
 *   anyway, after we have paid to upload it). Aspect ratio is kept;
 * - written as a JPEG at quality 85: small text on a report stays legible.
 *
 * PDFs pass through unchanged.
 */

/** The longest edge, in pixels, the model reads at full resolution. */
export const MAX_IMAGE_EDGE = 2576;
/** The most pixels the model reads at full resolution. */
export const MAX_IMAGE_PIXELS = 3_750_000;
/** JPEG quality for the re-encoded photo. */
export const JPEG_QUALITY = 85;
/**
 * Refuse to decode anything larger (a decompression bomb hidden in a 10 MB file). 100 MP covers
 * every phone camera that matters here.
 */
const MAX_INPUT_PIXELS = 100_000_000;

export interface PreparedDocument {
  readonly bytes: Uint8Array;
  readonly mimeType: UploadType;
}

/** The long-edge target that satisfies both limits for an image of this size. */
export function targetLongEdge(width: number, height: number): number {
  const long = Math.max(width, height);
  const scale = Math.min(1, MAX_IMAGE_EDGE / long, Math.sqrt(MAX_IMAGE_PIXELS / (width * height)));
  return Math.floor(long * scale);
}

export async function prepareForReading(file: PreparedDocument): Promise<PreparedDocument> {
  if (file.mimeType === 'application/pdf') return file;

  const image = sharp(file.bytes, { limitInputPixels: MAX_INPUT_PIXELS });
  const { width, height } = await image.metadata();
  if (!width || !height) throw new Error('Image has no dimensions');
  const edge = targetLongEdge(width, height);

  const bytes = await image
    .autoOrient()
    // A square box of the long-edge target scales whichever side is longer, after rotation.
    .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
    // Transparent PNGs would turn black in a JPEG; a report is printed on white paper.
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
  return { bytes: new Uint8Array(bytes), mimeType: 'image/jpeg' };
}
