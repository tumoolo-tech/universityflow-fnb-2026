/** `en.errors`. */
export const errors = {
  notFound: 'We couldn’t find that page.',
  generic: 'Something went wrong. Please try again.',
  signedOut: 'Please sign in again.',
  consent: 'A parent or guardian needs to agree before you can do this.',
  /** A minor's guardian agreed to consent wording older than v2, which didn't cover reminders. */
  consentOutdated:
    'Your parent or guardian agreed before reminders were part of UniversityFlow, so we can’t turn reminders on yet. They need to agree to the new wording first.',
  /**
   * A minor's guardian agreed to consent wording older than v3, which didn't cover offer letters
   * and proofs of registration (audit A11-13). Adding the offer or the modules by hand still works.
   */
  consentOutdatedDocuments:
    'Your parent or guardian agreed before UniversityFlow could read offer letters and proofs of registration, so we can’t read this one. They need to agree to the new wording first. Until then, you can add the details yourself.',
  smsUnavailable:
    'We can’t send SMS messages right now. Please try again a little later. Nothing is wrong with your number.',
  /** The guardian's number replied STOP to us (A12-04), so we can't send it the link. */
  guardianOptedOut:
    'That number has asked us not to send it any messages, so we can’t send the link there. Ask your parent or guardian for a different number, or ask another parent or guardian.',
  /** A date of birth under 13 (A11-24; the stores say 13 and over). Owed the owner's review. */
  tooYoung:
    'UniversityFlow is for learners aged 13 and over. If you typed your date of birth wrong, fix it and try again.',
  /** A report from a grade above the learner's (A1-35). Owed the owner's review. */
  reportAboveGrade:
    'That report is for a grade above yours. Choose the right report, or change your grade on About me.',
  offline: 'You’re offline. We’ll try again when you’re back.',
  /** The mobile app was built without a working server address (A7-05): not the learner's network. */
  appConfig:
    'This version of the app can’t connect to UniversityFlow. Please update the app. This isn’t a problem with your internet connection.',
} as const;
