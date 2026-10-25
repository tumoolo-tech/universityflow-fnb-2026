// @vitest-environment jsdom

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StatusLine } from '../components/ui';
import { useStatus } from '../lib/client/status';

/**
 * Audit CV-A2 A2-51 (WCAG 4.1.3): Save, then Save again, said "Saved." once: the status line's
 * text didn't change, so a screen reader heard nothing the second time and the learner couldn't
 * tell the second press worked. Every outcome is now a new line in the live region, even when its
 * words are the same. Synthetic words only.
 */

afterEach(cleanup);

function Harness({ words }: { words: string }) {
  const [status, say] = useStatus();
  return (
    <>
      <StatusLine said={status} />
      <button type="button" onClick={() => say(words)}>
        Synthetic save
      </button>
      <button type="button" onClick={() => say('')}>
        Synthetic clear
      </button>
    </>
  );
}

describe('a repeated outcome is announced again (A2-51)', () => {
  it('replaces the line in the live region each time, even with the same words', () => {
    render(<Harness words="Synthetic saved." />);
    const region = screen.getByRole('status');
    expect(region.textContent).toBe('');
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Synthetic save' })));
    const first = region.firstElementChild;
    expect(region.textContent).toBe('Synthetic saved.');
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Synthetic save' })));
    expect(region.textContent).toBe('Synthetic saved.');
    // A new node: the region announces an addition, as it did the first time.
    expect(region.firstElementChild).not.toBeNull();
    expect(region.firstElementChild).not.toBe(first);
    // The region itself stays put: a live region must be in the page before it speaks.
    expect(screen.getByRole('status')).toBe(region);
  });

  it('takes no space while it says nothing, and says nothing once cleared', () => {
    render(<Harness words="Synthetic saved." />);
    const region = screen.getByRole('status');
    expect(region.className).toContain('empty:sr-only');
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Synthetic save' })));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Synthetic clear' })));
    expect(region.childNodes).toHaveLength(0);
  });

  it('every status line in the web app speaks through `said`, so none can repeat silently', () => {
    const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const files = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? files(join(dir, entry.name))
          : entry.name.endsWith('.tsx')
            ? [join(dir, entry.name)]
            : [],
      );
    const lines = [...files(join(WEB, 'app')), ...files(join(WEB, 'components'))].flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/<StatusLine\b[^>]*>/g)].map((m) => ({
        at: relative(WEB, file).replaceAll('\\', '/'),
        tag: m[0],
      })),
    );
    expect(lines.length).toBeGreaterThanOrEqual(7);
    expect(lines.filter((l) => !/\bsaid=/.test(l.tag)).map((l) => l.at)).toEqual([]);
  });
});
