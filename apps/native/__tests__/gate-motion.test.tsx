import { act, render, waitFor } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { AccessibilityInfo } from 'react-native';
import { Gate } from '../components/gate';
import { AuthProvider } from '../lib/auth';
import { saveToken } from '../lib/session';
import { serve } from '../test-utils/fake-api';

/**
 * Screen transitions move unless the phone asks for less motion (A7-12, hard rule 9): the
 * platform's default push, or an instant cut under Reduce Motion, following the setting live.
 */

type Listener = (enabled: boolean) => void;

const stackAnimation = () => {
  const calls = (Stack as unknown as jest.Mock).mock.calls;
  return (calls.at(-1)?.[0] as { screenOptions?: { animation?: string } } | undefined)
    ?.screenOptions?.animation;
};

let listener: Listener | undefined;

beforeEach(async () => {
  await saveToken('tok');
  serve({ 'GET /api/me': { json: { ready: true } } });
  listener = undefined;
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((
    event: string,
    handler: Listener,
  ) => {
    if (event === 'reduceMotionChanged') listener = handler;
    return { remove: jest.fn() };
  }) as never);
});

afterEach(() => jest.restoreAllMocks());

async function renderGate() {
  return render(
    <AuthProvider>
      <Gate />
    </AuthProvider>,
  );
}

describe('stack transitions and Reduce Motion (A7-12)', () => {
  it('animates screen changes when Reduce Motion is off', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    await renderGate();
    await waitFor(() => expect(stackAnimation()).toBe('default'));
  });

  it('cuts instantly when Reduce Motion is on', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await renderGate();
    await waitFor(() => expect(Stack).toHaveBeenCalled());
    expect(stackAnimation()).toBe('none');
  });

  it('follows the setting when it changes while the app is open', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    await renderGate();
    await waitFor(() => expect(stackAnimation()).toBe('default'));
    await act(async () => listener?.(true));
    expect(stackAnimation()).toBe('none');
    await act(async () => listener?.(false));
    expect(stackAnimation()).toBe('default');
  });
});
