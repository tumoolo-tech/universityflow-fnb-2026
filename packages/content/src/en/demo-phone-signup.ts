/**
 * `en.demoPhoneSignup`: the judge demo's on-screen phone sign-up, a HACKATHON EXCEPTION the owner
 * approved on 2026-10-24 (`UF_DEMO_PHONE_SIGNUP=onscreen`; docs/deploy/demo.md): judges go
 * through the real learner sign-up on made-up details. Only made-up 080 numbers, nothing is sent
 * (the PIN and a guardian's link are shown on screen), every account deleted after 24 hours.
 * Every word here is owed the owner's wording review; none has had a legal review.
 */
export const demoPhoneSignup = {
  /** The way in, on the landing page, the picker and /sign-in. */
  action: 'Sign up as a new learner (made-up details)',
  actionLead:
    'Go through the real sign-up yourself: a made-up 080 number, a PIN shown on screen, then every page a learner has.',
  pickerLine: 'Or see the real sign-up from the start, as a new learner, on made-up details.',

  /** The sign-up page. */
  pageTitle: 'Sign up as a new learner',
  noticeTitle: 'This is the judges’ demo',
  noticePoints: [
    'Use made-up details only: never your own name, number or ID number, or anyone else’s.',
    'Use a made-up number that starts with 080 (a toll-free number), never a cellphone number.',
    'Nothing is sent: there is no SMS. Your PIN, and an under-18’s link for their guardian, are shown on screen.',
    'The account and everything in it is deleted after 24 hours.',
  ],
  phoneLabel: 'A made-up 080 number',
  phoneHint: '10 digits, starting with 080. A cellphone number is refused.',
  /** The PIN, shown where it is typed, in place of the SMS. */
  pinOnScreenTitle: 'Your demo PIN',
  pinOnScreen: (pin: string) =>
    `${pin}. On the real UniversityFlow this comes by SMS; on the demo nothing is sent.`,
  /** Any number that isn't a made-up 080 one: the learner's or the guardian's. */
  only080:
    'On the demo, use a made-up number that starts with 080. Cellphone numbers are refused, so no real person is ever messaged.',

  /** Onboarding, on a demo sign-up account. */
  onboardingNotice:
    'Judges’ demo: made-up details only. Nothing is sent, and this account is deleted after 24 hours.',
  guardianPhoneHint: 'The made-up guardian’s number also starts with 080.',
  guardianLinkTitle: 'Nothing was sent: here is the guardian’s link',
  guardianLinkLead:
    'On the real UniversityFlow your parent or guardian gets this link by SMS. Open it, agree as the made-up guardian, then come back here and press Continue.',
  guardianLinkAction: 'Open the guardian’s link',
  /** A made-up 080 number another judge already made an account with: theirs, not shared. */
  numberTaken:
    'Someone has already signed up with that made-up number. Pick another made-up number that starts with 080.',
  /** The sign-up page's search and share description (A6-04, wave 10). Owed the owner's review. */
  pageDescription:
    'Go through the real learner sign-up on the judges’ demo, with made-up details and a made-up number that starts with 080. Nothing is sent to a phone.',
} as const;
