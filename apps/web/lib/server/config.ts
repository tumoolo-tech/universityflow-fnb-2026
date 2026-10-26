import 'server-only';
import { adultConsent, consent } from '@universityflow/content';
import {
  adultConsentVersionNumber,
  CV_ADULT_CONSENT_VERSION,
  CV_CONSENT_VERSION,
  consentVersionNumber,
  normalisePhone,
  PHOTO_ADULT_CONSENT_VERSION,
  PHOTO_CONSENT_VERSION,
  type ReviewSignIn,
} from '@universityflow/db';
import { DemoPhoneSignupConfigError, readDemoPhoneSignup } from '../demo-phone-signup';
import {
  DEMO_SIGNUP_VARIABLES,
  DemoSignupConfigError,
  type DemoSignupSetting,
  readDemoSignup,
  readHttpsUrl,
} from '../demo-signup';
import {
  MmerekoCanvasConfigError,
  type MmerekoCanvasSetting,
  readMmerekoCanvas,
} from '../mmereko-canvas';
import { STAGING_PASSWORD_MIN_LENGTH } from '../staging-gate';
import { CV_ADAPTERS } from './cv-providers';
import { isDemo, isStaging } from './deployment';
import { JOB_ADAPTERS } from './job-providers';
import { PUSH_ADAPTERS, WHATSAPP_ADAPTERS } from './messaging-providers';
import { receivingAdapters, SMS_ADAPTERS } from './sms-providers';

/**
 * Configuration, read once from the environment. Every variable is documented in .env.example.
 *
 * Two switches make local development work without any real account (D8), and both are refused
 * in production:
 * - `UF_PROVIDERS=local`: SMS goes to an in-memory outbox, files to a local folder, and the AI
 *   is a scripted stand-in.
 * - `UF_CATALOGUE_PREVIEW=1`: show researched-but-unverified catalogue records, labelled as such.
 *   Hard rule 3 forbids this anywhere a learner could see it.
 * - `UF_CATALOGUE_E2E_FIXTURES=1`: add the synthetic draft records the E2E journeys need and the
 *   catalogue doesn't hold yet (e2e-fixtures.ts). Drafts, so shown only in preview, and labelled.
 * - `UF_MINDMAP_WORDS=1`: a learner may write their own words in a plan map, which no consent
 *   wording names yet (the owner's preview only, and a judge demo's: a hackathon exception).
 * - `UF_CV_MMEREKO_CANVAS=1` (with `UF_CV=1`): an "Open Mmereko" button on My CV for a learner 18
 *   or over or at university, opening Mmereko's own site (`MMEREKO_APP_URL`, an https origin,
 *   default https://mmereko.tumoolo.tech) in a canvas over the page. Off by default. It sends
 *   Mmereko nothing, so it is not refused anywhere `UF_CV` is allowed (the owner's choice,
 *   2026-10-24; the privacy page names it as a separate service).
 *
 * `UF_PROVIDERS=live` uses the real providers, and refuses to start unless every one of them is
 * configured: S3 (bucket, af-south-1), the SMS provider named by `UF_SMS_PROVIDER` and the job
 * scheduler named by `UF_JOBS_PROVIDER` (each must have an adapter), and the AI key. It never
 * falls back to a stand-in. WhatsApp and push are optional there: `UF_WHATSAPP_PROVIDER` and
 * `UF_PUSH_PROVIDER` turn them on, and must name an adapter that exists.
 *
 * Every live SMS and WhatsApp adapter must also receive (A5-02): a learner is told they can reply
 * STOP, so a channel whose adapter has no inbound verifier never starts. Expo push needs
 * `EXPO_ACCESS_TOKEN` (A5-03, A11-06), so a leaked push token can't put text on a learner's phone.
 *
 * Read aloud's voice is ElevenLabs only (owner's choice of 2026-10-22), in either mode: on when
 * `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` are set (`ELEVENLABS_MODEL_ID` optional), off
 * (no Read aloud button anywhere) when none is. Live, any of them without the key and the voice
 * refuses to start: never a silent fallback. The key itself is read where the voice is made
 * (services.ts), never kept here.
 */

export interface S3Config {
  readonly bucket: string;
  readonly region: string;
  /** SSE-KMS key; null means S3-managed keys (SSE-S3). */
  readonly kmsKeyId: string | null;
  readonly prefix: string;
  /** An S3-compatible server instead of AWS: local testing only, refused in production. */
  readonly endpoint: string | null;
}

/** The ElevenLabs voice Read aloud speaks in. Never the key. */
export interface VoiceConfig {
  readonly voiceId: string;
  /** Null: ElevenLabs' default model. */
  readonly modelId: string | null;
}

export interface SmsBudgetConfig {
  readonly perHour: number;
  readonly perDay: number;
}

/** How the app connects to its database beyond the URL (packages/db `ConnectionOptions`). */
export interface DatabaseConnection {
  readonly max?: number;
  readonly idleTimeoutMillis?: number;
  readonly connectionTimeoutMillis?: number;
  /** DATABASE_CA_CERT: the PEM certificate the server's must chain to, or null. */
  readonly ca: string | null;
}

