import { describe, expect, it } from 'vitest';
import { cvTextBlocks } from './cv-text';
import { replyTextBlocks } from './reply-text';

/**
 * RT-02 (the owner's run-through, 2026-10-25): the chat showed the model's Markdown as it came,
 * "* **Howard College** (Durban)", asterisks and all. A reply is read as the CV's safe subset plus
 * numbered steps; a link stays its words, since a model can make up an address.
 */

const UKZN = [
  'UKZN is spread across five campuses:',
  '',
  '* **Howard College** (Durban) – Engineering and Law',
  '* **Westville Campus** (Durban) – Science',
  '',
  'To apply:',
  '1. Make a CAO account.',
  '2. Choose up to six programmes.',
].join('\n');

describe('replyTextBlocks', () => {
  it('reads bullets with bold words as a list, never showing the asterisks', () => {
    const blocks = replyTextBlocks(UKZN);
    expect(blocks[0]).toEqual({
      kind: 'paragraph',
      lines: [[{ kind: 'text', text: 'UKZN is spread across five campuses:' }]],
    });
    expect(blocks[1]).toEqual({
      kind: 'list',
      ordered: false,
      items: [
        [
          { kind: 'strong', children: [{ kind: 'text', text: 'Howard College' }] },
          { kind: 'text', text: ' (Durban) – Engineering and Law' },
        ],
        [
          { kind: 'strong', children: [{ kind: 'text', text: 'Westville Campus' }] },
          { kind: 'text', text: ' (Durban) – Science' },
        ],
      ],
    });
  });

  it('reads numbered steps as an ordered list', () => {
    expect(replyTextBlocks(UKZN)[3]).toEqual({
      kind: 'list',
      ordered: true,
      items: [
        [{ kind: 'text', text: 'Make a CAO account.' }],
        [{ kind: 'text', text: 'Choose up to six programmes.' }],
      ],
    });
  });

  it('keeps a link as its words and its address, never a link the model made', () => {
    expect(replyTextBlocks('See [the CAO](https://www.cao.ac.za) today.')).toEqual([
      {
        kind: 'paragraph',
        lines: [[{ kind: 'text', text: 'See the CAO (https://www.cao.ac.za) today.' }]],
      },
    ]);
  });

  it('leaves the CV reading as it was: no numbered lists there', () => {
    expect(cvTextBlocks('1. One')).toEqual([
      { kind: 'paragraph', lines: [[{ kind: 'text', text: '1. One' }]] },
    ]);
    expect(cvTextBlocks('- One')).toEqual([
      { kind: 'list', items: [[{ kind: 'text', text: 'One' }]] },
    ]);
  });
});
