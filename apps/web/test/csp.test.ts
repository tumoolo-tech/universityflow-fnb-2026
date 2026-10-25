import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCsp, newNonce, uploadOrigin } from '../lib/csp';
import nextConfig from '../next.config';
import { config, proxy } from '../proxy';

/** The directives of a policy, by name. */
function directives(csp: string): Map<string, string[]> {
  return new Map(
    csp.split(';').map((part) => {
      const [name = '', ...values] = part.trim().split(/\s+/);
      return [name, values];
    }),
  );
}

function scriptSrc(csp: string): string[] {
  return directives(csp).get('script-src') ?? [];
}

describe('buildCsp (audit finding 2)', () => {
  it('allows scripts only by nonce and strict-dynamic, never unsafe-inline', () => {
    const csp = buildCsp({ nonce: 'abc123==', dev: false });
    expect(scriptSrc(csp)).toEqual(["'self'", "'nonce-abc123=='", "'strict-dynamic'"]);
    expect(scriptSrc(csp)).not.toContain("'unsafe-inline'");
  });

  it('adds unsafe-eval in development only', () => {
    expect(scriptSrc(buildCsp({ nonce: 'n', dev: true }))).toContain("'unsafe-eval'");
    expect(scriptSrc(buildCsp({ nonce: 'n', dev: false }))).not.toContain("'unsafe-eval'");
  });

  it('allows no inline script at all without a nonce (API responses)', () => {
    expect(scriptSrc(buildCsp({ dev: false }))).toEqual(["'self'"]);
  });

  it('keeps every other directive of the previous policy', () => {
    const policy = directives(buildCsp({ nonce: 'n', dev: false }));
    expect(Object.fromEntries([...policy].filter(([name]) => name !== 'script-src'))).toEqual({
      'default-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'blob:'],
      'font-src': ["'self'"],
      'connect-src': ["'self'"],
      'media-src': ["'self'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
    });
  });
});

describe('uploadOrigin (direct-to-S3 uploads)', () => {
  it('adds nothing in local mode or without a bucket', () => {
    expect(uploadOrigin({})).toBeNull();
    expect(uploadOrigin({ UF_PROVIDERS: 'local', UF_S3_BUCKET: 'uf-docs' })).toBeNull();
    expect(uploadOrigin({ UF_PROVIDERS: 'live' })).toBeNull();
  });

  it('adds exactly the bucket, in af-south-1 unless a region is set', () => {
    expect(uploadOrigin({ UF_PROVIDERS: 'live', UF_S3_BUCKET: 'uf-docs' })).toBe(
      'https://uf-docs.s3.af-south-1.amazonaws.com',
    );
    const live = {
      UF_PROVIDERS: 'live',
      UF_S3_BUCKET: 'uf-docs',
      UF_S3_ENDPOINT: 'http://127.0.0.1:55491/x',
    };
    expect(uploadOrigin(live)).toBe('http://127.0.0.1:55491');
  });

  it('joins connect-src and nothing else', () => {
    const origin = 'https://uf-docs.s3.af-south-1.amazonaws.com';
    const policy = directives(buildCsp({ nonce: 'n', dev: false, uploadOrigin: origin }));
    expect(policy.get('connect-src')).toEqual(["'self'", origin]);
    const others = [...policy].filter(([name]) => name !== 'connect-src').flatMap(([, v]) => v);
    expect(others).not.toContain(origin);
  });
});

describe('newNonce', () => {
  it('is 128 random bits in base64, different every time', () => {
    const nonces = new Set(Array.from({ length: 1000 }, newNonce));
    expect(nonces.size).toBe(1000);
    for (const nonce of nonces) {
      expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
      expect(atob(nonce)).toHaveLength(16);
    }
  });
});

describe('proxy', () => {
  afterEach(() => vi.unstubAllEnvs());

  function run(init?: ConstructorParameters<typeof NextRequest>[1]) {
    const response = proxy(new NextRequest('http://localhost:3000/results', init));
    const csp = response.headers.get('content-security-policy') ?? '';
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
    return { response, csp, nonce };
  }

  it('sets a CSP with a fresh nonce on every response', () => {
    const first = run();
    const second = run();
    expect(first.nonce).toBeTruthy();
    expect(second.nonce).toBeTruthy();
    expect(first.nonce).not.toBe(second.nonce);
    expect(scriptSrc(first.csp)).not.toContain("'unsafe-inline'");
  });

  it('hands the nonce and the policy to rendering through the request headers', () => {
    const { response, csp, nonce } = run();
    const overridden = response.headers.get('x-middleware-override-headers')?.split(',') ?? [];
    expect(overridden).toEqual(expect.arrayContaining(['x-nonce', 'content-security-policy']));
    expect(response.headers.get('x-middleware-request-x-nonce')).toBe(nonce);
    expect(response.headers.get('x-middleware-request-content-security-policy')).toBe(csp);
  });

  it('ignores a nonce or policy the client sends', () => {
    const { response, nonce } = run({
      headers: {
        'x-nonce': 'attacker',
        'content-security-policy': "script-src 'nonce-attacker'",
      },
    });
    expect(nonce).not.toBe('attacker');
    expect(response.headers.get('x-middleware-request-x-nonce')).toBe(nonce);
    expect(response.headers.get('x-middleware-request-content-security-policy')).not.toContain(
      'attacker',
    );
  });

  it('hands rendering the page’s own path, never one the client sends (the demo banner reads it)', () => {
    const { response } = run({ headers: { 'x-uf-path': '/' } });
    expect(response.headers.get('x-middleware-request-x-uf-path')).toBe('/results');
  });

  it('allows unsafe-eval only under next dev', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(scriptSrc(run().csp)).not.toContain("'unsafe-eval'");
    vi.stubEnv('NODE_ENV', 'development');
    expect(scriptSrc(run().csp)).toContain("'unsafe-eval'");
  });

  it('runs on pages but not on API routes or static files', () => {
    const [source = ''] = config.matcher;
    const matches = (path: string) => new RegExp(`^${source}$`).test(path);
    for (const page of ['/', '/sign-in', '/results', '/consent/abc-123', '/applications/uj']) {
      expect(matches(page), page).toBe(true);
    }
    for (const path of [
      '/api/chat',
      '/api/documents/1',
      '/_next/static/chunks/main.js',
      '/_next/image',
      '/favicon.ico',
      '/robots.txt',
    ]) {
      expect(matches(path), path).toBe(false);
    }
  });
});

describe('next.config.ts headers', () => {
  it('sets no CSP on pages (the proxy owns it) and a nonce-free one on API routes', async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const cspFor = (source: string) =>
      rules
        .filter((rule) => rule.source === source)
        .flatMap((rule) => rule.headers)
        .filter((header) => header.key.toLowerCase() === 'content-security-policy');
    expect(cspFor('/:path*')).toEqual([]);
    const [api] = cspFor('/api/:path*');
    expect(api?.value).toBeDefined();
    expect(scriptSrc(api?.value ?? '')).not.toContain("'unsafe-inline'");
    expect(api?.value).not.toContain("'nonce-");
  });
});
