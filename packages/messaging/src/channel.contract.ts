import { expect, it } from 'vitest';
import {
  ChannelSendError,
  DeliveryUnconfirmedError,
  FreeFormNotAllowedError,
  InvalidMessageError,
  type MessageChannel,
  RecipientOptedOutError,
  WHATSAPP_WINDOW_MS,
} from './channel';

/**
 * The contract every channel meets (planning.md §11, Phase 4 tests): the SMS, WhatsApp and push
 * stand-ins run it now, and each live adapter runs the same suite when the owner connects it
 * (D8), so a stand-in can't promise what the provider doesn't do.
 */
export interface ChannelHarness {
  readonly channel: MessageChannel;
  /** An address the gate allows. */
  readonly address: string;
  /** A second allowed address. */
  readonly other: string;
  /** A string that is not an address on this channel. */
  readonly badAddress: string;
  /** Opts `address` out, as STOP would. */
  optOut(address: string): void;
  /** Makes the provider fail the next send, before it takes the message (an outage, a refusal). */
  failNextSend(): void;
  /**
   * Makes the provider take the next message and then fail the call, as a timeout or a dropped
   * connection after the request went out would: the message is delivered, the caller can't know.
   */
  acceptThenFailNextSend(): void;
  /** How many messages actually reached the provider. */
  delivered(): number;
  now(): Date;
  advance(ms: number): void;
}

