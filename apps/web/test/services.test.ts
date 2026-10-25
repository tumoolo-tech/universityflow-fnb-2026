import { createHmac, randomUUID } from 'node:crypto';
import {
  PostgresFileStore,
  PostgresJobScheduler,
  SESSION_SWEEP,
  SESSION_SWEEP_ID,
  scheduleSessionSweep,
} from '@universityflow/db';
import { DiskFileStore, S3FileStore } from '@universityflow/documents';
import { defineJobKind, entityId, handle, MemoryJobScheduler } from '@universityflow/jobs';
import {
  BudgetedChannel,
  BudgetedSmsSender,
  budgetRetryAfterMs,
  ChannelSendError,
  ExpoPushChannel,
  MemoryOutbox,
  MemoryPushChannel,
  MemoryWhatsAppChannel,
  nextAllowedSend,
  RECEIPT_CHECK,
  REMINDER_SEND,
  REMINDER_SWEEP,
  type SmsBudgetAlert,
  SmsBudgetExceededError,
  SmsChannel,
  type SmsSender,
} from '@universityflow/messaging';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigError, readConfig } from '../lib/server/config';
import { CV_COLLECT, CV_DELETE_LEARNER, CV_EXPIRE, CV_POLL, CV_SUBMIT } from '../lib/server/cv';
import { GUARDIAN_CONSENT_SMS } from '../lib/server/guardian-sms';
import { PUSH_ADAPTERS } from '../lib/server/messaging-providers';
import { logReviewAlerts } from '../lib/server/review';
import { createServices, smsBudgetWindows, WHATSAPP_BUDGET } from '../lib/server/services';
import type { SmsAdapter } from '../lib/server/sms-providers';
import { fakeInboundVerifier } from './fake-live-provider';

// Synthetic number, built at runtime (hard rule 4).
const PHONE = `+2782${'0000789'}`;

const LIVE_LOCAL = {
  UF_PROVIDERS: 'live',
  DATABASE_URL: 'pglite:memory',
  UF_S3_BUCKET: 'uf-documents-test',
  UF_SMS_PROVIDER: 'test-provider',
  UF_JOBS_PROVIDER: 'test-jobs',
  ANTHROPIC_API_KEY: 'test-key-not-real',
  UF_SMS_BUDGET_PER_HOUR: '2',
  UF_SMS_BUDGET_PER_DAY: '10',
};
/** No live adapter exists yet; these tests pretend they do. It receives too (A5-02). */
const ADAPTERS = {
  sms: ['test-provider'],
  jobs: ['test-jobs'],
  inbound: { sms: ['test-provider'] },
};

