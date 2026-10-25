import { render } from '@testing-library/react-native';
import { Field, Screen } from '../components/ui';

interface HostNode {
  readonly type: string;
  readonly props: Record<string, unknown>;
  readonly children: ReadonlyArray<HostNode | string> | null;
}

/** The first host element of a type in a rendered tree (RNTL v14 has no UNSAFE_ queries). */
function findHost(tree: unknown, type: string): HostNode | null {
  const nodes = (Array.isArray(tree) ? tree : [tree]) as ReadonlyArray<HostNode | string | null>;
  for (const node of nodes) {
    if (!node || typeof node === 'string') continue;
    if (node.type === type) return node;
    const found = findHost(node.children ?? [], type);
    if (found) return found;
  }
  return null;
}

/**
 * A7-06: on iOS the keyboard covered the lower fields of every form screen (Confirm marks, the
 * guardian's phone, the delete confirmation), and the content could not scroll them clear.
 * `Screen` must let its ScrollView inset itself by the keyboard's height.
 */
describe('Screen and the keyboard', () => {
  it('insets its scroll view by the keyboard, so a lower field can scroll above it', async () => {
    const screen = await render(
      <Screen>
        <Field label="Last field" value="" onChangeText={() => undefined} testID="last" />
      </Screen>,
    );
    const scroll = findHost(screen.toJSON(), 'RCTScrollView');
    expect(scroll).not.toBeNull();
    expect(scroll?.props['automaticallyAdjustKeyboardInsets']).toBe(true);
    // A tap on a button while the keyboard is up still presses it.
    expect(scroll?.props['keyboardShouldPersistTaps']).toBe('handled');
  });
});
