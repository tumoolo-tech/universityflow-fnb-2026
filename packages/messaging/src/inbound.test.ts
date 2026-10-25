import { randomUUID } from 'node:crypto';
import { messageText } from '@universityflow/content';
import { describe, expect, it } from 'vitest';
import {
  checkInboundEvent,
  type InboundChannel,
  type InboundEvent,
  InvalidInboundError,
  signedWebhookInbound,
} from './inbound';
import { type InboundHarness, inboundContract } from './inbound.contract';
import { isStopMessage } from './stop';
import { SIGNATURE_HEADER, signWebhook } from './webhook';

const SECRET = 'test-webhook-secret-that-is-long-enough';
// A synthetic number, built at runtime (hard rule 4).
const FROM = `+2782${'0000321'}`;

function headers(values: Record<string, string>) {
  return { get: (name: string) => values[name.toLowerCase()] ?? null };
}

function standIn(channel: InboundChannel): InboundHarness {
  const signed = (secret: string, body: string, at: Date, signedFor: InboundChannel = channel) => ({
    url: `http://localhost/api/messaging/${signedFor}/inbound`,
    headers: headers({ [SIGNATURE_HEADER]: signWebhook(secret, signedFor, body, at) }),
    body,
  });
  const body = (event: InboundEvent, id: string = randomUUID()) => JSON.stringify({ ...event, id });
  return {
    verifier: signedWebhookInbound(SECRET, channel),
    from: FROM,
    request: (event, { at, channel: to, id }) => signed(SECRET, body(event, id), at, to),
    forged: (event, at) => signed(`${SECRET}-forged`, body(event), at),
    unreadable: (at) => signed(SECRET, JSON.stringify({ type: 'typing', from: FROM }), at),
  };
}

describe('the stand-in SMS webhook meets the inbound contract (A5-02)', () => {
  inboundContract(() => standIn('sms'));
});

describe('the stand-in WhatsApp webhook meets the inbound contract (A5-02)', () => {
  inboundContract(() => standIn('whatsapp'));
});

describe('signedWebhookInbound', () => {
  it('refuses a short secret', () => {
    expect(() => signedWebhookInbound('short', 'sms')).toThrow(/at least 32/);
  });

  it('reads the body with or without a message id, and refuses an id that is not one', () => {
    const verifier = signedWebhookInbound(SECRET, 'sms');
    const stop = { type: 'message', from: FROM, text: 'STOP' };
    expect(verifier.parse(JSON.stringify(stop))).toEqual(stop);
    expect(verifier.parse(JSON.stringify({ ...stop, id: 'abc-1' }))).toEqual(stop);
    for (const id of [5, '', 'call me on 082', 'x'.repeat(101)]) {
      expect(() => verifier.parse(JSON.stringify({ ...stop, id }))).toThrow(InvalidInboundError);
    }
    expect(() => verifier.parse('{not json')).toThrow(InvalidInboundError);
  });
});

describe('checkInboundEvent', () => {
  it('accepts a message and a delivery report, exactly', () => {
    expect(checkInboundEvent({ type: 'message', from: FROM, text: 'hi' })).toEqual({
      type: 'message',
      from: FROM,
      text: 'hi',
    });
    expect(checkInboundEvent({ type: 'status', receiptId: 'r1', status: 'failed' })).toEqual({
      type: 'status',
      receiptId: 'r1',
      status: 'failed',
    });
  });

  it('A12-09: a delivery report may carry the category the provider billed, marketing included', () => {
    for (const category of ['utility', 'marketing'] as const) {
      expect(
        checkInboundEvent({ type: 'status', receiptId: 'r1', status: 'delivered', category }),
      ).toEqual({ type: 'status', receiptId: 'r1', status: 'delivered', category });
    }
  });

  it('A12-10: the WhatsApp "Stop" quick-reply button is heard as STOP', () => {
    // A tapped quick reply arrives as a message whose text is the button's.
    expect(isStopMessage(messageText.whatsappStopButton)).toBe(true);
  });

  it.each([
    [
      'a category Meta bills that we never ask for',
      {
        type: 'status',
        receiptId: 'r1',
        status: 'delivered',
        category: 'authentication',
      },
    ],
    ['not an object', 'STOP'],
    ['an array', [FROM]],
    ['an unknown type', { type: 'typing' }],
    ['a number outside South Africa', { type: 'message', from: '+441234567890', text: 'x' }],
    ['text that is too long', { type: 'message', from: FROM, text: 'x'.repeat(4097) }],
    ['an extra field', { type: 'message', from: FROM, text: 'x', name: 'Ayanda' }],
    ['an empty receipt', { type: 'status', receiptId: '', status: 'delivered' }],
    ['an unknown status', { type: 'status', receiptId: 'r1', status: 'accepted' }],
  ])('refuses %s, without repeating it', (_label, value) => {
    const error = (() => {
      try {
        checkInboundEvent(value);
      } catch (e) {
        return e;
      }
      return null;
    })();
    expect(error).toBeInstanceOf(InvalidInboundError);
    expect((error as Error).message).not.toContain(FROM.slice(3));
  });
});
