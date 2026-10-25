/**
 * The profile look's drawings as plain data (docs/design/profile-look-proposal.md §2.5, §2.6, D6):
 * the 12 avatar icons and the poster's "Hello" arc and line. The web draws them as inline SVG,
 * the app with react-native-svg, from these same shapes. React-Native-safe (hard rule 11): data
 * and arithmetic only. Coordinates are the drawing itself (in their own box), not design values:
 * colours, stroke widths and sizes come from the tokens where each app draws them.
 */
import type { IconId } from './profile-look';

export type IconShape =
  | { readonly kind: 'path'; readonly d: string }
  | { readonly kind: 'circle'; readonly cx: number; readonly cy: number; readonly r: number }
  | {
      readonly kind: 'rect';
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
      readonly rx: number;
    };

/** Every icon is drawn in this box, as `components/icons.tsx` on the web. */
export const LOOK_ICON_VIEWBOX = '0 0 24 24';

/** The icons' line, in the box's units (the stroke style of the web's `icons.tsx`). */
export const LOOK_ICON_STROKE = 1.75;

const path = (d: string): IconShape => ({ kind: 'path', d });
const circle = (cx: number, cy: number, r: number): IconShape => ({ kind: 'circle', cx, cy, r });
const rect = (x: number, y: number, width: number, height: number, rx: number): IconShape => ({
  kind: 'rect',
  x,
  y,
  width,
  height,
  rx,
});

/** Objects and South African plants: nothing gendered, no faces, no skin tones (§2.5). */
export const LOOK_ICONS: Readonly<Record<IconId, ReadonlyArray<IconShape>>> = {
  rocket: [
    path('M12 3c3 2 4.5 5.5 4.5 9.5L14 16h-4l-2.5-3.5C7.5 8.5 9 5 12 3Z'),
    circle(12, 9.5, 1.5),
    path('m10 16-1 4 3-2 3 2-1-4'),
  ],
  book: [
    path('M12 6c-2-1.5-5-2-8-1.5v14c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-14c-3-.5-6 0-8 1.5Z'),
    path('M12 6v14'),
  ],
  compass: [circle(12, 12, 9), path('m15.5 8.5-2 5-5 2 2-5 5-2Z')],
  telescope: [
    path('m4 13 12-6 2 4-12 6-2-4Z'),
    path('m16 7 3-1.5 1.5 3L18 11'),
    path('m11 15-3 6m3-6 3 6'),
  ],
  beaker: [
    path('M9 3h6m-5 0v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3'),
    path('M7.5 15h9'),
  ],
  paintbrush: [
    path('m18 3 3 3-9 9-3-3 9-9Z'),
    path('M9 12c-3 0-4 2-4 4 0 1.5-1 2.5-2 3 3 1 7 .5 8-3'),
  ],
  headphones: [path('M4 15v-3a8 8 0 0 1 16 0v3'), rect(3, 14, 4, 6, 1.5), rect(17, 14, 4, 6, 1.5)],
  ball: [
    circle(12, 12, 9),
    path('M3.5 9.5c5 1 12 1 17 0m-17 5c5-1 12-1 17 0M12 3c-3 5-3 13 0 18m0-18c3 5 3 13 0 18'),
  ],
  protea: [
    path('M12 21v-6'),
    path('M12 15c-4 0-6-3-6-7 2 0 4 1 6 3 2-2 4-3 6-3 0 4-2 7-6 7Z'),
    path('M12 11V4M9 6l3-2 3 2'),
  ],
  baobab: [
    path('M10 21c0-4 0-8-1-11h6c-1 3-1 7-1 11'),
    path('M9 10 6 6m3 4L8 5m7 5 3-4m-3 4 1-5m-4 5V5'),
    path('M5 21h14'),
  ],
  mountain: [path('m3 20 6-11 4 6 3-4 5 9H3Z'), path('m7.5 12 1.5 1 1.5-1.5')],
  star: [path('m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z')],
};

/**
 * The poster (the owner's reference picture): "Hello" set on an arc in a 200 by 60 box, and one
 * thin line from the end of "Hello" round the figure down to "I'm", ending in an arrowhead. The
 * line is in hundredths of the poster (0 to 100 both ways), stretched to its box.
 */
export const LOOK_POSTER = {
  helloViewBox: '0 0 200 60',
  helloArc: 'M14 58 Q100 -6 186 58',
  line: 'M64 9 C84 14 86 40 72 52 C60 61 30 55 16 58 C8 60 3 62 3 70',
  arrowhead: 'M1.5 66.5 L3 70 L4.5 66.5',
  /** Where the line ends, in hundredths of the poster's height: the top of "I'm". */
  lineEndY: 70,
} as const;

type Segment = { command: string; values: number[] };

const PAIRS: Record<string, number> = { M: 1, L: 1, Q: 2, C: 3, Z: 0 };

function segments(d: string): Segment[] {
  const out: Segment[] = [];
  for (const match of d.matchAll(/([A-Za-z])([^A-Za-z]*)/g)) {
    const command = match[1] ?? '';
    const pairs = PAIRS[command];
    if (pairs === undefined)
      throw new RangeError(`Only absolute M, L, Q, C and Z can be scaled: ${command}`);
    const values = (match[2]?.match(/-?\d*\.?\d+/g) ?? []).map(Number);
    if (values.length !== pairs * 2) throw new RangeError(`Wrong number of values for ${command}`);
    out.push({ command, values });
  }
  return out;
}

const round = (n: number) => Number(n.toFixed(3));

/** An absolute path stretched by `sx` across and `sy` down (the poster's line to its box). */
export function scalePath(d: string, sx: number, sy: number): string {
  return segments(d)
    .map(
      ({ command, values }) =>
        command + values.map((v, i) => round(v * (i % 2 === 0 ? sx : sy))).join(' '),
    )
    .join(' ');
}

/**
 * An upper bound on a path's length: each straight line exactly, each curve by its control
 * polygon (a Bézier curve is never longer). A dash this long covers the whole path, so a line
 * drawn by moving its dash from this length to 0 always ends fully drawn.
 */
export function pathLengthBound(d: string): number {
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let total = 0;
  for (const { command, values } of segments(d)) {
    if (command === 'M') {
      [x, y] = [values[0] ?? 0, values[1] ?? 0];
      [startX, startY] = [x, y];
      continue;
    }
    const points = command === 'Z' ? [startX, startY] : values;
    for (let i = 0; i < points.length; i += 2) {
      const nx = points[i] ?? 0;
      const ny = points[i + 1] ?? 0;
      total += Math.hypot(nx - x, ny - y);
      [x, y] = [nx, ny];
    }
  }
  return total;
}
