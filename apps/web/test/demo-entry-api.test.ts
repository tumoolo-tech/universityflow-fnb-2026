import { afterEach, describe, expect, it, vi } from 'vitest';
import { Browser } from './harness';

/**
 * When the server refuses its configuration (a ConfigError), the demo fails in a way the owner can
 * act on, without telling the public anything: every refused request logs one line with the
 * ConfigError's message (it names variables, never their values); a demo's API answers 503
 * `not-set-up`, which its pages explain; the picker's form post goes back to the picker, which
 * says the demo isn't set up yet. /api/health's body stays as it was. Production answers as
 * before (500 `server`). The services are never opened here: the configuration refuses first.
 */

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

const SECRET_LOOKING = 'short-not-32-chars';
const REFUSED_DEMO = {
  UF_DEPLOYMENT: 'demo',
  UF_DEMO_PROJECT: '1',
  AUTH_SECRET: SECRET_LOOKING,
};

const routes = {
  start: (await import('../app/api/demo/start/route')).POST,
  signUp: (await import('../app/api/demo/sign-up/route')).POST,
  switch: (await import('../app/api/demo/switch/route')).POST,
  me: (await import('../app/api/me/route')).GET,
  health: (await import('../app/api/health/route')).GET,
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function stub(env: Record<string, string>) {
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
}

function captureLog() {
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  return () => error.mock.calls.map((call) => call.map(String).join(' '));
}

const LINE = /ConfigError: AUTH_SECRET must be a long random value on a demo/;

describe('a demo whose configuration the server refuses', () => {
  it('the picker’s form post goes back to the picker, which says the demo isn’t set up', async () => {
    stub(REFUSED_DEMO);
    const lines = captureLog();
    const response = await new Browser().call(routes.start, '/api/demo/start', {
      body: new URLSearchParams({ persona: 'demo-grade-11' }),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(response.status).toBe(303);
    expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/demo');
    expect(new URL(response.headers.get('location') ?? '').searchParams.get('demo')).toBe('setup');
    expect(lines().join('\n')).toMatch(LINE);
  });

  it('the banner’s "Switch learner" form post goes back to the picker too', async () => {
    stub(REFUSED_DEMO);
    const lines = captureLog();
    const response = await new Browser().call(routes.switch, '/api/demo/switch', {
      method: 'POST',
      body: '',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toMatch(/\/demo\?demo=setup$/);
    expect(lines().join('\n')).toMatch(LINE);
  });

  it('a JSON start, the sign-up and any API answer 503 not-set-up, never a bare "server"', async () => {
    stub(REFUSED_DEMO);
    captureLog();
    const browser = new Browser();
    for (const [route, path, options] of [
      [routes.start, '/api/demo/start', { json: { persona: 'demo-grade-11' } }],
      [routes.signUp, '/api/demo/sign-up', { json: { idToken: 'x' } }],
      [routes.switch, '/api/demo/switch', { method: 'POST' }],
    ] as const) {
      const { status, body } = await browser.json(route, path, options);
      expect({ path, status, body }).toEqual({
        path,
        status: 503,
        body: { error: 'not-set-up', detail: null },
      });
    }
    // A signed-in page's API, with a session cookie the refused server can't read.
    browser.jar.set('uf_session', 'stale-token');
    const me = await browser.json(routes.me, '/api/me');
    expect(me).toEqual({ status: 503, body: { error: 'not-set-up', detail: null } });
  });

  it('every refused request logs one line naming why: variable names, never values', async () => {
    stub(REFUSED_DEMO);
    const lines = captureLog();
    await new Browser().call(routes.start, '/api/demo/start', { json: { persona: 'x' } });
    const logged = lines();
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatch(LINE);
    expect(logged.join('\n')).not.toContain(SECRET_LOOKING);
  });

  it('/api/health keeps its body (it says nothing), and the log says why', async () => {
    stub(REFUSED_DEMO);
    const lines = captureLog();
    const response = routes.health();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'unavailable' });
    expect(lines().join('\n')).toMatch(LINE);
  });
});

describe('production with a refused configuration', () => {
  const REFUSED_PRODUCTION = {
    UF_DEPLOYMENT: '',
    UF_DEMO_PROJECT: '',
    NODE_ENV: 'production',
    UF_LOCAL_PRODUCTION_BUILD: '',
    UF_PROVIDERS: 'local',
    AUTH_SECRET: 'production-secret-value-that-is-long-enough-0123',
  };

  it('answers as before (500 server), and the log now names why', async () => {
    stub(REFUSED_PRODUCTION);
    const lines = captureLog();
    const browser = new Browser();
    browser.jar.set('uf_session', 'stale-token');
    const me = await browser.json(routes.me, '/api/me');
    expect(me).toEqual({ status: 500, body: { error: 'server', detail: null } });
    const logged = lines().join('\n');
    expect(logged).toMatch(/ConfigError: Production must use live providers \(UF_PROVIDERS=live\)/);
    expect(logged).not.toContain(REFUSED_PRODUCTION.AUTH_SECRET);
  });

  it('the demo start route is still not a demo there: a JSON 500, no redirect to a picker', async () => {
    stub(REFUSED_PRODUCTION);
    captureLog();
    const response = await new Browser().call(routes.start, '/api/demo/start', {
      body: new URLSearchParams({ persona: 'demo-grade-11' }),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(response.status).toBe(500);
    expect(response.headers.get('location')).toBeNull();
  });
});
