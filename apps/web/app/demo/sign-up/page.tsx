import { demoSignup as copy, en } from '@universityflow/content';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { SiteFooter } from '@/components/site-footer';
import { Card, Page, PublicPage } from '@/components/ui';
import { demoSignupOrNull } from '@/lib/demo-signup';
import { demoConfigRefusal } from '@/lib/server/demo/entry';
import { isDemo } from '@/lib/server/deployment';
import { pageMetadata } from '@/lib/server/seo';
import { currentStudent } from '@/lib/server/session';
import { SignUpForm, type SignUpWords } from './signup-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = pageMetadata({
  path: '/demo/sign-up',
  title: copy.pageTitle,
  description: copy.pageDescription,
});

/**
 * The judges' real sign-up: a HACKATHON EXCEPTION the owner approved on 2026-10-23 ("build the
 * Firebase real sign-up for the judge demo, 18+ only, accounts deleted after 30 days";
 * docs/deploy/demo.md). Not found outside a demo; on a demo without UF_DEMO_SIGNUP, the picker.
 *
 * The plain notice comes first (what is stored, where, for how long, for whom; not the real service
 * yet), then an unticked box and the ways in. The only page whose CSP admits Firebase (proxy.ts),
 * and the only one that loads its SDK (signup-form.tsx, on demand). The Firebase web values are
 * read here on the server and handed to the form, so no other page carries them.
 */
export default async function SignUpPage() {
  if (!isDemo()) notFound();
  // On a demo, never a dead end: with the sign-up off, or a configuration the server refuses, the
  // made-up learners (whose picker says when the demo isn't set up yet).
  const setting = demoSignupOrNull(process.env);
  if (!setting || demoConfigRefusal()) redirect('/demo');
  if (await currentStudent()) redirect('/home');
  const words: SignUpWords = {
    agreeLabel: copy.agreeLabel,
    agreeFirst: copy.agreeFirst,
    emailLabel: copy.emailLabel,
    sendLink: copy.sendLink,
    or: copy.or,
    google: copy.google,
    linkSent: copy.linkSent,
    confirmEmailLead: copy.confirmEmailLead,
    finish: copy.finish,
    working: copy.working,
    failed: copy.failed,
    unavailable: copy.unavailable,
    fakeNote: copy.fakeNote,
    fakeAction: copy.fakeAction,
    pickerAction: copy.pickerAction,
    popupBlocked: copy.popupBlocked,
    invalidEmail: copy.invalidEmail,
  };
  return (
    <>
      <PublicPage brand={{ name: en.app.name, href: '/' }}>
        <Page title={copy.title}>
          <Card tone="warning" aria-labelledby="signup-notice" className="flex flex-col gap-3">
            <h2 id="signup-notice" className="text-lg">
              {copy.noticeTitle}
            </h2>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              {copy.noticePoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </Card>
          <SignUpForm
            mode={setting.mode}
            firebase={setting.mode === 'firebase' ? setting.firebase : null}
            words={words}
          />
        </Page>
      </PublicPage>
      <SiteFooter width="prose" />
    </>
  );
}
