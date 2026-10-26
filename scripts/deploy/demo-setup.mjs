#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadDemoRules, ROOT } from './demo-rules.mjs';

/**
 * `pnpm demo:setup`: the owner's one-command morning setup for the judge demo
 * (docs/deploy/demo.md "Tomorrow morning: connect the keys"). It asks for each value the demo
 * needs or may take, secrets with hidden input, checks each one here BEFORE anything is sent,
 * refuses what a demo must never carry, sets the rest in the demo's Vercel project with the
 * Vercel CLI (value on stdin, never in a command line), and offers to redeploy.
 *
 * It never prints a value, never writes one to disk, never puts one in a command's arguments, and
 * hides any value a command echoes back. A blank answer skips that variable (tonight's value, if
 * any, stays). The rules come from the app's own sources (demo-rules.mjs), never a copied list.
 */

export const PROJECT = 'universityflow';
export const SCOPE = 'tumo-mogames-projects';
/** Pinned: the flags below were read from this version's own `--help` (2026-10-23). */
export const VERCEL_CLI = 'vercel@65.2.0';
export const ENVIRONMENTS = ['production', 'preview'];

// ── Validation ──────────────────────────────────────────────────────────────────────────────

const ok = (warnings = []) => ({ ok: true, warnings });
const bad = (reason) => ({ ok: false, reason, warnings: [] });

const SSL_MODES = ['require', 'verify-ca', 'verify-full', 'no-verify'];

/**
 * DATABASE_URL, which every serverless function opens: postgres(ql)://user:password@host/db with
 * TLS (sslmode). On Supabase it must be the TRANSACTION pooler (docs/deploy/demo.md, the Supabase
 * work): port 6543, user postgres.<project-ref>; never the direct host (IPv6 only, which Vercel's
 * functions can't reach) nor the session pooler (a server connection per open connection, which a
 * few function instances use up). `sslmode=verify-full` is the recommended mode; `no-verify` is the
 * documented last resort and is accepted only with a warning.
 */
export function checkPostgresUrl(value) {
  if (/\s/.test(value)) return bad('it has a space or line break in it: paste the string alone');
  if (value.includes('[YOUR-PASSWORD]') || /\[[A-Z-]+\]/.test(value)) {
    return bad(
      'it still has the [YOUR-PASSWORD] placeholder: put the database password in its place',
    );
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    return bad('it is not a connection string (postgres://user:password@host:port/database)');
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    return bad('it must start with postgres:// or postgresql://');
  }
  if (!url.username || !url.password) return bad('it must name the user and the password');
  const host = url.hostname.toLowerCase();
  if (!host || ['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0'].includes(host)) {
    return bad('it points at this computer, not a hosted database');
  }
  if (!url.pathname || url.pathname === '/') return bad('it must name the database (…/postgres)');
  const sslmode = url.searchParams.get('sslmode');
  if (!sslmode) {
    return bad('it must end with ?sslmode=verify-full (the connection must be encrypted)');
  }
  if (!SSL_MODES.includes(sslmode)) {
    return bad(
      `sslmode must be one of ${SSL_MODES.join(', ')}: anything else may send it unencrypted`,
    );
  }
  if (/^db\.[a-z0-9]+\.supabase\.co$/.test(host)) {
    return bad(
      'this is Supabase’s direct connection (IPv6 only, which Vercel can’t reach): copy the "Transaction pooler" string instead (port 6543)',
    );
  }
  if (host.endsWith('.pooler.supabase.com')) {
    if (url.port !== '6543') {
      return bad(
        'this is not Supabase’s "Transaction pooler": copy that string, on port 6543 (the session pooler’s connections run out with a few function instances)',
      );
    }
    if (!/^postgres\.[a-z0-9]+$/.test(decodeURIComponent(url.username))) {
      return bad(
        'Supabase’s pooler user is postgres.<project-ref> (as the Connect panel shows it), not postgres alone',
      );
    }
  }
  const warnings = [];
  if (sslmode === 'no-verify') {
    warnings.push(
      'sslmode=no-verify: encrypted, but the server is not verified. It is the documented last resort, for made-up learners only (docs/deploy/demo.md, ERR_TLS_CERT_ALTNAME_INVALID); prefer verify-full with DATABASE_CA_CERT',
    );
  } else if (sslmode !== 'verify-full') {
    warnings.push(`sslmode=${sslmode} works, but sslmode=verify-full is the recommended one`);
  }
  return ok(warnings);
}

/**
 * DATABASE_CA_CERT: the PEM certificate the database server's must chain to (Supabase: Database
 * settings → SSL configuration → Download certificate). Public, never a key: a private key pasted
 * by mistake is refused. config.ts `readDatabaseCa` reads it, with `\n` for line breaks.
 */
