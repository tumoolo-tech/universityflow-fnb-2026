/**
 * An in-memory stand-in for expo-secure-store (the real one needs the iOS Keychain or the
 * Android Keystore). Installed for every test by jest.setup.ts.
 */
export const items = new Map<string, string>();

export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY';

export const getItemAsync = jest.fn(async (key: string) => items.get(key) ?? null);
export const setItemAsync = jest.fn(async (key: string, value: string) => {
  items.set(key, value);
});
export const deleteItemAsync = jest.fn(async (key: string) => {
  items.delete(key);
});
