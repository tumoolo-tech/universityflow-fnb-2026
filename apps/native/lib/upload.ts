import { fetch } from 'expo/fetch';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { ApiError, api } from './api';
import type { LetterUploadResult, ProofUploadResult, UploadResult, UploadTicket } from './types';

/**
 * Uploading a photo or PDF of a school report from the phone (Phase 4d), of an offer letter
 * (`kind=acceptance-letter`), or of a proof of registration (Phase 5c,
 * `kind=proof-of-registration`), through the same API the web app uses:
 *
 * 1. Straight to storage when the server offers it (S3, live): ask for a ticket
 *    (POST /api/documents/uploads), post the file to storage with it, then ask the server to
 *    check what arrived and read it (POST /api/documents/uploads/:id).
 * 2. Otherwise through our own server (local development): a multipart POST to /api/documents,
 *    which needs a Content-Length, so the body is built here as bytes.
 *
 * Either way the server reads the report into a **draft**: nothing is used until the learner
 * confirms every row (hard rule 6, /api/reports). And either way the photo is deleted from the
 * phone afterwards, if it was the app's own copy: a report page never stays on the device.
 */

/** packages/documents' limits, mirrored (the server checks again, by the file's own bytes). */
export const UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export interface PickedFile {
  readonly uri: string;
  readonly mimeType: string | null | undefined;
  readonly name?: string | null;
}

function ascii(text: string): Uint8Array {
  // Header lines and S3's form fields are ASCII: base64 policies, key names, dates.
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    out[i] = code < 128 ? code : 63; // '?'
  }
  return out;
}

function concat(parts: ReadonlyArray<Uint8Array>): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/**
 * A multipart/form-data body: the fields in order, then the file last (S3 ignores anything after
 * the file). Pure, so it is tested on its own.
 */
export function multipart(
  fields: Readonly<Record<string, string>>,
  file: { readonly bytes: Uint8Array; readonly mimeType: string; readonly name: string },
  boundary = `----universityflow${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
): { body: Uint8Array; contentType: string } {
  const parts: Uint8Array[] = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      ascii(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`),
    );
  }
  parts.push(
    ascii(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\n` +
        `Content-Type: ${file.mimeType}\r\n\r\n`,
    ),
    file.bytes,
    ascii(`\r\n--${boundary}--\r\n`),
  );
  return { body: concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

/**
 * The documents the server reads besides a report (the report is its default): an offer letter
 * for My offers, and a proof of registration for My modules (Phase 5c). The server picks its
 * reader by this.
 */
export type DocumentKind = 'acceptance-letter' | 'proof-of-registration';

/** Reads the file, uploads it, returns the draft. The app's copy of the file is deleted after. */
export function uploadReport(picked: PickedFile): Promise<UploadResult> {
  return uploadDocument<UploadResult>(picked, null);
}

/** A proof of registration, read into a registration draft (My modules, Phase 5c). */
export function uploadProofOfRegistration(picked: PickedFile): Promise<ProofUploadResult> {
  return uploadDocument<ProofUploadResult>(picked, 'proof-of-registration');
}

/** An offer letter, read into a draft the learner checks field by field (My offers, A1-33). */
export function uploadAcceptanceLetter(picked: PickedFile): Promise<LetterUploadResult> {
  return uploadDocument<LetterUploadResult>(picked, 'acceptance-letter');
}

/** A fixed name per kind: the learner's own file name can say who they are (hard rule 4). */
const FILE_NAMES: Readonly<Record<DocumentKind | 'report', string>> = {
  report: 'report',
  'acceptance-letter': 'letter',
  'proof-of-registration': 'registration',
};

async function uploadDocument<T>(picked: PickedFile, kind: DocumentKind | null): Promise<T> {
  try {
    const mimeType = picked.mimeType ?? '';
    if (!(UPLOAD_TYPES as ReadonlyArray<string>).includes(mimeType)) {
      throw new ApiError(400, 'upload', 'unsupported-type');
    }
    const bytes = await new File(picked.uri).bytes();
    if (bytes.length === 0) throw new ApiError(400, 'upload', 'empty');
    if (bytes.length > MAX_UPLOAD_BYTES) throw new ApiError(400, 'upload', 'too-large');
    const file = {
      bytes,
      mimeType,
      name: `${FILE_NAMES[kind ?? 'report']}.${EXTENSIONS[mimeType]}`,
    };

    let ticket: UploadTicket | null = null;
    try {
      ticket = await api<UploadTicket>('/api/documents/uploads', {
        method: 'POST',
        json: { contentType: mimeType, size: bytes.length },
      });
    } catch (error) {
      // Not found: this server takes uploads itself (local development).
      if (!(error instanceof ApiError && error.status === 404)) throw error;
    }

    if (ticket) {
      const { body, contentType } = multipart(ticket.fields, file);
      let sent: { ok: boolean; status: number } | null = null;
      try {
        sent = await fetch(ticket.url, {
          method: 'POST',
          headers: { 'content-type': contentType },
          body,
          credentials: 'omit',
        });
      } catch {
        sent = null;
      }
      if (!sent?.ok) throw new ApiError(sent?.status ?? 0, 'upload', 'not-received');
      const query = kind ? `?kind=${kind}` : '';
      return await api<T>(`/api/documents/uploads/${ticket.uploadId}${query}`, {
        method: 'POST',
      });
    }
    return await api<T>('/api/documents', {
      method: 'POST',
      // The kind before the file, as the web's form sends it.
      raw: multipart(kind ? { kind } : {}, file),
    });
  } finally {
    deleteIfOurs(picked.uri);
  }
}

// ── Picking the file (Phase 4d's flow: Upload my report, My offers and My modules) ───────────

/** JPEG re-encoding at this quality keeps a page legible and well under 10 MB. */
const PHOTO_QUALITY = 0.8;

/**
 * Takes a photo with the camera. The permission is asked only now, when the learner tapped
 * "Take a photo". 'denied' when the phone refused; null when they cancelled.
 */
export async function takePhoto(): Promise<PickedFile | 'denied' | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return 'denied';
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: PHOTO_QUALITY,
    exif: false,
  });
  const asset = result.canceled ? null : result.assets[0];
  return asset ? { uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' } : null;
}

/** Chooses a photo with the system picker, which needs no access to the whole gallery. */
export async function choosePhoto(): Promise<PickedFile | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: PHOTO_QUALITY,
    exif: false,
    // A HEIC photo from an iPhone's gallery arrives as JPEG.
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  const asset = result.canceled ? null : result.assets[0];
  return asset ? { uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' } : null;
}

/** Chooses a PDF (or a photo file), copied into the app's cache so it can be deleted after. */
export async function choosePdf(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [...UPLOAD_TYPES],
    copyToCacheDirectory: true,
    multiple: false,
  });
  const asset = result.canceled ? null : result.assets[0];
  return asset ? { uri: asset.uri, mimeType: asset.mimeType ?? null } : null;
}

/**
 * Deletes the picked file when it is the app's own copy, in its cache: the camera's photo, or the
 * copy a picker made. Never anything outside the app's cache (a photo in the learner's gallery
 * stays theirs).
 */
export function deleteIfOurs(uri: string): boolean {
  try {
    const cache = Paths.cache.uri.replace(/\/+$/, '');
    if (!uri.startsWith(`${cache}/`)) return false;
    const file = new File(uri);
    if (!file.exists) return false;
    file.delete();
    return true;
  } catch {
    // Already gone, or the platform refused: nothing more the app can do.
    return false;
  }
}