/** A live SMS adapter: `sender`, and the fake provider's inbound half (A5-02). */
const receiving = (sender: () => SmsSender): SmsAdapter => ({
  sender,
  inbound: () => fakeInboundVerifier('sms'),
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createServices with UF_PROVIDERS=live', () => {
  it('uses S3 for files and direct uploads, the named SMS adapter inside the budget, and no outbox', async () => {
    // The Anthropic SDK reads its key from the environment itself.
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key-not-real');
    const provider = new MemoryOutbox();
    const scheduler = new MemoryJobScheduler();
    const alerts: SmsBudgetAlert[] = [];
    const services = await createServices(readConfig(LIVE_LOCAL, ADAPTERS), {
      env: LIVE_LOCAL,
      smsAdapters: { 'test-provider': receiving(() => provider) },
      jobAdapters: { 'test-jobs': () => scheduler },
      smsAlerts: { onBudgetThreshold: (a) => void alerts.push(a) },
    });

    expect(services.files).toBeInstanceOf(S3FileStore);
    expect((services.files as S3FileStore).region).toBe('af-south-1');
    expect(services.uploads).toBe(services.files);
    expect(services.outbox).toBeNull();
    expect(services.reader.isSample).toBe(false);
    expect(services.config.filesInDatabase).toBe(false);
    expect(services.sms).toBeInstanceOf(BudgetedSmsSender);
    // The hosted scheduler runs its own jobs: no local runner.
    expect(services.jobs).toBe(scheduler);
    expect(services.jobRunner).toBeNull();

    await services.sms.send({ to: PHONE, body: 'one' });
    await services.sms.send({ to: PHONE, body: 'two' });
    await expect(services.sms.send({ to: PHONE, body: 'three' })).rejects.toThrow(
      SmsBudgetExceededError,
    );
    expect(provider.all()).toHaveLength(2);
    expect(alerts).toEqual([
      { budget: 'sms-auth', level: 'exhausted', window: 'hour', used: 2, limit: 2 },
    ]);
  });

  it('production stays S3 only, even handed a configuration asking for the database', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key-not-real');
    const config = { ...readConfig(LIVE_LOCAL, ADAPTERS), filesInDatabase: true };
    await expect(
      createServices(config, {
        env: LIVE_LOCAL,
        smsAdapters: { 'test-provider': receiving(() => new MemoryOutbox()) },
        jobAdapters: { 'test-jobs': () => new MemoryJobScheduler() },
      }),
    ).rejects.toThrow(ConfigError);
  });

  it('A7-01 guard 6: the store-review sign-in works with live providers, and sends nothing through them', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key-not-real');
    const secret = 'r'.repeat(40);
    const reviewPhone = `+2782${'9000456'}`;
    const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const env = {
      ...LIVE_LOCAL,
      AUTH_SECRET: secret,
      UF_REVIEW_PHONE: reviewPhone,
      UF_REVIEW_PIN_HASH: createHmac('sha256', secret)
        .update(`${reviewPhone}:246810`)
        .digest('hex'),
      UF_REVIEW_UNTIL: until,
    };
    const provider = new MemoryOutbox();
    const services = await createServices(readConfig(env, ADAPTERS), {
      env,
      smsAdapters: { 'test-provider': receiving(() => provider) },
      jobAdapters: { 'test-jobs': () => new MemoryJobScheduler() },
      smsAlerts: { onBudgetThreshold: () => undefined },
    });
    expect(services.config.providers).toBe('live');
    const { studentId } = await services.store.seedReviewAccount(reviewPhone);
    const challenge = await services.store.requestOtp(reviewPhone);
    expect(challenge.review).toBe(true);
    const signed = await services.store.verifyOtp(reviewPhone, '246810');
    expect(signed).toMatchObject({ studentId, review: true });
    expect(provider.all()).toEqual([]);
  });

  it('A1-19/A1-20: the store reports wrong review PINs, the lock and a misconfigured number to the log, ids only', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const id = randomUUID();
    logReviewAlerts.wrongPin({ failures: 3, limit: 10 });
    logReviewAlerts.locked();
    logReviewAlerts.misconfigured({ studentId: id });
    expect(warn.mock.calls.map((c) => c[0])).toEqual([
      'store-review wrong PIN: 3 of 10 in this window',
      'store-review locked: too many wrong PINs; set a new PIN hash and redeploy',
      `store-review misconfigured: UF_REVIEW_PHONE belongs to student ${id}, which is not the review account`,
    ]);
    warn.mockRestore();
  });

  it('refuses a live configuration without S3, an SMS adapter or a job scheduler adapter', async () => {
    const config = readConfig(LIVE_LOCAL, ADAPTERS);
    const sms = { 'test-provider': receiving(() => new MemoryOutbox()) };
    const jobs = { 'test-jobs': () => new MemoryJobScheduler() };
    await expect(
      createServices({ ...config, s3: null }, { smsAdapters: sms, jobAdapters: jobs }),
    ).rejects.toThrow(ConfigError);
    await expect(createServices(config, { smsAdapters: {}, jobAdapters: jobs })).rejects.toThrow(
      ConfigError,
    );
    // Never the Postgres queue in its place.
    await expect(createServices(config, { smsAdapters: sms, jobAdapters: {} })).rejects.toThrow(
      ConfigError,
    );
  });
});

