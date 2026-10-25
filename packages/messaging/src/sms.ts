/**
 * Sending an SMS, behind an interface (decision D8). The real provider is chosen in Phase 4 and
 * connected by the owner; until then the app runs against `MemoryOutbox`, which keeps messages
 * in memory so local development and tests can read the PIN a learner would have received.
 *
 * Nothing here logs a message: SMS bodies carry PINs and links (hard rule 4).
 */

import { GSM7_PART, SMS_MAX_SEGMENTS, smsSegments } from './sms-encoding';

export interface SmsMessage {
  /** E.164, e.g. +27… */
  readonly to: string;
  readonly body: string;
}

export interface SmsReceipt {
  readonly id: string;
}

export interface SmsSender {
  send(message: SmsMessage): Promise<SmsReceipt>;
}

export class InvalidSmsError extends Error {
  override readonly name = 'InvalidSmsError';
}

/**
 * The longest SMS in characters: three concatenated GSM-7 segments of 153. The real cap is
 * `SMS_MAX_SEGMENTS` by encoding (A1-14): a UCS-2 text reaches it at 201 characters.
 */
export const SMS_MAX_LENGTH = SMS_MAX_SEGMENTS * GSM7_PART;

export function validateSms(message: SmsMessage): void {
  if (!/^\+27\d{9}$/.test(message.to)) throw new InvalidSmsError('Not a South African number');
  if (message.body.trim().length === 0) throw new InvalidSmsError('Empty message');
  if (smsSegments(message.body) > SMS_MAX_SEGMENTS) {
    throw new InvalidSmsError('Message too long');
  }
}

/** The local stand-in: keeps what would have been sent. */
export class MemoryOutbox implements SmsSender {
  readonly #sent: Array<SmsMessage & { id: string; at: Date }> = [];
  #next = 1;

  async send(message: SmsMessage): Promise<SmsReceipt> {
    validateSms(message);
    const id = `local-${this.#next++}`;
    this.#sent.push({ ...message, id, at: new Date() });
    return { id };
  }

  /** Messages sent to a number, newest first. */
  to(phone: string): ReadonlyArray<SmsMessage & { id: string; at: Date }> {
    return this.#sent.filter((m) => m.to === phone).reverse();
  }

  all(): ReadonlyArray<SmsMessage & { id: string; at: Date }> {
    return [...this.#sent].reverse();
  }

  clear(): void {
    this.#sent.length = 0;
  }
}
