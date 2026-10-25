import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { en } from '@universityflow/content/app';
import { tokens } from '@universityflow/tokens';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';
import AccountScreen from '../app/account';
import { HomeDashboard } from '../components/home';
import { saveToken } from '../lib/session';
import { serve } from '../test-utils/fake-api';
import { home, me } from '../test-utils/fixtures';

/**
 * The About me card and "Make it yours" in the app (docs/design/profile-look-proposal.md, step 7;
 * the owner's D5: the card and its picker only, deletion stays). The phone layout of the web's
 * poster: the same words, the same one PATCH, and no motion under Reduce Motion (hard rule 9).
 */

const t = en.profileLook;

const LOOK = {
  theme: 'ocean',
  avatar: 'initials',
  taglineId: 'small-steps',
  badgeIds: ['future-engineer', 'loves-maths'],
};

function learner(profile: Record<string, unknown> = {}) {
  const base = me({ consentStatus: 'not-required' }, true, 10);
  return {
    ...base,
    profile: {
      ...base.profile,
      displayName: 'Thando Mokoena',
      schoolFinished: false,
      ...LOOK,
      ...profile,
    },
  };
}

beforeEach(async () => {
  await saveToken('tok');
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});

afterEach(() => jest.restoreAllMocks());

describe('the About me card in the app', () => {
  it('says the name, the grade, the words and the tagline, and hides the decoration', async () => {
    serve({ 'GET /api/me': { json: learner() } });
    const screen = await render(<AccountScreen />);
    expect(await screen.findByRole('header', { name: 'Thando Mokoena' })).toBeTruthy();
    const hidden = { includeHiddenElements: true };
    // The grade and the words are shown round the figure and said once, after the name (A2-35).
    expect(screen.getByText(en.onboarding.gradeOption(10), hidden)).toBeTruthy();
    const words = screen.getByTestId('look-words', hidden);
    expect(within(words).getByText(t.badges['future-engineer'], hidden)).toBeTruthy();
    expect(within(words).getByText(t.badges['loves-maths'], hidden)).toBeTruthy();
    expect(
      screen.getByLabelText(
        t.posterSummary(en.onboarding.gradeOption(10), [
          t.badges['future-engineer'],
          t.badges['loves-maths'],
        ]),
      ),
    ).toBeTruthy();
    expect(screen.getByText(t.taglines['small-steps'])).toBeTruthy();
    // "Hello" and the avatar are decoration: the name is already said.
    const avatar = screen.getByTestId('avatar-card', hidden);
    expect(avatar.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(avatar.props.accessibilityElementsHidden).toBe(true);
    expect(within(avatar).getByText('TM', hidden)).toBeTruthy();
    expect(screen.getByTestId('look-hello', hidden).props.accessibilityElementsHidden).toBe(true);
    // Deletion is still there, below (D5: the card and its picker only).
    expect(screen.getByRole('button', { name: en.me.deleteButton })).toBeTruthy();
  });

  it('colours the name from the theme’s tokens', async () => {
    serve({ 'GET /api/me': { json: learner() } });
    const screen = await render(<AccountScreen />);
    const name = await screen.findByText('Thando Mokoena');
    const style = StyleSheet.flatten(name.props.style) as { color?: string };
    expect(style.color).toBe(tokens.color.profileOcean);
  });

  it('has no sticker past matric, and a heading without a name', async () => {
    serve({
      'GET /api/me': {
        json: learner({ displayName: null, schoolFinished: true, badgeIds: [], taglineId: null }),
      },
    });
    const screen = await render(<AccountScreen />);
    expect(await screen.findByRole('header', { name: t.noName })).toBeTruthy();
    const hidden = { includeHiddenElements: true };
    expect(screen.queryByText(en.onboarding.gradeOption(10), hidden)).toBeNull();
    expect(screen.queryByTestId('look-words', hidden)).toBeNull();
    expect(screen.queryByTestId('look-summary', hidden)).toBeNull();
  });

  it('previews each choice, and saves them with one PATCH', async () => {
    const calls = serve({
      'GET /api/me': { json: learner() },
      'PATCH /api/me': { json: { profile: {} } },
    });
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
    const screen = await render(<AccountScreen />);
    const open = await screen.findByRole('button', { name: t.open });
    expect(open.props.accessibilityState).toMatchObject({ expanded: false });
    await fireEvent.press(open);
    expect(screen.getByRole('button', { name: t.open }).props.accessibilityState).toMatchObject({
      expanded: true,
    });
    await fireEvent.press(screen.getByRole('radio', { name: t.themes.sunrise }));
    await fireEvent.press(screen.getByRole('radio', { name: t.patterns.rings }));
    await fireEvent.press(screen.getByRole('radio', { name: t.taglines['keep-going'] }));
    await fireEvent.press(screen.getByRole('checkbox', { name: t.badges['night-owl'] }));
    // The card shows it at once; nothing is stored yet.
    const name = screen.getByText('Thando Mokoena');
    expect((StyleSheet.flatten(name.props.style) as { color?: string }).color).toBe(
      tokens.color.profileSunrise,
    );
    expect(calls.filter((c) => c.key === 'PATCH /api/me')).toHaveLength(0);

    await fireEvent.press(screen.getByRole('button', { name: t.save }));
    await waitFor(() => expect(announce).toHaveBeenCalledWith(t.saved));
    expect(calls.filter((c) => c.key === 'PATCH /api/me').map((c) => c.body)).toEqual([
      {
        theme: 'sunrise',
        avatar: 'pattern:rings',
        taglineId: 'keep-going',
        badgeIds: ['future-engineer', 'loves-maths', 'night-owl'],
      },
    ]);
  });

  it('names every theme in words under its swatch, as the web does (A2-31)', async () => {
    serve({ 'GET /api/me': { json: learner() } });
    const screen = await render(<AccountScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: t.open }));
    for (const name of Object.values(t.themes)) {
      const radio = screen.getByRole('radio', { name });
      // Seen, not only heard: a colour alone doesn't say which theme it is.
      expect(within(radio).getByText(name)).toBeTruthy();
    }
  });

  it('puts the saved look back on Cancel', async () => {
    const calls = serve({ 'GET /api/me': { json: learner() } });
    const screen = await render(<AccountScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: t.open }));
    await fireEvent.press(screen.getByRole('radio', { name: t.themes.protea }));
    await fireEvent.press(screen.getByRole('button', { name: t.cancel }));
    const name = screen.getByText('Thando Mokoena');
    expect((StyleSheet.flatten(name.props.style) as { color?: string }).color).toBe(
      tokens.color.profileOcean,
    );
    expect(calls.filter((c) => c.key === 'PATCH /api/me')).toHaveLength(0);
  });

  it('lets three words be chosen, and says why a fourth can’t be', async () => {
    serve({ 'GET /api/me': { json: learner() } });
    const screen = await render(<AccountScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: t.open }));
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
    await fireEvent.press(screen.getByRole('checkbox', { name: t.badges['night-owl'] }));
    expect(screen.getByText(t.wordsChosen(3, 3))).toBeTruthy();
    // Said as well as shown, as the web's live count is (A2-34).
    expect(announce).toHaveBeenCalledWith(t.wordsChosen(3, 3));
    const fourth = screen.getByRole('checkbox', { name: t.badges.bookworm });
    expect(fourth.props.accessibilityState).toMatchObject({ disabled: true, checked: false });
    expect(fourth.props.accessibilityHint).toBe(t.wordsFull(3));
    await fireEvent.press(screen.getByRole('checkbox', { name: t.badges['loves-maths'] }));
    expect(
      screen.getByRole('checkbox', { name: t.badges.bookworm }).props.accessibilityState,
    ).toMatchObject({ disabled: false });
  });

  it('moves only when the phone allows it: no timed animation under Reduce Motion', async () => {
    (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(true);
    const timing = jest.spyOn(Animated, 'timing');
    serve({ 'GET /api/me': { json: learner() } });
    const screen = await render(<AccountScreen />);
    await screen.findByRole('header', { name: 'Thando Mokoena' });
    const timed = timing.mock.calls.filter(([, config]) => (config.duration ?? 0) > 0);
    expect(timed).toEqual([]);
  });

  it('enters once with motion when the phone allows it', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    serve({ 'GET /api/me': { json: learner() } });
    const screen = await render(<AccountScreen />);
    await screen.findByRole('header', { name: 'Thando Mokoena' });
    await waitFor(() =>
      expect(timing.mock.calls.some(([, config]) => (config.duration ?? 0) > 0)).toBe(true),
    );
  });

  it('still offers deletion when the profile can’t be read', async () => {
    serve({ 'GET /api/me': { status: 500, json: { error: 'server', detail: null } } });
    const screen = await render(<AccountScreen />);
    expect(screen.getByRole('button', { name: en.me.deleteButton })).toBeTruthy();
    expect(screen.queryByRole('button', { name: t.open })).toBeNull();
  });
});

