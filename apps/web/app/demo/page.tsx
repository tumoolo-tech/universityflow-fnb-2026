import { demo as demoCopy, demoPhoneSignup, demoSignup, en } from '@universityflow/content';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DemoPicker, demoStatus } from '@/components/demo-picker';
import { SiteFooter } from '@/components/site-footer';
import { ButtonLink } from '@/components/ui';
import { DEMO_PHONE_SIGNUP_PATH, demoPhoneSignupOn } from '@/lib/demo-phone-signup';
import { demoSignupOrNull } from '@/lib/demo-signup';
import { demoConfigRefusal } from '@/lib/server/demo/entry';
import { DEMO_PERSONAS } from '@/lib/server/demo/personas';
import { isDemo } from '@/lib/server/deployment';
import { pageMetadata } from '@/lib/server/seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = pageMetadata({
  path: '/demo',
  title: demoCopy.signInTitle,
  description: demoCopy.description,
});

/**
 * The judge demo's picker (docs/deploy/demo.md): "Try UniversityFlow as…" and the six made-up
 * learners. Its own route since the owner made `/` the real landing page (2026-10-23); not found
 * anywhere but a demo. When the judges' real sign-up is on, a line points to it too.
 */
export default async function DemoPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  if (!isDemo()) notFound();
  // A configuration the server refuses: said before a judge presses anything (the log says why).
  const refused = demoConfigRefusal();
  const signup = refused ? null : demoSignupOrNull(process.env);
  // The on-screen phone sign-up on made-up 080 numbers (a hackathon exception), when it is on.
  const phoneSignup = !refused && demoPhoneSignupOn(process.env);
  const status = refused ? 'setup' : demoStatus((await searchParams)?.['demo']);
  return (
    <>
      <DemoPicker personas={DEMO_PERSONAS} status={status} brand={{ name: en.app.name, href: '/' }}>
        {signup ? (
          <aside className="flex flex-wrap items-center gap-3">
            <p>{demoSignup.pickerSignupLine}</p>
            <ButtonLink href="/demo/sign-up" variant="secondary">
              {demoSignup.pickerSignupAction}
            </ButtonLink>
          </aside>
        ) : null}
        {phoneSignup ? (
          <aside className="flex flex-wrap items-center gap-3">
            <p>{demoPhoneSignup.pickerLine}</p>
            <ButtonLink href={DEMO_PHONE_SIGNUP_PATH} variant="secondary">
              {demoPhoneSignup.action}
            </ButtonLink>
          </aside>
        ) : null}
      </DemoPicker>
      <SiteFooter width="wide" />
    </>
  );
}
