import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import type { WrittenCare } from '@/lib/server/plan-care';
import { agreeAsAdult } from './adult-consent';
import { Browser } from './harness';

/**
 * D9 (docs/design/plan-maps-proposal.md §5.1, approved 2026-10-23): the profile's "goal in their
 * words" is free text that reaches the AI's context, and it was never read by the crisis check:
 * only the chat and inbound SMS/WhatsApp were. Now a save of it gets the same check as a plan map
 * part: the words are saved anyway, the answer carries `care`, and nothing about it is logged.
 */

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-10-13T08:00:00Z'));
afterAll(() => {
  vi.useRealTimers();
});
afterEach(() => {
  vi.restoreAllMocks();
});

const routes = {
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  dob: (await import('../app/api/me/date-of-birth/route')).POST,
  outbox: (await import('../app/api/dev/outbox/route')).GET,
  me: await import('../app/api/me/route'),
};

let n = 4_300_000;
const phone = () => `082${String(n++).padStart(7, '0')}`;

async function adult() {
  const number = phone();
  const browser = new Browser();
  await browser.json(routes.requestPin, '/api/auth/request-pin', { json: { phone: number } });
  const { body } = await new Browser().json<{ messages: Array<{ to: string; body: string }> }>(
    routes.outbox,
    '/api/dev/outbox',
  );
  const pin = body.messages
    .findLast((m) => m.to === `+27${number.slice(1)}`)
    ?.body.match(/\b(\d{6})\b/)?.[1];
  await browser.json(routes.verifyPin, '/api/auth/verify-pin', { json: { phone: number, pin } });
  await browser.json(routes.dob, '/api/me/date-of-birth', { json: { dateOfBirth: '2000-02-02' } });
  await agreeAsAdult(browser);
  return browser;
}

const patch = (browser: Browser, json: unknown) =>
  browser.json<{ profile: { goal: string | null }; care: WrittenCare | null }>(
    routes.me.PATCH,
    '/api/me',
    { method: 'PATCH', json },
  );

describe('the profile goal in the learner’s words is crisis-checked (D9)', () => {
  it('saves the goal, answers with the crisis card, and logs nothing about it', async () => {
    const browser = await adult();
    const logged: unknown[] = [];
    for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        logged.push(args);
      });
    }
    const goal = 'Engineering at UJ, and honestly I want to die if I don’t get in';
    const crisis = await patch(browser, { goal });
    expect(crisis.status).toBe(200);
    expect(crisis.body.profile.goal).toBe(goal);
    expect(crisis.body.care?.level).toBe('crisis');
    expect(crisis.body.care && 'card' in crisis.body.care && crisis.body.care.card.kind).toBe(
      'crisis-card',
    );
    expect(JSON.stringify(logged)).not.toMatch(/die|crisis|distress/i);
  });

  it('an ordinary goal, or a save without one, gets no care', async () => {
    const browser = await adult();
    expect((await patch(browser, { goal: 'BSc Computer Science at Wits' })).body.care).toBeNull();
    expect((await patch(browser, { displayName: 'Synthetic' })).body.care).toBeNull();
    expect(
      (await patch(browser, { goal: 'I killed it in maths, so engineering' })).body.care,
    ).toBeNull();
  });
});
