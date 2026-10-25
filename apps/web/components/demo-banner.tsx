import { colleges, demo as copy, demoSignup } from '@universityflow/content';
import { DEMO_LOGOS_ON } from '@/lib/demo-logos';
import { httpsUrlOrNull } from '@/lib/demo-signup';

/**
 * On every page of judge demo mode (UF_DEPLOYMENT=demo, docs/deploy/demo.md): made-up learners
 * only, and "Switch learner", which deletes this copy and goes back to the picker. A plain form,
 * so it works before any script loads. Static, no motion.
 *
 * Beside it, "Back to UniversityFlow" (the owner's switch between the main site and the demo,
 * 2026-10-23): the main site's landing page when NEXT_PUBLIC_UF_MAIN_URL names it, else this
 * deployment's own `/`. It keeps the judge's copy (it lasts its 24 hours; "Switch learner" is the
 * button that deletes it).
 */
/**
 * The landing page is the main one (the owner, 2026-10-23): on a demo it shows no banner, only its
 * small "Demo for judges" button; every other page carries the banner. An unknown path shows it.
 */
export function bannerOnPath(path: string | null): boolean {
  return path !== '/';
}

export function DemoBanner({
  demo,
  learner = false,
  mainUrl = httpsUrlOrNull(process.env, 'NEXT_PUBLIC_UF_MAIN_URL'),
  logos = DEMO_LOGOS_ON,
}: {
  demo: boolean;
  /**
   * A learner is signed in (the root layout asks the session): only then is there one to switch
   * from, so only then is "Switch learner" there (A2-67).
   */
  learner?: boolean;
  /** The main site, or null: this deployment's landing page. */
  mainUrl?: string | null;
  /** The demo shows the universities' logos (lib/demo-logos.ts): say they are for the demo only. */
  logos?: boolean;
}) {
  if (!demo) return null;
  // One look for both actions (the link took the link pink, the button the ink): ink on the
  // warning ground is a tested pair (TEXT_PAIRS ink on warningSoft); brand on it was not.
  const action =
    'inline-flex min-h-11 items-center px-2 font-semibold text-ink underline underline-offset-4 hover:decoration-2';
  return (
    <div
      role="note"
      aria-label={copy.bannerLabel}
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b border-warning bg-warning-soft px-4 py-2 text-center text-sm text-ink"
    >
      <p>{copy.bannerNotice}</p>
      {logos ? <p>{copy.logosNotice}</p> : null}
      {logos ? <p>{colleges.demoLogosNotice}</p> : null}
      {learner ? (
        <form action="/api/demo/switch" method="post">
          <button type="submit" className={action}>
            {copy.switchLearner}
          </button>
        </form>
      ) : null}
      <a href={mainUrl ?? '/'} className={action}>
        {demoSignup.backToMain}
      </a>
    </div>
  );
}
