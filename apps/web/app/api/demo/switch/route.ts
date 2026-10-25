import { isFormPost, leaveCurrent, requireDemoForForm, seeOther } from '@/lib/server/demo/core';
import { assertSameOrigin, handler, json } from '@/lib/server/http';
import { clearSessionCookie } from '@/lib/server/session';

/**
 * Judge demo mode: "Switch learner" in the banner (docs/deploy/demo.md). Deletes this browser's
 * copy (everything in it, through the same path as Delete my account), signs out and goes back to
 * the picker (`/demo`). A judge's own account from the real sign-up is only signed out of, never
 * deleted here. Same-origin only (CSRF).
 */
export const POST = handler(async (request: Request) => {
  // A configuration the server refuses: back to the picker, which says the demo isn't set up.
  const services = await requireDemoForForm(request);
  if (services instanceof Response) return services;
  assertSameOrigin(request);
  await leaveCurrent(services);
  await clearSessionCookie();
  return isFormPost(request) ? seeOther(request, '/demo') : json({ ok: true });
});
