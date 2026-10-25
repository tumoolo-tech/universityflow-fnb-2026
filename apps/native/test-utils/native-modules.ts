/**
 * In-memory stand-ins for the native modules Phase 4d uses: notifications, the camera and photo
 * picker, the document picker and the file system, and Read aloud's audio player (expo-audio,
 * 2026-10-22). None of them can run under Jest (they need a
 * phone), so every test programs these instead. Installed for every test by jest.setup.ts;
 * `resetNativeModules` puts them back to a phone that has granted nothing and picked nothing.
 */

import { utf8 } from './utf8';

// ── expo-notifications ──────────────────────────────────────────────────────────────────────

type Listener = (response: unknown) => void;

const DEFAULT_ACTION = 'expo.modules.notifications.actions.DEFAULT';
const listeners = new Set<Listener>();
type TokenListener = (token: { type: string; data: string }) => void;
const tokenListeners = new Set<TokenListener>();
const state: { lastResponse: unknown } = { lastResponse: null };

export const notifications = {
  DEFAULT_ACTION_IDENTIFIER: DEFAULT_ACTION,
  AndroidImportance: { DEFAULT: 3 },
  listeners,
  /** The notification whose tap started the app, if any. */
  set lastResponse(value: unknown) {
    state.lastResponse = value;
  },
  get lastResponse(): unknown {
    return state.lastResponse;
  },
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  setNotificationHandler: jest.fn(),
  getLastNotificationResponse: jest.fn((): unknown => state.lastResponse),
  clearLastNotificationResponse: jest.fn((): void => {
    state.lastResponse = null;
  }),
  addNotificationResponseReceivedListener: jest.fn((listener: Listener) => {
    listeners.add(listener);
    return { remove: () => listeners.delete(listener) };
  }),
  tokenListeners,
  addPushTokenListener: jest.fn((listener: TokenListener) => {
    tokenListeners.add(listener);
    return { remove: () => tokenListeners.delete(listener) };
  }),
  /** The phone's push service hands the app a new device token (the Expo token changes too). */
  rotate(data: string): void {
    for (const listener of tokenListeners) listener({ type: 'ios', data });
  },
  /** The learner taps a notification while the app runs. */
  tap(data: unknown, actionIdentifier: string = DEFAULT_ACTION): void {
    const response = { actionIdentifier, notification: { request: { content: { data } } } };
    for (const listener of listeners) listener(response);
  },
};

// ── expo-image-picker and expo-document-picker ──────────────────────────────────────────────

export const imagePicker = {
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
  // The profile photo's selfie camera (lib/photo.ts).
  CameraType: { front: 'front', back: 'back' },
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
};

export const documentPicker = {
  getDocumentAsync: jest.fn(),
};

// ── expo-file-system ────────────────────────────────────────────────────────────────────────

/** The phone's files, by URI. */
export const files = new Map<string, Uint8Array>();
export const CACHE = 'file:///data/app/cache/';
export const DOCUMENTS = 'file:///data/app/documents/';

/** Jest runs on Node, which has TextDecoder; the app's type library has no DOM. */
declare const TextDecoder: new () => { decode(bytes: Uint8Array): string };

export class File {
  readonly uri: string;
  /** `new File(uri)`, or `new File(Paths.document, 'name')` as the real module allows. */
  constructor(...parts: Array<string | { readonly uri: string }>) {
    this.uri = parts
      .map((p) => (typeof p === 'string' ? p : p.uri))
      .reduce((base, part) => `${base.replace(/\/+$/, '')}/${part.replace(/^\/+/, '')}`);
  }
  get exists(): boolean {
    return files.has(this.uri);
  }
  async bytes(): Promise<Uint8Array> {
    const bytes = files.get(this.uri);
    if (!bytes) throw new Error('No such file');
    return bytes;
  }
  async text(): Promise<string> {
    return new TextDecoder().decode(await this.bytes());
  }
  create(): void {
    if (files.has(this.uri)) throw new Error('File exists');
    files.set(this.uri, new Uint8Array());
  }
  write(content: string | Uint8Array): void {
    files.set(this.uri, typeof content === 'string' ? utf8(content) : content);
  }
  delete(): void {
    if (!files.delete(this.uri)) throw new Error('No such file');
  }
}

export const Paths = { cache: { uri: CACHE }, document: { uri: DOCUMENTS } };

// ── expo-audio ───────────────────────────────────────────────────────────────────────────────

type StatusListener = (status: { didJustFinish: boolean; playing: boolean }) => void;

/** One audio player the app made: what it plays, and whether it was played, paused, removed. */
export class FakePlayer {
  readonly play = jest.fn();
  readonly pause = jest.fn();
  readonly remove = jest.fn();
  readonly listeners = new Set<StatusListener>();
  constructor(readonly source: unknown) {}
  addListener(event: string, listener: StatusListener) {
    if (event === 'playbackStatusUpdate') this.listeners.add(listener);
    return { remove: () => this.listeners.delete(listener) };
  }
  /** The audio plays to its end, as the phone would report it. */
  finish(): void {
    for (const listener of [...this.listeners]) listener({ didJustFinish: true, playing: false });
  }
}

/** Read aloud's player (2026-10-22): silent, so a test reads what it was asked to play. */
export const audio = {
  players: [] as FakePlayer[],
  createAudioPlayer: jest.fn((source: unknown) => {
    const player = new FakePlayer(source);
    audio.players.push(player);
    return player;
  }),
  setAudioModeAsync: jest.fn(async () => undefined),
};

export function resetNativeModules(): void {
  files.clear();
  audio.players.length = 0;
  audio.createAudioPlayer.mockClear();
  audio.setAudioModeAsync.mockClear();
  notifications.listeners.clear();
  notifications.tokenListeners.clear();
  notifications.lastResponse = null;
  notifications.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
  notifications.requestPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });
  notifications.getExpoPushTokenAsync.mockRejectedValue(new Error('No token in tests'));
  imagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false });
  imagePicker.launchCameraAsync.mockResolvedValue({ canceled: true, assets: null });
  imagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });
  documentPicker.getDocumentAsync.mockResolvedValue({ canceled: true, assets: null });
}
