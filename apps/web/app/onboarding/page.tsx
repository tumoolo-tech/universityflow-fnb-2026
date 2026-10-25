import { en } from '@universityflow/content';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PublicPage } from '@/components/ui';
import { demoPhoneSignupOn } from '@/lib/demo-phone-signup';
import { demoSignupOrNull } from '@/lib/demo-signup';
import { isDemo } from '@/lib/server/deployment';
import { goalOptions } from '@/lib/server/goals';
import { getServices } from '@/lib/server/services';
import { currentStudent, isReady } from '@/lib/server/session';
import { demoPhoneWords } from '../demo/new-learner/words';
import { OnboardingSteps, type Step } from './steps';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: en.onboarding.dobTitle };

/**
 * Sign-up in the order POPIA needs: date of birth first; for a minor, a guardian's consent
 * before anything else is collected (planning.md §8.1); then the profile.
 */
export default async function OnboardingPage() {
  const signed = await currentStudent();
  if (!signed) redirect('/sign-in');
  const { account, student } = signed;

  let step: Step;
  if (account.consentStatus === 'unknown') step = 'dob';
  else if (account.consentStatus === 'pending') step = 'guardian';
  else if (account.consentStatus === 'withdrawn') step = 'withdrawn';
  // An adult agrees in their own name (A7-04), or again at 18 after a guardian's consent (§8.1).
  else if (account.needsAdultConsent) {
    step = account.consentStatus === 'granted' ? 'adult-turned-18' : 'adult';
  } else step = 'profile';

  // The profile is personal data: read it only when the database will allow it (A1-10).
  if (step === 'profile' && isReady(account) && (await student.mayProcess())) {
    const profile = await student.profile();
    if (profile?.grade) redirect('/home');
  }

  return (
    <PublicPage brand={{ name: en.app.name }}>
      <OnboardingSteps
        step={step}
        courses={goalOptions((await getServices()).catalogue())}
        careWords={en.planMaps.care}
        // The judge demo's real sign-up is adults only (a hackathon exception).
        adultsOnly={
          isDemo() && demoSignupOrNull(process.env)
            ? { message: en.demoSignup.adultsOnly, action: en.demoSignup.adultsOnlyAction }
            : undefined
        }
        // The judge demo's on-screen phone sign-up (a hackathon exception): its accounts only,
        // never a judge's own (Firebase) account, which keeps its 30 days and real details.
        demoPhone={
          isDemo() &&
          demoPhoneSignupOn(process.env) &&
          !(await (await getServices()).store.isDemoSignup(signed.studentId))
            ? demoPhoneWords()
            : undefined
        }
      />
    </PublicPage>
  );
}
