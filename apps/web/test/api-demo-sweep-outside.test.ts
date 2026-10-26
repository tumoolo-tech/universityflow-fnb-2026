import { describe, expect, it, vi } from 'vitest';
import { Browser } from './harness';

/**
 * A11-61: outside a judge demo the scheduled sweep's route is not there (404), whatever the
 * bearer: the sweep exists only on a demo (`requireDemo`), and the secret is checked after that,
 * so nothing about it can be probed on another deployment. (CRON_SECRET itself is refused outside
 * a demo by readConfig: demo-sweep-config.test.ts.)
 */

delete process.env['UF_DEPLOYMENT'];
delete process.env['CRON_SECRET'];

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

const sweep = (await import('../app/api/demo/sweep/route')).GET;
const { getServices } = await import('../lib/server/services');

describe('GET /api/demo/sweep outside a demo', () => {
  it('answers 404 with the right secret, the wrong one and none, and sweeps nothing', async () => {
    const { store } = await getServices();
    const copies = vi.spyOn(store, 'sweepDemoStudents');
    const marks = vi.spyOn(store, 'deleteExpiredModuleMarks');
    for (const bearer of [`cron-test-${'o'.repeat(32)}`, 'wrong', undefined]) {
      const response = await new Browser().call(sweep, '/api/demo/sweep', {
        method: 'GET',
        origin: null,
        ...(bearer === undefined ? {} : { bearer }),
      });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'not-found', detail: null });
    }
    expect(copies).not.toHaveBeenCalled();
    expect(marks).not.toHaveBeenCalled();
  });
});
