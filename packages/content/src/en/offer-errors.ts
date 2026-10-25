/**
 * `en.offers.errors`, in a module of its own: the browser's API client
 * (apps/web/lib/client/api.ts) carries these to every page that calls the API, sign-in included,
 * and the rest of `offers` belongs only on the offers pages.
 */
export const offerErrors = {
  'another-accepted':
    'You’ve already accepted another offer. You can accept only one: decline that one first.',
  'offer-exists': 'You’ve already added an offer for this course.',
  /** A11-17: shared by offers and My modules (the same `state` detail). */
  'personal-number':
    'That looks like an ID number or a student number. We don’t keep those: take it out, then save again.',
} as const;
