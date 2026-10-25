/**
 * Migration 0028: the learner's profile look (docs/design/profile-look-proposal.md, approved
 * 2026-10-22). Ids from fixed lists, never free text: the database holds the shape of an id and
 * the three-word cap; the API holds the lists (`packages/ui` profile-look.ts), which will grow, so
 * there is no enum here, and an id a later list drops falls back when read. Append-only.
 */
export const sql = `alter table profiles
  add column theme text not null default 'mauve',
  add column avatar text not null default 'initials',
  add column tagline_id text,
  add column badge_ids text[] not null default '{}';

alter table profiles add constraint profiles_theme_id check (theme ~ '^[a-z][a-z0-9-]{0,39}$');
alter table profiles add constraint profiles_avatar_id
  check (avatar ~ '^(initials|(icon|pattern):[a-z][a-z0-9-]{0,39})$');
alter table profiles add constraint profiles_tagline_id
  check (tagline_id ~ '^[a-z][a-z0-9-]{0,39}$');
alter table profiles add constraint profiles_badge_ids_max check (cardinality(badge_ids) <= 3);
-- Each word an id, and none missing (array_to_string skips a null, so it is refused on its own).
alter table profiles add constraint profiles_badge_ids_shape check (
  array_position(badge_ids, null) is null
  and array_to_string(badge_ids, ' ') ~ '^([a-z][a-z0-9-]{0,39}( |$))*$'
);
`;
