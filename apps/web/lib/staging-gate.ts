import { deploy } from '@universityflow/content';

/**
 * The staging access gate (A5-10 / A11-28, audit S1-A8 A8-06). A staging site runs on the
 * stand-ins, so its /dev/outbox shows every sign-in PIN and guardian link: without a gate,
 * anyone could sign in as anyone. Every request to a staging site needs HTTP Basic with
 * UF_STAGING_PASSWORD (any user name). `proxy.ts` checks pages; `handler()` (lib/server/http.ts)
 * checks every API route. Only `/api/health` is open, for the host's probe: it uses no handler.
 *
 * Outside staging it does nothing. On a staging site with no usable password it fails closed.
 * Web APIs only: this runs in the proxy as well as in route handlers.
 */

/** Shorter than this, `readConfig` refuses to start a staging site. */
export const STAGING_PASSWORD_MIN_LENGTH = 16;

const REALM = 'Basic realm="UniversityFlow staging", charset="UTF-8"';

function plain(text: string, status: number, extra: Record<string, string> = {}): Response {
  return new Response(text, {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      ...extra,
    },
  });
}

/** The password from a Basic header, or null. The user name is ignored. */
function basicPassword(header: string | null): string | null {
  if (!header?.startsWith('Basic ')) return null;
  try {
    const decoded = atob(header.slice('Basic '.length).trim());
    const colon = decoded.indexOf(':');
    return colon < 0 ? null : decoded.slice(colon + 1);
  } catch {
    return null;
  }
}

/** Compares without stopping at the first difference. */
function same(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

/** The response that stops this request, or null to let it through. */
export function stagingGate(
  request: Request | null,
  env: Record<string, string | undefined> = process.env,
): Response | null {
  if (env['UF_DEPLOYMENT'] !== 'staging') return null;
  const password = env['UF_STAGING_PASSWORD'] ?? '';
  if (password.length < STAGING_PASSWORD_MIN_LENGTH) {
    return plain(deploy.stagingGateUnavailable, 503);
  }
  const given = basicPassword(request?.headers.get('authorization') ?? null);
  if (given !== null && same(given, password)) return null;
  return plain(deploy.stagingGateRequired, 401, { 'www-authenticate': REALM });
}
