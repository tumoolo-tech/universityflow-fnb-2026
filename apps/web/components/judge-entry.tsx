import { demoSignup as copy } from '@universityflow/content';
import { useId } from 'react';
import { ButtonLink } from './ui';

/**
 * "Demo for judges" on the landing page (the owner's switch between the main site and the demo,
 * 2026-10-23, docs/deploy/demo.md). On the main site, a link to the demo deployment
 * (NEXT_PUBLIC_UF_DEMO_URL), which carries no session and no data across; on the demo, the way to
 * its picker (`/demo`), and back to a judge's learner when they are on one. Static, no motion.
 */
export function JudgeEntry({
  href,
  external = false,
  backToLearner = false,
}: {
  href: string;
  /** Another site (the demo deployment): opens apart, with no handle on this page. */
  external?: boolean;
  /** A judge already on a learner: a way back to them too. */
  backToLearner?: boolean;
}) {
  const id = useId();
  // A small button in the landing page's bar (the owner, 2026-10-23: "a small button for demo or
  // switch"), its lead read as the button's description rather than shown as a card.
  return (
    <nav aria-label={copy.judgeEntryTitle} className="flex flex-wrap items-center gap-2">
      <span id={id} className="sr-only">
        {copy.judgeEntryLead}
      </span>
      <ButtonLink href={href} variant="secondary" newTab={external} aria-describedby={id}>
        {copy.judgeEntryTitle}
      </ButtonLink>
      {backToLearner ? (
        <ButtonLink href="/home" variant="quiet">
          {copy.backToYourLearner}
        </ButtonLink>
      ) : null}
    </nav>
  );
}
