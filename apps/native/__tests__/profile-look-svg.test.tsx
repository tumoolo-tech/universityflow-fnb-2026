import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { en } from '@universityflow/content/app';
import { tokens } from '@universityflow/tokens';
import { LOOK_ICONS, LOOK_POSTER, scalePath } from '@universityflow/ui';
import { AccessibilityInfo, Animated } from 'react-native';
import AccountScreen from '../app/account';
import { HomeDashboard } from '../components/home';
import { saveToken } from '../lib/session';
import { serve } from '../test-utils/fake-api';
import { home, me } from '../test-utils/fixtures';

/**
 * The app rebuild's drawings (react-native-svg 15.15.4, D6; docs/design/profile-look-proposal.md
 * §2.5, §2.6): the 12 icon avatars from the shapes the web draws, the Icons group in "Make it
 * yours", and the poster's "Hello" arc and the line that draws itself, fully drawn and still
 * under Reduce Motion (hard rule 9). All decoration: the name is already said.
 */

const t = en.profileLook;
const hidden = { includeHiddenElements: true };
const ICON_IDS = Object.keys(LOOK_ICONS) as Array<keyof typeof LOOK_ICONS>;

function learner(profile: Record<string, unknown> = {}) {
  const base = me({ consentStatus: 'not-required' }, true, 10);
  return {
    ...base,
    profile: {
      ...base.profile,
      displayName: 'Thando Mokoena',
      schoolFinished: false,
      theme: 'ocean',
      avatar: 'initials',
      taglineId: null,
      badgeIds: [],
      ...profile,
    },
  };
}

beforeEach(async () => {
  await saveToken('tok');
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});

afterEach(() => jest.restoreAllMocks());

/** The poster is laid out: 320 wide, 600 tall, "I'm" starting 420 down. */
async function layOut(screen: Awaited<ReturnType<typeof render>>) {
  const layout = (x: number, y: number, width: number, height: number) => ({
    nativeEvent: { layout: { x, y, width, height } },
  });
  await fireEvent(screen.getByTestId('look-poster', hidden), 'layout', layout(0, 0, 320, 600));
  await fireEvent(screen.getByTestId('look-intro', hidden), 'layout', layout(20, 420, 280, 100));
}

describe('the icon avatars in the app', () => {
  it('draws a stored icon on the card, in the poster’s black and white, not the initials', async () => {
    serve({ 'GET /api/me': { json: learner({ avatar: 'icon:baobab' }) } });
    const screen = await render(<AccountScreen />);
    await screen.findByRole('header', { name: 'Thando Mokoena' });
    const avatar = screen.getByTestId('avatar-card', hidden);
    const icon = within(avatar).getByTestId('look-icon-baobab', hidden);
    expect(icon.props.stroke).toBe(tokens.color.ink);
    expect(icon.props.viewBox).toBe('0 0 24 24');
    expect(within(avatar).queryByText('TM', hidden)).toBeNull();
    // The web's shapes, one for one.
    const paths = within(icon)
      .getAllByTestId(/^look-shape-/, hidden)
      .map((shape) => shape.props.d);
    expect(paths).toEqual(
      LOOK_ICONS.baobab.map((shape) => (shape.kind === 'path' ? shape.d : undefined)),
    );
  });

  it('offers the Icons group in "Make it yours", each named, and saves the one chosen', async () => {
    const calls = serve({
      'GET /api/me': { json: learner() },
      'PATCH /api/me': { json: { profile: {} } },
    });
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    const screen = await render(<AccountScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: t.open }));
    const pictures = screen.getByLabelText(t.avatar);
    expect(within(pictures).getByText(t.avatarKinds.initials)).toBeTruthy();
    expect(within(pictures).getByText(t.avatarKinds.icons)).toBeTruthy();
    expect(within(pictures).getByText(t.avatarKinds.patterns)).toBeTruthy();
    for (const id of ICON_IDS) {
      const radio = within(pictures).getByRole('radio', { name: t.icons[id] });
      expect(within(radio).getByTestId(`look-icon-${id}`, hidden).props.stroke).toBe(
        tokens.color.onAccent,
      );
    }
    await fireEvent.press(within(pictures).getByRole('radio', { name: t.icons.rocket }));
    expect(
      within(pictures).getByRole('radio', { name: t.icons.rocket }).props.accessibilityState,
    ).toMatchObject({ checked: true });
    // Previewed on the card at once.
    expect(
      within(screen.getByTestId('avatar-card', hidden)).getByTestId('look-icon-rocket', hidden),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: t.save }));
    await waitFor(() =>
      expect(calls.filter((c) => c.key === 'PATCH /api/me').map((c) => c.body)).toEqual([
        { theme: 'ocean', avatar: 'icon:rocket', taglineId: null, badgeIds: [] },
      ]),
    );
  });

  it('shows the icon on the home’s avatar too, still named "About me"', async () => {
    const screen = await render(
      <HomeDashboard
        data={home({ name: 'Lerato', look: { theme: 'jacaranda', avatar: 'icon:star' } })}
        go={jest.fn()}
      />,
    );
    const button = screen.getByRole('button', { name: en.dashboard.aboutMe });
    expect(within(button).getByTestId('look-icon-star', hidden)).toBeTruthy();
  });
});

