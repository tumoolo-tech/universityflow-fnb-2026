import { generateKeyPairSync, type KeyObject, sign } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { FAKE_ID_TOKEN_PREFIX, mintFakeIdToken } from '../lib/demo-signup';
import {
  fakeIdentityVerifier,
  firebaseIdTokenVerifier,
  googleSecureTokenKeys,
  IdentityTokenError,
  SECURETOKEN_CERTS_URL,
} from '../lib/server/demo/identity';
import { identityVerifierContract } from './identity-contract';

/**
 * The judge demo's real sign-up (docs/deploy/demo.md, a hackathon exception): the server verifies
 * a Firebase ID token itself, as Firebase documents ("Verify ID tokens using a third-party JWT
 * library"): RS256, signed by one of Google's published securetoken keys (by `kid`), `aud` the
 * project id, `iss` https://securetoken.google.com/<project id>, `exp` in the future, `iat` and
 * `auth_time` in the past, `sub` the uid. Plus a verified email. No service-account secret.
 */

const PROJECT = 'uf-demo-test';
const NOW = new Date('2026-10-23T08:00:00Z');
const nowS = Math.floor(NOW.getTime() / 1000);

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = generateKeyPairSync('rsa', { modulusLength: 2048 });

const b64url = (value: string | Buffer) => Buffer.from(value).toString('base64url');

function token(
  claims: Record<string, unknown> = {},
  header: Record<string, unknown> = {},
  key: KeyObject = privateKey,
): string {
  const head = b64url(JSON.stringify({ alg: 'RS256', kid: 'kid-1', typ: 'JWT', ...header }));
  const body = b64url(
    JSON.stringify({
      iss: `https://securetoken.google.com/${PROJECT}`,
      aud: PROJECT,
      auth_time: nowS - 60,
      user_id: 'uid-abc',
      sub: 'uid-abc',
      iat: nowS - 60,
      exp: nowS + 3000,
      email: 'judge@example.com',
      email_verified: true,
      firebase: { identities: {}, sign_in_provider: 'google.com' },
      ...claims,
    }),
  );
  const signature = sign('RSA-SHA256', Buffer.from(`${head}.${body}`), key);
  return `${head}.${body}.${b64url(signature)}`;
}

function verifier(keys = async (kid: string) => (kid === 'kid-1' ? publicKey : null)) {
  return firebaseIdTokenVerifier({ projectId: PROJECT, keys, now: () => NOW });
}

async function reason(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof IdentityTokenError) return error.reason;
    throw error;
  }
  throw new Error('expected a refusal');
}

