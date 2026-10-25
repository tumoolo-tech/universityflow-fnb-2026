import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../app/api/health/route';

/**
 * `GET /api/health` (docs/deploy/README.md): what a host's health check calls (render.yaml's
 * `healthCheckPath`). It says only whether this deployment's configuration would start: never
 * an error message, a variable, the database's contents or anything about a learner.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /api/health', () => {
  it('answers 200 and nothing else when the configuration starts', async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('answers 503 when the configuration would refuse to start, without saying why', async () => {
    // Staging with live providers is refused (config.ts): the host keeps the last good deploy.
    vi.stubEnv('UF_DEPLOYMENT', 'staging');
    vi.stubEnv('UF_PROVIDERS', 'live');
    vi.stubEnv('AUTH_SECRET', 'h'.repeat(44));
    const response = GET();
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ status: 'unavailable' });
    expect(text).not.toMatch(/staging|UF_|AUTH_SECRET|synthetic/i);
  });

  it('never carries the database URL or a secret', async () => {
    vi.stubEnv('DATABASE_URL', 'pglite:./.data/health-test');
    vi.stubEnv('AUTH_SECRET', 'secret-value-for-the-health-test-only-0123456789');
    const text = await GET().text();
    expect(text).not.toContain('pglite');
    expect(text).not.toContain('secret-value');
  });
});
