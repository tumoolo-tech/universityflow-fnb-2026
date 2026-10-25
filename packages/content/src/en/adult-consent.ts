/**
 * What an adult (18 or older) agrees to in their own name, before anything is sent to the AI
 * provider (audit A7-04: App Store 5.1.2(i), POPIA s 18). The same facts as `consent`, written
 * to the learner. Shown on the web and in the app; the version is recorded with the agreement.
 * Pending legal review (A11-10).
 */
export const adultConsent = {
  title: 'Before you start',
  lead: 'You’re 18 or older, so this is your choice. Here is what UniversityFlow does with your information, and who helps us.',
  whatWeDoTitle: 'What UniversityFlow does',
  whatWeDo: [
    'Reads your school report (after you check every mark) and shows which university courses you qualify for.',
    'Reads an offer letter or proof of registration you upload (after you check every detail), to keep track of your university offers and the modules you are registered for.',
    'Helps you with application deadlines, documents and NSFAS funding.',
    'Chats with you about your goals and studies. If you seem to be in distress, it gives you helpline numbers.',
    'Sends you reminders by SMS, WhatsApp or app notification, but only the ones you turn on.',
  ],
  whatWeKeepTitle: 'What we keep, and who helps us',
  whatWeKeep: [
    'Your cellphone number, date of birth, marks, uploaded documents and chats, and the offers, registered modules and first-week progress you confirm.',
    'Everything is stored in South Africa. To read your reports, offer letters and proofs of registration, and to chat, parts of it are sent to our AI provider, which processes it outside South Africa and does not keep it for training.',
    'An offer letter or proof of registration is sent to the AI provider whole, so it sees everything printed on it, such as your ID number, student number, home address or fees. From it we keep only the details you check, not those numbers, your address or the fees. The original file, which still shows them, is kept in South Africa until you delete it or delete your account.',
    'Reminders are delivered by other companies: an SMS company that sends texts for us, WhatsApp (owned by Meta), and for app notifications Expo (in the United States) and then Apple or Google. WhatsApp, Meta, Expo, Apple and Google handle your phone number or notification code and the message outside South Africa.',
    'We never sell your information, never use it for advertising, and never log into any university system as you.',
  ],
  rightsTitle: 'Your rights',
  rights: [
    'You can see, download or delete everything we hold about you, at any time, under About me.',
    'You can turn any reminder off at any time, or reply STOP.',
  ],
  agree: 'I agree to this',
  /**
   * Bump whenever the wording above changes. Recorded with the learner's agreement. adult-v2
   * added offer letters and proofs of registration (audit A11-13): an adult who agreed to an
   * older version is asked again before anything else (packages/db `needsAdultConsent`), and the
   * database refuses those uploads under it (migration 0021).
   */
  version: 'adult-v2-2026-10',
} as const;
