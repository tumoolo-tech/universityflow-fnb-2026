/**
 * Design tokens: UniversityFlow's visual identity, and the only place a colour, size or duration
 * is written down (hard rule 8).
 *
 * The 2026-10-19 refresh (docs/design/README.md) takes its colours from the owner's two pictures:
 * a charcoal poster (the front door and sign-in) and a near-black dashboard with a dusty mauve
 * accent (every signed-in page). One dark theme, the default. Where a reference grey failed
 * WCAG 2.2 AA it was adjusted until it passes: legibility wins, and the tests prove every pair.
 * The web app gets these as CSS custom properties (`tokens.css`, generated from `toCss`); the
 * mobile app imports them directly.
 */

export const tokens = {
  /** WCAG 2.2 AA minimums every colour pair must meet (hard rule 9). */
  contrast: {
    text: 4.5,
    largeText: 3,
    nonText: 3,
  },
  color: {
    /** The dashboard's near-black. */
    canvas: '#0E0D10',
    /** Cards and panels, a step lighter than the canvas. */
    surface: '#17161A',
    /** A tile inside a card (on a dark theme it reads as raised). */
    surfaceSunk: '#211F25',
    /** Primary text: white, a touch warm. */
    ink: '#F4F2F5',
    /** Secondary text: light grey (the poster's body grey, lightened for AA). */
    inkMuted: '#B9B4BC',
    /** Hairlines: white at about 10% on a card. Decorative only: a divider, never a card's edge. */
    line: '#2E2C32',
    /**
     * A card's edge (RT-04, 2026-10-25): a mauve-grey 1px boundary at 3:1 against everything a
     * card can sit on (the page, a parent card, a tile), so every card reads as its own unit.
     * Lighter than `line`, a step under `lineStrong` (a control's thicker outline).
     */
    cardEdge: '#726A78',
    /** Control borders and outlined pills: 3:1 on every dark ground. */
    lineStrong: '#78727D',
    /** The one accent: dusty mauve. Buttons, the current nav pill, links. */
    brand: '#C99BB8',
    brandHover: '#DDB5CE',
    /** Dark plum text on the mauve. */
    onBrand: '#1A1219',
    /** The lighter pink for highlights: the learner's name, the chart's line. */
    accent: '#E9B8D4',
    onAccent: '#1A1219',
    /** A light blue ring: 3:1 on every ground, and not the accent, so focus is never mistaken for selection. */
    focus: '#9CC2FF',
    /** Gains, used sparingly; each status has a dark soft ground of its own hue. */
    success: '#4ADE80',
    successSoft: '#11291B',
    warning: '#F5C26B',
    warningSoft: '#221D15',
    danger: '#FF8A80',
    dangerSoft: '#341719',
    info: '#93B8FF',
    infoSoft: '#172238',
    /** The poster's charcoal: the split stage's sharp half, top to bottom (bottom darkened for AA). */
    stageTop: '#2C2A2D',
    stageBottom: '#433F45',
    /** The poster's blurred light grey: a decorative shape behind the glass, never behind text alone. */
    haze: '#9E9A9E',
    /**
     * The light ink on the split stage's glass (the front door and sign-in): text, icons, the
     * wordmark's frosted half and the focus ring there. Held against the glass composited over
     * every backdrop (GLASS_PAIRS).
     */
    onGlass: '#FFFFFF',
    /** Quieter text on the glass: the three quiet words, a lead, a caption. */
    onGlassMuted: '#D6D2D8',
    /**
     * The profile card's themes (`profileThemes`): an accent and a dark soft band for each. They
     * colour only the card and the home avatar, never a status (a "green theme" is not a pass).
     */
    profileMauveSoft: '#2A1E27',
    profileOcean: '#5FD3D9',
    profileOceanSoft: '#112A2C',
    profileFynbos: '#7FDCB0',
    profileFynbosSoft: '#11291F',
    profileSunrise: '#FF9F45',
    profileSunriseSoft: '#2A1F12',
    profileProtea: '#FF94C2',
    profileProteaSoft: '#2E1724',
    profileJacaranda: '#B9A6FF',
    profileJacarandaSoft: '#211C38',
    profileMonoSoft: '#26252A',
    /**
     * My plan maps' branch tones (`mapTones`, docs/design/plan-maps-proposal.md §8.3), the pastel
     * cards of the owner's reference pictures on the dark theme: pink, mint, cyan, peach, lilac
     * and rose, each with a dark soft fill. The profile themes' accents, which already keep apart
     * from focus and every status. A tone colours a branch only, never a status.
     */
    mapTone1: '#FF94C2',
    mapTone1Soft: '#2E1724',
    mapTone2: '#7FDCB0',
    mapTone2Soft: '#11291F',
    mapTone3: '#5FD3D9',
    mapTone3Soft: '#112A2C',
    mapTone4: '#FF9F45',
    mapTone4Soft: '#2A1F12',
    mapTone5: '#B9A6FF',
    mapTone5Soft: '#211C38',
    mapTone6: '#E9B8D4',
    mapTone6Soft: '#2A1E27',
  },
  /** The plan maps' branch tones in turn: branch n takes tone ((n - 1) mod 6) + 1. */
  mapTones: [
    { accent: 'mapTone1', soft: 'mapTone1Soft' },
    { accent: 'mapTone2', soft: 'mapTone2Soft' },
    { accent: 'mapTone3', soft: 'mapTone3Soft' },
    { accent: 'mapTone4', soft: 'mapTone4Soft' },
    { accent: 'mapTone5', soft: 'mapTone5Soft' },
    { accent: 'mapTone6', soft: 'mapTone6Soft' },
  ],
  /**
   * The learner's profile themes, by id (docs/design/profile-look-proposal.md §3): the colour
   * tokens each one uses. Text on the accent is `onAccent`; text on the soft band is `ink`.
   */
  profileThemes: {
    mauve: { accent: 'accent', soft: 'profileMauveSoft' },
    ocean: { accent: 'profileOcean', soft: 'profileOceanSoft' },
    fynbos: { accent: 'profileFynbos', soft: 'profileFynbosSoft' },
    sunrise: { accent: 'profileSunrise', soft: 'profileSunriseSoft' },
    protea: { accent: 'profileProtea', soft: 'profileProteaSoft' },
    jacaranda: { accent: 'profileJacaranda', soft: 'profileJacarandaSoft' },
    /** Black and white, like the owner's two pictures. */
    mono: { accent: 'ink', soft: 'profileMonoSoft' },
  },
  /**
   * Translucent colours (docs/design/README.md). They live here, not in `color`, because a
   * contrast ratio needs to know what they sit over: each lists its backdrops, and the tests
   * composite it over every one. A browser without backdrop-filter gets the solid `fallback`.
   */
  glass: {
    /** The frosted half of the split stage: charcoal at 60%, blurred over the poster's shapes. */
    tint: 'rgba(38, 36, 40, 0.6)',
    /** A dark glass card: the sign-in form, the bottom bar. */
    card: 'rgba(23, 22, 26, 0.88)',
    /** The dashboard's mauve haze over the canvas. */
    haze: 'rgba(201, 155, 184, 0.14)',
    /** The current nav pill's strongest end (it fades to transparent). */
    pill: 'rgba(201, 155, 184, 0.35)',
    blur: '20px',
    backdrops: {
      tint: ['stageTop', 'stageBottom', 'brand', 'haze'],
      card: ['stageTop', 'stageBottom', 'brand', 'haze', 'canvas'],
      haze: ['canvas', 'surface'],
      pill: ['surface', 'canvas'],
    },
    fallback: { tint: 'surfaceSunk', card: 'surface', haze: 'canvas', pill: 'surfaceSunk' },
  },
  /**
   * The course cards' pictures (apps/web/lib/course-art.ts): a photo across the card's top, under
   * a scrim of the card's own colour. The top `band` holds no words, so the picture shows there
   * (`scrimTop`); from the band down every word sits on `scrimText`, held to AA over a white
   * pixel, the lightest a photo can have (COURSE_ART_PAIRS). Below `height` the card is solid.
   */
  courseArt: {
    scrimTop: 'rgba(23, 22, 26, 0.3)',
    /** 0.92: the outline button's edge (lineStrong, 3:1) needs it; text alone would pass at 0.84. */
    scrimText: 'rgba(23, 22, 26, 0.92)',
    band: '4rem',
    height: '13rem',
  },
  /**
   * Cards (RT-04): how each level of card is drawn, outermost first. A card on the page, a card in
   * a card (a step lighter, its own edge), and a card in that (back to the card's fill): never
   * its parent's fill. `CARD_PAIRS` holds every edge to 3:1 against what is behind it (WCAG
   * 1.4.11). `shadow`: a soft lift under a card on the page (a lit top edge and a dark fall-off),
   * decoration only (the edge carries the boundary). `gap`: the space between sibling cards in
   * a list or a grid, the page's own gap (24px), wider than the space between a card's own parts.
   */
  card: {
    levels: [
      { fill: 'surface', edge: 'cardEdge', behind: 'canvas' },
      { fill: 'surfaceSunk', edge: 'cardEdge', behind: 'surface' },
      { fill: 'surface', edge: 'cardEdge', behind: 'surfaceSunk' },
    ],
    shadow:
      'inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 1px 2px rgba(0, 0, 0, 0.6), 0 8px 24px -8px rgba(0, 0, 0, 0.7)',
    gap: '1.5rem',
  },
  /** Spacing scale, in rem. */
  space: {
    '0': '0',
    '1': '0.25rem',
    '2': '0.5rem',
    '3': '0.75rem',
    '4': '1rem',
    '5': '1.5rem',
    '6': '2rem',
    '7': '3rem',
    '8': '4rem',
  },
  radius: {
    sm: '0.375rem',
    md: '0.75rem',
    lg: '1.25rem',
    full: '999px',
  },
  /**
   * Border widths: `thin` for fields and cards, `thick` for buttons, controls and an emphasised
   * card, `rule` for a heavy side rule (A2-05).
   */
  border: {
    thin: '1px',
    thick: '2px',
    rule: '4px',
  },
  font: {
    /**
     * The web's type is Outfit, a geometric sans like the pictures' (SIL OFL), self-hosted as one
     * 32 KB variable woff2 (apps/web/app/fonts). `family` is the system stack behind it: the web's
     * fallback while it loads, and the mobile app's font until the app loads Outfit too.
     */
    brand: 'Outfit',
    family:
      "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Helvetica Neue', Arial, sans-serif",
    /** A slightly larger base than usual: easier to read on a small screen in sunlight. */
    size: {
      sm: '0.9375rem',
      base: '1.0625rem',
      lg: '1.25rem',
      xl: '1.5rem',
      '2xl': '1.875rem',
      '3xl': '2.25rem',
    },
    lineHeight: { display: '0.9', tight: '1.25', normal: '1.55' },
    weight: { normal: '400', medium: '500', bold: '700' },
  },
  /**
   * Fluid sizes for the split stage and the dashboard, by the viewport's width and height so the
   * stage fits one laptop screen (web only: React Native has no clamp, the
   * app sizes these itself next round). `wordmark`: the huge word across the bottom; `number`:
   * a big number with its two-line label; `headline`: the stage's uppercase headline.
   */
  display: {
    wordmark: 'clamp(3.5rem, min(15vw, 19dvh), 11rem)',
    number: 'clamp(2rem, min(5vw, 6.5dvh), 3.25rem)',
    headline: 'clamp(2rem, min(5vw, 7.5dvh), 3.75rem)',
    /** The About me poster's "I'm / Name": huge, as in the owner's reference picture. */
    poster: 'clamp(2.75rem, 11vw, 5.5rem)',
  },
  /** Letter-spacing: tight for display type, wide for uppercase captions, widest for the strapline. */
  tracking: {
    tight: '-0.02em',
    wide: '0.08em',
    widest: '0.32em',
  },
  /** Durations; every one drops to 0ms under prefers-reduced-motion (hard rule 9). */
  duration: {
    fast: '120ms',
    normal: '200ms',
    /** The split stage's entrance: a fade and a short rise, once, on load. */
    enter: '600ms',
    /** The profile card's line drawing itself, once. */
    draw: '800ms',
    /** A plan map's road or climb line drawing itself in, once, when its canvas comes into view. */
    journey: '1400ms',
  },
  /**
   * How far things move (A2-25); each drops to 0 under prefers-reduced-motion, like the durations.
   * `rise`: the split stage's and the profile card's entrance; `riseSmall`: a plan map's stop
   * (smaller things move less); `lift`: a hovered starter card or front-door tile.
   */
  motion: {
    rise: '0.75rem',
    riseSmall: '0.375rem',
    lift: '2px',
  },
  /** How motion eases (A2-25): `enter` for what arrives or answers a press, `inOut` for a loop or a wiggle. */
  easing: {
    enter: 'ease-out',
    inOut: 'ease-in-out',
  },
  /**
   * Shapes of decoration (A2-25): the mauve haze over the page and over the home's headline card
   * (a `radial-gradient` size and position), and the least height of the split stage from a
   * laptop's width (it grows past one screen rather than cut anything off, A3-23).
   */
  shape: {
    hazePage: '60rem 36rem at 85% -10%',
    hazeCard: '120% 90% at 100% 0%',
    stageMin: '36rem',
    /**
     * The front door's journey in pictures (the owner, 2026-10-24): the widest the column of three
     * may be (it is narrower when the room above the wordmark is short), how far each picture's
     * foot tucks behind the heads below (of the column's width), and the column's shape: three
     * 720-wide photos, 527 + 497 + 735 tall, less two tucks.
     */
    stagePeople: 'min(17vw, 19rem)',
    stagePeopleTuck: '14%',
    stagePeopleRatio: '720 / 1557.4',
  },
  /**
   * The widths layouts switch at (A2-25). CSS can't read a variable in a media query, so these
   * are constants that globals.css is held to by a test (apps/web/test/css-rules.test.ts):
   * `laptop`, where the sidebar and `targetPointer` start (Tailwind's `lg`), and `shortScreen`,
   * the height under which the sidebar takes `targetDense`.
   */
  breakpoint: {
    laptop: '64rem',
    shortScreen: '50rem',
  },
  /**
   * My plan maps' canvas (2026-10-24): the picture on a card the learner pans and zooms (web
   * only). `height`: the card's window onto the map, from a 360px phone up; `grid` and `dot`: the
   * dotted ground's spacing at 100% and each dot's radius (`grid` is also the snap grid a moved
   * card lands on, RT-08); `minimap`: the mini-map's width; `road`: the road's width at 100%.
   * The picture's own size comes from its layout (apps/web map-layout.ts), not from here
   * (2026-10-25: the `worldRing`, `worldWide` and `worldRoad` widths went with the CSS grids).
   */
  canvas: {
    height: 'clamp(22rem, 75dvh, 44rem)',
    grid: '1.5rem',
    dot: '1.5px',
    minimap: '8rem',
    road: '2.75rem',
  },
  /** Minimum touch target (WCAG 2.2 2.5.8 asks for 24px; we use 44px for thumbs). */
  target: '2.75rem',
  /** A row for a mouse, from a laptop's width: the sidebar's links (32px). */
  targetPointer: '2rem',
  /** The same on a short screen (under 800px tall), so the sidebar never scrolls (28px). */
  targetDense: '1.75rem',
  /**
   * Widths (A2-24): a line of reading, a signed-in page, the chat's centred conversation, a card
   * holding one form (sign-in), the judge demo's wide pages, and the sidebar from a laptop's width.
   */
  maxWidth: {
    prose: '42rem',
    page: '72rem',
    chat: '48rem',
    form: '28rem',
    wide: '64rem',
    sidebar: '15rem',
  },
} as const;

