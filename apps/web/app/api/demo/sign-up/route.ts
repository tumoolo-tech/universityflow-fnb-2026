import { z } from 'zod';
import {
  DEMO_SIGNUPS_PER_IP_PER_HOUR,
  leaveCurrent,
  requireDemo,
  sweepOldCopies,
} from '@/lib/server/demo/core';
import { IdentityTokenError } from '@/lib/server/demo/identity';
import { identityVerifier } from '@/lib/server/demo/signup';
import { assertSameOrigin, clientIp, HttpError, handler, json, parseBody } from '@/lib/server/http';
import { setSessionCookie } from '@/lib/server/session';

const HOUR_MS = 60 * 60 * 1000;

const Body = z.object({ idToken: z.string().min(1).max(8192) });

/**
 * The judges' real sign-up (a HACKATHON EXCEPTION the owner approved on 2026-10-23,
 * docs/deploy/demo.md): the sign-up page posts the Firebase ID token it got from Google; the
 * server verifies it itself (lib/server/demo/identity.ts), finds or makes the judge's own account
 * (only the uid and the email are kept) and opens the same session as every sign-in. Then the
 * real product path: onboarding (adults only), the adult agreement, results.
 *
 * Not found unless this is a demo with UF_DEMO_SIGNUP set. Same-origin only (CSRF), a per-address
 * limit, and the lazy sweep. Nothing about the person is logged (rule 4): a refused token says
 * only that it was refused.
 */
export const POST = handler(async (request: Request) => {
  const services = await requireDemo();
  const setting = services.config.demoSignup;
  if (!setting) throw new HttpError(404, 'not-found');
  assertSameOrigin(request);
  const { idToken } = await parseBody(request, Body);
  const { store } = services;
  const allowed = await store.allow(
    'demo-signup',
    clientIp(request) ?? 'unknown',
    DEMO_SIGNUPS_PER_IP_PER_HOUR,
    HOUR_MS,
  );
  if (!allowed) throw new HttpError(429, 'rate-limited');

  let identity: { uid: string; email: string };
  try {
    identity = await identityVerifier(setting).verify(idToken);
  } catch (error) {
    if (error instanceof IdentityTokenError) {
      // The reason word only: never the token, the uid or the email.
      console.warn(`demo sign-up: token refused (${error.reason})`);
      throw new HttpError(error.reason === 'keys-unavailable' ? 503 : 401, 'signed-out');
    }
    throw error;
  }

  await sweepOldCopies(services);
  await leaveCurrent(services);
  const { token, isNewStudent } = await store.signInDemoSignup(identity);
  await setSessionCookie(token, request);
  return json({ ok: true, next: isNewStudent ? '/onboarding' : '/home' });
});
