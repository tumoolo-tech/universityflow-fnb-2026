/**
 * A CV's text as structure (audit CV-A2, A2-47), for the web preview and the app: blocks and
 * inline runs the screens render as real headings, lists and paragraphs, so a screen reader reads
 * "heading level 3, Education", not "number sign number sign Education". No Markdown library and
 * never HTML: everything that isn't the subset below stays the text it is.
 *
 * The subset is the one Mmereko itself prints the PDF from (`markdown_to_html_fragment` in its
 * partner renderer, services/api/app/partner/safe_render.py, at ca855f2, the commit
 * packages/cv/contract is vendored from), for a base CV from its template and a fitted CV from
 * its model alike: `#` to `######` headings (past 3 count as 3), paragraphs whose lines break,
 * `-`/`*`/`+` bullets, `**strong**`, `*em*`, `[text](url)` links (https to a public host only,
 * otherwise the text as written), backslash escapes, and `---` rules as breaks. Mmereko escapes
 * every learner word (`md_escape`), so their words never become structure. Pure TypeScript: it
 * runs under React Native too (hard rule 11).
 */

export type CvInline =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'strong'; readonly children: ReadonlyArray<CvInline> }
  | { readonly kind: 'em'; readonly children: ReadonlyArray<CvInline> }
  | { readonly kind: 'link'; readonly url: string; readonly children: ReadonlyArray<CvInline> };

export type CvBlock =
  | {
      readonly kind: 'heading';
      readonly level: 1 | 2 | 3;
      readonly content: ReadonlyArray<CvInline>;
    }
  | { readonly kind: 'paragraph'; readonly lines: ReadonlyArray<ReadonlyArray<CvInline>> }
  | {
      readonly kind: 'list';
      /** Numbered steps; given only when reading with `numbered` (a chat reply). */
      readonly ordered?: boolean;
      readonly items: ReadonlyArray<ReadonlyArray<CvInline>>;
    };

/** How far past the CV's own subset to read (packages/ui reply-text.ts). */
export interface CvTextOptions {
  /** `1.` / `1)` lines as an ordered list. Default false: the CV's subset has none. */
  readonly numbered?: boolean;
  /** Safe https links as links. False: a link is its words and its address, as text. */
  readonly links?: boolean;
}

const ESCAPABLE = '[!-/:-@\\[-`{-~]';
const INLINE = new RegExp(
  `\\\\(${ESCAPABLE})` +
    '|\\[((?:\\\\.|[^\\]\\\\\\n])*)\\]\\(([^()\\s]*)\\)' +
    '|\\*\\*((?:\\\\.|[^*\\\\])+?)\\*\\*' +
    '|\\*((?:\\\\.|[^*\\\\\\s](?:\\\\.|[^*\\\\])*?))\\*',
  'g',
);
const UNESCAPE = new RegExp(`\\\\(${ESCAPABLE})`, 'g');
const HEADING = /^(#{1,6})[ \t]+(.*)$/;
const BULLET = /^[ \t]*[-*+][ \t]+(.*)$/;
const NUMBERED = /^[ \t]*\d{1,3}[.)][ \t]+(.*)$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const SAFE_URL = /^https:\/\/[^\s"'<>\\`]+$/;

/**
 * A link the preview may make: https, to a named public host (no user name, no IP address, no
 * localhost or private name), as packages/cv's `safeLinkProblem` and migration 0035's
 * `uf_cv_link_ok` hold the learner's own links to. Anything else is shown as text.
 */
export function isSafeCvLink(url: string): boolean {
  if (!SAFE_URL.test(url) || url.length > 500) return false;
  const authority = url.slice('https://'.length).split(/[/?#]/)[0] ?? '';
  if (authority.includes('@') || authority.startsWith('[')) return false;
  const host = (authority.split(':')[0] ?? '').toLowerCase().replace(/\.$/, '');
  if (!host.includes('.') || /^[0-9.]+$/.test(host)) return false;
  return !/(^localhost$|\.(localhost|local|internal|lan|home|corp|intranet)$)/.test(host);
}

/** Adjacent text runs as one. */
function merged(runs: CvInline[]): CvInline[] {
  const out: CvInline[] = [];
  for (const run of runs) {
    const last = out.at(-1);
    if (run.kind === 'text' && last?.kind === 'text') {
      out[out.length - 1] = { kind: 'text', text: last.text + run.text };
    } else if (run.kind !== 'text' || run.text !== '') {
      out.push(run);
    }
  }
  return out;
}

function inline(source: string, links = true): CvInline[] {
  const runs: CvInline[] = [];
  let at = 0;
  for (const m of source.matchAll(INLINE)) {
    const start = m.index ?? 0;
    runs.push({ kind: 'text', text: source.slice(at, start) });
    const [whole, escaped, label, url, strong, em] = m;
    if (escaped !== undefined) runs.push({ kind: 'text', text: escaped });
    else if (url !== undefined) {
      if (!links) {
        // Not a link, but its words and where it pointed, so nothing is hidden.
        runs.push({ kind: 'text', text: `${cvInlineText(inline(label ?? '', false))} (${url})` });
      } else if (isSafeCvLink(url)) {
        runs.push({ kind: 'link', url, children: inline(label ?? '') });
      }
      // A refused link is its own text: escapes still apply, nothing becomes structure.
      else runs.push({ kind: 'text', text: whole.replace(UNESCAPE, '$1') });
    } else if (strong !== undefined) runs.push({ kind: 'strong', children: inline(strong, links) });
    else runs.push({ kind: 'em', children: inline(em ?? '', links) });
    at = start + whole.length;
  }
  runs.push({ kind: 'text', text: source.slice(at) });
  return merged(runs);
}

/** The CV's text (Markdown in Mmereko's subset) as blocks. Null or empty: no blocks. */
export function cvTextBlocks(
  markdown: string | null | undefined,
  options: CvTextOptions = {},
): CvBlock[] {
  const { numbered = false, links = true } = options;
  const blocks: CvBlock[] = [];
  let lines: CvInline[][] = [];
  let items: CvInline[][] = [];
  let ordered = false;
  const flush = () => {
    if (lines.length > 0) blocks.push({ kind: 'paragraph', lines });
    if (items.length > 0) {
      blocks.push(numbered ? { kind: 'list', ordered, items } : { kind: 'list', items });
    }
    lines = [];
    items = [];
  };
  const inline_ = (source: string) => inline(source, links);
  for (const raw of (markdown ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    if (line.trim() === '' || RULE.test(line)) {
      flush();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      const marks = heading[1] ?? '#';
      const title = (heading[2] ?? '').replace(/[ \t#]+$/, '') || (heading[2] ?? '');
      blocks.push({
        kind: 'heading',
        level: Math.min(marks.length, 3) as 1 | 2 | 3,
        content: inline_(title.trim()),
      });
      continue;
    }
    const step = numbered ? NUMBERED.exec(line) : null;
    const bullet = step ?? BULLET.exec(line);
    if (bullet) {
      // A paragraph, or a list of the other kind, ends where this list starts.
      if (lines.length > 0 || (items.length > 0 && ordered !== (step !== null))) flush();
      ordered = step !== null;
      items.push(inline_(bullet[1] ?? ''));
      continue;
    }
    if (items.length > 0) flush();
    lines.push(inline_(line.trim()));
  }
  flush();
  return blocks;
}

/** The plain words of inline runs (a heading's, for a label). */
export function cvInlineText(runs: ReadonlyArray<CvInline>): string {
  return runs.map((r) => (r.kind === 'text' ? r.text : cvInlineText(r.children))).join('');
}
