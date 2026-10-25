/** Re-checks after a new Grade 12 report (Phase 4c). */
export const recheck = {
  title: (previousKind: string) => `Since your ${previousKind}…`,
  lead: (newKind: string) => `We checked every course again with your ${newKind}.`,
  none: 'No course moved between groups. Your results page has your new scores.',
  up: 'Moved closer',
  down: 'Moved further away',
  standings: {
    'qualify-now': 'You qualify now',
    'on-track': 'On track',
    close: 'You’re close',
    'plan-b': 'Plan B',
    'not-yet': 'Not yet',
  },
  move: (from: string, to: string) => `${from} → ${to}`,
  more: (n: number) => (n === 1 ? 'and 1 more course' : `and ${n} more courses`),
} as const;
