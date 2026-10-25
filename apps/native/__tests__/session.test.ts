import * as SecureStore from 'expo-secure-store';
import { rememberCampus, savedCampus } from '../lib/campus-cache';
import { clearToken, onSessionChange, readToken, saveToken } from '../lib/session';
import { items } from '../test-utils/secure-store';

describe('the session token', () => {
  it('lives in the secure store, this device only', async () => {
    await saveToken('token-abc');
    expect(items.get('uf.session')).toBe('token-abc');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('uf.session', 'token-abc', {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
    expect(await readToken()).toBe('token-abc');
  });

  it('is gone after clearToken', async () => {
    await saveToken('token-abc');
    await clearToken();
    expect(await readToken()).toBeNull();
    expect(items.size).toBe(0);
  });

  it('takes the saved copy of My campus with it: sign-out, deletion and a 401 all end here (A7-17)', async () => {
    await saveToken('token-abc');
    await rememberCampus({
      tour: {
        kind: 'campus-tour',
        universityId: 'wits',
        universityName: 'Wits',
        basis: 'chosen',
        campuses: [],
        beforeYouArrive: false,
        includesDrafts: false,
      },
      accepted: null,
      options: [{ id: 'wits', name: 'Wits' }],
    });
    expect(await savedCampus()).not.toBeNull();
    await clearToken();
    expect(await savedCampus()).toBeNull();
  });

  it('reads as signed out when the keychain entry is unreadable', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('keychain'));
    expect(await readToken()).toBeNull();
  });

  it('tells listeners about sign-in and sign-out', async () => {
    const seen: boolean[] = [];
    const off = onSessionChange((signedIn) => seen.push(signedIn));
    await saveToken('t');
    await clearToken();
    off();
    await saveToken('t');
    expect(seen).toEqual([true, false]);
  });

  it('is never written to the console', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    );
    await saveToken('token-secret-value');
    await readToken();
    await clearToken();
    for (const spy of spies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain('token-secret-value');
      spy.mockRestore();
    }
  });
});
