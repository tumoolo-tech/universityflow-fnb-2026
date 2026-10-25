import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { en } from '@universityflow/content/app';
import { useRouter } from 'expo-router';
import { AccessibilityInfo, Text } from 'react-native';
import RootLayout from '../app/_layout';
import HomeScreen from '../app/index';
import NotificationsScreen from '../app/notifications';
import { Gate } from '../components/gate';
import { AuthProvider } from '../lib/auth';
import { routeForNotification, useNotificationRouting } from '../lib/push';
import { saveToken } from '../lib/session';
import { type Call, serve } from '../test-utils/fake-api';
import { home } from '../test-utils/fixtures';
import { notifications } from '../test-utils/native-modules';
import { items } from '../test-utils/secure-store';

// A synthetic token (hard rule 4).
const TOKEN = 'ExponentPushToken[testtoken0000000001]';

const messaging = (optedIn: boolean, offered = true) => ({
  json: {
    channels: [
      { channel: 'sms', optedIn: false },
      { channel: 'whatsapp', optedIn: false },
      { channel: 'push', optedIn },
    ],
    offeredChannels: offered ? ['sms', 'push'] : ['sms'],
  },
});

const keys = (calls: Call[]) => calls.map((c) => c.key);

beforeEach(async () => {
  await saveToken('tok');
});

describe('turning notifications on', () => {
  it('never asks for permission at launch or on opening the screen', async () => {
    serve({ 'GET /api/me': { json: { ready: true } }, 'GET /api/me/messaging': messaging(false) });
    await render(<RootLayout />);
    await render(
      <AuthProvider>
        <Gate />
      </AuthProvider>,
    );
    await waitFor(() => expect(notifications.listeners.size).toBeGreaterThan(0));
    const screen = await render(<NotificationsScreen />);
    expect(await screen.findByText(en.notifications.off)).toBeTruthy();
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(notifications.getPermissionsAsync).not.toHaveBeenCalled();
    expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    // The foreground handler is set, without asking anything.
    expect(notifications.setNotificationHandler).toHaveBeenCalled();
  });

  it('offers "Try again" when the screen can’t load, and recovers (A7-10)', async () => {
    serve({ 'GET /api/me/messaging': { status: 500, json: { error: 'server', detail: null } } });
    const screen = await render(<NotificationsScreen />);
    expect(await screen.findByText(en.errors.generic)).toBeTruthy();
    serve({ 'GET /api/me/messaging': messaging(false) });
    await fireEvent.press(screen.getByRole('button', { name: en.common.tryAgain }));
    expect(await screen.findByText(en.notifications.off)).toBeTruthy();
    expect(screen.queryByText(en.errors.generic)).toBeNull();
    expect(screen.queryByRole('button', { name: en.common.tryAgain })).toBeNull();
  });

  it('asks only on "Turn on", then registers the token and turns the channel on', async () => {
    notifications.requestPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    notifications.getExpoPushTokenAsync.mockResolvedValue({ type: 'expo', data: TOKEN });
    const calls = serve({
      'GET /api/me/messaging': messaging(false),
      'POST /api/me/push-token': { json: { ok: true } },
      'PUT /api/me/messaging': messaging(true),
    });
    const screen = await render(<NotificationsScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: en.notifications.turnOn }));
    expect(await screen.findByText(en.notifications.on)).toBeTruthy();

    expect(notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: 'test-project-id',
    });
    const register = calls.find((c) => c.key === 'POST /api/me/push-token');
    expect(register?.body).toEqual({ token: TOKEN, platform: 'ios' });
    expect(register?.headers['authorization']).toBe('Bearer tok');
    // Registered first, then opted in: the server refuses push without a phone.
    expect(keys(calls).indexOf('POST /api/me/push-token')).toBeLessThan(
      keys(calls).indexOf('PUT /api/me/messaging'),
    );
    expect(calls.find((c) => c.key === 'PUT /api/me/messaging')?.body).toEqual({
      channel: 'push',
      optedIn: true,
    });
    expect(items.get('uf.push-token')).toBe(TOKEN);
  });

  it('respects a refusal: says how to change it, and registers nothing', async () => {
    const calls = serve({ 'GET /api/me/messaging': messaging(false) });
    const screen = await render(<NotificationsScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: en.notifications.turnOn }));
    expect(await screen.findByText(en.notifications.denied)).toBeTruthy();
    expect(keys(calls)).toEqual(['GET /api/me/messaging']);
    // A phone that said no for good is not asked again.
    notifications.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });
    notifications.requestPermissionsAsync.mockClear();
    await fireEvent.press(screen.getByRole('button', { name: en.notifications.turnOn }));
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('says a refusal out loud, as a warning, on both platforms (A3-02)', async () => {
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
    try {
      serve({ 'GET /api/me/messaging': messaging(false) });
      const screen = await render(<NotificationsScreen />);
      await fireEvent.press(await screen.findByRole('button', { name: en.notifications.turnOn }));
      await screen.findByText(en.notifications.denied);
      expect(announce).toHaveBeenCalledWith(en.notifications.denied);
      expect(screen.getByTestId('notice-warning')).toHaveTextContent(en.notifications.denied);
    } finally {
      announce.mockRestore();
    }
  });

  it('says when this phone has no token (a simulator) or push is not offered', async () => {
    notifications.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    serve({ 'GET /api/me/messaging': messaging(false) });
    const screen = await render(<NotificationsScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: en.notifications.turnOn }));
    expect(await screen.findByText(en.notifications.noDevice)).toBeTruthy();

    notifications.getExpoPushTokenAsync.mockResolvedValue({ type: 'expo', data: TOKEN });
    serve({
      'GET /api/me/messaging': messaging(false),
      'POST /api/me/push-token': { status: 409, json: { error: 'state', detail: null } },
    });
    await fireEvent.press(screen.getByRole('button', { name: en.notifications.turnOn }));
    expect(await screen.findByText(en.notifications.unavailable)).toBeTruthy();
    expect(items.has('uf.push-token')).toBe(false);

    serve({ 'GET /api/me/messaging': messaging(false, false) });
    const off = await render(<NotificationsScreen />);
    expect(await off.findByText(en.notifications.unavailable)).toBeTruthy();
    expect(off.queryByRole('button', { name: en.notifications.turnOn })).toBeNull();
  });
});

