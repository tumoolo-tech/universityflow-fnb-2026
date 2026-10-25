import { Dimensions, StyleSheet } from 'react-native';
import { theme } from '../lib/theme';

/**
 * Small phones, for the screens' layout tests. Jest has no layout engine, so these checks read the
 * rendered tree for what overflows or clips on a 320 or 360 dp screen whatever the words are (long
 * Afrikaans or isiZulu names, or a large font size):
 *
 * - **No fixed width wider than the screen's content box** (the screen less its gutters).
 * - **Text wraps**: no `numberOfLines` (a clipped line hides words for good on a small phone).
 * - **A row that doesn't wrap lets its words shrink**: React Native's children don't shrink by
 *   default (`flexShrink: 0`), so a line of text beside anything else runs past the edge unless it
 *   (or the box it sits in) may shrink. A row may instead wrap (`flexWrap: 'wrap'`).
 * - **Every control is a thumb's size** (`theme.target`, 44, WCAG 2.5.8) high, and wide unless it
 *   carries words, **has a role and a name**; every text field has a name.
 *
 * `atWidth` sets the window's size the way a phone reports it, for any screen that reads it.
 */

export const SMALL_WIDTHS = [320, 360] as const;

/** A phone's window `width` dp wide, in portrait (twice as tall as wide), at the default text size. */
export function atWidth(width: number) {
  const window = { width, height: width * 2, scale: 2, fontScale: 1 };
  return jest.spyOn(Dimensions, 'get').mockReturnValue(window);
}

/** Everything a host element in test-renderer offers that these checks read. */
type Node = { type: unknown; props: Record<string, unknown>; children: Array<Node | string> };

const CONTROL_ROLES = new Set([
  'button',
  'link',
  'checkbox',
  'radio',
  'switch',
  'tab',
  'menuitem',
  'togglebutton',
]);

type Style = Record<string, unknown>;
const styleOf = (node: Node): Style =>
  (StyleSheet.flatten(node.props['style'] as never) ?? {}) as Style;
const num = (value: unknown) => (typeof value === 'number' ? value : null);

function textOf(node: Node | string): string {
  if (typeof node === 'string') return node;
  return node.children.map(textOf).join('');
}

function hasText(node: Node | string): boolean {
  if (typeof node === 'string') return node.trim() !== '';
  return node.type === 'Text' ? textOf(node).trim() !== '' : node.children.some(hasText);
}

function mayShrink(style: Style) {
  return (num(style['flexShrink']) ?? 0) > 0 || (num(style['flex']) ?? 0) > 0;
}

/** Where a problem is: the nearest testID up the tree, and a few words of its text. */
function where(node: Node, path: string[]) {
  const words = textOf(node).trim().slice(0, 40);
  return `${path.at(-1) ?? 'root'} ${String(node.type)}${words ? ` "${words}"` : ''}`;
}

/**
 * The problems in a rendered tree at `width`, as readable lines ([] when there are none).
 * `allow` names testIDs whose subtree is exempt, each with the reason in the calling test.
 */
export function smallScreenProblems(
  root: Node | null,
  width: number,
  allow: ReadonlySet<string> = new Set(),
): string[] {
  const problems: string[] = [];
  const content = width - 2 * theme.space['4'];
  const visit = (node: Node | string, path: string[]) => {
    if (typeof node === 'string') return;
    const testID = node.props['testID'];
    if (typeof testID === 'string' && allow.has(testID)) return;
    const here = typeof testID === 'string' ? [...path, testID] : path;
    const style = styleOf(node);

    for (const side of ['width', 'minWidth'] as const) {
      const value = num(style[side]);
      if (value !== null && value > content)
        problems.push(`fixed ${side} ${value} > ${content}: ${where(node, here)}`);
    }

    if (node.type === 'Text' && node.props['numberOfLines'] !== undefined)
      problems.push(
        `text cut to ${String(node.props['numberOfLines'])} line(s): ${where(node, here)}`,
      );

    if (style['flexDirection'] === 'row' && style['flexWrap'] !== 'wrap') {
      for (const child of node.children) {
        if (typeof child === 'string' || !hasText(child)) continue;
        if (!mayShrink(styleOf(child)))
          problems.push(`words in a row that can't shrink or wrap: ${where(child, here)}`);
      }
    }

    const role = node.props['accessibilityRole'] ?? node.props['role'];
    const pressable =
      typeof node.props['onClick'] === 'function' || typeof node.props['onPress'] === 'function';
    const control = (typeof role === 'string' && CONTROL_ROLES.has(role)) || pressable;
    if (control && node.type !== 'Text') {
      const name = node.props['accessibilityLabel'] ?? node.props['aria-label'] ?? textOf(node);
      if (typeof role !== 'string' || role === 'none')
        problems.push(`a control with no role: ${where(node, here)}`);
      if (typeof name !== 'string' || name.trim() === '')
        problems.push(`a control with no name: ${where(node, here)}`);
      const high = Math.max(num(style['minHeight']) ?? 0, num(style['height']) ?? 0);
      if (high < theme.target)
        problems.push(`a control ${high} high (< ${theme.target}): ${where(node, here)}`);
      const wide = Math.max(num(style['minWidth']) ?? 0, num(style['width']) ?? 0);
      if (!hasText(node) && style['width'] !== '100%' && wide < theme.target)
        problems.push(`a control ${wide} wide (< ${theme.target}): ${where(node, here)}`);
    }

    if (node.type === 'TextInput') {
      const name = node.props['accessibilityLabel'] ?? node.props['aria-label'];
      if (typeof name !== 'string' || name.trim() === '')
        problems.push(`a text field with no name: ${where(node, here)}`);
    }

    for (const child of node.children) visit(child, here);
  };
  if (root) visit(root, []);
  return problems;
}
