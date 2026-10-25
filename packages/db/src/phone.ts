/**
 * South African cellphone numbers, normalised to E.164 (+27XXXXXXXXX) so "082 123 4567",
 * "0821234567" and "+27 82 123 4567" are one account. Only mobile prefixes are accepted: the
 * number receives a one-time PIN by SMS.
 */
const MOBILE = /^(?:6\d|7[1-9]|8[1-4])\d{7}$/;

export class InvalidPhoneError extends Error {
  override readonly name = 'InvalidPhoneError';
}

/** The national part (no leading 0 or +27) of a number in any common form. */
function nationalPart(input: string): string {
  const digits = input.replace(/[\s\-()]/g, '');
  return digits.startsWith('+27')
    ? digits.slice(3)
    : digits.startsWith('27') && digits.length === 11
      ? digits.slice(2)
      : digits.startsWith('0')
        ? digits.slice(1)
        : digits;
}

export function normalisePhone(input: string): string {
  const national = nationalPart(input);
  if (!MOBILE.test(national)) throw new InvalidPhoneError('Not a South African cellphone number');
  return `+27${national}`;
}

/**
 * South African toll-free numbers (080x xxx xxx), never anyone's cellphone. The judge demo's
 * on-screen sign-up (a hackathon exception, 2026-10-24, docs/deploy/demo.md) takes only these, so
 * a judge's made-up number can never be a real person's phone. Only a store built for a demo
 * accepts one (`Store` option `demo`).
 */
const TOLL_FREE = /^80\d{7}$/;

export function normaliseTollFree(input: string): string {
  const national = nationalPart(input);
  if (!TOLL_FREE.test(national)) throw new InvalidPhoneError('Not a toll-free (080) number');
  return `+27${national}`;
}

export function isTollFreeNumber(input: string): boolean {
  return TOLL_FREE.test(nationalPart(input));
}

/** The last three digits, for messages that must identify a number without revealing it. */
export function maskPhone(e164: string): string {
  return `•••• ••• ${e164.slice(-3)}`;
}
