import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { loadDemoRules, ROOT, readConstList, readDemoSectionNames } from './demo-rules.mjs';
import {
  askHidden,
  askMultiline,
  buildPrompts,
  checkAnthropicKey,
  checkGeminiKey,
  checkOther,
  checkPostgresUrl,
  checkTogether,
  envAddArgs,
  latestProductionUrl,
  parseSetupArgs,
  refusalFor,
  runSetup,
  scrub,
  vercelRunner,
} from './demo-setup.mjs';

const rules = await loadDemoRules();

// Synthetic values only: shaped like the real thing, belonging to nothing.
const PW = 'synthetic-pw-0001';
const POOLED = `postgresql://postgres.abcdefghijklmnop:${PW}@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?sslmode=verify-full`;
/** A made-up certificate: PEM-shaped, base64 of nothing real. */
const PEM = [
  '-----BEGIN CERTIFICATE-----',
  'MIIDxTCCAq2gAwIBAgIUSYNTHETICSYNTHETICSYNTHETICSYNTHETICwDQYJKoZI',
  'aHR0cHM6Ly9leGFtcGxlLnRlc3Qvbm90LWEtcmVhbC1jZXJ0aWZpY2F0ZQ==',
  '-----END CERTIFICATE-----',
].join('\n');
const KNOWN_BEFORE_DOCUMENTED = ['DATABASE_CA_CERT'];
const ANTHROPIC = `sk-ant-api03-${'s'.repeat(40)}`;
const GEMINI = `AIza${'g'.repeat(35)}`;
const FIREBASE_KEY = `AIza${'f'.repeat(35)}`;

// ── Rules from the app's own sources ─────────────────────────────────────────────────────────

test('the refusals come from config.ts NOT_ON_DEMO, spreads included', () => {
  for (const name of [
    'UF_ELEVENLABS_MINORS_APPROVED',
    'EXPO_ACCESS_TOKEN',
    'UF_PROFILE_PHOTO',
    'UF_REVIEW_PIN_HASH',
    'UF_CV_PROVIDER', // through ...MMEREKO_VARIABLES
    'MMEREKO_CLIENT_SECRET',
  ]) {
    assert.ok(rules.refused.has(name), name);
  }
  for (const allowed of [
    'ANTHROPIC_API_KEY',
    'GEMINI_API_KEY',
    'DATABASE_URL',
    'UF_DEMO_SIGNUP',
    // The hackathon exceptions of 2026-10-24.
    'UF_CV',
    'UF_MINDMAP_WORDS',
    'ELEVENLABS_API_KEY',
    'ELEVENLABS_VOICE_ID',
    'ELEVENLABS_MODEL_ID',
  ]) {
    assert.equal(rules.refused.has(allowed), false, allowed);
  }
  assert.equal(rules.refusesS3Prefix, true);
});

test('a renamed list in config.ts stops the setup instead of refusing nothing', () => {
  assert.throws(
    () => readConstList('const OTHER = [] as const;', 'NOT_ON_DEMO'),
    /NOT_ON_DEMO was not found/,
  );
});

test('every prompt is a variable .env.example documents (or a known one on its way), and none is refused', () => {
  for (const prompt of buildPrompts(rules)) {
    assert.ok(
      rules.documented.has(prompt.name) || KNOWN_BEFORE_DOCUMENTED.includes(prompt.name),
      `${prompt.name} documented`,
    );
    assert.equal(refusalFor(prompt.name, rules), null, `${prompt.name} not refused`);
  }
});

test('DATABASE_CA_CERT is asked right after DATABASE_URL, documented in .env.example or not', () => {
  for (const documented of [rules.documented, new Set([...rules.documented, 'DATABASE_CA_CERT'])]) {
    const names = buildPrompts({ ...rules, documented }).map((p) => p.name);
    assert.equal(names[0], 'DATABASE_URL');
    assert.equal(names[1], 'DATABASE_CA_CERT');
  }
  assert.equal(
    buildPrompts(rules).some((p) => /UNPOOLED|DIRECT|NON_POOLING/.test(p.name)),
    false,
  );
});

test('Vercel’s Supabase integration variables are refused: the app reads DATABASE_URL only', () => {
  for (const name of [
    'POSTGRES_URL',
    'POSTGRES_PRISMA_URL',
    'POSTGRES_URL_NON_POOLING',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]) {
    assert.match(refusalFor(name, rules) ?? '', /DATABASE_URL/, name);
  }
});

