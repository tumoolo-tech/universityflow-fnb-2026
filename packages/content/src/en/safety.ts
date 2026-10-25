/**
 * Digital safety and scam guidance (planning.md §8.6), shown before you arrive and in the first
 * week, and sent as a few push notifications. Advice, not facts about a university. **Draft
 * wording: owed the owner's review.**
 */
export const safety = {
  title: 'Staying safe',
  tips: {
    'accommodation-scams': {
      title: 'Accommodation scams',
      body: 'Fake listings for rooms and flats are common in January, when students are looking. Never pay a deposit for a place you haven’t seen, or to someone you can’t check. Use your university’s own accommodation list where it has one.',
    },
    'admission-and-bursary-scams': {
      title: 'Admission and bursary scams',
      body: 'Nobody can sell you a place at university or a bursary, and applying for NSFAS is free. If someone asks you to pay to secure a place or funding, it’s a scam.',
    },
    phishing: {
      title: 'Fake emails and messages',
      body: 'Emails, SMSes and WhatsApps can pretend to come from your university or NSFAS. Don’t follow a link that asks for your password or banking details: go to the official website yourself.',
    },
    passwords: {
      title: 'Keep your passwords to yourself',
      body: 'Never share your student portal, university email or NSFAS password, even with friends or someone offering to help.',
    },
    'shared-computers': {
      title: 'Log out of shared computers',
      body: 'On library and lab computers, log out of the student portal and the learning site every time, and never tick “remember me”. An account left open can mean a changed or deleted assignment.',
    },
    'keep-proof': {
      title: 'Keep proof',
      body: 'Keep proof of every payment and every change to your registration: a receipt, a screenshot or the email. You may need it later.',
    },
    'back-up': {
      title: 'Back up your work',
      body: 'Save your assignments to your university’s cloud storage too: a lost laptop shouldn’t mean a lost semester. Lock your phone, and don’t leave it or your laptop alone in the library.',
    },
  },
} as const;
