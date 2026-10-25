import { profileLook as t } from '@universityflow/content/app';
import { tokens } from '@universityflow/tokens';
import {
  type IconId,
  LOOK_ICON_STROKE,
  LOOK_ICON_VIEWBOX,
  LOOK_ICONS,
  LOOK_POSTER,
  pathLengthBound,
  scalePath,
} from '@universityflow/ui';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Path, Rect, Text as SvgText, TextPath } from 'react-native-svg';
import { theme, toEm } from '../lib/theme';

/**
 * The profile look's drawings in the app, with react-native-svg (the app rebuild, D6): the icon
 * avatars and the poster's "Hello" arc and line, from the same shapes the web draws
 * (`@universityflow/ui` look-drawing). All decoration: the learner's name is said beside them.
 */

const ms = (value: string) => Number.parseInt(value, 10);

/** One of the 12 icon avatars, in `color`, `size` points square. */
export function LookIcon({ id, size, color }: { id: IconId; size: number; color: string }) {
  return (
    <Svg
      testID={`look-icon-${id}`}
      width={size}
      height={size}
      viewBox={LOOK_ICON_VIEWBOX}
      fill="none"
      stroke={color}
      strokeWidth={LOOK_ICON_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {LOOK_ICONS[id].map((shape, i) => {
        const testID = `look-shape-${i}`;
        if (shape.kind === 'circle')
          return <Circle key={testID} testID={testID} cx={shape.cx} cy={shape.cy} r={shape.r} />;
        if (shape.kind === 'rect')
          return (
            <Rect
              key={testID}
              testID={testID}
              x={shape.x}
              y={shape.y}
              width={shape.width}
              height={shape.height}
              rx={shape.rx}
            />
          );
        return <Path key={testID} testID={testID} d={shape.d} />;
      })}
    </Svg>
  );
}

const [, , HELLO_W = 1, HELLO_H = 1] = LOOK_POSTER.helloViewBox.split(' ').map(Number);
const ARC_ID = 'look-hello-arc';
const HELLO_SIZE = theme.fontSize['3xl'];

/**
 * "Hello" set on the web's arc (text on a path), as wide as the web's (20rem at most). The type
 * is sized in the arc's own box, as on the web, so it scales with the arc.
 */
export function HelloArc() {
  return (
    <View
      testID="look-hello"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: '100%', maxWidth: theme.space['8'] * 5, aspectRatio: HELLO_W / HELLO_H }}
    >
      <Svg testID="look-hello-svg" width="100%" height="100%" viewBox={LOOK_POSTER.helloViewBox}>
        <Defs>
          <Path testID={ARC_ID} id={ARC_ID} d={LOOK_POSTER.helloArc} fill="none" />
        </Defs>
        <SvgText
          fill={theme.color.ink}
          fontSize={HELLO_SIZE}
          fontWeight={theme.fontWeight.bold}
          letterSpacing={HELLO_SIZE * toEm(tokens.tracking.wide)}
          textAnchor="middle"
        >
          <TextPath href={`#${ARC_ID}`} startOffset="50%">
            {t.hello}
          </TextPath>
        </SvgText>
      </Svg>
    </View>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * The thin line from the end of "Hello" round the figure down to "I'm", ending in an arrowhead,
 * stretched to the poster (`width` across, `endY` down to the top of "I'm"). It draws itself
 * once by moving a dash as long as the path (an upper bound, so it always ends whole), after half
 * the entrance; under Reduce Motion it is a plain solid line from the first frame (hard rule 9).
 */
export function PosterLine({
  width,
  height,
  endY,
  reduce,
}: {
  width: number;
  height: number;
  endY: number;
  reduce: boolean;
}) {
  // 1: not yet drawn, 0: whole. It rests at 0, so a line is whole unless it is drawing.
  const progress = useRef(new Animated.Value(0)).current;
  const drawn = useRef(false);
  const ready = width > 0 && endY > 0;

  useEffect(() => {
    if (reduce) {
      progress.stopAnimation();
      progress.setValue(0);
      return;
    }
    if (!ready || drawn.current) return;
    drawn.current = true;
    progress.setValue(1);
    Animated.timing(progress, {
      toValue: 0,
      duration: ms(tokens.duration.draw),
      delay: ms(tokens.duration.enter) / 2,
      // SVG props aren't on the native driver's list.
      useNativeDriver: false,
    }).start();
  }, [reduce, ready, progress]);

  if (!ready) return null;
  const sx = width / 100;
  const sy = endY / LOOK_POSTER.lineEndY;
  const stroke = (d: string) => {
    if (reduce) return {};
    const length = pathLengthBound(d);
    return {
      strokeDasharray: [length, length],
      strokeDashoffset: progress.interpolate({ inputRange: [0, 1], outputRange: [0, length] }),
    };
  };
  const line = scalePath(LOOK_POSTER.line, sx, sy);
  const arrowhead = scalePath(LOOK_POSTER.arrowhead, sx, sy);
  return (
    <View
      testID="look-curve"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { width, height }]}
    >
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        fill="none"
        stroke={theme.color.ink}
        strokeWidth={theme.border.thick}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <AnimatedPath testID="look-line" d={line} stroke={theme.color.ink} {...stroke(line)} />
        <AnimatedPath
          testID="look-arrowhead"
          d={arrowhead}
          stroke={theme.color.ink}
          {...stroke(arrowhead)}
        />
      </Svg>
    </View>
  );
}
