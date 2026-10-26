import 'server-only';
import type { ChatModel } from '@universityflow/agent';
import {
  type CatalogueView,
  catalogueView,
  catalogueViewOf,
  examPapersForSuppression,
  RAW_CATALOGUE,
} from '@universityflow/catalogue';
import { type CvEngine, MemoryCvEngine } from '@universityflow/cv';
import {
  type CvAccess,
  type Database,
  fileDeletionHandler,
  type MessagingStore,
  migrate,
  openDatabase,
  PostgresFileStore,
  PostgresJobScheduler,
  Store,
  scheduleSessionSweep,
  sessionSweepHandler,
  TimetablePaperSlots,
} from '@universityflow/db';
import {
  AnthropicLetterReader,
  AnthropicModuleOutlineReader,
  AnthropicRegistrationReader,
  AnthropicReportReader,
  type DirectUploads,
  DiskFileStore,
  type FileStore,
  type LetterReader,
  MAX_UPLOAD_BYTES,
  type ModuleOutlineReader,
  type RegistrationReader,
  type ReportReader,
  S3FileStore,
  SampleLetterReader,
  SampleModuleOutlineReader,
  SampleRegistrationReader,
  SampleReportReader,
} from '@universityflow/documents';
import type { JobHandler, JobRunner, JobScheduler, RunReport } from '@universityflow/jobs';
import {
  BudgetedChannel,
  BudgetedSmsSender,
  type ChannelName,
  type InboundChannel,
  type InboundVerifier,
  logSmsBudgetAlerts,
  MemoryOutbox,
  MemoryPushChannel,
  MemoryWhatsAppChannel,
  MessageBudget,
  type MessageChannel,
  type PaperSlotSource,
  type RecipientGate,
  receiptCheckHandler,
  reminderHandler,
  reminderSweepHandler,
  type SmsBudgetAlerts,
  type SmsBudgetWindow,
  SmsChannel,
  type SmsSender,
  signedWebhookInbound,
} from '@universityflow/messaging';
import { chatModelFor } from './chat-model';
import { type Config, ConfigError, readConfig, type SmsBudgetConfig } from './config';
import { cvJobHandlers, receiveCvWebhook, scheduleCvDeletions } from './cv';
import { CV_ADAPTERS, type CvAdapter } from './cv-providers';
import { DemoCvEngine, InlineCvScheduler } from './demo/cv-inline';
import { withE2eFixtures } from './e2e-fixtures';
import { type GuardianSms, guardianSmsHandler } from './guardian-sms';
import { JOB_ADAPTERS, type JobAdapterFactory } from './job-providers';
import {
  type ChannelAdapterFactory,
  PUSH_ADAPTERS,
  WHATSAPP_ADAPTERS,
  type WhatsAppAdapter,
} from './messaging-providers';
import { catalogueResolver } from './reminders';
import { logReplyReportAlerts, type ReplyReportAlerts } from './reply-reports';
import { logReviewAlerts } from './review';
import { SMS_ADAPTERS, type SmsAdapter } from './sms-providers';
import { ElevenLabsVoice, type Voice } from './voice';

/**
 * The app's providers, created once per server process. Each sits behind an interface with a
 * local stand-in (D8):
 *
 * - `UF_PROVIDERS=local`: SMS to an in-memory outbox, files to a local folder (uploaded through
 *   our own server; a judge demo on Postgres keeps them in that database instead), scheduled
 *   jobs to a table in the app's own database, and the AI stand-ins unless ANTHROPIC_API_KEY
 *   is set (for the chat, GEMINI_API_KEY too: chat-model.ts).
 * - `UF_PROVIDERS=live`: S3 (with direct browser uploads), the SMS adapter `UF_SMS_PROVIDER`
 *   names, the job scheduler `UF_JOBS_PROVIDER` names, and Claude. config.ts refuses to start if
 *   any of them is missing.
 *
 * Either way, Read aloud's voice is ElevenLabs when its key is set (config.ts) and otherwise none at
 * all: there is no stand-in voice outside tests, so without a key no Read aloud is offered.
 *
 * Either way, SMS goes through a global SMS budget (open finding 1), counted in segments: `sms`
 * (PINs, guardian links) through `sms-auth`, the SMS channel (reminders) through `sms-reminders`.
 * WhatsApp, the other paid channel, goes through `whatsapp`, one unit a template (A12-15). Every
 * budget's alerts go through `smsAlerts` (the log line today; the owner routes it on later).
 *
 * Messaging (Phase 4a): every channel asks the database, just before it sends, whether the
 * learner may be messaged there (consent and the channel opt-in). Locally WhatsApp and push are
 * in-memory stand-ins; live, each exists only when its adapter is configured, never a stand-in.
 */

