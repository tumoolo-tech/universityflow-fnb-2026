/**
 * `en.home`: the front door (`/`) and the split stage it shares with sign-in. The stage's
 * headline and wordmark are shown in capitals by CSS; they are written here in sentence case, so a
 * screen reader reads words, not letters. **New stage wording (2026-10-19): owed the owner's review.**
 * From Grade 10 (G10-5, 2026-10-22): the title, headline, "from Grade 10 on" and the wordmark,
 * also owed review.
 */
export const home = {
  title: 'Find your way to university, from Grade 10.',
  lead: 'UniversityFlow checks your marks against each university’s own rules, shows what you qualify for, what you’re close to, and your Plan B, then helps you apply on time.',
  start: 'Get started',
  signIn: 'I already have an account',
  free: 'Free for learners. Your information stays in South Africa.',
  points: [
    'Your score at Wits, UJ, UP, UCT, TUT and UKZN, worked out the way each one does it',
    'Exactly what to improve for the courses you’re close to',
    'Application checklists, deadlines and NSFAS in one place',
  ],
  /** The stage's headline, shown in capitals. */
  headline: 'From Grade 10 to graduation',
  /** Three quiet words at the top of the frosted half. */
  quietWords: ['Results.', 'Apply.', 'Arrive.'],
  /** Product facts only: never a count from the catalogue, never a number of users. */
  numbersLabel: 'UniversityFlow at a glance',
  numbers: [
    { value: '6', label: 'universities, each worked out its own way' },
    { value: '5', label: 'steps, from your results to registration' },
    { value: 'Free', label: 'for learners, from Grade 10 on' },
  ],
  tilesTitle: 'What we do together',
  tiles: {
    results: 'Your results',
    applications: 'Applications',
    funding: 'Funding',
    campus: 'Your campus',
  },
  /** The huge decorative word across the bottom and its spaced-out second line. */
  wordmark: 'Grade 10',
  strapline: 'to university',
  /** The frosted bar at the bottom. */
  barLabel: 'Start here',
  barFree: 'Free for learners',
  barHere: 'Your information stays in South Africa',
  /**
   * The front door's search and share description (A6-04, wave 10). Owed the owner's wording
   * review.
   */
  description:
    'Free for learners: UniversityFlow checks your marks against each university’s own rules, shows what you qualify for and your Plan B, and helps you apply.',
  /**
   * The judge demo's words in place of `barHere` and `free` (the owner, 2026-10-25): the demo's
   * database and functions are in London (docs/deploy/demo.md, hackathon exception J), so it never
   * says "Your information stays in South Africa". Production shows `barHere` and `free`. Owed the
   * owner's wording review.
   */
  barHereDemo: 'Real learners’ information will stay in South Africa',
  /** Under `barHereDemo` in the bar. */
  barHereDemoWhere: 'This demo runs in London, on made-up learners.',
  freeDemo:
    'Free for learners. Real learners’ information will stay in South Africa; this demo runs in London.',
} as const;
