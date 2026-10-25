import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import {
  ATTRIBUTIONS,
  deployCheck,
  formatReport,
  KNOWN_NAMES,
  main,
  PLACEHOLDERS,
  probingAdapters,
  SHOWN_VALUES,
  simulateHost,
} from './deploy-check.mjs';
import { loadAppConfig, ROOT } from './load-app-config.mjs';

/**
 * `pnpm deploy:check` runs the app's own readConfig (apps/web/lib/server/config.ts), loaded from
 * its source, on the environment a host would give the app. These tests hold it to that: the
 * verdict is exactly the ConfigError readConfig throws, every refusal is named against its
 * variable, and no value ever reaches the output.
 */

const app = await loadAppConfig();
const NOW = new Date('2026-10-23T10:00:00Z');
const SECRET = 'a-long-random-secret-for-the-deploy-check-tests-0123456789';
/** A synthetic cellphone number, built at run time (hard rule 4). */
const REVIEW_PHONE = `082${'0'.repeat(6)}1`;

const dirs = [];
after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

/** What the deployed app throws for this environment on this host, or null when it starts. */
function appVerdict(target, env) {
  try {
    app.readConfig(simulateHost(target, env), undefined, NOW);
    return null;
  } catch (error) {
    assert.ok(error instanceof app.ConfigError, `not a ConfigError: ${error}`);
    return error.message;
  }
}

const row = (result, name) => result.rows.find((r) => r.name === name);

/** A demo as docs/deploy/demo.md sets it up. */
const DEMO = {
  UF_DEPLOYMENT: 'demo',
  UF_DEMO_PROJECT: '1',
  UF_PROVIDERS: 'local',
  AUTH_SECRET: SECRET,
  UF_CATALOGUE_PREVIEW: '1',
};

/** A staging site as render.yaml sets it up. */
const STAGING = {
  UF_DEPLOYMENT: 'staging',
  UF_PROVIDERS: 'local',
  AUTH_SECRET: SECRET,
  UF_STAGING_PASSWORD: 'a-staging-password-0123',
  UF_CATALOGUE_PREVIEW: '1',
};

/** Production with every value the owner can set today (no adapter exists for SMS or jobs). */
const PRODUCTION = {
  UF_PROVIDERS: 'live',
  AUTH_SECRET: SECRET,
  DATABASE_URL: 'postgres://user:pw@rds.example.invalid:5432/universityflow',
  UF_S3_BUCKET: 'universityflow-files',
  ANTHROPIC_API_KEY: 'sk-ant-test-0123456789abcdefghijklmnop',
  UF_PUBLIC_URL: 'https://universityflow.example',
};

test('the host: production and a demo are Vercel production in vercel.json’s region; staging is Render', () => {
  const regions = JSON.parse(readFileSync(join(ROOT, 'apps/web/vercel.json'), 'utf8')).regions;
  for (const target of ['production', 'demo']) {
    const env = simulateHost(target, { UF_LOCAL_PRODUCTION_BUILD: '1', RENDER: 'true' });
    assert.equal(env.NODE_ENV, 'production');
    assert.equal(env.VERCEL, '1');
    assert.equal(env.VERCEL_ENV, 'production');
    assert.equal(env.VERCEL_REGION, regions[0]);
    assert.equal(env.RENDER, undefined);
    // Ignored on a host anyway (A5-12); dropped so it can't change what the check sees.
    assert.equal(env.UF_LOCAL_PRODUCTION_BUILD, undefined);
  }
  const staging = simulateHost('staging', { VERCEL: '1', VERCEL_ENV: 'preview' });
  assert.equal(staging.RENDER, 'true');
  assert.equal(staging.NODE_ENV, 'production');
  assert.equal(staging.VERCEL, undefined);
  assert.equal(staging.VERCEL_ENV, undefined);
});

test('an empty production environment: the exact ConfigError, and every missing variable named', () => {
  const result = deployCheck(app, 'production', {}, { now: NOW });
  assert.equal(result.verdict.error, appVerdict('production', {}));
  assert.equal(result.verdict.error, 'Production must use live providers (UF_PROVIDERS=live)');
  assert.equal(result.starts, false);
  for (const name of [
    'UF_PROVIDERS',
    'AUTH_SECRET',
    'DATABASE_URL',
    'UF_S3_BUCKET',
    'UF_SMS_PROVIDER',
    'UF_JOBS_PROVIDER',
    'ANTHROPIC_API_KEY',
    'UF_PUBLIC_URL',
  ]) {
    assert.equal(row(result, name)?.status, 'MISSING', name);
  }
});