export function channelContract(make: () => ChannelHarness | Promise<ChannelHarness>): void {
  const send = (h: ChannelHarness, to = h.address) =>
    h.channel.send({ to, template: 'reminder.check-in', variables: {} });

  it('sends a template and returns a receipt, accepted until the provider reports more', async () => {
    const h = await make();
    const receipt = await send(h);
    expect(receipt.id).toMatch(/\S/);
    expect(receipt.channel).toBe(h.channel.name);
    expect(await h.channel.status(receipt.id)).toBe('accepted');
    expect(h.delivered()).toBe(1);

    expect(await h.channel.recordStatus(receipt.id, 'delivered')).toBe(true);
    expect(await h.channel.status(receipt.id)).toBe('delivered');
  });

  it('gives every message its own receipt, and knows none it never issued', async () => {
    const h = await make();
    const a = await send(h);
    const b = await send(h, h.other);
    expect(a.id).not.toBe(b.id);
    expect(await h.channel.status('never-issued')).toBeNull();
    expect(await h.channel.recordStatus('never-issued', 'delivered')).toBe(false);
  });

  it('reports a provider failure as a retryable ChannelSendError, with no receipt', async () => {
    const h = await make();
    h.failNextSend();
    await expect(send(h)).rejects.toThrow(ChannelSendError);
    expect(h.delivered()).toBe(0);
    // The provider is back: the next send goes.
    await send(h);
    expect(h.delivered()).toBe(1);
  });

  it('A12-06: reports a message the provider may have taken as unconfirmed, never as retryable', async () => {
    const h = await make();
    h.acceptThenFailNextSend();
    const error = await send(h).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DeliveryUnconfirmedError);
    expect(error).not.toBeInstanceOf(ChannelSendError);
    expect(h.delivered()).toBe(1);
  });

  it('A12-06: delivers one reference to one address at most once, and returns the first receipt', async () => {
    const h = await make();
    const reference = 'a3f1c2d4-0000-4000-8000-000000000001';
    const message = {
      template: 'reminder.check-in' as const,
      variables: {},
      reference,
    };
    const first = await h.channel.send({ to: h.address, ...message });
    const again = await h.channel.send({ to: h.address, ...message });
    expect(again.id).toBe(first.id);
    expect(h.delivered()).toBe(1);
    // The same reference to another address (a second phone) is another message.
    await h.channel.send({ to: h.other, ...message });
    expect(h.delivered()).toBe(2);
    // No reference: every send is its own message.
    await send(h);
    await send(h);
    expect(h.delivered()).toBe(4);

    // A send whose outcome is unknown is never repeated under its reference either.
    const unsure = { ...message, reference: 'a3f1c2d4-0000-4000-8000-000000000002' };
    h.acceptThenFailNextSend();
    await expect(h.channel.send({ to: h.address, ...unsure })).rejects.toThrow(
      DeliveryUnconfirmedError,
    );
    await expect(h.channel.send({ to: h.address, ...unsure })).rejects.toThrow(
      DeliveryUnconfirmedError,
    );
    expect(h.delivered()).toBe(5);
    // One that certainly failed may be sent again.
    const failed = { ...message, reference: 'a3f1c2d4-0000-4000-8000-000000000003' };
    h.failNextSend();
    await expect(h.channel.send({ to: h.address, ...failed })).rejects.toThrow(ChannelSendError);
    await h.channel.send({ to: h.address, ...failed });
    expect(h.delivered()).toBe(6);
  });

  it('A12-06: refuses a reference that is not an id, so nothing personal rides along (hard rule 4)', async () => {
    const h = await make();
    for (const reference of ['', 'call me on 082', h.address, 'x'.repeat(101)]) {
      await expect(
        h.channel.send({ to: h.address, template: 'reminder.check-in', variables: {}, reference }),
      ).rejects.toThrow(InvalidMessageError);
    }
    expect(h.delivered()).toBe(0);
  });

  it('refuses a recipient who opted out, and nothing reaches the provider', async () => {
    const h = await make();
    h.optOut(h.address);
    await expect(send(h)).rejects.toThrow(RecipientOptedOutError);
    await expect(h.channel.noteInbound(h.address, h.now())).resolves.toBeUndefined();
    await expect(h.channel.sendText({ to: h.address, text: 'Hello' })).rejects.toThrow(
      RecipientOptedOutError,
    );
    expect(h.delivered()).toBe(0);
    // Others still get theirs.
    await send(h, h.other);
    expect(h.delivered()).toBe(1);
  });

  it('refuses a malformed address, an unknown template and a bad variable, before any lookup', async () => {
    const h = await make();
    await expect(send(h, h.badAddress)).rejects.toThrow(InvalidMessageError);
    await expect(
      h.channel.send({ to: h.address, template: 'nope' as 'reminder.check-in', variables: {} }),
    ).rejects.toThrow(InvalidMessageError);
    await expect(
      h.channel.send({ to: h.address, template: 'reminder.study', variables: {} }),
    ).rejects.toThrow(InvalidMessageError);
    expect(h.delivered()).toBe(0);
  });

  it('sends templates at any time, and free-form text only where the channel allows it', async () => {
    const h = await make();
    if (!h.channel.templateOnlyOutsideWindow) {
      expect(await h.channel.freeFormAllowed(h.address, h.now())).toBe(true);
      await h.channel.sendText({ to: h.address, text: 'A reply' });
      expect(h.delivered()).toBe(1);
      return;
    }
    // WhatsApp: no message from the learner yet, so templates only.
    expect(await h.channel.freeFormAllowed(h.address, h.now())).toBe(false);
    await expect(h.channel.sendText({ to: h.address, text: 'A reply' })).rejects.toThrow(
      FreeFormNotAllowedError,
    );
    await send(h);
    // The learner writes: a 24-hour window opens, for them only.
    await h.channel.noteInbound(h.address, h.now());
    expect(await h.channel.freeFormAllowed(h.address, h.now())).toBe(true);
    expect(await h.channel.freeFormAllowed(h.other, h.now())).toBe(false);
    await h.channel.sendText({ to: h.address, text: 'A reply' });
    h.advance(WHATSAPP_WINDOW_MS - 1);
    expect(await h.channel.freeFormAllowed(h.address, h.now())).toBe(true);
    h.advance(1);
    expect(await h.channel.freeFormAllowed(h.address, h.now())).toBe(false);
    await expect(h.channel.sendText({ to: h.address, text: 'Late' })).rejects.toThrow(
      FreeFormNotAllowedError,
    );
    expect(h.delivered()).toBe(2);
  });

  it(`holds every message to the channel's length limit`, async () => {
    const h = await make();
    await h.channel.noteInbound(h.address, h.now());
    expect(h.channel.maxLength).toBeGreaterThanOrEqual(160);
    await h.channel.sendText({ to: h.address, text: 'x'.repeat(h.channel.maxLength) });
    await expect(
      h.channel.sendText({ to: h.address, text: 'x'.repeat(h.channel.maxLength + 1) }),
    ).rejects.toThrow(InvalidMessageError);
    await expect(h.channel.sendText({ to: h.address, text: '   ' })).rejects.toThrow(
      InvalidMessageError,
    );
    expect(h.delivered()).toBe(1);
  });

  it('A5-04: sends one message to several addresses, each once, each with its own outcome', async () => {
    const h = await make();
    h.optOut(h.other);
    const message = {
      template: 'reminder.check-in' as const,
      variables: {},
      reference: 'a3f1c2d4-0000-4000-8000-000000000010',
    };
    const outcomes = await h.channel.sendMany({
      to: [h.address, h.other, h.badAddress, h.address],
      ...message,
    });
    expect(outcomes.map((o) => o.to)).toEqual([h.address, h.other, h.badAddress]);
    const [sent, optedOut, bad] = outcomes;
    if (!sent || !('receipt' in sent)) throw new Error('expected a receipt');
    expect(await h.channel.status(sent.receipt.id)).toBe('accepted');
    expect(optedOut && 'error' in optedOut ? optedOut.error : null).toBeInstanceOf(
      RecipientOptedOutError,
    );
    expect(bad && 'error' in bad ? bad.error : null).toBeInstanceOf(InvalidMessageError);
    expect(h.delivered()).toBe(1);
    // The same reference again: nothing new goes out, and the first receipt comes back.
    const [again] = await h.channel.sendMany({ to: [h.address], ...message });
    expect(again && 'receipt' in again ? again.receipt.id : null).toBe(sent.receipt.id);
    expect(h.delivered()).toBe(1);
    expect(await h.channel.sendMany({ to: [], ...message })).toEqual([]);
  });

  it('A5-04: in sendMany, a provider failure is retryable, a maybe-sent is unconfirmed, and a bad message refuses the whole call', async () => {
    const h = await make();
    const message = { template: 'reminder.check-in' as const, variables: {} };
    h.failNextSend();
    const [failed] = await h.channel.sendMany({ to: [h.address], ...message });
    expect(failed && 'error' in failed ? failed.error : null).toBeInstanceOf(ChannelSendError);
    h.acceptThenFailNextSend();
    const [unsure] = await h.channel.sendMany({ to: [h.address], ...message });
    expect(unsure && 'error' in unsure ? unsure.error : null).toBeInstanceOf(
      DeliveryUnconfirmedError,
    );
    expect(h.delivered()).toBe(1);
    await expect(
      h.channel.sendMany({ to: [h.address], template: 'reminder.study', variables: {} }),
    ).rejects.toThrow(InvalidMessageError);
    expect(h.delivered()).toBe(1);
  });

  it('A12-12: answers a message just received, even from someone who has just said STOP, and nothing else gets through', async () => {
    const h = await make();
    // STOP arrived a moment ago: the learner is opted out, and their message opened the window.
    const receivedAt = h.now();
    h.optOut(h.address);
    await h.channel.noteInbound(h.address, receivedAt);
    h.advance(1000);
    const receipt = await h.channel.sendReply({
      to: h.address,
      text: 'You will get no more messages here.',
      receivedAt,
    });
    expect(receipt.channel).toBe(h.channel.name);
    expect(await h.channel.status(receipt.id)).toBe('accepted');
    expect(h.delivered()).toBe(1);
    // The reply is the only exception: a template or free-form text is still refused.
    await expect(send(h)).rejects.toThrow(RecipientOptedOutError);
    await expect(h.channel.sendText({ to: h.address, text: 'Hello' })).rejects.toThrow(
      RecipientOptedOutError,
    );
    expect(h.delivered()).toBe(1);
  });

  it('A12-12: a reply answers only a message received inside the window, at a real address, in the length limit', async () => {
    const h = await make();
    const receivedAt = h.now();
    const reply = (text: string, at = receivedAt, to = h.address) =>
      h.channel.sendReply({ to, text, receivedAt: at });
    // Long after the message, or before it came: not a reply.
    h.advance(WHATSAPP_WINDOW_MS);
    await expect(reply('Late')).rejects.toThrow(FreeFormNotAllowedError);
    await expect(reply('Early', new Date(h.now().getTime() + 60_000))).rejects.toThrow(
      FreeFormNotAllowedError,
    );
    const fresh = h.now();
    await expect(reply('Hi', fresh, h.badAddress)).rejects.toThrow(InvalidMessageError);
    await expect(reply('   ', fresh)).rejects.toThrow(InvalidMessageError);
    await expect(reply('x'.repeat(h.channel.maxLength + 1), fresh)).rejects.toThrow(
      InvalidMessageError,
    );
    expect(h.delivered()).toBe(0);
    await reply('x'.repeat(h.channel.maxLength), fresh);
    expect(h.delivered()).toBe(1);
  });

  it('never repeats an address or a message in an error (hard rule 4)', async () => {
    const h = await make();
    const errors: unknown[] = [];
    await send(h, h.badAddress).catch((e) => errors.push(e));
    h.optOut(h.address);
    await send(h).catch((e) => errors.push(e));
    await h.channel
      .sendText({ to: h.other, text: `secret ${'x'.repeat(h.channel.maxLength)}` })
      .catch((e) => errors.push(e));
    expect(errors).toHaveLength(3);
    for (const error of errors) {
      const text = `${String(error)} ${(error as Error).message}`;
      expect(text).not.toContain(h.address);
      expect(text).not.toContain(h.other);
      expect(text).not.toContain(h.badAddress);
      expect(text).not.toContain('secret');
    }
  });
}