export interface Config {
  readonly databaseUrl: string;
  /**
   * The pool and TLS. A demo on Postgres (Supabase's transaction pooler, docs/deploy/demo.md)
   * keeps a small pool per function instance; everything else keeps the pool as it was.
   */
  readonly databaseConnection: DatabaseConnection;
  readonly authSecret: string;
  readonly providers: 'local' | 'live';
  readonly catalogueDrafts: boolean;
  /** The E2E journeys' synthetic draft records (UF_CATALOGUE_E2E_FIXTURES); never in production. */
  readonly catalogueE2eFixtures: boolean;
  readonly fileStoreDir: string;
  /**
   * A judge demo whose DATABASE_URL is Postgres keeps its files in that database (migration
   * 0033, docs/deploy/demo.md): on Vercel each function instance has its own /tmp, so a file on
   * disk was missing on the next request. Never production (S3 only) or staging (disk).
   */
  readonly filesInDatabase: boolean;
  readonly anthropicModel: string;
  /**
   * Which provider the chat asks first (UF_AI_PROVIDER, owner's decision of 2026-10-23). Gemini
   * is refused in production until its consent wording, the privacy page and legal review exist;
   * the other provider answers when the chosen one is down and its key is set (chat-model.ts).
   * Reading documents stays with Anthropic either way.
   */
  readonly aiProvider: AiProvider;
  /** Gemini's model id (GEMINI_MODEL). Never the key, which chat-model.ts reads. */
  readonly geminiModel: string;
  readonly publicUrl: string;
  readonly production: boolean;
  /**
   * A staging site (UF_DEPLOYMENT=staging, render.yaml): a production build on synthetic data,
   * the stand-ins only, marked "Staging" on every page. Never production, never live providers.
   */
  readonly staging: boolean;
  /**
   * Judge demo mode (UF_DEPLOYMENT=demo, docs/deploy/demo.md): its own project, made-up learners
   * only, phone sign-in off, a persona picker instead; the real AI allowed. Never production,
   * never staging, never live providers (`checkDemo`).
   */
  readonly demo: boolean;
  /**
   * Demo only: AI chat messages a day across the whole demo (UF_DEMO_AI_DAILY_CAP), or null: no
   * cap (the default; the owner sets a spend limit on the AI key instead). Over it, a kind line
   * and the scripted stand-in.
   */
  readonly demoAiDailyCap: number | null;
  /**
   * Demo only: the judges' real sign-up (UF_DEMO_SIGNUP, a hackathon exception the owner approved
   * on 2026-10-23, docs/deploy/demo.md), or null: off, the demo exactly as before.
   */
  readonly demoSignup: DemoSignupSetting | null;
  /** The main site's link to the demo (NEXT_PUBLIC_UF_DEMO_URL), or null: no link. */
  readonly demoUrl: string | null;
  /** Demo only: the demo's link back to the main site (NEXT_PUBLIC_UF_MAIN_URL), or null: `/`. */
  readonly mainUrl: string | null;
  /** Set in live mode only. */
  readonly s3: S3Config | null;
  /** The live SMS adapter's name; set in live mode only. */
  readonly smsProvider: string | null;
  /** The live job scheduler's name; set in live mode only. */
  readonly jobsProvider: string | null;
  /** The live WhatsApp adapter's name, or null: WhatsApp is not offered (live mode only). */
  readonly whatsappProvider: string | null;
  /** The live push adapter's name, or null: push is not offered (live mode only). */
  readonly pushProvider: string | null;
  /**
   * Signs the stand-in channels' inbound webhooks (STOP, replies, delivery reports). A dev
   * default locally; null when unset in production, where each live provider brings its own.
   */
  readonly messagingWebhookSecret: string | null;
  /** Sign-in PINs and guardian consent links (UF_SMS_BUDGET_*), in segments. */
  readonly smsBudget: SmsBudgetConfig;
  /** Reminders (UF_SMS_REMINDER_BUDGET_*), in segments, apart from sign-in's (A5-01). */
  readonly smsReminderBudget: SmsBudgetConfig;
  /** WhatsApp template messages (UF_WHATSAPP_BUDGET_*), one unit each (A12-15). */
  readonly whatsappBudget: SmsBudgetConfig;
  /**
   * The store-review sign-in (A7-01, docs/store/review-notes.md option A), or null: there is
   * none, and the review number is an ordinary one. Works the same with live providers.
   */
  readonly review: ReviewSignIn | null;
  /** Read aloud's ElevenLabs voice, or null: no Read aloud on the web or in the app. */
  readonly voice: VoiceConfig | null;
  /**
   * The profile photo (`UF_PROFILE_PHOTO=1`, profile-look-proposal §5.3; docs/deploy/profile-photo.md).
   * While the live consent wording doesn't name it (guardian v4, adult-v3), the owner's preview
   * only: production and staging refuse it. Once that wording is live, production may turn it on;
   * staging never does. Off, /api/me/photo answers 404 (but removal) and neither app offers a photo.
   */
  readonly profilePhoto: boolean;
  /**
   * The preview stands in for the wording that names the photo (`uf.profile_photo` in the
   * database, migration 0037): true when `profilePhoto` is on and the live wording doesn't name it
   * yet. Never in production.
   */
  readonly profilePhotoPreview: boolean;
  /**
   * A HACKATHON EXCEPTION (the owner's decision, 2026-10-23): in a judge demo only
   * (`UF_DEMO_REAL_PHOTOS=1`; production and staging refuse it), a visitor may upload their own
   * photo beside the drawn samples. Kept only in their demo copy and deleted with it
   * (docs/deploy/demo.md, docs/deploy/hackathon-undo-pr.md).
   */
  readonly demoRealPhotos: boolean;
  /**
   * A HACKATHON EXCEPTION (the owner's decision, 2026-10-24): in a judge demo only
   * (`UF_DEMO_PHONE_SIGNUP=onscreen`; production and staging refuse it), judges sign up as a new
   * learner with a made-up 080 number; the PIN and a guardian's link are shown on screen, never
   * sent (lib/demo-phone-signup.ts). Off: phone sign-in answers 404 on the demo, as before.
   */
  readonly demoPhoneSignup: boolean;
  /**
   * My plan maps: whether a learner may write their own words in a map (UF_MINDMAP_WORDS=1).
   * No consent wording names plan maps yet (guardian v4 and adult-v3 are owed legal review), so
   * this is the owner's preview only, refused in production and on staging; the data layer refuses the words
   * without it (packages/db plan-maps.ts, migration 0030). Ticking works either way. A judge demo
   * may switch it on too (a HACKATHON EXCEPTION, 2026-10-24), the crisis check on every save.
   */
  readonly mindmapWords: boolean;
  /**
   * My CV (`UF_CV=1`, docs/design/mmereko-api-proposal.md): off unless set. While the live consent
   * wording is older than guardian v4 / adult-v3 it is the owner's preview only, refused in
   * production and on staging (D8). A judge demo may switch it on with the built-in stand-in
   * engine only, never Mmereko (D14; a HACKATHON EXCEPTION, 2026-10-24). Off, every CV route
   * answers 404.
   */
  readonly cv: boolean;
  /**
   * The preview stands in for the wording that names Mmereko (`uf.cv` in the database): true when
   * `cv` is on and the live wording doesn't name it yet. Never in production.
   */
  readonly cvPreview: boolean;
  /** The live CV engine's adapter (`UF_CV_PROVIDER`), or null: the in-memory stand-in. */
  readonly cvProvider: string | null;
  /** Mmereko's partner API, when it is the provider. Never its secrets (read by the adapter). */
  readonly mmereko: MmerekoConfig | null;
  /**
   * "Open Mmereko" on My CV (`UF_CV_MMEREKO_CANVAS=1`, the owner's decision of 2026-10-24;
   * lib/mmereko-canvas.ts): Mmereko's own site in a canvas over /cv, for a learner 18 or over or
   * at university, or null: off (the default), no button anywhere. Needs `UF_CV=1`. Sends Mmereko
   * nothing, so a judge demo and production may carry it; production only once My CV may.
   */
  readonly mmerekoCanvas: MmerekoCanvasSetting | null;
}

export interface MmerekoConfig {
  /** `https://<partner host>/partner/v1` (§2). */
  readonly apiUrl: string;
  readonly clientId: string;
}

/** Whether the live consent wording names Mmereko (guardian v4 and adult-v3, D8). */
export interface ConsentWording {
  readonly namesCv: boolean;
  /**
   * Whether it names the profile photo (guardian v4 and adult-v3, A11-31). Absent means no: the
   * photo stays the owner's preview.
   */
  readonly namesPhoto?: boolean;
}

/** The wording live today, read from packages/content: it doesn't name Mmereko or the photo yet. */
export const LIVE_WORDING: ConsentWording = {
  namesCv:
    (consentVersionNumber(consent.version) ?? 0) >= CV_CONSENT_VERSION &&
    (adultConsentVersionNumber(adultConsent.version) ?? 0) >= CV_ADULT_CONSENT_VERSION,
  namesPhoto:
    (consentVersionNumber(consent.version) ?? 0) >= PHOTO_CONSENT_VERSION &&
    (adultConsentVersionNumber(adultConsent.version) ?? 0) >= PHOTO_ADULT_CONSENT_VERSION,
};

