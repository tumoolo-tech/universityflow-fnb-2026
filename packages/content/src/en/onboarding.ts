/** `en.onboarding`. */
export const onboarding = {
  dobTitle: 'When were you born?',
  dobLead:
    'We ask first because if you’re under 18, the law (POPIA) says a parent or guardian must agree before we keep anything else about you.',
  dobLabel: 'Date of birth',
  guardianTitle: 'A parent or guardian needs to say yes',
  guardianLead:
    'Because you’re under 18, we’ll send your parent or guardian an SMS with a link. Once they agree, you can start. We don’t keep anything else about you until then.',
  guardianName: 'Their name',
  guardianPhone: 'Their cellphone number',
  relationship: 'They are my',
  relationships: {
    parent: 'Parent',
    'legal-guardian': 'Legal guardian',
    'other-caregiver': 'Other caregiver',
  },
  sendRequest: 'Send them the link',
  waitingTitle: 'Waiting for your parent or guardian',
  waitingLead:
    'We sent them an SMS with a link. When they agree, refresh this page and you can start.',
  /** The mobile app's version of `waitingLead`: there is no page to refresh. */
  waitingLeadApp:
    'We sent them an SMS with a link. When they agree, tap “Check again” and you can start.',
  /** The guardian SMS waits for the morning: we don't message anyone at night (A12-04). */
  guardianQueued:
    'We don’t send messages at night, so your parent or guardian will get the SMS at 07:00.',
  checkAgain: 'Check again',
  stillWaiting: 'They haven’t agreed yet. Ask them to open the link in the SMS.',
  /** The mobile app types the date: there is no date picker without another native module. */
  dobHint: 'Year, month and day, like 2009-04-23',
  dobInvalid: 'Type your date of birth as year-month-day, like 2009-04-23.',
  resendRequest: 'Send the link again',
  withdrawnTitle: 'Your guardian has withdrawn consent',
  withdrawnLead:
    'We’ve stopped using your information. If this is a mistake, ask them to agree again, or send the link to someone else.',
  adultTitle: 'You’re 18 now',
  adultLead:
    'Your guardian agreed when you were under 18. Now that you’re an adult, we need your own permission to keep helping you.',
  adultDecline: 'I don’t agree',
  adultDeclined:
    'That’s your choice. Without your permission we won’t use your information, so we can’t help you. You can delete your account now, or sign out and come back if you change your mind.',
  profileTitle: 'Tell us a little about you',
  displayName: 'What should we call you?',
  displayNameHint: 'A first name or a nickname. You can change it later.',
  grade: 'Which grade are you in?',
  gradeOption: (grade: number) => `Grade ${grade}`,
  /** The app's grade step (G10-1): the one thing it asks after consent. */
  gradeLead: 'We move it up for you each new school year, and check with you in January.',
  school: 'Your school (optional)',
  province: 'Province',
  /** A dropdown: every course by university, or "I don't know yet" (owner's choice). */
  goal: 'What would you like to study?',
  goalHint: 'Courses are grouped by university. You can change this any time.',
  goalUnknown: 'I don’t know yet',
  /** The course as it is saved: "BEng Civil Engineering, University of Johannesburg". */
  goalValue: (course: string, university: string) => `${course}, ${university}`,
  finish: 'Start',
  smsToGuardian: (link: string) =>
    `A learner has asked you to let them use UniversityFlow, a free university-application helper. Read what it does and choose: ${link}`,
} as const;
