import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type {
  InboundChannel,
  InboundEvent,
  InboundRequest,
  InboundVerifier,
} from '@universityflow/messaging';
import { InvalidInboundError } from '@universityflow/messaging';
import type { InboundHarness } from '@universityflow/messaging/inbound-contract';

/**
 * A fake live provider's inbound webhooks (A5-02), shaped the way SMS gateways usually are and
 * deliberately unlike the stand-ins': a form-encoded body (`MessageId`, `From`, `Body`, or
 * `MessageId`, `Status` for a delivery report) and its own headers, a timestamp and a base64
 * HMAC over "<timestamp>:<channel>:<body>". It proves the route uses the live adapter's verifier,
 * and shows the shape a real adapter takes: verify, then map to our `InboundEvent`.
 */

export const FAKE_TIMESTAMP_HEADER = 'x-fake-timestamp';
export const FAKE_SIGNATURE_HEADER = 'x-fake-signature';
export const FAKE_TOLERANCE_MS = 3 * 60 * 1000;
export const FAKE_PROVIDER_SECRET = 'fake-provider-secret-for-tests-only-0001';

function mac(secret: string, timestamp: string, channel: string, body: string): Buffer {
  return createHmac('sha256', secret).update(`${timestamp}:${channel}:${body}`).digest();
}

export function fakeInboundVerifier(
  channel: InboundChannel,
  secret = FAKE_PROVIDER_SECRET,
): InboundVerifier {
  return {
    channel,
    replayWindowMs: 2 * FAKE_TOLERANCE_MS,
    verify(request, now) {
      const timestamp = request.headers.get(FAKE_TIMESTAMP_HEADER) ?? '';
      const signature = request.headers.get(FAKE_SIGNATURE_HEADER) ?? '';
      if (!/^\d{1,12}$/.test(timestamp) || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) return null;
      if (Math.abs(now.getTime() - Number(timestamp) * 1000) > FAKE_TOLERANCE_MS) return null;
      const expected = mac(secret, timestamp, channel, request.body);
      const given = Buffer.from(signature, 'base64');
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
      // The provider's message id (and, for a report, its status): the same notification
      // delivered twice is the same notification.
      const form = new URLSearchParams(request.body);
      const id = form.get('MessageId');
      return id ? { replayKey: `${channel}:${id}:${form.get('Status') ?? 'message'}` } : null;
    },
    parse(body) {
      const form = new URLSearchParams(body);
      const status = form.get('Status');
      const id = form.get('MessageId');
      if (status && id) {
        if (status === 'DELIVRD') return { type: 'status', receiptId: id, status: 'delivered' };
        if (status === 'UNDELIV') return { type: 'status', receiptId: id, status: 'failed' };
        throw new InvalidInboundError();
      }
      const from = form.get('From');
      const text = form.get('Body');
      if (from === null || text === null) throw new InvalidInboundError();
      return { type: 'message', from, text };
    },
  };
}

/** The body the fake provider posts for `event`. */
export function fakeProviderBody(event: InboundEvent, id: string = randomUUID()): string {
  if (event.type === 'status') {
    const status = event.status === 'delivered' ? 'DELIVRD' : 'UNDELIV';
    return new URLSearchParams({ MessageId: event.receiptId, Status: status }).toString();
  }
  return new URLSearchParams({ MessageId: id, From: event.from, Body: event.text }).toString();
}

/** The headers the fake provider sends with `body` to `channel`. */
export function fakeProviderHeaders(
  channel: InboundChannel,
  body: string,
  at: Date,
  secret = FAKE_PROVIDER_SECRET,
): Record<string, string> {
  const timestamp = String(Math.floor(at.getTime() / 1000));
  return {
    'content-type': 'application/x-www-form-urlencoded',
    [FAKE_TIMESTAMP_HEADER]: timestamp,
    [FAKE_SIGNATURE_HEADER]: mac(secret, timestamp, channel, body).toString('base64'),
  };
}

function asRequest(channel: InboundChannel, body: string, values: Record<string, string>) {
  return {
    url: `https://uf.example/api/messaging/${channel}/inbound`,
    headers: { get: (name: string) => values[name.toLowerCase()] ?? null },
    body,
  } satisfies InboundRequest;
}

/** The inbound contract's harness for the fake provider on `channel`. */
export function fakeInboundHarness(channel: InboundChannel, from: string): InboundHarness {
  return {
    verifier: fakeInboundVerifier(channel),
    from,
    request: (event, { at, channel: to = channel, id }) => {
      const body = fakeProviderBody(event, id);
      return asRequest(to, body, fakeProviderHeaders(to, body, at));
    },
    forged: (event, at) => {
      const body = fakeProviderBody(event);
      return asRequest(channel, body, fakeProviderHeaders(channel, body, at, `${'f'.repeat(40)}`));
    },
    unreadable: (at) => {
      const body = new URLSearchParams({ MessageId: randomUUID(), Event: 'typing' }).toString();
      return asRequest(channel, body, fakeProviderHeaders(channel, body, at));
    },
  };
}
