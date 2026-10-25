import { adviceValidity, type SafetyAdvice } from '../safety';

/**
 * University of Johannesburg (UJ): its own safety advice (planning.md §11, Phase 5e-3), quoted
 * word for word from Protection Services' page, accordion "Communication and Awareness", read in
 * a visible browser on 2026-10-17. The page prints no date for the advice, so no `publishedOn`.
 *
 * - Drafts only: never add `verifiedOn`/`verifiedBy`. A person checks each quote against the page
 *   (and, owner's decision 7, with UJ Protection Services) and a second person signs it off
 *   (decision 8).
 * - Every note expires 90 days after it was read (`adviceValidity`); re-read the page and move the
 *   date on, never extend it by hand.
 * - `area` only where UJ names one, in UJ's words (decision 6). Every tip here is UJ-wide, so none
 *   has a `campusId`.
 * - Not added: the line "The University has due-care policies. Please familiarize yourself with
 *   them. Do not be negligent." (a policy reminder, not advice a learner can act on), and the
 *   "Safe route maps for all campuses" (images only: UJ prints no route in words).
 */

const PROTECTION_SERVICES = {
  sourceUrl: 'https://www.uj.ac.za/support-services/operations/protection-services/',
  academicYear: 2026,
  universityId: 'uj',
  ...adviceValidity('2026-10-17'),
} as const;

export const ujSafetyAdvice: SafetyAdvice[] = [
  {
    ...PROTECTION_SERVICES,
    id: 'uj-no-valuables-on-show',
    kind: 'general-tip',
    quote: 'Do not walk in public while displaying any valuables.',
  },
  {
    ...PROTECTION_SERVICES,
    id: 'uj-earphones',
    kind: 'general-tip',
    quote:
      'You make yourself a target if you walk with earphones in your ears. Immediately you show would-be criminals that you have a cellphone on you. You are also unable to hear if cars/people approach you from behind.',
  },
  {
    ...PROTECTION_SERVICES,
    id: 'uj-accommodation-scams',
    kind: 'general-tip',
    quote:
      'Do not fall victim to scammers on internet websites. Before you transfer money for accommodation over to a potential landlord, make sure that the landlord actually exists by visiting the house, speaking to other occupants and confirming that the business is legit!!!',
  },
  {
    ...PROTECTION_SERVICES,
    id: 'uj-daytime-robberies-auckland-park',
    kind: 'incident-advisory',
    quote:
      'Do not approach any vehicles that drive up next to you. There have been instances where a scammer presents himself as a priest or someone that offers you a job. Ignore them and walk to the nearest area with other people around. Robberies are happening during daytime. Young female students carrying luggage and or laptop bags (outside of campus) are being targeted in the Auckland Park / Melville / Hursthill areas.',
    area: 'Auckland Park / Melville / Hursthill',
    note: 'The library’s Safety Tips page (https://www.uj.ac.za/library/about-the-uj-library/safety-tips/) prints the same tip, spelling the area "Aukland Park / Melville / Hursthill". The page gives no date for the robberies.',
  },
  {
    ...PROTECTION_SERVICES,
    id: 'uj-visitors-off-campus-residence',
    kind: 'general-tip',
    quote:
      'A lot of our students stay in off campus accommodation. When your friend comes over for a visit, under NO CIRCUMSTANCES sit in the vehicle outside of the residence. You are making yourselves a target for a possible hijacking situation. Park the vehicle, go inside and when you are ready to leave, make sure no other vehicles are lingering around in the area.',
  },
  {
    ...PROTECTION_SERVICES,
    id: 'uj-self-defence',
    kind: 'general-tip',
    quote:
      'Protect yourself by carrying on you at all times some form of self-defense mechanism. This can be in the form of pepper spray or a taser. Make sure you know how to use these items.',
    note: 'Advice about carrying pepper spray or a taser, shown to learners who may be under 18: the owner decides whether to show it (and asks UJ, decision 7).',
  },
  {
    ...PROTECTION_SERVICES,
    id: 'uj-walk-in-groups',
    kind: 'walk-in-groups',
    quote: 'Walk in groups where possible, especially at night.',
  },
  {
    ...PROTECTION_SERVICES,
    id: 'uj-house-alarms',
    kind: 'general-tip',
    quote: 'Please ensure that house alarms are armed before you leave the premises.',
  },
  {
    ...PROTECTION_SERVICES,
    id: 'uj-valuables-locked-away',
    kind: 'general-tip',
    quote: 'Always ensure that valuables and currency are locked away and out of sight.',
  },
];