test('production with every value the owner can set still refuses: no SMS or jobs adapter exists', () => {
  const env = { ...PRODUCTION, UF_SMS_PROVIDER: 'chosen-sms', UF_JOBS_PROVIDER: 'chosen-jobs' };
  const result = deployCheck(app, 'production', env, { now: NOW });
  assert.equal(result.verdict.error, appVerdict('production', env));
  assert.match(result.verdict.error, /UF_SMS_PROVIDER=chosen-sms has no adapter yet/);
  assert.equal(row(result, 'UF_SMS_PROVIDER')?.status, 'REFUSED');
  assert.match(row(result, 'UF_SMS_PROVIDER')?.reason ?? '', /no adapter yet/);
  assert.equal(row(result, 'UF_JOBS_PROVIDER')?.status, 'REFUSED');
  for (const name of ['UF_PROVIDERS', 'AUTH_SECRET', 'DATABASE_URL', 'UF_S3_BUCKET']) {
    assert.equal(row(result, name)?.status, 'OK', name);
  }
  // With those two adapters written, nothing else stands in the way.
  assert.deepEqual(
    result.rows.filter((r) => r.status !== 'OK').map((r) => r.name),
    ['UF_SMS_PROVIDER', 'UF_JOBS_PROVIDER'],
  );
});

/**
 * Every refusal, seen against its variable. Each case is [target, environment, variable,
 * status]; the verdict is checked against readConfig itself in every case.
 */
