import 'server-only';
import type { Account, StudentStore } from '@universityflow/db';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { getServices } from './services';

/**
 * Who is asking. The web app uses an httpOnly cookie; the mobile app sends the same token as a
 * bearer header (it never holds any other secret). Both resolve through the database, where only
 * a hash of the token is stored.
 */

export const SESSION_COOKIE = 'uf_session';
export const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60;

export async function sessionToken(): Promise<string | null> {
  const authorization = (await headers()).get('authorization');
  if (authorization?.startsWith('Bearer ')) return authorization.slice('Bearer '.length).trim();
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

export interface Signed {
  readonly studentId: string;
  readonly account: Account;
  readonly student: StudentStore;
}

/** The signed-in student, or null. */
export async function currentStudent(): Promise<Signed | null> {
  const token = await sessionToken();
  if (!token) return null;
  const { store } = await getServices();
  const studentId = await store.sessionStudent(token);
  if (!studentId) return null;
  const account = await store.account(studentId);
  return { studentId, account, student: store.forStudent(studentId) };
}

/**
 * The demo banner's "Switch learner" (A2-67): true while a learner is signed in, whether one of
 * the made-up learners or a judge's own sign-up. False signed out, and whenever the session can't
 * be checked (the server refuses its configuration, the database is away): the banner then offers
 * no button that could only fail. Reads the session's id only; nothing is logged (hard rule 4).
 */
export async function demoLearnerSignedIn(): Promise<boolean> {
  try {
    return (await currentStudent()) !== null;
  } catch {
    return false;
  }
}

/** True when onboarding is done and the database will process this learner's data. */
export function isReady(account: Account): boolean {
  return (
    (account.consentStatus === 'not-required' || account.consentStatus === 'granted') &&
    !account.needsAdultConsent
  );
}

/**
 * The guard for every signed-in page (audit A1-10). Next renders a layout and its page in
 * parallel, so the `(app)` layout's redirect does not stop the page underneath it from running:
 * each page must check for itself before it reads anything personal, or the database's consent
 * gate (hard rule 5) throws an unhandled `ConsentRequiredError` into the server log.
 *
 * Signed out goes to sign-in; not ready goes to onboarding (the date-of-birth, guardian or
 * waiting step). Readiness is asked of the database itself, the same check that guards every
 * read, so the page and the gate can't disagree (at a birthday, say). Never weakens the gate:
 * it only decides where to send a learner the gate would refuse. Cached per request, so the
 * layout and the page share one lookup.
 */
export const readyStudent = cache(async (): Promise<Signed> => {
  const signed = await currentStudent();
  if (!signed) redirect('/sign-in');
  if (!isReady(signed.account) || !(await signed.student.mayProcess())) redirect('/onboarding');
  return signed;
});

/**
 * `Secure` follows the connection: always on the deployed site (HTTPS), and off only for a
 * production build served over plain HTTP on this machine (the E2E tests).
 */
export async function setSessionCookie(token: string, request: Request): Promise<void> {
  const forwarded = request.headers.get('x-forwarded-proto');
  const https = (forwarded ?? new URL(request.url).protocol.replace(':', '')) === 'https';
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: https || process.env['VERCEL_ENV'] === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_S,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
