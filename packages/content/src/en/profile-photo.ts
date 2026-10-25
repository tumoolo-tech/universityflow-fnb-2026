/**
 * `en.profilePhoto`: the profile photo on the About me card (docs/design/profile-look-proposal.md
 * §5.3), in the web's "Make it yours" and the app's. Built behind the server switch
 * `UF_PROFILE_PHOTO` and shown to no learner until guardian consent v4 and adult consent v3 name
 * it (legal review). Owed the owner's wording review. `errors` keys are the server's refusal
 * reasons (packages/documents profile-photo.ts).
 */
export const profilePhoto = {
  heading: 'Photo',
  lead: 'Add a photo of yourself. It shows in black and white on your card. Only you can see it, and it is never sent to the AI.',
  add: 'Add a photo',
  change: 'Change photo',
  remove: 'Remove photo',
  removed: 'Photo removed.',
  /** The web's file chooser. */
  choose: 'Choose a photo',
  types: 'JPG or PNG, up to 2 MB.',
  /** The app's two ways to pick one. */
  takePhoto: 'Take a photo',
  chooseFromPhone: 'Choose from my photos',
  cameraDenied:
    'The camera is off for UniversityFlow. Turn it on in your phone’s settings, or choose a photo instead.',
  cropTitle: 'Crop your photo',
  cropLead: 'Move and zoom until you fill the square.',
  /** The web's crop area: it takes the arrow keys and + and −. */
  cropArea: 'Your photo. Use the arrow keys to move it, and + or − to zoom.',
  zoom: 'Zoom',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  moveLeft: 'Move left',
  moveRight: 'Move right',
  moveUp: 'Move up',
  moveDown: 'Move down',
  save: 'Use this photo',
  saving: 'Saving…',
  /** Apart from the look's Cancel, on the same page. */
  cancel: 'Cancel photo',
  saved: 'Photo saved.',
  errors: {
    empty: 'That file is empty. Choose another photo.',
    'too-large': 'That photo is bigger than 2 MB. Choose a smaller one.',
    'unsupported-type': 'That isn’t a JPG or PNG photo. Choose another one.',
    'heic-unsupported':
      'That photo is a HEIC, which we can’t open yet. Save it as a JPG and try again (on an iPhone: Settings, Camera, Formats, Most Compatible).',
    unreadable: 'We couldn’t open that photo. Try another one.',
    'bad-crop': 'Something went wrong with the crop. Try again.',
  },
  /** The zoom slider's value as a screen reader says it ("125%", not "1.25"), A2-42. */
  zoomValue: (percent: number) => `${percent}%`,
  /**
   * Beside the upload, web and app (the owner's condition, 2026-10-23: "not used for anything
   * else"; A11-31). Owed the owner's wording review.
   */
  onlyYou:
    'Only you see your photo. We don’t use it for anything else. It never goes to the AI, your CV or anyone else. Remove it any time.',
  /**
   * The refusal when the learner's consent doesn't name the photo yet (`consent-outdated`,
   * `photo-consent`; migration 0037). Owed the owner's wording review.
   */
  consentNeeded:
    'Adding a photo needs new permission first. If you’re under 18, your parent or guardian agrees to it. If you’re 18 or older, you do.',
} as const;
