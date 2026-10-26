import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCsp } from '../lib/csp';
import { proxy } from '../proxy';

/**
 * The judge demo's real sign-up (a hackathon exception, docs/deploy/demo.md) widens the CSP for
 * the Firebase JS SDK, and only on a demo deployment with UF_DEMO_SIGNUP=firebase: on every page
 * of it, since a click to the sign-up page keeps the policy of the page it started on (A5-28).
 * Every other deployment, the switch off, and every API response keep the policy exactly as it was.
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

describe('proxy: every page, only on a demo with the switch on', () => {
  afterEach(() => vi.unstubAllEnvs());

  function csp(path: string): string {
    const response = proxy(new NextRequest(`http://localhost:3000${path}`));
    return response.headers.get('content-security-policy') ?? '';
  }

  function stub(env: Record<string, string>) {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  }

  // A5-28 (Phase 6 audit): a click (next/link) to the sign-up page keeps the policy of the page it
  // started on, so the sources must be there already: every page of the demo while the switch is on.
  it.each(['/demo/sign-up', '/', '/demo', '/sign-in', '/home', '/onboarding'])(
    'widens %s, so a click to the sign-up page keeps Firebase’s sources',
    (path) => {
      stub(FIREBASE_ENV);
      expect(csp(path)).toContain('https://identitytoolkit.googleapis.com');
      expect(csp(path)).toContain('frame-src');
    },
  );

  it.each(['/demo/sign-up', '/'])(
    'leaves %s alone without the switch, on the fake, or outside a demo',
    (path) => {
      stub({ ...FIREBASE_ENV, UF_DEMO_SIGNUP: '' });
      expect(csp(path)).not.toContain('googleapis');
      vi.unstubAllEnvs();
      stub({ UF_DEPLOYMENT: 'demo', UF_DEMO_SIGNUP: 'fake' });
      expect(csp(path)).not.toContain('googleapis');
      vi.unstubAllEnvs();
      stub({ ...FIREBASE_ENV, UF_DEPLOYMENT: '' });
      expect(csp(path)).not.toContain('googleapis');
    },
  );
});
