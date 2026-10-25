// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { en } from '@universityflow/content';
import { toCss, tokens } from '@universityflow/tokens';
import { DEFAULT_LOOK, type ProfileLook as Look, THEME_IDS } from '@universityflow/ui';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { ProfileLook } = await import('../app/(app)/me/profile-look');
const { lookStyle } = await import('../components/avatar');

/**
 * The About me card and "Make it yours" (docs/design/profile-look-proposal.md, step 5): the
 * learner's look, previewed live and saved with one PATCH; drawn on the server so it never waits
 * for JavaScript; every animation with a reduced-motion path (hard rule 9).
 */

const t = en.profileLook;
const css = readFileSync(resolve(__dirname, '../app/globals.css'), 'utf8');

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stub() {
  const bodies: unknown[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_path: string, init: RequestInit = {}) => {
      if (init.method === 'PATCH') bodies.push(JSON.parse(String(init.body)));
      return Response.json({ profile: {} });
    }),
  );
  return bodies;
}

const LOOK: Look = {
  theme: 'ocean',
  avatar: 'initials',
  taglineId: 'small-steps',
  badgeIds: ['future-engineer', 'loves-maths'],
};

const card = (props: Partial<Parameters<typeof ProfileLook>[0]> = {}) => (
  <ProfileLook name="Thando Mokoena" grade={10} initial={LOOK} {...props} />
);

