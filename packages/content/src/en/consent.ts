/** `en.consent`. */
export const consent = {
  title: 'A learner has asked for your permission',
  lead: (relationship: string) =>
    `A learner who named you as their ${relationship} wants to use UniversityFlow. Because they are under 18, the law (POPIA) says we need your permission first.`,
  learnerNumber: (masked: string) => `The learner’s number ends in ${masked.slice(-3)}.`,
  whatWeDoTitle: 'What UniversityFlow does',
  whatWeDo: [
    'Reads the learner’s school report (after they check every mark) and shows which university courses they qualify for.',
    'Reads an offer letter or proof of registration the learner uploads (after they check every detail), to keep track of their university offers and the modules they are registered for.',
    'Helps them with application deadlines, documents and NSFAS funding.',
    'Chats with them about their goals and studies. If they seem to be in distress, it gives them helpline numbers.',
    'Sends them reminders about deadlines and exams by SMS, WhatsApp or app notification, but only the ones they turn on. They can turn each one off at any time, or reply STOP.',
  ],
  whatWeKeepTitle: 'What we keep, and who helps us',
  whatWeKeep: [
    'Their cellphone number, date of birth, marks, uploaded documents and chats, and the offers, registered modules and first-week progress they confirm.',
    'Everything is stored in South Africa. To read reports, offer letters and proofs of registration, and to chat, parts of it are sent to our AI provider, which processes it outside South Africa and does not keep it for training.',
    'An offer letter or proof of registration is sent to the AI provider whole, so it sees everything printed on it, such as an ID number, student number, home address or fees. From it we keep only the details the learner checks, not those numbers, the address or the fees. The original file, which still shows them, is kept in South Africa until the learner deletes it or deletes their account.',
    'Reminders are delivered by other companies. An SMS goes through an SMS company that sends texts for us. A WhatsApp message goes through WhatsApp, which is owned by Meta. An app notification goes through Expo (in the United States) and then Apple or Google, who deliver it to the phone.',
    'These companies get only what they need to deliver a reminder: the phone number or the phone’s notification code, and the message. WhatsApp, Meta, Expo, Apple and Google handle it outside South Africa.',
    'We never sell it, never use it for advertising, and never log into any university system as the learner.',
  ],
  rightsTitle: 'Your rights',
  rights: [
    'You can withdraw permission at any time with this same link. We stop using their information at once.',
    'The learner can see, download or delete everything we hold, at any time.',
  ],
  agree: 'I agree',
  agreeConfirm: 'I am this learner’s parent or legal guardian and I agree.',
  decline: 'I don’t agree',
  granted: 'Thank you. The learner can now use UniversityFlow.',
  declined: 'Understood. We won’t use their information.',
  alreadyGranted: 'You have already agreed.',
  withdraw: 'Withdraw permission',
  withdrawn: 'Permission withdrawn. We have stopped using their information.',
  expired: 'This link has expired. The learner can send you a new one.',
  invalid: 'This link isn’t valid.',
  /**
   * Bump the number whenever the wording above changes what the guardian agrees to. v2 added
   * reminders and the companies that deliver them (audit A11-01): packages/db refuses a minor's
   * messaging opt-in under a consent older than v2. v3 added offer letters and proofs of
   * registration, what the AI provider sees on them and how long the file is kept (audit
   * A11-13): the database refuses those uploads, and an offer or registration read from one,
   * under a consent older than v3 (migration 0021). Pending legal review (A11-10).
   */
  version: 'v3-2026-10',
} as const;
