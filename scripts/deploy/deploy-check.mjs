#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';
import { documentedNames, PLATFORM_PROVIDED } from '../checks/env-documented.mjs';

/**
 * `pnpm deploy:check --target production|staging|demo [--file <file>]`
 *
 * Says whether a deployment's environment would start, before anyone deploys it: for each
 * variable, OK, MISSING or REFUSED with the reason, and never a value. The owner runs it on the
 * output of `vercel env pull` (docs/deploy/production.md). The flag is `--file`, not
 * `--env-file`: the standalone pnpm.exe is Node itself and takes `--env-file` as its own.
 *
 * It runs the app's own `readConfig` (apps/web/lib/server/config.ts, loaded from its source by
 * load-app-config.mjs), not a copy of its rules, on the environment the host would give the app:
 * so the verdict is exactly the ConfigError the deployed app throws, and `/api/health` answers 503
 * for. readConfig stops at its first refusal, so to list every problem the check then asks it
 * again with each named variable set to a stand-in value or taken away, until it starts or a
 * problem can't be stepped past. Those later answers are readConfig's own words too.
 */

const ROOT = resolve(import.meta.dirname, '../..');

export const TARGETS = ['production', 'staging', 'demo'];

/** Set by the host, never by the owner: the check plays the host. */
const HOST_SET = ['NODE_ENV', 'VERCEL', 'VERCEL_ENV', 'VERCEL_REGION', 'RENDER'];

/** Every variable name the app is documented to read (.env.example), and the host's own. */
export const KNOWN_NAMES = new Set([
  ...documentedNames(readFileSync(join(ROOT, '.env.example'), 'utf8').split(/\r?\n/)),
  ...PLATFORM_PROVIDED,
  ...HOST_SET,
]);

/** The region vercel.json pins every function to: Vercel sets VERCEL_REGION to it. */
function vercelRegion() {
  return JSON.parse(readFileSync(join(ROOT, 'apps/web/vercel.json'), 'utf8')).regions[0];
}

/**
 * The environment the app sees on the target's host. Production and a demo run on Vercel
 * (Production environment, functions in vercel.json's region); staging on Render. What the host
 * sets replaces whatever the file says (`vercel env pull` writes VERCEL_ENV=development), and the
 * local-build escape is dropped: a host ignores it (A5-12).
 */
export function simulateHost(target, input) {
  const env = { ...input };
  for (const name of [...HOST_SET, 'UF_LOCAL_PRODUCTION_BUILD']) delete env[name];
  env.NODE_ENV = 'production';
  if (target === 'staging') {
    env.RENDER = 'true';
  } else {
    env.VERCEL = '1';
    env.VERCEL_ENV = 'production';
    env.VERCEL_REGION = vercelRegion();
  }
  return env;
}

/** What UF_DEPLOYMENT says each target is: unset is production. */
const DEPLOYMENT = { production: undefined, staging: 'staging', demo: 'demo' };

const STAND_IN_SECRET = 'deploy-check-stand-in-value-not-a-secret-0123456789';

/**
 * What each target can't start without, as stand-in values the check uses only to look past a
 * problem it has already reported. A test holds this to readConfig: these alone start, and taking
 * any one away refuses.
 */
export const PLACEHOLDERS = {
  production: {
    UF_PROVIDERS: 'live',
    AUTH_SECRET: STAND_IN_SECRET,
    DATABASE_URL: 'postgres://deploy-check.invalid/stand-in',
    UF_S3_BUCKET: 'deploy-check-stand-in',
    UF_SMS_PROVIDER: 'deploy-check-sms',
    UF_JOBS_PROVIDER: 'deploy-check-jobs',
    ANTHROPIC_API_KEY: STAND_IN_SECRET,
    UF_PUBLIC_URL: 'https://deploy-check.invalid',
  },
  staging: {
    UF_DEPLOYMENT: 'staging',
    AUTH_SECRET: STAND_IN_SECRET,
    UF_STAGING_PASSWORD: STAND_IN_SECRET,
  },
  demo: {
    UF_DEPLOYMENT: 'demo',
    UF_DEMO_PROJECT: '1',
    AUTH_SECRET: STAND_IN_SECRET,
  },
};

/** Needed only with something else (a channel, a database kind): stand-ins to look past them. */
const CONDITIONAL = {
  EXPO_ACCESS_TOKEN: STAND_IN_SECRET,
  UF_DEMO_DATABASE: 'synthetic',
};

