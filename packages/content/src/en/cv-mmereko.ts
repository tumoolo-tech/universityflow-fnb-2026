/**
 * `en.cvMmereko`: the "Open Mmereko" door on My CV (the owner's decision of 2026-10-24). Mmereko's
 * own site opens in a full-screen canvas over the page, for a learner 18 or over or at university.
 * It is a separate service with its own account: UniversityFlow sends it nothing about the
 * learner, and these words say so plainly. My CV itself is unchanged.
 */
export const cvMmereko = {
  open: 'Open Mmereko',
  lead: 'Mmereko helps you make a CV for each job you apply for. It opens here, over this page.',
  title: 'Mmereko',
  separate:
    'Mmereko is a separate service by Tumoolo, with its own account, terms and privacy. UniversityFlow sends it nothing about you.',
  siteLink: 'Mmereko’s website',
  newTab: 'Open in a new tab',
  newTabHint:
    'If signing in doesn’t finish here (with another account or an email link), open Mmereko in a new tab.',
  close: 'Close',
  frameTitle: 'Mmereko, a separate service',
} as const;