export type ColorToken = keyof typeof tokens.color;

/** Text and background pairs the interface uses, each held to the AA text minimum. */
export const TEXT_PAIRS: ReadonlyArray<readonly [ColorToken, ColorToken]> = [
  ['ink', 'canvas'],
  ['ink', 'surface'],
  ['ink', 'surfaceSunk'],
  /** A link inside a sunk panel (free practice), web and native (A2-06). */
  ['brand', 'surfaceSunk'],
  /** Muted text in a sunk panel: the web first-week step's "Done on…" (A3-21). */
  ['inkMuted', 'surfaceSunk'],
  ['inkMuted', 'canvas'],
  ['inkMuted', 'surface'],
  ['brand', 'canvas'],
  ['brand', 'surface'],
  ['onBrand', 'brand'],
  ['onBrand', 'brandHover'],
  ['onAccent', 'accent'],
  /** A plan map's middle (RT-07, 2026-10-25): the thinking cloud in cyan, the life map's circle in ink. */
  ['onAccent', 'mapTone3'],
  ['onAccent', 'ink'],
  /** The danger button (account deletion), web and native. */
  ['onBrand', 'danger'],
  ['success', 'successSoft'],
  ['success', 'surface'],
  ['warning', 'warningSoft'],
  ['warning', 'surface'],
  ['danger', 'dangerSoft'],
  ['danger', 'surface'],
  ['info', 'infoSoft'],
  ['info', 'surface'],
  /** A notice's body text on its soft ground (`Notice`): ink on each status's dark soft colour. */
  ['ink', 'successSoft'],
  ['ink', 'warningSoft'],
  ['ink', 'dangerSoft'],
  ['ink', 'infoSoft'],
  /** The split stage's sharp half: headline, lead and labels on the charcoal, top and bottom. */
  ['ink', 'stageTop'],
  ['ink', 'stageBottom'],
  ['inkMuted', 'stageTop'],
  ['inkMuted', 'stageBottom'],
  /** The learner's name in the home's welcome, in the light pink. */
  ['accent', 'canvas'],
];

