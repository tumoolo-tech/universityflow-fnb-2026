import { expect, it } from 'vitest';
import { InvalidSmsError, type SmsSender } from './sms';

/**
 * The contract every SMS provider meets. The local stand-in runs it now; the real provider runs
 * the same suite when the owner connects it (D8), so the stand-in can't promise what the
 * provider doesn't do.
 */
export function smsContract(make: () => SmsSender, phone: string): void {
  it('accepts a South African number and returns a receipt id', async () => {
    const receipt = await make().send({ to: phone, body: 'Your UniversityFlow PIN is 123456' });
    expect(receipt.id).toMatch(/\S/);
  });

  it('refuses a number outside South Africa', async () => {
    await expect(make().send({ to: '+441234567890', body: 'x' })).rejects.toThrow(InvalidSmsError);
  });

  it('refuses an empty or over-long message', async () => {
    await expect(make().send({ to: phone, body: '  ' })).rejects.toThrow(InvalidSmsError);
    await expect(make().send({ to: phone, body: 'x'.repeat(481) })).rejects.toThrow(
      InvalidSmsError,
    );
  });
}
