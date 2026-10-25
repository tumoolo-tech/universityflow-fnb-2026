import { describe, expect, it } from 'vitest';
import { expectNoPhoneNumber } from './no-phone';

describe('expectNoPhoneNumber', () => {
  it('passes an ID whose last group holds nine digits in a row', () => {
    // The UUID from the failing run of api-review.test.ts.
    expect(() =>
      expectNoPhoneNumber('store-review sign-in: student edc1b475-0333-4658-9f17-63330718761a'),
    ).not.toThrow();
  });

  it('still fails on a phone number, alone or next to an ID', () => {
    // Obviously fake numbers (no mobile prefix), so the no-real-pii guard passes them.
    expect(() => expectNoPhoneNumber('sent to 0800000001')).toThrow();
    expect(() => expectNoPhoneNumber('+27800000001')).toThrow();
    expect(() =>
      expectNoPhoneNumber('student edc1b475-0333-4658-9f17-63330718761a phone 800000001'),
    ).toThrow();
  });
});