const CASES = [
  ['production', { ...PRODUCTION, UF_PUBLIC_URL: undefined }, 'UF_PUBLIC_URL', 'MISSING'],
  [
    'production',
    { ...PRODUCTION, UF_PUBLIC_URL: 'http://localhost:3000' },
    'UF_PUBLIC_URL',
    'REFUSED',
  ],
  ['production', { ...PRODUCTION, UF_PROVIDERS: 'local' }, 'UF_PROVIDERS', 'REFUSED'],
  ['production', { ...PRODUCTION, UF_CATALOGUE_PREVIEW: '1' }, 'UF_CATALOGUE_PREVIEW', 'REFUSED'],
  [
    'production',
    { ...PRODUCTION, UF_CATALOGUE_E2E_FIXTURES: '1' },
    'UF_CATALOGUE_E2E_FIXTURES',
    'REFUSED',
  ],
  ['production', { ...PRODUCTION, AUTH_SECRET: 'short' }, 'AUTH_SECRET', 'REFUSED'],
  ['production', { ...PRODUCTION, DATABASE_URL: 'pglite:./.data/x' }, 'DATABASE_URL', 'REFUSED'],
  ['production', { ...PRODUCTION, UF_DEMO_PROJECT: '1' }, 'UF_DEMO_PROJECT', 'REFUSED'],
  ['production', { ...PRODUCTION, UF_DEMO_SIGNUP: 'firebase' }, 'UF_DEMO_SIGNUP', 'REFUSED'],
  [
    'production',
    { ...PRODUCTION, NEXT_PUBLIC_UF_DEMO_LOGOS: '1' },
    'NEXT_PUBLIC_UF_DEMO_LOGOS',
    'REFUSED',
  ],
  ['production', { ...PRODUCTION, UF_PROFILE_PHOTO: '1' }, 'UF_PROFILE_PHOTO', 'REFUSED'],
  ['production', { ...PRODUCTION, UF_MINDMAP_WORDS: '1' }, 'UF_MINDMAP_WORDS', 'REFUSED'],
  ['production', { ...PRODUCTION, UF_CV: '1' }, 'UF_CV', 'REFUSED'],
  ['production', { ...PRODUCTION, UF_AI_PROVIDER: 'gemini' }, 'UF_AI_PROVIDER', 'REFUSED'],
  ['production', { ...PRODUCTION, GEMINI_API_KEY: SECRET }, 'GEMINI_API_KEY', 'REFUSED'],
  [
    'production',
    { ...PRODUCTION, ELEVENLABS_API_KEY: SECRET, ELEVENLABS_VOICE_ID: 'voice123' },
    'ELEVENLABS_API_KEY',
    'REFUSED',
  ],
  ['production', { ...PRODUCTION, UF_S3_REGION: 'eu-west-1' }, 'UF_S3_REGION', 'REFUSED'],
  [
    'production',
    { ...PRODUCTION, UF_S3_ENDPOINT: 'http://127.0.0.1:9000' },
    'UF_S3_ENDPOINT',
    'REFUSED',
  ],
  ['production', { ...PRODUCTION, UF_S3_BUCKET: 'Has.Dots' }, 'UF_S3_BUCKET', 'REFUSED'],
  [
    'production',
    { ...PRODUCTION, UF_WHATSAPP_PROVIDER: 'meta' },
    'UF_WHATSAPP_PROVIDER',
    'REFUSED',
  ],
  ['production', { ...PRODUCTION, UF_PUSH_PROVIDER: 'expo' }, 'EXPO_ACCESS_TOKEN', 'MISSING'],
  [
    'production',
    { ...PRODUCTION, UF_SMS_BUDGET_PER_HOUR: 'lots' },
    'UF_SMS_BUDGET_PER_HOUR',
    'REFUSED',
  ],
  ['production', { ...PRODUCTION, UF_REVIEW_PHONE: REVIEW_PHONE }, 'UF_REVIEW_PIN_HASH', 'MISSING'],
  [
    'production',
    {
      ...PRODUCTION,
      UF_REVIEW_UNTIL: 'soon',
      UF_REVIEW_PHONE: REVIEW_PHONE,
      UF_REVIEW_PIN_HASH: 'f'.repeat(64),
    },
    'UF_REVIEW_UNTIL',
    'REFUSED',
  ],
  [
    'production',
    { ...PRODUCTION, UF_MESSAGING_WEBHOOK_SECRET: 'short' },
    'UF_MESSAGING_WEBHOOK_SECRET',
    'REFUSED',
  ],
  [
    'production',
    { ...PRODUCTION, NEXT_PUBLIC_UF_DEMO_URL: 'http://x' },
    'NEXT_PUBLIC_UF_DEMO_URL',
    'REFUSED',
  ],
  ['staging', { ...STAGING, DATABASE_URL: 'postgres://x/y' }, 'DATABASE_URL', 'REFUSED'],
  ['staging', { ...STAGING, ANTHROPIC_API_KEY: SECRET }, 'ANTHROPIC_API_KEY', 'REFUSED'],
  ['staging', { ...STAGING, UF_PROVIDERS: 'live' }, 'UF_PROVIDERS', 'REFUSED'],
  ['staging', { ...STAGING, UF_STAGING_PASSWORD: undefined }, 'UF_STAGING_PASSWORD', 'MISSING'],
  ['staging', { ...STAGING, UF_PROFILE_PHOTO: '1' }, 'UF_PROFILE_PHOTO', 'REFUSED'],
  ['demo', { ...DEMO, UF_DEMO_PROJECT: undefined }, 'UF_DEMO_PROJECT', 'MISSING'],
  ['demo', { ...DEMO, UF_SMS_PROVIDER: 'any' }, 'UF_SMS_PROVIDER', 'REFUSED'],
  ['demo', { ...DEMO, UF_PROVIDERS: 'live' }, 'UF_PROVIDERS', 'REFUSED'],
  ['demo', { ...DEMO, DATABASE_URL: 'postgres://neon/x' }, 'UF_DEMO_DATABASE', 'MISSING'],
  ['demo', { ...DEMO, AUTH_SECRET: undefined }, 'AUTH_SECRET', 'MISSING'],
  // My CV on a demo is the stand-in only (a hackathon exception, 2026-10-24): never Mmereko (D14).
  ['demo', { ...DEMO, UF_CV: '1', UF_CV_PROVIDER: 'mmereko' }, 'UF_CV_PROVIDER', 'REFUSED'],
  [
    'demo',
    { ...DEMO, UF_ELEVENLABS_MINORS_APPROVED: '1' },
    'UF_ELEVENLABS_MINORS_APPROVED',
    'REFUSED',
  ],
  ['staging', { ...STAGING, UF_CV: '1' }, 'UF_CV', 'REFUSED'],
  ['staging', { ...STAGING, UF_MINDMAP_WORDS: '1' }, 'UF_MINDMAP_WORDS', 'REFUSED'],
  ['demo', { ...DEMO, UF_DEMO_AI_DAILY_CAP: 'many' }, 'UF_DEMO_AI_DAILY_CAP', 'REFUSED'],
  ['demo', { ...DEMO, UF_DEMO_SIGNUP: 'firebase' }, 'NEXT_PUBLIC_FIREBASE_API_KEY', 'MISSING'],
];

