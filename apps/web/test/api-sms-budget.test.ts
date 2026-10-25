import { en } from '@universityflow/content';
import { OTP_PER_IP_PER_HOUR, OTP_REFUNDS_PER_HOUR } from '@universityflow/db';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, errorMessage } from '../lib/client/api';
import { Browser } from './harness';
import { expectNoPhoneNumber } from './no-phone';

/**
 * The global SMS budget (open finding 1) over the real request-pin route: a tiny budget, so the
 * route can be seen failing closed with a safe message.
 */

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

// Read when the services are first created, after the harness has set the rest.
process.env['UF_SMS_BUDGET_PER_HOUR'] = '3';
process.env['UF_SMS_BUDGET_PER_DAY'] = '3';

const routes = {
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  outbox: (await import('../app/api/dev/outbox/route')).GET,
};

let n = 4_000_000;
/** A synthetic number, built at runtime (hard rule 4). */
const phone = () => `082${String(n++).padStart(7, '0')}`;

describe('request-pin when the global SMS budget is spent', () => {
  it('fails closed across different numbers, with a safe sentence from packages/content', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (let i = 0; i < 3; i++) {
      const sent = await new Browser().json(routes.requestPin, '/api/auth/request-pin', {
        json: { phone: phone() },
      });
      expect(sent.status).toBe(200);
    }

    const refused = await new Browser().json<{ error: string; detail: string | null }>(
      routes.requestPin,
      '/api/auth/request-pin',
      { json: { phone: phone() } },
    );
    expect(refused).toEqual({ status: 503, body: { error: 'sms-unavailable', detail: null } });
    // What the learner reads: from packages/content, and it doesn't blame their number.
    const sentence = errorMessage(new ApiError(503, refused.body.error, refused.body.detail));
    expect(sentence).toBe(en.errors.smsUnavailable);

    // Nothing more was sent, and the alert logged counts only (hard rule 4).
    const { body } = await new Browser().json<{ messages: unknown[] }>(
      routes.outbox,
      '/api/dev/outbox',
    );
    expect(body.messages).toHaveLength(3);
    expect(warn).toHaveBeenCalledWith('sms-auth budget exhausted: 3/3 in the last hour');
    expectNoPhoneNumber(JSON.stringify(warn.mock.calls));
    warn.mockRestore();
  });

  // A1-11: the budget refused the SMS, so the PIN never went out.
  it("doesn't spend the learner's allowance or leave a usable PIN", async () => {
    const browser = new Browser();
    const number = phone();
    const first = await browser.json(routes.requestPin, '/api/auth/request-pin', {
      json: { phone: number },
    });
    expect(first).toMatchObject({ status: 503, body: { error: 'sms-unavailable' } });
    // Asking again at once is refused for the budget, not for the one-a-minute limit.
    const again = await browser.json(routes.requestPin, '/api/auth/request-pin', {
      json: { phone: number },
    });
    expect(again).toMatchObject({ status: 503, body: { error: 'sms-unavailable' } });
    // No PIN is waiting: any guess finds nothing to check against.
    const guess = await browser.json(routes.verifyPin, '/api/auth/verify-pin', {
      json: { phone: number, pin: '123456' },
    });
    expect(guess).toMatchObject({ status: 400, body: { error: 'expired' } });
  });

  it('still holds the per-number limit under repeated failures', async () => {
    const browser = new Browser();
    const number = phone();
    const statuses: number[] = [];
    for (let i = 0; i < OTP_REFUNDS_PER_HOUR + 2; i++) {
      statuses.push(
        (
          await browser.json(routes.requestPin, '/api/auth/request-pin', {
            json: { phone: number },
          })
        ).status,
      );
    }
    // Refunded a few times, then a failure counts as a send, and one a minute applies.
    expect(statuses).toEqual([...Array(OTP_REFUNDS_PER_HOUR + 1).fill(503), 429]);
  });

  it('still holds the per-IP limit under repeated failures', async () => {
    const ip = { 'x-forwarded-for': '198.51.100.23' };
    const statuses: number[] = [];
    for (let i = 0; i < OTP_PER_IP_PER_HOUR + 1; i++) {
      statuses.push(
        (
          await new Browser().json(routes.requestPin, '/api/auth/request-pin', {
            json: { phone: phone() },
            headers: ip,
          })
        ).status,
      );
    }
    expect(statuses).toEqual([...Array(OTP_PER_IP_PER_HOUR).fill(503), 429]);
  });
});