/** Non-text pairs (borders of controls, focus rings) held to the 3:1 minimum. */
export const NON_TEXT_PAIRS: ReadonlyArray<readonly [ColorToken, ColorToken]> = [
  ['lineStrong', 'surface'],
  ['lineStrong', 'canvas'],
  ['focus', 'surface'],
  ['focus', 'canvas'],
  ['brand', 'canvas'],
  /** A selected radio's ring and a ticked checkbox, on a card. */
  ['brand', 'surface'],
  /**
   * An unticked and a ticked checkbox in a sunk panel: the native first-week step (A3-21,
   * A2-19). The unticked pair has the least margin of any (about 3.2:1): darkening `surfaceSunk`
   * or lightening `lineStrong` fails this test rather than the box.
   */
  ['lineStrong', 'surfaceSunk'],
  ['brand', 'surfaceSunk'],
  /** On a dark theme the focus ring must show inside a sunk tile too. */
  ['focus', 'surfaceSunk'],
  /**
   * On the charcoal: a brand button's fill (the phone's "Get started" on the sharp half) and the
   * focus ring. The stage's rule is `ink` (TEXT_PAIRS: ink on stageBottom), not this pair.
   */
  ['brand', 'stageBottom'],
  ['focus', 'stageBottom'],
  /** The marks chart's line and points on a card. */
  ['accent', 'surface'],
  /** A plan map's progress ring round its middle, on the canvas (RT-07, 2026-10-25). */
  ['success', 'canvas'],
];

