import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import {
  checkBundles,
  measureBundles,
  TOLERANCE_PERCENT,
  writeBaseline,
} from './native-bundle-budget.mjs';

const dirs = [];
after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'uf-native-bundle-'));
  dirs.push(dir);
  return dir;
}

/** A fake `expo export` output: metadata.json naming one bundle per platform. */
function exported(bundles) {
  const dir = tempDir();
  const fileMetadata = {};
  for (const [platform, body] of Object.entries(bundles)) {
    const bundle = `_expo/static/js/${platform}/entry-0123456789abcdef.hbc`;
    mkdirSync(join(dir, `_expo/static/js/${platform}`), { recursive: true });
    writeFileSync(join(dir, bundle), body);
    fileMetadata[platform] = { bundle, assets: [] };
  }
  writeFileSync(join(dir, 'metadata.json'), JSON.stringify({ version: 0, fileMetadata }));
  return dir;
}

/** Random bytes of a given size: plain app code, no markers. */
const code = (bytes) => randomBytes(bytes);

const baseline = (sizes) =>
  Object.fromEntries(Object.entries(sizes).map(([platform, bytes]) => [platform, { bytes }]));

test('measures each platform and passes within tolerance of the baseline', () => {
  const dir = exported({ ios: code(10_000), android: code(12_000) });
  const result = checkBundles(dir, baseline({ ios: 10_000, android: 11_500 }));
  assert.deepEqual(result.problems, []);
  assert.deepEqual(
    result.sizes.map((s) => [s.platform, s.bytes]),
    [
      ['android', 12_000],
      ['ios', 10_000],
    ],
  );
});

test(`fails when a bundle grows more than ${TOLERANCE_PERCENT}% over its baseline`, () => {
  const grown = Math.ceil(10_000 * (1 + TOLERANCE_PERCENT / 100)) + 1;
  const dir = exported({ ios: code(grown), android: code(10_000) });
  const { problems } = checkBundles(dir, baseline({ ios: 10_000, android: 10_000 }));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /ios bundle is .* over its baseline/);
});

test('a bundle that shrank passes (lowering the baseline is a deliberate step)', () => {
  const dir = exported({ ios: code(5_000), android: code(5_000) });
  assert.deepEqual(checkBundles(dir, baseline({ ios: 10_000, android: 10_000 })).problems, []);
});

test('fails when a bundle carries a zod locale, in UTF-8 or as Hermes UTF-16 strings', () => {
  const utf8 = Buffer.concat([code(1_000), Buffer.from('Ungültige Eingabe', 'utf8')]);
  const utf16 = Buffer.concat([code(1_000), Buffer.from('Entrée invalide', 'utf16le')]);
  const dir = exported({ ios: utf8, android: utf16 });
  const { problems } = checkBundles(dir, baseline({ ios: 10_000, android: 10_000 }));
  assert.equal(problems.length, 2);
  for (const problem of problems) assert.match(problem, /zod's locales/);
});

test('fails when a bundle carries catalogue record data (the barrel came in)', () => {
  const dir = exported({
    ios: Buffer.concat([code(1_000), Buffer.from('Bachelor of Science', 'utf8')]),
    android: code(1_000),
  });
  const { problems } = checkBundles(dir, baseline({ ios: 10_000, android: 10_000 }));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /ios bundle carries catalogue data \("Bachelor of"\)/);
});

test('fails when a platform has no baseline, or the baseline names a platform not exported', () => {
  const dir = exported({ ios: code(1_000) });
  const { problems } = checkBundles(dir, baseline({ android: 1_000 }));
  assert.equal(problems.length, 2);
  assert.match(problems.join('\n'), /no baseline for ios/);
  assert.match(problems.join('\n'), /android is in the baseline but not in the export/);
});

test('writeBaseline records the measured sizes, and refuses a bundle with markers', () => {
  const clean = exported({ ios: code(3_000), android: code(4_000) });
  const file = join(tempDir(), 'bundle-baseline.json');
  writeBaseline(file, measureBundles(clean));
  const written = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(written.platforms.ios.bytes, 3_000);
  assert.equal(written.platforms.android.bytes, 4_000);

  const dirty = exported({ ios: Buffer.from('siyavula.com/practice'), android: code(10) });
  assert.throws(() => writeBaseline(file, measureBundles(dirty)), /catalogue data/);
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).platforms.ios.bytes, 3_000);
});
