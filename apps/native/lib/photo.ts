import { type CropBox, MAX_PHOTO_BYTES, PHOTO_PICK_TYPES } from '@universityflow/ui';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { ApiError, api, apiBytes } from './api';
import { deleteIfOurs, multipart } from './upload';

/**
 * The profile photo from the phone (docs/design/profile-look-proposal.md §5.3), through the same
 * API as the web (/api/me/photo): only when the server's switch is on. The picker the app already
 * has for reports (expo-image-picker, SDK 57) takes or chooses the photo; no new native module.
 * The app crops nothing itself: it sends the photo as picked with the square the learner chose
 * (`packages/ui` photo-crop.ts), and the server crops it, makes it black and white and drops its
 * metadata. The app's own copy is deleted after.
 */

export interface PickedPhoto {
  readonly uri: string;
  readonly mimeType: string;
  /** The size the picker reports, upright: the crop is worked out on it. */
  readonly width: number;
  readonly height: number;
}

/**
 * Small enough to stay under 2 MB from a 12-megapixel camera, and still far more than the 512 px
 * the server keeps. An iPhone's HEIC arrives as JPEG (`Compatible`), which the server can read.
 */
const PHOTO_QUALITY = 0.3;

function asPicked(result: ImagePicker.ImagePickerResult): PickedPhoto | null {
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  return {
    uri: asset.uri,
    mimeType: asset.mimeType ?? 'image/jpeg',
    width: asset.width,
    height: asset.height,
  };
}

/** The camera; its permission is asked only now. 'denied' when the phone refused. */
export async function takeProfilePhoto(): Promise<PickedPhoto | 'denied' | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return 'denied';
  return asPicked(
    await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: PHOTO_QUALITY,
      exif: false,
      cameraType: ImagePicker.CameraType.front,
    }),
  );
}

/** The system photo picker, which needs no access to the whole gallery. */
export async function chooseProfilePhoto(): Promise<PickedPhoto | null> {
  return asPicked(
    await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: PHOTO_QUALITY,
      exif: false,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    }),
  );
}

/** Sends the photo and its crop; returns the new version. The app's copy is deleted either way. */
export async function uploadProfilePhoto(picked: PickedPhoto, crop: CropBox): Promise<string> {
  try {
    if (/^image\/hei[cf]/.test(picked.mimeType)) {
      throw new ApiError(400, 'upload', 'heic-unsupported');
    }
    if (!(PHOTO_PICK_TYPES as ReadonlyArray<string>).includes(picked.mimeType)) {
      throw new ApiError(400, 'upload', 'unsupported-type');
    }
    const bytes = await new File(picked.uri).bytes();
    if (bytes.length === 0) throw new ApiError(400, 'upload', 'empty');
    if (bytes.length > MAX_PHOTO_BYTES) throw new ApiError(400, 'upload', 'too-large');
    const { photo } = await api<{ photo: { version: string } }>('/api/me/photo', {
      method: 'POST',
      // A fixed name: the learner's own file name can say who they are (hard rule 4).
      raw: multipart(
        { crop: JSON.stringify(crop) },
        {
          bytes,
          mimeType: picked.mimeType,
          name: picked.mimeType === 'image/png' ? 'photo.png' : 'photo.jpg',
        },
      ),
    });
    return photo.version;
  } finally {
    deleteIfOurs(picked.uri);
  }
}

/** "Remove photo". */
export async function removeProfilePhoto(): Promise<void> {
  await api('/api/me/photo', { method: 'DELETE' });
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64, without relying on the platform's `btoa` (pure, so it is tested on its own). */
export function base64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const n = (a << 16) | (b << 8) | c;
    out += ALPHABET[(n >> 18) & 63];
    out += ALPHABET[(n >> 12) & 63];
    out += i + 1 < bytes.length ? ALPHABET[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? ALPHABET[n & 63] : '=';
  }
  return out;
}

/**
 * The photo as an image the app can draw: fetched with the session like every request (never a
 * URL the image loader would fetch without it), kept in memory only, never on the phone's disk.
 */
export async function profilePhotoUri(version: string): Promise<string> {
  const bytes = await apiBytes(`/api/me/photo?v=${encodeURIComponent(version)}`);
  return `data:image/jpeg;base64,${base64(bytes)}`;
}
