import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from '@/components/ui';
import { Icon, type IconName } from './icons';

/**
 * The split stage (docs/design/README.md): the front door and sign-in. A server component with no
 * JavaScript of its own, so the first screen never waits on any.
 *
 * - Left, sharp on the charcoal stage: the app's name, an uppercase headline, a short rule, a
 *   lead, and big numbers with two-line labels.
 * - Right, frosted: dark glass over decorative shapes (CSS, token colours); three quiet words and
 *   whatever the page puts there (tiles, or the sign-in card).
 * - Across the bottom, a huge wordmark crossing the split: the light ink on the charcoal, the pink
 *   accent on the glass.
 *   It is decoration and hidden from assistive tech: the headline carries the same meaning, so a
 *   screen reader hears it once. Two clipped copies draw the crossing.
 * - A frosted bar at the very bottom.
 *
 * Phones (from 360px) stack it: sharp on top, frosted below, the wordmark on the glass alone.
 * The entrance is a CSS fade and rise on load, off under reduced motion (globals.css).
 */

export interface StageNumber {
  readonly value: string;
  readonly label: string;
}

/** The pictures' entrance delays, bottom to top (the stage's own CSS fade and rise). */
const ENTRANCE = [undefined, 'uf-delay-1', 'uf-delay-2'] as const;

/** A picture of people on the stage: decorative, so it carries no words of its own. */
export interface StagePicture {
  readonly src: string;
  /** Smaller copies by width, so a screen fetches the smallest that stays sharp. */
  readonly srcSet?: string;
  readonly width: number;
  readonly height: number;
}

/**
 * How wide a picture shows at most (globals.css `.uf-stage-people`, the token `shape.stagePeople`):
 * 17vw from 64rem, at most 19rem (from about 112rem); narrower when the room above the wordmark
 * is short. Below 64rem the column is hidden, and `loading="lazy"` keeps a phone from fetching it.
 */
const PEOPLE_SIZES = '(min-width: 112rem) 19rem, 17vw';

export interface StageTile {
  readonly href: string;
  readonly label: string;
  readonly icon: IconName;
}

export function SplitStage({
  appName,
  headline,
  headlineLevel,
  lead,
  numbers,
  quietWords,
  wordmark,
  strapline,
  frost,
  sharpExtra,
  bar,
  people,
}: {
  appName: string;
  headline: string;
  /** `h1` on the front door; `p` on sign-in, where the form's own heading is the page's h1. */
  headlineLevel: 'h1' | 'p';
  lead?: string;
  numbers?: { readonly label: string; readonly items: ReadonlyArray<StageNumber> };
  quietWords: ReadonlyArray<string>;
  wordmark: string;
  strapline: string;
  /** The frosted half's content. */
  frost: ReactNode;
  /** More for the sharp half, after the numbers. */
  sharpExtra?: ReactNode;
  bar?: ReactNode;
  /**
   * The journey in pictures, bottom to top (Grade 10, university, graduation): a column across the
   * split, behind every word, taking no room, so the layout is the same with or without it.
   */
  people?: ReadonlyArray<StagePicture>;
}) {
  const Headline = headlineLevel;
  return (
    <main
      id="main"
      className={cx('uf-stage', !!people?.length && 'uf-stage-with-people')}
      data-testid="split-stage"
    >
      <div className="uf-stage-sharp">
        <p className="text-lg font-bold">{appName}</p>
        <Headline className="uf-headline uf-rise">{headline}</Headline>
        <hr className="uf-rule uf-fade-rise uf-delay-1" />
        {lead ? <p className="uf-fade-rise uf-delay-1 max-w-prose text-muted">{lead}</p> : null}
        {numbers ? <StageNumbers {...numbers} /> : null}
        {sharpExtra}
      </div>

      <div className="uf-stage-ground" aria-hidden="true">
        <div className="uf-stage-shape uf-stage-shape-figure" />
        <div className="uf-stage-shape uf-stage-shape-glow" />
        <div className="uf-stage-shape uf-stage-shape-shade" />
        <div className="uf-glass" />
      </div>

      {people?.length ? (
        <div className="uf-stage-people" aria-hidden="true" data-testid="stage-people">
          {people.map((p, i) => (
            // biome-ignore lint/performance/noImgElement: small static WebPs; no optimiser needed
            <img
              key={p.src}
              src={p.src}
              srcSet={p.srcSet}
              sizes={p.srcSet ? PEOPLE_SIZES : undefined}
              width={p.width}
              height={p.height}
              alt=""
              decoding="async"
              // Hidden on phones (never fetched there); behind the words everywhere else.
              loading="lazy"
              fetchPriority="low"
              // Bottom to top on arrival: Grade 10 first, then university, then graduation.
              className={cx('uf-person', `uf-person-${i}`, 'uf-fade-rise', ENTRANCE[i])}
            />
          ))}
        </div>
      ) : null}

      <div className="uf-stage-frost uf-on-glass">
        <p className="uf-caps uf-fade-rise flex flex-wrap justify-end gap-3 text-on-glass-muted">
          {quietWords.map((word) => (
            <span key={word}>{word}</span>
          ))}
        </p>
        {frost}
      </div>

      <div className="uf-wordmark" aria-hidden="true" data-testid="wordmark">
        {(['sharp', 'frost'] as const).map((side) => (
          <div key={side} className={cx('uf-wordmark-copy', `uf-wordmark-${side}`)}>
            <span className="uf-wordmark-word">{wordmark}</span>
            <span className="uf-wordmark-strap">{strapline}</span>
          </div>
        ))}
      </div>

      {bar ? <div className="uf-stage-bar uf-fade-rise uf-delay-2">{bar}</div> : null}
    </main>
  );
}