describe('firebaseIdTokenVerifier', () => {
  it('accepts a good token: the uid and the email, nothing else', async () => {
    expect(await verifier().verify(token())).toEqual({
      uid: 'uid-abc',
      email: 'judge@example.com',
    });
  });

  it('lower-cases the email', async () => {
    const identity = await verifier().verify(token({ email: 'Judge@Example.COM' }));
    expect(identity.email).toBe('judge@example.com');
  });

  it('refuses an expired token', async () => {
    expect(await reason(verifier().verify(token({ exp: nowS - 1 })))).toBe('expired');
  });

  it('refuses a token issued in the future, beyond a minute of clock skew', async () => {
    expect(await reason(verifier().verify(token({ iat: nowS + 120 })))).toBe('issued-at');
    expect(await verifier().verify(token({ iat: nowS + 30 }))).toBeTruthy();
  });

  it('refuses a sign-in time in the future', async () => {
    expect(await reason(verifier().verify(token({ auth_time: nowS + 120 })))).toBe('auth-time');
    expect(await reason(verifier().verify(token({ auth_time: undefined })))).toBe('auth-time');
  });

  it('refuses another project (wrong aud)', async () => {
    expect(await reason(verifier().verify(token({ aud: 'someone-else' })))).toBe('audience');
  });

  it('refuses the wrong issuer', async () => {
    const iss = 'https://securetoken.google.com/someone-else';
    expect(await reason(verifier().verify(token({ iss })))).toBe('issuer');
    expect(await reason(verifier().verify(token({ iss: 'https://evil.example' })))).toBe('issuer');
  });

  it('refuses a bad signature (signed by another key)', async () => {
    expect(await reason(verifier().verify(token({}, {}, other.privateKey)))).toBe('signature');
  });

  it('refuses a token whose claims were changed after signing', async () => {
    const [head, , sig] = token().split('.');
    const forged = b64url(JSON.stringify({ sub: 'someone-else', aud: PROJECT }));
    expect(await reason(verifier().verify(`${head}.${forged}.${sig}`))).toBe('signature');
  });

  it('refuses an unknown key id', async () => {
    expect(await reason(verifier().verify(token({}, { kid: 'kid-unknown' })))).toBe('unknown-key');
    expect(await reason(verifier().verify(token({}, { kid: undefined })))).toBe('unknown-key');
  });

  it('refuses any algorithm but RS256 ("none" and HS256 included)', async () => {
    expect(await reason(verifier().verify(token({}, { alg: 'none' })))).toBe('algorithm');
    expect(await reason(verifier().verify(token({}, { alg: 'HS256' })))).toBe('algorithm');
  });

  it('refuses an unverified email, and a token without one', async () => {
    expect(await reason(verifier().verify(token({ email_verified: false })))).toBe(
      'email-unverified',
    );
    expect(await reason(verifier().verify(token({ email_verified: undefined })))).toBe(
      'email-unverified',
    );
    expect(await reason(verifier().verify(token({ email: undefined })))).toBe('email');
  });

  it('refuses an empty or over-long subject (the uid)', async () => {
    expect(await reason(verifier().verify(token({ sub: '' })))).toBe('subject');
    expect(await reason(verifier().verify(token({ sub: 'x'.repeat(129) })))).toBe('subject');
  });

  it('refuses tokens that are not three base64url parts of JSON', async () => {
    for (const bad of ['', 'abc', 'a.b', 'a.b.c', `${b64url('{')}.${b64url('{}')}.x`]) {
      expect(await reason(verifier().verify(bad))).toBe('malformed');
    }
  });

  it('says only "keys-unavailable" when Google’s keys cannot be fetched', async () => {
    const failing = verifier(async () => {
      throw new Error('network down');
    });
    expect(await reason(failing.verify(token()))).toBe('keys-unavailable');
  });

  it('never puts the token, the uid or the email in an error message', async () => {
    const t = token({ exp: nowS - 1 });
    try {
      await verifier().verify(t);
    } catch (error) {
      const text = `${(error as Error).message} ${String(error)}`;
      expect(text).not.toContain('uid-abc');
      expect(text).not.toContain('judge@example.com');
      expect(text).not.toContain(t.slice(0, 20));
    }
  });
});

/** One of Google's published securetoken certificates (public; fetched 2026-10-23). */
const GOOGLE_CERT = `-----BEGIN CERTIFICATE-----
MIIDHTCCAgWgAwIBAgIJAPQVm4IqLvDqMA0GCSqGSIb3DQEBBQUAMDExLzAtBgNV
BAMMJnNlY3VyZXRva2VuLnN5c3RlbS5nc2VydmljZWFjY291bnQuY29tMB4XDTI2
MDUwNDE3NDcyN1oXDTI3MDUwNDE3NDcyN1owMTEvMC0GA1UEAwwmc2VjdXJldG9r
ZW4uc3lzdGVtLmdzZXJ2aWNlYWNjb3VudC5jb20wggEiMA0GCSqGSIb3DQEBAQUA
A4IBDwAwggEKAoIBAQDbarTg+wH+qOjVtOp2l9eZ/dQ44/QYWK9jw1NfcHxxMzWB
XEcvhuknDbQuuXZrl8m147XNsozHdQpKFgpCUHmWAiBK0OH1BK4u23m9UJYUUgh0
dbWyybvrbYXmpFP3vf4kbFUss8+QmU6OipuBrBDtDQwolkzwIHCh6nCgK/iWgwGe
VCGtCobowe/kvWLUPn/LWd44guhtsU8J+jF07ReDW8Yqp5TSiF1xTtXchPU5njle
TOewIR99UKb3VbCaNa5GtmHXEndmzLl64efQQ8Hrw+xR7XVKlmw0yzN8HVYJvuW4
Np17eL+7wrZrNrF/CcRSqbV5LTut70JBA6cpjvDHAgMBAAGjODA2MAwGA1UdEwEB
/wQCMAAwDgYDVR0PAQH/BAQDAgeAMBYGA1UdJQEB/wQMMAoGCCsGAQUFBwMCMA0G
CSqGSIb3DQEBBQUAA4IBAQA8NOsYc/660OW3xD6OtitVuJFAMzH2s0v+NBQtTDJR
kCo6b5k8KcmTYlg5bAL633rHEa9a/H/IhCqPqcv/sGItxerKLFlj6L+snVO7KEPl
WEf/uue+VCrdnoMJVxMBaWwq+vNYKxStmfz7shCVYHMdCzJe1qaQZg30k4jzlQsZ
sUNb/wTL8QX6x3BrtOGcIuOS9HktjH2DRAVj6rGdppsMjLlm7OSj4TgDOa6CTDFf
hkk19L0pJisQ7CNr08Uln/REr4o2BQyivMFMtn3ILdIo7+XglfCYU+3XkiwfxHAC
WBhhKkORTkkH0OooaINjnBhGmDEJXGFIhNuuFmm+VbQ3
-----END CERTIFICATE-----
`;