/**
 * Every card edge against what is behind it (RT-04, WCAG 1.4.11: 3:1), generated from
 * `card.levels` so a new level cannot skip a test: [edge, behind].
 */
export const CARD_PAIRS: ReadonlyArray<readonly [ColorToken, ColorToken]> = tokens.card.levels.map(
  ({ edge, behind }) => [edge, behind] as const,
);

export type ProfileThemeId = keyof typeof tokens.profileThemes;

/**
 * Every pair a profile theme puts on screen, generated from `profileThemes` so a new theme cannot
 * skip a test: [foreground, background, minimum]. The name, the initials and the sticker on the
 * accent; the band's text, focus ring and unselected swatch ring on the soft colour.
 */
export const PROFILE_THEME_PAIRS: ReadonlyArray<
  readonly [ColorToken, ColorToken, 'text' | 'nonText']
> = Object.values(tokens.profileThemes).flatMap(({ accent, soft }) => [
  [accent, 'surface', 'text'] as const,
  /** The home avatar on the page. */
  [accent, 'canvas', 'text'] as const,
  [accent, soft, 'text'] as const,
  ['ink', soft, 'text'] as const,
  /** The tagline. */
  ['inkMuted', soft, 'text'] as const,
  ['onAccent', accent, 'text'] as const,
  ['focus', soft, 'nonText'] as const,
  ['lineStrong', soft, 'nonText'] as const,
  /**
   * "Make it yours" on the card's ground: the quiet buttons, a ticked word's box and an outline
   * button's hover and focus edge (A2-30).
   */
  ['brand', soft, 'text'] as const,
]);

