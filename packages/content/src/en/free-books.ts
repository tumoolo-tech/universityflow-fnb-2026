/**
 * `en.freeBooks`: the words around free books on a module card (Phase 6d; D5–D7). The books
 * themselves (titles, authors, links) are catalogue records; these strings only label them.
 * Never a promise that the library has a copy (D7), never a "free PDF" (planning.md §8.3).
 */
export const freeBooks = {
  title: 'Free books',
  lead: 'Free and legal to read: open textbooks and your university library.',
  prescribedOpen: 'Your prescribed book is free to read online',
  notPrescribed: 'Not your prescribed book: check with your lecturer',
  none: 'We don’t know of a free book for this module yet. Ask your lecturer what they recommend, or search the library.',
  openOn: (title: string, provider: string) => `Open ${title} on ${provider}`,
  searchLibrary: (library: string) => `Search ${library} for it`,
  libraryNote:
    'This opens the library’s own search. It doesn’t tell us whether a copy is there or free to borrow.',
  noLibrary: 'We don’t have this library’s search yet. Ask at the library desk.',
  onlyLegal: 'We only link to free, legal copies, never to “free PDF” sites.',
  levels: {
    bridging: 'Revise school work first',
    'first-year': 'First-year level',
  },
  providers: {
    openstax: 'OpenStax',
    siyavula: 'Siyavula',
    'open-uct': 'OpenUCT',
    'wits-wiredspace': 'WIReDSpace (Wits)',
    'up-upspace': 'UPSpace (UP)',
    'uj-ujcontent': 'UJContent (UJ)',
    'tut-tutdor': 'TUTDoR (TUT)',
    'ukzn-researchspace': 'ResearchSpace (UKZN)',
  },
  licences: {
    'cc-by-4.0': 'Open licence: CC BY 4.0',
    'cc-by-3.0': 'Open licence: CC BY 3.0',
    'cc-by-sa-4.0': 'Open licence: CC BY-SA 4.0',
    'cc-by-nc-4.0': 'Open licence: CC BY-NC 4.0',
    'cc-by-nc-sa-4.0': 'Open licence: CC BY-NC-SA 4.0',
    'cc0-1.0': 'Public domain: CC0 1.0',
  },
} as const;
