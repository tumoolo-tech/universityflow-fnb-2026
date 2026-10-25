import {
  en,
  MESSAGE_TEMPLATE_IDS,
  type MessageTemplateId,
  messageTemplate,
  TEMPLATE_VARIABLE_MAX_LENGTH,
  type TemplateVariable,
} from '@universityflow/content';
import { describe, expect, it } from 'vitest';
import { SmsBudgetExceededError } from './budget';
import {
  ChannelSendError,
  InvalidMessageError,
  MessageNotSentError,
  type RecipientGate,
} from './channel';
import { type ChannelHarness, channelContract } from './channel.contract';
import { MemoryPushChannel, MemoryWhatsAppChannel, SmsChannel } from './channels';
import {
  InvalidSmsError,
  MemoryOutbox,
  type SmsMessage,
  type SmsReceipt,
  type SmsSender,
} from './sms';
import { isGsm7, smsSegments, smsSize } from './sms-encoding';

// Synthetic numbers and tokens, built at runtime (hard rule 4).
const phone = (n: number) => `+2782${String(n).padStart(7, '0')}`;
const token = (n: number) => `ExponentPushToken[test${String(n).padStart(8, '0')}]`;

function gateAndClock() {
  const optedOut = new Set<string>();
  const gate: RecipientGate = async (_channel, to) => !optedOut.has(to);
  let now = new Date('2026-10-13T08:00:00Z');
  return {
    optedOut,
    gate,
    clock: () => now,
    advance(ms: number) {
      now = new Date(now.getTime() + ms);
    },
  };
}

/** An SmsSender that can be told to fail, over the outbox. */
class FlakySender implements SmsSender {
  failures = 0;
  acceptThenFail = 0;
  constructor(readonly inner: MemoryOutbox) {}
  async send(message: SmsMessage): Promise<SmsReceipt> {
    if (this.failures > 0) {
      this.failures -= 1;
      // The provider answered: it did not take the message.
      throw new MessageNotSentError('provider outage');
    }
    const receipt = await this.inner.send(message);
    if (this.acceptThenFail > 0) {
      this.acceptThenFail -= 1;
      // It took the message, then the connection dropped: whatever a live adapter can't classify.
      throw new Error('socket hang up');
    }
    return receipt;
  }
}

describe('SmsChannel over the local outbox', () => {
  channelContract((): ChannelHarness => {
    const g = gateAndClock();
    const outbox = new MemoryOutbox();
    const sender = new FlakySender(outbox);
    return {
      channel: new SmsChannel(sender, { gate: g.gate, clock: g.clock }),
      address: phone(1),
      other: phone(2),
      badAddress: '+441234567890',
      optOut: (a) => g.optedOut.add(a),
      failNextSend: () => {
        sender.failures = 1;
      },
      acceptThenFailNextSend: () => {
        sender.acceptThenFail = 1;
      },
      delivered: () => outbox.all().length,
      now: g.clock,
      advance: g.advance,
    };
  });

  it('puts the rendered template in the outbox', async () => {
    const g = gateAndClock();
    const outbox = new MemoryOutbox();
    const channel = new SmsChannel(outbox, { gate: g.gate });
    await channel.send({
      to: phone(3),
      template: 'reminder.study',
      variables: { subjectName: 'Physical Sciences' },
    });
    // The subject is checked, never shown (A11-02); every SMS says how to stop (A12-10).
    expect(outbox.to(phone(3))[0]?.body).toBe(
      "UniversityFlow: this is the study reminder you asked for. Time for a little practice today. You've got this. Reply STOP to stop.",
    );
  });

  it('A12-06: a spent SMS budget is not sent (retryable); a sender refusing the message is invalid', async () => {
    const g = gateAndClock();
    const refusing = (error: Error): SmsSender => ({
      send: async () => {
        throw error;
      },
    });
    const send = (sender: SmsSender) =>
      new SmsChannel(sender, { gate: g.gate }).send({
        to: phone(4),
        template: 'reminder.check-in',
        variables: {},
      });
    await expect(send(refusing(new SmsBudgetExceededError('day')))).rejects.toThrow(
      ChannelSendError,
    );
    await expect(send(refusing(new InvalidSmsError('Message too long')))).rejects.toThrow(
      InvalidMessageError,
    );
  });

  it('A12-06: remembers a reference for a day, then lets it go', async () => {
    const g = gateAndClock();
    const outbox = new MemoryOutbox();
    const channel = new SmsChannel(outbox, { gate: g.gate, clock: g.clock });
    const message = { to: phone(5), template: 'reminder.check-in' as const, variables: {} };
    await channel.send({ ...message, reference: 'reminder-1' });
    await channel.send({ ...message, reference: 'reminder-1' });
    expect(outbox.all()).toHaveLength(1);
    g.advance(24 * 60 * 60 * 1000 + 1);
    // A newer send clears what is older than a day.
    await channel.send({ ...message, reference: 'reminder-2' });
    await channel.send({ ...message, reference: 'reminder-1' });
    expect(outbox.all()).toHaveLength(3);
  });
});

