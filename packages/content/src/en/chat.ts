/** `en.chat`. */
export const chat = {
  title: 'Chat',
  placeholder: 'Ask anything about your studies, applications or funding…',
  send: 'Send',
  sending: 'Thinking…',
  you: 'You',
  assistant: 'UniversityFlow',
  /** The empty conversation's hero: "Hi Sipho!" with the name in the accent colour. */
  heroHi: 'Hi',
  heroAsk: 'What shall we work on?',
  /** The companion's welcome under the hero, without its greeting (the hero says hello). */
  /** It says it is an AI first (A10-31); it promises no applications to a Grade 10 learner (A10-36). */
  welcomeLead:
    'I’m UniversityFlow’s AI companion, not a person. How are you doing? When you’re ready, upload your latest school report and I’ll show you the courses your marks reach.',
  /** One short line under each starter, in the same order. */
  starterNotes: [
    'Every course your confirmed marks reach, by university',
    'The dates for the universities you’re looking at',
    'Who qualifies, what it covers and how to apply',
    'Documents, fees and a checklist for each application',
  ],
  /** The scrolling list of messages, named for keyboard and screen-reader users. */
  conversation: 'Conversation',
  /** The starter cards' list, named on its own (it shared the page's name, A3-25). */
  startersLabel: 'Questions to start with',
  welcome: (name: string | null) =>
    `${name ? `Hi ${name}! ` : 'Hi! '}I’m UniversityFlow’s AI companion, not a person. How are you doing? When you’re ready, upload your latest school report and I’ll show you the courses your marks reach.`,
  starters: [
    'What can I study with my marks?',
    'When do applications close?',
    'How does NSFAS work?',
    'What do I need for my applications?',
  ],
  sampleModel:
    'Local stand-in: no AI is connected, so replies come from a simple script. Your marks and results are calculated for real.',
  /** Under the composer in a preview, in place of the disclaimer: the preview notice is hidden on the chat. */
  sampleLine: 'Preview: no AI is connected, so replies come from a simple script.',
  error: 'I couldn’t answer that just now. Please try again.',
  artifactOpen: 'Open',
  /** The mobile app shows each artifact as a summary card for now. */
  artifactOnWeb: 'Open UniversityFlow on the web for the full details.',
  artifactCount: (n: number) => (n === 1 ? '1 item' : `${n} items`),
  /** Under the message box, always on screen: that it is an AI (A10-31), and that it can err. */
  disclaimer:
    'You’re chatting with an AI, not a person. It can make mistakes. Admission facts come from each university’s official documents.',
  /** "Report this reply" under each AI reply (A10-35). Owed the owner's review. */
  report: {
    open: 'Report this reply',
    question: 'What’s wrong with it?',
    /** One for each of REPLY_REPORT_REASONS. */
    reasons: {
      harmful: 'It’s harmful or upsetting',
      wrong: 'The information is wrong',
      other: 'Something else',
    },
    send: 'Send report',
    cancel: 'Cancel',
    sent: 'Thanks. A person at UniversityFlow will look at it.',
    /** After "harmful or upsetting": where to find someone now. */
    helpLead: 'If you need someone to talk to now:',
    help: 'Get help',
    reported: 'Reported',
    error: 'We couldn’t send your report. Please try again.',
  },
  /**
   * The welcome at university (A2-66, packages/ui `chatWelcome`): a school report means nothing
   * there. Arriving: a first year, or a place accepted; later years: a second or final year. It
   * says it is an AI first (A10-31). New wording (2026-10-24), owed the owner's review.
   */
  welcomeLeadArriving:
    'I’m UniversityFlow’s AI companion, not a person. How are you doing? When you’re ready, ask me about your first weeks, your campus or the modules you register for.',
  welcomeLeadLaterYears:
    'I’m UniversityFlow’s AI companion, not a person. How are you doing? When you’re ready, ask me about your modules, your campus or where to find help at your university.',
  /** The starters at university, each with its note under it, in the same order. */
  startersUniversity: [
    'Are my registered modules right?',
    'Where do I go on campus for help?',
    'How does NSFAS work?',
    'What should I do next?',
  ],
  starterNotesUniversity: [
    'Your modules checked against your curriculum',
    'Clinics, safety and the offices that can help',
    'Who qualifies, what it covers and how to apply',
    'One next step, from what you’ve told me',
  ],
} as const;
