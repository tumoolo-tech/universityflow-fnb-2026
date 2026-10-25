import { en, messageText } from '@universityflow/content';
import { MemoryJobScheduler } from '@universityflow/jobs';
import {
  type InboundChannel,
  type InboundEvent,
  MemoryOutbox,
  MemoryWhatsAppChannel,
  SIGNATURE_HEADER,
  signWebhook,
  toGsm7Typography,
} from '@universityflow/messaging';
import { inboundContract } from '@universityflow/messaging/inbound-contract';
import { describe, expect, it, vi } from 'vitest';
import {
  fakeInboundHarness,
  fakeInboundVerifier,
  fakeProviderBody,
  fakeProviderHeaders,
} from './fake-live-provider';
import { Browser } from './harness';

/**
 * A5-02: with UF_PROVIDERS=live, a learner's STOP reaches us through the live adapter's own
 * inbound verifier, on the same route as locally. No live adapter exists yet (the owner chooses
 * the providers), so a fake one stands in: its own wire format and signature, held to the same
 * inbound contract as the stand-ins.
 */

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);
// The Anthropic SDK reads its key from the environment itself.
vi.stubEnv('ANTHROPIC_API_KEY', 'test-key-not-real');

const { readConfig } = await import('../lib/server/config');
const { createServices, getServices } = await import('../lib/server/services');

const ENV = {
  UF_PROVIDERS: 'live',
  DATABASE_URL: 'pglite:memory',
  UF_S3_BUCKET: 'uf-documents-test',
  UF_SMS_PROVIDER: 'fake-sms',
  UF_JOBS_PROVIDER: 'test-jobs',
  UF_WHATSAPP_PROVIDER: 'fake-wa',
  ANTHROPIC_API_KEY: 'test-key-not-real',
  // Set, to show the stand-ins' signature is still refused in live mode.
  UF_MESSAGING_WEBHOOK_SECRET: 's'.repeat(40),
};

// Every route in this file reads these services, as getServices() would build them in production.
(globalThis as { __ufServices?: unknown }).__ufServices = createServices(
  readConfig(ENV, {
    sms: ['fake-sms'],
    jobs: ['test-jobs'],
    whatsapp: ['fake-wa'],
    inbound: { sms: ['fake-sms'], whatsapp: ['fake-wa'] },
  }),
  {
    env: ENV,
    smsAdapters: {
      'fake-sms': { sender: () => new MemoryOutbox(), inbound: () => fakeInboundVerifier('sms') },
    },
    jobAdapters: { 'test-jobs': () => new MemoryJobScheduler() },
    whatsappAdapters: {
      'fake-wa': {
        channel: (_env, context) => new MemoryWhatsAppChannel(context),
        inbound: () => fakeInboundVerifier('whatsapp'),
      },
    },
    smsAlerts: { onBudgetThreshold: () => undefined },
  },
);

const { POST: inboundRoute } = await import('../app/api/messaging/[channel]/inbound/route');

let n = 7_100_000;
/** A synthetic number, built at runtime (hard rule 4). */
const phone = () => `+2782${String(n++).padStart(7, '0')}`;

/** An adult learner, opted in to `channels`. */
async function optedIn(channels: ReadonlyArray<'sms' | 'whatsapp'>) {
  const { store } = await getServices();
  const number = phone();
  const challenge = await store.requestOtp(number);
  if (challenge.review) throw new Error('not the review number');
  const { studentId } = await store.verifyOtp(number, challenge.code);
  await store.setDateOfBirth(studentId, '2000-01-15');
  await store.consentAsAdult(studentId, en.adultConsent.version);
  for (const channel of channels) await store.forStudent(studentId).setChannelOptIn(channel, true);
  return number;
}

async function post(channel: string, body: string, headers: Record<string, string>) {
  return new Browser().json<{ ok?: boolean; reply?: string | null; error?: string }>(
    inboundRoute,
    `/api/messaging/${channel}/inbound`,
    { method: 'POST', body, headers, origin: null, params: { channel } },
  );
}

/** Posts `event` the way the fake provider would, signed for `signedFor` (by default `channel`). */
function fromProvider(
  channel: InboundChannel,
  event: InboundEvent,
  options: { at?: Date; signedFor?: InboundChannel; body?: string } = {},
) {
  const body = options.body ?? fakeProviderBody(event);
  const headers = fakeProviderHeaders(options.signedFor ?? channel, body, options.at ?? new Date());
  return post(channel, body, headers);
}

const FROM = `+2782${'0000654'}`;

