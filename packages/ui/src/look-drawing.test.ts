import { en } from '@universityflow/content';
import { describe, expect, it } from 'vitest';
import {
  LOOK_ICON_VIEWBOX,
  LOOK_ICONS,
  LOOK_POSTER,
  pathLengthBound,
  scalePath,
} from './look-drawing';

/**
 * The avatar icons and the poster's "Hello" arc and line as plain data, so the web (inline SVG)
 * and the app (react-native-svg) draw the same shapes (docs/design/profile-look-proposal.md §2.5,
 * §2.6, D6).
 */

const numbers = (d: string) => (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);

describe('the avatar icons', () => {
  it('has a drawing for every icon the picker names, and nothing else', () => {
    expect(Object.keys(LOOK_ICONS)).toEqual(Object.keys(en.profileLook.icons));
    expect(Object.keys(LOOK_ICONS)).toHaveLength(12);
  });

  it('draws every icon inside its 24-unit box with paths, circles and rectangles only', () => {
    expect(LOOK_ICON_VIEWBOX).toBe('0 0 24 24');
    for (const [id, shapes] of Object.entries(LOOK_ICONS)) {
      expect(shapes.length, id).toBeGreaterThan(0);
      for (const shape of shapes) {
        if (shape.kind === 'path') {
          expect(shape.d, id).toMatch(/^[MmLlHhVvCcSsQqTtAaZz\d\s.,-]+$/);
          for (const n of numbers(shape.d)) expect(Math.abs(n), id).toBeLessThanOrEqual(24);
        } else if (shape.kind === 'circle') {
          expect(shape.cx - shape.r, id).toBeGreaterThanOrEqual(0);
          expect(shape.cx + shape.r, id).toBeLessThanOrEqual(24);
        } else {
          expect(shape.x + shape.width, id).toBeLessThanOrEqual(24);
          expect(shape.y + shape.height, id).toBeLessThanOrEqual(24);
        }
      }
    }
  });
});

describe('the poster’s arc and line', () => {
  it('sets "Hello" on an arc across its box, and the line from Hello down to "I’m"', () => {
    expect(LOOK_POSTER.helloViewBox).toBe('0 0 200 60');
    expect(LOOK_POSTER.helloArc).toBe('M14 58 Q100 -6 186 58');
    // In hundredths of the poster: it starts by the end of "Hello" and ends at "I'm".
    expect(LOOK_POSTER.line.slice(0, 5)).toBe('M64 9');
    expect(numbers(LOOK_POSTER.line).slice(-2)).toEqual([3, LOOK_POSTER.lineEndY]);
    expect(numbers(LOOK_POSTER.arrowhead)).toEqual([1.5, 66.5, 3, 70, 4.5, 66.5]);
  });

  it('scales an absolute path to a box, x and y apart', () => {
    expect(scalePath('M64 9 C84 14 86 40 72 52 L3 70', 2, 0.5)).toBe(
      'M128 4.5 C168 7 172 20 144 26 L6 35',
    );
  });

  it('refuses a relative or an arc command it can’t scale', () => {
    expect(() => scalePath('m1 1 l2 2', 1, 1)).toThrow(RangeError);
    expect(() => scalePath('M1 1 A2 2 0 0 1 3 3', 1, 1)).toThrow(RangeError);
  });

  it('bounds a path’s length from above, so a dash that long always covers it', () => {
    // A straight line is exactly its length; a curve is never longer than its control polygon.
    expect(pathLengthBound('M0 0 L3 4')).toBe(5);
    expect(pathLengthBound('M0 0 C0 3 4 3 4 0')).toBe(10);
    expect(pathLengthBound(LOOK_POSTER.line)).toBeGreaterThan(0);
  });
});
