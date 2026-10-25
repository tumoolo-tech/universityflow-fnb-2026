import * as SecureStore from 'expo-secure-store';
import { forgetCampus } from './campus-cache';

/**
 * The session token: the only secret the app holds (planning.md §16.1). It lives in the
 * platform's secure store (iOS Keychain, Android Keystore), never in AsyncStorage, never in a
 * log, never in an error message (hard rule 4). The server revokes it at sign-out.
 */

const KEY = 'uf.session';
/**
 * This phone's push token (lib/push.ts). It hangs off the session on the server, so it is
 * forgotten with the session: the next session registers it again (A7-02).
 */
export const PUSH_TOKEN_KEY = 'uf.push-token';

const OPTIONS: SecureStore.SecureStoreOptions = {
  // Readable once the phone has been unlocked after a restart; never copied to another device
  // through a backup.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

type Listener = (signedIn: boolean) => void;
const listeners = new Set<Listener>();

/** Tells the auth gate when the token appears or goes away (sign-in, sign-out, a 401). */
export function onSessionChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(signedIn: boolean) {
  for (const listener of listeners) listener(signedIn);
}

/**
 * Set when the learner has just deleted their account, so the sign-in screen the gate swaps to
 * can say so (A7-09). In memory only, read once, and nothing about the learner in it.
 */
let accountDeleted = false;

export function noteAccountDeleted(): void {
  accountDeleted = true;
}

/** True once after a deletion; false after that, and on any other sign-out. */
export function takeAccountDeleted(): boolean {
  const deleted = accountDeleted;
  accountDeleted = false;
  return deleted;
}

export async function readToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY, OPTIONS);
  } catch {
    // An unreadable keychain entry (e.g. after a restore to a new phone) means signed out.
    return null;
  }
}

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, token, OPTIONS);
  notify(true);
}

export async function clearToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY, OPTIONS);
  } finally {
    try {
      await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY, OPTIONS);
    } catch {
      // Nothing kept, nothing to forget.
    }
    // The saved copy of My campus goes with the session (A7-17).
    forgetCampus();
    notify(false);
  }
}
