import { isDemo } from '@/lib/server/config';
import { leaveCurrent } from '@/lib/server/demo/core';
import { assertSameOrigin, handler, json } from '@/lib/server/http';
import { getServices } from '@/lib/server/services';
import { clearSessionCookie, sessionToken } from '@/lib/server/session';

/**
 * Sign out. On the judge demo (the owner, 2026-10-23, late) the menu's "Sign out" leaves as
 * "Switch learner" does: a made-up learner's copy is deleted (it is this browser's alone and can't
 * be signed back in to), a judge's own account is only signed out of, and the page goes back to
 * the picker (`next`). Everywhere else the answer is exactly as before.
 */
export const POST = handler(async (request: Request) => {
  assertSameOrigin(request);
  const token = await sessionToken();
  if (isDemo()) {
    if (token) await leaveCurrent(await getServices());
    await clearSessionCookie();
    return json({ ok: true, next: '/demo' });
  }
  if (token) await (await getServices()).store.signOut(token);
  await clearSessionCookie();
  return json({ ok: true });
});