/**
 * Every pair a plan map's branch puts on screen, generated from `mapTones` so a new tone cannot
 * skip a test: the words, hint and Achieved word on the soft fill; the number in the accent on the
 * fill and on a card; the focus ring and control borders on the fill; the connector on the page.
 */
export const MAP_TONE_PAIRS: ReadonlyArray<readonly [ColorToken, ColorToken, 'text' | 'nonText']> =
  tokens.mapTones.flatMap(({ accent, soft }) => [
    ['ink', soft, 'text'] as const,
    ['inkMuted', soft, 'text'] as const,
    [accent, soft, 'text'] as const,
    [accent, 'surface', 'text'] as const,
    ['success', soft, 'text'] as const,
    /** A link in a stop's card (the page that computes its facts). */
    ['brand', soft, 'text'] as const,
    ['focus', soft, 'nonText'] as const,
    ['lineStrong', soft, 'nonText'] as const,
    [accent, 'canvas', 'nonText'] as const,
    /**
     * The canvas's cards (RT-07, 2026-10-25): a card's heading band is its tone, as the owner's
     * pastel reference cards, with the dark `onAccent` words and number on it; the card's edge
     * and its branch in the tone, at 3:1 on the canvas (above) and on the card's own soft fill.
     */
    ['onAccent', accent, 'text'] as const,
    [accent, soft, 'nonText'] as const,
    /** The road's milestone markers, in the tone, on the charcoal road (stageBottom). */
    [accent, 'stageBottom', 'nonText'] as const,
  ]);

