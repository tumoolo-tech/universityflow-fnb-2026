/**
 * What the phone shows when the app asks for a permission (iOS) and our explanations around
 * them. Plain, short, and only what the permission is used for. app.config.ts mirrors these
 * (the Expo CLI can't read this package); a test keeps the two the same.
 */
export const permissions = {
  // A7-23: the profile photo uses the same camera and photo library, so both name it too.
  camera:
    'UniversityFlow uses the camera only when you choose to take a photo: of a document to upload, such as your school report, offer letter or proof of registration, or of yourself, if you add a profile photo.',
  photos:
    'UniversityFlow opens your photos only when you choose a picture: of a document to upload, such as your school report, offer letter or proof of registration, or of yourself, if you add a profile photo.',
} as const;
