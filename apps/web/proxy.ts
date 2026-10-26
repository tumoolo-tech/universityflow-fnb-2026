import { type NextRequest, NextResponse } from 'next/server';
import { buildCsp, CSP_HEADER, NONCE_HEADER, newNonce, PATH_HEADER, uploadOrigin } from './lib/csp';
import { demoSignupOrNull } from './lib/demo-signup';
import { mmerekoFrameOrigin } from './lib/mmereko-canvas';
import { stagingGate } from './lib/staging-gate';

/**
 * Per-request CSP nonces (audit finding 2). Next reads the nonce from the request's CSP header
 * while rendering and stamps it on its own scripts, so every page this runs on must be
 * dynamically rendered (they all are). Both request headers are overwritten, so a client
 * can't choose its own nonce.
 *
 * The same-origin (CSRF) check stays in the API route handlers (`lib/server/http.ts`).
 *
 * On a staging site every page first needs the access gate's password (A5-10, lib/staging-gate.ts);
 * API routes check it in `handler()`, since this proxy never runs on them.
 */
export function proxy(request: NextRequest): NextResponse | Response {
  const shut = stagingGate(request);
  if (shut) return shut;

  const nonce = newNonce();
  const csp = buildCsp({
    nonce,
    dev: process.env['NODE_ENV'] === 'development',
    uploadOrigin: uploadOrigin(process.env),
    firebaseAuthDomain: firebaseAuthDomain(),
    // "Open Mmereko": its site may be framed with My CV and the canvas switched on, from every page,
    // since a click to /cv keeps the policy of the page it started on (A5-28).
    mmerekoOrigin: mmerekoFrameOrigin(process.env),
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set(CSP_HEADER, csp);
  requestHeaders.set(PATH_HEADER, request.nextUrl.pathname);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(CSP_HEADER, csp);
  return response;
}

/**
 * The judge demo's real sign-up (a hackathon exception, docs/deploy/demo.md): the Firebase JS SDK
 * needs Google's domains, so the policy is widened for them only on a demo deployment with
 * UF_DEMO_SIGNUP=firebase. On every page of that demo, not the sign-up page alone (A5-28): a click
 * to the sign-up page keeps the policy of the page it started on. Everywhere else, null: unchanged.
 */
function firebaseAuthDomain(): string | null {
  if (process.env['UF_DEPLOYMENT'] !== 'demo') return null;
  const setting = demoSignupOrNull(process.env);
  return setting?.mode === 'firebase' ? setting.firebase.authDomain : null;
}

export const config = {
  matcher: [
    /*
     * Pages only. Skipped:
     * - api: JSON and files, never inline script. next.config.ts gives them a nonce-free CSP.
     *   The proxy would also buffer request bodies (10 MB cap), truncating large uploads.
     * - _next/static, _next/image, favicon.ico and other files with an extension.
     */
    '/((?!api/|_next/static|_next/image|favicon\\.ico|.*\\.[a-zA-Z0-9]+$).*)',
  ],
};