describe('createServices with UF_PROVIDERS=local', () => {
  it('keeps the outbox and the local folder, and still budgets SMS', async () => {
    const env = { DATABASE_URL: 'pglite:memory', UF_SMS_BUDGET_PER_HOUR: '1' };
    const services = await createServices(readConfig(env), {
      env,
      smsAlerts: { onBudgetThreshold: () => undefined },
    });
    expect(services.uploads).toBeNull();
    expect(services.outbox).not.toBeNull();
    await services.sms.send({ to: PHONE, body: 'one' });
    await expect(services.sms.send({ to: PHONE, body: 'two' })).rejects.toThrow(
      SmsBudgetExceededError,
    );
    expect(services.outbox?.all()).toHaveLength(1);
  });

  it('keeps files on disk outside a demo on Postgres', async () => {
    const env = { DATABASE_URL: 'pglite:memory' };
    const services = await createServices(readConfig(env), { env });
    expect(services.files).toBeInstanceOf(DiskFileStore);
  });

  it('a judge demo on Postgres keeps its files in the database, every instance seeing them', async () => {
    const env = {
      DATABASE_URL: 'pglite:memory',
      UF_DEPLOYMENT: 'demo',
      UF_DEMO_PROJECT: '1',
      AUTH_SECRET: 'd'.repeat(48),
    };
    // readConfig sets filesInDatabase for a demo whose DATABASE_URL is Postgres (demo-config
    // tests); the embedded database stands in for that Postgres here.
    const services = await createServices({ ...readConfig(env), filesInDatabase: true }, { env });
    expect(services.files).toBeInstanceOf(PostgresFileStore);
    expect(services.uploads).toBeNull();
  });

  it('refuses files in the database anywhere but a demo', async () => {
    const env = { DATABASE_URL: 'pglite:memory' };
    await expect(
      createServices({ ...readConfig(env), filesInDatabase: true }, { env }),
    ).rejects.toThrow(ConfigError);
  });

  it('schedules jobs in the app database and runs them locally', async () => {
    const env = { DATABASE_URL: 'pglite:memory' };
    const services = await createServices(readConfig(env), { env });
    expect(services.jobs).toBeInstanceOf(PostgresJobScheduler);
    expect(services.jobRunner).toBe(services.jobs);

    const kind = defineJobKind('test.ping', ['reminderId']);
    const reminderId = entityId(randomUUID());
    const { id } = await services.jobs.schedule({ kind, payload: { reminderId }, delayMs: 0 });
    const seen: string[] = [];
    const report = await services.jobRunner?.runDue([
      handle(kind, async (payload) => void seen.push(payload.reminderId)),
    ]);
    expect(report?.completed).toEqual([id]);
    expect(seen).toEqual([reminderId]);
  });
});

describe('createServices: Read aloud’s voice (ElevenLabs only, owner 2026-10-22)', () => {
  const VOICE = { ELEVENLABS_API_KEY: 'test-elevenlabs-key', ELEVENLABS_VOICE_ID: 'TestVoice0001' };

  it('no voice, so no Read aloud, without a key: never a stand-in voice in its place', async () => {
    const env = { DATABASE_URL: 'pglite:memory' };
    expect((await createServices(readConfig(env), { env })).voice).toBeNull();
    const live = { ...LIVE_LOCAL };
    expect(
      (
        await createServices(readConfig(live, ADAPTERS), {
          env: live,
          smsAdapters: { 'test-provider': receiving(() => new MemoryOutbox()) },
          jobAdapters: { 'test-jobs': () => new MemoryJobScheduler() },
        })
      ).voice,
    ).toBeNull();
  });

  it('ElevenLabs with the key, locally and live, and never calls it on start', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    try {
      const env = { DATABASE_URL: 'pglite:memory', ...VOICE };
      const local = await createServices(readConfig(env), { env });
      expect(local.voice).toMatchObject({ provider: 'elevenlabs', voiceId: 'TestVoice0001' });
      const live = { ...LIVE_LOCAL, ...VOICE, ELEVENLABS_MODEL_ID: 'eleven_flash_v2_5' };
      const services = await createServices(readConfig(live, ADAPTERS), {
        env: live,
        smsAdapters: { 'test-provider': receiving(() => new MemoryOutbox()) },
        jobAdapters: { 'test-jobs': () => new MemoryJobScheduler() },
      });
      expect(services.voice).toMatchObject({
        provider: 'elevenlabs',
        modelId: 'eleven_flash_v2_5',
      });
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });

  it('refuses a hand-built Config that names a voice when the key is missing', async () => {
    const env = { DATABASE_URL: 'pglite:memory' };
    const config = { ...readConfig(env), voice: { voiceId: 'TestVoice0001', modelId: null } };
    await expect(createServices(config, { env })).rejects.toThrow(ConfigError);
  });
});

