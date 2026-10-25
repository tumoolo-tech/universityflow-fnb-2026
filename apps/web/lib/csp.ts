/**
 * Content-Security-Policy (audit finding 2). Everything is served from our own origin: no
 * third-party scripts, fonts or trackers.
 *
 * Pages get a fresh nonce per request from `proxy.ts`: `script-src` allows only scripts carrying
 * that nonce (Next stamps it on its own bootstrap and chunks) and whatever they load
 * (`'strict-dynamic'`). There is no `'unsafe-inline'` for scripts. API responses carry the same
 * policy with no nonce at all, so no inline script can ever run from them.
 *
 * `style-src` keeps `'unsafe-inline'`: Next's built-in error and not-found pages render inline
 * `style` attributes, which a nonce can't cover. Style injection can't run code.
 *
 * Web Crypto only: this runs in the proxy as well as in tests.
 */

import { firebaseCspSources } from './demo-signup';

export interface CspOptions {
  /** The per-request nonce; omitted for responses that never carry inline script (API). */
  nonce?: string;
  /** `next dev` only: React uses `eval` to rebuild server error stacks in the browser. */
  dev: boolean;
  /** The bucket the browser posts uploads to when S3 is connected (see `uploadOrigin`). */
  uploadOrigin?: string | null;
  /**
   * The judge demo's real sign-up page only (a hackathon exception, docs/deploy/demo.md): the
   * Firebase auth domain, whose SDK sources join the policy (irebaseCspSources). Never set on
   * any other page, deployment or API response (proxy.ts).
   */
  firebaseAuthDomain?: string | null;
  /**
   * "Open Mmereko" on My CV (lib/mmereko-canvas.ts): Mmereko's https origin, which joins
   * `frame-src` so the canvas may show its site. Set only on /cv with the switch on (proxy.ts).
   */
  mmerekoOrigin?: string | null;
}

/**
 * With S3 connected, the browser posts uploads straight to the bucket (open finding 3), so the
 * bucket's origin joins `connect-src`. Nothing else is ever added.
 */
export function uploadOrigin(env: Record<string, string | undefined>): string | null {
  if (env['UF_PROVIDERS'] !== 'live' || !env['UF_S3_BUCKET']) return null;
  if (env['UF_S3_ENDPOINT']) return new URL(env['UF_S3_ENDPOINT']).origin;
  return `https://${env['UF_S3_BUCKET']}.s3.${env['UF_S3_REGION'] || 'af-south-1'}.amazonaws.com`;
}

/** 128 random bits, base64. Unpredictable and unique per request. */
export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function buildCsp({
  nonce,
  dev,
  uploadOrigin: upload,
  firebaseAuthDomain,
  mmerekoOrigin,
}: CspOptions): string {
  const script = ["'self'"];
  if (nonce) script.push(`'nonce-${nonce}'`, "'strict-dynamic'");
  if (dev) script.push("'unsafe-eval'");
  const connect = ["'self'"];
  if (upload) connect.push(upload);
  const firebase = firebaseAuthDomain ? firebaseCspSources(firebaseAuthDomain) : null;
  if (firebase) {
    script.push(...firebase.script);
    connect.push(...firebase.connect);
  }
  const frames = [...(firebase?.frame ?? []), ...(mmerekoOrigin ? [mmerekoOrigin] : [])];
  return [
    "default-src 'self'",
    `script-src ${script.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connect.join(' ')}`,
    ...(frames.length > 0 ? [`frame-src 'self' ${frames.join(' ')}`] : []),
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export const CSP_HEADER = 'Content-Security-Policy';
export const NONCE_HEADER = 'x-nonce';
/** The page's own path, set by the proxy (any client value overwritten); the demo banner reads it. */
export const PATH_HEADER = 'x-uf-path';
