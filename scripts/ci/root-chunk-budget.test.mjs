import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { checkRootChunks } from './root-chunk-budget.mjs';

const dirs = [];
after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

/** A fake `.next` with the given root chunks. */
function build(chunks) {
  const dir = mkdtempSync(join(tmpdir(), 'uf-root-chunks-'));
  dirs.push(dir);
  mkdirSync(join(dir, 'static', 'chunks'), { recursive: true });
  const rootMainFiles = Object.entries(chunks).map(([name, body]) => {
    const file = `static/chunks/${name}`;
    writeFileSync(join(dir, file), body);
    return file;
  });
  writeFileSync(join(dir, 'build-manifest.json'), JSON.stringify({ rootMainFiles }));
  return dir;
}

test('passes small root chunks with no zod locales', () => {
  const result = checkRootChunks(build({ 'a.js': 'console.log("hi")' }));
  assert.deepEqual(result.problems, []);
});

test('fails when a root chunk carries zod locales (the A4-01 regression)', () => {
  const dir = build({ 'a.js': 'const de={invalid:"Ungültige Eingabe"};' });
  assert.match(checkRootChunks(dir).problems.join('\n'), /zod's locales/);
});

test('fails over the budget, measured gzipped', () => {
  // Random bytes don't compress: 20 KB stays about 20 KB gzipped.
  const dir = build({ 'a.js': randomBytes(20 * 1024).toString('base64') });
  assert.match(checkRootChunks(dir, 10).problems.join('\n'), /over the 10 KB budget/);
  assert.deepEqual(checkRootChunks(dir, 100).problems, []);
});
