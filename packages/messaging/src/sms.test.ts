import { describe, expect, it } from 'vitest';
import { InvalidSmsError, MemoryOutbox, validateSms } from './sms';
import { smsContract } from './sms.contract';

// Synthetic number, built at runtime (hard rule 4).
const PHONE = `+2782${'0000123'}`;

describe('MemoryOutbox meets the SMS contract', () => {
  smsContract(() => new MemoryOutbox(), PHONE);
});

describe('validateSms caps by segments, not characters (A1-14)', () => {
  it('refuses a UCS-2 text over three segments, though far under 480 characters', () => {
    expect(() => validateSms({ to: PHONE, body: 'ŋ'.repeat(201) })).not.toThrow();
    expect(() => validateSms({ to: PHONE, body: 'ŋ'.repeat(202) })).toThrow(InvalidSmsError);
  });

  it('takes three full GSM-7 segments and not a character more', () => {
    expect(() => validateSms({ to: PHONE, body: 'x'.repeat(459) })).not.toThrow();
    expect(() => validateSms({ to: PHONE, body: 'x'.repeat(460) })).toThrow(InvalidSmsError);
  });
});

describe('MemoryOutbox', () => {
  it('keeps what was sent, newest first, per number', async () => {
    const outbox = new MemoryOutbox();
    await outbox.send({ to: PHONE, body: 'first' });
    await outbox.send({ to: PHONE, body: 'second' });
    expect(outbox.to(PHONE).map((m) => m.body)).toEqual(['second', 'first']);
    expect(outbox.all()).toHaveLength(2);
    outbox.clear();
    expect(outbox.all()).toHaveLength(0);
  });
});