describe('createServices: messaging channels (Phase 4a)', () => {
  it('locally: SMS to the outbox, WhatsApp and push stand-ins, all three offered', async () => {
    const env = { DATABASE_URL: 'pglite:memory' };
    const services = await createServices(readConfig(env), { env });
    expect(services.channels.sms).toBeInstanceOf(SmsChannel);
    // WhatsApp inside its budget (A12-15); push costs nothing a message, so has none.
    expect(services.channels.whatsapp).toBeInstanceOf(BudgetedChannel);
    expect((services.channels.whatsapp as BudgetedChannel).budget).toBe(WHATSAPP_BUDGET);
    expect(services.channels.push).toBe(services.devChannels?.push);
    expect(services.devChannels?.whatsapp).toBeInstanceOf(MemoryWhatsAppChannel);
    expect(services.devChannels?.push).toBeInstanceOf(MemoryPushChannel);
    expect(services.offeredChannels).toEqual(['sms', 'whatsapp', 'push']);
    expect(services.reminderHandler.kind).toBe(REMINDER_SEND);
    expect(services.jobHandlers.map((h) => h.kind)).toEqual([
      REMINDER_SEND,
      RECEIPT_CHECK,
      REMINDER_SWEEP,
      GUARDIAN_CONSENT_SMS,
      SESSION_SWEEP,
      // My CV (docs/design/mmereko-api-proposal.md §10.2): the stand-in engine's jobs, locally.
      CV_SUBMIT,
      CV_POLL,
      CV_COLLECT,
      CV_EXPIRE,
      CV_DELETE_LEARNER,
    ]);
  });

  it('A11-03: puts the daily session sweep on the schedule when it starts, once, live or local', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key-not-real');
    const scheduler = new MemoryJobScheduler();
    const live = await createServices(readConfig(LIVE_LOCAL, ADAPTERS), {
      env: LIVE_LOCAL,
      smsAdapters: { 'test-provider': receiving(() => new MemoryOutbox()) },
      jobAdapters: { 'test-jobs': () => scheduler },
      smsAlerts: { onBudgetThreshold: () => undefined },
    });
    expect(live.jobHandlers.map((h) => h.kind)).toContain(SESSION_SWEEP);
    const seeded = await scheduleSessionSweep(scheduler, new Date());
    expect(seeded.created).toBe(false);
    expect(await scheduler.get(seeded.id)).toMatchObject({
      kind: SESSION_SWEEP.name,
      payload: { sweepId: SESSION_SWEEP_ID },
    });

    const env = { DATABASE_URL: 'pglite:memory' };
    const local = await createServices(readConfig(env), { env });
    expect((await scheduleSessionSweep(local.jobs, new Date())).created).toBe(false);
  });

  it('live: UF_PUSH_PROVIDER=expo is the Expo adapter, with the gate and the token forgetter', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key-not-real');
    const env = { ...LIVE_LOCAL, UF_PUSH_PROVIDER: 'expo', EXPO_ACCESS_TOKEN: 'expo-test-token' };
    const config = readConfig(env, { ...ADAPTERS, push: Object.keys(PUSH_ADAPTERS) });
    expect(config.pushProvider).toBe('expo');
    const services = await createServices(config, {
      env,
      smsAdapters: { 'test-provider': receiving(() => new MemoryOutbox()) },
      jobAdapters: { 'test-jobs': () => new MemoryJobScheduler() },
      smsAlerts: { onBudgetThreshold: () => undefined },
    });
    expect(services.channels.push).toBeInstanceOf(ExpoPushChannel);
    expect(services.offeredChannels).toEqual(['sms', 'push']);
    // Nobody has a phone registered: the gate refuses before Expo is ever asked.
    await expect(
      services.channels.push?.send({
        to: 'ExponentPushToken[nobody0000000000]',
        template: 'reminder.check-in',
        variables: {},
      }),
    ).rejects.toThrow(/not opted in/);
  });

  it('live: SMS over the live sender, and no WhatsApp or push stand-in, ever', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key-not-real');
    const services = await createServices(readConfig(LIVE_LOCAL, ADAPTERS), {
      env: LIVE_LOCAL,
      smsAdapters: { 'test-provider': receiving(() => new MemoryOutbox()) },
      jobAdapters: { 'test-jobs': () => new MemoryJobScheduler() },
      smsAlerts: { onBudgetThreshold: () => undefined },
    });
    expect(services.channels.sms).toBeInstanceOf(SmsChannel);
    expect(services.channels.whatsapp).toBeUndefined();
    expect(services.channels.push).toBeUndefined();
    expect(services.devChannels).toBeNull();
    expect(services.offeredChannels).toEqual(['sms']);
  });

  it('live: WhatsApp and push from their adapters when named, each given the opt-in gate', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key-not-real');
    const env = { ...LIVE_LOCAL, UF_WHATSAPP_PROVIDER: 'test-wa', UF_PUSH_PROVIDER: 'test-push' };
    const config = readConfig(env, {
      ...ADAPTERS,
      whatsapp: ['test-wa'],
      push: ['test-push'],
      inbound: { sms: ['test-provider'], whatsapp: ['test-wa'] },
    });
    const gates: unknown[] = [];
    const services = await createServices(config, {
      env,
      smsAdapters: { 'test-provider': receiving(() => new MemoryOutbox()) },
      jobAdapters: { 'test-jobs': () => new MemoryJobScheduler() },
      whatsappAdapters: {
        'test-wa': {
          channel: (_env, options) => {
            gates.push(options.gate);
            return new MemoryWhatsAppChannel(options);
          },
          inbound: () => fakeInboundVerifier('whatsapp'),
        },
      },
      pushAdapters: { 'test-push': (_env, options) => new MemoryPushChannel(options) },
    });
    // The live adapter inside the WhatsApp budget (A12-15), whatever the adapter does itself.
    expect(services.channels.whatsapp).toBeInstanceOf(BudgetedChannel);
    expect(services.channels.push).toBeInstanceOf(MemoryPushChannel);
    expect(services.offeredChannels).toEqual(['sms', 'whatsapp', 'push']);
    // Both channels a learner can reply STOP on can hear it; push has no inbound half.
    expect(Object.keys(services.inbound)).toEqual(['sms', 'whatsapp']);
    // The gate asks the database: nobody is opted in, so nobody may be messaged.
    expect(await (gates[0] as (c: string, a: string) => Promise<boolean>)('whatsapp', PHONE)).toBe(
      false,
    );
    await expect(
      createServices(config, {
        env,
        smsAdapters: { 'test-provider': receiving(() => new MemoryOutbox()) },
        jobAdapters: { 'test-jobs': () => new MemoryJobScheduler() },
        whatsappAdapters: {},
      }),
    ).rejects.toThrow(ConfigError);
  });

  it('A5-02: refuses a live SMS or WhatsApp adapter with no inbound half, even from a hand-built Config', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key-not-real');
    const env = { ...LIVE_LOCAL, UF_WHATSAPP_PROVIDER: 'test-wa' };
    const config = readConfig(env, {
      ...ADAPTERS,
      whatsapp: ['test-wa'],
      inbound: { sms: ['test-provider'], whatsapp: ['test-wa'] },
    });
    const jobAdapters = { 'test-jobs': () => new MemoryJobScheduler() };
    const sendOnly = { sender: () => new MemoryOutbox() } as unknown as SmsAdapter;
    const whatsapp = {
      channel: (_env: unknown, options: ConstructorParameters<typeof MemoryWhatsAppChannel>[0]) =>
        new MemoryWhatsAppChannel(options),
      inbound: () => fakeInboundVerifier('whatsapp'),
    };
    await expect(
      createServices(config, {
        env,
        smsAdapters: { 'test-provider': sendOnly },
        jobAdapters,
        whatsappAdapters: { 'test-wa': whatsapp },
      }),
    ).rejects.toThrow(/sms adapter can send but not receive STOP/);
    await expect(
      createServices(config, {
        env,
        smsAdapters: { 'test-provider': receiving(() => new MemoryOutbox()) },
        jobAdapters,
        whatsappAdapters: { 'test-wa': { ...whatsapp, inbound: undefined } as never },
      }),
    ).rejects.toThrow(/whatsapp adapter can send but not receive STOP/);
    // An SMS verifier handed to WhatsApp hears the wrong channel: refused too.
    await expect(
      createServices(config, {
        env,
        smsAdapters: { 'test-provider': receiving(() => new MemoryOutbox()) },
        jobAdapters,
        whatsappAdapters: { 'test-wa': { ...whatsapp, inbound: () => fakeInboundVerifier('sms') } },
      }),
    ).rejects.toThrow(ConfigError);
  });

  it('A5-03: the Expo adapter refuses to start without EXPO_ACCESS_TOKEN, even from a hand-built Config', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key-not-real');
    const env = { ...LIVE_LOCAL, UF_PUSH_PROVIDER: 'expo', EXPO_ACCESS_TOKEN: 'expo-test-token' };
    const config = readConfig(env, { ...ADAPTERS, push: ['expo'] });
    await expect(
      createServices(config, {
        env: { ...env, EXPO_ACCESS_TOKEN: undefined },
        smsAdapters: { 'test-provider': receiving(() => new MemoryOutbox()) },
        jobAdapters: { 'test-jobs': () => new MemoryJobScheduler() },
        smsAlerts: { onBudgetThreshold: () => undefined },
      }),
    ).rejects.toThrow(/EXPO_ACCESS_TOKEN/);
  });

  it('A12-15: the (limit+1)th WhatsApp template is refused like an over-budget SMS, and alerts', async () => {
    const env = {
      DATABASE_URL: 'pglite:memory',
      UF_WHATSAPP_BUDGET_PER_HOUR: '2',
      UF_WHATSAPP_BUDGET_PER_DAY: '20',
    };
    const alerts: SmsBudgetAlert[] = [];
    const services = await createServices(readConfig(env), {
      env,
      smsAlerts: { onBudgetThreshold: (a) => void alerts.push(a) },
    });
    const challenge = await services.store.requestOtp(PHONE);
    if (challenge.review) throw new Error('not the review number');
    const { studentId } = await services.store.verifyOtp(PHONE, challenge.code);
    await services.store.setDateOfBirth(studentId, '2000-01-15');
    await services.store.consentAsAdult(studentId, 'adult-v1-test');
    await services.store.forStudent(studentId).setChannelOptIn('whatsapp', true);
    const send = () =>
      services.channels.whatsapp?.send({
        to: PHONE,
        template: 'reminder.check-in',
        variables: {},
      });
    await send();
    await send();
    const refused = await send()?.catch((e: unknown) => e);
    // Nothing went out, and the reminder pipeline waits out the window (as for SMS, A12-08).
    expect(refused).toBeInstanceOf(ChannelSendError);
    expect(budgetRetryAfterMs(refused)).toBe(60 * 60 * 1000);
    expect(services.devChannels?.whatsapp.to(PHONE)).toHaveLength(2);
    expect(alerts).toEqual([
      { budget: WHATSAPP_BUDGET, level: 'exhausted', window: 'hour', used: 2, limit: 2 },
    ]);
  });

  it('local: the stand-ins hear SMS and WhatsApp through their signed webhooks', async () => {
    const env = { DATABASE_URL: 'pglite:memory' };
    const services = await createServices(readConfig(env), { env });
    expect(services.inbound.sms?.channel).toBe('sms');
    expect(services.inbound.whatsapp?.channel).toBe('whatsapp');
  });
});

