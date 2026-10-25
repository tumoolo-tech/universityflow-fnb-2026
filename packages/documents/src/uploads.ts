/**
 * What a learner may upload: a photo or a PDF of a document, up to 10 MB. The type is decided
 * from the file's own first bytes, never from the name or the browser's claim.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export type UploadType = (typeof UPLOAD_TYPES)[number];

export class InvalidUploadError extends Error {
  override readonly name = 'InvalidUploadError';
  constructor(readonly reason: 'empty' | 'too-large' | 'unsupported-type') {
    super(reason);
  }
}

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((b, i) => bytes[offset + i] === b);

/** The real type of an uploaded file, from its magic bytes. */
export function sniffType(bytes: Uint8Array): UploadType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'image/webp';
  }
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
  return null;
}

export function checkUpload(bytes: Uint8Array): UploadType {
  if (bytes.length === 0) throw new InvalidUploadError('empty');
  if (bytes.length > MAX_UPLOAD_BYTES) throw new InvalidUploadError('too-large');
  const type = sniffType(bytes);
  if (!type) throw new InvalidUploadError('unsupported-type');
  return type;
}