export interface Services {
  readonly config: Config;
  readonly store: Store;
  readonly sms: SmsSender;
  /** The local outbox, when SMS is the stand-in (development only). */
  readonly outbox: MemoryOutbox | null;
  readonly files: FileStore;
  /** Direct-to-storage uploads (S3), or null when uploads go through our server (local). */
  readonly uploads: DirectUploads | null;
  readonly reader: ReportReader;
  /** Reads acceptance letters (Phase 5a), behind the same switch as reports. */
  readonly letterReader: LetterReader;
  /** Reads proofs of registration (Phase 5c), behind the same switch as reports. */
  readonly registrationReader: RegistrationReader;
  /** Reads module outlines (Phase 6b), behind the same switch as reports. */
  readonly outlineReader: ModuleOutlineReader;
  readonly model: ChatModel;
  /** Scheduled jobs (Phase 4 reminders). Payloads carry IDs only (hard rule 4). */
  readonly jobs: JobScheduler;
  /**
   * Runs due jobs when they live in our own database (local only). A hosted scheduler runs its
   * jobs itself, so this is null in live mode. Locally, the dev route /api/dev/jobs/run calls it.
   */
  readonly jobRunner: JobRunner | null;
  /** Messaging without a learner's request: the reminder job's store, the gate, inbound. */
  readonly messaging: MessagingStore;
  /**
   * The channels that exist. Locally: SMS to the outbox, and in-memory WhatsApp and push. Live:
   * SMS, plus WhatsApp and push only when their adapters are configured.
   */
  readonly channels: Partial<Readonly<Record<ChannelName, MessageChannel>>>;
  /**
   * How each channel a learner can reply on hears them (A5-02): STOP, replies, delivery reports,
   * for /api/messaging/[channel]/inbound. Locally, the stand-ins' signed webhooks; live, each
   * adapter's own verifier. Every SMS and WhatsApp channel in `channels` has one.
   */
  readonly inbound: Partial<Readonly<Record<InboundChannel, InboundVerifier>>>;
  /**
   * The channels a learner may opt in to now. Push only from the app, which registers its token
   * first (/api/me/push-token); the web page shows it but leaves turning it on to the app.
   */
  readonly offeredChannels: ReadonlyArray<ChannelName>;
  /** The WhatsApp and push stand-ins, for the dev outbox (local only). */
  readonly devChannels: {
    readonly whatsapp: MemoryWhatsAppChannel;
    readonly push: MemoryPushChannel;
  } | null;
  /**
   * Local only: runs due reminders, optionally as if it were `at` (the dev route and E2E). Null
   * in live mode, where the hosted scheduler runs jobs.
   */
  readonly devRunDue: ((at?: Date) => Promise<RunReport>) | null;
  /**
   * The papers no message may interrupt: every sourced NSC paper (drafts included) matched to
   * the learner's subjects, for suppression only. Never shown to a learner.
   */
  readonly papers: PaperSlotSource;
  /** Runs `reminder.send` jobs. */
  readonly reminderHandler: JobHandler;
  /**
   * Every job handler the app runs: `reminder.send`, `receipt.check` (push delivery reports) and
   * `reminder.sweep` (closes a reminder whose runner died after claiming it, A12-14) and
   * `guardian.consent-sms` (a consent SMS held for the morning, A12-04) and `session.sweep` (the
   * daily sweep of expired sessions and their push tokens, A11-03; seeded at start) and
   * `file.delete` (an outline's file storage couldn't delete at once, A1-88). The hosted
   * scheduler, when the owner connects one, registers these.
   */
  readonly jobHandlers: ReadonlyArray<JobHandler>;
  /** Tells a person that a learner reported an AI reply (A10-35). Ids only. */
  readonly replyReportAlerts: ReplyReportAlerts;
  /**
   * Read aloud's ElevenLabs voice (owner's choice of 2026-10-22), or null: no Read aloud on the
   * web or in the app. Only ever given public catalogue text (lib/server/read-aloud.ts).
   */
  readonly voice: Voice | null;
  /**
   * My CV's engine (docs/design/mmereko-api-proposal.md): locally the in-memory stand-in, which
   * finishes each CV by itself and sends its signed webhook through the same code as the route;
   * live, the adapter `UF_CV_PROVIDER` names, or null when the CV is off. The routes answer 404
   * unless `config.cv`.
   */
  readonly cv: CvEngine | null;
  /** Whether the owner's preview stands in for the wording that names Mmereko (`uf.cv`). */
  readonly cvAccess: CvAccess;
  /**
   * Where the CV routes put their jobs: `jobs`, except on a judge demo, which has no job runner:
   * there the stand-in's jobs run at once, in the request (demo/cv-inline.ts, a hackathon
   * exception of 2026-10-24).
   */
  readonly cvScheduler: JobScheduler;
  /** The database, for what runs as its owner (tests and the dev tools only). */
  readonly database: Database;
  catalogue(today?: Date): CatalogueView;
}

