import { describe, expect, it, vi } from 'vitest';
import { DEMO_PERSONA_IDS } from '../lib/server/demo/types';
import { Browser } from './harness';

/**
 * Judge demo mode end to end through the route handlers, with the real seed (agent D2's
 * personas.ts) on a demo store: every learner starts in one press and is ready to use, the
 * seed's own sign-in (requestOtp, verifyOtp) works on a demo store, and nothing is ever sent.
 */

process.env['UF_DEPLOYMENT'] = 'demo';
process.env['UF_DEMO_PROJECT'] = '1';
process.env['AUTH_SECRET'] = 'demo-test-secret-that-is-long-enough-0123456789';

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

const routes = {
  start: (await import('../app/api/demo/start/route')).POST,
  me: (await import('../app/api/me/route')).GET,
  home: (await import('../app/api/home/route')).GET,
};
const { getServices } = await import('../lib/server/services');

describe('every demo learner, through POST /api/demo/start with the real seed', () => {
  it.each(DEMO_PERSONA_IDS.map((id, i) => [id, i] as const))(
    '%s starts, is ready, and its home loads; no SMS is sent',
    async (persona, i) => {
      const services = await getServices();
      const send = vi.spyOn(services.sms, 'send');
      const browser = new Browser();
      const started = await browser.json(routes.start, '/api/demo/start', {
        json: { persona },
        headers: { 'x-forwarded-for': `203.0.113.${200 + i}` },
      });
      expect(started.status).toBe(200);
      const me = await browser.json<{ ready: boolean }>(routes.me, '/api/me');
      expect(me.status).toBe(200);
      expect(me.body.ready).toBe(true);
      expect((await browser.call(routes.home, '/api/home')).status).toBe(200);
      expect(send).not.toHaveBeenCalled();
      expect(services.outbox).toBeNull();
      send.mockRestore();
    },
    120_000,
  );
});