export const AI_PROVIDERS = ['anthropic', 'gemini'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

/**
 * Gemini's default model: GEMINI_DEFAULT_MODEL in packages/agent (gemini-model.ts cites Google's
 * models page), kept here as a literal so the configuration doesn't load the agent; a test holds
 * the two equal.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

const DEV_SECRET = 'local-development-secret-not-for-production-use';
const DEV_WEBHOOK_SECRET = 'local-development-webhook-secret-not-for-production';

/** Student data stays in South Africa (CLAUDE.md, locked decisions). */
export const REQUIRED_S3_REGION = 'af-south-1';
/** Vercel's Cape Town region; `apps/web/vercel.json` pins every function to it. */
export const REQUIRED_FUNCTION_REGION = 'cpt1';

/**
 * Defaults for the sign-in SMS budget (open finding 1): PINs and guardian consent links. Far
 * above a normal day's sign-ins and consent links in the first cohort, far below what a scripted
 * attack would send. Counted in SMS segments (A1-14): a PIN is one, a guardian link two.
 * Placeholders: the owner sets the real numbers from the provider's pricing.
 */
export const DEFAULT_SMS_BUDGET: SmsBudgetConfig = { perHour: 300, perDay: 2000 };

/**
 * Defaults for the reminder SMS budget (A5-01, A12-08), kept apart from sign-in's so reminders
 * can never lock a learner out. Counted in segments; a reminder is one or two. A reminder it
 * refuses waits for the window to pass. Placeholders, like the sign-in budget's.
 */
export const DEFAULT_SMS_REMINDER_BUDGET: SmsBudgetConfig = { perHour: 1000, perDay: 4000 };

/**
 * Defaults for the WhatsApp budget (A12-15): Meta bills every template message, so WhatsApp is
 * capped like SMS, one unit a template (replies inside the learner's 24-hour window are free and
 * not counted). A reminder it refuses waits for the window to pass. Placeholders: the owner sets
 * the real numbers from Meta's pricing.
 */
export const DEFAULT_WHATSAPP_BUDGET: SmsBudgetConfig = { perHour: 500, perDay: 2000 };

// Lower-case, digits and hyphens, no dots: a dotted name breaks the TLS certificate of S3's
// virtual-hosted URLs, which the browser uploads to.
const BUCKET = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

/**
 * The one line the server logs for a request its configuration refused (the owner, 2026-10-23:
 * "request failed: ConfigError" alone told nobody why). A ConfigError's message is written here,
 * in this file, and names variables, never their values (a secret, a URL or a key is never
 * interpolated; at most a provider's or region's name), so it is safe in the host's log. Never
 * sent to the public: /api/health and the pages say nothing about it. It keeps the old line's
 * start, so the E2E's "no unhandled server error" check (e2e/helpers.ts) still catches it.
 */
export function logConfigRefusal(error: ConfigError): void {
  console.error(`request failed: ConfigError: ${error.message}`);
}

/**
 * Any production build counts as production (a Vercel preview, a self-hosted server), so the
 * stand-ins, the dev outbox and the dev secret are refused everywhere except this machine. The
 * one exception is a production build run locally for the E2E tests, which says so explicitly
 * with UF_LOCAL_PRODUCTION_BUILD=1, and never on a host: not on Vercel (audit 2026-10-13,
 * finding 5), and not on Render (A5-12), where the escape would skip every production check.
 */
export function isProduction(env: Record<string, string | undefined> = process.env): boolean {
  if (env['VERCEL_ENV'] || env['RENDER']) return true;
  return env['NODE_ENV'] === 'production' && env['UF_LOCAL_PRODUCTION_BUILD'] !== '1';
}

/**
 * A staging site (UF_DEPLOYMENT=staging, docs/deploy/README.md) is a production build that may
 * use the stand-ins, so `readConfig` holds it to synthetic data: local providers only, never
 * Vercel production, a real AUTH_SECRET.
 */
export { isDemo, isStaging };

const DEPLOYMENTS = ['production', 'staging', 'demo'];

/**
 * Production (and staging) are refused on a host outside South Africa that we can detect. Render
 * sets RENDER=true everywhere and has no South African region (docs/deploy/README.md), so student
 * data would be processed abroad: POPIA s72 and the locked hosting decision.
 */
function refuseHostOutsideSouthAfrica(env: Record<string, string | undefined>): void {
  if (env['RENDER']) {
    throw new ConfigError(
      'Production runs on Vercel in cpt1: Render has no South African region, so student data never goes there. Only a staging site (UF_DEPLOYMENT=staging) runs on Render',
    );
  }
}

/** Mmereko's partner API settings (docs/design/mmereko-api-proposal.md §4.1, §10.2). */
const MMEREKO_VARIABLES = [
  'UF_CV_PROVIDER',
  'MMEREKO_API_URL',
  'MMEREKO_CLIENT_ID',
  'MMEREKO_CLIENT_SECRET',
  'MMEREKO_CLIENT_SECRET_NEXT',
  'MMEREKO_WEBHOOK_SECRET',
  'MMEREKO_WEBHOOK_SECRET_NEXT',
  'MMEREKO_REGION',
] as const;

/**
 * Where Mmereko's partner cell must run for learners' CV data to stay in South Africa (D3 option
 * A; POPIA s72; the locked hosting decision). Nothing in a URL says where a service runs, so the
 * owner declares it (`MMEREKO_REGION`) once Mmereko confirms it, and anything else is refused (A11-35).
 */
const MMEREKO_REGION = 'af-south-1';

/**
 * What a staging site must never be given (A5-11 / A11-29, audit S1-A8 A8-07): the pieces live
 * mode is made of. Each is a real provider's key or setting, so a value copied from production
 * would point a test copy at real learners, the real AI or real files. AWS_* are read by the AWS
 * SDK itself, never by our code.
 */
const NOT_ON_STAGING = [
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'ELEVENLABS_API_KEY',
  'EXPO_ACCESS_TOKEN',
  'UF_MESSAGING_WEBHOOK_SECRET',
  'UF_SMS_PROVIDER',
  'UF_JOBS_PROVIDER',
  'UF_WHATSAPP_PROVIDER',
  'UF_PUSH_PROVIDER',
  'UF_REVIEW_PHONE',
  'UF_REVIEW_PIN_HASH',
  'UF_REVIEW_UNTIL',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  ...MMEREKO_VARIABLES,
] as const;

/** Staging holds synthetic data only: the embedded database, and no real provider's key. */
function refuseRealDataOnStaging(env: Record<string, string | undefined>): void {
  const database = env['DATABASE_URL'];
  if (database && !database.startsWith('pglite:')) {
    throw new ConfigError(
      'Staging runs on synthetic data only: DATABASE_URL must be the embedded database (pglite:), never a real Postgres (A5-11)',
    );
  }
  const real = [
    ...NOT_ON_STAGING.filter((name) => env[name]?.trim()),
    ...Object.keys(env).filter((name) => name.startsWith('UF_S3_') && env[name]?.trim()),
  ];
  if (real.length > 0) {
    throw new ConfigError(
      `Staging runs on synthetic data only: ${real.join(', ')} must not be set on a staging site (A5-11)`,
    );
  }
}

/** A staging site holds synthetic data only, and can't be taken for production. */
function checkStaging(
  env: Record<string, string | undefined>,
  providers: 'local' | 'live',
  authSecret: string,
): void {
  // With live providers a real learner could sign in, their report go to the real AI and their
  // files to S3, from a host that may be outside South Africa.
  if (providers === 'live') {
    throw new ConfigError(
      'Staging runs on synthetic data only: UF_PROVIDERS must be local, never live',
    );
  }
  if (env['VERCEL_ENV'] === 'production') {
    throw new ConfigError('Staging is never Vercel production: unset UF_DEPLOYMENT there');
  }
  refuseRealDataOnStaging(env);
  // On the internet, so never the development secret anyone can read in this file.
  if (authSecret.length < 32 || authSecret === DEV_SECRET) {
    throw new ConfigError('AUTH_SECRET must be a long random value on a staging site');
  }
  // The access gate (A5-10): the outbox shows every PIN, so nobody reaches staging without it.
  if ((env['UF_STAGING_PASSWORD'] ?? '').length < STAGING_PASSWORD_MIN_LENGTH) {
    throw new ConfigError(
      `A staging site needs its access gate: UF_STAGING_PASSWORD of at least ${STAGING_PASSWORD_MIN_LENGTH} characters (A5-10)`,
    );
  }
}

/**
 * What a demo must never be given (docs/deploy/demo.md): the real production project's providers,
 * keys and owner-preview switches. Each would point a public demo at real people, real files or
 * features no consent wording covers yet. The AI keys are allowed: the demo's chat is real.
 */
const NOT_ON_DEMO = [
  // ElevenLabs' key, voice and model are allowed (Read aloud, a HACKATHON EXCEPTION of
  // 2026-10-24: docs/deploy/hackathon-undo-pr.md). This production record of its approval for
  // under-18s means nothing on a demo.
  'UF_ELEVENLABS_MINORS_APPROVED',
  'EXPO_ACCESS_TOKEN',
  'UF_MESSAGING_WEBHOOK_SECRET',
  'UF_SMS_PROVIDER',
  'UF_JOBS_PROVIDER',
  'UF_WHATSAPP_PROVIDER',
  'UF_PUSH_PROVIDER',
  'UF_REVIEW_PHONE',
  'UF_REVIEW_PIN_HASH',
  'UF_REVIEW_UNTIL',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'UF_PROFILE_PHOTO',
  // UF_MINDMAP_WORDS is allowed: a HACKATHON EXCEPTION of 2026-10-24 (hackathon-undo-pr.md).
  'UF_STAGING_PASSWORD',
  'UF_CATALOGUE_E2E_FIXTURES',
  // No Mmereko call from the judge demo (D14): My CV there runs on the built-in stand-in only.
  ...MMEREKO_VARIABLES,
] as const;

/** The credentials AWS Lambda sets on every function it runs, Vercel's included. */
const LAMBDA_OWN: ReadonlySet<string> = new Set([
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
]);

/**
 * The demo's own switches: nothing but a demo may carry them. NEXT_PUBLIC_UF_DEMO_LOGOS shows the
 * universities' logos (owner's decision of 2026-10-23, for the hackathon only; lib/demo-logos.ts).
 */
const DEMO_ONLY = [
  'UF_DEMO_PROJECT',
  'UF_DEMO_DATABASE',
  'UF_DEMO_AI_DAILY_CAP',
  // The judges' real sign-up (a hackathon exception) and the demo's link back to the main site.
  ...DEMO_SIGNUP_VARIABLES,
  'NEXT_PUBLIC_UF_MAIN_URL',
  'NEXT_PUBLIC_UF_DEMO_LOGOS',
  // A visitor's own photo in their demo copy (a hackathon exception, 2026-10-23).
  'UF_DEMO_REAL_PHOTOS',
  // The on-screen phone sign-up on made-up 080 numbers (a hackathon exception, 2026-10-24).
  'UF_DEMO_PHONE_SIGNUP',
  // Vercel's own name for the secret it sends a cron job (`Authorization: Bearer`). Today the
  // only cron is the demo's scheduled sweep (A11-61, /api/demo/sweep, a hackathon exception:
  // docs/deploy/hackathon-undo-pr.md M), so nothing but a demo may carry it: production's own
  // retention job (A11-04) takes it off this list the day it is built on a cron.
  'CRON_SECRET',
] as const;

/** Vercel asks for 16 characters; ours are 32, like every other secret the app is given. */
export const MIN_CRON_SECRET_LENGTH = 32;

/**
 * Demo only: the secret Vercel sends when it invokes the demo's scheduled sweep
 * (docs/deploy/demo.md "The scheduled sweep"), or null when unset (the route then refuses and
 * logs why, and the lazy sweep is all there is). Read where it is compared, never kept in the
 * Config; set but short, the demo refuses to start.
 */
export function readCronSecret(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const secret = env['CRON_SECRET']?.trim();
  if (!secret) return null;
  if (secret.length < MIN_CRON_SECRET_LENGTH) {
    throw new ConfigError(
      `CRON_SECRET must be at least ${MIN_CRON_SECRET_LENGTH} random characters (docs/deploy/demo.md, "The scheduled sweep")`,
    );
  }
  return secret;
}

/** Production and staging never carry a demo's switches (a demo setting copied by mistake). */
function refuseDemoMarkers(env: Record<string, string | undefined>, where: string): void {
  const set = DEMO_ONLY.filter((name) => env[name]?.trim());
  if (set.length > 0) {
    throw new ConfigError(`${set.join(', ')} belong to a demo deployment, never ${where}`);
  }
}

/**
 * What Vercel's Supabase integration sets in a project, never read as the database: the app reads
 * DATABASE_URL only (docs/deploy/demo.md says to copy the pooler string there by hand).
 */
const INTEGRATION_DATABASE_VARIABLES = [
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL_NON_POOLING',
] as const;

/** URL settings under which node-postgres encrypts the connection. */
const TLS_SSLMODES = ['require', 'verify-ca', 'verify-full', 'no-verify'];

/** Whether a Postgres URL asks for TLS (`sslmode=require` and stronger, or `ssl=true`). */
function urlAsksForTls(url: string): boolean {
  try {
    const { searchParams } = new URL(url);
    return (
      TLS_SSLMODES.includes(searchParams.get('sslmode') ?? '') ||
      ['true', '1'].includes(searchParams.get('ssl') ?? '')
    );
  } catch {
    return false;
  }
}

/** A Postgres on this machine (a demo run locally on Docker's), where TLS adds nothing. */
function isLocalDatabase(url: string): boolean {
  try {
    return ['localhost', '127.0.0.1', '[::1]', ''].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * DATABASE_CA_CERT: the PEM certificate the database server's must chain to (Supabase's root CA,
 * from its dashboard; Node does not trust it). Pasted on one line, `\n` stands for line breaks.
 */
function readDatabaseCa(env: Record<string, string | undefined>): string | null {
  const value = env['DATABASE_CA_CERT']?.trim();
  if (!value) return null;
  const pem = value.replace(/\\n/g, '\n');
  if (!/^-----BEGIN CERTIFICATE-----\n[\s\S]+\n-----END CERTIFICATE-----$/.test(pem)) {
    throw new ConfigError(
      'DATABASE_CA_CERT must be the certificate itself (PEM: -----BEGIN CERTIFICATE----- …), not a file name',
    );
  }
  return pem;
}

/**
 * A demo on Postgres runs in serverless function instances, each with its own pool, through
 * Supabase's transaction pooler (docs/deploy/demo.md): a few connections each, let go when idle,
 * and a pooler that doesn't answer is an error within seconds rather than a hung request.
 *
 * The pooler is in London and the functions in Cape Town, about 160 ms apart, and a new connection
 * costs five or six round trips (TCP, TLS, sign-in) before its first query. So (the slow start,
 * 2026-10-25): ten connections, enough for a learner's copy to be written and the home's reads to
 * run side by side; and kept 30 s, so a judge's next click finds them open. Idle connections hold
 * no server connection in transaction mode.
 */
export const DEMO_DATABASE_POOL = {
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
} as const;

/**
 * Judge demo mode (UF_DEPLOYMENT=demo): its own Vercel project, made-up learners only. Never live
 * providers, never production's keys or switches; its own marker, so the production project can't
 * become a demo by one variable; a database that is the embedded one or a Postgres the owner made
 * for the demo and says so.
 */
function checkDemo(
  env: Record<string, string | undefined>,
  providers: 'local' | 'live',
  authSecret: string,
): void {
  if (providers === 'live') {
    throw new ConfigError('A demo runs on made-up learners only: UF_PROVIDERS must be local');
  }
  if (env['UF_DEMO_PROJECT'] !== '1') {
    throw new ConfigError(
      'A demo runs in its own project, never production’s: set UF_DEMO_PROJECT=1 there (docs/deploy/demo.md)',
    );
  }
  // On Vercel the AWS trio is AWS Lambda's own, set on every function; Vercel reserves the names,
  // so a project can't set them, and they are never our keys (UF_S3_* still is refused below).
  const onVercel = env['VERCEL'] === '1';
  const real = [
    ...NOT_ON_DEMO.filter((name) => env[name]?.trim() && !(onVercel && LAMBDA_OWN.has(name))),
    ...Object.keys(env).filter((name) => name.startsWith('UF_S3_') && env[name]?.trim()),
  ];
  if (real.length > 0) {
    throw new ConfigError(
      `A demo runs on made-up learners only: ${real.join(', ')} must not be set on a demo`,
    );
  }
  const database = env['DATABASE_URL'];
  if (database && !database.startsWith('pglite:') && env['UF_DEMO_DATABASE'] !== 'synthetic') {
    throw new ConfigError(
      'A demo’s Postgres must be one made for the demo, holding made-up learners only: say so with UF_DEMO_DATABASE=synthetic, or use the embedded database (pglite:)',
    );
  }
  // Vercel's Supabase integration sets these, never DATABASE_URL: without this the demo would
  // quietly use the embedded database in /tmp, one per instance, and sign judges out.
  const integration = INTEGRATION_DATABASE_VARIABLES.filter((name) => env[name]?.trim());
  if (!database && integration.length > 0) {
    throw new ConfigError(
      `${integration.join(', ')} is set but the app reads only DATABASE_URL: set DATABASE_URL to the transaction pooler's connection string (docs/deploy/demo.md)`,
    );
  }
  if (database && /^postgres(ql)?:\/\//.test(database) && !isLocalDatabase(database)) {
    if (!readDatabaseCa(env) && !urlAsksForTls(database)) {
      throw new ConfigError(
        'A demo’s Postgres across the internet needs TLS: add ?sslmode=verify-full and set DATABASE_CA_CERT to the host’s CA certificate (docs/deploy/demo.md)',
      );
    }
  }
  if (authSecret.length < 32 || authSecret === DEV_SECRET) {
    throw new ConfigError('AUTH_SECRET must be a long random value on a demo');
  }
}

/** Demo only: the optional daily cap on AI chat messages; unset or empty is no cap. */
function readDemoAiDailyCap(env: Record<string, string | undefined>): number | null {
  const value = env['UF_DEMO_AI_DAILY_CAP']?.trim();
  if (!value) return null;
  return positiveInteger(value, 0, 'UF_DEMO_AI_DAILY_CAP');
}

/**
 * Demo only: the judges' real sign-up (lib/demo-signup.ts). The fake stands in for Firebase on this
 * machine only (the demo E2E): on a host it would let anyone sign in as anyone.
 */
function readDemoSignupSetting(env: Record<string, string | undefined>): DemoSignupSetting | null {
  let setting: DemoSignupSetting | null;
  try {
    setting = readDemoSignup(env);
  } catch (error) {
    if (error instanceof DemoSignupConfigError) throw new ConfigError(error.message);
    throw error;
  }
  if (setting?.mode === 'fake' && (env['VERCEL_ENV'] || env['RENDER'])) {
    throw new ConfigError(
      'UF_DEMO_SIGNUP=fake signs anyone in as anyone: this machine only, never on a host. Use firebase',
    );
  }
  return setting;
}

/**
 * Demo only: the on-screen phone sign-up (lib/demo-phone-signup.ts, a hackathon exception of
 * 2026-10-24). refuseDemoMarkers already stopped anything but a demo from carrying it.
 */
function readDemoPhoneSignupSetting(env: Record<string, string | undefined>): boolean {
  try {
    return readDemoPhoneSignup(env);
  } catch (error) {
    if (error instanceof DemoPhoneSignupConfigError) throw new ConfigError(error.message);
    throw error;
  }
}

/** An https URL setting for the switch between the main site and the demo, or null when unset. */
function readUrl(
  env: Record<string, string | undefined>,
  name: 'NEXT_PUBLIC_UF_DEMO_URL' | 'NEXT_PUBLIC_UF_MAIN_URL',
): string | null {
  try {
    return readHttpsUrl(env, name);
  } catch (error) {
    if (error instanceof DemoSignupConfigError) throw new ConfigError(error.message);
    throw error;
  }
}

function positiveInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1)
    throw new ConfigError(`${name} must be a whole number above 0`);
  return n;
}

