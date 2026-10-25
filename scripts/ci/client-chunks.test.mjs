import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { checkClientChunks, checkPageCopy, pageSizes } from './client-chunks.mjs';

const dirs = [];
after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

/** A fake `.next` with the given files. */
function build(files) {
  const dir = mkdtempSync(join(tmpdir(), 'uf-client-chunks-'));
  dirs.push(dir);
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), body);
  }
  return dir;
}

test('passes chunks with learner-facing copy only', () => {
  const dir = build({
    'static/chunks/a.js': 'const s="Open Maths on Siyavula";',
    'static/chunks/app/b.js': 'console.log("Plan B")',
  });
  assert.deepEqual(checkClientChunks(dir), { chunks: 2, problems: [] });
});

test('fails when a client chunk carries a programme record (the A4-02 regression)', () => {
  const dir = build({ 'static/chunks/x.js': 'const p={name:"Bachelor of Science"};' });
  assert.match(checkClientChunks(dir).problems.join('\n'), /x\.js carries catalogue data/);
});

test('fails when a client chunk carries the practice catalogue', () => {
  const dir = build({ 'static/chunks/x.js': 'const u="https://www.siyavula.com/read";' });
  assert.match(checkClientChunks(dir).problems.join('\n'), /catalogue data \("siyavula"\)/);
});

test('fails when a client chunk carries the public TVET colleges’ records (§19.1)', () => {
  const dir = build({
    'static/chunks/x.js':
      'const n={sourceUrl:"https://www.mysedcol.co.za/_CollegeCirculars/TC_0134_B.pdf"};',
  });
  assert.match(checkClientChunks(dir).problems.join('\n'), /catalogue data \("mysedcol"\)/);
});

test('fails when a nested client chunk carries zod locales', () => {
  const dir = build({ 'static/chunks/app/x.js': 'const de={invalid:"Ungültige Eingabe"};' });
  assert.match(checkClientChunks(dir).problems.join('\n'), /zod's locales/);
});

/** A fake `.next` whose pages load the given chunks (by name, under static/chunks). */
function routes(pages, chunks) {
  const manifests = {};
  for (const [route, files] of Object.entries(pages)) {
    const entry = `[project]/apps/web/app${route}/page`;
    const entries = { [entry]: files.map((f) => `static/chunks/${f}`) };
    manifests[`server/app${route}/page_client-reference-manifest.js`] =
      `globalThis.x={"entryJSFiles":${JSON.stringify(entries)}}`;
  }
  const bodies = Object.fromEntries(
    Object.entries(chunks).map(([name, body]) => [`static/chunks/${name}`, body]),
  );
  return build({
    'build-manifest.json': JSON.stringify({ rootMainFiles: ['static/chunks/root.js'] }),
    'static/chunks/root.js': 'react()',
    ...bodies,
    ...manifests,
  });
}

test('passes when sign-in and consent carry only their own copy', () => {
  const dir = routes(
    {
      '/sign-in': ['auth.js'],
      '/consent/[token]': ['consent.js'],
      '/(app)/offers': ['offers.js'],
    },
    {
      'auth.js': 'const t="Sign in with your cellphone number";',
      'consent.js': 'const t="A parent or guardian needs to say yes";',
      'offers.js': 'const t={accept:"Accept this offer"};',
    },
  );
  assert.deepEqual(checkPageCopy(dir), { routes: 2, problems: [] });
});

test('fails when sign-in downloads all of en (the A4-10 regression)', () => {
  const en =
    'const en={auth:{title:"Sign in"},offers:{accept:"Accept this offer"},campus:{another:"Look around another university"}};';
  const dir = routes(
    { '/sign-in': ['en.js'], '/consent/[token]': ['consent.js'] },
    { 'en.js': en, 'consent.js': 'const t="A parent or guardian needs to say yes";' },
  );
  const { problems } = checkPageCopy(dir);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^\/sign-in downloads static\/chunks\/en\.js.*"Accept this offer"/);
});

test('fails when the consent page carries My modules copy through a shared chunk', () => {
  const dir = routes(
    { '/sign-in': ['auth.js'], '/consent/[token]': ['shared.js'] },
    { 'auth.js': '', 'shared.js': 'x="These are my modules: check them"' },
  );
  assert.match(checkPageCopy(dir).problems.join('\n'), /^\/consent\/\[token\] downloads/);
});

test('fails when a lean page is missing from the build, rather than passing unchecked', () => {
  const dir = routes({ '/sign-in': ['auth.js'] }, { 'auth.js': '' });
  assert.match(checkPageCopy(dir).problems.join('\n'), /\/consent\/\[token\] is not in the build/);
});

test('measures each page as its root chunks plus its own, gzipped', () => {
  const entries = {
    '[project]/apps/web/app/layout': ['static/chunks/root.js'],
    '[project]/apps/web/app/(app)/results/page': ['static/chunks/root.js', 'static/chunks/r.js'],
  };
  const dir = build({
    'build-manifest.json': JSON.stringify({ rootMainFiles: ['static/chunks/root.js'] }),
    'static/chunks/root.js': randomBytes(3 * 1024),
    'static/chunks/r.js': randomBytes(2 * 1024),
    'server/app/(app)/results/page_client-reference-manifest.js': `globalThis.x={"entryJSFiles":${JSON.stringify(entries)}}`,
  });
  const pages = pageSizes(dir);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].route, '/results');
  // Random bytes don't compress: 3 KB + 2 KB, counting the shared root chunk once.
  assert.ok(pages[0].kb > 4.9 && pages[0].kb < 5.2, String(pages[0].kb));
});
