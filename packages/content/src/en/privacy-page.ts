/**
 * `en.privacyPage`: the privacy policy at /privacy and the ECTA s43 footer on the public web pages
 * (the owner's launch standard; audit A11-20). **A template for the owner's legal adviser**, built
 * from docs/store/privacy-and-data-safety.md: the facts are the code's, the wording is owed the
 * owner's review and a legal review (A11-10). Every value only the owner can give is an
 * "Owner to fill" line, never a guess: replace the whole string when it is known.
 * apps/web/test/privacy-page.test.tsx fails if the page stops naming an operator the store
 * document names, or stops showing a field still to be filled.
 *
 * The Information Regulator's details were read from inforegulator.org.za (the contact and
 * complaints pages) on 2026-10-23; re-check them before launch.
 */

import { privacyConsent } from './privacy-consent';

export const OWNER_TO_FILL = 'Owner to fill';
const fill = (what: string) => `${OWNER_TO_FILL}: ${what}`;

export const privacyPage = {
  title: 'Privacy policy',
  description:
    'How UniversityFlow collects, uses, keeps and protects your information, who helps us, and your rights under POPIA.',
  templateTitle: 'Template for legal review',
  templateNotice: `This privacy policy is a template. UniversityFlow’s legal adviser must review it before launch, and every line marked “${OWNER_TO_FILL}” must be completed. Until then it is not our final policy.`,
  updatedLabel: 'Last updated',
  updated: fill('the date this policy takes effect'),
  intro:
    'This page explains, in plain words, what UniversityFlow does with your information. It is written for learners from Grade 10 and for their parents and guardians. Most of our users are under 18, so we take extra care.',
  contentsLabel: 'On this page',
  backHome: 'Back to UniversityFlow',

  /** The ECTA s43 details: shown in the footer and under "Who we are". */
  business: {
    legalName: fill('full legal name'),
    legalStatus: fill('legal status (for example, a private company)'),
    registrationNumber: fill('registration number, or “not registered”'),
    physicalAddress: fill('physical address'),
    phone: fill('phone number'),
    email: fill('email address'),
  },
  businessLabels: {
    legalName: 'Full legal name',
    legalStatus: 'Legal status',
    registrationNumber: 'Registration number',
    physicalAddress: 'Physical address',
    phone: 'Phone',
    email: 'Email',
  },

  footer: {
    label: 'About UniversityFlow',
    privacyLink: 'Privacy policy',
    helpLink: 'Get help',
  },

  /** `consentLink`, `adultConfirm`, `adultConfirmNeeded`: their own module, which the app bundles (A4-18). */
  ...privacyConsent,

  sections: {
    whoWeAre: {
      title: 'Who we are',
      lead: 'UniversityFlow is the “responsible party” under POPIA: we decide how your information is used, and we answer for it.',
    },
    officer: {
      title: 'Our Information Officer',
      lead: 'Our Information Officer makes sure we follow POPIA. Ask them anything about your information, or to use any of your rights.',
      labels: { name: 'Name', email: 'Email', phone: 'Phone' },
      values: {
        name: fill('the Information Officer’s name (registered with the Information Regulator)'),
        email: fill('the Information Officer’s email address'),
        phone: fill('the Information Officer’s phone number'),
      },
    },
    collect: {
      title: 'What we collect',
      lead: 'Only what UniversityFlow needs to help you. Everything you give us is linked to your account.',
      items: [
        'Your cellphone number, to sign you in with a PIN by SMS, and to send the SMS reminders you turn on.',
        'Your date of birth, to know whether a parent or guardian must agree first.',
        'For learners under 18: your parent’s or guardian’s name and phone number, to ask for their permission and record it.',
        'Your grade (and when you last confirmed it), and if you choose: your first name, school, province and a goal in your own words.',
        'How you chose to style your About me card: a colour theme, an avatar from our set, a tagline and up to three words from our lists. Only you see it, and it is never sent to our AI provider.',
        'Photos and PDFs you upload of school reports, offer letters and proofs of registration, and the marks, offers and modules you check and confirm from them.',
        'Your chats with the AI companion, and notes you asked it to remember.',
        'Your goal, shortlist, applications, checklists, exam subjects and first-week progress.',
        'Plan maps you make under My goal: which plan you chose, how each part went and the month you aim for. Only you see them, and they are never sent to our AI provider.',
        'Your reminder choices, the reminders we send, and their delivery reports.',
        'On the app: a push token, a code that lets us send notifications to your phone, if you turn notifications on.',
        'Your device’s IP address. Like every website, our host receives it with each request. To stop abuse (too many PIN requests or uploads), we keep a keyed hash of your phone number and IP address with the time, never the number or address itself.',
      ],
      printedTitle: 'What is printed on a letter you upload',
      printed:
        'An offer letter or proof of registration usually shows your full name, ID number, student number, home address and sometimes fees. We never copy those into your records. But the file you uploaded is kept, as it is, until you delete it or your account.',
      notCollected:
        'We do not collect your location, contacts, microphone, browsing history, advertising IDs, payment details or email address.',
    },
    why: {
      title: 'Why we use it',
      items: [
        'To show which university courses your confirmed marks qualify for, and what you need for the others.',
        'To help you plan applications, deadlines, documents and NSFAS funding.',
        'To answer you in the chat, and to give you helpline numbers if you seem to be in distress.',
        'To send only the reminders you asked for.',
        'To keep your account safe and stop abuse.',
      ],
      never:
        'We never sell your information, never use it for advertising or tracking, and never log into any university system as you.',
    },
    children: {
      title: 'Learners under 18',
      items: [
        'Nobody under 13 can sign up.',
        'For a learner under 18, nothing about them is used until a parent or guardian agrees, by a link we send them by SMS. They can withdraw permission at any time with the same link.',
        'On the learner’s 18th birthday the guardian’s permission ends. From then the learner agrees in their own name, and until they do, nothing of theirs is used and no reminders are sent.',
      ],
    },
    sensitive: {
      title: 'Sensitive information',
      items: [
        'Marks and anything about your health, wellbeing or a disability are treated as sensitive: we collect as little as we can, protect it, and log who sees it.',
        'If you tell the companion about your health or something that happened to you, it is part of your chat, and is deleted with your account.',
      ],
      legalNote: fill(
        'legal adviser to confirm the wording for special personal information in chats (audit A11-21, consent v4)',
      ),
    },
    later: {
      title: 'Coming later',
      lead: 'These are not collected today. Each is used only once it is switched on, after you (or your parent or guardian) agree to new consent wording that names it.',
      items: [
        'A profile photo, if you choose to add one.',
        'Your own words in a plan map: its title, what each part says, what got in the way and what you could try differently.',
      ],
    },
    operators: {
      title: 'Who helps us',
      lead: 'These companies process information for us, under contract, and only to do their part. They are called “operators” in POPIA.',
      labels: { does: 'What they do', gets: 'What they receive', where: 'Where' },
      items: [
        {
          id: 'aws',
          name: 'Amazon Web Services (AWS)',
          does: 'Our database and file store.',
          gets: 'Everything we keep, encrypted.',
          where: 'Cape Town, South Africa (af-south-1).',
        },
        {
          id: 'vercel',
          name: 'Vercel',
          does: 'Runs this website and the server the app talks to.',
          gets: 'Each request, with your device’s IP address.',
          where: 'Its Cape Town region, South Africa (cpt1). Vercel is a United States company.',
        },
        {
          id: 'anthropic',
          name: 'Anthropic (our AI provider)',
          does: 'The AI that chats with you and reads your uploads.',
          gets: 'Your chat messages, and the images of reports, offer letters and proofs of registration (a letter is sent whole, with everything printed on it). Not used to train its models.',
          where: 'The United States: outside South Africa.',
        },
        {
          id: 'sms',
          name: fill('the SMS company’s name'),
          does: 'Sends sign-in PINs, a guardian’s permission link, and the SMS reminders you turn on.',
          gets: 'The phone number and the message. A reminder never has your name, university, subject or marks. It also passes on STOP and other replies.',
          where: fill('the SMS company’s country'),
        },
        {
          id: 'meta',
          name: 'Meta (WhatsApp)',
          partner: fill(
            'the WhatsApp partner company’s name and country, if one is used, or “none: Meta directly”',
          ),
          does: 'Sends WhatsApp reminders, only if you turn them on.',
          gets: 'Your phone number and which fixed message to send (no name, university, subject or marks), and your replies.',
          where: 'Outside South Africa.',
        },
        {
          id: 'push',
          name: 'Expo, then Apple or Google',
          does: 'Deliver app notifications to your phone.',
          gets: 'The push token and a fixed sentence with nothing personal in it.',
          where: 'Outside South Africa (Expo is in the United States).',
        },
        {
          id: 'elevenlabs',
          name: 'ElevenLabs',
          does: 'The voice of Read aloud on campus places.',
          gets: 'Public text from our campus guide only, such as a building’s name and opening hours. Never anything about you: no phone number, name, account or chat.',
          where: 'Outside South Africa.',
          note: 'Read aloud stays off for learners until ElevenLabs gives its written approval for use by people under 18.',
        },
        {
          id: 'jobs',
          name: fill(
            'the background-job service, if one is used (for example Trigger.dev), or “none: our own database”',
          ),
          does: 'Runs scheduled work, such as sending a reminder at the right time.',
          gets: 'Account ids only, never your name, number or messages.',
          where: fill('where the background-job service runs'),
        },
        {
          id: 'email',
          name: 'Email sender',
          does: 'None. We don’t send email.',
          gets: 'Nothing: we don’t collect email addresses.',
          where: 'Not applicable.',
        },
        {
          id: 'spam',
          name: 'Spam and abuse checks',
          does: 'Our own limits on PIN requests and uploads. No outside spam-check company.',
          gets: 'Keyed hashes of your phone number and IP address, kept by us.',
          where: 'Cape Town, South Africa, with the rest of our data.',
        },
      ],
      crossBorderTitle: 'Information sent outside South Africa',
      crossBorder: [
        'Everything we keep is stored in South Africa.',
        'To chat and to read your uploads, parts of it go to Anthropic in the United States. Notifications go through Expo, Apple and Google, and WhatsApp reminders through Meta, all outside South Africa. Read aloud’s words (public text, nothing about you) go to ElevenLabs.',
        'Each of them must protect it to a standard like POPIA’s (section 72), and they get only what they need.',
      ],
      // "Open Mmereko" on My CV (the owner's decision, 2026-10-24): a separate service, not an operator.
      separateTitle: 'Separate services you can open from UniversityFlow',
      separate: [
        'Mmereko: if you are 18 or older, or at university, you can open Mmereko from My CV. It is a separate service run by Tumoolo, under its own terms and privacy policy, and you sign in to it with its own account. UniversityFlow sends it nothing about you: no name, number, marks or CV. What you give Mmereko there is between you and Mmereko.',
      ],
    },
    keep: {
      title: 'How long we keep it',
      items: [
        'Your account and everything in it, until you delete your account.',
        'A file you upload, until you delete it or your account.',
        'Signed-in sessions that have expired, and their push tokens, are deleted every day.',
      ],
      schedule: fill(
        'the retention schedule (audit A11-04): how long reminders, delivery reports, finished jobs, rate-limit records and uploaded letters are kept after they are used',
      ),
    },
    cookies: {
      title: 'Cookies and visitor statistics',
      items: [
        'The website uses one cookie, only to keep you signed in. It is needed for the site to work.',
        'No advertising, tracking or analytics cookies, and no visitor statistics: we don’t count or follow visitors.',
        'Our font is served from our own website, so no font company sees your visit.',
      ],
    },
    security: {
      title: 'How we protect it',
      items: [
        'Everything is sent over an encrypted connection (HTTPS).',
        'The database itself keeps each learner’s records apart, so one learner can never see another’s.',
        'We log who accesses personal information, and when.',
      ],
    },
    rights: {
      title: 'Your rights',
      items: [
        'See your information: download everything we hold, at any time, under About me.',
        'Correct it: change your details under About me, and check every mark and detail before we use it.',
        'Delete it: About me, then Delete my account. Your files, chats, offers, reminders and push tokens go with it.',
        'Object or withdraw: turn any reminder off, reply STOP, or (for a guardian) withdraw permission with the link we sent. You can also object to how we use your information by contacting our Information Officer.',
        'Complain: if you are unhappy with how we handle your information, tell our Information Officer. You can also complain to the Information Regulator (below).',
      ],
      paiaManual: fill('the link to our PAIA manual (how to ask for records)'),
    },
    regulator: {
      title: 'The Information Regulator',
      lead: 'The Information Regulator (South Africa) protects your rights under POPIA. You can complain to it at any time.',
      labels: {
        address: 'Address',
        phone: 'Phone',
        tollFree: 'Toll-free',
        enquiries: 'Enquiries',
        complaints: 'POPIA complaints',
        portal: 'Complaints online',
        website: 'Website',
      },
      values: {
        address: 'Woodmead North Office Park, 54 Maxwell Drive, Woodmead, Johannesburg, 2191',
        phone: '010 023 5200',
        tollFree: '0800 017 160',
        enquiries: 'enquiries@inforegulator.org.za',
        complaints: 'POPIAComplaints@inforegulator.org.za',
        portal: 'https://eservices.inforegulator.org.za',
        website: 'https://inforegulator.org.za',
      },
      checked: 'Taken from the Information Regulator’s website on 23 October 2026.',
    },
    changes: {
      title: 'Changes to this policy',
      lead: 'If we change what we do with your information, we update this page and its date. If a change needs your agreement, we ask for it first.',
    },
  },
} as const;

/** Every "Owner to fill" line on the page, for the owner and the page's test. */
export function ownerToFillFields(): string[] {
  const found: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === 'string') {
      if (value.startsWith(`${OWNER_TO_FILL}:`) && !found.includes(value)) found.push(value);
    } else if (Array.isArray(value)) {
      for (const item of value) walk(item);
    } else if (value && typeof value === 'object') {
      for (const item of Object.values(value)) walk(item);
    }
  };
  walk(privacyPage);
  return found;
}
