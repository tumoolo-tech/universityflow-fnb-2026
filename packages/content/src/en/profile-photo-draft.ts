/**
 * `en.profilePhotoDraft`: DRAFT, NOT LIVE. The profile photo's lines for guardian consent v4 and
 * adult-v3 (docs/legal/consent-v4-draft.md, C5) and its section for the privacy policy, after the
 * owner's decision of 2026-10-23 (learners from Grade 10 may add their own photo "as long as the
 * picture is not used for anything else"; A11-31). Owed legal review and the owner's wording
 * review. Nothing reads these yet: the live consent wording (`en.consent`, `en.adultConsent`), its
 * versions and the privacy page are unchanged. They go live in the one change that makes v4 live
 * (docs/deploy/profile-photo.md). Web only: the app doesn't bundle them.
 */
export const profilePhotoDraft = {
  status:
    'Draft, owed legal review: not shown to anyone, and not part of the live consent or privacy policy. Goes live with guardian consent v4 and adult-v3.',
  /** For guardian consent v4, under "What we keep, and who helps us". */
  guardianLine:
    'If your child chooses, a photo of themselves for their own profile, from Grade 10. Only they can see it. We don’t use it for anything else: it is never sent to the AI provider, put on a CV or shown to anyone. It is stored in South Africa. They can remove it at any time, and it is deleted with their account or if you withdraw permission.',
  /** For the adult agreement adult-v3. */
  adultLine:
    'If you choose, a photo of yourself for your own profile. Only you see it. We don’t use it for anything else: it never goes to the AI, a CV or anyone else. It is stored in South Africa. Remove it any time. It is deleted with your account.',
  /** The privacy policy's section, replacing the photo's "Coming later" line. */
  privacy: {
    status:
      'Draft for the legal adviser: shown on the privacy policy only once guardian consent v4 and adult-v3 are live.',
    title: 'Your profile photo',
    items: [
      'If you choose, a photo of yourself for your About me card, from Grade 10. Only you see it.',
      'We use it for nothing else. It is never sent to our AI provider, never put on a CV or sent to Mmereko, and never shown to anyone else, a recruiter or your parent or guardian included.',
      'We keep one copy: cropped to a square, 512 by 512 pixels, in black and white, with its hidden details (such as where it was taken) removed. It is stored in South Africa.',
      'Remove it at any time under About me. It is deleted with your account, and if a parent or guardian withdraws their permission.',
      'It is in the copy of your information you can download.',
    ],
  },
} as const;
