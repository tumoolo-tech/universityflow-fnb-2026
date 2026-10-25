import { EXPO_PUSH_TOKEN } from '@universityflow/messaging';
import { z } from 'zod';
import {
  HttpError,
  handler,
  json,
  parseBody,
  requireReady,
  requireSignedIn,
} from '@/lib/server/http';
import { getServices } from '@/lib/server/services';
import { sessionToken } from '@/lib/server/session';

/**
 * The app's push token for this phone (Phase 4d). The app registers it when the learner turns
 * notifications on, and removes it when they turn them off or sign out. Signing out removes it
 * on the server too: the token hangs off the session (migration 0008).
 *
 * - POST: the app only (a bearer token: the session the token hangs off), a learner whose data
 *   may be processed (hard rule 5, checked here and again in the database), and only when push
 *   is offered at all. A token another learner registered moves to this one.
 * - DELETE: any signed-in learner, with or without consent: removing data is always allowed.
 *   Only their own token can be removed.
 *
 * The token is never logged or echoed back (hard rule 4).
 */

const Token = z.string().max(100).regex(EXPO_PUSH_TOKEN);
const Register = z.object({ token: Token, platform: z.enum(['ios', 'android']) }).strict();
const Remove = z.object({ token: Token }).strict();

/** Registrations per learner per hour: plenty for a phone that reinstalls, not for a script. */
const REGISTRATIONS_PER_HOUR = 20;

export const POST = handler(async (request: Request) => {
  if (!request.headers.get('authorization')?.startsWith('Bearer ')) {
    throw new HttpError(403, 'forbidden');
  }
  const { student, studentId } = await requireReady(request);
  const body = await parseBody(request, Register);
  const { store, channels } = await getServices();
  if (!channels.push) throw new HttpError(409, 'state');
  if (!(await store.allow('push-token', studentId, REGISTRATIONS_PER_HOUR, 60 * 60 * 1000))) {
    throw new HttpError(429, 'rate-limited');
  }
  const session = await sessionToken();
  if (!session) throw new HttpError(401, 'signed-out');
  await student.registerPushToken({
    token: body.token,
    platform: body.platform,
    sessionToken: session,
  });
  return json({ ok: true });
});

export const DELETE = handler(async (request: Request) => {
  const { student } = await requireSignedIn(request);
  const body = await parseBody(request, Remove);
  return json({ removed: await student.removePushToken(body.token) });
});
