import { APP_SCREENS, type AppScreen, en } from '@universityflow/content/app';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { ApiError, api } from './api';
import { onSessionChange, PUSH_TOKEN_KEY } from './session';
import type { MessagingResponse } from './types';

/**
 * App notifications (Phase 4d). The rules:
 *
 * - The phone's permission is asked **only when the learner turns notifications on**, never at
 *   launch. A refusal is respected: the app says how to change it in settings and asks no more.
 * - The Expo push token is registered with our server (POST /api/me/push-token) and removed when
 *   the learner turns notifications off or signs out (DELETE). The server also drops it with the
 *   session, so a sign-out the app couldn't report still takes the phone off.
 * - A notification carries a template's text with nothing personal in it and the name of a
 *   screen; tapping it opens that screen, from a fixed list. Anything else is ignored.
 *
 * - The server sends only to tokens on a **live session**, and a session ends (sign-out, a 401,
 *   30 days). So every new session registers this phone again: on sign-in and each signed-in
 *   launch (if the account has push on and the phone already allows it: no prompt), and whenever
 *   the phone rotates its token. The screen says "on" only once this session's registration
 *   succeeded (A7-02).
 *
 * The token is kept in the secure store only so the app can remove it later; it is never logged.
 * It is forgotten with the session (lib/session.ts).
 */

const TOKEN_KEY = PUSH_TOKEN_KEY;
const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};
/** Android needs a channel before it will ask for permission (Android 13+) or show anything. */
export const ANDROID_CHANNEL = 'default';

export type TurnOnResult = 'on' | 'denied' | 'unavailable' | 'no-device';

/** How notifications show while the app is open: as a banner, quietly. Called once at start. */
export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined;
  const id = extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  return typeof id === 'string' && id !== '' ? id : undefined;
}

async function savedToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY, STORE_OPTIONS);
  } catch {
    return null;
  }
}

async function forgetSavedToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY, STORE_OPTIONS);
  } catch {
    // Nothing kept, nothing to forget.
  }
}

/**
 * The learner tapped "Turn on notifications". Asks the phone (only now), gets this phone's token,
 * registers it, then turns the channel on.
 */
export async function turnOnPush(): Promise<TurnOnResult> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
      name: en.notifications.androidChannel,
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (!permission.granted) return 'denied';

  const token = await expoToken();
  // A simulator, or a build without an EAS project: no token can be had.
  if (!token) return 'no-device';
  try {
    await register(token);
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) return 'unavailable';
    throw error;
  }
  await api('/api/me/messaging', { method: 'PUT', json: { channel: 'push', optedIn: true } });
  return 'on';
}

async function expoToken(): Promise<string | null> {
  try {
    const id = projectId();
    return (await Notifications.getExpoPushTokenAsync(id ? { projectId: id } : {})).data;
  } catch {
    return null;
  }
}

// ── This session's registration (A7-02) ─────────────────────────────────────────────────────

/** Whether this phone's token was registered with the current session. */
let registered = false;
/** Bumped on every sign-in, sign-out and 401, so a registration that outlives its session is dropped. */
let generation = 0;
let pending: Promise<boolean> | null = null;
onSessionChange(() => {
  generation += 1;
  registered = false;
  pending = null;
});

/**
 * Registers `token` with the current session (the server moves an existing token to it), keeps
 * it, and removes the one it replaces. Throws what the server answered.
 */
async function register(token: string): Promise<void> {
  const started = generation;
  await api('/api/me/push-token', {
    method: 'POST',
    json: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
  });
  if (started !== generation) return;
  const previous = await savedToken();
  await SecureStore.setItemAsync(TOKEN_KEY, token, STORE_OPTIONS);
  registered = true;
  if (previous && previous !== token) {
    try {
      await api('/api/me/push-token', { method: 'DELETE', json: { token: previous } });
    } catch {
      // Expo reports the old token as gone soon enough; the server forgets it then.
    }
  }
}

/** Registers this phone again without asking: only if the phone already allows notifications. */
async function registerQuietly(): Promise<boolean> {
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return false;
    const token = await expoToken();
    if (!token) return false;
    await register(token);
    return registered;
  } catch {
    // Offline, not offered, or no consent: "off" until a registration works.
    return false;
  }
}

