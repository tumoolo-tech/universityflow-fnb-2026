import {
  DEMO_STARTS_PER_IP_PER_HOUR,
  isFormPost,
  leaveCurrent,
  requireDemoForForm,
  seeOther,
  sweepOldCopies,
} from '@/lib/server/demo/core';
import { cloneDemoPersona } from '@/lib/server/demo/personas';
import { isDemoPersonaId } from '@/lib/server/demo/types';
import { assertSameOrigin, clientIp, HttpError, handler, json } from '@/lib/server/http';
import { setSessionCookie } from '@/lib/server/session';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Judge demo mode: starts as one of the made-up learners (docs/deploy/demo.md). Makes a private
 * copy of the persona (agent D2's seed), opens a session on it and signs this browser in. A form
 * post from the picker is answered with a redirect (to /home, or back to the picker with why); a
 * JSON post with JSON.
 *
 * The same-origin check (CSRF), a per-address limit, and on each start the lazy sweep of copies
 * older than a day. A browser already on a copy has that copy deleted first (a judge's own account
 * from the real sign-up is only signed out of).
 */
export const POST = handler(async (request: Request) => {
  // A configuration the server refuses: the picker's press goes back to the picker, which says
  // the demo isn't set up yet (a JSON post gets the handler's 503 `not-set-up`).
  const services = await requireDemoForForm(request);
  if (services instanceof Response) return services;
  assertSameOrigin(request);
  const form = isFormPost(request);
  try {
    const persona = form
      ? (await request.formData()).get('persona')
      : ((await request.json().catch(() => null)) as { persona?: unknown } | null)?.persona;
    if (!isDemoPersonaId(persona)) throw new HttpError(400, 'invalid');
    const { store } = services;
    const allowed = await store.allow(
      'demo-start',
      clientIp(request) ?? 'unknown',
      DEMO_STARTS_PER_IP_PER_HOUR,
      HOUR_MS,
    );
    if (!allowed) throw new HttpError(429, 'rate-limited');

    await sweepOldCopies(services);
    // A previous copy goes; a judge's own account (the real sign-up) is only signed out of.
    await leaveCurrent(services);

    let studentId: string;
    try {
      studentId = await cloneDemoPersona(store, persona);
    } catch (error) {
      console.error(`demo start: the seed failed (${(error as Error)?.name ?? 'Error'})`);
      throw new HttpError(503, 'state', 'demo-unavailable');
    }
    const token = await store.openDemoSession(studentId);
    await setSessionCookie(token, request);
    return form ? seeOther(request, '/home') : json({ ok: true });
  } catch (error) {
    if (!form || !(error instanceof HttpError)) throw error;
    // Back to the picker, which says why.
    const why = error.status === 429 ? 'busy' : 'unavailable';
    return seeOther(request, `/demo?demo=${why}`);
  }
});
