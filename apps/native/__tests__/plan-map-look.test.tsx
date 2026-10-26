import { render, waitFor, within } from '@testing-library/react-native';
import { en } from '@universityflow/content/app';
import { contrastRatio, MAP_TONE_PAIRS, tokens } from '@universityflow/tokens';
import { type PlanMapView, templateSeed } from '@universityflow/ui';
import { useLocalSearchParams } from 'expo-router';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';
import PlanMapScreen from '../app/plan-map';
import { SLOT_ICONS } from '../components/plan-maps';
import { saveToken } from '../lib/session';
import { theme } from '../lib/theme';
import { serve } from '../test-utils/fake-api';
import { me } from '../test-utils/fixtures';

/**
 * The outline's look (the owner's run-through, 2026-10-25, and the canvas spec's card anatomy):
 * the hub's summary at the top (the learner's three words, the goal, "N of M achieved" as a
 * progress bar), then each stop as a card in its tone with a number badge, an icon, its words as
 * bullets and a status chip that is always a word. The stops rise in once when the map opens,
 * and appear at once under Reduce Motion (hard rule 9). Synthetic words; RNTL v14: awaited.
 */

const t = en.planMaps;
const ta = en.planMapsApp;
const MAP_ID = '00000000-0000-4000-9000-000000000001';

type Style = Record<string, unknown>;
const flat = (style: unknown) => (StyleSheet.flatten(style as never) ?? {}) as Style;
/** The band, badge, icon and chip are decoration, hidden from assistive tech: queried as such. */
const hidden = { includeHiddenElements: true } as const;

function mapOf(templateId: 'six-stops' | 'staircase' | 'the-road' = 'six-stops'): PlanMapView {
  const seed = templateSeed(templateId);
  const id = (ref: string) =>
    `00000000-0000-4000-8000-${String(seed.findIndex((s) => s.ref === ref)).padStart(12, '0')}`;
  return {
    id: MAP_ID,
    templateId,
    title: 'My road to Wits',
    linksGoal: true,
    goal: { kind: 'goal', course: 'BEng Civil', university: 'University of Johannesburg' },
    nodes: seed.map((s) => ({
      id: id(s.ref),
      parentId: s.parentRef ? id(s.parentRef) : null,
      position: s.position,
      depth: s.depth,
      slotId: s.slotId,
      text: s.ref === 'grade-11' ? 'Synthetic: practise past papers' : null,
      status: s.ref === 'grade-10' ? 'achieved' : s.ref === 'grade-11' ? 'not-achieved' : 'planned',
      whyNot: s.ref === 'grade-11' ? 'Synthetic: ran out of time' : null,
      differently: null,
      targetMonth: null,
    })),
    wordsAllowed: true,
    updatedAt: '2026-10-13T08:00:00.000Z',
  };
}

const node = (map: PlanMapView, slot: string) => map.nodes.find((n) => n.slotId === `slot:${slot}`);

/** `GET /api/me` for a ready learner with these About me words. */
const learner = (badgeIds: string[]) => ({
  ...me({}, true),
  profile: { displayName: null, grade: 11, badgeIds },
});

beforeEach(async () => {
  await saveToken('tok');
  (useLocalSearchParams as jest.Mock).mockReturnValue({ id: MAP_ID });
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});
afterEach(() => jest.restoreAllMocks());

describe('the hub at the top', () => {
  it('says how far the learner is as a progress bar, their goal, and their three words', async () => {
    serve({
      [`GET /api/me/plan-maps/${MAP_ID}`]: { json: { map: mapOf() } },
      'GET /api/me': { json: learner(['future-engineer', 'loves-maths']) },
    });
    const screen = await render(<PlanMapScreen />);
    const bar = await screen.findByRole('progressbar');
    expect(bar.props.accessibilityLabel).toBe(ta.hub.progress(1, 6));
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 6, now: 1 });
    expect(screen.getByText(ta.hub.progress(1, 6))).toBeTruthy();
    // The bar's fill is the success green, as long as the share achieved.
    const fill = screen.getByTestId('plan-progress-fill');
    expect(flat(fill.props.style)['backgroundColor']).toBe(theme.color.success);
    expect(flat(fill.props.style)['width']).toBe(`${Math.round((1 / 6) * 100)}%`);
    expect(screen.getByText(t.goalAt('BEng Civil', 'University of Johannesburg'))).toBeTruthy();
    // The About me words, read live, never copied into the map.
    const words = await screen.findByTestId('plan-hub-words');
    expect(words.props.accessibilityLabel).toBe(
      `${ta.hub.words}: ${en.profileLook.badges['future-engineer']}, ${en.profileLook.badges['loves-maths']}`,
    );
    expect(within(words).getByText(en.profileLook.badges['future-engineer'])).toBeTruthy();
  });

  it('with no words chosen and no goal, draws neither', async () => {
    const map = { ...mapOf(), linksGoal: false, goal: null };
    serve({
      [`GET /api/me/plan-maps/${MAP_ID}`]: { json: { map } },
      'GET /api/me': { json: learner([]) },
    });
    const screen = await render(<PlanMapScreen />);
    await screen.findByRole('progressbar');
    expect(screen.queryByTestId('plan-hub-words')).toBeNull();
    expect(screen.queryByText(t.goalCentre)).toBeNull();
  });
});

