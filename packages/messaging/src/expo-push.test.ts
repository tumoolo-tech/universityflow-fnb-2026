import { describe, expect, it } from 'vitest';
import {
  ChannelSendError,
  DeliveryUnconfirmedError,
  InvalidMessageError,
  type RecipientGate,
  RecipientGoneError,
} from './channel';
import { type ChannelHarness, channelContract } from './channel.contract';
import {
  EXPO_PUSH_BATCH,
  EXPO_PUSH_RECEIPTS_URL,
  EXPO_PUSH_SEND_URL,
  EXPO_RECEIPT_BATCH,
  ExpoPushChannel,
  type PushFetch,
} from './expo-push';

// Synthetic tokens, built at runtime (hard rule 4).
const token = (n: number) => `ExponentPushToken[fake${String(n).padStart(8, '0')}]`;

interface Sent {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
}

/**
 * Expo's push API, faked: accepts a message and issues a ticket, or answers as Expo does when
 * told to (an outage, a request error, a ticket error). Receipts are whatever a test sets.
 */
class FakeExpo {
  readonly requests: Sent[] = [];
  readonly accepted: Array<{ to: string; title: string; body: string; data: unknown }> = [];
  readonly receipts: Record<string, unknown> = {};
  /** Tokens Expo says are no longer registered. */
  readonly unregistered = new Set<string>();
  #failures = 0;
  #next = 1;
  /** The next answer instead of the usual one. */
  override: { status: number; json: unknown } | null = null;
  /** The next request fails as `fetch` does, with this error, before Expo sees it. */
  throwNext: unknown = null;
  /** Expo takes the next message, then the connection drops before its answer arrives. */
  acceptThenThrowNext = false;

  failNext(n = 1): void {
    this.#failures = n;
  }

  readonly fetch: PushFetch = async (url, init) => {
    const body = JSON.parse(init.body) as unknown;
    this.requests.push({ url, headers: init.headers, body });
    if (this.throwNext !== null) {
      const error = this.throwNext;
      this.throwNext = null;
      throw error;
    }
    if (this.acceptThenThrowNext && url === EXPO_PUSH_SEND_URL) {
      this.acceptThenThrowNext = false;
      this.accepted.push(
        ...(body as Array<{ to: string; title: string; body: string; data: unknown }>),
      );
      throw new TypeError('fetch failed', { cause: { code: 'UND_ERR_SOCKET' } });
    }
    if (this.override) {
      const reply = this.override;
      this.override = null;
      return { ok: reply.status < 300, status: reply.status, json: async () => reply.json };
    }
    if (this.#failures > 0) {
      this.#failures -= 1;
      return { ok: false, status: 503, json: async () => ({}) };
    }
    if (url === EXPO_PUSH_RECEIPTS_URL) {
      const { ids } = body as { ids: string[] };
      const data = Object.fromEntries(
        ids.filter((id) => id in this.receipts).map((id) => [id, this.receipts[id]]),
      );
      return { ok: true, status: 200, json: async () => ({ data }) };
    }
    const messages = body as Array<{ to: string; title: string; body: string; data: unknown }>;
    const data = messages.map((m) => {
      if (this.unregistered.has(m.to)) {
        return {
          status: 'error',
          message: `"${m.to}" is not a registered push notification recipient`,
          details: { error: 'DeviceNotRegistered', expoPushToken: m.to },
        };
      }
      this.accepted.push(m);
      return { status: 'ok', id: `ticket-${this.#next++}` };
    });
    return { ok: true, status: 200, json: async () => ({ data }) };
  };
}

function setup(options: { accessToken?: string } = {}) {
  const optedOut = new Set<string>();
  const forgotten: string[] = [];
  const gate: RecipientGate = async (_channel, to) => !optedOut.has(to);
  let now = new Date('2026-10-13T08:00:00Z');
  const clock = () => now;
  const expo = new FakeExpo();
  const channel = new ExpoPushChannel({
    gate,
    clock,
    fetch: expo.fetch,
    accessToken: options.accessToken ?? null,
    forgetAddress: async (t) => void forgotten.push(t),
  });
  return {
    expo,
    channel,
    optedOut,
    forgotten,
    clock,
    advance(ms: number) {
      now = new Date(now.getTime() + ms);
    },
  };
}

