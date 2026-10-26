/** `en.funding`. */
export const funding = {
  title: 'Funding',
  lead: 'NSFAS pays study fees and allowances for students from households earning up to the threshold below.',
  nsfas: 'NSFAS bursary',
  window: 'Application window',
  who: 'Who can apply',
  threshold: (amount: string) => `Households earning up to ${amount} a year`,
  thresholdDisability: (amount: string) => `Up to ${amount} a year for students with a disability`,
  sassa: 'If your family gets a SASSA grant',
  documents: 'Documents to get ready',
  nPlus: 'Keep your funding: the N+ rule',
  apply: 'Apply on my.nsfas.org.za',
  free: 'Applying for NSFAS is free. Never pay anyone to apply for you.',
  checklistScope: 'Mark what you have ready',
  /* RT-05: the funding card, for any bursary record (components/funding-card.tsx). */
  deadline: 'Deadline',
  daysLeft: (days: number) =>
    days === 0 ? 'Closes today' : days === 1 ? '1 day left to apply' : `${days} days left to apply`,
  opensIn: (days: number) => (days === 1 ? 'Opens tomorrow' : `Opens in ${days} days`),
  openedOn: (date: string) => `Opened ${date}`,
  closedOn: (date: string) => `Closed on ${date}`,
  closedNext: 'Applications for this year have closed. Check the official site for the next round.',
  datesUnknown: 'The dates are not published yet.',
  applyOn: (site: string) => `Apply on ${site}`,
  // Bursaries beside NSFAS (feat/bursaries, 2026-10-25).
  bursaries: 'Other bursaries',
  bursariesLead:
    'Well-known bursaries for school leavers and first-year students. Each funder sets its own rules and chooses who it funds, so read its page before you apply.',
  bursariesNone: 'No bursaries to show yet.',
  bursariesCount: (n: number) => (n === 1 ? '1 other bursary' : `${n} other bursaries`),
  funderKinds: {
    government: 'Government',
    partnership: 'Funding programme',
    'professional-body': 'Professional body',
    corporate: 'Company',
    foundation: 'Foundation',
  },
  bursaryStatus: {
    open: 'Open now',
    'opens-later': 'Not open yet',
    unknown: 'Check the dates',
    closed: 'Closed',
  },
  bursaryFields: 'What you can study',
  bursaryCovers: 'What it pays for',
  bursaryCoversUnknown: 'The funder’s page doesn’t say.',
  bursaryHow: 'How to apply',
  bursaryWorkBack: 'After you graduate',
  bursaryWorkBackNotStated:
    'The funder’s page doesn’t mention working for them after you graduate. Ask the funder before you sign.',
  bursaryDatesUnpublished: 'The funder hasn’t published the dates.',
  bursaryAdministeredBy: (who: string) => `Run for the funder by ${who}`,
  bursaryApply: 'Apply on the funder’s site',
  bursaryFree: 'Applying for a bursary is free. Never pay anyone to apply for you.',
  demoLogosNotice:
    'Funder logos are shown for this demo only. UniversityFlow is not affiliated with or endorsed by these funders.',
} as const;
