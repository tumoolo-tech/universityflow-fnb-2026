'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Button, ButtonLink, Checkbox, Field, Input, Notice } from '@/components/ui';
import { ApiError, api } from '@/lib/client/api';
import { type FirebaseWebConfig, mintFakeIdToken } from '@/lib/demo-signup';

/**
 * The judges' real sign-up form (a hackathon exception, docs/deploy/demo.md). The only code that
 * loads the Firebase JS SDK, and only on this page, on demand (a dynamic import), so no other
 * page's bundle grows. Firebase keeps nothing in the browser (in-memory persistence) and is signed
 * out as soon as our server has made its own session from the ID token. The email address waiting
 * for its link is kept in this browser's localStorage until the link is opened (Firebase's own
 * pattern), then removed.
 *
 * The fake (UF_DEMO_SIGNUP=fake, this machine only) skips Firebase: it mints its own token.
 */

export interface SignUpWords {
  readonly agreeLabel: string;
  readonly agreeFirst: string;
  readonly emailLabel: string;
  readonly sendLink: string;
  readonly or: string;
  readonly google: string;
  readonly linkSent: string;
  readonly confirmEmailLead: string;
  readonly finish: string;
  readonly working: string;
  readonly failed: string;
  readonly unavailable: string;
  readonly fakeNote: string;
  readonly fakeAction: string;
  readonly pickerAction: string;
  readonly popupBlocked: string;
  readonly invalidEmail: string;
}

/**
 * Firebase's answers that mean its project isn't set up for this site (a wrong key, the domain
 * not authorised, a sign-in method off): "try again" can't help, so the judge is told sign-up
 * isn't available and offered the made-up learners.
 */
const NOT_SET_UP = new Set([
  'auth/invalid-api-key',
  'auth/unauthorized-domain',
  'auth/unauthorized-continue-uri',
  'auth/operation-not-allowed',
  'auth/configuration-not-found',
  'auth/admin-restricted-operation',
  'auth/project-not-found',
]);
/** The judge closed Google's window themselves: nothing to say. */
const CLOSED = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request']);

/** Firebase's error code, if this is one of its errors. */
function firebaseCode(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && code.startsWith('auth/') ? code : null;
}

/** What to say when a sign-in failed (null: nothing, the judge closed the window). */
function failureWords(error: unknown, words: SignUpWords): string | null {
  if (error instanceof ApiError) return error.status === 503 ? words.unavailable : words.failed;
  const code = firebaseCode(error);
  if (!code) return words.failed;
  // The owner's clue in the browser's console: Firebase's code only, nothing about the person.
  console.warn(`demo sign-up: Firebase refused (${code})`);
  if (NOT_SET_UP.has(code) || code.startsWith('auth/api-key-not-valid')) return words.unavailable;
  if (CLOSED.has(code)) return null;
  if (code === 'auth/popup-blocked') return words.popupBlocked;
  if (code === 'auth/invalid-email' || code === 'auth/missing-email') return words.invalidEmail;
  return words.failed;
}

const EMAIL_KEY = 'uf-demo-signup-email';
const PAGE = '/demo/sign-up';

// The two SDK packages themselves, not the `firebase` umbrella, which brings Firestore and gRPC
// along (A8-12). `firebase/app` and `firebase/auth` only re-export these.
type Sdk = typeof import('@firebase/auth');
type Auth = ReturnType<Sdk['getAuth']>;
type Firebase = { auth: Auth; sdk: Sdk };

function readStored(): string {
  try {
    return window.localStorage.getItem(EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}

function store(email: string | null): void {
  try {
    if (email) window.localStorage.setItem(EMAIL_KEY, email);
    else window.localStorage.removeItem(EMAIL_KEY);
  } catch {
    // Private windows may refuse storage: the confirm step asks for the address instead.
  }
}

async function loadFirebase(config: FirebaseWebConfig): Promise<Firebase> {
  const [{ getApps, initializeApp }, sdk] = await Promise.all([
    import('@firebase/app'),
    import('@firebase/auth'),
  ]);
  const app =
    getApps()[0] ??
    initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
    });
  let auth: Auth;
  try {
    auth = sdk.initializeAuth(app, {
      persistence: sdk.inMemoryPersistence,
      popupRedirectResolver: sdk.browserPopupRedirectResolver,
    });
  } catch {
    auth = sdk.getAuth(app);
  }
  return { auth, sdk };
}

