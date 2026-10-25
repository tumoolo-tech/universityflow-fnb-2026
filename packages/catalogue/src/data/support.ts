import type { Helpline, Nsfas } from '../records';

/**
 * Funding and crisis support records.
 *
 * DRAFT: researched on 2026-10-13 from each organisation's own website. A wrong crisis number is
 * the worst error this product could make (planning.md §4.3), so every helpline must be checked
 * by a person on the organisation's own site before release, and again at least every three
 * months. Numbers that research could only find on third-party sites (for example a Higher
 * Health SMS line) are deliberately left out.
 */

export const nsfas: Nsfas = {
  sourceUrl: 'https://www.nsfas.org.za/content/',
  academicYear: 2027,
  opensOn: '2026-09-18',
  closesOn: '2026-10-31',
  incomeThresholdZar: 350_000,
  incomeThresholdDisabilityZar: 600_000,
  sassaNote:
    'SASSA grant recipients automatically qualify on financial eligibility, and no proof of income is required.',
  documents: [
    'South African ID or birth certificate (both sides of a Smart ID card)',
    'Signed NSFAS consent form, signed by you and by every parent, guardian or spouse named on the application',
    'ID copies of your parents or guardian, if their details differ from Home Affairs records',
    'Death certificate for a parent or guardian who has passed away, if this applies',
    'Proof of income for each earning parent, guardian or spouse: last three payslips, a UIF statement or an affidavit for informal income (not needed for SASSA households)',
    'Disability annexure with a medical report, if you have a disability',
  ],
  nPlusRule:
    'NSFAS funds you for the minimum time your qualification takes plus one year (N+1), or plus two years for students with disabilities (N+2). The extra year is given once in your whole academic career, and years at other institutions count.',
  applyUrl: 'https://my.nsfas.org.za',
};

export const helplines: Helpline[] = [
  {
    sourceUrl: 'https://higherhealth.ac.za/',
    academicYear: 2027,
    id: 'higher-health',
    name: 'Higher Health 24-hour Crisis Helpline',
    numbers: [{ kind: 'call', value: '0800 36 36 36' }],
    hours: '24 hours, every day',
    purpose:
      'Free, confidential support from psychologists and counsellors for university and TVET students in distress or crisis, including reporting gender-based violence.',
    topics: ['distress', 'suicide', 'abuse'],
  },
  {
    sourceUrl: 'https://www.sadag.org/',
    academicYear: 2027,
    id: 'sadag-suicide-crisis',
    name: 'SADAG Suicide Crisis Helpline',
    numbers: [{ kind: 'call', value: '0800 567 567' }],
    hours: '24 hours',
    purpose: 'Free suicide crisis support from the South African Depression and Anxiety Group.',
    topics: ['suicide', 'distress'],
  },
  {
    sourceUrl: 'https://www.sadag.org/',
    academicYear: 2027,
    id: 'substance-abuse-helpline',
    name: 'Substance Abuse Helpline (Department of Social Development, listed by SADAG)',
    numbers: [
      { kind: 'call', value: '0800 12 13 14' },
      { kind: 'sms', value: '32312' },
    ],
    hours: '24 hours',
    purpose: 'Free support for problems with alcohol or drugs.',
    topics: ['substance'],
  },
  {
    sourceUrl: 'https://www.childlinesa.org.za/',
    academicYear: 2027,
    id: 'childline',
    name: 'Childline South Africa',
    numbers: [{ kind: 'call', value: '116' }],
    hours: '24 hours, free from all networks',
    purpose: 'Free counselling for children and teenagers, and protection from violence and abuse.',
    topics: ['child', 'abuse', 'distress'],
  },
  {
    sourceUrl: 'https://www.saps.gov.za/',
    academicYear: 2027,
    id: 'saps-emergency',
    name: 'South African Police Service',
    numbers: [{ kind: 'call', value: '10111' }],
    hours: 'Emergency line',
    purpose: 'Police emergency, if you or someone else is in immediate danger.',
    topics: ['emergency', 'abuse'],
  },
  {
    sourceUrl: 'https://www.westerncape.gov.za/know-who-you-can-call-emergency',
    academicYear: 2027,
    id: 'ambulance',
    name: 'Ambulance',
    numbers: [{ kind: 'call', value: '10177' }],
    hours: 'Emergency line',
    purpose: 'Medical emergency.',
    topics: ['emergency'],
  },
  {
    sourceUrl: 'https://www.westerncape.gov.za/know-who-you-can-call-emergency',
    academicYear: 2027,
    id: 'mobile-emergency',
    name: 'Emergency from a cell phone',
    numbers: [{ kind: 'call', value: '112' }],
    hours: 'Emergency line',
    purpose: 'Emergency number from any cell phone network.',
    topics: ['emergency'],
  },
];