describe('the poster’s "Hello" arc and line in the app', () => {
  it('sets "Hello" on the web’s arc, hidden from screen readers', async () => {
    serve({ 'GET /api/me': { json: learner() } });
    const screen = await render(<AccountScreen />);
    await screen.findByRole('header', { name: 'Thando Mokoena' });
    const hello = screen.getByTestId('look-hello', hidden);
    expect(hello.props.accessibilityElementsHidden).toBe(true);
    expect(hello.props.importantForAccessibility).toBe('no-hide-descendants');
    const svg = within(hello).getByTestId('look-hello-svg', hidden);
    expect(svg.props.viewBox).toBe(LOOK_POSTER.helloViewBox);
    const arc = within(hello).getByTestId('look-hello-arc', hidden);
    expect(arc.props.d).toBe(LOOK_POSTER.helloArc);
    const words = within(hello).getByText(t.hello, hidden);
    expect(words.props.href).toBe(`#${arc.props.id}`);
    expect(words.props.startOffset).toBe('50%');
  });

  it('draws the line from "Hello" round the figure to "I’m", as decoration', async () => {
    serve({ 'GET /api/me': { json: learner() } });
    const screen = await render(<AccountScreen />);
    await screen.findByRole('header', { name: 'Thando Mokoena' });
    await layOut(screen);
    const curve = screen.getByTestId('look-curve', hidden);
    expect(curve.props.accessibilityElementsHidden).toBe(true);
    expect(curve.props.importantForAccessibility).toBe('no-hide-descendants');
    // Stretched to the poster: across its width, down to the top of "I'm".
    expect(screen.getByTestId('look-line', hidden).props.d).toBe(
      scalePath(LOOK_POSTER.line, 320 / 100, 420 / LOOK_POSTER.lineEndY),
    );
    expect(screen.getByTestId('look-arrowhead', hidden).props.d).toBe(
      scalePath(LOOK_POSTER.arrowhead, 320 / 100, 420 / LOOK_POSTER.lineEndY),
    );
    expect(screen.getByTestId('look-line', hidden).props.stroke).toBe(tokens.color.ink);
  });

  it('draws itself once, over the token’s time, when the phone allows motion', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    serve({ 'GET /api/me': { json: learner() } });
    const screen = await render(<AccountScreen />);
    await screen.findByRole('header', { name: 'Thando Mokoena' });
    await waitFor(() =>
      expect(timing.mock.calls.some(([, c]) => (c.duration ?? 0) > 0)).toBe(true),
    );
    await layOut(screen);
    await waitFor(() =>
      expect(
        timing.mock.calls.filter(
          ([, c]) => c.duration === Number.parseInt(tokens.duration.draw, 10),
        ),
      ).toHaveLength(1),
    );
    expect(screen.getByTestId('look-line', hidden).props.strokeDasharray).toHaveLength(2);
  });

  it('is fully drawn and still under Reduce Motion: no dash, no timed animation', async () => {
    (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(true);
    const timing = jest.spyOn(Animated, 'timing');
    serve({ 'GET /api/me': { json: learner() } });
    const screen = await render(<AccountScreen />);
    await screen.findByRole('header', { name: 'Thando Mokoena' });
    await layOut(screen);
    const line = screen.getByTestId('look-line', hidden);
    expect(line.props.strokeDasharray).toBeUndefined();
    expect(line.props.strokeDashoffset).toBeUndefined();
    expect(timing.mock.calls.filter(([, c]) => (c.duration ?? 0) > 0)).toEqual([]);
  });
});