for (const [target, env, name, status] of CASES) {
  test(`${target}: ${name} is ${status}, and the verdict is readConfig's own`, () => {
    const result = deployCheck(app, target, env, { now: NOW });
    assert.equal(result.verdict.error, appVerdict(target, env));
    assert.notEqual(result.verdict.error, null);
    assert.equal(result.starts, false);
    assert.equal(row(result, name)?.status, status, JSON.stringify(result.rows));
  });
}

test('a demo or staging site set up as documented starts, and says so', () => {
  for (const [target, env] of [
    ['demo', DEMO],
    ['staging', STAGING],
  ]) {
    const result = deployCheck(app, target, env, { now: NOW });
    assert.equal(result.verdict.error, null, target);
    assert.equal(result.starts, true, target);
    assert.deepEqual(
      result.rows.filter((r) => r.status !== 'OK'),
      [],
      target,
    );
  }
});

test('a demo with the hackathon exceptions of 2026-10-24 switched on starts', () => {
  const env = {
    ...DEMO,
    UF_CV: '1',
    UF_MINDMAP_WORDS: '1',
    ELEVENLABS_API_KEY: SECRET,
    ELEVENLABS_VOICE_ID: 'voice123',
  };
  const result = deployCheck(app, 'demo', env, { now: NOW });
  assert.equal(result.verdict.error, null);
  assert.equal(result.starts, true);
});

test('a demo on Vercel may carry AWS Lambda’s own credentials', () => {
  const env = { ...DEMO, AWS_ACCESS_KEY_ID: 'ASIAEXAMPLEKEY000000', AWS_SECRET_ACCESS_KEY: SECRET };
  assert.equal(deployCheck(app, 'demo', env, { now: NOW }).starts, true);
});

test('the deployment itself: a target the variables don’t make is refused, whatever readConfig says', () => {
  const asDemo = deployCheck(
    app,
    'production',
    { ...PRODUCTION, UF_DEPLOYMENT: 'demo' },
    { now: NOW },
  );
  assert.equal(row(asDemo, 'UF_DEPLOYMENT')?.status, 'REFUSED');
  assert.equal(asDemo.starts, false);
  // The live demo's variables checked as production: they would start a demo, not production.
  const demoAsProduction = deployCheck(app, 'production', DEMO, { now: NOW });
  assert.equal(row(demoAsProduction, 'UF_DEPLOYMENT')?.status, 'REFUSED');
  const unset = deployCheck(app, 'demo', { ...DEMO, UF_DEPLOYMENT: undefined }, { now: NOW });
  assert.equal(row(unset, 'UF_DEPLOYMENT')?.status, 'MISSING');
  assert.equal(unset.starts, false);
});

test('every attribution pattern is one readConfig really says', () => {
  const seen = new Set();
  const messages = [
    appVerdict('production', { ...PRODUCTION, UF_CATALOGUE_PREVIEW: '1' }),
    appVerdict('production', { ...PRODUCTION, UF_CATALOGUE_E2E_FIXTURES: '1' }),
  ];
  // Refusals the simulated hosts never produce (the host sets these), read from readConfig.
  for (const env of [
    { ...PRODUCTION, NODE_ENV: 'production', VERCEL_ENV: 'production', VERCEL_REGION: 'fra1' },
    { NODE_ENV: 'production', RENDER: 'true', ...PRODUCTION },
    { ...STAGING, NODE_ENV: 'production', VERCEL_ENV: 'production' },
  ]) {
    try {
      app.readConfig(env, undefined, NOW);
    } catch (error) {
      messages.push(error.message);
    }
  }
  for (const message of messages) {
    for (const attribution of ATTRIBUTIONS)
      if (attribution.pattern.test(message ?? '')) seen.add(attribution);
  }
  assert.deepEqual(
    ATTRIBUTIONS.filter((a) => !seen.has(a)).map((a) => String(a.pattern)),
    [],
  );
});

test('the placeholders are exactly what each target needs: all of them start, any one missing refuses', () => {
  for (const target of ['production', 'staging', 'demo']) {
    const env = simulateHost(target, PLACEHOLDERS[target]);
    const adapters = probingAdapters(app, env);
    assert.doesNotThrow(() => app.readConfig(env, adapters, NOW), target);
    for (const name of Object.keys(PLACEHOLDERS[target])) {
      const without = { ...env };
      delete without[name];
      assert.throws(
        () => app.readConfig(without, adapters, NOW),
        app.ConfigError,
        `${target} ${name}`,
      );
    }
  }
});

