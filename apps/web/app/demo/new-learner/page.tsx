import { demoPhoneSignup as copy, en } from '@universityflow/content';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { SiteFooter } from '@/components/site-footer';
import { Card, Page, PublicPage } from '@/components/ui';
import { demoPhoneSignupOn } from '@/lib/demo-phone-signup';
import { demoConfigRefusal } from '@/lib/server/demo/entry';
import { isDemo } from '@/lib/server/deployment';
import { pageMetadata } from '@/lib/server/seo';
import { SignInForm } from '../../sign-in/sign-in-form';
import { demoPhoneWords } from './words';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  ...pageMetadata({
    path: '/demo/new-learner',
    title: copy.pageTitle,
    description: copy.pageDescription,
  }),
  robots: { index: false },
};

/**
 * The judge demo's on-screen phone sign-up: a HACKATHON EXCEPTION the owner approved on
 * 2026-10-24 (`UF_DEMO_PHONE_SIGNUP=onscreen`, lib/demo-phone-signup.ts, docs/deploy/demo.md).
 * Judges sign up as a new learner the way a real learner does, on made-up details: the notice
 * first (made-up details, an 080 number, nothing sent, deleted after 24 hours), then the real
 * phone form, whose PIN is shown where it is typed. Then the real onboarding and home.
 *
 * Not found outside a demo, or on a demo with the switch off; on a demo whose configuration the
 * server refuses, the picker (which says the demo isn't set up yet).
 */
export default async function NewLearnerPage() {
  if (!isDemo() || !demoPhoneSignupOn(process.env)) notFound();
  if (demoConfigRefusal()) redirect('/demo');
  return (
    <>
      <PublicPage brand={{ name: en.app.name, href: '/' }}>
        <Page title={copy.pageTitle}>
          <Card tone="warning" aria-labelledby="new-learner-notice" className="flex flex-col gap-3">
            <h2 id="new-learner-notice" className="text-lg">
              {copy.noticeTitle}
            </h2>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              {copy.noticePoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </Card>
          <Card as="div">
            <SignInForm demo={demoPhoneWords()} />
          </Card>
        </Page>
      </PublicPage>
      <SiteFooter width="prose" />
    </>
  );
}