describe('SmsChannel: one GSM-7 segment where it fits, billed by segment (A1-14, A12-07)', () => {
  const longest = (name: TemplateVariable) => 'x'.repeat(TEMPLATE_VARIABLE_MAX_LENGTH[name]);
  /** Every template filled with the longest value each variable may take. */
  const filled = (id: MessageTemplateId, value: (name: TemplateVariable) => string) =>
    Object.fromEntries(messageTemplate(id).variables.map((v) => [v, value(v)]));
  const typical: Record<TemplateVariable, string> = {
    universityName: 'University of the Witwatersrand',
    subjectName: 'Mathematical Literacy',
  };

  async function sent(id: MessageTemplateId, variables: Record<string, string>) {
    const outbox = new MemoryOutbox();
    const channel = new SmsChannel(outbox, { gate: async () => true });
    await channel.send({ to: phone(21), template: id, variables });
    const body = outbox.all()[0]?.body ?? '';
    return { body, encoding: smsSize(body).encoding, segments: smsSegments(body) };
  }

  // The templates that may go out by SMS. The Phase 5b safety tips are push-only (planning.md
  // §11, Phase 5 decision 4): the channel refuses them, which the next test holds.
  const SMS_TEMPLATE_IDS = MESSAGE_TEMPLATE_IDS.filter((id) =>
    messageTemplate(id).channels.includes('sms'),
  );

  it('sends no push-only template by SMS: the safety tips are push and in-app only', async () => {
    const pushOnly = MESSAGE_TEMPLATE_IDS.filter((id) => !SMS_TEMPLATE_IDS.includes(id));
    expect(pushOnly).toEqual(['safety.offer-accepted', 'safety.move-in']);
    for (const id of pushOnly) {
      await expect(
        sent(
          id,
          filled(id, (v) => typical[v]),
        ),
      ).rejects.toThrow(InvalidMessageError);
    }
  });

  it('every SMS template, with everyday names, is one GSM-7 segment', async () => {
    for (const id of SMS_TEMPLATE_IDS) {
      const { encoding, segments } = await sent(
        id,
        filled(id, (v) => typical[v]),
      );
      expect({ id, encoding, segments }).toEqual({ id, encoding: 'gsm7', segments: 1 });
    }
  });

  it('A12-10: every SMS template goes out GSM-7 in its stated segments, ending "Reply STOP to stop."', async () => {
    for (const id of SMS_TEMPLATE_IDS) {
      const stated = messageTemplate(id).smsSegments;
      const { body, encoding, segments } = await sent(id, filled(id, longest));
      expect({ id, encoding, segments }).toEqual({ id, encoding: 'gsm7', segments: stated });
      expect(body, id).toMatch(/ Reply STOP to stop\.$/);
    }
  });

  it('keeps the words: only the typography changes on SMS', async () => {
    const { body } = await sent('recheck.changed', {});
    expect(body).toBe(
      "UniversityFlow: we checked your courses again with the new report you added, and something changed. Open the app to see what's new. Reply STOP to stop.",
    );
  });

  it('refuses, as an invalid message, a text over three segments by encoding though short in characters', async () => {
    const outbox = new MemoryOutbox();
    const channel = new SmsChannel(outbox, { gate: async () => true });
    // 202 characters: far under the character cap, but four UCS-2 segments.
    await expect(channel.sendText({ to: phone(22), text: 'ŋ'.repeat(202) })).rejects.toThrow(
      InvalidMessageError,
    );
    await channel.sendText({ to: phone(22), text: 'ŋ'.repeat(201) });
    expect(outbox.all()).toHaveLength(1);
  });
});

