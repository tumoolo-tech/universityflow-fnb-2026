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

  it('says nothing about a demo on an ordinary server', async () => {
    serve({ 'POST /api/auth/request-pin': { json: { ok: true, phoneMasked: '082 *** 0001' } } });
    const screen = await renderSignIn();
    expect(screen.queryByText(en.demoPhoneSignup.noticeTitle)).toBeNull();
    await fireEvent.changeText(screen.getByLabelText(en.auth.phoneLabel), phone);
    await fireEvent.press(screen.getByRole('button', { name: en.auth.sendPin }));
    expect(await screen.findByRole('header', { name: en.auth.pinTitle })).toBeTruthy();
    expect(screen.queryByText(en.demoPhoneSignup.pinOnScreenTitle)).toBeNull();
  });
});

/**
 * The judges' demo (docs/deploy/demo.md §4b, `UF_DEMO_PHONE_SIGNUP=onscreen`): the server takes
 * made-up 080 numbers only, sends nothing and returns the PIN for the screen (`demoPin`). The
 * server decides; the app shows what it is given.
 */
describe('sign-in on the judges’ demo', () => {
  const d = en.demoPhoneSignup;
  /** A made-up toll-free number, built at runtime (hard rule 4). */
  const tollFree = ['080', '0', '000', '001'].join('');

  afterEach(() => {
    delete process.env['EXPO_PUBLIC_UF_DEMO'];
  });

  it('shows the PIN the demo returns, where it is typed, and signs in with it', async () => {
    const calls = serve({
      'POST /api/auth/request-pin': {
        json: { ok: true, phoneMasked: '080 *** 0001', demoPin: '246810' },
      },
      'POST /api/auth/verify-pin': { json: { ok: true, isNewStudent: true, token: 'tok-demo' } },
    });
    const screen = await renderSignIn();
    await fireEvent.changeText(screen.getByLabelText(en.auth.phoneLabel), tollFree);
    await fireEvent.press(screen.getByRole('button', { name: en.auth.sendPin }));

    expect(await screen.findByText(d.pinOnScreenTitle)).toBeTruthy();
    expect(screen.getByText(d.pinOnScreen('246810'))).toBeTruthy();
    // Not "we sent it by SMS": nothing was sent.
    expect(screen.queryByText(en.auth.pinLead('080 *** 0001'))).toBeNull();
    await fireEvent.changeText(screen.getByLabelText(en.auth.pinLabel), '246810');
    await fireEvent.press(screen.getByRole('button', { name: en.auth.verify }));
    await waitFor(async () => expect(await readToken()).toBe('tok-demo'));
    expect(calls[1]?.body).toEqual({ phone: tollFree, pin: '246810' });
  });

  it('ignores a demoPin that isn’t six digits', async () => {
    serve({
      'POST /api/auth/request-pin': {
        json: { ok: true, phoneMasked: '080 *** 0001', demoPin: '<b>1</b>' },
      },
    });
    const screen = await renderSignIn();
    await fireEvent.changeText(screen.getByLabelText(en.auth.phoneLabel), tollFree);
    await fireEvent.press(screen.getByRole('button', { name: en.auth.sendPin }));
    expect(await screen.findByRole('header', { name: en.auth.pinTitle })).toBeTruthy();
    expect(screen.queryByText(d.pinOnScreenTitle)).toBeNull();
  });

  it.each([
    ['demo-080-only', 400, d.only080],
    ['demo-080-taken', 409, d.numberTaken],
  ])('a number the demo refuses (%s) says why', async (detail, status, sentence) => {
    serve({ 'POST /api/auth/request-pin': { status, json: { error: 'phone', detail } } });
    const screen = await renderSignIn();
    await fireEvent.changeText(screen.getByLabelText(en.auth.phoneLabel), tollFree);
    await fireEvent.press(screen.getByRole('button', { name: en.auth.sendPin }));
    expect(await screen.findByText(sentence)).toBeTruthy();
  });

  it('a judges’ build says first that it is the demo: made-up details, an 080 number', async () => {
    process.env['EXPO_PUBLIC_UF_DEMO'] = '1';
    serve({});
    const screen = await renderSignIn();
    // Not "we'll send you a PIN by SMS": the demo sends nothing.
    expect(screen.getByRole('header', { name: d.pageTitle })).toBeTruthy();
    expect(screen.queryByText(en.auth.lead)).toBeNull();
    expect(screen.getByRole('header', { name: d.noticeTitle })).toBeTruthy();
    for (const point of d.noticePoints) expect(screen.getByText(point)).toBeTruthy();
    const field = screen.getByLabelText(d.phoneLabel);
    // A made-up number: the phone's own is never offered to fill in.
    expect(field.props.autoComplete).toBe('off');
    expect(field.props.textContentType).toBe('none');
    expect(screen.getByText(d.phoneHint)).toBeTruthy();
  });
});

describe('sign-in, the button', () => {
  const phone = syntheticPhone(1);

  it('keeps Send disabled until the number is long enough', async () => {
    serve({});
    const screen = await renderSignIn();
    const button = screen.getByRole('button', { name: en.auth.sendPin });
    expect(button).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText(en.auth.phoneLabel), phone);
    expect(screen.getByRole('button', { name: en.auth.sendPin })).toBeEnabled();
  });
});
