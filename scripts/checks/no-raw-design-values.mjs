import { join } from 'node:path';
import { isExempt, readLines, rel, walk } from './lib/walk.mjs';

/**
 * Guard: every colour in `apps/`, every size in the mobile app's styles and every border width in
 * the web app comes from @universityflow/tokens (hard rule 8). Ported from
 * tumo-olo, where it stopped the design system decaying into hand-typed hex codes.
 *
 * Escape hatch: `check-ignore` in a comment on the line, with a reason.
 */

const RULES = [
  {
    pattern: /#[0-9a-fA-F]{3,8}\b/,
    message: 'hard-coded hex colour. Import it from @universityflow/tokens',
  },
  {
    pattern: /\b(?:rgba?|hsla?|oklch)\(\s*\d/,
    message: 'hard-coded colour function. Import it from @universityflow/tokens',
  },
];

/**
 * The mobile app's style objects (A2-05): a border width, spacing, radius, type size or box size
 * written as a number literal instead of a theme value (`theme.border.thin`, `theme.space['4']`).
 * A ternary's branches count (`borderWidth: on ? 2 : 1`). Zero is a reset, not a design value,
 * and percentages are strings, so neither is flagged. The web is held by Tailwind's scale,
 * whose border widths must be the token classes (below).
 */
const NATIVE_SIZE_PROPS = [
  'border(?:Top|Bottom|Left|Right|Start|End)?Width',
  'border(?:Top|Bottom)?(?:Left|Right|Start|End)?Radius',
  '(?:padding|margin)(?:Top|Bottom|Left|Right|Horizontal|Vertical|Start|End)?',
  '(?:row|column)?[gG]ap',
  'fontSize',
  'lineHeight',
  '(?:min|max)?(?:[wW]idth|[hH]eight)',
].join('|');
const NATIVE_SIZE = new RegExp(
  `(?<![\\w.])(${NATIVE_SIZE_PROPS})\\s*:\\s*(?:[^,;{}]*\\?\\s*)?(-?\\d*\\.?\\d+)(?![\\w.%'"])`,
);

function nativeSizeFinding(line) {
  const match = NATIVE_SIZE.exec(line);
  if (!match || Number(match[2]) === 0) return null;
  return `raw ${match[1]} (${match[2]}) in a native style. Use the theme (theme.space, theme.border, theme.radius, theme.text)`;
}

/**
 * The web app's border widths (A2-17): Tailwind's numbered (`border-2`, `border-l-4`) or arbitrary
 * (`border-[3px]`) widths instead of the token classes globals.css maps to `tokens.border`
 * (`border-thin`, `border-thick`, `border-l-rule`, A2-05). Plain `border`, a colour
 * (`border-brand`) and a reset (`border-0`) aren't widths from the scale, so none is flagged.
 */
const WEB_BORDER_WIDTH = /(?<![\w-])border(?:-[trblxyse])?-(?:[1-9]\d*|\[[^\]\s]*\])(?![\w-])/;

function webBorderFinding(line) {
  const match = WEB_BORDER_WIDTH.exec(line);
  if (!match) return null;
  return `raw border width \`${match[0]}\` in the web app. Use the token classes (border-thin, border-thick, border-l-rule)`;
}

export function run(root) {
  const findings = [];

  for (const file of walk(join(root, 'apps'), ['.ts', '.tsx', '.css'])) {
    const relative = rel(root, file);
    if (/\.test\.tsx?$/.test(relative) || relative.includes('/e2e/')) continue;
    const native = relative.startsWith('apps/native/') && !relative.endsWith('.css');
    const web = relative.startsWith('apps/web/');

    readLines(file).forEach((line, index) => {
      if (isExempt(line)) return;
      for (const { pattern, message } of RULES) {
        if (pattern.test(line)) {
          findings.push({ file: relative, line: index + 1, message, snippet: line.trim() });
        }
      }
      const size = native ? nativeSizeFinding(line) : web ? webBorderFinding(line) : null;
      if (size) {
        findings.push({ file: relative, line: index + 1, message: size, snippet: line.trim() });
      }
    });
  }

  return findings;
}

export const meta = {
  id: 'no-raw-design-values',
  description:
    'apps/* take colours, the mobile app its sizes and the web its border widths, from @universityflow/tokens (CLAUDE.md rule 8)',
};