test('a demo switch documented later is asked without a code change; tonight’s are not', () => {
  const env = readFileSync(resolve(ROOT, '.env.example'), 'utf8');
  const withNew = env.replace(
    '# UF_DEMO_PROJECT=1',
    '# UF_DEMO_PROJECT=1\n# Demo only: real photos.\n# UF_DEMO_REAL_PHOTOS=1',
  );
  const demoSection = readDemoSectionNames(withNew);
  const names = buildPrompts({ ...rules, demoSection }).map((p) => p.name);
  assert.ok(names.includes('UF_DEMO_REAL_PHOTOS'));
  for (const already of [
    'UF_DEMO_PROJECT',
    'UF_DEMO_DATABASE',
    'NEXT_PUBLIC_UF_DEMO_LOGOS',
    'NEXT_PUBLIC_UF_DEMO_URL',
  ]) {
    assert.equal(names.includes(already), false, already);
  }
});

// ── One value at a time ──────────────────────────────────────────────────────────────────────

test('the database URL: postgres, a password, a hosted host, a database and TLS', () => {
  assert.equal(checkPostgresUrl(POOLED, { pooled: true }).ok, true);
  assert.deepEqual(checkPostgresUrl(POOLED, { pooled: true }).warnings, []);
  const refused = [
    [POOLED.replace('?sslmode=verify-full', ''), /sslmode=verify-full/],
    [POOLED.replace('sslmode=verify-full', 'sslmode=disable'), /sslmode must be/],
    [POOLED.replace(':6543', ':5432'), /Transaction pooler.*6543/],
    [POOLED.replace('postgres.abcdefghijklmnop:', 'postgres:'), /postgres\.<project-ref>/],
    [POOLED.replace(PW, '[YOUR-PASSWORD]'), /placeholder/],
    [POOLED.replace('postgresql:', 'https:'), /postgres:\/\//],
    [`postgres://u:${PW}@localhost:5432/db?sslmode=require`, /this computer/],
    [`postgres://u@db.example.test:5432/db?sslmode=require`, /password/],
    [`postgres://u:${PW}@db.example.test:5432?sslmode=require`, /database/],
    [`${POOLED} `.replace('postgres?', 'post gres?'), /space/],
    [
      `postgres://postgres:${PW}@db.abcdefghijklmnop.supabase.co:5432/postgres?sslmode=require`,
      /direct connection/,
    ],
  ];
  for (const [value, reason] of refused) {
    const result = checkPostgresUrl(value, { pooled: true });
    assert.equal(result.ok, false, value.replace(PW, '…'));
    assert.match(result.reason, reason);
    assert.equal(result.reason.includes(PW), false, 'a reason never repeats the value');
  }
  // require: accepted, with verify-full recommended.
  const plain = checkPostgresUrl(POOLED.replace('verify-full', 'require'), { pooled: true });
  assert.equal(plain.ok, true);
  assert.match(plain.warnings[0], /verify-full/);
  // no-verify: the documented last resort, accepted only with a warning.
  const noVerify = checkPostgresUrl(POOLED.replace('verify-full', 'no-verify'), { pooled: true });
  assert.equal(noVerify.ok, true);
  assert.match(noVerify.warnings[0], /not verified/);
  assert.match(noVerify.warnings[0], /last resort/);
});

test('DATABASE_CA_CERT: a PEM certificate, pasted or from a .crt/.pem file, sent on one line', () => {
  const prompt = buildPrompts(rules).find((p) => p.name === 'DATABASE_CA_CERT');
  assert.equal(prompt.multiline, true);
  assert.equal(prompt.secret, false);
  assert.equal(prompt.check(PEM).ok, true);
  assert.equal(prompt.check(PEM.replace(/\n/g, '\r\n')).ok, true);
  for (const [value, reason] of [
    ['prod-ca-2021.crt', /certificate itself|file/],
    [PEM.replace('-----END CERTIFICATE-----', ''), /END CERTIFICATE/],
    [PEM.replace('MIID', 'MI!D'), /base64/],
    [`${PEM}\n-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----`, /private key/],
  ]) {
    const result = prompt.check(value);
    assert.equal(result.ok, false, value.slice(0, 20));
    assert.match(result.reason, reason);
  }
  // Sent as config.ts reads it: one line, \n for each break.
  assert.equal(prompt.encode(PEM.replace(/\n/g, '\r\n')), PEM.split('\n').join('\\n'));
});

test('the AI keys have their providers’ shapes', () => {
  assert.equal(checkAnthropicKey(ANTHROPIC).ok, true);
  assert.equal(checkAnthropicKey(GEMINI).ok, false);
  assert.equal(checkAnthropicKey('sk-ant-short').ok, false);
  assert.equal(checkGeminiKey(GEMINI).ok, true);
  assert.equal(checkGeminiKey(ANTHROPIC).ok, false);
});

test('the judges’ sign-up: firebase only, and each Firebase value by demo-signup.ts’s own rules', () => {
  const prompts = buildPrompts(rules);
  const check = (name, value) => prompts.find((p) => p.name === name).check(value);
  assert.equal(check('UF_DEMO_SIGNUP', 'firebase').ok, true);
  assert.match(check('UF_DEMO_SIGNUP', 'fake').reason, /refuses it on Vercel/);
  assert.equal(check('NEXT_PUBLIC_FIREBASE_API_KEY', FIREBASE_KEY).ok, true);
  assert.match(check('NEXT_PUBLIC_FIREBASE_API_KEY', 'not a key!').reason, /Firebase web API key/);
  assert.equal(check('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'uf-demo-x.firebaseapp.com').ok, true);
  assert.equal(
    check('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'https://uf-demo-x.firebaseapp.com').ok,
    false,
  );
  assert.equal(check('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'uf-demo-x').ok, true);
  assert.equal(check('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'UF Demo').ok, false);
  assert.equal(check('NEXT_PUBLIC_UF_MAIN_URL', 'http://example.test').ok, false);
  assert.equal(check('UF_AI_PROVIDER', 'openai').ok, false);
  assert.equal(check('UF_DEMO_AI_DAILY_CAP', '0').ok, false);
});

test('what a demo must never carry is refused, with why', () => {
  assert.match(refusalFor('UF_ELEVENLABS_MINORS_APPROVED', rules), /production/);
  assert.match(refusalFor('UF_S3_BUCKET', rules), /S3/);
  assert.match(refusalFor('AWS_SECRET_ACCESS_KEY', rules), /refuses to start/);
  assert.match(refusalFor('AWS_REGION', rules), /AWS/);
  assert.match(refusalFor('UF_CV_PROVIDER', rules), /never calls Mmereko/);
  assert.match(refusalFor('MMEREKO_CLIENT_SECRET', rules), /never calls Mmereko/);
  // The hackathon exceptions of 2026-10-24 are set like any other value.
  for (const name of ['UF_CV', 'UF_MINDMAP_WORDS', 'ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID']) {
    assert.equal(refusalFor(name, rules), null, name);
  }
  assert.match(refusalFor('UF_DEBUG_ERRORS', rules), /hard rule 4/);
  const prompts = buildPrompts(rules);
  assert.match(checkOther('UF_PROVIDERS', 'live', prompts, rules).reason, /only be local/);
  assert.match(checkOther('UF_DEPLOYMENT', 'staging', prompts, rules).reason, /only be demo/);
  assert.equal(checkOther('UF_DEMO_DATABASE', 'synthetic', prompts, rules).ok, true);
  assert.match(checkOther('MADE_UP_NAME', 'x', prompts, rules).reason, /doesn’t document/);
});

test('together: a half-set sign-up and a value pasted twice are refused', () => {
  const half = checkTogether(new Map([['UF_DEMO_SIGNUP', 'firebase']]), rules);
  assert.match(half.errors[0], /all four together/);
  const whole = checkTogether(
    new Map([
      ['UF_DEMO_SIGNUP', 'firebase'],
      ['NEXT_PUBLIC_FIREBASE_API_KEY', FIREBASE_KEY],
      ['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'uf-demo-x.firebaseapp.com'],
      ['NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'uf-demo-x'],
    ]),
    rules,
  );
  assert.deepEqual(whole.errors, []);
  const twice = checkTogether(
    new Map([
      ['ANTHROPIC_API_KEY', ANTHROPIC],
      ['GEMINI_API_KEY', ANTHROPIC],
    ]),
    rules,
  );
  assert.match(twice.errors[0], /pasted twice/);
});

test('the hackathon exceptions of 2026-10-24: My CV, plan-map words and Read aloud are asked', () => {
  const prompts = buildPrompts(rules);
  const names = prompts.map((p) => p.name);
  for (const name of [
    'UF_CV',
    'UF_MINDMAP_WORDS',
    'ELEVENLABS_API_KEY',
    'ELEVENLABS_VOICE_ID',
    'ELEVENLABS_MODEL_ID',
  ]) {
    assert.ok(names.includes(name), name);
  }
  const prompt = (name) => prompts.find((p) => p.name === name);
  assert.equal(prompt('ELEVENLABS_API_KEY').secret, true);
  assert.equal(prompt('ELEVENLABS_VOICE_ID').secret, false);
  assert.equal(prompt('UF_CV').check('1').ok, true);
  assert.equal(prompt('UF_CV').check('yes').ok, false);
  assert.equal(prompt('UF_MINDMAP_WORDS').check('1').ok, true);
  assert.equal(prompt('UF_MINDMAP_WORDS').check('true').ok, false);
  assert.equal(prompt('ELEVENLABS_API_KEY').check(`sk_${'e'.repeat(48)}`).ok, true);
  assert.equal(prompt('ELEVENLABS_API_KEY').check('has a space').ok, false);
  assert.equal(prompt('ELEVENLABS_VOICE_ID').check('21m00Tcm4TlvDq8ikWAM').ok, true);
  assert.equal(prompt('ELEVENLABS_VOICE_ID').check('not a voice!').ok, false);
  assert.equal(prompt('ELEVENLABS_MODEL_ID').check('eleven_multilingual_v2').ok, true);
  assert.equal(prompt('ELEVENLABS_MODEL_ID').check('Eleven Model').ok, false);
});

test('together: the ElevenLabs key needs its voice, or the demo refuses to start', () => {
  const key = `sk_${'e'.repeat(48)}`;
  const alone = checkTogether(new Map([['ELEVENLABS_API_KEY', key]]), rules);
  assert.match(alone.errors[0], /ELEVENLABS_VOICE_ID/);
  const both = checkTogether(
    new Map([
      ['ELEVENLABS_API_KEY', key],
      ['ELEVENLABS_VOICE_ID', '21m00Tcm4TlvDq8ikWAM'],
    ]),
    rules,
  );
  assert.deepEqual(both.errors, []);
});

test('together: the database URL’s sslmode and DATABASE_CA_CERT are read as a pair', () => {
  const noVerifyWithCa = checkTogether(
    new Map([
      ['DATABASE_URL', POOLED.replace('verify-full', 'no-verify')],
      ['DATABASE_CA_CERT', PEM],
    ]),
    rules,
  );
  assert.match(noVerifyWithCa.warnings.join(' '), /verified against it anyway/);
  const verifyWithoutCa = checkTogether(new Map([['DATABASE_URL', POOLED]]), rules);
  assert.match(verifyWithoutCa.warnings.join(' '), /SELF_SIGNED_CERT_IN_CHAIN/);
  const both = checkTogether(
    new Map([
      ['DATABASE_URL', POOLED],
      ['DATABASE_CA_CERT', PEM],
    ]),
    rules,
  );
  assert.deepEqual(both, { errors: [], warnings: [] });
});

// ── The conversation, with a fake terminal and a fake Vercel CLI ─────────────────────────────

/** Answers by prompt name; records every line printed and every CLI call. */
function harness(answers, { failEnvAdd = false, echo = false, listJson, files = {} } = {}) {
  const printed = [];
  const asked = [];
  const calls = [];
  const read = [];
  const multiline = [];
  const answer = (question) => {
    asked.push(question);
    for (const [key, value] of Object.entries(answers)) {
      if (question.includes(key)) return Array.isArray(value) ? (value.shift() ?? '') : value;
    }
    return '';
  };
  const io = {
    ask: async (q) => answer(q),
    askHidden: async (q) => answer(q),
    askMultiline: async (q) => {
      multiline.push(q);
      return answer(q);
    },
    readFile: (path) => {
      read.push(path);
      if (!(path in files)) throw new Error('ENOENT');
      return files[path];
    },
    out: (line) => printed.push(line),
  };
  const runner = {
    run: async (args, { input = '' } = {}) => {
      calls.push({ args, input });
      if (args[0] === 'env' && failEnvAdd) {
        return {
          code: 1,
          stdout: '',
          stderr: echo ? `Error: bad value ${input}` : 'Error: failed',
        };
      }
      if (args[0] === 'list') {
        return { code: 0, stdout: listJson ?? '{"deployments":[]}', stderr: '' };
      }
      return { code: 0, stdout: echo ? `echo ${input}` : 'ok', stderr: '' };
    },
  };
  return { io, runner, printed, asked, calls, read, multiline };
}

test('the CA certificate, pasted on several lines, is sent on stdin as one line', async () => {
  const h = harness({ 'DATABASE_URL (': POOLED, DATABASE_CA_CERT: PEM, 'Set them now': 'yes' });
  assert.equal(await runSetup({ io: h.io, runner: h.runner, rules }), 0);
  const add = h.calls.find((c) => c.args[0] === 'env' && c.args[2] === 'DATABASE_CA_CERT');
  assert.equal(add.input, PEM.split('\n').join('\\n'));
  assert.ok(add.args.includes('--no-sensitive'));
  // Read with the multi-line reader, the only prompt that is.
  assert.deepEqual(h.multiline, ['  DATABASE_CA_CERT (blank to skip): ']);
  assert.equal(add.args.join(' ').includes('BEGIN CERTIFICATE'), false);
  assert.equal(h.printed.join('\n').includes('MIID'), false);
});

test('the CA certificate from a .crt file path (quoted, as Windows copies it)', async () => {
  const path = 'C:\\certs\\prod-ca-2021.crt';
  const h = harness(
    { DATABASE_CA_CERT: `"${path}"`, 'Set them now': 'yes' },
    { files: { [path]: `${PEM.replace(/\n/g, '\r\n')}\r\n` } },
  );
  await runSetup({ io: h.io, runner: h.runner, rules });
  assert.deepEqual(h.read, [path]);
  const add = h.calls.find((c) => c.args[2] === 'DATABASE_CA_CERT');
  assert.equal(add.input, PEM.split('\n').join('\\n'));

  const missing = harness({ DATABASE_CA_CERT: ['C:\\nowhere\\ca.pem', '', ''] });
  await runSetup({ io: missing.io, runner: missing.runner, rules });
  assert.ok(missing.printed.some((l) => /could not read that file/.test(l)));
  const notCert = harness({ DATABASE_CA_CERT: ['C:\\certs\\notes.txt', '', ''] });
  await runSetup({ io: notCert.io, runner: notCert.runner, rules });
  assert.deepEqual(notCert.read, []);
  assert.ok(notCert.printed.some((l) => /certificate itself|\.crt/.test(l)));
});

/** Everything written to the real stdout/stderr while `fn` runs. */
async function captureProcess(fn) {
  const written = [];
  const out = process.stdout.write;
  const err = process.stderr.write;
  process.stdout.write = (chunk, ...rest) => {
    written.push(String(chunk));
    return out.call(process.stdout, chunk, ...rest);
  };
  process.stderr.write = (chunk, ...rest) => {
    written.push(String(chunk));
    return err.call(process.stderr, chunk, ...rest);
  };
  try {
    return { result: await fn(), written: written.join('') };
  } finally {
    process.stdout.write = out;
    process.stderr.write = err;
  }
}

const SECRETS = [POOLED, PW, ANTHROPIC, GEMINI];

function assertNoValue(text) {
  for (const secret of SECRETS) assert.equal(text.includes(secret), false, 'a value was printed');
}

test('blank answers skip everything: nothing is sent', async () => {
  const h = harness({});
  const code = await runSetup({ io: h.io, runner: h.runner, rules });
  assert.equal(code, 0);
  assert.deepEqual(
    h.calls.map((c) => c.args[0]),
    ['whoami'],
  );
  assert.ok(h.printed.includes('Nothing to set. Nothing was sent.'));
  assert.ok(h.printed.filter((l) => l === '  Skipped.').length >= 10);
});

test('values go to the CLI on stdin only: never in its arguments, never printed', async () => {
  const h = harness(
    {
      'DATABASE_URL (': POOLED,
      ANTHROPIC_API_KEY: ANTHROPIC,
      'UF_AI_PROVIDER ': 'gemini',
      'GEMINI_API_KEY ': GEMINI,
      'Set them now': 'yes',
      Redeploy: 'no',
    },
    { echo: true },
  );
  const { result, written } = await captureProcess(() =>
    runSetup({ io: h.io, runner: h.runner, rules }),
  );
  assert.equal(result, 0);
  const adds = h.calls.filter((c) => c.args[0] === 'env');
  assert.deepEqual(
    adds.map((c) => c.args[2]),
    ['DATABASE_URL', 'ANTHROPIC_API_KEY', 'UF_AI_PROVIDER', 'GEMINI_API_KEY'],
  );
  assert.equal(adds[0].input, POOLED);
  for (const call of h.calls) assertNoValue(call.args.join(' '));
  assert.ok(adds[0].args.includes('--sensitive'));
  assert.ok(adds[2].args.includes('--no-sensitive'));
  assert.ok(adds[0].args.includes('production,preview'));
  assertNoValue(h.printed.join('\n'));
  assertNoValue(written);
});

test('a CLI that echoes a value back has it hidden in what is printed', async () => {
  const h = harness(
    { ANTHROPIC_API_KEY: ANTHROPIC, 'Set them now': 'yes' },
    { failEnvAdd: true, echo: true },
  );
  const code = await runSetup({ io: h.io, runner: h.runner, rules });
  assert.equal(code, 1);
  const failed = h.printed.find((l) => l.includes('FAILED: ANTHROPIC_API_KEY'));
  assert.match(failed, /\[hidden\]/);
  assertNoValue(h.printed.join('\n'));
});

test('a refused name is refused before its value is ever asked', async () => {
  const h = harness({ 'Any other variable': ['MMEREKO_CLIENT_SECRET', 'uf_s3_bucket', ''] });
  await runSetup({ io: h.io, runner: h.runner, rules });
  assert.ok(h.printed.some((l) => /Refused: MMEREKO_CLIENT_SECRET: .*Mmereko/.test(l)));
  assert.ok(h.printed.some((l) => /Refused: UF_S3_BUCKET/.test(l)));
  assert.equal(
    h.asked.some((q) => q.includes('MMEREKO_CLIENT_SECRET (hidden')),
    false,
  );
  assert.equal(h.calls.filter((c) => c.args[0] === 'env').length, 0);
});

test('a value refused three times is skipped, and nothing about it is sent', async () => {
  const bad = POOLED.replace('?sslmode=verify-full', '');
  const h = harness({ 'DATABASE_URL (': [bad, bad, bad] });
  await runSetup({ io: h.io, runner: h.runner, rules });
  assert.equal(
    h.printed.filter((l) => l.includes('Not accepted: it must end with ?sslmode')).length,
    3,
  );
  assert.ok(h.printed.includes('  Skipped after three tries: nothing set for it.'));
  assert.equal(h.calls.filter((c) => c.args[0] === 'env').length, 0);
});

test('a half-set sign-up stops before anything is sent', async () => {
  const h = harness({ 'UF_DEMO_SIGNUP ': 'firebase', 'Set them now': 'yes' });
  const code = await runSetup({ io: h.io, runner: h.runner, rules });
  assert.equal(code, 1);
  assert.equal(h.calls.filter((c) => c.args[0] === 'env').length, 0);
});

test('the full check (readConfig) refusing stops the send, its message scrubbed', async () => {
  const h = harness({ ANTHROPIC_API_KEY: ANTHROPIC, 'Set them now': 'yes' });
  const fullCheck = (values) => {
    throw new Error(`refused ${values.get('ANTHROPIC_API_KEY')}`);
  };
  const code = await runSetup({ io: h.io, runner: h.runner, rules, fullCheck });
  assert.equal(code, 1);
  assert.equal(h.calls.filter((c) => c.args[0] === 'env').length, 0);
  assertNoValue(h.printed.join('\n'));
});

test('a dry run calls no Vercel command at all', async () => {
  const h = harness({ ANTHROPIC_API_KEY: ANTHROPIC });
  const code = await runSetup({ io: h.io, runner: h.runner, rules, options: { dryRun: true } });
  assert.equal(code, 0);
  assert.deepEqual(h.calls, []);
});

test('not signed in to Vercel: says how, sends nothing', async () => {
  const h = harness({ ANTHROPIC_API_KEY: ANTHROPIC });
  h.runner.run = async (args) => {
    h.calls.push({ args });
    return { code: 1, stdout: '', stderr: 'no credentials' };
  };
  assert.equal(await runSetup({ io: h.io, runner: h.runner, rules }), 1);
  assert.ok(h.printed.some((l) => l.includes('login')));
  assert.equal(h.calls.length, 1);
});

test('redeploy: the newest READY production deployment', async () => {
  const listJson = JSON.stringify({
    deployments: [
      { url: 'universityflow-old.vercel.app', target: 'production', state: 'READY', createdAt: 1 },
      { url: 'universityflow-new.vercel.app', target: 'production', state: 'READY', createdAt: 3 },
      { url: 'universityflow-pr.vercel.app', target: 'preview', state: 'READY', createdAt: 4 },
    ],
  });
  const h = harness(
    { ANTHROPIC_API_KEY: ANTHROPIC, 'Set them now': 'yes', Redeploy: 'yes' },
    { listJson },
  );
  assert.equal(await runSetup({ io: h.io, runner: h.runner, rules }), 0);
  const redeploy = h.calls.find((c) => c.args[0] === 'redeploy');
  assert.equal(redeploy.args[1], 'universityflow-new.vercel.app');
  assert.ok(
    h.printed.some((l) => l.includes('pnpm demo:smoke -- --url https://universityflow.vercel.app')),
  );
  assert.equal(latestProductionUrl('not json'), null);
  assert.equal(latestProductionUrl('[{"url":"a b"}]'), null);
});

test('the runner: a value goes to stdin, never into argv; an unsafe argument is refused', async () => {
  const spawned = [];
  const spawnImpl = (command, args) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = Object.assign(new EventEmitter(), {
      end(input) {
        spawned.push({ command, args, input });
        setImmediate(() => child.emit('close', 0));
      },
    });
    return child;
  };
  const runner = vercelRunner({ spawnImpl });
  const args = envAddArgs('ANTHROPIC_API_KEY', {
    secret: true,
    environments: ['production', 'preview'],
    project: 'universityflow',
    scope: 'tumo-mogames-projects',
  });
  const result = await runner.run(args, { input: ANTHROPIC });
  assert.equal(result.code, 0);
  assert.equal(spawned[0].command, 'npx');
  assert.equal(spawned[0].input, ANTHROPIC);
  assertNoValue(spawned[0].args.join(' '));
  assert.throws(() => runner.run(['env', 'add', 'X', `--value=${POOLED}`]), /refused/);
  assert.throws(() => runner.run(['env', 'add', 'X Y']), /refused/);
});

test('hidden input echoes nothing of the value, and handles backspace and paste markers', async () => {
  const input = Object.assign(new EventEmitter(), {
    isTTY: true,
    setRawMode() {},
    setEncoding() {},
    resume() {},
    pause() {},
  });
  let shown = '';
  const output = { write: (s) => (shown += s) };
  const answer = askHidden('Key: ', input, output);
  input.emit('data', '\x1b[200~sk-ant-');
  input.emit('data', 'abcX\x7f');
  input.emit('data', 'def\x1b[201~\r');
  assert.equal(await answer, 'sk-ant-abcdef');
  assert.equal(shown, 'Key: (hidden)\n');
  await assert.rejects(askHidden('Key: ', { isTTY: false }, output), /needs a terminal/);
});

test('multi-line input: a pasted PEM is read up to its END CERTIFICATE line; one line otherwise', async () => {
  const { PassThrough } = await import('node:stream');
  const output = new PassThrough();
  const pasted = new PassThrough();
  const answer = askMultiline('Cert: ', pasted, output);
  pasted.end(`${PEM.replace(/\n/g, '\r\n')}\r\nthis line is never read\n`);
  assert.equal(await answer, PEM);
  const path = new PassThrough();
  const pathAnswer = askMultiline('Cert: ', path, output);
  path.write('C:\\certs\\prod-ca-2021.crt\n');
  assert.equal(await pathAnswer, 'C:\\certs\\prod-ca-2021.crt');
});

test('scrub hides a whole value and a URL’s password alone', () => {
  assert.equal(scrub(`x ${ANTHROPIC} y`, [ANTHROPIC]), 'x [hidden] y');
  assert.equal(scrub(`password ${PW}`, [POOLED]), 'password [hidden]');
});

test('setup arguments', () => {
  assert.deepEqual(parseSetupArgs(['--', '--dry-run']), { dryRun: true, productionOnly: false });
  assert.equal(parseSetupArgs(['--production-only']).productionOnly, true);
  assert.throws(() => parseSetupArgs(['--project', 'Bad Name']), /Vercel name/);
  assert.throws(() => parseSetupArgs(['--value', 'x']), /Unknown option/);
});