/** Variables that name a live adapter, and the adapter lists readConfig checks them against. */
const ADAPTER_VARIABLES = {
  UF_SMS_PROVIDER: ['sms', 'inbound.sms'],
  UF_JOBS_PROVIDER: ['jobs'],
  UF_WHATSAPP_PROVIDER: ['whatsapp', 'inbound.whatsapp'],
  UF_PUSH_PROVIDER: ['push'],
  UF_CV_PROVIDER: ['cv'],
};

/**
 * The adapters that exist in this build, plus the ones `env` names under `pretend`: once the
 * check has reported "no adapter yet", it pretends the adapter exists to look further.
 */
export function probingAdapters(app, env, pretend = Object.keys(ADAPTER_VARIABLES)) {
  const adapters = app.adapters();
  const lists = {
    sms: [...adapters.sms],
    jobs: [...adapters.jobs],
    whatsapp: [...(adapters.whatsapp ?? [])],
    push: [...(adapters.push ?? [])],
    cv: [...(adapters.cv ?? [])],
    'inbound.sms': [...(adapters.inbound?.sms ?? [])],
    'inbound.whatsapp': [...(adapters.inbound?.whatsapp ?? [])],
  };
  for (const name of pretend) {
    const value = env[name]?.trim();
    if (!value) continue;
    for (const list of ADAPTER_VARIABLES[name] ?? []) lists[list].push(value);
  }
  return {
    sms: lists.sms,
    jobs: lists.jobs,
    whatsapp: lists.whatsapp,
    push: lists.push,
    cv: lists.cv,
    inbound: { sms: lists['inbound.sms'], whatsapp: lists['inbound.whatsapp'] },
  };
}

/**
 * readConfig's refusals that don't name their variable, and the one that names another. A test
 * holds each pattern to a message readConfig really gives.
 */
export const ATTRIBUTIONS = [
  {
    pattern: /^Unverified catalogue data is never shown in production/,
    names: ['UF_CATALOGUE_PREVIEW'],
  },
  {
    pattern: /^The E2E catalogue fixtures are never used in production/,
    names: ['UF_CATALOGUE_E2E_FIXTURES'],
  },
  { pattern: /functions must run in \w+, not /, names: ['VERCEL_REGION'] },
  { pattern: /Render has no South African region/, names: ['RENDER'] },
  { pattern: /^Staging is never Vercel production/, names: ['VERCEL_ENV'] },
];

const NAME = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b(?:_\*)?/g;

/** The known variables a message names (`UF_S3_*` names every set UF_S3_ variable). */
function namesIn(text, env) {
  const names = [];
  for (const [found] of text.matchAll(NAME)) {
    if (found.endsWith('_*')) {
      const prefix = found.slice(0, -1);
      for (const name of Object.keys(env)) if (name.startsWith(prefix)) names.push(name);
    } else if (KNOWN_NAMES.has(found)) names.push(found);
  }
  return [...new Set(names)];
}

/**
 * Which variables a refusal is about, and how. A variable after "needs" that isn't set is
 * MISSING; so is one the target can't start without. A set variable it names is REFUSED, unless
 * the message is about something missing (then the set one is only the condition).
 */
function attribute(message, env, target) {
  const set = (name) => Boolean(env[name]?.trim());
  const fixed = ATTRIBUTIONS.find((a) => a.pattern.test(message));
  const names = fixed ? fixed.names : namesIn(message, env);
  const needsClause = /\bneeds\b([^:]*)/.exec(message)?.[1] ?? '';
  const needed = new Set(namesIn(needsClause, env));
  const required = PLACEHOLDERS[target];
  const missing = names.filter(
    (name) => !set(name) && (needed.has(name) || name in required || name in CONDITIONAL),
  );
  if (missing.length > 0) return missing.map((name) => ({ name, status: 'MISSING' }));
  return names.filter(set).map((name) => ({ name, status: 'REFUSED' }));
}

/** readConfig's answer: null when it starts, else its ConfigError's message. Anything else throws. */
function tryRead(app, env, adapters, now) {
  try {
    if (adapters) app.readConfig(env, adapters, now);
    else app.readConfig(env, undefined, now);
    return null;
  } catch (error) {
    if (error instanceof app.ConfigError) return error.message;
    throw error;
  }
}

