/**
 * Every link that opens the app (`universityflow://…`, a notification, the OS) passes through
 * here before expo-router parses it (A8-02).
 *
 * expo-router parses each incoming path with query-string@7, which decodes with
 * decode-uri-component@0.2.2 (GHSA-vcc3-ghjq-m6fr): a link it can't decode takes exponential
 * time, so one crafted link, sent by WhatsApp or SMS, freezes the app. The patched
 * decode-uri-component is ESM-only and breaks query-string@7, so it can't be overridden.
 * Instead, a link that is too long or that can't be decoded goes to Home before the router sees
 * it. `decodeURIComponent` is linear, and it fails on exactly the input that sends the old
 * decoder into its slow path (a stray `%`, or bytes that are not UTF-8).
 *
 * Remove this file when expo-router depends on query-string 9 or later (decode-uri-component
 * 0.4.1+), and re-run audit A8.
 */

/** Longer than any route the app has, by far. */
export const MAX_LINK_LENGTH = 2048;

const HOME = '/';

function decodable(path: string): boolean {
  try {
    decodeURIComponent(path);
    return true;
  } catch {
    return false;
  }
}

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  // Never throws: an error here can crash the app (expo-router's NativeIntent docs).
  if (typeof path !== 'string' || path.length > MAX_LINK_LENGTH || !decodable(path)) return HOME;
  return path;
}