function readSmsBudget(
  env: Record<string, string | undefined>,
  prefix: 'UF_SMS_BUDGET' | 'UF_SMS_REMINDER_BUDGET' | 'UF_WHATSAPP_BUDGET',
  defaults: SmsBudgetConfig,
): SmsBudgetConfig {
  const hour = `${prefix}_PER_HOUR`;
  const day = `${prefix}_PER_DAY`;
  const perHour = positiveInteger(env[hour], defaults.perHour, hour);
  const perDay = positiveInteger(env[day], defaults.perDay, day);
  if (perHour > perDay) throw new ConfigError(`${hour} cannot be more than ${day}`);
  return { perHour, perDay };
}

function readS3(env: Record<string, string | undefined>, production: boolean): S3Config {
  const bucket = env['UF_S3_BUCKET'];
  if (!bucket) throw new ConfigError('Live file storage needs UF_S3_BUCKET');
  if (!BUCKET.test(bucket)) {
    throw new ConfigError('UF_S3_BUCKET must be lower-case letters, digits and hyphens');
  }
  const region = env['UF_S3_REGION'] || REQUIRED_S3_REGION;
  const endpoint = env['UF_S3_ENDPOINT'] || null;
  const prefix = env['UF_S3_PREFIX'] ?? 'documents/';
  if (!/^(?:[a-z0-9][a-z0-9-]*\/)*$/.test(prefix)) {
    throw new ConfigError('UF_S3_PREFIX must be lower-case folders, each ending in /');
  }
  if (production) {
    if (region !== REQUIRED_S3_REGION) {
      throw new ConfigError(
        `Student files stay in South Africa: UF_S3_REGION must be ${REQUIRED_S3_REGION}`,
      );
    }
    if (endpoint)
      throw new ConfigError('UF_S3_ENDPOINT is for local testing; production uses AWS S3');
  }
  return { bucket, region, kmsKeyId: env['UF_S3_KMS_KEY_ID'] || null, prefix, endpoint };
}

