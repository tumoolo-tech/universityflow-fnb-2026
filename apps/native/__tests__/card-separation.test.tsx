import { render, within } from '@testing-library/react-native';
import { CARD_PAIRS, contrastRatio, tokens } from '@universityflow/tokens';
import type { PracticeArtifact } from '@universityflow/ui';
import { StyleSheet, Text } from 'react-native';
import { ArtifactCard } from '../components/artifact-card';
import { Card } from '../components/ui';
import { theme } from '../lib/theme';

/**
 * RT-04 (the owner's run-through, 2026-10-25): every card is its own unit, in the app as on the
 * web. A card's edge is the tokens' `cardEdge` (3:1 against what is behind it, CARD_PAIRS), a
 * card inside a card is the next level's fill, and a tile inside a card is a panel with an edge
 * of its own.
 */

type Style = { backgroundColor?: string; borderColor?: string; borderWidth?: number };
const flat = (style: unknown) => (StyleSheet.flatten(style as never) ?? {}) as Style;

const practice: PracticeArtifact = {
  kind: 'practice',
  basis: 'goal',
  goal: { programmeId: 'wits-bsc-eng', name: 'BSc Engineering', universityName: 'Wits' },
  includesDrafts: false,
  subjects: [
    {
      subjectId: 'mathematics',
      subjectName: 'Mathematics',
      reason: 'goal-requires',
      resources: [],
    },
  ],
};

describe('card separation (RT-04)', () => {
  it('draws a card with the card edge, at 3:1 on the screen', async () => {
    const screen = await render(
      <Card testID="outer">
        <Text>Outer</Text>
      </Card>,
    );
    const style = flat(screen.getByTestId('outer').props.style);
    expect(style.borderColor).toBe(theme.color.cardEdge);
    expect(style.backgroundColor).toBe(theme.color.surface);
    expect(style.borderWidth).toBe(theme.border.thin);
    expect(CARD_PAIRS).toContainEqual(['cardEdge', 'canvas']);
  });

  it('draws a nested card a level down: the next fill, its own edge, never its parent’s fill', async () => {
    const screen = await render(
      <Card testID="outer">
        <Card nested testID="inner">
          <Text>Inner</Text>
        </Card>
      </Card>,
    );
    const outer = flat(screen.getByTestId('outer').props.style);
    const inner = flat(screen.getByTestId('inner').props.style);
    expect(inner.backgroundColor).toBe(theme.color[tokens.card.levels[1].fill]);
    expect(inner.backgroundColor).not.toBe(outer.backgroundColor);
    expect(inner.borderColor).toBe(theme.color.cardEdge);
    expect(contrastRatio(theme.color.cardEdge, outer.backgroundColor ?? '')).toBeGreaterThanOrEqual(
      tokens.contrast.nonText,
    );
  });

  it('gives a panel inside a card the sunk fill and the card edge (Free practice)', async () => {
    const screen = await render(<ArtifactCard artifact={practice} />);
    const panel = flat(screen.getByTestId('practice-mathematics').props.style);
    expect(panel.backgroundColor).toBe(theme.color.surfaceSunk);
    expect(panel.borderColor).toBe(theme.color.cardEdge);
    expect(panel.borderWidth).toBe(theme.border.thin);
    expect(
      within(screen.getByTestId('practice-mathematics')).getByText('Mathematics'),
    ).toBeTruthy();
  });

  it('shares one panel look from the theme, held to the tokens', () => {
    expect(theme.panel).toEqual({
      backgroundColor: theme.color.surfaceSunk,
      borderColor: theme.color.cardEdge,
      borderWidth: theme.border.thin,
    });
    expect(CARD_PAIRS).toContainEqual(['cardEdge', 'surface']);
  });
});