/**
 * What a course card writes or draws straight on its picture's scrim: [foreground, minimum]. Each
 * is tested over the scrim composited on white and on black. The card's name, faculty and score
 * (ink), its faculty (inkMuted), its links and quiet button (brand); the focus ring and the outline
 * button's edge. Badges and filled buttons bring their own opaque grounds (TEXT_PAIRS).
 */
export const COURSE_ART_PAIRS: ReadonlyArray<readonly [ColorToken, 'text' | 'nonText']> = [
  ['ink', 'text'],
  ['inkMuted', 'text'],
  ['brand', 'text'],
  ['focus', 'nonText'],
  ['lineStrong', 'nonText'],
];

export type GlassToken = 'tint' | 'card' | 'haze' | 'pill';

/**
 * Text and non-text pairs on glass: [foreground, glass, minimum]. Each is tested against the glass
 * composited over every backdrop, and against the solid fallback.
 */
export const GLASS_PAIRS: ReadonlyArray<
  readonly [ColorToken, GlassToken, 'text' | 'largeText' | 'nonText']
> = [
  ['onGlass', 'tint', 'text'],
  ['onGlassMuted', 'tint', 'text'],
  /** The focus ring and the accent rule on the dark glass. */
  ['onGlass', 'tint', 'nonText'],
  ['accent', 'tint', 'nonText'],
  /** The wordmark's frosted copy: decoration, but it must be seen (large text, 3:1). */
  ['accent', 'tint', 'largeText'],
  ['ink', 'card', 'text'],
  ['inkMuted', 'card', 'text'],
  ['brand', 'card', 'text'],
  ['focus', 'card', 'nonText'],
  ['lineStrong', 'card', 'nonText'],
  /** The dashboard's mauve haze: every text colour that sits on the page itself. */
  ['ink', 'haze', 'text'],
  ['inkMuted', 'haze', 'text'],
  ['brand', 'haze', 'text'],
  ['accent', 'haze', 'text'],
  ['focus', 'haze', 'nonText'],
  /** The current nav pill: mauve fading to nothing, white text over its strongest end. */
  ['ink', 'pill', 'text'],
  ['focus', 'pill', 'nonText'],
];

/**
 * The opaque colour a browser paints for `rgba(r, g, b, a)` over a #RRGGBB backdrop (simple
 * alpha compositing in sRGB, as CSS does), as #RRGGBB.
 */
export function composite(rgba: string, backdrop: string): string {
  const m = /^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*(0|1|0?\.\d+)\s*\)$/.exec(rgba);
  if (!m) throw new RangeError(`Not an rgba() colour: ${rgba}`);
  luminance(backdrop);
  const alpha = Number(m[4]);
  return `#${[1, 2, 3]
    .map((i) => {
      const fg = Number(m[i]);
      const bg = Number.parseInt(backdrop.slice(1 + (i - 1) * 2, 3 + (i - 1) * 2), 16);
      return Math.round(fg * alpha + bg * (1 - alpha))
        .toString(16)
        .padStart(2, '0');
    })
    .join('')
    .toUpperCase()}`;
}