/** A live adapter's name, which must be one that exists. */
function readAdapter(
  variable: string,
  provider: string | undefined,
  missing: string,
  available: ReadonlyArray<string>,
): string {
  if (!provider) throw new ConfigError(missing);
  if (!available.includes(provider)) {
    throw new ConfigError(
      `${variable}=${provider} has no adapter yet. Available: ${available.join(', ') || 'none'}`,
    );
  }
  return provider;
}

/** An optional live adapter: unset is fine (the channel isn't offered); a name must exist. */
function readOptionalAdapter(
  variable: string,
  provider: string | undefined,
  available: ReadonlyArray<string>,
): string | null {
  if (!provider) return null;
  return readAdapter(variable, provider, '', available);
}

function readWebhookSecret(
  env: Record<string, string | undefined>,
  production: boolean,
): string | null {
  const secret = env['UF_MESSAGING_WEBHOOK_SECRET'];
  if (!secret) return production ? null : DEV_WEBHOOK_SECRET;
  if (secret.length < 32 || secret === DEV_WEBHOOK_SECRET) {
    throw new ConfigError('UF_MESSAGING_WEBHOOK_SECRET must be at least 32 random characters');
  }
  return secret;
}

/** The longest review window a configuration may set: one submission's review, not a season. */
export const MAX_REVIEW_WINDOW_DAYS = 31;

const REVIEW_VARIABLES = ['UF_REVIEW_PHONE', 'UF_REVIEW_PIN_HASH', 'UF_REVIEW_UNTIL'] as const;

/**
 * The store-review sign-in (A7-01). Off unless all three variables are set; any one without the
 * others is a mistake, and refuses to start rather than half-work. The PIN is only ever a hash
 * (`reviewPinHash` in packages/db: the same keyed hash as every PIN), and the window must end:
 * UF_REVIEW_UNTIL is required, is the last day (to its end, South African time), and is at most
 * `MAX_REVIEW_WINDOW_DAYS` away.
 */
