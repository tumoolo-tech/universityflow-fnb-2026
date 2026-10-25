import { expect, it } from 'vitest';
import {
  checkInboundEvent,
  type InboundChannel,
  type InboundEvent,
  type InboundRequest,
  type InboundVerifier,
  InvalidInboundError,
} from './inbound';

/**
 * The contract every inbound verifier meets (A5-02, A5-06): the stand-ins' signed webhooks run it
 * now, and each live SMS or WhatsApp adapter runs the same suite before it is listed (D8), so a
 * learner's STOP is heard in production exactly as it is here.
 */
export interface InboundHarness {
  readonly verifier: InboundVerifier;
  /** A synthetic South African number (hard rule 4). */
  readonly from: string;
  /**
   * The request the provider sends for `event`, signed at `at`, to `channel` (by default the
   * verifier's own). `id` is the provider's message id; by default a fresh one each call.
   */
  request(
    event: InboundEvent,
    options: { readonly at: Date; readonly channel?: InboundChannel; readonly id?: string },
  ): InboundRequest;
  /** The same request, signed with a key that is not the provider's. */
  forged(event: InboundEvent, at: Date): InboundRequest;
  /** A request the provider signed whose body is neither a message nor a delivery report. */
  unreadable(at: Date): InboundRequest;
}

const AT = new Date('2026-10-14T16:00:00Z');
const later = (ms: number) => new Date(AT.getTime() + ms);

export function inboundContract(make: () => InboundHarness | Promise<InboundHarness>): void {
  const stop = (h: InboundHarness): InboundEvent => ({
    type: 'message',
    from: h.from,
    text: 'STOP',
  });

  it('verifies a fresh, signed STOP and reads it as a message from that number', async () => {
    const h = await make();
    const request = h.request(stop(h), { at: AT });
    const verified = h.verifier.verify(request, AT);
    expect(verified).not.toBeNull();
    const event = checkInboundEvent(h.verifier.parse(request.body));
    expect(event).toEqual({ type: 'message', from: h.from, text: 'STOP' });
  });

  it('reads a delivery report', async () => {
    const h = await make();
    const report: InboundEvent = { type: 'status', receiptId: 'receipt-0001', status: 'delivered' };
    const request = h.request(report, { at: AT });
    expect(h.verifier.verify(request, AT)).not.toBeNull();
    expect(checkInboundEvent(h.verifier.parse(request.body))).toEqual(report);
  });

  it('refuses an unsigned, forged or altered request', async () => {
    const h = await make();
    const request = h.request(stop(h), { at: AT });
    const empty = { get: () => null };
    expect(h.verifier.verify({ ...request, headers: empty }, AT)).toBeNull();
    expect(h.verifier.verify(h.forged(stop(h), AT), AT)).toBeNull();
    const reply = h.request({ type: 'message', from: h.from, text: 'HELLO' }, { at: AT });
    expect(reply.body).toContain('HELLO');
    // A reply turned into STOP after signing.
    expect(
      h.verifier.verify({ ...reply, body: reply.body.replace('HELLO', 'STOP') }, AT),
    ).toBeNull();
  });

  it('A5-06: refuses a request signed for the other channel', async () => {
    const h = await make();
    const other: InboundChannel = h.verifier.channel === 'sms' ? 'whatsapp' : 'sms';
    expect(h.verifier.verify(h.request(stop(h), { at: AT, channel: other }), AT)).toBeNull();
  });

  it('A5-06: refuses a stale request, or one from the future, outside its replay window', async () => {
    const h = await make();
    const request = h.request(stop(h), { at: AT });
    const half = h.verifier.replayWindowMs / 2;
    expect(h.verifier.replayWindowMs).toBeGreaterThan(0);
    expect(h.verifier.replayWindowMs).toBeLessThanOrEqual(60 * 60 * 1000);
    expect(h.verifier.verify(request, later(half + 1000))).toBeNull();
    expect(h.verifier.verify(request, later(-half - 1000))).toBeNull();
  });

  it('A5-06: gives the same request the same replay key, and two messages two keys', async () => {
    const h = await make();
    const request = h.request(stop(h), { at: AT, id: 'provider-id-1' });
    const first = h.verifier.verify(request, AT);
    const again = h.verifier.verify(request, later(1000));
    expect(first?.replayKey).toMatch(/\S/);
    expect(again?.replayKey).toBe(first?.replayKey);
    // The same words from the same number in the same second are still two messages.
    const twin = h.verifier.verify(h.request(stop(h), { at: AT, id: 'provider-id-2' }), AT);
    expect(twin?.replayKey).toMatch(/\S/);
    expect(twin?.replayKey).not.toBe(first?.replayKey);
    // Nothing personal in it (hard rule 4).
    expect(first?.replayKey).not.toContain(h.from.slice(3));
  });

  it('reads nothing but a message or a report, and never repeats the body in the error', async () => {
    const h = await make();
    const request = h.unreadable(AT);
    expect(h.verifier.verify(request, AT)).not.toBeNull();
    const error = (() => {
      try {
        h.verifier.parse(request.body);
      } catch (e) {
        return e;
      }
      return null;
    })();
    expect(error).toBeInstanceOf(InvalidInboundError);
    expect(String((error as Error).message)).not.toContain(h.from.slice(3));
  });

  it('never throws while verifying, whatever arrives', async () => {
    const h = await make();
    const request = h.request(stop(h), { at: AT });
    const junk = { get: () => 'x'.repeat(5000) };
    expect(h.verifier.verify({ ...request, headers: junk }, AT)).toBeNull();
    expect(h.verifier.verify({ ...request, body: '' }, AT)).toBeNull();
  });
}
