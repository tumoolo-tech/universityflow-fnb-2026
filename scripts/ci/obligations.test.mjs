import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { obligations, parseAdded, toMarkdown } from './obligations.mjs';

const ids = (owed) => owed.map((o) => o.id).sort();

describe('obligations', () => {
  it('a crisis phrase change owes the red-team and a first-language review', () => {
    const owed = obligations(['packages/agent/src/crisis.ts']);
    assert.deepEqual(ids(owed), ['crisis-language-review', 'red-team']);
  });

  it('a catalogue data edit owes the owner a re-verification', () => {
    const owed = obligations(['packages/catalogue/src/data/wits.ts']);
    assert.deepEqual(ids(owed), ['catalogue-verification']);
  });

  it('flags added verifiedBy lines for a person to attest, but not other edits', () => {
    const file = 'packages/catalogue/src/data/uj.ts';
    const withAttestation = obligations([file], [{ file, text: "    verifiedBy: 'Someone'," }]);
    assert.ok(ids(withAttestation).includes('human-attestation'));

    const without = obligations([file], [{ file, text: '    minimumScore: 30,' }]);
    assert.ok(!ids(without).includes('human-attestation'));

    const schema = 'packages/catalogue/src/provenance.ts';
    const definingTheField = obligations(
      [schema],
      [{ file: schema, text: '  verifiedBy: z.string(),' }],
    );
    assert.ok(!ids(definingTheField).includes('human-attestation'));
  });

  it('a model id change owes A10, even outside the agent package', () => {
    const file = 'apps/web/lib/server/config.ts';
    const owed = obligations([file], [{ file, text: "anthropicModel: 'claude-opus-5-5'," }]);
    assert.deepEqual(ids(owed), ['model-change']);
  });

  it('db source owes A11 but its tests do not', () => {
    assert.deepEqual(ids(obligations(['packages/db/src/schema.ts'])), ['privacy']);
    assert.deepEqual(ids(obligations(['packages/db/src/store.test.ts'])), []);
  });

  it('a docs-only change owes nothing extra', () => {
    const owed = obligations(['docs/data-verification.md', 'README.md']);
    assert.equal(owed.length, 0);
    assert.match(toMarkdown(owed), /Nothing beyond the standard gate/);
  });

  it('marks CI-enforced checks apart from the ones a person must tick', () => {
    const md = toMarkdown(obligations(['packages/agent/src/crisis.ts']));
    assert.match(md, /✅ CI/);
    assert.match(md, /☐ \| first-language speakers/);
    assert.match(md, /owes \*\*1\*\* check that only a person/);
  });
});

describe('parseAdded', () => {
  it('reads added lines per file and skips removals and deleted files', () => {
    const diff = [
      'diff --git a/x.ts b/x.ts',
      '--- a/x.ts',
      '+++ b/x.ts',
      '@@ -1 +1 @@',
      '-old',
      '+new',
      'diff --git a/gone.ts b/gone.ts',
      '--- a/gone.ts',
      '+++ /dev/null',
      '-bye',
    ].join('\n');
    assert.deepEqual(parseAdded(diff), [{ file: 'x.ts', text: 'new' }]);
  });
});
