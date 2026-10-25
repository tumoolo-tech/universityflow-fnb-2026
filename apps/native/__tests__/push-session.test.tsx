import { act, render, waitFor } from '@testing-library/react-native';
import { en } from '@universityflow/content/app';
import NotificationsScreen from '../app/notifications';
import { Gate } from '../components/gate';
import { ApiError, api } from '../lib/api';
import { AuthProvider } from '../lib/auth';
import { clearToken, saveToken } from '../lib/session';
import { type Call, serve } from '../test-utils/fake-api';
import { notifications } from '../test-utils/native-modules';
import { items } from '../test-utils/secure-store';

/**
 * A7-02: push must keep working across sessions. The server sends only to tokens hanging off a
 * live session, and a session lasts 30 days, so the app registers this phone's token again with
 * every new session (sign-in, each signed-in launch, a token the phone rotates), forgets the
 * token with the session, and says "On" only once this session's registration succeeded.
 */

// Synthetic tokens (hard rule 4).
const TOKEN = 'ExponentPushToken[testtoken0000000001]';
const ROTATED = 'ExponentPushToken[testtoken0000000002]';

const messaging = (optedIn: boolean) => ({
  json: {
    channels: [
      { channel: 'sms', optedIn: false },
      { channel: 'whatsapp', optedIn: false },
      { channel: 'push', optedIn },
    ],
    offeredChannels: ['sms', 'push'],
  },
});

const registrations = (calls: Call[]) => calls.filter((c) => c.key === 'POST /api/me/push-token');

function phoneAllows(token = TOKEN) {
  notifications.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
  notifications.getExpoPushTokenAsync.mockResolvedValue({ type: 'expo', data: token });
}

/** The 30-day session ends: the next request gets a 401. */
async function sessionEnds() {
  serve({ 'GET /api/me': { status: 401, json: { error: 'signed-out', detail: null } } });
  await act(async () => {
    await expect(api('/api/me')).rejects.toBeInstanceOf(ApiError);
  });
}

describe('the push token goes with the session', () => {
  it('a 401 forgets this phone’s push token along with the session', async () => {
    await saveToken('old');
    items.set('uf.push-token', TOKEN);
    await sessionEnds();
    expect(items.has('uf.session')).toBe(false);
    expect(items.has('uf.push-token')).toBe(false);
  });

  it('clearToken() forgets the push token too', async () => {
    await saveToken('old');
    items.set('uf.push-token', TOKEN);
    await clearToken();
    expect(items.has('uf.push-token')).toBe(false);
  });
});

describe('after signing in again', () => {
  it('Notifications registers this phone with the new session before it says "On"', async () => {
    await saveToken('old');
    items.set('uf.push-token', TOKEN);
    await sessionEnds();

    await saveToken('new');
    phoneAllows();
    let onShownBeforeRegistering: boolean | null = null;
    let screen: Awaited<ReturnType<typeof render>> | null = null;
    const calls = serve({
      'GET /api/me/messaging': messaging(true),
      'POST /api/me/push-token': () => {
        onShownBeforeRegistering = screen?.queryByText(en.notifications.on) != null;
        return { json: { ok: true } };
      },
    });
    screen = await render(<NotificationsScreen />);
    expect(await screen.findByText(en.notifications.on)).toBeTruthy();

    const [register] = registrations(calls);
    expect(register?.headers['authorization']).toBe('Bearer new');
    expect(register?.body).toEqual({ token: TOKEN, platform: 'ios' });
    expect(onShownBeforeRegistering).toBe(false);
    expect(items.get('uf.push-token')).toBe(TOKEN);
    // No prompt: the learner already said yes on this phone.
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('says "Off" when this session could not register (permission taken away in settings)', async () => {
    await saveToken('tok');
    items.set('uf.push-token', TOKEN);
    const calls = serve({
      'GET /api/me/messaging': messaging(true),
      'POST /api/me/push-token': { json: { ok: true } },
    });
    const screen = await render(<NotificationsScreen />);
    expect(await screen.findByText(en.notifications.off)).toBeTruthy();
    expect(screen.queryByText(en.notifications.on)).toBeNull();
    expect(screen.getByRole('button', { name: en.notifications.turnOn })).toBeTruthy();
    expect(registrations(calls)).toHaveLength(0);
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('registering again without opening Notifications', () => {
  async function renderGate() {
    return render(
      <AuthProvider>
        <Gate />
      </AuthProvider>,
    );
  }

  it('a signed-in launch registers this phone again when push is on and allowed', async () => {
    await saveToken('tok');
    phoneAllows();
    const calls = serve({
      'GET /api/me/messaging': messaging(true),
      'POST /api/me/push-token': { json: { ok: true } },
    });
    await renderGate();
    await waitFor(() => expect(registrations(calls)).toHaveLength(1));
    expect(registrations(calls)[0]?.headers['authorization']).toBe('Bearer tok');
    expect(registrations(calls)[0]?.body).toEqual({ token: TOKEN, platform: 'ios' });
    expect(items.get('uf.push-token')).toBe(TOKEN);
  });

  it('a launch never asks, and registers nothing, when push is off or not allowed', async () => {
    await saveToken('tok');
    const calls = serve({
      'GET /api/me/messaging': messaging(true),
      'POST /api/me/push-token': { json: { ok: true } },
    });
    await renderGate();
    await waitFor(() => expect(calls.some((c) => c.key === 'GET /api/me/messaging')).toBe(true));
    await act(async () => {});
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(registrations(calls)).toHaveLength(0);
  });

  it('signing in registers this phone with the new session', async () => {
    phoneAllows();
    const calls = serve({
      'GET /api/me/messaging': messaging(true),
      'POST /api/me/push-token': { json: { ok: true } },
    });
    await renderGate();
    expect(registrations(calls)).toHaveLength(0);
    await act(async () => {
      await saveToken('fresh');
    });
    await waitFor(() => expect(registrations(calls)).toHaveLength(1));
    expect(registrations(calls)[0]?.headers['authorization']).toBe('Bearer fresh');
  });

  it('a token the phone rotates is registered, and the old one removed', async () => {
    await saveToken('tok');
    phoneAllows();
    const calls = serve({
      'GET /api/me/messaging': messaging(true),
      'POST /api/me/push-token': { json: { ok: true } },
      'DELETE /api/me/push-token': { json: { removed: true } },
    });
    await renderGate();
    await waitFor(() => expect(registrations(calls)).toHaveLength(1));

    notifications.getExpoPushTokenAsync.mockResolvedValue({ type: 'expo', data: ROTATED });
    await act(async () => notifications.rotate('device-token'));
    await waitFor(() => expect(registrations(calls)).toHaveLength(2));
    expect(registrations(calls)[1]?.body).toEqual({ token: ROTATED, platform: 'ios' });
    await waitFor(() => expect(items.get('uf.push-token')).toBe(ROTATED));
    expect(calls.find((c) => c.key === 'DELETE /api/me/push-token')?.body).toEqual({
      token: TOKEN,
    });
  });
});
