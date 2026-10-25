/**
 * Where the app finds the web app's API (CLAUDE.md: the app calls the web app's API routes; it
 * never holds keys or calls the AI directly).
 *
 * `EXPO_PUBLIC_UF_API_URL` is inlined into the bundle at build time, so it is public by design:
 * a base URL only, never a key. It must be read as `process.env.EXPO_PUBLIC_UF_API_URL`, written
 * out in full, or Expo's Babel preset won't inline it.
 *
 * - Development falls back to http://localhost:3000. That reaches the web app from the iOS
 *   simulator only: an Android emulator needs http://10.0.2.2:3000 and a phone on Expo Go needs
 *   this computer's LAN address (http://192.168.x.y:3000).
 * - A release build must set it, to an https:// URL.
 */

export const DEV_API_URL = 'http://localhost:3000';

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

/** Pure, for tests: the base URL from a raw value and whether this is a development build. */
export function resolveApiUrl(raw: string | undefined, dev: boolean): string {
  const value = raw?.trim();
  if (!value) {
    if (dev) return DEV_API_URL;
    throw new ConfigError('EXPO_PUBLIC_UF_API_URL is not set for this release build.');
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ConfigError('EXPO_PUBLIC_UF_API_URL is not a URL.');
  }
  if (url.protocol !== 'https:' && !(dev && url.protocol === 'http:')) {
    throw new ConfigError('EXPO_PUBLIC_UF_API_URL must use https:// outside development.');
  }
  return value.replace(/\/+$/, '');
}

/** The API base URL for this build. Read lazily, so a bad value fails a request, not launch. */
export function apiUrl(): string {
  return resolveApiUrl(process.env.EXPO_PUBLIC_UF_API_URL, __DEV__);
}