function StageNumbers({ label, items }: { label: string; items: ReadonlyArray<StageNumber> }) {
  return (
    <section aria-labelledby="stage-numbers" className="uf-fade-rise uf-delay-2">
      <h2 id="stage-numbers" className="sr-only">
        {label}
      </h2>
      <ul className="flex flex-wrap gap-x-7 gap-y-4">
        {items.map((n) => (
          <li key={n.label} className="flex items-center gap-3">
            <span className="uf-number">{n.value}</span>
            <span className="max-w-32 text-sm leading-tight text-muted">{n.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * A row of square icon tiles with uppercase captions: each tile is one link, captioned by the
 * feature it shows. Every tile leads to the same way in, so its name says so after the caption
 * (`where`, for screen readers: A3-27, WCAG 2.4.4): "Your results: Get started", never four links
 * that each read as a feature and all open sign-in. A tile lifts on hover by the tokens' `lift`,
 * and not at all under reduced motion (A2-25).
 */
export function StageTiles({
  title,
  where,
  tiles,
}: {
  title: string;
  /** Where every tile leads, said after its caption (the bar's own button words). */
  where: string;
  tiles: ReadonlyArray<StageTile>;
}) {
  return (
    <section aria-labelledby="stage-tiles" className="uf-fade-rise uf-delay-1 flex flex-col gap-3">
      <h2 id="stage-tiles" className="uf-caps text-on-glass">
        {title}
      </h2>
      {/* Two by two on a laptop under 90rem, where the front door's pictures take part of the
          glass (globals.css, landing-people). */}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:max-[90rem]:grid-cols-2">
        {tiles.map((t) => (
          <li key={t.label}>
            <Link
              href={t.href}
              className="group flex min-h-11 flex-col items-center gap-2 rounded-md p-1 text-center text-on-glass no-underline"
            >
              <span className="flex aspect-square w-full max-w-20 items-center justify-center rounded-lg border border-line bg-surface transition-transform group-hover:-translate-y-(--uf-motion-lift) motion-reduce:group-hover:translate-y-0">
                <Icon name={t.icon} className="size-7" />
              </span>
              <span className="uf-caps group-hover:underline">{t.label}</span>
              <span className="sr-only">: {where}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The frosted bar: icon-and-text items split by a divider, then the actions. */
export function StageBar({
  label,
  items,
  actions,
}: {
  label: string;
  /** `detail`: a smaller second line under the item's text. */
  items: ReadonlyArray<{
    readonly icon: IconName;
    readonly text: string;
    readonly detail?: string;
  }>;
  actions?: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className="uf-glass-card flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6 sm:py-3"
    >
      <ul className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-0">
        {items.map((item, index) => (
          <li
            key={item.text}
            className={cx(
              'flex items-center gap-3 sm:px-5',
              index > 0 && 'sm:border-l sm:border-line-strong',
              index === 0 && 'sm:pl-0',
            )}
          >
            <Icon name={item.icon} className="size-6 shrink-0 text-brand" />
            {item.detail ? (
              <span className="flex flex-col">
                <span className="font-medium">{item.text}</span>
                <span className="text-sm">{item.detail}</span>
              </span>
            ) : (
              <span className="font-medium">{item.text}</span>
            )}
          </li>
        ))}
      </ul>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </section>
  );
}
