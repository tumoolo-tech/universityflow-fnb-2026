/**
 * The words around a university's safety notes (planning.md §11, Phase 5e-3), on the campus tour
 * and in the first-week checklist. The advice itself is the university's, quoted from the
 * catalogue with its dates; numbers come from checked records. These strings only frame it, say
 * what to do and who to call, and never call a place safe or unsafe. **Draft wording: owed the
 * owner's review, and "No warning here…" a legal review (decision 9).**
 */
export const safetyNotes = {
  title: (university: string) => `Safety advice from ${university}`,
  lead: 'In the university’s own words, with what to do and who to call.',
  /** On every campus tour, with notes or without (decision 9: legal review). */
  noWarning: 'No warning here doesn’t mean it’s safe.',
  wholeUniversity: 'For every campus',
  campusTitle: (campus: string) => `Advice for ${campus}`,
  says: (university: string) => `${university} says:`,
  area: (area: string) => `Area, in the university’s words: ${area}`,
  when: (days: string | null, hours: string | null) =>
    `When: ${[days, hours].filter(Boolean).join(', ')}`,
  lastChecked: (date: string) => `Last checked ${date}`,
  /** Preview only: a draft note nobody has checked against the page yet. */
  notCheckedYet: 'Not checked against the university’s page yet',
  publishedOn: (date: string) => `The university’s date: ${date}`,
  whatToDoTitle: 'What to do',
  /** By the note's kind (catalogue `SAFETY_ADVICE_KINDS`). */
  whatToDo: {
    'avoid-after-dark':
      'If you have to go there after dark, don’t go alone. Call campus security before you set off and ask how best to get there.',
    'walk-in-groups':
      'Arrange to walk with friends, especially at night. If nobody can walk with you, call campus security and ask what they can do.',
    'escort-available':
      'Call campus security and ask for the escort the university describes. Wait somewhere well lit, with other people around, until it arrives.',
    'shuttle-stop':
      'Use the university’s shuttle where it runs, and wait at the stop it names. Check the times on the university’s own page.',
    'safe-route':
      'Keep to the route the university recommends. If something feels wrong, go to the nearest place with other people and call campus security.',
    'emergency-point':
      'Find this point before you need it. In an emergency, use it or call campus security straight away.',
    'incident-advisory':
      'Take extra care in the area the university names. Report anything suspicious to campus security, and call for help if you need it.',
    'general-tip':
      'If you’re not sure what to do, ask campus security. In an emergency, call one of the numbers below.',
  },
  whoToCallTitle: 'Who to call',
  call: (number: string) => `Call ${number}`,
} as const;