/** The SMS budget for sign-in PINs and guardian consent links. */
export const SMS_AUTH_BUDGET = 'sms-auth';
/** The SMS budget for reminders, apart from sign-in's (A5-01, A12-08). */
export const SMS_REMINDER_BUDGET = 'sms-reminders';
/** WhatsApp's budget: Meta bills every template message (A12-15). */
export const WHATSAPP_BUDGET = 'whatsapp';

/**
 * The catalogue view, built once per UTC day (A4-06) rather than on every call: a view keeps a
 * record from the day its `verifiedOn` (a UTC date) is reached, so two calls on one UTC day always
 * build the same view, and the data is fixed for the life of the deploy. A few days are kept, for
 * a caller that asks about another day.
 */
export function memoisedCatalogue(
  build: (today: Date) => CatalogueView,
): (today?: Date) => CatalogueView {
  const views = new Map<string, CatalogueView>();
  return (today = new Date()) => {
    const day = today.toISOString().slice(0, 10);
    let view = views.get(day);
    if (!view) {
      view = build(today);
      if (views.size >= 4) views.delete(views.keys().next().value as string);
      views.set(day, view);
    }
    return view;
  };
}

/** An SMS budget's windows, from configuration. */
export function smsBudgetWindows(budget: SmsBudgetConfig): SmsBudgetWindow[] {
  return [
    { name: 'hour', limit: budget.perHour, windowMs: 60 * 60 * 1000 },
    { name: 'day', limit: budget.perDay, windowMs: 24 * 60 * 60 * 1000 },
  ];
}

export interface ServiceOptions {
  readonly env?: Record<string, string | undefined>;
  readonly smsAdapters?: Readonly<Record<string, SmsAdapter>>;
  readonly jobAdapters?: Readonly<Record<string, JobAdapterFactory>>;
  readonly whatsappAdapters?: Readonly<Record<string, WhatsAppAdapter>>;
  readonly pushAdapters?: Readonly<Record<string, ChannelAdapterFactory>>;
  readonly smsAlerts?: SmsBudgetAlerts;
  /** Tests only: the fake voice in ElevenLabs' place. */
  readonly voice?: Voice | null;
  /** Tests only: the CV engine to use in place of the stand-in or the adapter. */
  readonly cvEngine?: CvEngine;
  readonly cvAdapters?: Readonly<Record<string, CvAdapter>>;
}

