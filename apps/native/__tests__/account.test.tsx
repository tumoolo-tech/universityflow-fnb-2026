import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { en } from '@universityflow/content/app';
import { TEXT_PAIRS } from '@universityflow/tokens';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import AccountScreen from '../app/account';
import SignInScreen from '../app/sign-in';
import { AuthProvider } from '../lib/auth';
import { saveToken } from '../lib/session';
import { theme } from '../lib/theme';
import { serve } from '../test-utils/fake-api';
import { items } from '../test-utils/secure-store';

beforeEach(async () => {
  await saveToken('tok');
});

describe('deleting the account from the app', () => {
  it('needs DELETE typed, then deletes through the API and signs out', async () => {
    items.set('uf.push-token', 'ExponentPushToken[testtoken0000000009]');
    const calls = serve({
      'DELETE /api/me': { json: { ok: true } },
      'DELETE /api/me/push-token': { status: 401, json: { error: 'signed-out', detail: null } },
    });
    const screen = await render(<AccountScreen />);
    const button = screen.getByRole('button', { name: en.me.deleteButton });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(button);
    // The screen reads the profile for its card (GET); the disabled button deletes nothing.
    const deletes = () => calls.filter((c) => c.key === 'DELETE /api/me');
    expect(deletes()).toHaveLength(0);

    await fireEvent.changeText(screen.getByTestId('delete-confirm'), 'DELETE');
    await fireEvent.press(screen.getByRole('button', { name: en.me.deleteButton }));
    await waitFor(() => expect(items.has('uf.session')).toBe(false));
    expect(deletes()).toHaveLength(1);
    expect(deletes()[0]?.headers['authorization']).toBe('Bearer tok');
    expect(items.has('uf.push-token')).toBe(false);
  });

  it('says the account is gone, aloud and on the sign-in screen, once (A3-09, A7-09)', async () => {
    serve({ 'DELETE /api/me': { json: { ok: true } } });
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
    const screen = await render(<AccountScreen />);
    await fireEvent.changeText(screen.getByTestId('delete-confirm'), 'DELETE');
    await fireEvent.press(screen.getByRole('button', { name: en.me.deleteButton }));
    await waitFor(() => expect(items.has('uf.session')).toBe(false));
    expect(announce).toHaveBeenCalledWith(en.me.deleted);
    announce.mockRestore();
    await screen.unmount();

    // The gate swaps to sign-in, which confirms it in words.
    const signIn = await render(<SignInScreen />, { wrapper: AuthProvider });
    expect(signIn.getByText(en.me.deleted)).toBeTruthy();
    await signIn.unmount();
    // Only once: the next time the app opens on sign-in, nothing is said about a deletion.
    const later = await render(<SignInScreen />, { wrapper: AuthProvider });
    expect(later.queryByText(en.me.deleted)).toBeNull();
  });

  it('promises only what the app does: deletion here, the rest on the web (A7-09)', async () => {
    serve({});
    const screen = await render(<AccountScreen />);
    expect(screen.getByText(en.me.appLead)).toBeTruthy();
    expect(screen.queryByText(en.me.lead)).toBeNull();
  });

  it('looks like what it is: an irreversible action, in danger red as on the web (A2-03)', async () => {
    serve({});
    const screen = await render(<AccountScreen />);
    await fireEvent.changeText(screen.getByTestId('delete-confirm'), 'DELETE');
    const button = screen.getByRole('button', { name: en.me.deleteButton });
    const style = StyleSheet.flatten(button.props.style) as { backgroundColor?: string };
    expect(style.backgroundColor).toBe(theme.color.danger);
    expect(screen.getByText(en.me.deleteButton).props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: theme.color.onBrand })]),
    );
    // The pair is one the token tests hold to AA.
    expect(TEXT_PAIRS).toContainEqual(['onBrand', 'danger']);
  });

  it('keeps the learner signed in and says so when the deletion fails', async () => {
    serve({ 'DELETE /api/me': { status: 500, json: { error: 'server', detail: null } } });
    const screen = await render(<AccountScreen />);
    await fireEvent.changeText(screen.getByTestId('delete-confirm'), 'DELETE');
    await fireEvent.press(screen.getByRole('button', { name: en.me.deleteButton }));
    expect(await screen.findByText(en.errors.generic)).toBeTruthy();
    expect(items.get('uf.session')).toBe('tok');
  });
});