/** The adapters that exist in this build, by kind, for the report. */
function adapterSummary(app) {
  const a = app.adapters();
  return {
    sms: a.sms,
    jobs: a.jobs,
    whatsapp: a.whatsapp ?? [],
    push: a.push ?? [],
    cv: a.cv ?? [],
  };
}

/**
 * The check. `input` is the deployment's variables (a pulled env file, or this process's own).
 * `app` is what load-app-config.mjs loads.
 */
export function deployCheck(app, target, input, { now = new Date() } = {}) {
  if (!TARGETS.includes(target)) throw new Error(`Unknown target ${target}`);
  const clean = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  const env = simulateHost(target, clean);

  // 1. Exactly what the deployed app does with these variables on that host.
  const error = tryRead(app, env, null, now);

  // 2. Whether these variables make the deployment the target is meant to be.
  const wanted = DEPLOYMENT[target];
  const actual = clean.UF_DEPLOYMENT?.trim() || undefined;
  let deployment = null;
  if (actual !== wanted) {
    deployment = {
      name: 'UF_DEPLOYMENT',
      status: wanted && !actual ? 'MISSING' : 'REFUSED',
      reason: wanted
        ? `A ${target} deployment needs UF_DEPLOYMENT=${wanted}; as set, this would start as ${actual ?? 'production'}`
        : `Production has UF_DEPLOYMENT unset; as set, this would start as ${actual}, not production`,
    };
  }

  // 3. Every problem, one after another, each in readConfig's own words.
  const probe = { ...env };
  if (wanted) probe.UF_DEPLOYMENT = wanted;
  else delete probe.UF_DEPLOYMENT;
  const fill = { ...PLACEHOLDERS[target], ...CONDITIONAL };
  const pretend = new Set();
  const problems = new Map();
  const seen = new Set();
  let stopped = null;
  for (let step = 0; step < 60; step += 1) {
    const adapters = probingAdapters(app, probe, [...pretend]);
    const message = tryRead(app, probe, adapters, now);
    if (message === null) break;
    if (seen.has(message)) {
      stopped = message;
      break;
    }
    seen.add(message);
    const found = attribute(message, probe, target);
    if (found.length === 0) {
      stopped = message;
      break;
    }
    let movedOn = false;
    for (const { name, status } of found) {
      if (!problems.has(name)) problems.set(name, { name, status, reason: message });
      const adapterRefused =
        name in ADAPTER_VARIABLES && /has no adapter yet|can send but not receive/.test(message);
      if (adapterRefused) {
        pretend.add(name);
        movedOn = true;
      } else if (name in fill && probe[name] !== fill[name]) {
        probe[name] = fill[name];
        if (name in ADAPTER_VARIABLES) pretend.add(name);
        movedOn = true;
      } else if (status === 'REFUSED') {
        delete probe[name];
        movedOn = true;
      }
    }
    if (!movedOn) {
      stopped = message;
      break;
    }
  }

  // 4. A row for each variable that is set or was named; the rest are counted.
  const rows = [];
  if (deployment) rows.push(deployment);
  const shown = new Set(rows.map((r) => r.name));
  for (const problem of problems.values()) {
    if (shown.has(problem.name)) continue;
    rows.push(problem);
    shown.add(problem.name);
  }
  const relevant = Object.keys(clean)
    .filter(
      (name) => KNOWN_NAMES.has(name) && !HOST_SET.includes(name) && clean[name].trim() !== '',
    )
    .sort();
  for (const name of [...Object.keys(PLACEHOLDERS[target]), ...relevant]) {
    if (shown.has(name)) continue;
    shown.add(name);
    if (name === 'UF_LOCAL_PRODUCTION_BUILD') {
      rows.push({ name, status: 'OK', reason: 'set, and ignored on a host (A5-12)' });
    } else if (clean[name]?.trim()) rows.push({ name, status: 'OK', reason: 'set' });
  }
  const unset = [...KNOWN_NAMES].filter((name) => !shown.has(name) && !clean[name]?.trim()).length;

  return {
    target,
    starts: error === null && deployment === null,
    verdict: { error },
    deployment,
    rows,
    stopped,
    unset,
    adapters: adapterSummary(app),
    input: clean,
  };
}

/**
 * Values the report may show, because readConfig's own messages name them: which adapter or
 * deployment was asked for, never a secret. Every other value is blanked wherever it appears.
 */
