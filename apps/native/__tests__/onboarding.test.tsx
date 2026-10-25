import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { en } from '@universityflow/content/app';
import { useRouter } from 'expo-router';
import { Linking } from 'react-native';
import HomeScreen from '../app/index';
import { isDateOfBirth } from '../components/onboarding';
import { AuthProvider } from '../lib/auth';
import { DEV_API_URL } from '../lib/config';
import { readToken, saveToken } from '../lib/session';
import { serve } from '../test-utils/fake-api';
import { home, me, syntheticPhone } from '../test-utils/fixtures';

async function renderHome() {
  await saveToken('tok');
  return render(
    <AuthProvider>
      <HomeScreen />
    </AuthProvider>,
  );
}

describe('onboarding (hard rule 5: the server decides; the app asks and re-checks)', () => {
  it('an adult: date of birth, then what happens to their information and an explicit yes (A7-04)', async () => {
    let current = me();
    const calls = serve({
      'GET /api/me': () => ({ json: current }),
      'GET /api/home': { json: home() },
      'POST /api/me/date-of-birth': () => {
        current = me({
          dateOfBirth: '2000-02-02',
          consentStatus: 'not-required',
          needsAdultConsent: true,
        });
        return { json: { consentStatus: 'not-required' } };
      },
      'POST /api/me/adult-consent': () => {
        current = me({ dateOfBirth: '2000-02-02', consentStatus: 'not-required' }, true);
        return { json: { ok: true } };
      },
    });
    const screen = await renderHome();
    expect(await screen.findByRole('header', { name: en.onboarding.dobTitle })).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText(en.onboarding.dobLabel), '2000-02-02');
    await fireEvent.press(screen.getByRole('button', { name: en.common.continue }));

    // Not straight into the app: first the disclosure (the AI provider outside South Africa, and
    // every messaging company), the same wording as the web, and nothing agreed yet.
    expect(await screen.findByRole('header', { name: en.adultConsent.title })).toBeTruthy();
    for (const line of [...en.adultConsent.whatWeDo, ...en.adultConsent.whatWeKeep]) {
      expect(screen.getByText(line)).toBeTruthy();
    }
    expect(screen.queryByRole('link', { name: en.nav.chat })).toBeNull();
    expect(calls.some((c) => c.key === 'POST /api/me/adult-consent')).toBe(false);

    await fireEvent.press(screen.getByRole('checkbox', { name: en.privacyPage.adultConfirm }));
    await fireEvent.press(screen.getByRole('button', { name: en.adultConsent.agree }));
    expect(await screen.findByRole('link', { name: en.nav.chat })).toBeTruthy();
    expect(screen.getByRole('link', { name: en.nav.results })).toBeTruthy();
    expect(calls.find((c) => c.key === 'POST /api/me/date-of-birth')?.body).toEqual({
      dateOfBirth: '2000-02-02',
    });
    expect(calls.find((c) => c.key === 'POST /api/me/adult-consent')?.body).toEqual({
      version: en.adultConsent.version,
    });
  });

  it('asks for the grade once consent is recorded, before the home (G10-1)', async () => {
    let current = me({ consentStatus: 'not-required' }, true, null);
    const calls = serve({
      'GET /api/me': () => ({ json: current }),
      'GET /api/home': { json: home() },
      'PATCH /api/me': () => {
        current = me({ consentStatus: 'not-required' }, true, 10);
        return { json: { profile: current.profile } };
      },
    });
    const screen = await renderHome();
    expect(await screen.findByRole('header', { name: en.onboarding.grade })).toBeTruthy();
    expect(screen.queryByRole('link', { name: en.nav.chat })).toBeNull();
    // Nothing is chosen for them: Continue waits for a grade.
    const go = screen.getByRole('button', { name: en.common.continue });
    expect(go.props.accessibilityState).toMatchObject({ disabled: true });

    await fireEvent.press(screen.getByRole('radio', { name: en.onboarding.gradeOption(10) }));
    await fireEvent.press(screen.getByRole('button', { name: en.common.continue }));
    expect(await screen.findByRole('link', { name: en.nav.chat })).toBeTruthy();
    expect(calls.find((c) => c.key === 'PATCH /api/me')?.body).toEqual({ grade: 10 });
  });

  it('a minor: guardian form, then waiting, re-checking /api/me until the guardian agrees', async () => {
    let current = me();
    const guardianPhone = syntheticPhone(2);
    const calls = serve({
      'GET /api/me': () => ({ json: current }),
      'GET /api/home': { json: home() },
      'POST /api/me/date-of-birth': () => {
        current = me({ dateOfBirth: '2010-05-05', consentStatus: 'pending' });
        return { json: { consentStatus: 'pending' } };
      },
      'POST /api/me/guardian': { json: { ok: true } },
    });
    const screen = await renderHome();
    await fireEvent.changeText(await screen.findByLabelText(en.onboarding.dobLabel), '2010-05-05');
    await fireEvent.press(screen.getByRole('button', { name: en.common.continue }));

    expect(await screen.findByRole('header', { name: en.onboarding.guardianTitle })).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText(en.onboarding.guardianName), 'Test Guardian');
    await fireEvent.changeText(screen.getByLabelText(en.onboarding.guardianPhone), guardianPhone);
    await fireEvent.press(
      screen.getByRole('radio', { name: en.onboarding.relationships['legal-guardian'] }),
    );
    await fireEvent.press(screen.getByRole('button', { name: en.onboarding.sendRequest }));

    expect(await screen.findByRole('header', { name: en.onboarding.waitingTitle })).toBeTruthy();
    expect(calls.find((c) => c.key === 'POST /api/me/guardian')?.body).toEqual({
      name: 'Test Guardian',
      phone: guardianPhone,
      relationship: 'legal-guardian',
    });

    // Deleting the account stays possible while waiting (POPIA; the stores require it in-app).
    await fireEvent.press(screen.getByRole('button', { name: en.me.deleteTitle }));
    expect(useRouter().push).toHaveBeenCalledWith('/account');

    // Not yet.
    await fireEvent.press(screen.getByRole('button', { name: en.onboarding.checkAgain }));
    expect(await screen.findByText(en.onboarding.stillWaiting)).toBeTruthy();
    expect(screen.queryByRole('link', { name: en.nav.chat })).toBeNull();

    // The guardian agrees through the SMS link.
    current = me({ dateOfBirth: '2010-05-05', consentStatus: 'granted' }, true);
    await fireEvent.press(screen.getByRole('button', { name: en.onboarding.checkAgain }));
    expect(await screen.findByRole('link', { name: en.nav.chat })).toBeTruthy();
  });

  it('a learner who turned 18 gives their own consent', async () => {
    let current = me({
      dateOfBirth: '2008-01-01',
      consentStatus: 'granted',
      needsAdultConsent: true,
    });
    const calls = serve({
      'GET /api/me': () => ({ json: current }),
      'GET /api/home': { json: home() },
      'POST /api/me/adult-consent': () => {
        current = me({ dateOfBirth: '2008-01-01', consentStatus: 'not-required' }, true);
        return { json: { ok: true } };
      },
    });
    const screen = await renderHome();
    expect(await screen.findByRole('header', { name: en.onboarding.adultTitle })).toBeTruthy();
    expect(screen.getByText(en.adultConsent.whatWeKeep[1] as string)).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: en.privacyPage.adultConfirm }));
    await fireEvent.press(screen.getByRole('button', { name: en.adultConsent.agree }));
    expect(await screen.findByRole('link', { name: en.nav.chat })).toBeTruthy();
    expect(calls.find((c) => c.key === 'POST /api/me/adult-consent')?.body).toEqual({
      version: en.adultConsent.version,
    });
  });

  it('the agreement has an unticked box and the privacy policy link (the launch standard)', async () => {
    const calls = serve({
      'GET /api/me': {
        json: me({
          dateOfBirth: '2000-02-02',
          consentStatus: 'not-required',
          needsAdultConsent: true,
        }),
      },
      'POST /api/me/adult-consent': { json: { ok: true } },
    });
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const screen = await renderHome();
    const box = await screen.findByRole('checkbox', { name: en.privacyPage.adultConfirm });
    expect(box.props.accessibilityState).toMatchObject({ checked: false });
    const agree = screen.getByRole('button', { name: en.adultConsent.agree });
    expect(agree.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(agree);
    expect(calls.some((c) => c.key === 'POST /api/me/adult-consent')).toBe(false);

    // The policy is the web page, opened in the browser.
    await fireEvent.press(screen.getByRole('link', { name: en.privacyPage.consentLink }));
    expect(open).toHaveBeenCalledWith(`${DEV_API_URL}/privacy`);

    await fireEvent.press(box);
    expect(
      screen.getByRole('button', { name: en.adultConsent.agree }).props.accessibilityState,
    ).toMatchObject({ disabled: false });
    open.mockRestore();
  });

  it('a withdrawn guardian shows the withdrawn wording', async () => {
    serve({
      'GET /api/me': { json: me({ dateOfBirth: '2010-05-05', consentStatus: 'withdrawn' }) },
    });
    const screen = await renderHome();
    expect(await screen.findByRole('header', { name: en.onboarding.withdrawnTitle })).toBeTruthy();
  });

  it('tells a learner under 13 why the server refused the date, and stays on the step (A11-24)', async () => {
    serve({
      'GET /api/me': { json: me() },
      'POST /api/me/date-of-birth': { status: 409, json: { error: 'state', detail: 'too-young' } },
    });
    const screen = await renderHome();
    await fireEvent.changeText(await screen.findByLabelText(en.onboarding.dobLabel), '2016-06-01');
    await fireEvent.press(screen.getByRole('button', { name: en.common.continue }));
    expect(await screen.findByText(en.errors.tooYoung)).toBeTruthy();
    expect(screen.getByLabelText(en.onboarding.dobLabel)).toBeTruthy();
  });

  it('refuses a date that is not YYYY-MM-DD before calling the server', async () => {
    const calls = serve({ 'GET /api/me': { json: me() } });
    const screen = await renderHome();
    await fireEvent.changeText(await screen.findByLabelText(en.onboarding.dobLabel), '2010-13-45');
    await fireEvent.press(screen.getByRole('button', { name: en.common.continue }));
    expect(await screen.findByText(en.onboarding.dobInvalid)).toBeTruthy();
    expect(calls.some((c) => c.key === 'POST /api/me/date-of-birth')).toBe(false);
  });

  it('checks dates properly', () => {
    const today = new Date('2026-10-13T10:00:00Z');
    expect(isDateOfBirth('2009-04-23', today)).toBe(true);
    expect(isDateOfBirth('2009-02-30', today)).toBe(false);
    expect(isDateOfBirth('23/04/2009', today)).toBe(false);
    expect(isDateOfBirth('2030-01-01', today)).toBe(false);
  });

  describe('leaving from any step (A7-03: shared phones, POPIA, App Store 5.1.1(v))', () => {
    const steps = [
      ['date of birth', me(), en.onboarding.dobTitle],
      [
        'guardian',
        me({ dateOfBirth: '2010-05-05', consentStatus: 'pending' }),
        en.onboarding.guardianTitle,
      ],
      [
        'adult consent',
        me({ dateOfBirth: '2008-01-01', consentStatus: 'granted', needsAdultConsent: true }),
        en.onboarding.adultTitle,
      ],
    ] as const;

    beforeEach(() => {
      (useRouter().push as jest.Mock).mockClear();
    });

    it.each(steps)(
      'the %s step offers sign-out and account deletion',
      async (_, account, title) => {
        const calls = serve({
          'GET /api/me': { json: account },
          'POST /api/auth/sign-out': { json: { ok: true } },
        });
        const screen = await renderHome();
        expect(await screen.findByRole('header', { name: title })).toBeTruthy();

        await fireEvent.press(screen.getByRole('button', { name: en.me.deleteTitle }));
        expect(useRouter().push).toHaveBeenCalledWith('/account');

        await fireEvent.press(screen.getByRole('button', { name: en.nav.signOut }));
        await waitFor(async () => expect(await readToken()).toBeNull());
        expect(calls.some((c) => c.key === 'POST /api/auth/sign-out')).toBe(true);
      },
    );

    it('the waiting step offers sign-out', async () => {
      serve({
        'GET /api/me': { json: me({ dateOfBirth: '2010-05-05', consentStatus: 'pending' }) },
        'POST /api/me/guardian': { json: { ok: true } },
        'POST /api/auth/sign-out': { json: { ok: true } },
      });
      const screen = await renderHome();
      await fireEvent.changeText(
        await screen.findByLabelText(en.onboarding.guardianName),
        'Test Guardian',
      );
      await fireEvent.changeText(
        screen.getByLabelText(en.onboarding.guardianPhone),
        syntheticPhone(3),
      );
      await fireEvent.press(screen.getByRole('button', { name: en.onboarding.sendRequest }));
      expect(await screen.findByRole('header', { name: en.onboarding.waitingTitle })).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: en.nav.signOut }));
      await waitFor(async () => expect(await readToken()).toBeNull());
    });

    it('an adult can decline: nothing is recorded, and the way out is explained', async () => {
      const calls = serve({
        'GET /api/me': {
          json: me({
            dateOfBirth: '2008-01-01',
            consentStatus: 'granted',
            needsAdultConsent: true,
          }),
        },
      });
      const screen = await renderHome();
      await fireEvent.press(
        await screen.findByRole('button', { name: en.onboarding.adultDecline }),
      );
      expect(await screen.findByText(en.onboarding.adultDeclined)).toBeTruthy();
      expect(calls.some((c) => c.key === 'POST /api/me/adult-consent')).toBe(false);
      // Still in onboarding: deleting and signing out are right there.
      expect(screen.getByRole('button', { name: en.me.deleteTitle })).toBeTruthy();
      expect(screen.getByRole('button', { name: en.nav.signOut })).toBeTruthy();
      expect(screen.queryByRole('link', { name: en.nav.chat })).toBeNull();
    });
  });

  it('signs out from home, revoking the token on the server', async () => {
    const calls = serve({
      'GET /api/me': { json: me({ consentStatus: 'not-required' }, true) },
      'GET /api/home': { json: home() },
      'POST /api/auth/sign-out': { json: { ok: true } },
    });
    const screen = await renderHome();
    await fireEvent.press(await screen.findByRole('button', { name: en.nav.signOut }));
    await waitFor(async () => expect(await readToken()).toBeNull());
    const signOut = calls.find((c) => c.key === 'POST /api/auth/sign-out');
    expect(signOut?.headers['authorization']).toBe('Bearer tok');
  });
});
