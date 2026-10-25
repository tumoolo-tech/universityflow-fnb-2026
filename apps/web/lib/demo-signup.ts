/**
 * The judge demo's real sign-up switch (a HACKATHON EXCEPTION the owner approved on 2026-10-23:
 * "build the Firebase real sign-up for the judge demo, 18+ only, accounts deleted after 30 days";
 * docs/deploy/demo.md "Hackathon exceptions"). Off unless `UF_DEMO_SIGNUP` is set, on a demo
 * deployment only (`readConfig` refuses it anywhere else).
 *
 * - `UF_DEMO_SIGNUP=firebase` with `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
 *   and `NEXT_PUBLIC_FIREBASE_PROJECT_ID`: Firebase Authentication, email link and Google.
 * - `UF_DEMO_SIGNUP=fake`: a stand-in with no Firebase at all, for local runs and the demo E2E;
 *   refused on a host.
 *
 * No `server-only` and Web APIs only: the proxy (the CSP), the server and the sign-up page's
 * client code all read this file. The `NEXT_PUBLIC_*` values are read on the server and handed to
 * the one page that needs them, so no other page's bundle carries them.
 */

export interface FirebaseWebConfig {
  readonly apiKey: string;
  readonly authDomain: string;
  readonly projectId: string;
}

export type DemoSignupSetting =
  | { readonly mode: 'firebase'; readonly firebase: FirebaseWebConfig }
  | { readonly mode: 'fake' };

export class DemoSignupConfigError extends Error {
  override readonly name = 'DemoSignupConfigError';
}

/** Every variable the sign-up reads: demo only (`DEMO_ONLY` in config.ts). */
export const DEMO_SIGNUP_VARIABLES = [
  'UF_DEMO_SIGNUP',
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
] as const;

const API_KEY = /^[A-Za-z0-9_-]{20,100}$/;
const PROJECT_ID = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const HOSTNAME =
  /^(?=.{4,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

/**
 * The sign-up's setting, or null when it is off. Throws `DemoSignupConfigError` for a setting that
 * is half there or malformed: never a sign-up that half works. Says nothing about where it may run
 * (demo only, no fake on a host): `readConfig` decides that.
 */
export function readDemoSignup(env: Record<string, string | undefined>): DemoSignupSetting | null {
  const mode = env['UF_DEMO_SIGNUP']?.trim() ?? '';
  const apiKey = env['NEXT_PUBLIC_FIREBASE_API_KEY']?.trim() ?? '';
  const authDomain = env['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN']?.trim().toLowerCase() ?? '';
  const projectId = env['NEXT_PUBLIC_FIREBASE_PROJECT_ID']?.trim() ?? '';
  const firebaseSet = Boolean(apiKey || authDomain || projectId);
  if (mode === '') {
    if (firebaseSet) {
      throw new DemoSignupConfigError(
        'NEXT_PUBLIC_FIREBASE_* are set without UF_DEMO_SIGNUP=firebase: set the switch, or unset them',
      );
    }
    return null;
  }
  if (mode === 'fake') {
    if (firebaseSet) {
      throw new DemoSignupConfigError('UF_DEMO_SIGNUP=fake takes no NEXT_PUBLIC_FIREBASE_* values');
    }
    return { mode: 'fake' };
  }
  if (mode !== 'firebase') {
    throw new DemoSignupConfigError('UF_DEMO_SIGNUP must be firebase (or fake, locally), or unset');
  }
  if (!apiKey || !authDomain || !projectId) {
    throw new DemoSignupConfigError(
      'UF_DEMO_SIGNUP=firebase needs NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN and NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    );
  }
  if (!API_KEY.test(apiKey)) {
    throw new DemoSignupConfigError('NEXT_PUBLIC_FIREBASE_API_KEY must be a Firebase web API key');
  }
  if (!HOSTNAME.test(authDomain)) {
    throw new DemoSignupConfigError(
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN must be a host name, such as <project>.firebaseapp.com',
    );
  }
  if (!PROJECT_ID.test(projectId)) {
    throw new DemoSignupConfigError(
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID must be a Firebase project id',
    );
  }
  return { mode: 'firebase', firebase: { apiKey, authDomain, projectId } };
}

/** The setting, or null when it is off or malformed (the proxy: never widen on a bad setting). */
export function demoSignupOrNull(
  env: Record<string, string | undefined>,
): DemoSignupSetting | null {
  try {
    return readDemoSignup(env);
  } catch {
    return null;
  }
}

/** The page that signs up, the only one whose CSP is widened, and only for Firebase. */
export const DEMO_SIGNUP_PATH = '/demo/sign-up';

/**
 * What the Firebase JS SDK needs beyond our own origin, on the sign-up page only: its two APIs
 * (sign-in, token refresh), the auth domain's hidden iframe and Google's script loader that the
 * Google pop-up uses. Nothing else is ever added.
 */
export function firebaseCspSources(authDomain: string): {
  readonly connect: ReadonlyArray<string>;
  readonly frame: ReadonlyArray<string>;
  readonly script: ReadonlyArray<string>;
} {
  return {
    connect: ['https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com'],
    frame: [`https://${authDomain}`],
    script: ['https://apis.google.com'],
  };
}

/** The fake's tokens: plainly not a JWT, so the Firebase verifier refuses them. */
export const FAKE_ID_TOKEN_PREFIX = 'uf-fake-id-token.';

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): string {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

/** A fake ID token for `identity` (the fake sign-up form and tests). */
export function mintFakeIdToken(identity: { uid: string; email: string }): string {
  return `${FAKE_ID_TOKEN_PREFIX}${toBase64Url(JSON.stringify({ uid: identity.uid, email: identity.email }))}`;
}

/** The identity in a fake token, or null. */
export function readFakeIdToken(token: string): { uid: string; email: string } | null {
  if (!token.startsWith(FAKE_ID_TOKEN_PREFIX) || token.length > 2000) return null;
  try {
    const value = JSON.parse(fromBase64Url(token.slice(FAKE_ID_TOKEN_PREFIX.length))) as unknown;
    if (typeof value !== 'object' || value === null) return null;
    const { uid, email } = value as Record<string, unknown>;
    if (typeof uid !== 'string' || typeof email !== 'string' || !uid || !email) return null;
    return { uid, email };
  } catch {
    return null;
  }
}

/**
 * An absolute https URL (the main site's and the demo's addresses for the switch between them),
 * without a trailing slash, or null when unset. Throws for anything else, so a typo never sends
 * people somewhere unexpected.
 */
export function readHttpsUrl(
  env: Record<string, string | undefined>,
  name: 'NEXT_PUBLIC_UF_DEMO_URL' | 'NEXT_PUBLIC_UF_MAIN_URL',
): string | null {
  const value = env[name]?.trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new DemoSignupConfigError(`${name} must be an https URL`);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new DemoSignupConfigError(`${name} must be a plain https URL (no login, query or #)`);
  }
  return url.toString().replace(/\/$/, '');
}

/** The same, or null when unset or malformed (pages: never a broken link). */
export function httpsUrlOrNull(
  env: Record<string, string | undefined>,
  name: 'NEXT_PUBLIC_UF_DEMO_URL' | 'NEXT_PUBLIC_UF_MAIN_URL',
): string | null {
  try {
    return readHttpsUrl(env, name);
  } catch {
    return null;
  }
}