describe('turning notifications off and signing out', () => {
  it('turns the channel off and removes this phone’s token', async () => {
    items.set('uf.push-token', TOKEN);
    // "On" means registered with this session (A7-02): the phone allows it, so the screen does.
    notifications.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    notifications.getExpoPushTokenAsync.mockResolvedValue({ type: 'expo', data: TOKEN });
    const calls = serve({
      'GET /api/me/messaging': messaging(true),
      'POST /api/me/push-token': { json: { ok: true } },
      'PUT /api/me/messaging': messaging(false),
      'DELETE /api/me/push-token': { json: { removed: false } },
    });
    const screen = await render(<NotificationsScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: en.notifications.turnOff }));
    expect(await screen.findByText(en.notifications.off)).toBeTruthy();
    expect(calls.find((c) => c.key === 'PUT /api/me/messaging')?.body).toEqual({
      channel: 'push',
      optedIn: false,
    });
    expect(calls.find((c) => c.key === 'DELETE /api/me/push-token')?.body).toEqual({
      token: TOKEN,
    });
    expect(items.has('uf.push-token')).toBe(false);
  });

  it('removes the token at sign-out, before the session is revoked', async () => {
    items.set('uf.push-token', TOKEN);
    const calls = serve({
      'GET /api/me': {
        json: {
          ready: true,
          account: { consentStatus: 'not-required' },
          profile: null,
        },
      },
      'GET /api/home': { json: home() },
      'DELETE /api/me/push-token': { json: { removed: true } },
      'POST /api/auth/sign-out': { json: { ok: true } },
    });
    const screen = await render(
      <AuthProvider>
        <HomeScreen />
      </AuthProvider>,
    );
    await fireEvent.press(await screen.findByRole('button', { name: en.nav.signOut }));
    const order = keys(calls);
    expect(order.indexOf('DELETE /api/me/push-token')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('DELETE /api/me/push-token')).toBeLessThan(
      order.indexOf('POST /api/auth/sign-out'),
    );
    expect(items.has('uf.push-token')).toBe(false);
    expect(items.has('uf.session')).toBe(false);
  });

  it('signs out even when removing the token fails (the server drops it with the session)', async () => {
    items.set('uf.push-token', TOKEN);
    serve({
      'GET /api/me': { json: { ready: true, account: { consentStatus: 'not-required' } } },
      'GET /api/home': { json: home() },
      'DELETE /api/me/push-token': { status: 500, json: { error: 'server', detail: null } },
      'POST /api/auth/sign-out': { json: { ok: true } },
    });
    const screen = await render(
      <AuthProvider>
        <HomeScreen />
      </AuthProvider>,
    );
    await fireEvent.press(await screen.findByRole('button', { name: en.nav.signOut }));
    expect(items.has('uf.session')).toBe(false);
    expect(items.has('uf.push-token')).toBe(false);
  });
});

