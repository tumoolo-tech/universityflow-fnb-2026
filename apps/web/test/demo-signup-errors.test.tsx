// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { en } from '@universityflow/content';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The judges' sign-up fails kindly (the owner, 2026-10-23, late: "nothing works"). A Firebase
 * project that isn't set up for this site (a wrong key, the domain not authorised, a sign-in
 * method off) says sign-up isn't available and offers the made-up learners, never "try again"; a
 * blocked Google window says how to allow it; a closed one says nothing; a mistyped address says
 * to check it. The browser's console gets Firebase's error code only, for the owner.
 */

const failure = { code: '' };
vi.mock('@firebase/app', () => ({ getApps: () => [], initializeApp: () => ({}) }));
vi.mock('@firebase/auth', () => ({
  initializeAuth: () => ({}),
  getAuth: () => ({}),
  inMemoryPersistence: {},
  browserPopupRedirectResolver: {},
  isSignInWithEmailLink: () => false,
  GoogleAuthProvider: class {},
  signOut: async () => undefined,
  signInWithPopup: async () => {
    throw Object.assign(new Error('firebase'), { code: failure.code });
  },
  sendSignInLinkToEmail: async () => {
    throw Object.assign(new Error('firebase'), { code: failure.code });
  },
}));

const { SignUpForm } = await import('../app/demo/sign-up/signup-form');
const copy = en.demoSignup;
const words = {
  agreeLabel: copy.agreeLabel,
  agreeFirst: copy.agreeFirst,
  emailLabel: copy.emailLabel,
  sendLink: copy.sendLink,
  or: copy.or,
  google: copy.google,
  linkSent: copy.linkSent,
  confirmEmailLead: copy.confirmEmailLead,
  finish: copy.finish,
  working: copy.working,
  failed: copy.failed,
  unavailable: copy.unavailable,
  fakeNote: copy.fakeNote,
  fakeAction: copy.fakeAction,
  pickerAction: copy.pickerAction,
  popupBlocked: copy.popupBlocked,
  invalidEmail: copy.invalidEmail,
};
const firebase = {
  apiKey: `AIza${'x'.repeat(35)}`,
  authDomain: 'uf-demo-test.firebaseapp.com',
  projectId: 'uf-demo-test',
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function press(code: string, how: 'google' | 'email') {
  failure.code = code;
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  render(<SignUpForm mode="firebase" firebase={firebase} words={words} />);
  fireEvent.click(screen.getByRole('checkbox', { name: copy.agreeLabel }));
  if (how === 'google') {
    fireEvent.click(screen.getByRole('button', { name: copy.google }));
  } else {
    fireEvent.change(screen.getByLabelText(copy.emailLabel), {
      target: { value: 'judge@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: copy.sendLink }));
  }
  await waitFor(() => expect(warn).toHaveBeenCalled());
  return warn;
}

const NOT_SET_UP = [
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.',
  'auth/invalid-api-key',
  'auth/unauthorized-domain',
  'auth/operation-not-allowed',
  'auth/configuration-not-found',
  'auth/unauthorized-continue-uri',
];

describe('the sign-up form when Firebase is not set up for this site', () => {
  for (const code of NOT_SET_UP) {
    it(`${code}: sign-up isn’t available, try a made-up learner`, async () => {
      const warn = await press(code, 'google');
      await waitFor(() => expect(screen.getByText(copy.unavailable)).toBeTruthy());
      expect(screen.queryByText(copy.failed)).toBeNull();
      // The owner's clue, in the browser's console: Firebase's code and nothing about the person.
      expect(warn.mock.calls.flat().join(' ')).toContain(code);
    });
  }

  it('the email link says the same', async () => {
    await press('auth/unauthorized-continue-uri', 'email');
    await waitFor(() => expect(screen.getByText(copy.unavailable)).toBeTruthy());
  });
});

describe('the sign-up form’s other failures', () => {
  it('a blocked Google window says how to allow it', async () => {
    await press('auth/popup-blocked', 'google');
    await waitFor(() => expect(screen.getByText(copy.popupBlocked)).toBeTruthy());
  });

  it('a Google window the judge closed says nothing, and the buttons work again', async () => {
    await press('auth/popup-closed-by-user', 'google');
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: copy.google }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    expect(screen.queryByText(copy.failed)).toBeNull();
    expect(screen.queryByText(copy.unavailable)).toBeNull();
  });

  it('a mistyped address says to check it', async () => {
    await press('auth/invalid-email', 'email');
    await waitFor(() => expect(screen.getByText(copy.invalidEmail)).toBeTruthy());
  });

  it('anything else is still "That didn’t work"', async () => {
    await press('auth/network-request-failed', 'google');
    await waitFor(() => expect(screen.getByText(copy.failed)).toBeTruthy());
  });
});
