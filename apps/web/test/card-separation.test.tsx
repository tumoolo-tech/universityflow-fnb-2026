// @vitest-environment jsdom

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { CARD_PAIRS, contrastRatio, tokens } from '@universityflow/tokens';
import { afterEach, describe, expect, it } from 'vitest';
import { Card, cardListGap, panelLook } from '@/components/ui';

/**
 * RT-04 (the owner's run-through, 2026-10-25): "I cannot clearly see the separation of the
 * cards." On the dark theme a card's `line` edge was 1.40:1 against the page, and a tile inside a
 * card (the goal's course, a plan map, a practice subject, the course picker) had no edge at all
 * on a fill 1.10:1 from its parent's. Every card now has the tokens' `cardEdge` (3:1 against
 * whatever is behind it, CARD_PAIRS), a card inside a card takes the next level's fill, and every
 * tile inside a card is a panel with an edge of its own.
 */

const WEB = join(__dirname, '..');
const CSS = readFileSync(join(WEB, 'app', 'globals.css'), 'utf8');

/** The declarations of the first `selector {` block in globals.css. */
function block(selector: string): string {
  const start = CSS.indexOf(`${selector} {`);
  return start < 0 ? '' : CSS.slice(start, CSS.indexOf('}', start));
}

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** A tile typed by hand: the sunk fill and the panel's radius, without the panel's edge. */
const HANDMADE_PANEL =
  /(?:^|[\s"'`])rounded-md bg-sunk(?=$|[\s"'`])|(?:^|[\s"'`])bg-sunk rounded-md(?=$|[\s"'`])/;

afterEach(cleanup);

describe('every card is its own unit (RT-04)', () => {
  it('draws a card on the page with the card edge, the card fill and the card shadow', () => {
    const card = block('.uf-card');
    expect(card).toContain('border-color: var(--uf-color-card-edge);');
    expect(card).toContain('box-shadow: var(--uf-shadow-card);');
    expect(block('.uf-card:not(.uf-glow-card)')).toContain(
      'background-color: var(--uf-color-surface);',
    );
  });

  it('draws a card in a card a level down: the next fill, its own edge, no shadow', () => {
    const [, second, third] = tokens.card.levels;
    const kebab = (k: string) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    const nested = block('.uf-card .uf-card');
    expect(nested).toContain(`background-color: var(--uf-color-${kebab(second?.fill ?? '')});`);
    expect(nested).toContain('box-shadow: none;');
    const deeper = block('.uf-card .uf-card .uf-card');
    expect(deeper).toContain(`background-color: var(--uf-color-${kebab(third?.fill ?? '')});`);
    // The order matters: the deeper rule must come after the one it overrides.
    expect(CSS.indexOf('.uf-card .uf-card .uf-card {')).toBeGreaterThan(
      CSS.indexOf('.uf-card .uf-card {'),
    );
  });

  it('gives every panel inside a card an edge of its own', () => {
    expect(block('.uf-panel')).toContain(
      'border: var(--uf-border-thin) solid var(--uf-color-card-edge);',
    );
  });

  it('edges the home’s glow card and the plan map’s canvas with the card edge, never the hairline', () => {
    for (const selector of ['.uf-glow-card', '.uf-canvas', '.uf-map-card']) {
      expect(block(selector), selector).toContain('var(--uf-color-card-edge)');
      expect(block(selector), selector).not.toContain('solid var(--uf-color-line);');
    }
  });

  it('sets a card’s title off from its body with a rule under it', () => {
    const head = block('.uf-card > h2:first-child,\n  .uf-card > .uf-card-head');
    expect(head).toContain('border-block-end: var(--uf-border-thin) solid var(--uf-color-line);');
    expect(head).toContain('padding-block-end: var(--uf-space-3);');
  });

  it('holds the edge it draws to 3:1 on the page and on a parent card (the tokens prove each pair)', () => {
    expect(CARD_PAIRS).toContainEqual(['cardEdge', 'canvas']);
    expect(CARD_PAIRS).toContainEqual(['cardEdge', 'surface']);
    for (const [edge, behind] of CARD_PAIRS) {
      expect(contrastRatio(tokens.color[edge], tokens.color[behind])).toBeGreaterThanOrEqual(3);
    }
  });

  it('Card draws its look from `.uf-card`, not from utilities a nested rule can’t beat', () => {
    render(
      <Card aria-labelledby="outer">
        <h2 id="outer">Outer</h2>
        <Card aria-labelledby="inner">
          <h3 id="inner">Inner</h3>
        </Card>
      </Card>,
    );
    for (const name of ['Outer', 'Inner']) {
      const card = screen.getByRole('region', { name });
      const classes = card.className.split(' ');
      expect(classes).toEqual(expect.arrayContaining(['uf-card', 'rounded-lg', 'border', 'p-5']));
      // A utility beats every `@layer components` rule: a `bg-surface` here would keep a nested
      // card the colour of its parent.
      expect(classes).not.toContain('bg-surface');
      expect(classes).not.toContain('border-line');
    }
  });

  it('a panel is the sunk fill with the panel’s edge, in one shared look', () => {
    expect(panelLook.split(' ')).toEqual(
      expect.arrayContaining(['uf-panel', 'rounded-md', 'bg-sunk']),
    );
    expect(cardListGap).toBe('gap-(--uf-card-gap)');
  });

  it('types no panel by hand anywhere in the web app: each takes `panelLook`', () => {
    const offenders = sources(join(WEB, 'app'))
      .concat(sources(join(WEB, 'components')))
      // ui.tsx is where the shared look is spelt out.
      .filter((file) => relative(WEB, file) !== join('components', 'ui.tsx'))
      .flatMap((file) =>
        readFileSync(file, 'utf8')
          .split('\n')
          .flatMap((line, i) =>
            HANDMADE_PANEL.test(line) ? [`${relative(WEB, file)}:${i + 1}`] : [],
          ),
      );
    expect(offenders).toEqual([]);
    // Proven on the tiles RT-04 found.
    expect(HANDMADE_PANEL.test('<li key={m.id} className="rounded-md bg-sunk p-3">')).toBe(true);
    expect(HANDMADE_PANEL.test('className="flex flex-col gap-2 rounded-md bg-sunk p-3"')).toBe(
      true,
    );
    expect(HANDMADE_PANEL.test('className={cx(panelLook, "p-3")}')).toBe(false);
  });
});