describe('a tapped notification', () => {
  function Probe({ signedIn, open }: { signedIn: boolean; open: (route: string) => void }) {
    useNotificationRouting(signedIn, open);
    return <Text>probe</Text>;
  }

  it('opens the screen it names, from the fixed list only', async () => {
    const open = jest.fn();
    await render(<Probe signedIn open={open} />);
    await act(async () => {
      notifications.tap({ screen: 'results' });
      notifications.tap({ screen: 'goals' });
      notifications.tap({ screen: 'home' });
      // Anything else is ignored: a link, an unknown screen, no data, another action.
      notifications.tap({ screen: 'https://example.com' });
      notifications.tap({ screen: '/sign-in' });
      notifications.tap({ url: '/results' });
      notifications.tap(null);
      notifications.tap({ screen: 'results' }, 'dismiss');
    });
    expect(open.mock.calls).toEqual([['/results'], ['/goals'], ['/']]);
  });

  it('opens the screen of the notification that started the app, once', async () => {
    notifications.lastResponse = {
      actionIdentifier: notifications.DEFAULT_ACTION_IDENTIFIER,
      notification: { request: { content: { data: { screen: 'results' } } } },
    };
    const open = jest.fn();
    await render(<Probe signedIn open={open} />);
    expect(open).toHaveBeenCalledWith('/results');
    expect(notifications.clearLastNotificationResponse).toHaveBeenCalled();
  });

  it('does nothing while signed out', async () => {
    notifications.lastResponse = {
      actionIdentifier: notifications.DEFAULT_ACTION_IDENTIFIER,
      notification: { request: { content: { data: { screen: 'results' } } } },
    };
    const open = jest.fn();
    await render(<Probe signedIn={false} open={open} />);
    await act(async () => notifications.tap({ screen: 'goals' }));
    expect(open).not.toHaveBeenCalled();
  });

  it('routes through expo-router from the auth gate', async () => {
    serve({ 'GET /api/me': { json: { ready: true } } });
    await render(
      <AuthProvider>
        <Gate />
      </AuthProvider>,
    );
    // Once the session is read and the gate is signed in, the listener is there.
    await waitFor(() => expect(notifications.listeners.size).toBe(1));
    await act(async () => notifications.tap({ screen: 'goals' }));
    expect(useRouter().push).toHaveBeenCalledWith('/goals');
  });

  it('maps screens to routes, and nothing else', () => {
    expect(routeForNotification({ screen: 'home' })).toBe('/');
    expect(routeForNotification({ screen: 'offers' })).toBe('/offers');
    expect(routeForNotification({ screen: 'modules' })).toBe('/modules');
    expect(routeForNotification({ screen: 'toString' })).toBeNull();
    expect(routeForNotification(undefined)).toBeNull();
  });
});
