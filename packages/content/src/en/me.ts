/** `en.me`. */
export const me = {
  title: 'About me',
  lead: 'Everything UniversityFlow knows about you. You can change it, download it or delete it.',
  /**
   * The app's About me offers the card and deletion (A7-09; the owner's D5, 2026-10-22): the rest
   * is on the website. Owed the owner's wording review.
   */
  appLead:
    'Here you can make your card yours or delete your account. To see, change or download everything else UniversityFlow knows about you, sign in on the website and open About me.',
  profile: 'Profile',
  memory: 'Things you’ve told me to remember',
  memoryEmpty: 'Nothing yet.',
  forget: 'Forget this',
  export: 'Download my data',
  exportLead: 'A file with everything we hold about you, including who has accessed it.',
  deleteTitle: 'Delete my account',
  deleteLead: 'This deletes your account, marks, documents and chats for good. It can’t be undone.',
  deleteConfirm: 'Type DELETE to confirm',
  deleteButton: 'Delete everything',
  deleted: 'Your account has been deleted.',
  consentLabel: 'Consent',
  consentStatus: {
    unknown: 'Not set up yet',
    'not-required': 'You gave your own consent',
    pending: 'Waiting for a guardian',
    granted: 'Your guardian gave consent',
    withdrawn: 'Your guardian withdrew consent',
  },
  messages: {
    title: 'Reminders and messages',
    lead: 'Choose where UniversityFlow may send you reminders. Never at night, never during a paper, and never more than you choose. Other companies deliver them: an SMS company that sends texts for us, WhatsApp (owned by Meta), and for app notifications Expo, Apple and Google. WhatsApp, Meta, Expo, Apple and Google are outside South Africa.',
    stopHint: 'Reply STOP to any message to turn that channel off at once.',
    channelsLegend: 'Send me reminders by',
    onSince: (date: string) => `On since ${date}`,
    stoppedByStop: 'You turned this off by replying STOP.',
    pushLater: 'App notifications come with the UniversityFlow app.',
    notOffered: (channel: string) => `${channel} reminders aren’t available yet.`,
    pushInApp: 'Turn app notifications on or off in the UniversityFlow app, on your phone.',
    perWeek: 'Most messages in a week',
    perWeekOption: (n: number) => (n === 1 ? '1 a week' : `${n} a week`),
  },
} as const;
