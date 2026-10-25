import { describe, expect, it } from 'vitest';
import { type CvBlock, cvInlineText, cvTextBlocks, isSafeCvLink } from './cv-text';

/**
 * A2-47: a CV's text as structure, for the web preview (h3/h4/h5, ul, p) and the app (headers,
 * bullet lines), with no Markdown library and no HTML ever. The subset is Mmereko's own partner
 * renderer's (`markdown_to_html_fragment`, services/api/app/partner/safe_render.py at ca855f2, the
 * commit packages/cv/contract is vendored from): headings (levels past 3 count as 3), paragraphs
 * with line breaks, `-`/`*`/`+` bullets, `**strong**`, `*em*`, `[text](https://…)` links, `\`
 * escapes, rules as breaks. Everything else stays text, as written.
 */

const text = (t: string) => ({ kind: 'text', text: t }) as const;

describe('cvTextBlocks (A2-47)', () => {
  it('reads Mmereko’s template: the name, a label, contact, headings, entries and bullets', () => {
    const md = [
      '# Thandi Example',
      '',
      'Grade 12 learner',
      '',
      'Johannesburg, Gauteng · thandi@example.org',
      '',
      '## Education',
      '',
      '### Example High School',
      'Jan 2023 – Present',
      '',
      '- Subjects: Mathematics 71%, English Home Language 64%',
      '',
      '## Skills',
      '',
      '**Programming:** Python, Git',
      '',
    ].join('\n');
    expect(cvTextBlocks(md)).toEqual<CvBlock[]>([
      { kind: 'heading', level: 1, content: [text('Thandi Example')] },
      { kind: 'paragraph', lines: [[text('Grade 12 learner')]] },
      { kind: 'paragraph', lines: [[text('Johannesburg, Gauteng · thandi@example.org')]] },
      { kind: 'heading', level: 2, content: [text('Education')] },
      { kind: 'heading', level: 3, content: [text('Example High School')] },
      { kind: 'paragraph', lines: [[text('Jan 2023 – Present')]] },
      {
        kind: 'list',
        items: [[text('Subjects: Mathematics 71%, English Home Language 64%')]],
      },
      { kind: 'heading', level: 2, content: [text('Skills')] },
      {
        kind: 'paragraph',
        lines: [[{ kind: 'strong', children: [text('Programming:')] }, text(' Python, Git')]],
      },
    ]);
  });

  it('reads the stand-in engine’s text too: nested bullets as items, consecutive lines as one paragraph', () => {
    const md = '# A\n\nline one\nline two\n\n## Education\n- School\n  - Maths, 71%\n';
    expect(cvTextBlocks(md)).toEqual<CvBlock[]>([
      { kind: 'heading', level: 1, content: [text('A')] },
      { kind: 'paragraph', lines: [[text('line one')], [text('line two')]] },
      { kind: 'heading', level: 2, content: [text('Education')] },
      { kind: 'list', items: [[text('School')], [text('Maths, 71%')]] },
    ]);
  });

  it('caps headings at level 3, trims closing marks, and breaks at a rule', () => {
    expect(cvTextBlocks('###### Deep ##\n---\nAfter')).toEqual<CvBlock[]>([
      { kind: 'heading', level: 3, content: [text('Deep')] },
      { kind: 'paragraph', lines: [[text('After')]] },
    ]);
  });

  it('a paragraph line after bullets starts a new paragraph, and bullets after a line a new list', () => {
    expect(cvTextBlocks('- a\nafter\n- b').map((b) => b.kind)).toEqual([
      'list',
      'paragraph',
      'list',
    ]);
  });

  it('prints an escaped mark as itself: the learner’s words never become structure', () => {
    // md_escape's output for "# not a heading", "- not a bullet", "*not em*" and "1. x".
    expect(cvTextBlocks('\\# not a heading')).toEqual([
      { kind: 'paragraph', lines: [[text('# not a heading')]] },
    ]);
    expect(cvTextBlocks('\\- not a bullet \\*not em\\* 1\\. x')).toEqual([
      { kind: 'paragraph', lines: [[text('- not a bullet *not em* 1. x')]] },
    ]);
  });

  it('makes links only of safe https ones; any other stays its own text', () => {
    expect(cvTextBlocks('[Code](https://github.com/example/bus)')).toEqual([
      {
        kind: 'paragraph',
        lines: [
          [{ kind: 'link', url: 'https://github.com/example/bus', children: [text('Code')] }],
        ],
      },
    ]);
    for (const url of [
      'http://example.org',
      'https://localhost/x',
      'https://intranet.local/x',
      'https://10.0.0.1/x',
      'https://user@example.org/x',
      'https://[::1]/x',
      'https://nodot/x',
    ]) {
      expect(cvTextBlocks(`[x](${url})`), url).toEqual([
        { kind: 'paragraph', lines: [[text(`[x](${url})`)]] },
      ]);
    }
  });

  it('never yields HTML: tags are text', () => {
    expect(cvTextBlocks('<script>alert(1)</script> <b>x</b>')).toEqual([
      { kind: 'paragraph', lines: [[text('<script>alert(1)</script> <b>x</b>')]] },
    ]);
  });

  it('reads bold and italic inside links and lists, and handles CRLF and an empty text', () => {
    expect(cvTextBlocks('* **[Demo](https://example.org/d)** and *ok*\r\n')).toEqual([
      {
        kind: 'list',
        items: [
          [
            {
              kind: 'strong',
              children: [{ kind: 'link', url: 'https://example.org/d', children: [text('Demo')] }],
            },
            text(' and '),
            { kind: 'em', children: [text('ok')] },
          ],
        ],
      },
    ]);
    expect(cvTextBlocks('')).toEqual([]);
    expect(cvTextBlocks(null)).toEqual([]);
  });

  it('gives a heading’s plain words, for a screen reader label', () => {
    const [block] = cvTextBlocks('## **Work** Experience');
    expect(block?.kind === 'heading' ? cvInlineText(block.content) : null).toBe('Work Experience');
  });

  it('knows a safe link', () => {
    expect(isSafeCvLink('https://example.org/a?b=c#d')).toBe(true);
    expect(isSafeCvLink('https://example.org/a b')).toBe(false);
    expect(isSafeCvLink('javascript:alert(1)')).toBe(false);
  });
});