function readReview(env: Record<string, string | undefined>, now: Date): ReviewSignIn | null {
  const set = REVIEW_VARIABLES.filter((name) => env[name]);
  if (set.length === 0) return null;
  if (set.length < REVIEW_VARIABLES.length) {
    throw new ConfigError(
      'The store-review sign-in needs UF_REVIEW_PHONE, UF_REVIEW_PIN_HASH and UF_REVIEW_UNTIL together, or none of them',
    );
  }
  let phone: string;
  try {
    phone = normalisePhone(env['UF_REVIEW_PHONE'] ?? '');
  } catch {
    throw new ConfigError('UF_REVIEW_PHONE must be a South African cellphone number');
  }
  const pinHash = env['UF_REVIEW_PIN_HASH'] ?? '';
  if (!/^[0-9a-f]{64}$/.test(pinHash)) {
    throw new ConfigError(
      'UF_REVIEW_PIN_HASH must be the PIN’s hash (64 lower-case hex digits), never the PIN',
    );
  }
  const day = env['UF_REVIEW_UNTIL'] ?? '';
  const until = new Date(`${day}T23:59:59.999+02:00`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    Number.isNaN(until.getTime()) ||
    until.toISOString().slice(0, 10) !== day
  ) {
    throw new ConfigError('UF_REVIEW_UNTIL must be a date, YYYY-MM-DD');
  }
  if (until.getTime() - now.getTime() > MAX_REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
    throw new ConfigError(`UF_REVIEW_UNTIL must be at most ${MAX_REVIEW_WINDOW_DAYS} days away`);
  }
  return { phone, pinHash, until };
}

const VOICE_VARIABLES = [
  'ELEVENLABS_API_KEY',
  'ELEVENLABS_VOICE_ID',
  'ELEVENLABS_MODEL_ID',
] as const;
const VOICE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const MODEL_ID = /^[a-z0-9_.-]{1,64}$/;

/**
 * Read aloud's voice. Off when nothing is set. Live, anything set must be complete; locally, a
 * voice without a key is simply off (a developer without a key), but a key without a voice is a
 * mistake either way.
 */
function readVoice(env: Record<string, string | undefined>, live: boolean): VoiceConfig | null {
  const key = env['ELEVENLABS_API_KEY']?.trim();
  const voiceId = env['ELEVENLABS_VOICE_ID']?.trim();
  const modelId = env['ELEVENLABS_MODEL_ID']?.trim() || null;
  const set = VOICE_VARIABLES.filter((name) => env[name]?.trim());
  if (set.length === 0) return null;
  if (key && !voiceId) {
    throw new ConfigError(
      'ELEVENLABS_API_KEY is set without ELEVENLABS_VOICE_ID, the voice Read aloud speaks in',
    );
  }
  if (!key) {
    if (live) {
      throw new ConfigError(
        `Read aloud is switched on (${set.join(', ')}) without ELEVENLABS_API_KEY: set the key, or unset them all to turn Read aloud off`,
      );
    }
    return null;
  }
  if (!VOICE_ID.test(voiceId ?? '')) {
    throw new ConfigError(
      'ELEVENLABS_VOICE_ID must be an ElevenLabs voice id (letters and digits)',
    );
  }
  if (modelId && !MODEL_ID.test(modelId)) {
    throw new ConfigError(
      'ELEVENLABS_MODEL_ID must be an ElevenLabs model id, such as eleven_multilingual_v2',
    );
  }
  return { voiceId: voiceId as string, modelId };
}

/**
 * The chat model's provider (owner's decision of 2026-10-23: Gemini for the judge demo first).
 * Production refuses Gemini outright, its key included, since with the key set an Anthropic
 * outage would send learners' messages there: a new operator outside South Africa needs its
 * consent wording, the privacy page naming it and legal review first (POPIA s72, A11).
 * Locally, on a local production build and on a staging site (where its key is refused, A5-11,
 * so the stand-in answers) it may be chosen.
 */
function readAiProvider(env: Record<string, string | undefined>, production: boolean): AiProvider {
  const value = env['UF_AI_PROVIDER'] || 'anthropic';
  if (!(AI_PROVIDERS as ReadonlyArray<string>).includes(value)) {
    throw new ConfigError(
      `UF_AI_PROVIDER must be ${AI_PROVIDERS.join(' or ')}, or unset (anthropic)`,
    );
  }
  const provider = value as AiProvider;
  if (production && provider === 'gemini') {
    throw new ConfigError(
      'UF_AI_PROVIDER=gemini: Gemini is refused in production until its consent wording, the privacy page and legal review name it as an operator',
    );
  }
  if (production && env['GEMINI_API_KEY']?.trim()) {
    throw new ConfigError(
      'GEMINI_API_KEY is refused in production: an outage would send learners’ messages to Gemini, which no consent wording or privacy page names yet',
    );
  }
  return provider;
}

/** The live adapters that exist, by provider. */
export interface AvailableAdapters {
  readonly sms: ReadonlyArray<string>;
  readonly jobs: ReadonlyArray<string>;
  readonly whatsapp?: ReadonlyArray<string>;
  readonly push?: ReadonlyArray<string>;
  /** The live CV engines (cv-providers.ts): none until Mmereko's sandbox passes the contract. */
  readonly cv?: ReadonlyArray<string>;
  /**
   * The SMS and WhatsApp adapters that also receive: an inbound verifier for STOP, replies and
   * delivery reports (A5-02). A live channel whose adapter isn't listed here refuses to start.
   */
  readonly inbound?: {
    readonly sms?: ReadonlyArray<string>;
    readonly whatsapp?: ReadonlyArray<string>;
  };
}

/** A live channel a learner can reply STOP on must be able to hear it (A5-02). */
function requireInbound(
  variable: string,
  provider: string | null,
  receiving: ReadonlyArray<string>,
): void {
  if (provider && !receiving.includes(provider)) {
    throw new ConfigError(
      `${variable}=${provider} can send but not receive: its adapter has no inbound verifier, so a learner's STOP would reach nothing (A5-02)`,
    );
  }
}

/**
 * `adapters` lists the live adapters that exist; tests pass their own, since none is written
 * until the owner chooses the providers.
 */
