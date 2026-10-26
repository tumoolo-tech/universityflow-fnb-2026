import { type ColorToken, tokens } from '@universityflow/tokens';

/**
 * The visual identity (planning.md Q16) in the units React Native takes, derived from
 * `@universityflow/tokens` and never typed by hand (hard rule 8).
 *
 * - rem → density-independent pixels at 16 per rem, the same base the web uses.
 * - Unitless line heights stay multipliers; `text` turns them into the absolute line height RN
 *   needs. RN scales both size and line height with the phone's text size setting, so dynamic
 *   type keeps working: nothing here caps it, and controls use minHeight, never a fixed height.
 * - Font weights stay the strings RN accepts ('400', '500', '700').
 * - The font is the system font (no `fontFamily`): nothing to download, as on the web.
 */

export const REM_PX = 16;

/** '1.5rem' → 24, '999px' → 999, '0' → 0. */
export function toPx(value: string): number {
  const match = /^(-?\d*\.?\d+)(rem|px)?$/.exec(value.trim());
  if (!match) throw new RangeError(`Not a length: ${value}`);
  const n = Number(match[1]);
  return match[2] === 'rem' ? n * REM_PX : n;
}

/** '1.55' → 1.55. */
export function toMultiplier(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new RangeError(`Not a line-height multiplier: ${value}`);
  return n;
}

/** '0.08em' → 0.08: letter-spacing as a fraction of the font size (RN takes points). */
export function toEm(value: string): number {
  const match = /^(-?\d*\.?\d+)em$/.exec(value.trim());
  if (!match) throw new RangeError(`Not an em length: ${value}`);
  return Number(match[1]);
}

type FontWeight = '400' | '500' | '700';
function toWeight(value: string): FontWeight {
  if (value === '400' || value === '500' || value === '700') return value;
  throw new RangeError(`Unsupported font weight: ${value}`);
}

function mapValues<K extends string, V, R>(obj: Record<K, V>, fn: (v: V) => R): Record<K, R> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v as V)])) as Record<K, R>;
}

const space = mapValues(tokens.space, toPx);
const radius = mapValues(tokens.radius, toPx);
const border = mapValues(tokens.border, toPx);
const fontSize = mapValues(tokens.font.size, toPx);
const lineHeight = mapValues(tokens.font.lineHeight, toMultiplier);
const fontWeight = mapValues(tokens.font.weight, toWeight);

type SizeKey = keyof typeof tokens.font.size;

/** A text style: size, its absolute line height, and weight. */
function text(size: SizeKey, leading: keyof typeof lineHeight, weight: keyof typeof fontWeight) {
  return {
    fontSize: fontSize[size],
    lineHeight: Math.round(fontSize[size] * lineHeight[leading]),
    fontWeight: fontWeight[weight],
  };
}

/**
 * The text-on-background pairs the app uses. Components take colours from here, so every
 * combination on screen is one `TEXT_PAIRS` holds to WCAG AA (the theme test proves it).
 */
const pairs = {
  page: ['ink', 'canvas'],
  pageMuted: ['inkMuted', 'canvas'],
  pageBrand: ['brand', 'canvas'],
  /** The learner's name in the home's welcome, in the light pink (as on the web). */
  pageAccent: ['accent', 'canvas'],
  card: ['ink', 'surface'],
  cardMuted: ['inkMuted', 'surface'],
  cardBrand: ['brand', 'surface'],
  sunk: ['ink', 'surfaceSunk'],
  /** A link inside a sunk panel (free practice, A2-06). */
  sunkBrand: ['brand', 'surfaceSunk'],
  primary: ['onBrand', 'brand'],
  /** The danger button: an irreversible action (A2-03). */
  destructive: ['onBrand', 'danger'],
  /** The heading over an irreversible action, on a card. */
  cardDanger: ['danger', 'surface'],
  accent: ['onAccent', 'accent'],
  warning: ['warning', 'warningSoft'],
  danger: ['danger', 'dangerSoft'],
  success: ['success', 'successSoft'],
  info: ['info', 'infoSoft'],
} as const satisfies Record<string, readonly [ColorToken, ColorToken]>;

export type Pair = keyof typeof pairs;

export const theme = {
  color: tokens.color,
  space,
  radius,
  /** Border widths: `thin` for fields and cards, `thick` for buttons and controls (A2-05). */
  border,
  fontSize,
  lineHeight,
  fontWeight,
  /** Minimum touch target, both dimensions (WCAG 2.5.8; 44 for thumbs). */
  target: toPx(tokens.target),
  /** Widest line of reading text on a tablet. */
  maxWidth: toPx(tokens.maxWidth.prose),
  text: {
    body: text('base', 'normal', 'normal'),
    bodyStrong: text('base', 'normal', 'bold'),
    small: text('sm', 'normal', 'normal'),
    label: text('base', 'tight', 'medium'),
    title: text('xl', 'tight', 'bold'),
    heading: text('lg', 'tight', 'bold'),
    display: text('2xl', 'tight', 'bold'),
    /** A small uppercase caption ("NEXT STEP", a group's name), letter-spaced as on the web. */
    caps: {
      ...text('sm', 'normal', 'medium'),
      textTransform: 'uppercase',
      letterSpacing: fontSize.sm * toEm(tokens.tracking.wide),
    },
  },
  pairs,
  /**
   * RT-04: a card and a panel inside it, from `tokens.card.levels`: a card on the screen is the
   * card fill with the card edge (3:1 on the screen, CARD_PAIRS); a card or a tile inside it is
   * the next level's fill with the same edge (3:1 on its parent), never its parent's fill.
   */
  card: {
    backgroundColor: tokens.color[tokens.card.levels[0].fill],
    borderColor: tokens.color[tokens.card.levels[0].edge],
    borderWidth: border.thin,
  },
  panel: {
    backgroundColor: tokens.color[tokens.card.levels[1].fill],
    borderColor: tokens.color[tokens.card.levels[1].edge],
    borderWidth: border.thin,
  },
  /** Text colour and background for a pair. */
  on(pair: Pair) {
    const [fg, bg] = pairs[pair];
    return { color: tokens.color[fg], backgroundColor: tokens.color[bg] };
  },
} as const;

export type Theme = typeof theme;