describe('the sign-in SMS (A1-14)', () => {
  it('the PIN is one GSM-7 segment', () => {
    const body = en.auth.smsBody('123456');
    expect(isGsm7(body)).toBe(true);
    expect(smsSegments(body)).toBe(1);
  });

  it('the guardian link is GSM-7, in two segments with a production-length link', () => {
    const link = `https://universityflow.co.za/consent/${'A'.repeat(43)}`;
    const body = en.onboarding.smsToGuardian(link);
    expect(isGsm7(body)).toBe(true);
    expect(smsSegments(body)).toBe(2);
  });
});

describe('MemoryWhatsAppChannel', () => {
  channelContract((): ChannelHarness => {
    const g = gateAndClock();
    const channel = new MemoryWhatsAppChannel({ gate: g.gate, clock: g.clock });
    return {
      channel,
      address: phone(11),
      other: phone(12),
      badAddress: 'not-a-number',
      optOut: (a) => g.optedOut.add(a),
      failNextSend: () => channel.failNext(),
      acceptThenFailNextSend: () => channel.acceptThenFailNext(),
      delivered: () => channel.all().length,
      now: g.clock,
      advance: g.advance,
    };
  });

  it('keeps the template each message was made from, and the latest inbound time', async () => {
    const g = gateAndClock();
    const channel = new MemoryWhatsAppChannel({ gate: g.gate, clock: g.clock });
    await channel.send({ to: phone(13), template: 'reminder.check-in', variables: {} });
    expect(channel.to(phone(13))[0]).toMatchObject({
      template: 'reminder.check-in',
      channel: 'whatsapp',
    });
    // An older inbound report never closes a window a newer one opened.
    await channel.noteInbound(phone(13), g.clock());
    await channel.noteInbound(phone(13), new Date(g.clock().getTime() - 2 * 86_400_000));
    expect(await channel.freeFormAllowed(phone(13), g.clock())).toBe(true);
    channel.clear();
    expect(channel.all()).toEqual([]);
  });
});

describe('MemoryPushChannel', () => {
  channelContract((): ChannelHarness => {
    const g = gateAndClock();
    const channel = new MemoryPushChannel({ gate: g.gate, clock: g.clock });
    return {
      channel,
      address: token(1),
      other: token(2),
      badAddress: phone(1),
      optOut: (a) => g.optedOut.add(a),
      failNextSend: () => channel.failNext(),
      acceptThenFailNextSend: () => channel.acceptThenFailNext(),
      delivered: () => channel.all().length,
      now: g.clock,
      advance: g.advance,
    };
  });

  it('refuses a template the channel does not carry', async () => {
    const g = gateAndClock();
    const channel = new MemoryPushChannel({ gate: g.gate });
    // Every template today goes everywhere; a template limited to SMS would be refused here.
    const { MESSAGE_TEMPLATES } = await import('@universityflow/content');
    const template = MESSAGE_TEMPLATES['reminder.check-in'] as { channels: readonly string[] };
    const saved = template.channels;
    Object.defineProperty(template, 'channels', { value: ['sms'], configurable: true });
    try {
      await expect(
        channel.send({ to: token(9), template: 'reminder.check-in', variables: {} }),
      ).rejects.toThrow(InvalidMessageError);
    } finally {
      Object.defineProperty(template, 'channels', { value: saved, configurable: true });
    }
  });
});