export function readConfig(
  env: Record<string, string | undefined> = process.env,
  adapters: AvailableAdapters = {
    sms: Object.keys(SMS_ADAPTERS),
    jobs: Object.keys(JOB_ADAPTERS),
    whatsapp: Object.keys(WHATSAPP_ADAPTERS),
    push: Object.keys(PUSH_ADAPTERS),
    cv: Object.keys(CV_ADAPTERS),
    inbound: {
      sms: receivingAdapters(SMS_ADAPTERS),
      whatsapp: receivingAdapters(WHATSAPP_ADAPTERS),
    },
  },
  /** Today, for the review window's limit; tests pass their own. */
  now: Date = new Date(),
  /** Whether the live wording names Mmereko; tests pass their own. */
  wording: ConsentWording = LIVE_WORDING,
): Config {
  const deployment = env['UF_DEPLOYMENT'];
  if (deployment && !DEPLOYMENTS.includes(deployment)) {
    throw new ConfigError('UF_DEPLOYMENT must be staging or demo, or unset (production)');
  }
  const staging = isStaging(env);
  const demo = isDemo(env);
  // A staging or demo build is a production build, but never production: it runs on the stand-ins.
  const production = isProduction(env) && !staging && !demo;
  const providers = env['UF_PROVIDERS'] === 'live' ? 'live' : 'local';
  const catalogueDrafts = env['UF_CATALOGUE_PREVIEW'] === '1';
  const catalogueE2eFixtures = env['UF_CATALOGUE_E2E_FIXTURES'] === '1';
  const profilePhoto = env['UF_PROFILE_PHOTO'] === '1';
  const mindmapWords = env['UF_MINDMAP_WORDS'] === '1';
  const authSecret = env['AUTH_SECRET'] ?? (production || staging || demo ? '' : DEV_SECRET);
  const aiProvider = readAiProvider(env, production);

  if (staging) checkStaging(env, providers, authSecret);
  // On Render, only a staging site runs, whatever else is set (A5-12).
  else refuseHostOutsideSouthAfrica(env);
  if (demo) checkDemo(env, providers, authSecret);
  else refuseDemoMarkers(env, staging ? 'on a staging site' : 'in production');
  // The scheduled sweep's secret (A11-61): a demo starts without one, never with a short one.
  if (demo) readCronSecret(env);
  const demoAiDailyCap = demo ? readDemoAiDailyCap(env) : null;
  const demoSignup = demo ? readDemoSignupSetting(env) : null;
  const demoUrl = readUrl(env, 'NEXT_PUBLIC_UF_DEMO_URL');
  const mainUrl = demo ? readUrl(env, 'NEXT_PUBLIC_UF_MAIN_URL') : null;
  const demoPhoneSignup = demo && readDemoPhoneSignupSetting(env);

  // No learner's photo until the consent wording names it (guardian v4, adult-v3; legal review,
  // A11-31): production refuses the switch until that wording is live, and the database refuses a
  // photo under older wording anyway (migration 0037). Never on a staging site (a production build
  // on a host that may be outside South Africa, synthetic data only). Before the wording is live,
  // only the owner's own local or preview build turns it on, as a preview.
  if (profilePhoto && staging) {
    throw new ConfigError(
      'The profile photo is never on a staging site: UF_PROFILE_PHOTO is refused there (synthetic data only, a host that may be outside South Africa)',
    );
  }
  if (profilePhoto && production && !wording.namesPhoto) {
    throw new ConfigError(
      'The profile photo waits for consent v4 and adult-v3 naming it: UF_PROFILE_PHOTO is refused in production until that wording is live and legally reviewed (A11-31, docs/deploy/profile-photo.md)',
    );
  }
  const profilePhotoPreview = profilePhoto && !wording.namesPhoto;

  // A learner's own words in a plan map wait for consent wording that names them (guardian v4,
  // adult-v3; legal review): never in production, nor on a staging site (a production build that
  // may be outside South Africa). Only the owner's own local or preview build turns them on, and
  // a judge demo on made-up learners (a hackathon exception, 2026-10-24).
  if (mindmapWords && (production || staging)) {
    throw new ConfigError(
      `UF_MINDMAP_WORDS is the owner’s preview only, refused ${staging ? 'on a staging site' : 'in production'}: no consent wording names plan maps yet`,
    );
  }

  const cvSwitch = readCv(env, { production, staging, demo, providers }, adapters, wording);
  const mmerekoCanvas = readMmerekoCanvasSetting(env, cvSwitch.cv);

  if (production) {
    if (providers !== 'live')
      throw new ConfigError('Production must use live providers (UF_PROVIDERS=live)');
    if (catalogueDrafts)
      throw new ConfigError('Unverified catalogue data is never shown in production');
    if (catalogueE2eFixtures)
      throw new ConfigError('The E2E catalogue fixtures are never used in production');
    if (authSecret.length < 32 || authSecret === DEV_SECRET) {
      throw new ConfigError('AUTH_SECRET must be a long random value in production');
    }
    if (!env['DATABASE_URL']?.startsWith('postgres')) {
      throw new ConfigError('Production needs a Postgres DATABASE_URL');
    }
    // A11-30: Read aloud sends words to ElevenLabs for every learner, most of them under 18. The
    // privacy page promises it stays off for learners until ElevenLabs' written approval for
    // under-18s exists, so production needs that recorded before the key may be set.
    if (env['ELEVENLABS_API_KEY']?.trim() && env['UF_ELEVENLABS_MINORS_APPROVED'] !== '1') {
      throw new ConfigError(
        'Read aloud stays off for learners until ElevenLabs approves under-18s in writing: set UF_ELEVENLABS_MINORS_APPROVED=1 only then, or unset ELEVENLABS_API_KEY (A11-30)',
      );
    }
    // vercel.json pins the region, but a dashboard override would win silently. Vercel names the
    // region a function runs in; outside Cape Town, refuse rather than process student data there.
    const region = env['VERCEL_REGION'];
    if (region && region !== REQUIRED_FUNCTION_REGION) {
      throw new ConfigError(
        `Student data is processed in South Africa: functions must run in ${REQUIRED_FUNCTION_REGION}, not ${region}`,
      );
    }
  }

  const smsBudget = readSmsBudget(env, 'UF_SMS_BUDGET', DEFAULT_SMS_BUDGET);
  const smsReminderBudget = readSmsBudget(
    env,
    'UF_SMS_REMINDER_BUDGET',
    DEFAULT_SMS_REMINDER_BUDGET,
  );
  const whatsappBudget = readSmsBudget(env, 'UF_WHATSAPP_BUDGET', DEFAULT_WHATSAPP_BUDGET);
  // Independent of UF_PROVIDERS: never a stand-in, and the same in live and local mode.
  const review = readReview(env, now);
  const voice = readVoice(env, providers === 'live');
  let s3: S3Config | null = null;
  let smsProvider: string | null = null;
  let jobsProvider: string | null = null;
  let whatsappProvider: string | null = null;
  let pushProvider: string | null = null;
  // A demo is public and has no messaging channels anyone replies on: no development secret.
  const messagingWebhookSecret = readWebhookSecret(env, production || demo);
  if (providers === 'live') {
    // WhatsApp and push are optional: without an adapter the channel simply isn't offered (the
    // MVP launches on SMS). Named, they must exist: never a stand-in in their place.
    whatsappProvider = readOptionalAdapter(
      'UF_WHATSAPP_PROVIDER',
      env['UF_WHATSAPP_PROVIDER'],
      adapters.whatsapp ?? [],
    );
    pushProvider = readOptionalAdapter(
      'UF_PUSH_PROVIDER',
      env['UF_PUSH_PROVIDER'],
      adapters.push ?? [],
    );
    s3 = readS3(env, production);
    smsProvider = readAdapter(
      'UF_SMS_PROVIDER',
      env['UF_SMS_PROVIDER'],
      'Live SMS needs UF_SMS_PROVIDER, the provider to send with',
      adapters.sms,
    );
    // Scheduled jobs: the Postgres queue is a stand-in, so live mode never falls back to it.
    jobsProvider = readAdapter(
      'UF_JOBS_PROVIDER',
      env['UF_JOBS_PROVIDER'],
      'Live mode needs UF_JOBS_PROVIDER, the job scheduler to use',
      adapters.jobs,
    );
    // Every message we send says "reply STOP": a channel that can't hear it never starts (A5-02).
    requireInbound('UF_SMS_PROVIDER', smsProvider, adapters.inbound?.sms ?? []);
    requireInbound('UF_WHATSAPP_PROVIDER', whatsappProvider, adapters.inbound?.whatsapp ?? []);
    // Without Expo's enhanced push security, a push token is a send credential: anyone holding one
    // could put any text on a minor's lock screen under our name (A5-03, A11-06).
    if (pushProvider === 'expo' && !env['EXPO_ACCESS_TOKEN']?.trim()) {
      throw new ConfigError(
        'UF_PUSH_PROVIDER=expo needs EXPO_ACCESS_TOKEN, with enhanced push security turned on for the Expo project (A5-03)',
      );
    }
    // The scripted AI is a stand-in too: live mode never falls back to it. The key itself is
    // read by the Anthropic SDK, never kept here.
    if (!env['ANTHROPIC_API_KEY']) throw new ConfigError('Live mode needs ANTHROPIC_API_KEY');
    if (aiProvider === 'gemini' && !env['GEMINI_API_KEY']?.trim()) {
      throw new ConfigError('UF_AI_PROVIDER=gemini in live mode needs GEMINI_API_KEY');
    }
  }

  // A1-50: every guardian consent link and every link in an SMS starts with UF_PUBLIC_URL. Unset,
  // it is http://localhost:3000, and no guardian could ever answer: production needs its own.
  if (production) readProductionUrl(env);

  // A demo on Vercel with no database of its own: the embedded one, in /tmp, the only folder a
  // function may write (each instance its own: docs/deploy/demo.md recommends a Postgres).
  const tmp = demo && Boolean(env['VERCEL_ENV']);
  const databaseUrl =
    env['DATABASE_URL'] ?? (tmp ? 'pglite:/tmp/universityflow-demo/db' : 'pglite:./.data/pglite');
  const postgres = /^postgres(ql)?:\/\//.test(databaseUrl);
  const databaseCa = postgres ? readDatabaseCa(env) : null;
  return {
    databaseUrl,
    databaseConnection:
      demo && postgres ? { ...DEMO_DATABASE_POOL, ca: databaseCa } : { ca: databaseCa },
    authSecret,
    providers,
    catalogueDrafts,
    catalogueE2eFixtures,
    fileStoreDir:
      env['UF_FILE_STORE_DIR'] ?? (tmp ? '/tmp/universityflow-demo/files' : './.data/files'),
    // Shared by every instance, unlike /tmp. checkDemo already holds a demo's Postgres to one
    // made for it (UF_DEMO_DATABASE=synthetic).
    filesInDatabase: demo && postgres,
    anthropicModel: env['ANTHROPIC_MODEL'] ?? 'claude-opus-5',
    aiProvider,
    geminiModel: env['GEMINI_MODEL']?.trim() || DEFAULT_GEMINI_MODEL,
    publicUrl: (env['UF_PUBLIC_URL'] ?? 'http://localhost:3000').replace(/\/$/, ''),
    production,
    staging,
    demo,
    demoAiDailyCap,
    demoSignup,
    demoUrl,
    mainUrl,
    s3,
    smsProvider,
    jobsProvider,
    whatsappProvider,
    pushProvider,
    messagingWebhookSecret,
    smsBudget,
    smsReminderBudget,
    whatsappBudget,
    review,
    voice,
    profilePhoto,
    profilePhotoPreview,
    // refuseDemoMarkers already stopped anything but a demo from carrying it.
    demoRealPhotos: demo && env['UF_DEMO_REAL_PHOTOS'] === '1',
    demoPhoneSignup,
    mindmapWords,
    ...cvSwitch,
    mmerekoCanvas,
  };
}