export function SignUpForm({
  mode,
  firebase,
  words,
}: {
  mode: 'firebase' | 'fake';
  firebase: FirebaseWebConfig | null;
  words: SignUpWords;
}) {
  const [agreed, setAgreed] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  /** This page was opened from the email link: finish signing in. */
  const [returning, setReturning] = useState(false);
  const loaded = useRef<Promise<Firebase> | null>(null);

  useEffect(() => {
    if (mode !== 'firebase' || !firebase) return;
    // Loaded as the page opens, so a press on "Continue with Google" opens the pop-up straight
    // away (a browser blocks a pop-up opened long after the press).
    loaded.current = loadFirebase(firebase);
    loaded.current
      .then(({ auth, sdk }) => {
        if (sdk.isSignInWithEmailLink(auth, window.location.href)) {
          setReturning(true);
          setEmail(readStored());
        }
      })
      .catch(() => setError(words.unavailable));
  }, [mode, firebase, words.unavailable]);

  async function exchange(idToken: string, signOut?: () => Promise<void>) {
    try {
      const { next } = await api<{ ok: boolean; next: string }>('/api/demo/sign-up', {
        method: 'POST',
        json: { idToken },
      });
      store(null);
      window.location.assign(next || '/home');
    } finally {
      // Our server holds the session now; Firebase keeps nothing.
      await signOut?.().catch(() => undefined);
    }
  }

  async function run(action: () => Promise<void>) {
    if (!agreed) {
      setError(words.agreeFirst);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(failureWords(e, words));
      setBusy(false);
    }
  }

  async function firebaseReady(): Promise<Firebase> {
    if (!loaded.current) throw new Error('Firebase is not configured');
    return loaded.current;
  }

  function onEmail(event: FormEvent) {
    event.preventDefault();
    const address = email.trim();
    if (mode === 'fake') {
      void run(() =>
        exchange(
          mintFakeIdToken({
            uid: `fake-${address.toLowerCase().replace(/[^a-z0-9._-]/g, '_')}`,
            email: address,
          }),
        ),
      );
      return;
    }
    void run(async () => {
      const { auth, sdk } = await firebaseReady();
      if (returning) {
        const credential = await sdk.signInWithEmailLink(auth, address, window.location.href);
        await exchange(await credential.user.getIdToken(), () => sdk.signOut(auth));
        return;
      }
      await sdk.sendSignInLinkToEmail(auth, address, {
        url: `${window.location.origin}${PAGE}`,
        handleCodeInApp: true,
      });
      store(address);
      setSent(true);
      setBusy(false);
    });
  }

  function onGoogle() {
    void run(async () => {
      const { auth, sdk } = await firebaseReady();
      const credential = await sdk.signInWithPopup(auth, new sdk.GoogleAuthProvider());
      await exchange(await credential.user.getIdToken(), () => sdk.signOut(auth));
    });
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={onEmail} noValidate>
      {mode === 'fake' ? <Notice tone="info">{words.fakeNote}</Notice> : null}
      {returning ? <p>{words.confirmEmailLead}</p> : null}
      <label htmlFor="signup-agree" className="flex min-h-11 items-start gap-3">
        <Checkbox
          id="signup-agree"
          className="mt-1"
          required
          checked={agreed}
          onChange={(e) => {
            setAgreed(e.target.checked);
            if (e.target.checked) setError(null);
          }}
        />
        <span>{words.agreeLabel}</span>
      </label>
      <Field label={words.emailLabel}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            type="email"
            autoComplete="email"
            required
            value={email}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Field>
      {sent ? <Notice tone="success">{words.linkSent}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Button type="submit" disabled={busy || email.trim() === ''}>
          {busy
            ? words.working
            : mode === 'fake'
              ? words.fakeAction
              : returning
                ? words.finish
                : words.sendLink}
        </Button>
        {mode === 'firebase' && !returning ? (
          <>
            <span className="text-muted">{words.or}</span>
            <Button variant="secondary" disabled={busy} onClick={onGoogle}>
              {words.google}
            </Button>
          </>
        ) : null}
      </div>
      <ButtonLink href="/demo" variant="quiet" className="self-start">
        {words.pickerAction}
      </ButtonLink>
    </form>
  );
}
