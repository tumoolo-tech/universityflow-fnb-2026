import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The signed-in pages, consistent (polish-pages, the owner's "consistency … aligned well" of
 * 2026-10-24; docs/design/README.md "One rhythm"). Rules a screenshot showed broken:
 * - a tick box looked three ways: the brand `Checkbox` on First week, the browser's blue on My goal
 *   and the application pack, its grey on Funding and About me, and on Funding at 360px a long
 *   label squeezed the box to 13px wide (no `shrink-0`);
 * - an "Official source" link on its own line was 23px tall (under WCAG 2.5.8's 24px);
 * - cards sat 12px apart on the home, 16px on Applications and My offers, 24px everywhere else;
 * - a card's parts were spaced by hand-set margins (8, 12 or 16px under the title, by page);
 * - card titles were two sizes (`text-xl` on Applications and the re-check card).
 */

const WEB = join(__dirname, '..');
const read = (path: string) => readFileSync(join(WEB, path), 'utf8');

/** The pages and components in the polish-pages patch (the brief's list). */
const PATCH = [
  'components/dashboard.tsx',
  'components/school-record.tsx',
  'components/grade-check.tsx',
  'components/study-choice.tsx',
  'components/marks-chart.tsx',
  'components/artifacts.tsx',
  'components/goals.tsx',
  'components/offers.tsx',
  'components/recheck-card.tsx',
  'components/campus.tsx',
  'components/wayfinding.tsx',
  'components/place-links.tsx',
  'components/safety-notes.tsx',
  'components/practice.tsx',
  'components/coming-next.tsx',
  'components/read-aloud.tsx',
  'components/written-care.tsx',
  'app/(app)/applications/page.tsx',
  'app/(app)/applications/[university]/pack-view.tsx',
  'app/(app)/documents/documents-view.tsx',
  'app/(app)/funding/funding-view.tsx',
  'app/(app)/goals/goals-view.tsx',
  'app/(app)/me/me-view.tsx',
  'app/(app)/me/messages-card.tsx',
  'app/(app)/offers/offers-view.tsx',
];

/** Where each card's parts are spaced by the card's own gap now, never by margins. */
const GAP_CARDS = [
  'app/(app)/applications/[university]/pack-view.tsx',
  'app/(app)/documents/documents-view.tsx',
  'app/(app)/funding/funding-view.tsx',
  'app/(app)/me/me-view.tsx',
  'app/(app)/me/messages-card.tsx',
];

const RAW_CHECKBOX = /type="checkbox"/;
const SOURCE_LINK = /<SourceLink\b[^>]*\/>/;
const CARD_TITLE_XL = /<h2\b[^>]*\btext-xl\b/;
/**
 * A margin that spaces a card's parts (a `legend` can't take a flex gap, so it keeps its own; a
 * half-step nudge that lines a tick box up with its label's first line is not spacing).
 */
const PART_MARGIN = /^(?!.*<legend\b).*className="[^"]*\b(?:mt|mb)-[1-9]/;

function lines(file: string, test: (line: string) => boolean): string[] {
  return read(file)
    .split('\n')
    .flatMap((line, i) => (test(line) ? [`${file}:${i + 1}`] : []));
}

describe('the signed-in pages, consistent', () => {
  it('every tick box is the brand Checkbox (one colour, never squeezed)', () => {
    expect(PATCH.flatMap((f) => lines(f, (l) => RAW_CHECKBOX.test(l)))).toEqual([]);
  });

  it('an official-source link has the full touch target', () => {
    expect(
      PATCH.flatMap((f) => lines(f, (l) => SOURCE_LINK.test(l) && !/\brow\b/.test(l))),
    ).toEqual([]);
  });

  it('a card title is one size (text-lg), as on the home', () => {
    expect(PATCH.flatMap((f) => lines(f, (l) => CARD_TITLE_XL.test(l)))).toEqual([]);
  });

  it('cards sit one gap apart (24px), the same as the parts of a page', () => {
    const lists: Array<[string, RegExp]> = [
      [
        'components/dashboard.tsx',
        /<div className="(?:uf-settle )?grid gap-\d+ md:grid-cols-2 xl:grid-cols-3/g,
      ],
      ['app/(app)/applications/page.tsx', /<ul className="grid gap-\d+ md:grid-cols-2/g],
      [
        'app/(app)/applications/[university]/pack-view.tsx',
        /<ul className="grid gap-\d+ md:grid-cols-2/g,
      ],
      [
        'app/(app)/offers/offers-view.tsx',
        /<div className="flex flex-col gap-\d+">\s*\{data\.offers\.map/g,
      ],
    ];
    for (const [file, pattern] of lists) {
      const found = read(file).match(pattern) ?? [];
      expect(found.length, file).toBeGreaterThan(0);
      for (const list of found) expect(list, file).toMatch(/gap-6\b/);
    }
  });

  it('a card spaces its parts with its own gap, not margins', () => {
    expect(GAP_CARDS.flatMap((f) => lines(f, (l) => PART_MARGIN.test(l)))).toEqual([]);
  });

  it('the home’s action links never push their card’s title down (titles line up across a row)', () => {
    // The 44px "My results" link sat in the title row, so "My shortlist" started 4px below "What
    // do I need?" beside it. Its target stays 44px; it overhangs into the card's padding.
    expect(read('components/dashboard.tsx')).toMatch(/-my-2\.5 inline-flex min-h-11 items-center/);
  });

  it('the chart’s table opens smoothly, as My subjects’ disclosures do', () => {
    expect(read('components/marks-chart.tsx')).toMatch(/<details className="uf-door\b/);
  });

  it('the checks are proven on broken examples', () => {
    expect(RAW_CHECKBOX.test('<input type="checkbox" className="size-5" />')).toBe(true);
    expect(SOURCE_LINK.test('        <SourceLink href={nsfas.sourceUrl} />')).toBe(true);
    expect(CARD_TITLE_XL.test('<h2 id="x" className="text-xl">')).toBe(true);
    expect(PART_MARGIN.test('<h2 className="mb-3 text-lg">')).toBe(true);
    expect(PART_MARGIN.test('<legend className="mb-2 font-medium">')).toBe(false);
    expect(PART_MARGIN.test('<Checkbox className="mt-0.5" />')).toBe(false);
  });
});

describe('the signed-in pages, smooth', () => {
  const CSS = read('app/globals.css');
  const block = CSS.slice(CSS.indexOf('/* polish-pages:'), CSS.indexOf('/* end polish-pages */'));

  it('the home’s cards settle in once, from CSS (the first screen never waits on JavaScript)', () => {
    expect(block.length).toBeGreaterThan(0);
    expect(read('components/dashboard.tsx')).toMatch(/className="uf-settle grid/);
    const keyframes = /@keyframes uf-settle\s*\{([\s\S]*?)\n {2}\}/.exec(block)?.[1] ?? '';
    // Transform only: a card's words are never invisible, so nothing waits to be painted.
    expect(keyframes).toContain('translateY(var(--uf-motion-rise-small))');
    expect(keyframes).not.toContain('opacity');
    expect(block).toMatch(
      /animation:\s*uf-settle var\(--uf-duration-enter\) var\(--uf-easing-enter\)/,
    );
  });

  it('every motion in the block has a reduced-motion path and uses the tokens', () => {
    expect(block).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.uf-settle[^{]*\{\s*animation: none;/,
    );
    expect(block).not.toMatch(/\d+m?s\b/);
  });
});
