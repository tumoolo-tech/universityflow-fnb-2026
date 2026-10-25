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
    // biome-ignore lint/performance/noImgElement: a small static file, no optimisation needed
    return <img className="uf-university-logo" src={logo} alt={alt} />;
  }
  const demoLogo = demoLogos?.[name];
  if (demoLogo) {
    // The judge demo only (lib/demo-logos.ts): the university's own logo on a chip it shows on.
    return (
      <span className="uf-demo-logo" data-backing={demoLogo.backing}>
        {/* biome-ignore lint/performance/noImgElement: a small static file, no optimisation needed */}
        <img src={demoLogo.src} alt={alt} />
      </span>
    );
  }
  return alone ? (
    <span className="uf-university-mark" data-monogram={monogram} role="img" aria-label={name} />
  ) : (
    <span className="uf-university-mark" data-monogram={monogram} aria-hidden="true" />
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
