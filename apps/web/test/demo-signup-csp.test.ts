import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCsp } from '../lib/csp';
import { proxy } from '../proxy';

/**
 * The judge demo's real sign-up (a hackathon exception, docs/deploy/demo.md) widens the CSP for
 * the Firebase JS SDK, and only: on a demo deployment, with UF_DEMO_SIGNUP=firebase, on the
 * sign-up page. Every other page, every other deployment and every API response keeps the policy
 * exactly as it was.
 */

function directives(csp: string): Map<string, string[]> {
  return new Map(
    csp.split(';').map((part) => {
      const [name = '', ...values] = part.trim().split(/\s+/);
      return [name, values];
    }),
  );
}

const FIREBASE_ENV = {
  UF_DEPLOYMENT: 'demo',
  UF_DEMO_SIGNUP: 'firebase',
  NEXT_PUBLIC_FIREBASE_API_KEY: `AIza${'x'.repeat(35)}`,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'uf-demo-test.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'uf-demo-test',
};

describe('buildCsp with the Firebase sources', () => {
  it('adds Firebase’s two APIs, the auth domain’s frame and Google’s script loader, nothing else', () => {
    const plain = directives(buildCsp({ nonce: 'n', dev: false }));
    const wide = directives(
      buildCsp({ nonce: 'n', dev: false, firebaseAuthDomain: 'uf-demo-test.firebaseapp.com' }),
    );
    expect(wide.get('connect-src')).toEqual([
      "'self'",
      'https://identitytoolkit.googleapis.com',
      'https://securetoken.googleapis.com',
    ]);
    expect(wide.get('frame-src')).toEqual(["'self'", 'https://uf-demo-test.firebaseapp.com']);
    expect(wide.get('script-src')).toEqual([
      "'self'",
      "'nonce-n'",
      "'strict-dynamic'",
      'https://apis.google.com',
    ]);
    for (const [name, values] of plain) {
      if (!['connect-src', 'script-src'].includes(name)) expect(wide.get(name)).toEqual(values);
    }
    expect(plain.has('frame-src')).toBe(false);
  });
});

describe('proxy: the sign-up page only, on a demo with the switch on', () => {
  afterEach(() => vi.unstubAllEnvs());

  function csp(path: string): string {
    const response = proxy(new NextRequest(`http://localhost:3000${path}`));
    return response.headers.get('content-security-policy') ?? '';
  }

  function stub(env: Record<string, string>) {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  }

  it('widens the sign-up page', () => {
    stub(FIREBASE_ENV);
    expect(csp('/demo/sign-up')).toContain('https://identitytoolkit.googleapis.com');
    expect(csp('/demo/sign-up')).toContain('frame-src');
  });

  it.each(['/', '/home', '/sign-in', '/demo', '/onboarding', '/demo/sign-up/x'])(
    'leaves %s as it was',
    (path) => {
      stub(FIREBASE_ENV);
      expect(csp(path)).not.toContain('googleapis');
      expect(csp(path)).not.toContain('frame-src');
    },
  );

  it('leaves the sign-up page alone without the switch, on the fake, or outside a demo', () => {
    stub({ ...FIREBASE_ENV, UF_DEMO_SIGNUP: '' });
    expect(csp('/demo/sign-up')).not.toContain('googleapis');
    vi.unstubAllEnvs();
    stub({ UF_DEPLOYMENT: 'demo', UF_DEMO_SIGNUP: 'fake' });
    expect(csp('/demo/sign-up')).not.toContain('googleapis');
    vi.unstubAllEnvs();
    stub({ ...FIREBASE_ENV, UF_DEPLOYMENT: '' });
    expect(csp('/demo/sign-up')).not.toContain('googleapis');
  });
});
