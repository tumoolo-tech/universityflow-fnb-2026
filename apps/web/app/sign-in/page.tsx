import { en } from '@universityflow/content';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SiteFooter } from '@/components/site-footer';
import { SplitStage } from '@/components/split-stage';
import { ButtonLink, Card, Page, PublicPage } from '@/components/ui';
import { DEMO_PHONE_SIGNUP_PATH, demoPhoneSignupOn } from '@/lib/demo-phone-signup';
import { demoSignupOrNull } from '@/lib/demo-signup';
import { signedInOrRefused } from '@/lib/server/demo/entry';
import { isDemo } from '@/lib/server/deployment';
import { pageMetadata } from '@/lib/server/seo';
import { SignInForm } from './sign-in-form';

export const dynamic = 'force-dynamic';
/**
 * In judge demo mode there is no phone sign-in, so the title says what the page offers: the ways
 * in, a title of its own beside the picker's (A6-04).
 */
export function generateMetadata(): Metadata {
  return isDemo()
    ? pageMetadata({
        path: '/sign-in',
        title: en.demo.signInPageTitle,
        description: en.demo.description,
      })
    : pageMetadata({ path: '/sign-in', title: en.auth.title, description: en.auth.description });
}

/**
 * Sign-in on the split stage: the headline and wordmark on the left, the form on the frosted half
 * as a glass card (its own heading is the page's h1). The form's behaviour is unchanged. In judge
 * demo mode (docs/deploy/demo.md) there is no phone sign-in: the ways in instead, the picker of
 * made-up learners (`/demo`) and, when it is on, the judges' real sign-up (`/demo/sign-up`).
 */
export default async function SignInPage() {
  if (await signedInOrRefused()) redirect('/home');
  if (isDemo()) {
    const copy = en.demoSignup;
    const signup = demoSignupOrNull(process.env);
    return (
      <>
        <PublicPage brand={{ name: en.app.name, href: '/' }}>
          <Page title={en.demo.signInTitle} lead={copy.signInLead}>
            <p>{copy.landingDemoLine}</p>
            {/* One card per way in, each a sentence and its button (the button keeps its width). */}
            {signup ? (
              <Card as="div" className="flex flex-col items-start gap-3">
                <p>{copy.ownAccountLead}</p>
                <ButtonLink href="/demo/sign-up">{copy.ownAccountAction}</ButtonLink>
              </Card>
            ) : null}
            <Card as="div" className="flex flex-col items-start gap-3">
              <p>{copy.pickerActionLead}</p>
              <ButtonLink href="/demo" variant={signup ? 'secondary' : 'primary'}>
                {copy.pickerAction}
              </ButtonLink>
            </Card>
            {demoPhoneSignupOn(process.env) ? (
              // The on-screen phone sign-up on made-up 080 numbers (a hackathon exception).
              <Card as="div" className="flex flex-col items-start gap-3">
                <p>{en.demoPhoneSignup.actionLead}</p>
                <ButtonLink href={DEMO_PHONE_SIGNUP_PATH} variant="secondary">
                  {en.demoPhoneSignup.action}
                </ButtonLink>
              </Card>
            ) : null}
          </Page>
        </PublicPage>
        <SiteFooter width="prose" />
      </>
    );
  }
  return (
    <>
      <SplitStage
        appName={en.app.name}
        headline={en.home.headline}
        headlineLevel="p"
        lead={en.home.lead}
        quietWords={en.home.quietWords}
        wordmark={en.home.wordmark}
        strapline={en.home.strapline}
        frost={
          <div className="flex flex-1 flex-col justify-center">
            <div className="uf-glass-card uf-fade-rise mx-auto w-full max-w-form p-5 sm:p-7">
              <SignInForm />
            </div>
          </div>
        }
      />
      <SiteFooter />
    </>
  );
}