/** Signs the local stand-in engine's webhooks: it never leaves this process. */
const DEV_CV_WEBHOOK_SECRET = 'local-development-cv-webhook-secret-not-for-production';

/**
 * Puts the deletions no job carries yet on the schedule (§7.3): a server start catches any a
 * crash left behind. A failure here must not stop the app starting.
 */
async function seedCvDeletions(store: Store, scheduler: JobScheduler): Promise<void> {
  try {
    await scheduleCvDeletions({ store, scheduler });
  } catch (error) {
    console.error(`cv deletions: could not schedule (${(error as Error)?.name ?? 'Error'})`);
  }
}

/** The parts of the reminder pipeline every mode shares. */
function messagingParts(
  store: Store,
  catalogue: () => CatalogueView,
  scheduler: JobScheduler,
  channels: Partial<Record<ChannelName, MessageChannel>>,
  guardian: GuardianSms,
) {
  const messaging = store.messaging();
  // The NSC timetable matched to the learner's subjects (Phase 4b). What a learner is shown stays
  // the catalogue view's (verified only in production); what we stay quiet for is every sourced
  // paper, drafts included, because a draft date can only make us quieter (A12-01). Never wire
  // the view in as the suppression source: in production it holds no papers at all.
  const papers = new TimetablePaperSlots(messaging, {
    shown: () => catalogue().examPapers,
    forSuppression: () => examPapersForSuppression(),
  });
  const reminders = reminderHandler({
    store: messaging,
    channels,
    scheduler,
    papers,
    resolve: catalogueResolver(catalogue),
  });
  return {
    messaging,
    papers,
    channels,
    offeredChannels: (['sms', 'whatsapp', 'push'] as const).filter((c) => channels[c]),
    reminderHandler: reminders,
    jobHandlers: [
      reminders,
      receiptCheckHandler({ store: messaging, channels }),
      reminderSweepHandler({ store: messaging }),
      guardianSmsHandler({ ...guardian, scheduler }),
      sessionSweepHandler({ store, scheduler }),
    ],
  };
}

/**
 * Puts the next daily session sweep on the schedule (A11-03). Each sweep schedules the one after
 * it; this, run as a server starts, restarts the chain if it was ever broken. One job per day
 * however many servers start (an idempotency key per date). A failure here must not stop the app
 * starting: the next server start, or the chain itself, schedules it.
 */
async function seedSessionSweep(scheduler: JobScheduler): Promise<void> {
  try {
    await scheduleSessionSweep(scheduler, new Date());
  } catch (error) {
    console.error(`session sweep: could not schedule (${(error as Error)?.name ?? 'Error'})`);
  }
}

