/** `en.results`. */
export const results = {
  title: 'My results',
  lead: 'Based on the marks you confirmed. A Grade 11 result is a starting point: universities make final decisions on your final matric results.',
  /** On Grade 10 marks (G10-3): never "you qualify". */
  leadGrade10:
    'Based on the Grade 10 marks you confirmed. Universities don’t use Grade 10 marks, so this shows where you’re heading, not what you qualify for. Your final Grade 11 report is the first one they look at.',
  noReport: 'You haven’t added a report yet.',
  /** The mobile app before camera upload (Phase 4). */
  uploadOnWeb:
    'For now, upload your report on the UniversityFlow website and check your marks there. They’ll show up here straight away. Taking a photo in the app is coming soon.',
  addReport: 'Add my latest school report',
  updateReport: 'Update my marks',
  reportFrom: (kind: string, date: string) => `From your ${kind}, confirmed ${date}`,
  projectedPass: 'Pass your marks point to',
  groups: {
    qualifyNow: 'You qualify now',
    qualifyNowLead:
      'You meet every published minimum. Places are limited, so meeting the minimum isn’t a guarantee.',
    close: 'You’re close',
    closeLead: 'Within reach: here is exactly what to improve.',
    onTrack: 'On track',
    onTrackLead:
      'Your marks today would meet every published minimum. Keep them there through Grade 11 and matric.',
    planB: 'Plan B',
    planBLead: 'Extended programmes and diplomas you qualify for. A strong route into a degree.',
    empty: 'Nothing here yet.',
  },
  yourScore: (label: string, score: number, max: number) => `Your ${label}: ${score} of ${max}`,
  needed: (label: string, required: number) => `Needs ${label} ${required}`,
  noMinimum: 'No minimum score published',
  pointsShort: (gap: number, label: string) => `${gap} ${label} points to go`,
  improve: (subject: string, current: number | null, target: number) =>
    current === null
      ? `${subject}: you don’t take this subject (needs ${target}%)`
      : `${subject}: ${current}% now, needs ${target}%`,
  improveOthers: (count: number, target: number) =>
    `Any ${count} other subjects at ${target}% or more`,
  passNeeded: (pass: string) => `Needs a ${pass}`,
  nbtRequired: 'NBT required',
  closes: (date: string) => `Closes ${date}`,
  shortlist: 'Add to my shortlist',
  shortlisted: 'On my shortlist',
  details: 'Why this score?',
  bands: 'Admission bands',
  bandBasis: { score: 'score', 'weighted-score': 'weighted score' },
  checked: (n: number) => `${n} programmes checked at 6 universities.`,
  filters: {
    label: 'Filter',
    university: 'University',
    all: 'All universities',
    search: 'Search courses',
  },
} as const;