describe('the profile card', () => {
  it('says the name, the grade, the words and the tagline, and hides the decoration', () => {
    const { container } = render(card());
    expect(screen.getByRole('heading', { level: 2, name: 'Thando Mokoena' })).toBeTruthy();
    expect(screen.getByText(en.onboarding.gradeOption(10))).toBeTruthy();
    const words = screen.getByRole('list', { name: t.myWords });
    expect(
      within(words)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([t.badges['future-engineer'], t.badges['loves-maths']]);
    expect(screen.getByText(t.taglines['small-steps'], { selector: 'p' })).toBeTruthy();
    // "Hello", the line and the avatar are decoration: the name is already said.
    for (const svg of container.querySelectorAll('svg')) {
      expect(svg.closest('[aria-hidden="true"]')).toBeTruthy();
    }
    expect(container.querySelector('[data-avatar="card"]')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    expect(container.querySelector('[data-avatar="card"]')?.textContent).toBe('TM');
  });

  it('has a heading and an icon avatar without a name, and no sticker past matric', () => {
    const { container } = render(card({ name: null, grade: null, initial: DEFAULT_LOOK }));
    expect(screen.getByRole('heading', { level: 2, name: t.noName })).toBeTruthy();
    expect(container.querySelector('[data-avatar="card"] svg')).toBeTruthy();
    expect(screen.queryByRole('list', { name: t.myWords })).toBeNull();
    expect(screen.queryByText(/^Grade \d+$/)).toBeNull();
  });

  it('is drawn on the server: the whole card is there before any script runs', () => {
    const html = renderToStaticMarkup(card());
    expect(html).toContain('Thando Mokoena');
    expect(html).toContain(t.badges['loves-maths']);
    expect(html).toContain(t.taglines['small-steps']);
    expect(html).toContain('--look-accent:var(--uf-color-profile-ocean)');
  });

  it('colours itself from the theme’s tokens, every theme a colour the web has', () => {
    const generated = toCss();
    for (const id of THEME_IDS) {
      const style = lookStyle(id) as Record<string, string>;
      for (const value of Object.values(style)) {
        const name = /^var\((--uf-color-[a-z-]+)\)$/.exec(value)?.[1];
        expect(name, `${id}: ${value}`).toBeTruthy();
        expect(generated).toContain(`${name}:`);
      }
    }
    expect(lookStyle('mono')).toMatchObject({ '--look-accent': 'var(--uf-color-ink)' });
    expect(Object.keys(tokens.profileThemes)).toEqual([...THEME_IDS]);
  });
});

describe('Make it yours', () => {
  const open = () => fireEvent.click(screen.getByRole('button', { name: t.open }));

  it('opens as a disclosure, with every theme, picture, tagline and word named', () => {
    render(card());
    const button = screen.getByRole('button', { name: t.open });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    open();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const themes = screen.getByRole('radiogroup', { name: t.theme });
    expect(within(themes).getAllByRole('radio')).toHaveLength(7);
    expect(within(themes).getByRole('radio', { name: t.themes.ocean })).toHaveProperty(
      'checked',
      true,
    );
    const pictures = screen.getByRole('radiogroup', { name: t.avatar });
    expect(within(pictures).getAllByRole('radio')).toHaveLength(19);
    expect(within(pictures).getByRole('radio', { name: t.icons.rocket })).toBeTruthy();
    expect(within(pictures).getByRole('radio', { name: t.patterns.waves })).toBeTruthy();
    // Each kind's heading names its pictures for a screen reader too (A2-33, WCAG 1.3.1).
    for (const [kind, count] of [
      [t.avatarKinds.initials, 1],
      [t.avatarKinds.icons, 12],
      [t.avatarKinds.patterns, 6],
    ] as const) {
      const group = within(pictures).getByRole('group', { name: kind });
      expect(within(group).getAllByRole('radio')).toHaveLength(count);
    }
    expect(screen.getByRole('combobox', { name: t.tagline })).toBeTruthy();
    const words = screen.getByRole('group', { name: t.words });
    expect(within(words).getAllByRole('checkbox')).toHaveLength(Object.keys(t.badges).length);
  });

  it('previews a choice on the card at once, and stores nothing until Save', async () => {
    const bodies = stub();
    const { container } = render(card());
    open();
    fireEvent.click(screen.getByRole('radio', { name: t.themes.sunrise }));
    fireEvent.click(screen.getByRole('radio', { name: t.icons.rocket }));
    fireEvent.change(screen.getByRole('combobox', { name: t.tagline }), {
      target: { value: 'keep-going' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: t.badges['night-owl'] }));
    const section = container.querySelector('section') as HTMLElement;
    expect(section.getAttribute('style')).toContain('var(--uf-color-profile-sunrise)');
    expect(container.querySelector('[data-avatar="card"] svg')).toBeTruthy();
    expect(screen.getAllByText(t.taglines['keep-going']).length).toBeGreaterThan(0);
    expect(bodies).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: t.save }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(t.saved));
    expect(bodies).toEqual([
      {
        theme: 'sunrise',
        avatar: 'icon:rocket',
        taglineId: 'keep-going',
        badgeIds: ['future-engineer', 'loves-maths', 'night-owl'],
      },
    ]);
  });

  it('puts the saved look back on Cancel', () => {
    const bodies = stub();
    const { container } = render(card());
    open();
    fireEvent.click(screen.getByRole('radio', { name: t.themes.protea }));
    fireEvent.click(screen.getByRole('button', { name: t.cancel }));
    const section = container.querySelector('section') as HTMLElement;
    expect(section.getAttribute('style')).toContain('var(--uf-color-profile-ocean)');
    expect(screen.getByRole('button', { name: t.open }).getAttribute('aria-expanded')).toBe(
      'false',
    );
    expect(bodies).toEqual([]);
  });

  it('puts focus back on "Make it yours" when Save or Cancel closes the picker (A2-28, WCAG 2.4.3)', async () => {
    stub();
    render(card());
    open();
    const toggle = screen.getByRole('button', { name: t.open });
    const save = screen.getByRole('button', { name: t.save });
    save.focus();
    fireEvent.click(save);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(t.saved));
    // The picker is hidden with the focused Save inside it: focus must not fall to <body>.
    await waitFor(() => expect(document.activeElement).toBe(toggle));

    open();
    const cancel = screen.getByRole('button', { name: t.cancel });
    cancel.focus();
    fireEvent.click(cancel);
    await waitFor(() => expect(document.activeElement).toBe(toggle));
  });

  it('lets three words be chosen, and says why a fourth can’t be', () => {
    render(card());
    open();
    fireEvent.click(screen.getByRole('checkbox', { name: t.badges['night-owl'] }));
    expect(screen.getByText(t.wordsChosen(3, 3))).toBeTruthy();
    const fourth = screen.getByRole('checkbox', { name: t.badges.bookworm }) as HTMLInputElement;
    // Blocked but still focusable, so a keyboard user hears why (A3-12).
    expect(fourth.getAttribute('aria-disabled')).toBe('true');
    expect(fourth.disabled).toBe(false);
    const reason = document.getElementById(fourth.getAttribute('aria-describedby') ?? '');
    expect(reason?.textContent).toContain(t.wordsFull(3));
    fireEvent.click(fourth);
    expect(fourth.checked).toBe(false);
    expect(screen.getByText(t.wordsChosen(3, 3))).toBeTruthy();
    // Unticking one frees a place.
    fireEvent.click(screen.getByRole('checkbox', { name: t.badges['loves-maths'] }));
    expect(fourth.getAttribute('aria-disabled')).toBe('false');
    fireEvent.click(fourth);
    expect(fourth.checked).toBe(true);
  });
});