export function checkCaCert(value) {
  const pem = normalisePem(value);
  if (/PRIVATE KEY/.test(pem)) {
    return bad('that is a private key, not a certificate: never paste a private key anywhere');
  }
  if (!pem.startsWith('-----BEGIN CERTIFICATE-----')) {
    return bad(
      'paste the certificate itself (-----BEGIN CERTIFICATE----- …), or the path of the downloaded .crt/.pem file',
    );
  }
  if (!pem.endsWith('-----END CERTIFICATE-----')) {
    return bad('it must end with the -----END CERTIFICATE----- line: paste the whole file');
  }
  const body = pem.split('\n').filter((line) => !/^-----(BEGIN|END) CERTIFICATE-----$/.test(line));
  if (body.length === 0 || !body.every((line) => /^[A-Za-z0-9+/=]+$/.test(line))) {
    return bad(
      'between its BEGIN and END lines a certificate is base64 only: paste the file as it is',
    );
  }
  return ok();
}

/** Line breaks as \n, no surrounding blank lines. */
function normalisePem(value) {
  return String(value)
    .replace(/\r\n?/g, '\n')
    .replace(/\\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

/** One line, `\n` for each break: what config.ts reads, whatever the CLI does with line breaks. */
export function encodePem(value) {
  return normalisePem(value).split('\n').join('\\n');
}

/** An Anthropic API key: `sk-ant-…`. */
export function checkAnthropicKey(value) {
  if (/\s/.test(value)) return bad('it has a space or line break in it: paste the key alone');
  if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(value)) {
    return bad('an Anthropic API key starts with sk-ant- (Anthropic Console → API keys)');
  }
  return ok();
}

/** A Google AI (Gemini) API key: `AIza…`. */
export function checkGeminiKey(value) {
  if (/\s/.test(value)) return bad('it has a space or line break in it: paste the key alone');
  if (!/^AIza[0-9A-Za-z_-]{30,60}$/.test(value)) {
    return bad('a Gemini API key starts with AIza (Google AI Studio → Get API key)');
  }
  return ok();
}

/**
 * An ElevenLabs API key (Read aloud on the demo, a hackathon exception of 2026-10-24). Its shape
 * isn't published, so only one line with no spaces is checked here.
 */
function checkElevenLabsKey(value) {
  if (/\s/.test(value)) return bad('it has a space or line break in it: paste the key alone');
  if (value.length < 20 || value.length > 200) {
    return bad('an ElevenLabs API key is a long string (ElevenLabs → Developers → API keys)');
  }
  return ok();
}

/** As config.ts reads them (VOICE_ID, MODEL_ID). */
const ELEVENLABS_VOICE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const ELEVENLABS_MODEL_ID = /^[a-z0-9_.-]{1,64}$/;

function oneOf(values, why) {
  return (value) => (values.includes(value) ? ok() : bad(why));
}

function wholeNumber(value) {
  return /^[1-9]\d{0,6}$/.test(value)
    ? ok()
    : bad('a whole number above 0 (leave it blank for no cap)');
}

/** A plain single-line value, for a switch documented after this script was written. */
function plainValue(value) {
  if (/[\r\n]/.test(value) || value.length > 500) return bad('one line, at most 500 characters');
  return ok();
}

/** A stand-in for the other Firebase values, so each one is checked by demo-signup.ts alone. */
const FIREBASE_SAMPLE = {
  UF_DEMO_SIGNUP: 'firebase',
  NEXT_PUBLIC_FIREBASE_API_KEY: `AIza${'0'.repeat(35)}`,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'uf-demo-sample.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'uf-demo-sample',
};

function firebaseValue(rules, name) {
  return (value) => {
    try {
      rules.readDemoSignup({ ...FIREBASE_SAMPLE, [name]: value });
      return ok();
    } catch (error) {
      return bad(error.message);
    }
  };
}

function httpsUrl(rules, name) {
  return (value) => {
    try {
      rules.readHttpsUrl({ [name]: value }, name);
      return ok();
    } catch (error) {
      return bad(error.message);
    }
  };
}

/**
 * What Vercel's Supabase integration sets: never read as the database (config.ts
 * `INTEGRATION_DATABASE_VARIABLES`, read from source once the Supabase work is on main; these are
 * its names until then). The app reads DATABASE_URL only.
 */
const INTEGRATION_DATABASE_VARIABLES = [
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL_NON_POOLING',
];

/**
 * The demo's settings that were set tonight, belong to the main site's project, or are set by the
 * platform: never asked in the morning. Fixed values, if typed as an "other" variable, must match.
 */
export const FIXED = {
  UF_DEPLOYMENT: 'demo',
  UF_DEMO_PROJECT: '1',
  UF_PROVIDERS: 'local',
  UF_DEMO_DATABASE: 'synthetic',
  UF_CATALOGUE_PREVIEW: '1',
  NEXT_PUBLIC_UF_DEMO_LOGOS: '1',
};
const NEVER_ASKED = new Set([
  ...Object.keys(FIXED),
  'NEXT_PUBLIC_UF_DEMO_URL', // the main site's link to the demo: set on the main site's project
  'RENDER', // set by Render itself
]);

/** Never on a demo, beyond config.ts's list: why, for each. */
const ALSO_REFUSED = {
  UF_DEBUG_ERRORS:
    'full server errors are for local debugging only, never a deployed site (hard rule 4)',
  UF_LOCAL_PRODUCTION_BUILD: 'for a production build on this machine only; ignored on Vercel',
  UF_MMEREKO_SANDBOX_CONTRACT: 'tests only',
};

/** Why a name is refused on a demo, or null. */
export function refusalFor(name, rules) {
  if (rules.refused.has(name)) {
    if (name === 'UF_ELEVENLABS_MINORS_APPROVED') {
      return 'it records ElevenLabs’ approval for under-18s in production; the demo refuses it (Read aloud needs only ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID there)';
    }
    if (name === 'UF_CV_PROVIDER' || name.startsWith('MMEREKO_')) {
      return 'the judge demo never calls Mmereko (D14): My CV there uses the built-in stand-in, with UF_CV=1 alone';
    }
    return 'the demo refuses to start with it (config.ts NOT_ON_DEMO: production’s providers, keys and switches)';
  }
  if (rules.refusesS3Prefix && name.startsWith('UF_S3_')) {
    return 'the demo keeps files in its own database, never S3: it refuses every UF_S3_*';
  }
  const integration = rules.integrationDatabase ?? INTEGRATION_DATABASE_VARIABLES;
  if (integration.includes(name) || name.startsWith('SUPABASE_')) {
    return 'Vercel’s Supabase integration sets it, but the app reads only DATABASE_URL (the transaction pooler string): set DATABASE_URL, and don’t install the integration';
  }
  if (name.startsWith('AWS_')) return 'no AWS credentials on a demo';
  if (name.startsWith('TEST_')) return 'test settings never go on a deployment';
  return ALSO_REFUSED[name] ?? null;
}

/** The questions, in order. Each: name, secret (hidden input), what it is, where to find it. */
export function buildPrompts(rules) {
  const prompts = [
    {
      name: 'DATABASE_URL',
      secret: true,
      what: 'The demo database: Supabase’s TRANSACTION pooler string (one URL, no second "direct" one)',
      where:
        'Supabase dashboard → the demo project → Connect (top bar) → "Transaction pooler" → URI: postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:6543/postgres. Put the database password in place of [YOUR-PASSWORD] (no brackets) and add ?sslmode=verify-full at the end',
      check: checkPostgresUrl,
    },
    {
      // A known name: asked whether or not this checkout's .env.example documents it yet.
      name: 'DATABASE_CA_CERT',
      secret: false,
      multiline: true,
      file: true,
      what: 'The database’s CA certificate (public, not a secret), so the app can verify Supabase',
      where:
        'Supabase → the demo project → Database → Settings → SSL configuration → Download certificate (prod-ca-2021.crt). Paste the whole file (it ends at its -----END CERTIFICATE----- line), or type the downloaded file’s path',
      check: checkCaCert,
      encode: encodePem,
    },
    {
      name: 'ANTHROPIC_API_KEY',
      secret: true,
      what: 'A new Anthropic key for the demo (blank keeps the one set tonight)',
      where:
        'console.anthropic.com → Settings → API keys → Create key; set a monthly spend limit under Settings → Limits',
      check: checkAnthropicKey,
    },
    {
      name: 'UF_AI_PROVIDER',
      secret: false,
      what: 'Which AI answers the chat first: anthropic or gemini (blank: anthropic)',
      where: 'Your choice; gemini also needs GEMINI_API_KEY (next)',
      check: oneOf(['anthropic', 'gemini'], 'type anthropic or gemini'),
    },
    {
      name: 'GEMINI_API_KEY',
      secret: true,
      what: 'A Gemini key, only if the demo uses Gemini',
      where:
        'aistudio.google.com → Get API key, on a Google Cloud project with billing on (the Paid tier, never a free key: docs/deploy/demo.md step 1)',
      check: checkGeminiKey,
    },
    {
      name: 'UF_DEMO_SIGNUP',
      secret: false,
      what: 'The judges’ own sign-up: type firebase to turn it on',
      where: 'Needs the three Firebase values next',
      check: (v) =>
        v === 'fake'
          ? bad('fake signs anyone in as anyone: this computer only, the demo refuses it on Vercel')
          : oneOf(['firebase'], 'type firebase, or leave it blank')(v),
    },
    {
      name: 'NEXT_PUBLIC_FIREBASE_API_KEY',
      secret: false,
      what: 'Firebase web app config: apiKey (a public value)',
      where:
        'Firebase console → the demo project → Project settings (gear) → General → Your apps → the web app → SDK setup and configuration → Config: apiKey',
      check: firebaseValue(rules, 'NEXT_PUBLIC_FIREBASE_API_KEY'),
    },
    {
      name: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      secret: false,
      what: 'Firebase web app config: authDomain',
      where: 'The same config: authDomain (<project>.firebaseapp.com)',
      check: firebaseValue(rules, 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
    },
    {
      name: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      secret: false,
      what: 'Firebase web app config: projectId',
      where: 'The same config: projectId',
      check: firebaseValue(rules, 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
    },
    {
      name: 'NEXT_PUBLIC_UF_MAIN_URL',
      secret: false,
      what: 'The main site’s address, for "Back to UniversityFlow" (optional)',
      where: 'An https URL; blank: the demo’s own landing page',
      check: httpsUrl(rules, 'NEXT_PUBLIC_UF_MAIN_URL'),
    },
    {
      name: 'UF_DEMO_AI_DAILY_CAP',
      secret: false,
      what: 'A daily cap on AI chat replies across the demo (optional)',
      where:
        'A whole number; blank: no cap (the owner’s choice). The key’s spend limit is the real cap',
      check: wholeNumber,
    },
    {
      // The scheduled sweep (A11-61, docs/deploy/demo.md "The scheduled sweep"): Vercel's own name.
      name: 'CRON_SECRET',
      secret: true,
      what: 'The secret behind the demo’s scheduled sweep (Vercel sends it to GET /api/demo/sweep)',
      where:
        'Make one: 32 or more random letters and digits from a password generator; nowhere else. Mark it Sensitive in Vercel',
      check: (v) =>
        /^[A-Za-z0-9_-]{32,}$/.test(v)
          ? ok()
          : bad('at least 32 random letters, digits, - or _ (a demo refuses a shorter one)'),
    },
    // The hackathon exceptions of 2026-10-24 (docs/deploy/demo.md, hackathon-undo-pr.md).
    {
      name: 'UF_CV',
      secret: false,
      what: 'My CV on the built-in stand-in (a hackathon exception): type 1 to turn it on',
      where: 'Never Mmereko: the demo refuses UF_CV_PROVIDER and every MMEREKO_* value',
      check: oneOf(['1'], 'type 1, or leave it blank'),
    },
    {
      name: 'UF_MINDMAP_WORDS',
      secret: false,
      what: 'Learners’ own words in a plan map (a hackathon exception): type 1 to turn them on',
      where: 'The crisis check reads every save',
      check: oneOf(['1'], 'type 1, or leave it blank'),
    },
    {
      name: 'ELEVENLABS_API_KEY',
      secret: true,
      what: 'Read aloud (a hackathon exception): an ElevenLabs API key for the demo',
      where:
        'elevenlabs.io → Developers → API keys → Create (a key just for the demo, with a credit limit). Needs ELEVENLABS_VOICE_ID next',
      check: checkElevenLabsKey,
    },
    {
      name: 'ELEVENLABS_VOICE_ID',
      secret: false,
      what: 'The voice Read aloud speaks in (required with the key)',
      where: 'elevenlabs.io → Voices → the voice → its ID (letters and digits)',
      check: (v) =>
        ELEVENLABS_VOICE_ID.test(v) ? ok() : bad('a voice id is letters, digits, _ and - only'),
    },
    {
      name: 'ELEVENLABS_MODEL_ID',
      secret: false,
      what: 'Optional: the ElevenLabs model (blank: its default, eleven_multilingual_v2)',
      where: 'ElevenLabs’ models page, e.g. eleven_multilingual_v2',
      check: (v) =>
        ELEVENLABS_MODEL_ID.test(v) ? ok() : bad('a model id such as eleven_multilingual_v2'),
    },
  ];
  // Any other demo switch .env.example documents (a real-photo switch, say): asked plainly.
  const known = new Set(prompts.map((p) => p.name));
  for (const name of [...rules.demoSection].sort()) {
    if (known.has(name) || NEVER_ASKED.has(name) || refusalFor(name, rules)) continue;
    if (!name.startsWith('UF_DEMO_') && !name.startsWith('NEXT_PUBLIC_UF_DEMO_')) continue;
    prompts.push({
      name,
      secret: /KEY|SECRET|TOKEN|PASSWORD/.test(name),
      what: `${name}: a demo setting (.env.example, judge demo section, says what it does)`,
      where: '.env.example and docs/deploy/demo.md',
      check: plainValue,
    });
  }
  return prompts;
}

/** Checks one value for a name typed under "other variables". */
export function checkOther(name, value, prompts, rules) {
  if (!/^[A-Z][A-Z0-9_]*$/.test(name))
    return bad('a variable name is capital letters, digits and _');
  const refusal = refusalFor(name, rules);
  if (refusal) return bad(refusal);
  if (name in FIXED) {
    return value === FIXED[name] ? ok() : bad(`on the demo it can only be ${FIXED[name]}`);
  }
  const prompt = prompts.find((p) => p.name === name);
  if (prompt) return prompt.check(value);
  if (!rules.documented.has(name)) {
    return bad('.env.example doesn’t document it, so the app doesn’t read it');
  }
  return plainValue(value);
}

/** Checks the answers together: what no single value shows. */
export function checkTogether(values, rules) {
  const errors = [];
  const warnings = [];
  const firebase = [
    'UF_DEMO_SIGNUP',
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  ];
  const given = firebase.filter((n) => values.has(n));
  if (given.length > 0 && given.length < firebase.length) {
    const missing = firebase.filter((n) => !values.has(n));
    errors.push(
      `the judges' sign-up needs all four together: ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} missing (a half-set sign-up stops the demo starting)`,
    );
  } else if (given.length === firebase.length) {
    try {
      rules.readDemoSignup(Object.fromEntries(firebase.map((n) => [n, values.get(n)])));
    } catch (error) {
      errors.push(error.message);
    }
    const projectId = values.get('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
    const domain = values.get('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN').toLowerCase();
    if (domain !== `${projectId}.firebaseapp.com` && domain !== `${projectId}.web.app`) {
      warnings.push(
        'the authDomain is not <projectId>.firebaseapp.com: check both came from one app',
      );
    }
  }
  // Read aloud (a hackathon exception of 2026-10-24): config.ts refuses a key without a voice.
  if (values.has('ELEVENLABS_API_KEY') && !values.has('ELEVENLABS_VOICE_ID')) {
    errors.push(
      'Read aloud needs ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID together: give the voice too (a key alone stops the demo starting)',
    );
  }
  if (values.get('UF_AI_PROVIDER') === 'gemini' && !values.has('GEMINI_API_KEY')) {
    warnings.push(
      'UF_AI_PROVIDER=gemini: make sure GEMINI_API_KEY is set (it was left blank here)',
    );
  }
  const database = values.get('DATABASE_URL');
  if (database) {
    let sslmode = null;
    try {
      sslmode = new URL(database).searchParams.get('sslmode');
    } catch {}
    const ca = values.has('DATABASE_CA_CERT');
    if (sslmode === 'no-verify' && ca) {
      warnings.push(
        'with DATABASE_CA_CERT set, the server is verified against it anyway, so sslmode=no-verify changes nothing: the last resort is no-verify WITHOUT the certificate',
      );
    }
    if ((sslmode === 'verify-full' || sslmode === 'verify-ca') && !ca) {
      warnings.push(
        `sslmode=${sslmode} without DATABASE_CA_CERT fails against Supabase (SELF_SIGNED_CERT_IN_CHAIN), unless the certificate is set in Vercel already`,
      );
    }
  }
  const seen = new Map();
  for (const [name, value] of values) {
    if (value.length >= 16 && seen.has(value)) {
      errors.push(
        `${name} and ${seen.get(value)} have the same value: one of them was pasted twice`,
      );
    }
    seen.set(value, name);
  }
  return { errors, warnings };
}

/** Replaces every given value in `text` with [hidden] (anything a command echoes back). */
export function scrub(text, values) {
  let out = String(text ?? '');
  for (const value of values) {
    if (value && value.length >= 4) out = out.split(value).join('[hidden]');
    // A URL's password on its own, in case a tool prints the parsed parts.
    try {
      const password = decodeURIComponent(new URL(value).password);
      if (password.length >= 4) out = out.split(password).join('[hidden]');
    } catch {}
  }
  return out;
}

/**
 * The full check, the app's own: readConfig on a demo with tonight's settings (stand-ins for the
 * secret ones) and the new values. It needs scripts/deploy/load-app-config.mjs, which
 * `pnpm deploy:check` brings (the launch work); until that is on main it is skipped.
 */
export async function defaultFullCheck() {
  const loader = resolve(dirname(fileURLToPath(import.meta.url)), 'load-app-config.mjs');
  if (!existsSync(loader)) return null;
  const { loadAppConfig } = await import(pathToFileURL(loader).href);
  const { readConfig } = await loadAppConfig();
  return (values) => {
    const env = {
      NODE_ENV: 'production',
      VERCEL: '1',
      VERCEL_ENV: 'production',
      UF_DEPLOYMENT: 'demo',
      UF_DEMO_PROJECT: '1',
      UF_PROVIDERS: 'local',
      UF_DEMO_DATABASE: 'synthetic',
      UF_CATALOGUE_PREVIEW: '1',
      UF_PUBLIC_URL: `https://${PROJECT}.vercel.app`,
      // A stand-in: tonight's real one is in Vercel and never read here.
      AUTH_SECRET: 'stand-in-for-the-check-only-'.padEnd(48, 'x'),
      ...Object.fromEntries(values),
    };
    readConfig(env);
  };
}

// ── The Vercel CLI, behind a runner tests replace ─────────────────────────────────────────────

/** Arguments are names and flags only: a value never goes on a command line. */
const SAFE_ARG = /^[A-Za-z0-9_.,:/=@-]+$/;

/** Runs `npx --yes vercel@… <args>`; `input` goes to its stdin. Resolves {code, stdout, stderr}. */
export function vercelRunner({ spawnImpl = spawn, cli = VERCEL_CLI, cwd = ROOT } = {}) {
  return {
    run(args, { input = '' } = {}) {
      for (const arg of args) {
        if (!SAFE_ARG.test(arg)) throw new Error('refused: an argument that is not a name or flag');
      }
      return new Promise((done) => {
        const windows = process.platform === 'win32';
        let child;
        try {
          child = spawnImpl('npx', ['--yes', cli, ...args], {
            cwd,
            shell: windows, // npx is npx.cmd on Windows; every argument is checked above
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
          });
        } catch (error) {
          done({ code: -1, stdout: '', stderr: String(error?.message ?? error) });
          return;
        }
        let stdout = '';
        let stderr = '';
        child.stdout?.on('data', (d) => {
          stdout += d;
        });
        child.stderr?.on('data', (d) => {
          stderr += d;
        });
        child.on('error', (error) => done({ code: -1, stdout, stderr: String(error.message) }));
        child.on('close', (code) => done({ code: code ?? -1, stdout, stderr }));
        child.stdin?.on('error', () => {});
        child.stdin?.end(input);
      });
    },
  };
}

export function envAddArgs(name, { secret, environments, project, scope }) {
  return [
    'env',
    'add',
    name,
    '--environment',
    environments.join(','),
    '--force',
    '--yes',
    '--non-interactive',
    secret ? '--sensitive' : '--no-sensitive',
    '--project',
    project,
    '--scope',
    scope,
  ];
}

/** The newest READY production deployment's URL in `vercel list --json` output, or null. */
export function latestProductionUrl(jsonText) {
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch {
    const start = String(jsonText).indexOf('{');
    if (start < 0) return null;
    try {
      data = JSON.parse(String(jsonText).slice(start));
    } catch {
      return null;
    }
  }
  const list = Array.isArray(data) ? data : (data?.deployments ?? []);
  const ready = list.filter(
    (d) =>
      d &&
      typeof d.url === 'string' &&
      (d.target ?? 'production') === 'production' &&
      (d.state ?? d.readyState ?? 'READY') === 'READY',
  );
  ready.sort((a, b) => (b.createdAt ?? b.created ?? 0) - (a.createdAt ?? a.created ?? 0));
  const url = ready[0]?.url?.replace(/^https?:\/\//, '') ?? null;
  return url && SAFE_ARG.test(url) ? url : null;
}

// ── The conversation ────────────────────────────────────────────────────────────────────────

/**
 * The whole setup, with its input and output injected (tests pass fakes). `io` has:
 * ask(question) and askHidden(question) → the answer; out(line) for every line printed.
 * Resolves the exit code.
 */
export async function runSetup({ io, runner, rules, fullCheck = null, options = {} }) {
  const project = options.project ?? PROJECT;
  const scope = options.scope ?? SCOPE;
  const environments = options.productionOnly ? ['production'] : ENVIRONMENTS;
  const say = (line = '') => io.out(line);
  const values = new Map();
  const shown = () => [...values.values()];

  say('UniversityFlow judge demo: connect the keys');
  say(`Vercel project "${project}" (team ${scope}), ${environments.join(' and ')}.`);
  say('Each value is checked here before anything is sent. Values are never shown or saved;');
  say('secrets are typed or pasted with nothing on screen. Leave an answer blank to skip it.');
  say('');

  if (!options.dryRun) {
    const who = await runner.run(['whoami']);
    if (who.code !== 0) {
      say('Not signed in to Vercel. Run this first, then start again:');
      say(`  npx ${VERCEL_CLI} login`);
      return 1;
    }
  }

  const prompts = buildPrompts(rules);
  for (const [i, prompt] of prompts.entries()) {
    say(`[${i + 1}/${prompts.length}] ${prompt.name}${prompt.secret ? ' (hidden)' : ''}`);
    say(`  ${prompt.what}.`);
    say(`  Where: ${prompt.where}.`);
    for (let attempt = 1; ; attempt++) {
      const question = `  ${prompt.name} (blank to skip): `;
      const raw = prompt.secret
        ? await io.askHidden(question)
        : prompt.multiline
          ? await io.askMultiline(question)
          : await io.ask(question);
      let value = String(raw ?? '').trim();
      if (!value) {
        say('  Skipped.');
        break;
      }
      let result = null;
      // A path to the downloaded file instead of its text (quotes as Windows "Copy as path" adds).
      if (prompt.file && !value.startsWith('-----')) {
        const path = value.replace(/^["']|["']$/g, '');
        if (/\.(crt|pem|cer)$/i.test(path)) {
          try {
            value = String(io.readFile(path));
          } catch {
            result = bad(
              'could not read that file: check the path, or paste the certificate itself',
            );
          }
        }
      }
      result ??= prompt.check(value);
      if (result.ok) {
        values.set(prompt.name, prompt.encode ? prompt.encode(value) : value);
        say('  OK.');
        for (const w of result.warnings) say(`  Note: ${w}.`);
        break;
      }
      say(`  Not accepted: ${result.reason}.`);
      if (attempt >= 3) {
        say('  Skipped after three tries: nothing set for it.');
        break;
      }
    }
    say('');
  }

  // Anything else the owner names: refused if a demo must never carry it.
  for (;;) {
    const name = String((await io.ask('Any other variable to set? Its NAME (blank: done): ')) ?? '')
      .trim()
      .toUpperCase();
    if (!name) break;
    const refusal = refusalFor(name, rules);
    if (refusal) {
      say(`  Refused: ${name}: ${refusal}.`);
      continue;
    }
    const value = String((await io.askHidden(`  ${name} (hidden, blank to skip): `)) ?? '').trim();
    if (!value) {
      say('  Skipped.');
      continue;
    }
    const result = checkOther(name, value, prompts, rules);
    if (!result.ok) {
      say(`  Not accepted: ${result.reason}.`);
      continue;
    }
    values.set(name, value);
    say('  OK.');
    for (const w of result.warnings) say(`  Note: ${w}.`);
  }
  say('');

  if (values.size === 0) {
    say('Nothing to set. Nothing was sent.');
    return 0;
  }

  const together = checkTogether(values, rules);
  for (const w of together.warnings) say(`Note: ${w}.`);
  if (together.errors.length > 0) {
    for (const e of together.errors) say(`Not accepted: ${e}.`);
    say('Nothing was sent. Run `pnpm demo:setup` again.');
    return 1;
  }

  if (fullCheck) {
    try {
      fullCheck(values);
      say('Full check (the app’s own readConfig, as the demo): passes.');
    } catch (error) {
      say(
        `Full check (the app’s own readConfig, as the demo) fails: ${scrub(error?.message, shown())}`,
      );
      say('Nothing was sent. Run `pnpm demo:setup` again.');
      return 1;
    }
  } else {
    say(
      'Full check skipped: it arrives with `pnpm deploy:check` (scripts/deploy/load-app-config.mjs).',
    );
  }

  say('');
  say(`Ready to set ${values.size} variable(s) in "${project}" (${environments.join(', ')}):`);
  for (const name of values.keys()) say(`  ${name}`);
  if (options.dryRun) {
    say('Dry run: nothing was sent.');
    return 0;
  }
  const go = String((await io.ask('Set them now? Type yes: ')) ?? '')
    .trim()
    .toLowerCase();
  if (go !== 'yes' && go !== 'y') {
    say('Nothing was sent.');
    return 1;
  }

  const secretNames = new Set(prompts.filter((p) => p.secret).map((p) => p.name));
  let failed = 0;
  for (const [name, value] of values) {
    const secret = secretNames.has(name) || !prompts.some((p) => p.name === name);
    const result = await runner.run(envAddArgs(name, { secret, environments, project, scope }), {
      input: value,
    });
    if (result.code === 0) {
      say(`  Set: ${name}`);
    } else {
      failed++;
      const why = scrub(`${result.stderr}\n${result.stdout}`, shown())
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(-3)
        .join(' / ');
      say(`  FAILED: ${name}: ${why || `exit ${result.code}`}`);
    }
  }
  values.clear();
  if (failed > 0) {
    say(`${failed} variable(s) were not set: fix them in the Vercel dashboard`);
    say(`(${project} → Settings → Environment Variables), then redeploy.`);
    return 1;
  }

  say('');
  say('The new values take effect after a redeploy (NEXT_PUBLIC_* ones are built into the pages).');
  const again = String(
    (await io.ask('Redeploy the latest production deployment now? Type yes: ')) ?? '',
  )
    .trim()
    .toLowerCase();
  if (again !== 'yes' && again !== 'y') {
    say('Not redeployed. Later: Vercel dashboard → Deployments → the latest → Redeploy.');
    return 0;
  }
  const list = await runner.run([
    'list',
    project,
    '--environment',
    'production',
    '--status',
    'READY',
    '--json',
    '--scope',
    scope,
    '--non-interactive',
  ]);
  const url = list.code === 0 ? latestProductionUrl(list.stdout) : null;
  if (!url) {
    say('Could not find the latest production deployment. Redeploy from the dashboard:');
    say('Vercel dashboard → Deployments → the latest production one → Redeploy.');
    return 1;
  }
  say('Redeploying (a few minutes)…');
  const redeploy = await runner.run(['redeploy', url, '--scope', scope, '--non-interactive']);
  if (redeploy.code !== 0) {
    say('The redeploy did not start. Redeploy from the dashboard (Deployments → Redeploy).');
    return 1;
  }
  say('Redeployed. Now check it end to end:');
  say(`  pnpm demo:smoke -- --url https://${project}.vercel.app`);
  return 0;
}

// ── The terminal ────────────────────────────────────────────────────────────────────────────

/** Bracketed-paste markers and arrow keys: never part of a value. */
const ESCAPES = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[~A-Za-z]`, 'g');

/** Reads one line with nothing echoed (raw mode), for secrets. */
export function askHidden(question, input = process.stdin, output = process.stdout) {
  return new Promise((resolveAnswer, reject) => {
    if (!input.isTTY || typeof input.setRawMode !== 'function') {
      reject(new Error('demo:setup needs a terminal for hidden input (run it in PowerShell)'));
      return;
    }
    output.write(question);
    let value = '';
    const finish = () => {
      input.setRawMode(false);
      input.pause();
      input.off('data', onData);
      output.write('(hidden)\n');
      resolveAnswer(value);
    };
    const onData = (chunk) => {
      for (const ch of String(chunk).replace(ESCAPES, '')) {
        if (ch === '\r' || ch === '\n') return finish();
        if (ch === '\u0003') {
          input.setRawMode(false);
          output.write('\nStopped. Nothing more was sent.\n');
          process.exit(130);
        }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else if (ch >= ' ') value += ch;
      }
    };
    input.setEncoding('utf8');
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}

/** Reads one line, echoed (public values and answers). */
export function ask(question, input = process.stdin, output = process.stdout) {
  return new Promise((resolveAnswer) => {
    const rl = createInterface({ input, output, terminal: Boolean(input.isTTY) });
    rl.question(question, (answer) => {
      rl.close();
      resolveAnswer(answer);
    });
  });
}

/**
 * Reads a pasted PEM, line by line, up to its -----END CERTIFICATE----- line; anything else (a
 * file's path, a blank) is one line. Echoed: a certificate is public.
 */
export function askMultiline(question, input = process.stdin, output = process.stdout) {
  return new Promise((resolveAnswer) => {
    const rl = createInterface({ input, output, terminal: Boolean(input.isTTY) });
    const lines = [];
    const finish = () => {
      rl.close();
      resolveAnswer(lines.join('\n'));
    };
    rl.on('line', (raw) => {
      const line = raw.replace(/\r$/, '');
      lines.push(line);
      if (lines.length === 1 && !line.trim().startsWith('-----BEGIN')) return finish();
      if (line.includes('-----END CERTIFICATE-----')) return finish();
    });
    rl.on('close', () => resolveAnswer(lines.join('\n')));
    output.write(question);
  });
}

export function parseSetupArgs(argv) {
  const options = { dryRun: false, productionOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') continue;
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--production-only') options.productionOnly = true;
    else if (arg === '--project') options.project = argv[++i];
    else if (arg === '--scope') options.scope = argv[++i];
    else
      throw new Error(
        `Unknown option ${arg}. Options: --dry-run, --production-only, --project, --scope`,
      );
  }
  for (const key of ['project', 'scope']) {
    if (key in options && !/^[a-z0-9][a-z0-9_.-]*$/.test(options[key] ?? '')) {
      throw new Error(`--${key} must be a Vercel name (lower-case letters, digits, - _ .)`);
    }
  }
  return options;
}

async function main() {
  let options;
  try {
    options = parseSetupArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  const rules = await loadDemoRules();
  const code = await runSetup({
    io: {
      ask: (q) => ask(q),
      askHidden: (q) => askHidden(q),
      askMultiline: (q) => askMultiline(q),
      // Reads the downloaded certificate only; never writes a file.
      readFile: (path) => readFileSync(path, 'utf8'),
      out: (line) => console.log(line),
    },
    runner: vercelRunner(),
    rules,
    fullCheck: await defaultFullCheck(),
    options,
  });
  process.exit(code);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    // A message only: never a stack that could hold a value.
    console.error(`demo:setup stopped: ${error?.message ?? 'unknown error'}`);
    process.exit(1);
  });
}
