import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every signed-in page fills the same column (docs/design/README.md, "One width"): the layout's
 * `max-w-page` is the only width. A page that narrows itself (`max-w-prose`, `max-w-3xl`…) sat in
 * a strip on the left while First week and My campus filled the row: the owner's review,
 * 2026-10-19. The chat is the one exception: a centred conversation column by design (§2b).
 * Paragraphs keep a readable length on their own (PageHeader's lead is `max-w-prose` itself).
 */

const APP = join(__dirname, '..', 'app', '(app)');
const EXCEPT = new Set(['chat/chat.tsx']);
/**
 * A container narrower than the page: Tailwind's named widths, the tokens' narrower widths
 * (`prose`, and since A2-24 `chat`, `form`, `wide`, `sidebar`), or an arbitrary rem/px one.
 */
const NARROW =
  /\bmax-w-(?:prose|chat|form|wide|sidebar|xs|sm|md|lg|xl|[2-7]xl|\[\d+(?:\.\d+)?(?:rem|px)\])(?![\w-])/;

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(dir, entry.name))
      : entry.name.endsWith('.tsx')
        ? [join(dir, entry.name)]
        : [],
  );
}

describe('one width for every signed-in page', () => {
  it('finds the pages', () => {
    expect(files(APP).length).toBeGreaterThan(20);
  });

  it('no signed-in page narrows its own container, except the chat', () => {
    const narrow = files(APP)
      .map((file) => relative(APP, file).replaceAll('\\', '/'))
      .filter((file) => !EXCEPT.has(file))
      .flatMap((file) =>
        readFileSync(join(APP, file), 'utf8')
          .split('\n')
          .flatMap((line, i) => (NARROW.test(line) ? [`${file}:${i + 1}`] : [])),
      );
    expect(narrow).toEqual([]);
  });

  it('would catch one (the check is proven on a broken example)', () => {
    expect(NARROW.test('<div className="flex max-w-prose flex-col gap-6">')).toBe(true);
    expect(NARROW.test('<div className="flex max-w-3xl flex-col">')).toBe(true);
    expect(NARROW.test('<div className="max-w-[40rem]">')).toBe(true);
    expect(NARROW.test('<div className="mx-auto max-w-form">')).toBe(true);
    expect(NARROW.test('<div className="max-w-chat">')).toBe(true);
    // Not a container width: a chat bubble's share of its row, and the layout's own token.
    expect(NARROW.test('<div className="max-w-[85%]">')).toBe(false);
    expect(NARROW.test('<main className="max-w-page">')).toBe(false);
  });
});
