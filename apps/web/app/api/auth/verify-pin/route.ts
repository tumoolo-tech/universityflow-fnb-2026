import { z } from 'zod';
import {
  demoLearnerBefore,
  leaveEarlier,
  markOwner,
  onScreenSignup,
  requireFreeOrOwn,
  requireTollFree,
} from '@/lib/server/demo/phone-signup';
import {
  assertSameOrigin,
  handler,
  json,
  NATIVE_CLIENT_HEADER,
  parseBody,
} from '@/lib/server/http';
import { logReviewSignIn } from '@/lib/server/review';
import { getServices } from '@/lib/server/services';
import { setSessionCookie } from '@/lib/server/session';

const Body = z.object({ phone: z.string().min(9).max(20), pin: z.string().regex(/^\d{6}$/) });

/**
 * Completes sign-in. The web app gets an httpOnly cookie and never sees the token, so a script
 * on the page can't read it (audit 2026-10-13, finding 8). The mobile app asks for the token and
 * keeps it in the device's secure store; it gets no cookie, because a phone's native cookie jar
 * would replay it on the next sign-in, which the same-origin check then refuses.
 *
 * Judge demo mode has no phone sign-in (docs/deploy/demo.md): not found, unless its on-screen
 * sign-up is on (a hackathon exception). Then only a made-up 080 number signs in, and a browser on
 * a made-up learner leaves that copy (deleted, as "Switch learner" does) for the new account.
 * A number with an account signs in only from the browser that made it (409 `demo-080-taken`).
 */
export const POST = handler(async (request: Request) => {
  const services = await getServices();
  const onScreen = onScreenSignup(services);
  assertSameOrigin(request);
  const { phone, pin } = await parseBody(request, Body);
  if (onScreen) {
    requireTollFree(phone);
    // A number another browser made an account with is theirs (judges pick easy numbers).
    await requireFreeOrOwn(services, phone);
  }
  const earlier = onScreen ? await demoLearnerBefore() : null;
  const { store } = services;
  const { token, isNewStudent, review, studentId } = await store.verifyOtp(phone, pin);
  if (onScreen) {
    await leaveEarlier(services, earlier, studentId);
    await markOwner(services, phone, studentId, request);
  }
  // The store-review account (A7-01): the store wrote its audit row; this is the alert. The
  // response is the same as any sign-in's.
  if (review) logReviewSignIn(studentId);
  const native = request.headers.get(NATIVE_CLIENT_HEADER) === 'native';
  if (native) return json({ ok: true, isNewStudent, token });
  await setSessionCookie(token, request);
  return json({ ok: true, isNewStudent });
});