export async function createServices(
  config: Config,
  options: ServiceOptions = {},
): Promise<Services> {
  const env = options.env ?? process.env;
  const adapters = options.smsAdapters ?? SMS_ADAPTERS;
  const jobAdapters = options.jobAdapters ?? JOB_ADAPTERS;
  // A demo on Postgres: a small pool per function instance, and Supabase's CA (config.ts). Every
  // instance migrates as it starts; migrate() is safe when several start at once.
  const database = openDatabase(config.databaseUrl, config.databaseConnection);
  await migrate(database);
  // The store-review sign-in (A7-01), when configured, in every mode: it is not a stand-in.
  const store = new Store(database, {
    secret: config.authSecret,
    review: config.review,
    reviewAlerts: logReviewAlerts,
    // Judge demo mode only: sessions without a PIN, and the 24-hour sweep (docs/deploy/demo.md).
    demo: config.demo,
    // The judges' on-screen phone sign-up (a hackathon exception): 100 PIN requests an hour per
    // address, as a judging room shares one. readConfig sets it on a demo only.
    demoPhoneSignup: config.demoPhoneSignup,
  });
  // Two SMS budgets over one provider (A5-01): sign-in PINs and guardian links on one, reminders
  // on the other, so reminders can never spend what sign-in needs. Both count segments (A1-14).
  const budgeted = (inner: SmsSender, name: string, budget: SmsBudgetConfig) =>
    new BudgetedSmsSender(
      inner,
      { take: (windows, units) => store.takeBudget(name, windows, units) },
      {
        name,
        windows: smsBudgetWindows(budget),
        alerts: options.smsAlerts ?? logSmsBudgetAlerts,
      },
    );
  const smsSenders = (inner: SmsSender) => ({
    auth: budgeted(inner, SMS_AUTH_BUDGET, config.smsBudget),
    reminders: budgeted(inner, SMS_REMINDER_BUDGET, config.smsReminderBudget),
  });
  // Per day, and per drafts setting since this process's config fixes it (A4-06).
  // The E2E fixtures (synthetic draft records, e2e-fixtures.ts) only when configured, which
  // readConfig refuses in production.
  const catalogue = memoisedCatalogue((today) =>
    config.catalogueE2eFixtures
      ? catalogueViewOf(withE2eFixtures(RAW_CATALOGUE), today, {
          includeDrafts: config.catalogueDrafts,
        })
      : catalogueView(today, { includeDrafts: config.catalogueDrafts }),
  );
  // WhatsApp bills every template, so it has a global budget like SMS, with the same alerts
  // (A12-15). Whatever the adapter, it is wrapped here, so none can skip it.
  const budgetedWhatsApp = (inner: MessageChannel) =>
    new BudgetedChannel(
      inner,
      new MessageBudget(
        { take: (windows, units) => store.takeBudget(WHATSAPP_BUDGET, windows, units) },
        {
          name: WHATSAPP_BUDGET,
          windows: smsBudgetWindows(config.whatsappBudget),
          alerts: options.smsAlerts ?? logSmsBudgetAlerts,
        },
      ),
    );
  // Every channel asks our own records, at the last moment, whether this learner may be messaged.
  const messagingStore = store.messaging();
  const gate: RecipientGate = (channel, to) => messagingStore.mayMessage(channel, to);
  // Expo's DeviceNotRegistered: the app is gone from that phone, so its token is forgotten.
  const forgetAddress = async (address: string) => {
    await messagingStore.forgetPushToken(address);
  };
  // Read aloud: ElevenLabs or nothing. The key is read here and handed to the voice only.
  let voice: Voice | null = options.voice ?? null;
  if (options.voice === undefined && config.voice) {
    const apiKey = env['ELEVENLABS_API_KEY']?.trim();
    if (!apiKey) throw new ConfigError('Read aloud needs ELEVENLABS_API_KEY');
    voice = new ElevenLabsVoice({
      apiKey,
      voiceId: config.voice.voiceId,
      modelId: config.voice.modelId,
    });
  }

  if (config.providers === 'live') {
    // readConfig already refused a live configuration with anything missing; this repeats the
    // check for the types and for any caller that built a Config by hand.
    const smsAdapter = config.smsProvider ? adapters[config.smsProvider] : undefined;
    const makeJobs = config.jobsProvider ? jobAdapters[config.jobsProvider] : undefined;
    if (!config.s3 || !smsAdapter || !makeJobs) {
      throw new ConfigError('Live providers are not fully configured');
    }
    // Live files are S3 only, never the demo's table (readConfig never sets it outside a demo).
    if (config.filesInDatabase) {
      throw new ConfigError('Live providers keep files in S3, never in the database');
    }
    const optional = (
      name: string | null,
      registry: Readonly<Record<string, ChannelAdapterFactory>>,
    ): MessageChannel | undefined => {
      if (!name) return undefined;
      const factory = registry[name];
      if (!factory) throw new ConfigError(`No adapter for ${name}`);
      return factory(env, { gate, forgetAddress });
    };
    // Every channel a learner is told to reply STOP on hears it, through its adapter's own
    // verifier (A5-02). readConfig refused this already; repeated for a Config built by hand.
    const receiving = (
      channel: InboundChannel,
      adapter: { readonly inbound?: SmsAdapter['inbound'] },
    ): InboundVerifier => {
      const verifier = typeof adapter.inbound === 'function' ? adapter.inbound(env) : undefined;
      if (!verifier || verifier.channel !== channel) {
        throw new ConfigError(`The live ${channel} adapter can send but not receive STOP (A5-02)`);
      }
      return verifier;
    };
    let whatsapp: MessageChannel | undefined;
    let whatsappInbound: InboundVerifier | undefined;
    if (config.whatsappProvider) {
      const adapter = (options.whatsappAdapters ?? WHATSAPP_ADAPTERS)[config.whatsappProvider];
      if (!adapter) throw new ConfigError(`No adapter for ${config.whatsappProvider}`);
      whatsappInbound = receiving('whatsapp', adapter);
      whatsapp = budgetedWhatsApp(adapter.channel(env, { gate, forgetAddress }));
    }
    const smsInbound = receiving('sms', smsAdapter);
    const push = optional(config.pushProvider, options.pushAdapters ?? PUSH_ADAPTERS);
    const senders = smsSenders(smsAdapter.sender(env));
    const sms = senders.auth;
    const jobs = makeJobs(env);
    await seedSessionSweep(jobs);
    // Credentials come from the AWS SDK's default chain (the deployment's role), never from
    // our own configuration.
    const s3 = new S3FileStore({
      bucket: config.s3.bucket,
      region: config.s3.region,
      kmsKeyId: config.s3.kmsKeyId,
      prefix: config.s3.prefix,
      endpoint: config.s3.endpoint,
    });
    const live = messagingParts(
      store,
      catalogue,
      jobs,
      {
        sms: new SmsChannel(senders.reminders, { gate }),
        ...(whatsapp ? { whatsapp } : {}),
        ...(push ? { push } : {}),
      },
      // A queued guardian link goes through the same sign-in budget as one sent at once.
      { store, sms, publicUrl: config.publicUrl },
    );
    // My CV: live, the adapter UF_CV_PROVIDER names (readConfig refused a missing one), never the
    // stand-in; with the CV off, none.
    let cv: CvEngine | null = options.cvEngine ?? null;
    if (!cv && config.cv && config.cvProvider) {
      const adapter = (options.cvAdapters ?? CV_ADAPTERS)[config.cvProvider];
      if (!adapter) throw new ConfigError(`No adapter for ${config.cvProvider}`);
      cv = adapter(env);
    }
    const cvAccess = { preview: config.cvPreview };
    if (cv) await seedCvDeletions(store, jobs);
    return {
      config,
      store,
      sms,
      outbox: null,
      files: s3,
      uploads: s3,
      reader: new AnthropicReportReader({ model: config.anthropicModel }),
      letterReader: new AnthropicLetterReader({ model: config.anthropicModel }),
      registrationReader: new AnthropicRegistrationReader({ model: config.anthropicModel }),
      outlineReader: new AnthropicModuleOutlineReader({ model: config.anthropicModel }),
      // UF_AI_PROVIDER first, the other provider on an outage (chat-model.ts).
      model: chatModelFor(config, env),
      jobs,
      jobRunner: null,
      ...live,
      jobHandlers: [
        ...live.jobHandlers,
        // A1-88: an outline's file storage couldn't delete at once.
        fileDeletionHandler({ store, files: s3 }),
        ...(cv
          ? cvJobHandlers({
              store,
              engine: cv,
              files: s3,
              scheduler: jobs,
              catalogue,
              access: cvAccess,
            })
          : []),
      ],
      inbound: { sms: smsInbound, ...(whatsappInbound ? { whatsapp: whatsappInbound } : {}) },
      devChannels: null,
      devRunDue: null,
      // No alerting account yet (D8): the server log, until the owner names where reports go.
      replyReportAlerts: logReplyReportAlerts,
      voice,
      cv,
      cvAccess,
      cvScheduler: jobs,
      database,
      catalogue,
    };
  }

  const outbox = new MemoryOutbox();
  const senders = smsSenders(outbox);
  const sms = senders.auth;
  const jobs = new PostgresJobScheduler(database);
  await seedSessionSweep(jobs);
  const hasKey = Boolean(env['ANTHROPIC_API_KEY']);
  const devChannels = {
    whatsapp: new MemoryWhatsAppChannel({ gate }),
    push: new MemoryPushChannel({ gate }),
  };
  // A queued guardian link goes through the same sign-in budget as one sent at once.
  const guardian = { store, sms, publicUrl: config.publicUrl };
  const parts = messagingParts(
    store,
    catalogue,
    jobs,
    {
      sms: new SmsChannel(senders.reminders, { gate }),
      whatsapp: budgetedWhatsApp(devChannels.whatsapp),
      push: devChannels.push,
    },
    guardian,
  );
  // A judge demo on Postgres keeps its files in that database (migration 0033): each Vercel
  // instance has its own /tmp, so a file on disk is missing on the next request. Only a demo.
  if (config.filesInDatabase && !config.demo) {
    throw new ConfigError('Files are kept in the database for a judge demo only');
  }
  const files: FileStore = config.filesInDatabase
    ? new PostgresFileStore(database, { maxBytes: MAX_UPLOAD_BYTES })
    : new DiskFileStore(config.fileStoreDir);
  // My CV: the stand-in engine, which finishes each CV by itself and hands its signed webhook to
  // the same code the webhook route runs (so the whole path is exercised), unless an adapter is
  // named (a developer trying Mmereko's sandbox) or a test brings its own.
  const cvAccess = { preview: config.cvPreview };
  let cv: CvEngine | null = options.cvEngine ?? null;
  // A judge demo never calls Mmereko (D14): readConfig refuses any engine there; repeated here
  // for a Config built by hand.
  if (config.demo && config.cvProvider) {
    throw new ConfigError('A judge demo never names a CV engine: the stand-in only (D14)');
  }
  if (!cv && config.cvProvider) {
    const adapter = (options.cvAdapters ?? CV_ADAPTERS)[config.cvProvider];
    if (!adapter) throw new ConfigError(`No adapter for ${config.cvProvider}`);
    cv = adapter(env);
  }
  // demo-cv-inline: a HACKATHON EXCEPTION (2026-10-24): on a judge demo, the stand-in finishes each
  // CV at once and its jobs run in the request (demo/cv-inline.ts); there is no job runner there.
  const inline = config.demo ? new InlineCvScheduler() : null;
  if (!cv && inline) cv = new DemoCvEngine();
  // end demo-cv-inline
  if (!cv) {
    const stand: MemoryCvEngine = new MemoryCvEngine({
      webhookSecret: DEV_CV_WEBHOOK_SECRET,
      autoComplete: true,
      deliver: async (delivery) => {
        await receiveCvWebhook(
          { store, engine: stand, scheduler: jobs },
          { headers: new Headers(delivery.headers), body: delivery.body },
        );
      },
    });
    cv = stand;
  }
  const engine = cv;
  const cvHandlers = (scheduler: JobScheduler, clock?: () => Date) =>
    cvJobHandlers({
      store,
      engine,
      files,
      scheduler,
      catalogue,
      access: cvAccess,
      ...(clock ? { clock } : {}),
    });
  inline?.use(cvHandlers(inline));
  const cvScheduler: JobScheduler = inline ?? jobs;
  await seedCvDeletions(store, cvScheduler);
  // A1-88: an outline's file storage couldn't delete at once.
  const fileDeletions = fileDeletionHandler({ store, files });
  const localHandlers = [...parts.jobHandlers, fileDeletions, ...cvHandlers(jobs)];
  // The dev runner can pretend it is another time, so a reminder can be seen arriving at 10:00
  // whatever the hour on this machine (quiet hours would otherwise hold it until morning).
  const devRunDue = (at?: Date): Promise<RunReport> => {
    if (!at) return jobs.runDue(localHandlers);
    const clock = () => at;
    const runner = new PostgresJobScheduler(database, { clock });
    const handler = reminderHandler({
      store: parts.messaging,
      channels: parts.channels,
      scheduler: runner,
      papers: parts.papers,
      resolve: catalogueResolver(catalogue),
      clock,
    });
    return runner.runDue([
      handler,
      receiptCheckHandler({ store: parts.messaging, channels: parts.channels }),
      reminderSweepHandler({ store: parts.messaging, clock }),
      guardianSmsHandler({ ...guardian, scheduler: runner, clock }),
      // The store keeps the real time: a pretend `at` never sweeps a live session.
      sessionSweepHandler({ store, scheduler: runner, clock }),
      fileDeletions,
      ...cvHandlers(runner, clock),
    ]);
  };
  // A demo is public: no outbox to read, no dev job runner, no stand-in channels to look into
  // (phone sign-in and guardian SMS are off there too, docs/deploy/demo.md).
  const dev = !config.demo;
  return {
    config,
    store,
    sms,
    outbox: dev ? outbox : null,
    files,
    uploads: null,
    // With a key, local development can use the real model; without one, the stand-ins.
    reader: hasKey
      ? new AnthropicReportReader({ model: config.anthropicModel })
      : new SampleReportReader(),
    letterReader: hasKey
      ? new AnthropicLetterReader({ model: config.anthropicModel })
      : new SampleLetterReader(),
    registrationReader: hasKey
      ? new AnthropicRegistrationReader({ model: config.anthropicModel })
      : new SampleRegistrationReader(),
    outlineReader: hasKey
      ? new AnthropicModuleOutlineReader({ model: config.anthropicModel })
      : new SampleModuleOutlineReader(),
    // UF_AI_PROVIDER first, the other provider on an outage, the stand-in with no key (chat-model.ts).
    model: chatModelFor(config, env),
    jobs,
    jobRunner: jobs,
    ...parts,
    jobHandlers: localHandlers,
    // The stand-ins' signed webhooks (the dev tools and tests post to them).
    inbound: config.messagingWebhookSecret
      ? {
          sms: signedWebhookInbound(config.messagingWebhookSecret, 'sms'),
          whatsapp: signedWebhookInbound(config.messagingWebhookSecret, 'whatsapp'),
        }
      : {},
    devChannels: dev ? devChannels : null,
    devRunDue: dev ? devRunDue : null,
    replyReportAlerts: logReplyReportAlerts,
    voice,
    cv: engine,
    cvAccess,
    cvScheduler,
    database,
    catalogue,
  };
}

