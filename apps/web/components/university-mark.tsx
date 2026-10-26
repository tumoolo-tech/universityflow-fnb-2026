import { universityMark as words } from '@universityflow/content';
import { UNIVERSITY_LOGOS, universityMark } from '@universityflow/ui';
import { DEMO_LOGOS_ON, DEMO_UNIVERSITY_LOGOS, type DemoLogo } from '@/lib/demo-logos';

/**
 * The neutral university mark (the owner's decision, option A, 2026-10-23; packages/ui
 * university-mark.ts): our letters on a grey tile, never the university's logo or colours. Its
 * logo shows only from `UNIVERSITY_LOGOS`, the catalogue's written permissions (none today).
 *
 * No 'use client' and no hooks: it renders on the server and inside client components alike.
 * The letters are drawn by CSS from `data-monogram`, so they never enter the page's text: the
 * name beside them is read and copied once. Beside the name the mark is hidden from assistive
 * tech; `alone` names it by the university instead.
 */
export function UniversityMark({
  name,
  alone = false,
  logos = UNIVERSITY_LOGOS,
  demoLogos = DEMO_LOGOS_ON ? DEMO_UNIVERSITY_LOGOS : null,
}: {
  /** The university's short name, as the catalogue gives it ("Wits", "UJ"). */
  name: string;
  /** No name beside it: the mark is then an image named by the university. */
  alone?: boolean;
  /** For tests only: the permitted logos (defaults to the catalogue's). */
  logos?: Readonly<Record<string, string>>;
  /** For tests only: the judge demo's logos (defaults to them while the demo's switch is on). */
  demoLogos?: Readonly<Record<string, DemoLogo>> | null;
}) {
  const { monogram, logo } = universityMark(name, logos);
  const alt = alone ? words.logoAlt(name) : '';
  if (logo) {
    // A permitted logo, served from our own origin (apps/web/public/logos). Its size is the tile's.
    // Lazy and decoded off the main thread: a mark beside a name is never the first thing drawn.
    // biome-ignore lint/performance/noImgElement: a small static file, no optimisation needed
    return (
      <img className="uf-university-logo" src={logo} alt={alt} loading="lazy" decoding="async" />
    );
  }
  const demoLogo = demoLogos?.[name];
  if (demoLogo) {
    // The judge demo only (lib/demo-logos.ts): the university's own logo on a chip it shows on.
    return (
      <span className="uf-demo-logo" data-backing={demoLogo.backing}>
        <DemoLogoImage logo={demoLogo} alt={alt} />
      </span>
    );
  }
  return alone ? (
    <span className="uf-university-mark" data-monogram={monogram} role="img" aria-label={name} />
  ) : (
    <span className="uf-university-mark" data-monogram={monogram} aria-hidden="true" />
  );
}

/**
 * A demo logo's picture (A4-22): lazy, decoded off the main thread and fetched at low priority,
 * so React never preloads it and 37 logos on /results don't go ahead of the words; its file's
 * width and height, so the chip has its shape before the file arrives (no layout shift).
 */
export function DemoLogoImage({ logo, alt = '' }: { logo: DemoLogo; alt?: string }) {
  return (
    // biome-ignore lint/performance/noImgElement: a small static file, no optimisation needed
    <img
      src={logo.src}
      alt={alt}
      width={logo.width}
      height={logo.height}
      loading="lazy"
      decoding="async"
      fetchPriority="low"
    />
  );
}

/** A university's name with its mark before it: for a badge, a row or a heading. */
export function UniversityName({
  name,
  short,
}: {
  /** The name shown. */
  name: string;
  /** The short name the mark is drawn from, when `name` is the full one. */
  short?: string | undefined;
}) {
  return (
    <span className="uf-university">
      <UniversityMark name={short || name} />
      {name}
    </span>
  );
}
