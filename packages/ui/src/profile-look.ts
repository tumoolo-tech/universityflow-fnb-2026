/**
 * The learner's profile look (docs/design/profile-look-proposal.md): ids from fixed lists, never
 * free text, and nothing that says who the learner is. Theme ids are the tokens' themes; every
 * other list is the keys of its words in `en.profileLook`, so an id can't exist without words.
 * The database checks only shape and the cap; the API checks membership with these lists, and a
 * stored id a later list no longer has falls back here. React-Native-safe (hard rule 11).
 */
import { profileLook } from '@universityflow/content/app';
import { type ProfileThemeId, tokens } from '@universityflow/tokens';

type Ids<T> = readonly [keyof T & string, ...Array<keyof T & string>];

const keysOf = <T extends object>(o: T) => Object.keys(o) as unknown as Ids<T>;

export type ThemeId = ProfileThemeId;
export type IconId = keyof typeof profileLook.icons;
export type PatternId = keyof typeof profileLook.patterns;
export type AvatarId = 'initials' | `icon:${IconId}` | `pattern:${PatternId}`;
export type TaglineId = keyof typeof profileLook.taglines;
export type BadgeId = keyof typeof profileLook.badges;

export const THEME_IDS = keysOf(tokens.profileThemes);
export const TAGLINE_IDS = keysOf(profileLook.taglines);
export const BADGE_IDS = keysOf(profileLook.badges);
export const AVATAR_IDS: readonly [AvatarId, ...AvatarId[]] = [
  'initials',
  ...keysOf(profileLook.icons).map((id) => `icon:${id}` as const),
  ...keysOf(profileLook.patterns).map((id) => `pattern:${id}` as const),
];

/** Words around the avatar: three fit its orbit on a laptop and one row on a phone. */
export const MAX_BADGES = 3;

export interface ProfileLook {
  theme: ThemeId;
  avatar: AvatarId;
  taglineId: TaglineId | null;
  badgeIds: BadgeId[];
}

export const DEFAULT_LOOK: Readonly<ProfileLook> = Object.freeze({
  theme: 'mauve',
  avatar: 'initials',
  taglineId: null,
  badgeIds: [],
});

const member = <T extends string>(list: ReadonlyArray<T>, value: unknown): value is T =>
  typeof value === 'string' && (list as ReadonlyArray<string>).includes(value);

/** A stored look made safe to draw: unknown ids fall back, words kept once each, at most three. */
export function resolveLook(
  row:
    | {
        theme?: string | null;
        avatar?: string | null;
        taglineId?: string | null;
        badgeIds?: ReadonlyArray<string> | null;
      }
    | null
    | undefined,
): ProfileLook {
  const { theme, avatar, taglineId } = row ?? {};
  const badgeIds: BadgeId[] = [];
  for (const id of row?.badgeIds ?? []) {
    if (badgeIds.length === MAX_BADGES) break;
    if (member(BADGE_IDS, id) && !badgeIds.includes(id)) badgeIds.push(id);
  }
  return {
    theme: member(THEME_IDS, theme) ? theme : DEFAULT_LOOK.theme,
    avatar: member(AVATAR_IDS, avatar) ? avatar : DEFAULT_LOOK.avatar,
    taglineId: member(TAGLINE_IDS, taglineId) ? taglineId : null,
    badgeIds,
  };
}

/**
 * The avatar's letters: the first letter of the first and the last name, in capitals, or null
 * (the avatar then shows a plain icon). Whole characters, not UTF-16 halves, so a name in any
 * script keeps its first letter intact.
 */
export function initials(name: string | null | undefined): string | null {
  const words = (name ?? '').normalize('NFC').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const first = (word: string) => (Array.from(word)[0] ?? '').toUpperCase();
  const last = words.length > 1 ? words.at(-1) : undefined;
  return first(words[0] ?? '') + (last ? first(last) : '');
}
