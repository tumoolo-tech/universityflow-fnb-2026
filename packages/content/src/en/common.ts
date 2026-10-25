/** `en.common`. */
export const common = {
  continue: 'Continue',
  save: 'Save',
  saving: 'Saving…',
  cancel: 'Cancel',
  back: 'Back',
  close: 'Close',
  remove: 'Remove',
  edit: 'Edit',
  yes: 'Yes',
  no: 'No',
  loading: 'Loading…',
  tryAgain: 'Try again',
  skipToContent: 'Skip to main content',
  opensInNewTab: '(opens in a new tab)',
  source: 'Source',
  officialSource: 'Official source',
  verifyOnSite: 'Always check the details on the university’s own website before you apply.',
  draftBadge: 'Not yet verified',
  draftNotice:
    'Preview data: these requirements were researched from official sources but nobody has checked them yet. They are never shown to learners until they are verified.',
  sampleBadge: 'Sample',
  /** The preview notice, folded to one line (the full sentences behind "More"). */
  previewDrafts: 'Preview: data not yet verified',
  previewSample: 'no AI connected',
  more: 'More',
  rand: (amount: number) => `R${amount.toLocaleString('en-ZA')}`,
  free: 'Free',
  chooseOne: 'Choose one',
  /** The search box above every course dropdown (owner's request, 2026-10-21). */
  courseFilters: 'Narrow the list of courses',
  courseUniversity: 'University',
  courseAnyUniversity: 'Any university',
  courseFaculty: 'Faculty',
  courseAnyFaculty: 'Any faculty',
  courseSearch: 'Search the courses',
  courseSearchHint: 'Type part of a course, faculty or university, like “law” or “UJ”.',
  courseMatches: (shown: number, total: number) => {
    if (shown !== total) return `${shown} of ${total} courses match`;
    return total === 1 ? '1 course' : `${total} courses`;
  },
  courseNoMatch: 'No course matches that. Try fewer letters.',
  saved: 'Saved.',
  unknown: 'Not published',
} as const;
