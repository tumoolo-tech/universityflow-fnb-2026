/**
 * The privacy policy's consent lines: the only part of `en.privacyPage` the phone app shows.
 * Their own module so the app bundles these three strings and not the whole policy (audit
 * A4-18); `en.privacyPage` spreads them in where they always were, so `en.privacyPage.x` is
 * unchanged.
 */
export const privacyConsent = {
  /** Beside every consent box, on the web and in the app. */
  consentLink: 'Read our privacy policy',
  /** The adult agreement's box (web and app): the button waits for it. */
  adultConfirm: 'I have read what UniversityFlow does with my information, and I agree.',
  /** Shown when "I agree to this" is pressed before the box is ticked. */
  adultConfirmNeeded: 'Tick the box first to say you agree.',
} as const;
