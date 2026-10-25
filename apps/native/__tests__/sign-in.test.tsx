import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { en } from '@universityflow/content/app';
import SignInScreen from '../app/sign-in';
import { AuthProvider } from '../lib/auth';
import { onSessionChange, readToken } from '../lib/session';
import { serve } from '../test-utils/fake-api';
import { syntheticPhone } from '../test-utils/fixtures';

/** RNTL v14: `render` and `fireEvent` are async; always await both. */
async function renderSignIn() {
  return render(
    <AuthProvider>
      <SignInScreen />
    </AuthProvider>,
  );
}

describe('sign-in', () => {
  const phone = syntheticPhone(1);

  it('phone, then PIN: stores the token and signs the app in', async () => {
    const calls = serve({
      'POST /api/auth/request-pin': { json: { ok: true, phoneMasked: '082 *** 0001' } },
      'POST /api/auth/verify-pin': { json: { ok: true, isNewStudent: true, token: 'tok-new' } },
    });
    const signedIn: boolean[] = [];
    const off = onSessionChange((s) => signedIn.push(s));
    const screen = await renderSignIn();

    expect(screen.getByRole('header', { name: en.auth.title })).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText(en.auth.phoneLabel), phone);
    await fireEvent.press(screen.getByRole('button', { name: en.auth.sendPin }));

    expect(await screen.findByRole('header', { name: en.auth.pinTitle })).toBeTruthy();
    expect(screen.getByText(en.auth.pinLead('082 *** 0001'))).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText(en.auth.pinLabel), '12a3456');
    await fireEvent.press(screen.getByRole('button', { name: en.auth.verify }));

    await waitFor(() => expect(signedIn).toEqual([true]));
    off();
    expect(await readToken()).toBe('tok-new');
    expect(calls.map((c) => c.key)).toEqual([
      'POST /api/auth/request-pin',
      'POST /api/auth/verify-pin',
    ]);
    // Non-digits are dropped as the learner types.
    expect(calls[1]?.body).toEqual({ phone, pin: '123456' });
    expect(calls.every((c) => c.headers['x-uf-client'] === 'native')).toBe(true);
  });

  it('a wrong PIN shows the content string and keeps the app signed out', async () => {
    serve({
      'POST /api/auth/request-pin': { json: { ok: true, phoneMasked: '082 *** 0001' } },
      'POST /api/auth/verify-pin': { status: 400, json: { error: 'pin', detail: null } },
    });
    const screen = await renderSignIn();
    await fireEvent.changeText(screen.getByLabelText(en.auth.phoneLabel), phone);
    await fireEvent.press(screen.getByRole('button', { name: en.auth.sendPin }));
    await fireEvent.changeText(await screen.findByLabelText(en.auth.pinLabel), '000000');
    await fireEvent.press(screen.getByRole('button', { name: en.auth.verify }));

    expect(await screen.findByText(en.auth.errors.pin)).toBeTruthy();
    expect(await readToken()).toBeNull();
    // Still on the PIN step, able to try again.
    expect(screen.getByRole('button', { name: en.auth.verify })).toBeTruthy();
  });

  it('a refused number stays on the phone step with the reason', async () => {
    serve({
      'POST /api/auth/request-pin': { status: 400, json: { error: 'phone', detail: null } },
    });
    const screen = await renderSignIn();
    await fireEvent.changeText(screen.getByLabelText(en.auth.phoneLabel), '011 555 0000');
    await fireEvent.press(screen.getByRole('button', { name: en.auth.sendPin }));
    expect(await screen.findByText(en.auth.errors.phone)).toBeTruthy();
    expect(screen.getByRole('header', { name: en.auth.title })).toBeTruthy();
  });

  it('keeps Send disabled until the number is long enough', async () => {
    serve({});
    const screen = await renderSignIn();
    const button = screen.getByRole('button', { name: en.auth.sendPin });
    expect(button).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText(en.auth.phoneLabel), phone);
    expect(screen.getByRole('button', { name: en.auth.sendPin })).toBeEnabled();
  });
});
