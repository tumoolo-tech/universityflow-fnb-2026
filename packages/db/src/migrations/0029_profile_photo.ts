/**
 * Migration 0029: the learner's profile photo (docs/design/profile-look-proposal.md §5.3), built
 * behind the server switch `UF_PROFILE_PHOTO` until guardian consent v4 and adult consent v3 name
 * it. Only the storage key is kept here: the photo itself is in the files service (private S3 in
 * af-south-1), cropped, 512 × 512, black and white and stripped of metadata by the server. A key
 * the app made (`photo-` and 32 hex digits), never a name. Deleted with the profile, and the
 * account deletion returns it so the file goes too. Append-only.
 */
export const sql = `alter table profiles add column photo_key text;

alter table profiles add constraint profiles_photo_key
  check (photo_key ~ '^photo-[0-9a-f]{32}$');
`;