describe('the card’s styles (globals.css)', () => {
  it('draws every pattern', () => {
    for (const id of Object.keys(t.patterns)) expect(css).toContain(`.uf-pattern-${id} {`);
  });

  it('keeps a long word inside the poster where the words float (A2-32, WCAG 1.4.4 and 1.4.10)', () => {
    // From 40rem the words float right and left of the figure. A word that may not wrap ran past
    // the poster's right edge at 40 to 48rem (and at 200% zoom on a laptop) and was cut off by
    // the card's `overflow: hidden`.
    const start = css.indexOf('/* The words float round the figure');
    expect(start).toBeGreaterThan(0);
    const wide = css.slice(start, css.indexOf('/* The line, from the end of "Hello"', start));
    const rule =
      /@media \(min-width: 40rem\) \{\s*\.uf-look-chips > \.uf-look-chip \{([^}]*)\}/.exec(
        css,
      )?.[1] ?? '';
    expect(rule, 'a floating word that wraps, more specific than the base chip rule').toMatch(
      /white-space: normal/,
    );
    const maxWidth = Number(/max-width: (\d+)%/.exec(rule)?.[1]);
    // Every word starts at most 68% across, so it must end inside the poster.
    for (const left of [...wide.matchAll(/left: (\d+)%/g)].map((m) => Number(m[1]))) {
      expect(left + maxWidth, `a word ${left}% across`).toBeLessThanOrEqual(100);
    }
  });

  it('grows the grade sticker with its text instead of a fixed circle (A2-38, WCAG 1.4.4, 1.4.12)', () => {
    // Every rule for the sticker, wherever it sits in the file.
    const rules = [...css.matchAll(/\.uf-look-sticker \{([^}]*)\}/g)].map((m) => m[1] ?? '');
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      // A fixed size let "Grade 10" spill out under larger text spacing.
      expect(rule).not.toMatch(/(^|[^-])(width|height):/);
    }
    const all = rules.join('');
    expect(all).toMatch(/min-width:/);
    expect(all).toMatch(/min-height:/);
    expect(all).toMatch(/padding:/);
  });

  it('floats the words with absolute positions from 40rem: no later rule wins (A2-39)', () => {
    // From 40rem the words are laid over the poster. The chip's base rule (`position: relative`)
    // comes later in the file, so the media rule must be more specific or the words stack and
    // each offset adds the height of the words above it.
    // Classes and pseudo-classes only: every selector here is made of them.
    const specificity = (selector: string) =>
      (selector.match(/\.[\w-]+|(?<!:):(?!:)[\w-]+/g) ?? []).length;
    const rules = (text: string) =>
      [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
        selector: (m[1] ?? '').replace(/\/\*[\s\S]*?\*\//g, '').trim(),
        body: m[2] ?? '',
      }));
    const isChip = (selector: string) => /\.uf-look-chip(?![\w-])/.test(selector);
    const start = css.indexOf('/* The words float round the figure');
    expect(start).toBeGreaterThan(0);
    const end = css.indexOf('/* The line, from the end of "Hello"', start);
    const floating = rules(css.slice(start, end)).find(
      (r) => isChip(r.selector) && /position: absolute/.test(r.body),
    );
    expect(floating, 'a rule that lays each word out absolutely').toBeTruthy();
    const later = rules(css.slice(end)).filter((r) => /position:/.test(r.body));
    for (const rule of later) {
      for (const selector of rule.selector.split(',').map((s) => s.trim())) {
        if (!isChip(selector)) continue;
        expect(
          specificity(floating?.selector ?? ''),
          `"${floating?.selector}" against the later "${selector}"`,
        ).toBeGreaterThan(specificity(selector));
      }
    }
  });

  it('switches off every animation the card has for reduced motion (hard rule 9)', () => {
    const start = css.indexOf('* The profile card');
    expect(start).toBeGreaterThan(0);
    const reduced = css.slice(start);
    const block = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n {2}\}/.exec(
      reduced,
    )?.[1];
    expect(block, 'a reduced-motion block for the card').toBeTruthy();
    for (const selector of ['.uf-look-line', '.uf-look-chip', '.uf-look-rise', '.uf-look-saved']) {
      expect(block).toContain(selector);
    }
    expect(block).toMatch(/animation: none/);
    // The line is shown fully drawn, never left invisible.
    expect(block).toMatch(/stroke-dasharray: none/);
  });
});