describe('each stop as a card', () => {
  it('fills with its tone, carries its number, icon, words as bullets and a status chip', async () => {
    const map = mapOf();
    serve({ [`GET /api/me/plan-maps/${MAP_ID}`]: { json: { map: mapOf() } } });
    const screen = await render(<PlanMapScreen />);
    const first = node(map, 'grade-10');
    const second = node(map, 'grade-11');
    const card = await screen.findByTestId(`plan-card-${first?.id}`);
    expect(flat(card.props.style)).toMatchObject({
      backgroundColor: theme.color.mapTone1Soft,
      borderColor: theme.color.mapTone1,
      borderWidth: theme.border.thick,
    });
    const band = within(card).getByTestId('plan-card-band', hidden);
    expect(flat(band.props.style)['backgroundColor']).toBe(theme.color.mapTone1);
    const badge = within(card).getByTestId('plan-card-badge', hidden);
    expect(within(badge).getByText('1', hidden)).toBeTruthy();
    expect(flat(badge.props.style)['backgroundColor']).toBe(theme.color.mapTone1);
    expect(within(card).getByTestId('look-icon-book', hidden)).toBeTruthy();
    // The second card takes the second tone.
    const other = screen.getByTestId(`plan-card-${second?.id}`);
    expect(flat(other.props.style)['backgroundColor']).toBe(theme.color.mapTone2Soft);
    // The chip: a word and a glyph, the Achieved word in success, Not achieved in muted ink.
    const chip = within(card).getByTestId('plan-card-chip', hidden);
    expect(within(chip).getByText(t.status.achieved, hidden)).toHaveStyle({
      color: theme.color.success,
    });
    expect(flat(chip.props.style)['borderColor']).toBe(theme.color.success);
    const quiet = within(other).getByTestId('plan-card-chip', hidden);
    expect(within(quiet).getByText(t.status['not-achieved'], hidden)).toHaveStyle({
      color: theme.color.inkMuted,
    });
    expect(flat(quiet.props.style)['borderColor']).toBe(theme.color.lineStrong);
    // The learner's words as a bullet, the reflection under it.
    expect(within(other).getByText('Synthetic: practise past papers')).toBeTruthy();
    expect(within(other).getByText(`${t.whyNotShown}: Synthetic: ran out of time`)).toBeTruthy();
  });

  it('every colour on a tone card is a tested pair (WCAG AA)', () => {
    for (const { accent, soft } of tokens.mapTones) {
      for (const fg of ['ink', 'inkMuted', 'success', 'brand'] as const) {
        expect(MAP_TONE_PAIRS).toContainEqual([fg, soft, 'text']);
      }
      expect(MAP_TONE_PAIRS).toContainEqual(['lineStrong', soft, 'nonText']);
      // The badge's number on the accent, and the accent as the card's edge on the screen.
      expect(contrastRatio(tokens.color.onAccent, tokens.color[accent])).toBeGreaterThanOrEqual(
        tokens.contrast.text,
      );
      expect(MAP_TONE_PAIRS).toContainEqual([accent, 'canvas', 'nonText']);
    }
  });

  it('never puts a warning sign beside a learner’s worries', () => {
    for (const slot of ['in-the-way', 'holds-me-back']) {
      expect(SLOT_ICONS[slot]).toBeDefined();
      expect(SLOT_ICONS[slot]).not.toMatch(/alert|warning|danger/);
    }
  });

  it('numbers the staircase’s steps and says "Step n of m" with each', async () => {
    const map = mapOf('staircase');
    serve({ [`GET /api/me/plan-maps/${MAP_ID}`]: { json: { map } } });
    const screen = await render(<PlanMapScreen />);
    const parts = await screen.findAllByTestId(/^plan-node-/);
    expect(parts[2]?.props.accessibilityLabel).toBe(
      `${t.stepOf(3, 8)}: Finish Grade 11, ${t.status.planned}`,
    );
    const third = node(map, 'finish-grade-11');
    const card = screen.getByTestId(`plan-card-${third?.id}`);
    const badge = within(card).getByTestId('plan-card-badge', hidden);
    expect(within(badge).getByText('3', hidden)).toBeTruthy();
  });
});

describe('the stops rise in once (M1), and not under Reduce Motion', () => {
  it('animates each stop in turn when motion is fine', async () => {
    (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(false);
    const timing = jest.spyOn(Animated, 'timing');
    serve({ [`GET /api/me/plan-maps/${MAP_ID}`]: { json: { map: mapOf() } } });
    const screen = await render(<PlanMapScreen />);
    await screen.findAllByTestId(/^plan-node-/);
    await waitFor(() => expect(timing).toHaveBeenCalled());
    const durations = timing.mock.calls.map((c) => (c[1] as { duration?: number }).duration);
    expect(durations.length).toBeGreaterThanOrEqual(6);
    expect(new Set(durations)).toEqual(new Set([Number.parseInt(tokens.duration.enter, 10)]));
  });

  it('shows every stop at once under Reduce Motion', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    serve({ [`GET /api/me/plan-maps/${MAP_ID}`]: { json: { map: mapOf() } } });
    const screen = await render(<PlanMapScreen />);
    await screen.findAllByTestId(/^plan-node-/);
    await waitFor(() => expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled());
    expect(timing).not.toHaveBeenCalled();
  });
});