describe('googleSecureTokenKeys', () => {
  function serving(body: unknown, cacheControl = 'public, max-age=19212') {
    return vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          headers: { 'content-type': 'application/json', 'cache-control': cacheControl },
        }),
    );
  }

  it('reads Google’s published certificates, by key id, as RSA public keys', async () => {
    const fetcher = serving({ 'google-kid': GOOGLE_CERT });
    const keys = googleSecureTokenKeys({ fetch: fetcher, now: () => NOW });
    const key = await keys('google-kid');
    expect(key?.type).toBe('public');
    expect(key?.asymmetricKeyType).toBe('rsa');
    expect(fetcher).toHaveBeenCalledWith(SECURETOKEN_CERTS_URL, expect.anything());
    expect(SECURETOKEN_CERTS_URL).toBe(
      'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
    );
  });

  it('keeps them as long as Cache-Control says, then fetches again', async () => {
    let now = NOW;
    const fetcher = serving({ 'google-kid': GOOGLE_CERT }, 'public, max-age=100');
    const keys = googleSecureTokenKeys({ fetch: fetcher, now: () => now });
    await keys('google-kid');
    await keys('google-kid');
    expect(fetcher).toHaveBeenCalledTimes(1);
    now = new Date(NOW.getTime() + 101_000);
    await keys('google-kid');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('answers null for a key id Google does not publish (fetching again at most once a minute)', async () => {
    const fetcher = serving({ 'google-kid': GOOGLE_CERT });
    const keys = googleSecureTokenKeys({ fetch: fetcher, now: () => NOW });
    expect(await keys('missing')).toBeNull();
    expect(await keys('missing')).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('throws when Google answers with an error', async () => {
    const keys = googleSecureTokenKeys({
      fetch: vi.fn(async () => new Response('nope', { status: 500 })),
      now: () => NOW,
    });
    await expect(keys('google-kid')).rejects.toThrow();
  });
});

describe('the fake verifier (local runs and the demo E2E only)', () => {
  it('accepts only its own tokens', async () => {
    const fake = fakeIdentityVerifier();
    const who = { uid: 'fake-uid', email: 'fake@example.com' };
    const minted = mintFakeIdToken(who);
    expect(minted.startsWith(FAKE_ID_TOKEN_PREFIX)).toBe(true);
    expect(await fake.verify(minted)).toEqual(who);
    expect(await reason(fake.verify(token()))).toBe('malformed');
  });
});

identityVerifierContract('firebase', async () => ({
  verifier: verifier(),
  mint: async ({ uid, email }) => token({ sub: uid, user_id: uid, email }),
}));

identityVerifierContract('fake', async () => ({
  verifier: fakeIdentityVerifier(),
  mint: async (identity) => mintFakeIdToken(identity),
}));
