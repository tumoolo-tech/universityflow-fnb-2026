import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { Browser } from './harness';

/**
 * A1-22: the review number goes through the same SMS budget gate as every number. Before, once the
 * global budget was spent, it was the only number still answering 200: an oracle for finding it
 * in a list of candidates. It still spends nothing (api-review.test.ts proves that).
 */

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

const SECRET = 'review-budget-test-secret-long-enough-for-hmac';
let n = 6_500_000;
/** Synthetic numbers, built at runtime (hard rule 4). */
const phone = () => `082${String(n++).padStart(7, '0')}`;
const REVIEW_PHONE = phone();
const inAWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
process.env['AUTH_SECRET'] = SECRET;
process.env['UF_REVIEW_PHONE'] = REVIEW_PHONE;
process.env['UF_REVIEW_PIN_HASH'] = createHmac('sha256', SECRET)
  .update(`+27${REVIEW_PHONE.slice(1)}:246810`)
  .digest('hex');
process.env['UF_REVIEW_UNTIL'] = inAWeek;
process.env['UF_SMS_BUDGET_PER_HOUR'] = '1';
process.env['UF_SMS_BUDGET_PER_DAY'] = '1';

const requestPin = (await import('../app/api/auth/request-pin/route')).POST;
const verifyPin = (await import('../app/api/auth/verify-pin/route')).POST;
const { getServices } = await import('../lib/server/services');

describe('the review number and the global SMS budget (A1-22)', () => {
  it('answers 503 like every other number once the budget is spent, and leaves no usable PIN', async () => {
    await (await getServices()).store.seedReviewAccount(REVIEW_PHONE);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const ask = (p: string) =>
      new Browser().json(requestPin, '/api/auth/request-pin', { json: { phone: p } });
    expect((await ask(phone())).status).toBe(200);
    const statuses = [];
    for (const c of [phone(), phone(), REVIEW_PHONE, phone()]) statuses.push((await ask(c)).status);
    expect(statuses).toEqual([503, 503, 503, 503]);
    // As for anyone whose SMS failed, the PIN was taken back: nothing to verify against.
    const tried = await new Browser().json(verifyPin, '/api/auth/verify-pin', {
      json: { phone: REVIEW_PHONE, pin: '246810' },
    });
    expect(tried).toMatchObject({ status: 400, body: { error: 'expired' } });
    warn.mockRestore();
  });
});
