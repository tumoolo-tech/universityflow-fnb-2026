import { offerErrors } from './offer-errors';

/**
 * Offers (Phase 5a, planning.md §8.5). Honest about outcomes: only a final offer is a place, and
 * nothing here ever says "you're in" about any other kind. **Draft wording: the offer kinds, the
 * explanations and the final-results check are owed the owner's review.**
 */
export const offers = {
  title: 'My offers',
  lead: 'Every offer you get, kept straight: what kind it is, what it asks of you, and when to reply.',
  empty: 'No offers yet. When a university makes you an offer, add it here.',
  /** What kind of offer it is, in plain words. */
  kinds: {
    provisional: 'Provisional offer',
    conditional: 'Conditional offer',
    final: 'Final offer',
    waitlist: 'Waiting list',
  },
  /** What each kind means for the learner. Only `final` says it is a place. */
  explain: {
    provisional:
      'A provisional offer is not a place yet. The university decides when your final matric results are out, and only if they meet its requirements.',
    conditional:
      'A conditional offer is not a place yet. It becomes one only if you meet the conditions in your letter.',
    final:
      'The university says this offer is final. Accept it on the university’s own website before the date to reply by.',
    waitlist:
      'You’re on the waiting list. This isn’t an offer of a place yet: the university will tell you if one opens up.',
  },
  statuses: {
    held: 'Waiting for your answer',
    accepted: 'You’ve accepted this offer',
    declined: 'You’ve declined this offer',
  },
  sources: {
    letter: 'From your letter',
    learner: 'Added by you',
  },
  replyBy: (date: string) => `Reply by ${date}`,
  daysLeft: (n: number) =>
    n === 0 ? 'Reply today' : n === 1 ? '1 day left to reply' : `${n} days left to reply`,
  replyByPassed:
    'The date to reply by has passed. If you still want this place, contact the university’s admissions office.',
  noReplyBy: 'No date to reply by recorded.',
  reminderSet: (date: string) => `We’ll remind you on ${date}.`,
  reminderOff:
    'Turn on reminders under About me, and we’ll remind you before the date to reply by.',
  conditionsTitle: 'Conditions, as your letter puts them',
  conditionsLead:
    'These are the university’s own words. If anything is unclear, ask its admissions office.',
  noConditions: 'No conditions recorded.',
  notAvailable: 'This course isn’t in the list we can show right now.',
  accept: 'Accept this offer',
  acceptHint:
    'Accept it on the university’s own website first, then tell us here. You can accept only one offer.',
  decline: 'Decline this offer',
  remove: 'Remove',
  acceptedSaved: 'Saved: you’ve accepted this offer.',
  declinedSaved: 'Saved: you’ve declined this offer.',
  removed: 'Removed.',
  added: 'Saved. Your offer is below.',
  errors: offerErrors,

  addTitle: 'Add an offer',
  addLead: 'Choose the course, then what kind of offer the university made.',
  course: 'The course you were offered',
  kind: 'What kind of offer is it?',
  kindHint:
    'Your letter or email says. If it doesn’t say “final”, it isn’t a place yet: choose provisional or conditional.',
  replyByLabel: 'Date to reply by (optional)',
  replyByHint: 'As it appears in your letter or email.',
  /** The app types the date in: its format, and the error when it can't be read. */
  replyByFormat: 'As it appears in your letter or email, written as year-month-day (YYYY-MM-DD).',
  replyByInvalid: 'That isn’t a date we can read. Write it as YYYY-MM-DD.',
  chooseCourse: 'Choose the course',
  changeCourse: 'Change the course',
  save: 'Save this offer',
  /** Said on the field when Save is pressed without it (A3-18). */
  missingCourse: 'Choose the course you were offered.',
  missingKind: 'Choose what kind of offer it is.',

  uploadTitle: 'Upload your offer letter',
  uploadLead:
    'A clear photo or a PDF of the letter. We read the course, the kind of offer, the conditions and the date to reply by. Your name, ID number and student number are never kept.',
  chooseLetter: 'Choose a photo or PDF',
  reading: 'Reading your letter…',
  unreadable: 'We couldn’t read that letter. You can add the offer yourself instead.',

  letterTitle: 'Check your offer letter',
  letterLead:
    'We read these from your letter. Check each one against the letter itself and fix anything that’s wrong. Nothing is saved until you confirm.',
  sampleLead:
    'Local stand-in: no AI is connected, so this is a sample letter, not read from your file. Change it to match your real letter.',
  asPrinted: (programme: string) => `Your letter says: “${programme}”`,
  whichCourse: 'Which course is it?',
  noCandidates: 'We couldn’t match the course in your letter. Choose it from the full list.',
  otherCourse: 'Another course',
  condition: (n: number) => `Condition ${n}`,
  addCondition: 'Add a condition',
  removeCondition: (n: number) => `Remove condition ${n}`,
  confirm: 'This is correct: save my offer',
  letterWarnings: {
    'not-a-letter':
      'This doesn’t look like an offer letter. Check that you uploaded the right page.',
    'partly-unreadable': 'Part of your letter was hard to read. Check everything carefully.',
    'kind-unclear':
      'We couldn’t tell what kind of offer this is. Choose it from your letter: if it doesn’t say “final”, it isn’t a place yet.',
    'reply-by-unreadable': 'We couldn’t read the date to reply by. Type it in from your letter.',
    'conditions-cut': 'Some conditions were very long or many. Check them against your letter.',
  },

  /** The January re-check, on the learner's confirmed final results. */
  finalTitle: 'With your final matric results',
  finalMet:
    'Your final results meet the published requirements for this course. The university still decides, and the conditions in your letter still apply.',
  finalNotMet:
    'Your final results don’t meet the published requirements for this course, so this offer may fall away. Contact the university’s admissions office to check.',
  finalUnavailable: 'We can’t check this course against your final results yet.',
  finalWaiting:
    'Once your final matric results are out, confirm them under Documents and we’ll check this offer again.',
  confirmFinal: 'Confirm my final results',
  planBTitle: 'Your Plan B',
  planBLead: 'Courses whose published requirements your final results meet:',
  noPlanB: 'We found no Plan B courses on your final results. Ask a teacher or counsellor.',
} as const;
