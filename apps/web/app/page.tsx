import { en } from '@universityflow/content';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { JudgeEntry } from '@/components/judge-entry';
import { SiteFooter } from '@/components/site-footer';
import { SplitStage, StageBar, StageTiles } from '@/components/split-stage';
import { ButtonLink } from '@/components/ui';
import { DEMO_PHONE_SIGNUP_PATH, demoPhoneSignupOn } from '@/lib/demo-phone-signup';
import { demoSignupOrNull, httpsUrlOrNull } from '@/lib/demo-signup';
import { signedInOrRefused } from '@/lib/server/demo/entry';
import { isDemo } from '@/lib/server/deployment';

export const dynamic = 'force-dynamic';

/**
 * The journey in pictures, bottom to top: Grade 10, university, graduation (public/stage). Each
 * has 360 and 540 px copies so a screen fetches the smallest that stays sharp.
 */
const stagePicture = (name: string, width: number, height: number) => ({
  src: `/stage/${name}.webp`,
  srcSet: `/stage/${name}-360.webp 360w, /stage/${name}-540.webp 540w, /stage/${name}.webp ${width}w`,
  width,
  height,
});
const STAGE_PEOPLE = [
  stagePicture('grade-10', 720, 527),
  stagePicture('university', 720, 497),
  stagePicture('graduation', 720, 735),
];

/**
 * The front door, on the split stage. A signed-in learner goes straight to their home.
 *
 * The switch between the main site and the judge demo (the owner, 2026-10-23,
 * docs/deploy/demo.md): with NEXT_PUBLIC_UF_DEMO_URL set, the main site shows "Demo for judges",
 * a plain link to the demo deployment; otherwise nothing changes. On the demo, this is the same
 * landing page (a judge on a learner sees it too, to switch back), with the entry to the picker
 * at /demo; its ways in lead to the real sign-up when it is on, else to the picker.
 */
export default async function HomePage() {
  const demo = isDemo();
  const signedIn = await signedInOrRefused();
  if (signedIn && !demo) redirect('/home');
  const way = demo ? (demoSignupOrNull(process.env) ? '/demo/sign-up' : '/demo') : '/sign-in';
  const demoUrl = demo ? null : httpsUrlOrNull(process.env, 'NEXT_PUBLIC_UF_DEMO_URL');
  const judges = demo ? (
    <JudgeEntry href="/demo" backToLearner={signedIn} />
  ) : demoUrl ? (
    <JudgeEntry href={demoUrl} external />
  ) : null;
  const { home } = en;
  // On the demo, one plain sentence beside the ways in: made-up learners, not the real service.
  const demoLine = demo ? (
    <p className="max-w-prose text-sm font-medium">{en.demoSignup.landingDemoLine}</p>
  ) : null;
  // The demo's on-screen phone sign-up (a hackathon exception), beside the made-up learners.
  const newLearner =
    demo && demoPhoneSignupOn(process.env) ? (
      <ButtonLink href={DEMO_PHONE_SIGNUP_PATH} variant="secondary">
        {en.demoPhoneSignup.action}
      </ButtonLink>
    ) : null;
  const waysIn = (
    <>
      {judges}
      {newLearner}
      <ButtonLink href={way}>{home.start}</ButtonLink>
      <Link href={way} className="inline-flex min-h-11 items-center px-2">
        {home.signIn}
      </Link>
    </>
  );
  return (
    <>
      <SplitStage
        appName={en.app.name}
        headline={home.headline}
        headlineLevel="h1"
        lead={home.lead}
        numbers={{ label: home.numbersLabel, items: home.numbers }}
        quietWords={home.quietWords}
        wordmark={home.wordmark}
        strapline={home.strapline}
        people={STAGE_PEOPLE}
        sharpExtra={
          // On a phone the bar is a long scroll away: the first action is here too.
          demoLine ? (
            <div className="flex flex-col gap-3 lg:hidden">
              {demoLine}
              <div>
                <ButtonLink href={way}>{home.start}</ButtonLink>
              </div>
            </div>
          ) : (
            <div className="lg:hidden">
              <ButtonLink href={way}>{home.start}</ButtonLink>
            </div>
          )
        }
        frost={
          <div className="flex flex-1 flex-col justify-center gap-5">
            <p className="max-w-prose text-xl font-bold text-on-glass">{home.title}</p>
            <StageTiles
              title={home.tilesTitle}
              where={home.start}
              tiles={[
                { href: way, label: home.tiles.results, icon: 'results' },
                { href: way, label: home.tiles.applications, icon: 'applications' },
                { href: way, label: home.tiles.funding, icon: 'funding' },
                { href: way, label: home.tiles.campus, icon: 'campus' },
              ]}
            />
          </div>
        }
        bar={
          <StageBar
            label={home.barLabel}
            items={[
              { icon: 'heart', text: home.barFree },
              { icon: 'shield', text: home.barHere },
            ]}
            actions={
              demoLine ? (
                <div className="flex flex-col gap-2">
                  {demoLine}
                  <div className="flex flex-wrap items-center gap-3">{waysIn}</div>
                </div>
              ) : (
                waysIn
              )
            }
          />
        }
      />
      <SiteFooter />
    </>
  );
}
