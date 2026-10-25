import sharp from 'sharp';

/**
 * A learner's profile photo (docs/design/profile-look-proposal.md §5.3), made safe to keep.
 * Server-only: `sharp` is native.
 *
 * - **At most 2 MB in**, and only a JPEG, a PNG or a HEIC, decided from the file's own first
 *   bytes, never from its name or the browser's claim.
 * - **The learner's crop applied here**, from a box in fractions of the photo (`packages/ui`
 *   photo-crop.ts), after turning the photo upright from the camera's orientation tag. The web
 *   and the app send the photo as chosen, so neither needs an image-editing module.
 * - **512 × 512 out, black and white** (the poster's figure is black and white, and nothing more
 *   than is shown is kept), as a JPEG.
 * - **Every piece of metadata dropped**: EXIF, GPS, XMP, ICC. A phone photo's location is
 *   personal information (hard rule 4, POPIA data minimisation). `sharp` writes none unless asked
 *   (`withMetadata`), and this never asks.
 *
 * HEIC: this build of `sharp` (prebuilt libvips with libheif) decodes AVIF but not HEIC, whose
 * HEVC decoder is patent-encumbered and left out (`heicDecodes()`). A HEIC is therefore refused
 * with its own reason, so the web can say "save it as a JPEG" and the app sends a JPEG (its photo
 * picker converts). A build that can decode HEIC accepts it with no other change.
 */

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
/** The stored photo's side, in pixels. */
export const PHOTO_EDGE = 512;
export const PHOTO_QUALITY = 85;
/**
 * Refuse to decode anything larger (A5-13, audit A8-09): a flat PNG of 50 MP fits in a few KB
 * and decodes to hundreds of MB. 16 MP is more than a 2 MB JPEG from a phone ever holds (about
 * 12 MP), and is decided from the header before anything is decoded.
 */
export const MAX_INPUT_PIXELS = 16_000_000;

export type PhotoType = 'image/jpeg' | 'image/png' | 'image/heic';

export type PhotoRefusal =
  | 'empty'
  | 'too-large'
  | 'unsupported-type'
  | 'heic-unsupported'
  | 'unreadable'
  | 'bad-crop';

export class InvalidPhotoError extends Error {
  override readonly name = 'InvalidPhotoError';
  constructor(readonly reason: PhotoRefusal) {
    super(reason);
  }
}

/** The square to keep: its top-left corner in fractions of width and height, its side in fractions of the shorter edge. */
export interface PhotoCropBox {
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((b, i) => bytes[offset + i] === b);

const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

/** HEIF brands that hold HEVC (HEIC) images; `mif1`/`msf1` are the generic ones iPhones also write. */
const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'];

/** The real type of a photo, from its magic bytes. */
export function sniffPhotoType(bytes: Uint8Array): PhotoType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  // ISO base media: a box size, then `ftyp`, then the major brand.
  if (startsWith(bytes, ascii('ftyp'), 4)) {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (HEIC_BRANDS.includes(brand)) return 'image/heic';
  }
  return null;
}

/** Whether this build of `sharp` can decode a HEIC (see the module's comment). */
export function heicDecodes(): boolean {
  const suffixes: ReadonlyArray<string> = sharp.format.heif?.input?.fileSuffix ?? [];
  return suffixes.includes('.heic');
}

/** The type, or the reason the photo is refused, before anything is decoded. */
export function checkPhoto(
  bytes: Uint8Array,
  options: { readonly heic?: boolean } = {},
): PhotoType {
  if (bytes.length === 0) throw new InvalidPhotoError('empty');
  if (bytes.length > MAX_PHOTO_BYTES) throw new InvalidPhotoError('too-large');
  const type = sniffPhotoType(bytes);
  if (!type) throw new InvalidPhotoError('unsupported-type');
  if (type === 'image/heic' && !(options.heic ?? heicDecodes())) {
    throw new InvalidPhotoError('heic-unsupported');
  }
  return type;
}

/** The smallest square kept, as a fraction of the shorter edge (the crop's most zoom is 4). */
const MIN_CROP = 0.25 - 1e-6;

function checkBox(box: PhotoCropBox): void {
  const ok = [box.x, box.y, box.size].every(Number.isFinite) && box.x >= 0 && box.y >= 0;
  if (!ok || box.x > 1 || box.y > 1 || box.size < MIN_CROP || box.size > 1) {
    throw new InvalidPhotoError('bad-crop');
  }
}

/** The crop in pixels of the upright photo, pulled inside it (fractions round both ways). */
export function cropPixels(
  box: PhotoCropBox,
  width: number,
  height: number,
): { left: number; top: number; width: number; height: number } {
  checkBox(box);
  const side = Math.max(1, Math.min(Math.round(box.size * Math.min(width, height)), width, height));
  const left = Math.min(Math.max(0, Math.round(box.x * width)), width - side);
  const top = Math.min(Math.max(0, Math.round(box.y * height)), height - side);
  return { left, top, width: side, height: side };
}

export interface PreparedPhoto {
  readonly bytes: Uint8Array;
  readonly mimeType: 'image/jpeg';
}

/**
 * Checks, crops and re-encodes a profile photo. Throws `InvalidPhotoError` for anything it
 * refuses, and never returns any of the original's metadata.
 */
export async function prepareProfilePhoto(
  bytes: Uint8Array,
  box: PhotoCropBox,
  options: { readonly heic?: boolean } = {},
): Promise<PreparedPhoto> {
  checkPhoto(bytes, options);
  checkBox(box);
  let out: Buffer;
  try {
    // The header only (nothing decoded), so the size can be refused with its own reason below.
    const { width, height, orientation, depth } = await sharp(bytes, {
      limitInputPixels: false,
    }).metadata();
    if (!width || !height) throw new InvalidPhotoError('unreadable');
    // From the header alone, before the pipeline below decodes the whole image (A5-13).
    if (width * height > MAX_INPUT_PIXELS) throw new InvalidPhotoError('too-large');
    // More than 8 bits a channel (a 16-bit PNG) decodes to twice the memory, for nothing shown.
    if (depth !== 'uchar') throw new InvalidPhotoError('unreadable');
    // Orientations 5 to 8 turn the photo a quarter: its upright width is its stored height.
    const quarter = (orientation ?? 1) >= 5;
    const crop = cropPixels(box, quarter ? height : width, quarter ? width : height);
    out = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS })
      .autoOrient()
      .extract(crop)
      .resize(PHOTO_EDGE, PHOTO_EDGE, { fit: 'fill' })
      // A transparent PNG on the card's dark ground, never a black-on-transparent surprise.
      .flatten({ background: { r: 0, g: 0, b: 0 } })
      .greyscale()
      .toColourspace('b-w')
      .jpeg({ quality: PHOTO_QUALITY })
      .toBuffer();
  } catch (error) {
    if (error instanceof InvalidPhotoError) throw error;
    throw new InvalidPhotoError('unreadable');
  }
  return { bytes: new Uint8Array(out), mimeType: 'image/jpeg' };
}