type Node = { type: unknown; props: Record<string, unknown>; children: Array<Node | string> };

const textOf = (node: Node | string): string =>
  typeof node === 'string' ? node : node.children.map(textOf).join('');

/**
 * What a screen reader stops on inside `node`, in order: a hidden subtree is skipped; a Text, or a
 * View marked `accessible`, is one stop (its label, else its text). A View with only a label and
 * no `accessible` is not a stop on iOS, so its children are walked instead (A2-35).
 */
function stops(node: Node | string): string[] {
  if (typeof node === 'string') return [];
  const p = node.props;
  if (p.accessibilityElementsHidden || p.importantForAccessibility === 'no-hide-descendants')
    return [];
  const label = typeof p.accessibilityLabel === 'string' ? p.accessibilityLabel : null;
  if (node.type === 'Text' || p.accessible === true) return [label ?? textOf(node)];
  return node.children.flatMap(stops);
}

describe('the A2 audit’s fixes in the app (S1 profile, step 8)', () => {
  it('reads the name’s header first, then the grade and the words in one summary (A2-35)', async () => {
    serve({ 'GET /api/me': { json: learner() } });
    const screen = await render(<AccountScreen />);
    await screen.findByRole('header', { name: 'Thando Mokoena' });
    const poster = screen.getByTestId('look-poster') as unknown as Node;
    const summary = t.posterSummary(en.onboarding.gradeOption(10), [
      t.badges['future-engineer'],
      t.badges['loves-maths'],
    ]);
    expect(stops(poster)).toEqual(['Thando Mokoena', summary, t.taglines['small-steps']]);
    // The summary names the words as the web's list does ("My words"), and is a real stop on iOS.
    expect(summary).toContain(t.myWords);
    expect(screen.getByLabelText(summary).props.accessible).toBe(true);
  });

  it('has no summary when there is neither a grade nor a word', async () => {
    serve({
      'GET /api/me': {
        json: learner({ displayName: null, schoolFinished: true, badgeIds: [], taglineId: null }),
      },
    });
    const screen = await render(<AccountScreen />);
    await screen.findByRole('header', { name: t.noName });
    expect(stops(screen.getByTestId('look-poster') as unknown as Node)).toEqual([t.noName]);
  });

  it('puts the screen reader back on "Make it yours" after Save and Cancel (A2-36)', async () => {
    serve({
      'GET /api/me': { json: learner() },
      'PATCH /api/me': { json: { profile: {} } },
    });
    const focus = jest
      .spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      .mockImplementation(() => {});
    // The preset's AccessibilityInfo is already a mock, which keeps earlier tests' calls.
    focus.mockClear();
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    const screen = await render(<AccountScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: t.open }));
    expect(focus).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: t.cancel }));
    await waitFor(() => expect(focus).toHaveBeenCalledTimes(1));
    expect(focus.mock.calls[0]?.[1]).toBe('focus');
    const toggle = focus.mock.calls[0]?.[0] as unknown as { props: Record<string, unknown> };
    expect(toggle.props.accessibilityLabel).toBe(t.open);

    await fireEvent.press(screen.getByRole('button', { name: t.open }));
    await fireEvent.press(screen.getByRole('button', { name: t.save }));
    await waitFor(() => expect(focus).toHaveBeenCalledTimes(2));
    expect(focus.mock.calls[1]?.[1]).toBe('focus');
  });

  it('grows the grade sticker with the text instead of a fixed circle (A2-38)', async () => {
    serve({ 'GET /api/me': { json: learner() } });
    const screen = await render(<AccountScreen />);
    await screen.findByRole('header', { name: 'Thando Mokoena' });
    const sticker = screen.getByTestId('look-sticker', { includeHiddenElements: true });
    const style = StyleSheet.flatten(sticker.props.style) as Record<string, unknown>;
    expect(style.width).toBeUndefined();
    expect(style.height).toBeUndefined();
    expect(style.minWidth).toBeGreaterThan(0);
    expect(style.minHeight).toBe(style.minWidth);
    expect(style.padding).toBeGreaterThan(0);
  });

  it('never takes the words away to fade them back: the entrance only rises (A2-40)', async () => {
    serve({ 'GET /api/me': { json: learner() } });
    const timing = jest.spyOn(Animated, 'timing');
    const screen = await render(<AccountScreen />);
    await screen.findByRole('header', { name: 'Thando Mokoena' });
    // Motion is fine here: the entrance has started.
    await waitFor(() =>
      expect(timing.mock.calls.some(([, config]) => (config.duration ?? 0) > 0)).toBe(true),
    );
    const words = screen.getByTestId('look-words', { includeHiddenElements: true });
    const style = StyleSheet.flatten(words.props.style) as { opacity?: unknown };
    expect(style.opacity ?? 1).toBe(1);
    // Every timed entrance animation is a rise back to rest, none a fade in.
    const entrance = timing.mock.calls.filter(([, config]) => (config.duration ?? 0) > 0);
    for (const [, config] of entrance) expect(config.toValue).toBe(0);
  });
});

describe('the avatar on the app’s home', () => {
  it('shows the learner’s avatar, named "About me", and opens About me', async () => {
    const go = jest.fn();
    const screen = await render(
      <HomeDashboard
        data={home({ name: 'Lerato', look: { theme: 'jacaranda', avatar: 'initials' } })}
        go={go}
      />,
    );
    const button = screen.getByRole('button', { name: en.dashboard.aboutMe });
    expect(within(button).getByText('L')).toBeTruthy();
    await fireEvent.press(button);
    expect(go).toHaveBeenCalledWith('/account');
  });
});
