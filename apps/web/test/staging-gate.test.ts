import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { deploy } from '@universityflow/content';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import './harness';
import { ConfigError, readConfig } from '../lib/server/config';
import { proxy } from '../proxy';

/**
 * A5-10 / A11-28 (audit S1-A8, A8-06): a staging site's /dev/outbox shows every PIN and guardian
 * link, so the whole site sits behind an access gate: HTTP Basic against UF_STAGING_PASSWORD,
 * checked in proxy.ts for pages and in `handler()` for every API route. /api/health stays open
 * for Render's probe. Staging refuses to start without a password of at least 16 characters.
 */

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

const PASSWORD = 'staging-test-password-0123';
const basic = (password: string, user = 'tester') => `Basic ${btoa(`${user}:${password}`)}`;

const routes = {
  // Declared without parameters, but Next always passes the request, as here.
  outbox: (await import('../app/api/dev/outbox/route')).GET as unknown as (
    request: Request,
  ) => Promise<Response>,
  jobsRun: (await import('../app/api/dev/jobs/run/route')).POST,
  health: (await import('../app/api/health/route')).GET,
};

function stage(password: string = PASSWORD) {
  vi.stubEnv('UF_DEPLOYMENT', 'staging');
  vi.stubEnv('AUTH_SECRET', 'g'.repeat(44));
  vi.stubEnv('UF_STAGING_PASSWORD', password);
}

beforeEach(() => {
  stage();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const page = (path: string, authorization?: string) =>
  proxy(
    new NextRequest(`http://localhost:3000${path}`, {
      headers: authorization ? { authorization } : {},
    }),
  );
const api = (path: string, authorization?: string, method = 'GET') =>
  new Request(`http://localhost:3000${path}`, {
    method,
    headers: { origin: 'http://localhost:3000', ...(authorization ? { authorization } : {}) },
  });

describe('the staging access gate: pages (proxy.ts)', () => {
  it.each(['/', '/sign-in', '/dev/outbox', '/home'])('%s without the password is 401', (path) => {
    const response = page(path);
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toMatch(
      /^Basic realm="UniversityFlow staging"/,
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('a wrong password is 401', () => {
    expect(page('/dev/outbox', basic('not-the-password-at-all')).status).toBe(401);
    expect(page('/dev/outbox', 'Bearer whatever').status).toBe(401);
  });

  it('the right password goes through, with the CSP as before', () => {
    const response = page('/dev/outbox', basic(PASSWORD));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-security-policy')).toMatch(/nonce-/);
  });

  it('is not there outside staging', () => {
    vi.stubEnv('UF_DEPLOYMENT', '');
    expect(page('/dev/outbox').status).toBe(200);
  });

  it('fails closed (503) on a staging site with no password, never open', async () => {
    stage('');
    const response = page('/');
    expect(response.status).toBe(503);
    expect(await response.text()).toBe(deploy.stagingGateUnavailable);
  });
});

describe('the staging access gate: API routes (handler)', () => {
  it('GET /api/dev/outbox without the password is 401, with it 200', async () => {
    const shut = await routes.outbox(api('/api/dev/outbox'));
    expect(shut.status).toBe(401);
    expect(await shut.text()).toBe(deploy.stagingGateRequired);
    const open = await routes.outbox(api('/api/dev/outbox', basic(PASSWORD)));
    expect(open.status).toBe(200);
  });

  it('POST /api/dev/jobs/run without the password is 401', async () => {
    expect((await routes.jobsRun(api('/api/dev/jobs/run', undefined, 'POST'))).status).toBe(401);
  });

  it('GET /api/health stays open for the host’s probe', async () => {
    const response = routes.health();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('every API route but /api/health is wrapped in handler(), so none skips the gate', () => {
    const root = join(import.meta.dirname, '../app/api');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (name === 'route.ts') files.push(path);
      }
    };
    walk(root);
    expect(files.length).toBeGreaterThan(40);
    for (const file of files) {
      if (file.includes(join('api', 'health'))) continue;
      const source = readFileSync(file, 'utf8');
      const methods = [
        ...source.matchAll(
          /export\s+(?:const|async function|function)\s+(GET|POST|PUT|PATCH|DELETE)\b(.{0,12})/g,
        ),
      ];
      expect(methods.length, file).toBeGreaterThan(0);
      for (const m of methods) expect(m[2], `${file} ${m[1]}`).toMatch(/^\s*=\s*handler\(/);
    }
  });
});

describe('readConfig: staging needs its access gate', () => {
  const STAGING = {
    NODE_ENV: 'production',
    RENDER: 'true',
    UF_DEPLOYMENT: 'staging',
    UF_PROVIDERS: 'local',
    AUTH_SECRET: 's'.repeat(44),
  };

  it('refuses to start without UF_STAGING_PASSWORD, or with one under 16 characters', () => {
    expect(() => readConfig(STAGING)).toThrow(ConfigError);
    expect(() => readConfig(STAGING)).toThrow(/UF_STAGING_PASSWORD/);
    expect(() => readConfig({ ...STAGING, UF_STAGING_PASSWORD: 'short-password' })).toThrow(
      /UF_STAGING_PASSWORD/,
    );
    expect(readConfig({ ...STAGING, UF_STAGING_PASSWORD: PASSWORD }).staging).toBe(true);
  });
});