describe('createServices: no message during a paper, with production catalogue settings (A12)', () => {
  // Mathematics P1, 2026: 09:00–12:00 SAST on 23 October. 09:30 SAST is mid-paper.
  const MID_PAPER = new Date('2026-10-23T07:30:00Z');
  const FROM = new Date('2026-10-22T00:00:00Z');
  const TO = new Date('2026-11-20T00:00:00Z');
  let n = 0;

  async function production() {
    // No UF_CATALOGUE_PREVIEW: drafts are never shown, exactly as in production.
    const env = { DATABASE_URL: 'pglite:memory' };
    const config = readConfig(env);
    expect(config.catalogueDrafts).toBe(false);
    const services = await createServices(config, { env });
    async function learner(grade: number, subjects: string[]) {
      const phone = `+2782${String(4_100_000 + n++).padStart(7, '0')}`;
      const challenge = await services.store.requestOtp(phone);
      if (challenge.review) throw new Error('not the review number');
      const { studentId } = await services.store.verifyOtp(phone, challenge.code);
      await services.store.setDateOfBirth(studentId, '2000-01-15');
      await services.store.consentAsAdult(studentId, 'adult-v1-test');
      const student = services.store.forStudent(studentId);
      await student.updateProfile({ grade });
      if (subjects.length > 0) {
        await student.saveConfirmedReport({
          kind: 'grade-11-final',
          marks: subjects.map((subject) => ({ subject, percent: 60 })),
        });
      }
      return studentId;
    }
    return { services, learner };
  }

  const holds = (slots: ReadonlyArray<{ startsAt: Date; endsAt: Date }>, at: Date) =>
    slots.some((s) => s.startsAt <= at && at <= s.endsAt);

  it('A12-01: a Grade 12 Mathematics learner is not messaged mid-paper, though no paper is verified', async () => {
    const { services, learner } = await production();
    const studentId = await learner(12, ['mathematics']);
    const papers = await services.papers.slotsFor(studentId, FROM, TO);
    const decision = nextAllowedSend({ now: MID_PAPER, maxPerWeek: 2, recentSends: [], papers });
    expect(decision.kind).toBe('later');
  });

  it('A12-02: a learner whose profile still says Grade 11 is protected during the matching paper', async () => {
    const { services, learner } = await production();
    const studentId = await learner(11, ['mathematics']);
    const papers = await services.papers.slotsFor(studentId, FROM, TO);
    expect(papers.length).toBeGreaterThanOrEqual(1);
    expect(holds(papers, MID_PAPER)).toBe(true);
  });

  it('A12-03: a Grade 12 learner with no confirmed subjects is protected during every NSC paper', async () => {
    const { services, learner } = await production();
    const studentId = await learner(12, []);
    const papers = await services.papers.slotsFor(studentId, FROM, TO);
    expect(papers.length).toBeGreaterThanOrEqual(1);
    expect(holds(papers, MID_PAPER)).toBe(true);
    // An afternoon paper too: Tourism P1, 14:00 SAST on 30 October.
    expect(holds(papers, new Date('2026-10-30T13:00:00Z'))).toBe(true);
  });

  it('A4-06: builds the catalogue view once a day, not on every call', async () => {
    const { services } = await production();
    const morning = services.catalogue(new Date('2026-10-23T05:00:00Z'));
    // The same day: the same view, not a rebuilt one.
    expect(services.catalogue(new Date('2026-10-23T21:00:00Z'))).toBe(morning);
    // The next day can publish a record verified "today", so it gets its own.
    const next = services.catalogue(new Date('2026-10-24T05:00:00Z'));
    expect(next).not.toBe(morning);
    expect(next).toEqual(morning);
    expect(services.catalogue(new Date('2026-10-24T23:59:59Z'))).toBe(next);
    // Called without a date, it is today's, and memoised too.
    expect(services.catalogue()).toBe(services.catalogue());
  });

  it('still never shows a learner an unverified paper (hard rule 3)', async () => {
    const { services } = await production();
    const view = services.catalogue(MID_PAPER);
    expect(view.includesDrafts).toBe(false);
    expect(view.examPapers).toEqual([]);
  });
});

describe('smsBudgetWindows', () => {
  it('turns the configured budget into an hourly and a daily rolling window', () => {
    expect(smsBudgetWindows({ perHour: 5, perDay: 50 })).toEqual([
      { name: 'hour', limit: 5, windowMs: 3_600_000 },
      { name: 'day', limit: 50, windowMs: 86_400_000 },
    ]);
  });
});