function channel(hex: string, offset: number): number {
  const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a #RRGGBB colour. */
export function luminance(hex: string): number {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new RangeError(`Not a #RRGGBB colour: ${hex}`);
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

/** WCAG contrast ratio between two colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

function lab(hex: string): readonly [number, number, number] {
  luminance(hex);
  const [r, g, b] = [1, 3, 5].map((offset) => channel(hex, offset)) as [number, number, number];
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** How different two colours look (CIE76 ΔE in CIELAB, D65): 0 the same, about 2 just noticeable. */
export function colorDistance(a: string, b: string): number {
  const [p, q] = [lab(a), lab(b)];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** The tokens as CSS custom properties, with motion switched off for reduced-motion users. */
export function toCss(): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(tokens.color)) lines.push(`  --uf-color-${kebab(k)}: ${v};`);
  for (const [k, v] of Object.entries(tokens.space)) lines.push(`  --uf-space-${k}: ${v};`);
  for (const [k, v] of Object.entries(tokens.radius)) lines.push(`  --uf-radius-${k}: ${v};`);
  for (const [k, v] of Object.entries(tokens.border)) lines.push(`  --uf-border-${k}: ${v};`);
  for (const [k, v] of Object.entries(tokens.font.size)) lines.push(`  --uf-text-${k}: ${v};`);
  for (const [k, v] of Object.entries(tokens.font.lineHeight))
    lines.push(`  --uf-leading-${k}: ${v};`);
  for (const [k, v] of Object.entries(tokens.font.weight)) lines.push(`  --uf-weight-${k}: ${v};`);
  for (const [k, v] of Object.entries(tokens.display)) lines.push(`  --uf-display-${k}: ${v};`);
  for (const [k, v] of Object.entries(tokens.tracking)) lines.push(`  --uf-tracking-${k}: ${v};`);
  lines.push(`  --uf-glass-tint: ${tokens.glass.tint};`);
  lines.push(`  --uf-glass-card: ${tokens.glass.card};`);
  lines.push(`  --uf-glass-haze: ${tokens.glass.haze};`);
  lines.push(`  --uf-glass-pill: ${tokens.glass.pill};`);
  lines.push(`  --uf-glass-blur: ${tokens.glass.blur};`);
  for (const [k, v] of Object.entries(tokens.duration)) lines.push(`  --uf-duration-${k}: ${v};`);
  for (const [k, v] of Object.entries(tokens.motion))
    lines.push(`  --uf-motion-${kebab(k)}: ${v};`);
  for (const [k, v] of Object.entries(tokens.easing))
    lines.push(`  --uf-easing-${kebab(k)}: ${v};`);
  for (const [k, v] of Object.entries(tokens.shape)) lines.push(`  --uf-shape-${kebab(k)}: ${v};`);
  for (const [k, v] of Object.entries(tokens.maxWidth)) lines.push(`  --uf-width-${k}: ${v};`);
  for (const [k, v] of Object.entries(tokens.courseArt))
    lines.push(`  --uf-course-art-${kebab(k)}: ${v};`);
  for (const [k, v] of Object.entries(tokens.canvas))
    lines.push(`  --uf-canvas-${kebab(k)}: ${v};`);
  lines.push(`  --uf-shadow-card: ${tokens.card.shadow};`, `  --uf-card-gap: ${tokens.card.gap};`);
  lines.push(`  --uf-font: ${tokens.font.family};`);
  lines.push(`  --uf-target: ${tokens.target};`);
  lines.push(`  --uf-target-pointer: ${tokens.targetPointer};`);
  lines.push(`  --uf-target-dense: ${tokens.targetDense};`);
  const durations = [
    ...Object.keys(tokens.duration).map((k) => `    --uf-duration-${k}: 0ms;`),
    ...Object.keys(tokens.motion).map((k) => `    --uf-motion-${kebab(k)}: 0;`),
  ].join('\n');
  return [
    '/* Generated from packages/tokens/src/index.ts by `pnpm --filter @universityflow/tokens generate`. Do not edit. */',
    ':root {',
    ...lines,
    '}',
    '@media (prefers-reduced-motion: reduce) {',
    '  :root {',
    durations,
    '  }',
    '}',
    '',
  ].join('\n');
}
