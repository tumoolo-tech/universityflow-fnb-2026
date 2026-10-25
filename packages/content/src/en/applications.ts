/** `en.applications`. */
export const applications = {
  title: 'Applications',
  lead: 'Your shortlist, grouped by university, with what each application needs.',
  empty: 'Your shortlist is empty. Add courses from My results.',
  choices: (n: number) => (n === 1 ? '1 course' : `${n} courses`),
  status: 'Status',
  statuses: {
    planning: 'Planning',
    'in-progress': 'In progress',
    submitted: 'Submitted',
    'provisional-offer': 'Provisional offer',
    offer: 'Offer',
    waitlisted: 'Waitlisted',
    unsuccessful: 'Unsuccessful',
    declined: 'Declined',
  },
  reference: 'Application or student number (optional)',
  pack: 'Application pack',
  howToApply: 'How to apply',
  applyAt: (name: string) => `Apply on ${name}’s own website`,
  applyViaCao: 'Apply through the Central Applications Office (CAO)',
  window: 'Application window',
  opens: (date: string) => `Opens ${date}`,
  closes: (date: string) => `Closes ${date}`,
  earlier: 'Earlier closing dates',
  lastCycle: (year: number) =>
    `These are the dates published for the ${year} intake. Dates for your intake aren’t out yet; universities usually publish them early in the year.`,
  fee: 'Application fee',
  grade11: 'Applies with your final Grade 11 results',
  checklist: 'Checklist',
  checklistItems: {
    'certified-id': 'Certified copy of your ID or birth certificate',
    'grade-11-report': 'Your final Grade 11 report (certified if asked)',
    'proof-of-residence': 'Proof of address',
    'guardian-id': 'Your parent or guardian’s ID copy (some forms ask)',
    'fee-paid': 'Application fee paid (or waiver approved)',
    'choices-ordered': 'Your course choices, in order of preference',
    'nbt-booked': 'NBT booked (for courses that need it)',
    'residence-applied': 'Residence application (if you need a place to stay)',
    submitted: 'Application submitted, and the confirmation saved',
  },
  certifiedNote:
    'A certified copy is stamped at a police station or by a commissioner of oaths. Copies are usually only accepted for three months.',
  nbt: 'National Benchmark Tests (NBT)',
  nbtLead:
    'These courses need the NBT. Book early: some faculties need results by a set date, and some only accept tests written in person.',
  nbtBook: 'Book at nbt.ac.za',
  scamWarning:
    'Applying is done only on the university’s own website (or the CAO). Nobody can “guarantee” you a place for money.',
  selectionNote: 'What the university says',
  /**
   * The empty tracker for a student with a place at university (A2-68): nothing to shortlist or
   * apply for. New wording (2026-10-24), owed the owner's review.
   */
  atUniversity:
    'You’re at university now, so there are no applications to track here. Your modules for the year are on My modules.',
  atUniversityAction: 'Open My modules',
} as const;
