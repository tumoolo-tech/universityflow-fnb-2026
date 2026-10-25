/**
 * react-native-svg under Jest (the icon avatars and the profile card's "Hello" arc and line,
 * D6): its native views can't run without a phone, so each element becomes a plain host view
 * that keeps every prop (`d`, `stroke`, `strokeDasharray`, an animated `strokeDashoffset` …) for
 * a test to read, with `svgElement` naming what it stands for. Text elements become `Text`, so
 * "Hello" can be found by its words. Installed for every test by jest.setup.ts.
 */
import { type ComponentType, createElement, forwardRef, type ReactNode } from 'react';
import { Text as NativeText, View } from 'react-native';

type Props = { children?: ReactNode } & Record<string, unknown>;

/** A host view that takes any prop: SVG props aren't View or Text props. */
type AnyHost = ComponentType<Record<string, unknown>>;

function element(name: string, host: typeof View | typeof NativeText) {
  const Host = host as unknown as AnyHost;
  const Element = forwardRef<unknown, Props>(function SvgElement({ children, ...props }, ref) {
    return createElement(Host, { ...props, ref, svgElement: name }, children as ReactNode);
  });
  Element.displayName = name;
  return Element;
}

export const Svg = element('Svg', View);
export const G = element('G', View);
export const Defs = element('Defs', View);
export const Path = element('Path', View);
export const Circle = element('Circle', View);
export const Rect = element('Rect', View);
export const Line = element('Line', View);
export const Text = element('Text', NativeText);
export const TextPath = element('TextPath', NativeText);
export const TSpan = element('TSpan', NativeText);

export default Svg;