test('every variable readConfig reads is one the check knows', () => {
  const source = readFileSync(join(ROOT, 'apps/web/lib/server/config.ts'), 'utf8');
  const read = new Set([...source.matchAll(/env\[\s*'([A-Z][A-Z0-9_]*)'\s*\]/g)].map((m) => m[1]));
  assert.ok(read.size > 20);
  assert.deepEqual(
    [...read].filter((name) => !KNOWN_NAMES.has(name)),
    [],
  );
});

test('the report never prints a value, only names, statuses and readConfig’s reasons', () => {
  const values = {
    ...PRODUCTION,
    UF_PROVIDERS: 'local',
    ELEVENLABS_API_KEY: 'el-secret-value-1234567890',
    GEMINI_API_KEY: 'gm-secret-value-1234567890',
    UF_MESSAGING_WEBHOOK_SECRET: 'wh-secret-value-short',
    UF_REVIEW_PHONE: '0800000002',
    UF_REVIEW_PIN_HASH: 'f'.repeat(64),
    UF_STAGING_PASSWORD: 'staging-password-value-123',
    UF_SMS_PROVIDER: 'chosen-sms',
    NEXT_PUBLIC_FIREBASE_API_KEY: 'firebase-api-key-value-123456',
  };
  for (const target of ['production', 'staging', 'demo']) {
    const text = formatReport(deployCheck(app, target, values, { now: NOW }));
    for (const [name, value] of Object.entries(values)) {
      if (SHOWN_VALUES.has(name) || value.length < 8) continue;
      assert.ok(!text.includes(value), `${target}: the value of ${name} was printed`);
    }
  }
});

test('the report redacts a value even if a future reason were to carry one', () => {
  const text = formatReport({
    target: 'production',
    starts: false,
    verdict: { error: `AUTH_SECRET is ${SECRET}` },
    deployment: null,
    rows: [{ name: 'AUTH_SECRET', status: 'REFUSED', reason: `got ${SECRET}` }],
    stopped: null,
    unset: 0,
    adapters: probingAdapters(app, {}),
    input: { AUTH_SECRET: SECRET },
  });
  assert.ok(!text.includes(SECRET));
});

function envFile(text) {
  const dir = mkdtempSync(join(tmpdir(), 'uf-deploy-check-'));
  dirs.push(dir);
  const path = join(dir, '.env.production.local');
  writeFileSync(path, text);
  return path;
}

async function run(args, env = {}) {
  let out = '';
  let err = '';
  const code = await main(args, {
    env,
    now: NOW,
    stdout: (s) => {
      out += s;
    },
    stderr: (s) => {
      err += s;
    },
    app,
  });
  return { code, out, err };
}

test('the command: reads a `vercel env pull` file, exits 1 on a refusal and 0 when it starts', async () => {
  // `vercel env pull` writes KEY="value" lines, with Vercel's own variables among them.
  const demo = envFile(
    `${Object.entries(DEMO)
      .map(([k, v]) => `${k}="${v}"`)
      .join('\n')}\nVERCEL="1"\nVERCEL_ENV="development"\nVERCEL_OIDC_TOKEN="${SECRET}"\n`,
  );
  const ok = await run(['--target', 'demo', '--file', demo]);
  assert.equal(ok.code, 0, ok.out + ok.err);
  assert.match(ok.out, /starts/i);
  assert.ok(!ok.out.includes(SECRET));

  const refused = await run(['--target', 'production', '--file', demo]);
  assert.equal(refused.code, 1);
  assert.match(refused.out, /UF_DEPLOYMENT\s+REFUSED/);
  assert.ok(!refused.out.includes(SECRET));
});

test('the command: without a file it reads its own environment', async () => {
  const result = await run(['--target', 'staging'], STAGING);
  assert.equal(result.code, 0, result.out);
});

test('the command: a missing or unknown target, or a missing file, is a usage error (2)', async () => {
  assert.equal((await run([])).code, 2);
  assert.equal((await run(['--target', 'prod'])).code, 2);
  assert.equal(
    (await run(['--target', 'production', '--file', join(tmpdir(), 'no-such-file.env')])).code,
    2,
  );
});