describe('ExpoPushChannel, against a fake Expo', () => {
  channelContract((): ChannelHarness => {
    const s = setup();
    return {
      channel: s.channel,
      address: token(1),
      other: token(2),
      badAddress: 'ExponentPushToken[]',
      optOut: (a) => s.optedOut.add(a),
      failNextSend: () => s.expo.failNext(),
      acceptThenFailNextSend: () => {
        s.expo.acceptThenThrowNext = true;
      },
      delivered: () => s.expo.accepted.length,
      now: s.clock,
      advance: s.advance,
    };
  });

  it('sends the lock-screen text, the app name and a screen word, never a name (hard rule 4)', async () => {
    const s = setup();
    await s.channel.send({
      to: token(3),
      template: 'reminder.study',
      variables: { subjectName: 'Physical Sciences' },
    });
    const [message] = s.expo.accepted;
    expect(message).toMatchObject({
      to: token(3),
      title: 'UniversityFlow',
      data: { screen: 'goals' },
    });
    expect(JSON.stringify(s.expo.requests)).not.toMatch(/Physical Sciences/);
    expect(s.expo.requests[0]?.url).toBe(EXPO_PUSH_SEND_URL);
    expect(s.expo.requests[0]?.headers).not.toHaveProperty('authorization');

    await s.channel.send({ to: token(3), template: 'recheck.changed', variables: {} });
    expect(s.expo.accepted[1]?.data).toEqual({ screen: 'results' });
    await s.channel.sendText({ to: token(3), text: 'A reply' });
    expect(s.expo.accepted[2]?.data).toEqual({ screen: 'home' });
  });

  it('sends the optional access token, and only over Expo’s HTTPS address', async () => {
    const s = setup({ accessToken: 'expo-access-token-for-tests' });
    await s.channel.send({ to: token(4), template: 'reminder.check-in', variables: {} });
    expect(s.expo.requests[0]?.headers['authorization']).toBe('Bearer expo-access-token-for-tests');
    expect(EXPO_PUSH_SEND_URL.startsWith('https://')).toBe(true);
    expect(EXPO_PUSH_RECEIPTS_URL.startsWith('https://')).toBe(true);
  });

  it('DeviceNotRegistered on a ticket forgets the token and refuses for good, quoting nothing', async () => {
    const s = setup();
    s.expo.unregistered.add(token(5));
    const error = await s.channel
      .send({ to: token(5), template: 'reminder.check-in', variables: {} })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RecipientGoneError);
    expect(error).toBeInstanceOf(InvalidMessageError);
    expect(String(error)).not.toContain(token(5));
    expect(s.forgotten).toEqual([token(5)]);
  });

  it('treats other ticket errors, request errors and an unreachable Expo as not sent: retryable', async () => {
    const s = setup();
    const send = () =>
      s.channel.send({ to: token(6), template: 'reminder.check-in', variables: {} });
    const answers = [
      {
        data: [
          {
            status: 'error',
            message: `quota for ${token(6)}`,
            details: { error: 'MessageRateExceeded' },
          },
        ],
      },
      { data: [{ status: 'error', details: { error: '<script>' } }] },
      { errors: [{ code: 'PUSH_TOO_MANY_EXPERIENCE_IDS', message: 'nope' }] },
    ];
    for (const json of answers) {
      s.expo.override = { status: 200, json };
      const error = await send().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ChannelSendError);
      const text = `${String(error)} ${String((error as Error).cause)}`;
      expect(text).not.toContain(token(6));
      expect(text).not.toContain('<script>');
    }
    // No connection was made: nothing went out.
    for (const code of ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN']) {
      s.expo.throwNext = new TypeError('fetch failed', { cause: { code } });
      await expect(send()).rejects.toThrow(ChannelSendError);
    }
    expect(s.forgotten).toEqual([]);
  });

  it('A12-06: treats a 200 without a readable ticket and a dropped connection as unconfirmed, never retried', async () => {
    const s = setup();
    const send = () =>
      s.channel.send({ to: token(6), template: 'reminder.check-in', variables: {} });
    for (const json of [{ data: [] }, null]) {
      s.expo.override = { status: 200, json };
      await expect(send()).rejects.toThrow(DeliveryUnconfirmedError);
    }
    s.expo.throwNext = new TypeError('network down');
    const error = await send().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DeliveryUnconfirmedError);
    expect(error).not.toBeInstanceOf(ChannelSendError);
    expect(String(error)).not.toContain(token(6));
  });

  it('A12-06: a request that takes too long may have reached Expo: unconfirmed', async () => {
    const channel = new ExpoPushChannel({
      gate: async () => true,
      timeoutMs: 5,
      fetch: (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    });
    await expect(
      channel.send({ to: token(7), template: 'reminder.check-in', variables: {} }),
    ).rejects.toThrow(DeliveryUnconfirmedError);
  });

  it('reads receipts: delivered, failed, still pending, and forgets a token that is gone', async () => {
    const s = setup();
    const ids: string[] = [];
    for (const n of [8, 9, 10, 11]) {
      ids.push(
        (await s.channel.send({ to: token(n), template: 'reminder.check-in', variables: {} })).id,
      );
    }
    const [ok, failed, gone, pending] = ids as [string, string, string, string];
    s.expo.receipts[ok] = { status: 'ok' };
    s.expo.receipts[failed] = { status: 'error', details: { error: 'MessageTooBig' } };
    // A receipt that doesn't name its token: the channel remembers which token the ticket was.
    s.expo.receipts[gone] = { status: 'error', details: { error: 'DeviceNotRegistered' } };
    const outcomes = await s.channel.checkReceipts([...ids, 'never-issued', '']);
    expect(Object.fromEntries(outcomes)).toEqual({
      [ok]: 'delivered',
      [failed]: 'failed',
      [gone]: 'failed',
      [pending]: 'pending',
      'never-issued': 'pending',
    });
    expect(await s.channel.status(ok)).toBe('delivered');
    expect(await s.channel.status(failed)).toBe('failed');
    expect(await s.channel.status(pending)).toBe('accepted');
    expect(s.forgotten).toEqual([token(10)]);
  });

  it('uses the token a receipt names (another server instance sent it)', async () => {
    const s = setup();
    s.expo.receipts['ticket-elsewhere'] = {
      status: 'error',
      details: { error: 'DeviceNotRegistered', expoPushToken: token(12) },
    };
    s.expo.receipts['ticket-junk'] = {
      status: 'error',
      details: { error: 'DeviceNotRegistered', expoPushToken: 'not a token' },
    };
    const outcomes = await s.channel.checkReceipts(['ticket-elsewhere', 'ticket-junk']);
    expect(outcomes.get('ticket-elsewhere')).toBe('failed');
    expect(s.forgotten).toEqual([token(12)]);
  });

  it('asks for receipts in batches, and fails a receipt request Expo refuses', async () => {
    const s = setup();
    const ids = Array.from({ length: EXPO_RECEIPT_BATCH + 1 }, (_, i) => `ticket-${i}`);
    const outcomes = await s.channel.checkReceipts(ids);
    expect(outcomes.size).toBe(ids.length);
    expect(s.expo.requests.filter((r) => r.url === EXPO_PUSH_RECEIPTS_URL)).toHaveLength(2);
    s.expo.failNext();
    await expect(s.channel.checkReceipts(['ticket-1'])).rejects.toThrow(/HTTP 503/);
    s.expo.override = { status: 200, json: { data: 'nonsense' } };
    expect((await s.channel.checkReceipts(['ticket-1'])).get('ticket-1')).toBe('pending');
  });

  it('forgets which token a ticket went to after a day', async () => {
    const s = setup();
    const { id: old } = await s.channel.send({
      to: token(13),
      template: 'reminder.check-in',
      variables: {},
    });
    s.advance(25 * 60 * 60 * 1000);
    await s.channel.send({ to: token(14), template: 'reminder.check-in', variables: {} });
    s.expo.receipts[old] = { status: 'error', details: { error: 'DeviceNotRegistered' } };
    await s.channel.checkReceipts([old]);
    // The token is no longer remembered, so there is nothing to forget.
    expect(s.forgotten).toEqual([]);
  });

  it('A5-04: sends to many phones in one request, at most 100 messages each, one outcome per phone', async () => {
    const s = setup();
    const phones = Array.from({ length: EXPO_PUSH_BATCH + 50 }, (_, i) => token(100 + i));
    const [gonePhone, laterGone] = [phones[3], phones[7]] as [string, string];
    s.expo.unregistered.add(gonePhone);
    const outcomes = await s.channel.sendMany({
      to: phones,
      template: 'reminder.check-in',
      variables: {},
    });
    const sends = s.expo.requests.filter((r) => r.url === EXPO_PUSH_SEND_URL);
    expect(sends.map((r) => (r.body as unknown[]).length)).toEqual([EXPO_PUSH_BATCH, 50]);
    expect(outcomes.map((o) => o.to)).toEqual(phones);
    expect(outcomes.filter((o) => 'receipt' in o)).toHaveLength(phones.length - 1);
    const gone = outcomes[3];
    expect(gone && 'error' in gone ? gone.error : null).toBeInstanceOf(RecipientGoneError);
    expect(s.forgotten).toEqual([gonePhone]);
    // Each ticket is remembered against its own phone: a receipt that names no token still
    // forgets the right one.
    const later = outcomes[7];
    if (!later || !('receipt' in later)) throw new Error('expected a receipt');
    s.expo.receipts[later.receipt.id] = {
      status: 'error',
      details: { error: 'DeviceNotRegistered' },
    };
    await s.channel.checkReceipts([later.receipt.id]);
    expect(s.forgotten).toEqual([gonePhone, laterGone]);
  });

  it('A5-04: a batch Expo refuses fails for every phone in it; a short answer leaves the rest unconfirmed', async () => {
    const s = setup();
    const message = { template: 'reminder.check-in' as const, variables: {} };
    s.expo.failNext();
    const refused = await s.channel.sendMany({ to: [token(30), token(31)], ...message });
    expect(refused.map((o) => ('error' in o ? o.error : null))).toEqual([
      expect.any(ChannelSendError),
      expect.any(ChannelSendError),
    ]);
    s.expo.override = { status: 200, json: { data: [{ status: 'ok', id: 'only-one' }] } };
    const [first, second] = await s.channel.sendMany({ to: [token(32), token(33)], ...message });
    expect(first && 'receipt' in first ? first.receipt.id : null).toBe('only-one');
    expect(second && 'error' in second ? second.error : null).toBeInstanceOf(
      DeliveryUnconfirmedError,
    );
  });

  it('works with the default fetch and forgetter when none are given', async () => {
    const channel = new ExpoPushChannel({ gate: async () => false });
    // Refused by the gate before any request: nothing reaches the network in a test.
    await expect(
      channel.send({ to: token(15), template: 'reminder.check-in', variables: {} }),
    ).rejects.toThrow(/not opted in/);
  });
});
