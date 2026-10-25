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
} as const;
