/**
 * `en.demoSignup`: the judge demo's real sign-up, a HACKATHON EXCEPTION the owner approved on
 * 2026-10-23 ("build the Firebase real sign-up for the judge demo, 18+ only, accounts deleted
 * after 30 days"; docs/deploy/demo.md), and the switch between the main site and the demo. Every
 * word here is owed the owner's wording review; the notice has had no legal review.
 */
export const demoSignup = {
  /** The landing page's entry to the demo (the main site, and the demo's own landing page). */
  judgeEntryTitle: 'Demo for judges',
  judgeEntryLead:
    'See every stage, from Grade 10 to final-year university, with six made-up learners.',
  judgeEntryAction: 'Open the judges’ demo',
  /** On the demo's landing page, for a judge already on a learner. */
  backToYourLearner: 'Back to your learner',

  /** In the demo banner, beside "Switch learner": back to the main site's landing page. */
  backToMain: 'Back to UniversityFlow',

  /** /sign-in on the demo: the two ways in. */
  signInLead: 'Choose how you’d like to look around.',
  ownAccountAction: 'Sign up or sign in with your own account',
  ownAccountLead: 'For adults (18 and over), with an email link or Google.',
  pickerAction: 'Try a made-up learner',
  pickerActionLead: 'No sign-up: pick one of six learners and explore.',

  /** The picker's line pointing to the real sign-up, when it is switched on. */
  pickerSignupLine: 'Judges aged 18 or older can also use their own account.',
  pickerSignupAction: 'Sign up with your own account',

  /** The sign-up page. */
  pageTitle: 'Sign up for the judges’ demo',
  title: 'Sign up for the judges’ demo',
  noticeTitle: 'Before you sign up',
  noticePoints: [
    'This sign-up is for the hackathon judging only. It is not the real UniversityFlow service yet.',
    'Adults only: you must be 18 or older. Use your own details, never someone else’s.',
    'We keep your email address and a sign-in id, and what you type into the demo, in the demo’s own database.',
    'Google Firebase handles the sign-in itself: the email link, or your Google account.',
    'Your account and everything in it is deleted 30 days after you sign up.',
    'Please don’t upload real documents: the demo takes only our SAMPLE reports.',
  ],
  agreeLabel: 'I am 18 or older, these are my own details, and I have read this notice.',
  agreeFirst: 'Tick the box first.',
  emailLabel: 'Your email address',
  sendLink: 'Email me a sign-in link',
  or: 'or',
  google: 'Continue with Google',
  linkSent: 'Check your email: we sent you a sign-in link. Open it on this device.',
  confirmEmailLead: 'To finish, type the email address the link was sent to.',
  finish: 'Finish signing in',
  working: 'Signing you in…',
  failed: 'That didn’t work. Try again, or try a made-up learner instead.',
  unavailable: 'Sign-up isn’t available right now. Try a made-up learner instead.',
  /** The local stand-in (UF_DEMO_SIGNUP=fake): no Firebase, no email. */
  fakeNote: 'Local test sign-up: no Firebase, and no email is sent.',
  fakeAction: 'Sign in (local test)',

  /** A date of birth under 18 on a sign-up account: refused, and the account deleted. */
  adultsOnly:
    'This demo sign-up is for adults (18 and over), so we have deleted the account and everything in it. You can still try the made-up learners.',
  adultsOnlyAction: 'Try a made-up learner',

  /**
   * The demo's ways in (the owner, 2026-10-23, late): on the demo's landing page and /sign-in, one
   * plain sentence, so nobody thinks they are signing up for the real service.
   */
  landingDemoLine:
    'This is the judges’ demo of UniversityFlow: every learner in it is made up, and it is not the real service yet.',
  /** The sign-up form: the browser blocked Google's sign-in pop-up. */
  popupBlocked:
    'Your browser blocked Google’s sign-in pop-up. Allow pop-ups for this site and try again, or use the email link.',
  /** The sign-up form: Firebase refused the address as written. */
  invalidEmail: 'Check your email address and try again.',
  /** The sign-up page's search and share description (A6-04, wave 10). Owed the owner's review. */
  pageDescription:
    'Judges aged 18 or older can sign up for the demo with an email link or Google. It is for the hackathon judging only, and not the real service yet.',
} as const;