/**
 * "Open Mmereko" on My CV (lib/mmereko-canvas.ts): only with `UF_CV=1`, since the canvas lives on
 * /cv; otherwise the switch would do nothing and hide a mistake.
 */
function readMmerekoCanvasSetting(
  env: Record<string, string | undefined>,
  cv: boolean,
): MmerekoCanvasSetting | null {
  let setting: MmerekoCanvasSetting | null;
  try {
    setting = readMmerekoCanvas(env);
  } catch (error) {
    if (error instanceof MmerekoCanvasConfigError) throw new ConfigError(error.message);
    throw error;
  }
  if (setting && !cv) {
    throw new ConfigError(
      'UF_CV_MMEREKO_CANVAS=1 needs UF_CV=1: the "Open Mmereko" button lives on My CV',
    );
  }
  return setting;
}

/** Production's own address (A1-50): a plain https URL that isn't this machine. */
function readProductionUrl(env: Record<string, string | undefined>): void {
  const value = env['UF_PUBLIC_URL']?.trim() ?? '';
  const refuse = () =>
    new ConfigError(
      'Production needs UF_PUBLIC_URL, its own https address (no path, query or localhost): every guardian link and SMS link starts with it (A1-50)',
    );
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw refuse();
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  ) {
    throw refuse();
  }
}

const MIN_MMEREKO_SECRET_LENGTH = 32;

/**
 * My CV's switch and engine (D8, D14). `UF_CV=1` is refused in production and on staging while
 * the live wording doesn't name Mmereko: there it is the owner's preview (and, a hackathon
 * exception, a judge demo's, on made-up learners), on the stand-in, with `cvPreview` standing in
 * for the wording. Once the wording names it, the engine is
 * the adapter `UF_CV_PROVIDER` names (which must exist, never a fallback; live mode needs one), with
 * every Mmereko setting present and sound. The secrets themselves stay in the environment.
 */
function readCv(
  env: Record<string, string | undefined>,
  where: {
    readonly production: boolean;
    readonly staging: boolean;
    readonly demo: boolean;
    readonly providers: 'local' | 'live';
  },
  adapters: AvailableAdapters,
  wording: ConsentWording,
): Pick<Config, 'cv' | 'cvPreview' | 'cvProvider' | 'mmereko'> {
  const cv = env['UF_CV'] === '1';
  const provider = env['UF_CV_PROVIDER']?.trim() || null;
  if (provider && !cv) {
    throw new ConfigError('UF_CV_PROVIDER is set without UF_CV=1: set both, or neither');
  }
  if (!cv) return { cv: false, cvPreview: false, cvProvider: null, mmereko: null };
  // A HACKATHON EXCEPTION (the owner, 2026-10-24; docs/deploy/hackathon-undo-pr.md): a judge demo
  // may show My CV, on the built-in stand-in engine only. It never calls Mmereko (D14): no engine
  // may be named there (checkDemo refuses Mmereko's settings too), and services.ts runs the
  // stand-in's jobs at once, in the request (lib/server/demo/cv-inline.ts).
  if (where.demo) {
    if (provider) {
      throw new ConfigError(
        'UF_CV_PROVIDER is refused on a demo: the judge demo never calls Mmereko (D14); My CV there uses the built-in stand-in',
      );
    }
    return { cv, cvPreview: !wording.namesCv, cvProvider: null, mmereko: null };
  }
  if (!wording.namesCv && (where.production || where.staging)) {
    throw new ConfigError(
      `UF_CV waits for consent v4 and adult-v3 naming Mmereko: refused ${where.staging ? 'on a staging site' : 'in production'} until that wording is live (D8)`,
    );
  }
  if (where.providers === 'live' && !provider) {
    throw new ConfigError('UF_CV=1 in live mode needs UF_CV_PROVIDER, the CV engine to use');
  }
  if (!provider) return { cv, cvPreview: !wording.namesCv, cvProvider: null, mmereko: null };
  readAdapter('UF_CV_PROVIDER', provider, '', adapters.cv ?? []);
  let mmereko: MmerekoConfig | null = null;
  if (provider === 'mmereko') {
    for (const name of [
      'MMEREKO_API_URL',
      'MMEREKO_CLIENT_ID',
      'MMEREKO_CLIENT_SECRET',
      'MMEREKO_WEBHOOK_SECRET',
    ]) {
      if (!env[name]?.trim()) throw new ConfigError(`UF_CV_PROVIDER=mmereko needs ${name}`);
    }
    for (const name of [
      'MMEREKO_CLIENT_SECRET',
      'MMEREKO_CLIENT_SECRET_NEXT',
      'MMEREKO_WEBHOOK_SECRET',
      'MMEREKO_WEBHOOK_SECRET_NEXT',
    ]) {
      const value = env[name]?.trim();
      if (value && value.length < MIN_MMEREKO_SECRET_LENGTH) {
        throw new ConfigError(`${name} must be at least ${MIN_MMEREKO_SECRET_LENGTH} characters`);
      }
    }
    const apiUrl = (env['MMEREKO_API_URL'] ?? '').trim().replace(/\/$/, '');
    let url: URL;
    try {
      url = new URL(apiUrl);
    } catch {
      throw new ConfigError('MMEREKO_API_URL must be a URL');
    }
    if (url.protocol !== 'https:') throw new ConfigError('MMEREKO_API_URL must be https');
    // Real learners' data goes to Mmereko only from Cape Town's partner cell (A11-35). A developer
    // trying the sandbox (synthetic data only, by the agreement) on a local run is not held to it.
    if (
      (where.production || where.providers === 'live') &&
      env['MMEREKO_REGION'] !== MMEREKO_REGION
    ) {
      throw new ConfigError(
        `UF_CV_PROVIDER=mmereko needs MMEREKO_REGION=${MMEREKO_REGION}: learners' CV data stays in South Africa (D3, POPIA s72). Set it only once Mmereko confirms its partner cell runs there`,
      );
    }
    const clientId = (env['MMEREKO_CLIENT_ID'] ?? '').trim();
    if (!/^[A-Za-z0-9._-]{1,100}$/.test(clientId)) {
      throw new ConfigError('MMEREKO_CLIENT_ID must be the client id Mmereko issued');
    }
    mmereko = { apiUrl, clientId };
  }
  return { cv, cvPreview: !wording.namesCv, cvProvider: provider, mmereko };
}
