import 'server-only';
import { type KeyObject, verify as verifySignature, X509Certificate } from 'node:crypto';
import { readFakeIdToken } from '../../demo-signup';

/**
 * The judge demo's real sign-up (a hackathon exception, docs/deploy/demo.md): who a Firebase ID
 * token says the person is, checked on our server. D8: an interface, the Firebase verifier, a fake,
 * and a contract both pass (test/identity-contract.ts).
 *
 * The Firebase verifier follows Firebase's "Verify ID tokens using a third-party JWT library": an
 * RS256 signature by one of Google's published securetoken keys (picked by `kid`), `aud` the
 * project id, `iss` https://securetoken.google.com/<project id>, `exp` in the future, `iat` and
 * `auth_time` in the past, a non-empty `sub` (the uid). Node's crypto only: no firebase-admin and
 * no service-account secret. A verified email is required too: it is the account's address.
 *
 * Only the uid and the email leave here, and neither ever goes into an error or a log (rule 4).
 */

export interface VerifiedIdentity {
  readonly uid: string;
  readonly email: string;
}

export interface IdentityVerifier {
  /** The identity in a valid token; throws `IdentityTokenError` for anything else. */
  verify(idToken: string): Promise<VerifiedIdentity>;
}

export type IdentityTokenReason =
  | 'malformed'
  | 'algorithm'
  | 'unknown-key'
  | 'keys-unavailable'
  | 'signature'
  | 'audience'
  | 'issuer'
  | 'expired'
  | 'issued-at'
  | 'auth-time'
  | 'subject'
  | 'email'
  | 'email-unverified';

/** Why a token was refused: a fixed word, never the token or anything in it. */
export class IdentityTokenError extends Error {
  override readonly name = 'IdentityTokenError';
  constructor(readonly reason: IdentityTokenReason) {
    super(`The sign-in token was refused (${reason})`);
  }
}

/** A public key by its id, or null when there is none by that id. */
export type KeySource = (kid: string) => Promise<KeyObject | null>;

/** Seconds of clock difference allowed between Google's servers and ours. */
const CLOCK_SKEW_S = 60;
const MAX_TOKEN_LENGTH = 8192;

function decodeJson(part: string): Record<string, unknown> {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) throw new IdentityTokenError('malformed');
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch {
    throw new IdentityTokenError('malformed');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new IdentityTokenError('malformed');
  }
  return value as Record<string, unknown>;
}

export function firebaseIdTokenVerifier({
  projectId,
  keys,
  now = () => new Date(),
}: {
  readonly projectId: string;
  readonly keys: KeySource;
  readonly now?: () => Date;
}): IdentityVerifier {
  const issuer = `https://securetoken.google.com/${projectId}`;
  return {
    async verify(idToken) {
      if (typeof idToken !== 'string' || idToken.length > MAX_TOKEN_LENGTH) {
        throw new IdentityTokenError('malformed');
      }
      const parts = idToken.split('.');
      if (parts.length !== 3) throw new IdentityTokenError('malformed');
      const [head = '', body = '', signature = ''] = parts;
      const header = decodeJson(head);
      const claims = decodeJson(body);
      if (!/^[A-Za-z0-9_-]+$/.test(signature)) throw new IdentityTokenError('malformed');

      if (header['alg'] !== 'RS256') throw new IdentityTokenError('algorithm');
      const kid = header['kid'];
      if (typeof kid !== 'string' || !kid) throw new IdentityTokenError('unknown-key');
      let key: KeyObject | null;
      try {
        key = await keys(kid);
      } catch {
        throw new IdentityTokenError('keys-unavailable');
      }
      if (!key) throw new IdentityTokenError('unknown-key');
      const signed = verifySignature(
        'RSA-SHA256',
        Buffer.from(`${head}.${body}`),
        key,
        Buffer.from(signature, 'base64url'),
      );
      if (!signed) throw new IdentityTokenError('signature');

      const nowS = Math.floor(now().getTime() / 1000);
      if (claims['aud'] !== projectId) throw new IdentityTokenError('audience');
      if (claims['iss'] !== issuer) throw new IdentityTokenError('issuer');
      const exp = claims['exp'];
      if (typeof exp !== 'number' || exp <= nowS) throw new IdentityTokenError('expired');
      const iat = claims['iat'];
      if (typeof iat !== 'number' || iat > nowS + CLOCK_SKEW_S) {
        throw new IdentityTokenError('issued-at');
      }
      const authTime = claims['auth_time'];
      if (typeof authTime !== 'number' || authTime > nowS + CLOCK_SKEW_S) {
        throw new IdentityTokenError('auth-time');
      }
      const sub = claims['sub'];
      if (typeof sub !== 'string' || sub.length === 0 || sub.length > 128) {
        throw new IdentityTokenError('subject');
      }
      const email = claims['email'];
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+$/.test(email) || email.length > 320) {
        throw new IdentityTokenError('email');
      }
      if (claims['email_verified'] !== true) throw new IdentityTokenError('email-unverified');
      return { uid: sub, email: email.toLowerCase() };
    },
  };
}

/** Google's published certificates for Firebase ID tokens (Firebase's documentation names it). */
export const SECURETOKEN_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

/** An unknown kid fetches again, but at most this often (a stream of bad tokens can't hammer Google). */
const REFETCH_UNKNOWN_MS = 60_000;

/**
 * Google's securetoken keys, cached for as long as their Cache-Control says (they rotate).
 * Throws when they can't be fetched; the verifier turns that into `keys-unavailable`.
 */
export function googleSecureTokenKeys({
  fetch: fetcher = fetch,
  now = () => new Date(),
}: {
  readonly fetch?: (url: string, init?: RequestInit) => Promise<Response>;
  readonly now?: () => Date;
} = {}): KeySource {
  let cache: { keys: Map<string, KeyObject>; fetchedAt: number; until: number } | null = null;

  async function load(): Promise<void> {
    const response = await fetcher(SECURETOKEN_CERTS_URL, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`securetoken certificates: HTTP ${response.status}`);
    const body = (await response.json()) as Record<string, unknown>;
    const keys = new Map<string, KeyObject>();
    for (const [kid, pem] of Object.entries(body)) {
      if (typeof pem === 'string') keys.set(kid, new X509Certificate(pem).publicKey);
    }
    const maxAge = /max-age=(\d+)/.exec(response.headers.get('cache-control') ?? '')?.[1];
    const at = now().getTime();
    cache = { keys, fetchedAt: at, until: at + (maxAge ? Number(maxAge) * 1000 : 3_600_000) };
  }

  return async (kid) => {
    const at = now().getTime();
    if (!cache || at >= cache.until) await load();
    else if (!cache.keys.has(kid) && at - cache.fetchedAt >= REFETCH_UNKNOWN_MS) await load();
    return cache?.keys.get(kid) ?? null;
  };
}

/** The fake: its own tokens only (lib/demo-signup.ts). Local runs and the demo E2E; never a host. */
export function fakeIdentityVerifier(): IdentityVerifier {
  return {
    async verify(idToken) {
      const identity = typeof idToken === 'string' ? readFakeIdToken(idToken) : null;
      if (!identity) throw new IdentityTokenError('malformed');
      return { uid: identity.uid, email: identity.email.toLowerCase() };
    },
  };
}