/**
 * True once this phone's token is registered with the current session, registering it now if
 * it isn't (never asking for permission). Call only for an account with push on.
 */
export function ensureThisPhone(): Promise<boolean> {
  if (registered) return Promise.resolve(true);
  if (!pending) {
    const mine = registerQuietly().finally(() => {
      if (pending === mine) pending = null;
    });
    pending = mine;
  }
  return pending;
}

/** Whether the account has app notifications turned on. */
export function pushOptedIn(view: MessagingResponse): boolean {
  return view.channels.some((c) => c.channel === 'push' && c.optedIn);
}

/** Registers this phone with the session, if the account has push on. Best effort. */
async function syncThisPhone(): Promise<void> {
  try {
    if (pushOptedIn(await api<MessagingResponse>('/api/me/messaging'))) await ensureThisPhone();
  } catch {
    // Offline or not set up yet: the Notifications screen tries again.
  }
}

/**
 * While signed in (each launch with a session, and each sign-in): registers this phone with the
 * session if push is on, and registers again whenever the phone rotates its token.
 */
export function usePushRegistration(signedIn: boolean): void {
  useEffect(() => {
    if (!signedIn) return;
    void syncThisPhone();
    const subscription = Notifications.addPushTokenListener(() => {
      void (async () => {
        // Only a phone that is registered (its token kept for this session) follows a rotation.
        if (!registered && (await savedToken()) === null) return;
        await registerQuietly();
      })();
    });
    return () => subscription.remove();
  }, [signedIn]);
}

/** The learner turned notifications off: off on the server (every phone), and this token gone. */
export async function turnOffPush(): Promise<void> {
  await api('/api/me/messaging', { method: 'PUT', json: { channel: 'push', optedIn: false } });
  await removeThisPhone();
}

/**
 * Takes this phone's token off the account, if it has one. Best effort: at sign-out the server
 * drops it with the session anyway.
 */
export async function removeThisPhone(): Promise<void> {
  registered = false;
  const token = await savedToken();
  if (!token) return;
  try {
    await api('/api/me/push-token', { method: 'DELETE', json: { token } });
  } catch {
    // Offline or already signed out: the server removes it with the session.
  } finally {
    await forgetSavedToken();
  }
}

/** The routes a tapped notification may open. */
export type AppRoute =
  | '/'
  | '/results'
  | '/goals'
  | '/offers'
  | '/campus'
  | '/first-week'
  | '/modules';

const ROUTES: Readonly<Record<AppScreen, AppRoute>> = {
  home: '/',
  results: '/results',
  goals: '/goals',
  offers: '/offers',
  campus: '/campus',
  'first-week': '/first-week',
  // The change-deadline reminder (Phase 5c) opens My modules.
  modules: '/modules',
};

/**
 * The route a tapped notification opens: only a screen from the fixed list, so a notification can
 * never send the app anywhere else. Null for anything unexpected.
 */
export function routeForNotification(data: unknown): AppRoute | null {
  const screen = (data as { screen?: unknown } | null | undefined)?.screen;
  return typeof screen === 'string' && (APP_SCREENS as ReadonlyArray<string>).includes(screen)
    ? ROUTES[screen as AppScreen]
    : null;
}

/**
 * Opens the screen a tapped notification names: one tapped while the app was closed (it started
 * the app), and any tapped while it runs. Only while signed in: signed out, the gate shows
 * sign-in and the tap is dropped.
 */
export function useNotificationRouting(signedIn: boolean, open: (route: string) => void): void {
  useEffect(() => {
    if (!signedIn) return;
    const go = (response: Notifications.NotificationResponse | null) => {
      const route = routeForResponse(response);
      if (route) open(route);
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      go(last);
      Notifications.clearLastNotificationResponse();
    }
    const subscription = Notifications.addNotificationResponseReceivedListener(go);
    return () => subscription.remove();
  }, [signedIn, open]);
}

/** The route for a tap (the default action) on a notification, or null. */
export function routeForResponse(
  response: Notifications.NotificationResponse | null | undefined,
): AppRoute | null {
  if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
    return null;
  }
  return routeForNotification(response.notification.request.content.data);
}