/**
 * One per process, kept on `globalThis`: Next bundles route handlers and pages into separate
 * chunks, each with its own copy of this module. A module-level variable would open the database
 * once per chunk, and two embedded Postgres instances on one folder don't see each other's writes.
 */
const GLOBAL = globalThis as typeof globalThis & { __ufServices?: Promise<Services> | null };

/** A plain error code: Node's (SELF_SIGNED_CERT_IN_CHAIN, ECONNREFUSED), Postgres's, or ours. */
const ERROR_CODE = /^[A-Z0-9_]{2,48}$/;

/**
 * The log line when the services can't start (the database unreachable, its certificate not
 * trusted, the learner role unusable: docs/deploy/demo.md). /api/health never opens the database,
 * so this line is how the cause shows. The error's name and code only, never its message, which
 * can carry personal data (hard rule 4).
 */
export function startupFailure(error: unknown): string {
  if (!(error instanceof Error)) return 'services could not start (unknown)';
  // The driver wraps the database's own error ("Failed query: …"), so the codes that say what to
  // fix sit in the causes (the live demo, 2026-10-24): a few levels, names and codes only.
  const parts: string[] = [];
  for (let e: unknown = error; e instanceof Error && parts.length < 4; e = e.cause) {
    const code = (e as { code?: unknown }).code;
    parts.push(`${e.name}${typeof code === 'string' && ERROR_CODE.test(code) ? ` ${code}` : ''}`);
  }
  return `services could not start (${parts.join('; caused by ')})`;
}

export function getServices(): Promise<Services> {
  GLOBAL.__ufServices ??= (async () => createServices(readConfig()))().catch((error) => {
    GLOBAL.__ufServices = null;
    // A refused configuration is logged once, with its reason, where the request is answered
    // (logConfigRefusal); this line is for the other causes.
    if (!(error instanceof ConfigError)) console.error(startupFailure(error));
    throw error;
  });
  return GLOBAL.__ufServices;
}
