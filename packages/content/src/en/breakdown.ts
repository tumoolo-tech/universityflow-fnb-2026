/** `en.breakdown`. */
export const breakdown = {
  title: 'How your score is worked out',
  counted: 'Counted',
  notCounted: 'Not counted',
  reasons: {
    counted: 'One of your best subjects',
    'required-subject': 'Always counted',
    'not-in-best': 'Not among your best',
    'life-orientation-excluded': 'This university leaves Life Orientation out',
    'life-orientation-added': 'Life Orientation, on its own scale',
  },
  bonus: (points: number) => `+${points} bonus`,
  total: 'Total',
  incomplete:
    'Your report has fewer subjects than this university counts, so this score is lower than it will be.',
  method: 'How this university scores',
} as const;
