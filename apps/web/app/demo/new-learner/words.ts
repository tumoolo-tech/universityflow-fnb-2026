import { demoPhoneSignup as copy } from '@universityflow/content';

/**
 * The judge demo's on-screen phone sign-up (a hackathon exception, lib/demo-phone-signup.ts): the
 * words the sign-in form and onboarding need, read on the server and handed over as props, so
 * production's sign-in and onboarding pages carry none of them.
 */
export interface DemoPhoneWords {
  readonly phoneLabel: string;
  readonly phoneHint: string;
  readonly only080: string;
  readonly pinOnScreenTitle: string;
  /** The PIN line, with `{pin}` where the PIN goes (a function can't cross to the client). */
  readonly pinOnScreen: string;
  readonly onboardingNotice: string;
  readonly guardianPhoneHint: string;
  readonly guardianLinkTitle: string;
  readonly guardianLinkLead: string;
  readonly guardianLinkAction: string;
  /** A made-up 080 number another browser already made an account with. */
  readonly numberTaken: string;
}

/** Where the PIN goes in `pinOnScreen` (sign-in-form.tsx fills it in). */
const PIN = '{pin}';

export function demoPhoneWords(): DemoPhoneWords {
  return {
    phoneLabel: copy.phoneLabel,
    phoneHint: copy.phoneHint,
    only080: copy.only080,
    pinOnScreenTitle: copy.pinOnScreenTitle,
    pinOnScreen: copy.pinOnScreen(PIN),
    onboardingNotice: copy.onboardingNotice,
    guardianPhoneHint: copy.guardianPhoneHint,
    guardianLinkTitle: copy.guardianLinkTitle,
    guardianLinkLead: copy.guardianLinkLead,
    guardianLinkAction: copy.guardianLinkAction,
    numberTaken: copy.numberTaken,
  };
}