export const SHOWN_VALUES = new Set([
  'UF_DEPLOYMENT',
  'UF_PROVIDERS',
  'UF_AI_PROVIDER',
  'UF_SMS_PROVIDER',
  'UF_JOBS_PROVIDER',
  'UF_WHATSAPP_PROVIDER',
  'UF_PUSH_PROVIDER',
  'UF_CV_PROVIDER',
  'UF_DEMO_SIGNUP',
  'VERCEL_REGION',
]);

function redactor(input) {
  const values = Object.entries(input ?? {})
    .filter(
      ([name, value]) =>
        !SHOWN_VALUES.has(name) && typeof value === 'string' && value.trim().length >= 8,
    )
    .map(([, value]) => value.trim())
    .sort((a, b) => b.length - a.length);
  return (text) => values.reduce((out, value) => out.split(value).join('‹value hidden›'), text);
}

const HOSTS = {
  production: 'Vercel, Production environment, functions in cpt1',
  staging: 'Render (synthetic data only)',
  demo: 'Vercel, the demo’s own project',
};

/** The report, as printed. Names, statuses and readConfig's reasons; never a value. */
export function formatReport(result) {
  const hide = redactor(result.input);
  const lines = [];
  lines.push(`UniversityFlow deploy check: ${result.target} (${HOSTS[result.target]})`);
  lines.push('');
  if (result.verdict.error === null) {
    lines.push('readConfig: the app would START with these variables.');
  } else {
    lines.push('readConfig: the app would REFUSE to start (/api/health answers 503), with:');
    lines.push(`  ConfigError: ${result.verdict.error}`);
  }
  if (result.deployment) lines.push(`But: ${result.deployment.reason}.`);
  lines.push('');
  const width = Math.max(28, ...result.rows.map((r) => r.name.length + 2));
  lines.push(`${'Variable'.padEnd(width)}${'Status'.padEnd(9)}Reason`);
  for (const r of result.rows) {
    lines.push(`${r.name.padEnd(width)}${r.status.padEnd(9)}${r.reason}`);
  }
  lines.push(`(${result.unset} other documented variables are not set.)`);
  if (result.stopped) {
    lines.push('');
    lines.push(
      'The check could not look past this refusal; fix it and run again to see what follows:',
    );
    lines.push(`  ${result.stopped}`);
  }
  const list = (names) => (names.length > 0 ? names.join(', ') : 'none yet');
  const a = result.adapters;
  lines.push('');
  lines.push(
    `Live adapters in this build: SMS ${list(a.sms)} · jobs ${list(a.jobs)} · WhatsApp ${list(a.whatsapp)} · push ${list(a.push)} · CV ${list(a.cv)}`,
  );
  if (result.target === 'production') {
    lines.push(
      'Starting is not launching: the catalogue verification, legal review and the other launch gates are in docs/deploy/production.md.',
    );
  }
  lines.push('');
  lines.push(
    result.starts ? `Result: ${result.target} STARTS.` : `Result: ${result.target} does NOT start.`,
  );
  return `${hide(lines.join('\n'))}\n`;
}

const USAGE =
  'Usage: pnpm deploy:check --target production|staging|demo [--file <file from vercel env pull>]\n';

/** The command. Exit 0: it starts. 1: it would refuse. 2: a usage error. */
export async function main(argv, io = {}) {
  const stdout = io.stdout ?? ((s) => process.stdout.write(s));
  const stderr = io.stderr ?? ((s) => process.stderr.write(s));
  let target;
  let file;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--target') target = argv[++i];
    else if (argv[i] === '--file') file = argv[++i];
    else if (argv[i] === '--') continue;
    else {
      stderr(`Unknown argument ${argv[i]}\n${USAGE}`);
      return 2;
    }
  }
  if (!TARGETS.includes(target)) {
    stderr(USAGE);
    return 2;
  }
  let input;
  if (file) {
    if (!existsSync(file)) {
      stderr(`No such file: ${file}\n`);
      return 2;
    }
    input = parseEnv(readFileSync(file, 'utf8'));
  } else {
    input = { ...(io.env ?? process.env) };
  }
  const app = io.app ?? (await (await import('./load-app-config.mjs')).loadAppConfig());
  const result = deployCheck(app, target, input, { now: io.now ?? new Date() });
  stdout(formatReport(result));
  return result.starts ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main(process.argv.slice(2));
}