describe('the fake live provider meets the inbound contract, as a real adapter must (A5-02)', () => {
  describe('SMS', () => inboundContract(() => fakeInboundHarness('sms', FROM)));
  describe('WhatsApp', () => inboundContract(() => fakeInboundHarness('whatsapp', FROM)));
});

describe('inbound webhooks with UF_PROVIDERS=live (A5-02)', () => {
  it('live services hear SMS and WhatsApp through the adapters’ own verifiers', async () => {
    const services = await getServices();
    expect(services.config.providers).toBe('live');
    expect(services.devChannels).toBeNull();
    expect(services.inbound.sms?.channel).toBe('sms');
    expect(services.inbound.whatsapp?.channel).toBe('whatsapp');
  });

  it('a STOP by SMS opts the learner out at once, and is confirmed', async () => {
    const number = await optedIn(['sms', 'whatsapp']);
    const { messaging } = await getServices();
    expect(await messaging.mayMessage('sms', number)).toBe(true);
    const res = await fromProvider('sms', { type: 'message', from: number, text: 'STOP' });
    expect(res).toEqual({
      status: 200,
      body: { ok: true, reply: toGsm7Typography(messageText.stopConfirmed) },
    });
    expect(await messaging.mayMessage('sms', number)).toBe(false);
    // Only the channel it came on.
    expect(await messaging.mayMessage('whatsapp', number)).toBe(true);
  });

  it('a STOP on WhatsApp opts the learner out of WhatsApp', async () => {
    const number = await optedIn(['whatsapp']);
    const { messaging } = await getServices();
    const res = await fromProvider('whatsapp', { type: 'message', from: number, text: 'Yeka' });
    expect(res.body).toEqual({ ok: true, reply: messageText.stopConfirmed });
    expect(await messaging.mayMessage('whatsapp', number)).toBe(false);
  });

  it('refuses a forged, stale, crossed or replayed request, and the stand-ins’ signature', async () => {
    const number = await optedIn(['sms', 'whatsapp']);
    const { messaging } = await getServices();
    const stop: InboundEvent = { type: 'message', from: number, text: 'STOP' };
    const forbidden = { status: 401, body: { error: 'forbidden', detail: null } };

    const body = fakeProviderBody(stop);
    const forged = await post(
      'sms',
      body,
      fakeProviderHeaders('sms', body, new Date(), 'f'.repeat(40)),
    );
    expect(forged).toEqual(forbidden);
    const stale = await fromProvider('sms', stop, { at: new Date(Date.now() - 10 * 60 * 1000) });
    expect(stale).toEqual(forbidden);
    // Signed for SMS, posted to WhatsApp (A5-06).
    expect(await fromProvider('whatsapp', stop, { signedFor: 'sms' })).toEqual(forbidden);
    // The stand-ins' webhook format is not the provider's: refused in live mode.
    const standIn = JSON.stringify(stop);
    const secret = ENV.UF_MESSAGING_WEBHOOK_SECRET;
    expect(
      await post('sms', standIn, {
        'content-type': 'application/json',
        [SIGNATURE_HEADER]: signWebhook(secret, 'sms', standIn),
      }),
    ).toEqual(forbidden);
    expect(await messaging.mayMessage('sms', number)).toBe(true);
    expect(await messaging.mayMessage('whatsapp', number)).toBe(true);

    // A reply, delivered once, then replayed: the replay is refused (A5-06).
    const reply = fakeProviderBody({ type: 'message', from: number, text: 'Thanks!' });
    const headers = fakeProviderHeaders('sms', reply, new Date());
    expect((await post('sms', reply, headers)).status).toBe(200);
    expect(await post('sms', reply, headers)).toEqual(forbidden);
  });

  it('still answers distress on a live channel (A10-05)', async () => {
    const res = await fromProvider('sms', {
      type: 'message',
      from: phone(),
      text: 'i want to die',
    });
    expect(res.status).toBe(200);
    // No helpline is verified here, so the reply names no line (A10-11).
    expect(res.body.reply).toContain(toGsm7Typography(messageText.crisis.replyNoLines));
  });

  it('refuses a provider body that is not a message or report, and push, which has no inbound', async () => {
    const odd = new URLSearchParams({ MessageId: 'x1', Event: 'typing' }).toString();
    expect((await post('sms', odd, fakeProviderHeaders('sms', odd, new Date()))).status).toBe(400);
    // A number outside South Africa, mapped by the adapter: still refused by the route's check.
    const abroad = fakeProviderBody({ type: 'message', from: '+441234567890', text: 'STOP' });
    expect((await post('sms', abroad, fakeProviderHeaders('sms', abroad, new Date()))).status).toBe(
      400,
    );
    expect((await post('push', odd, fakeProviderHeaders('sms', odd, new Date()))).status).toBe(404);
  });
});
