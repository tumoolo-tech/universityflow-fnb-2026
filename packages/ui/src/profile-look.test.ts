import { en } from '@universityflow/content';
import { tokens } from '@universityflow/tokens';
import { describe, expect, it } from 'vitest';
import {
  AVATAR_IDS,
  BADGE_IDS,
  DEFAULT_LOOK,
  initials,
  MAX_BADGES,
  resolveLook,
  TAGLINE_IDS,
  THEME_IDS,
} from './profile-look';

describe('the profile look’s ids (docs/design/profile-look-proposal.md)', () => {
  it('has a theme for every token theme, each with a name, and nothing else', () => {
    expect(THEME_IDS).toEqual(Object.keys(tokens.profileThemes));
    expect(Object.keys(en.profileLook.themes)).toEqual([...THEME_IDS]);
  });

  it('offers initials first, then every icon and every pattern', () => {
    expect(AVATAR_IDS[0]).toBe('initials');
    expect(AVATAR_IDS).toEqual([
      'initials',
      ...Object.keys(en.profileLook.icons).map((id) => `icon:${id}`),
      ...Object.keys(en.profileLook.patterns).map((id) => `pattern:${id}`),
    ]);
    expect(AVATAR_IDS).toHaveLength(19);
  });

  it('takes the tagline and word ids from their words, so neither can lack the other', () => {
    expect(TAGLINE_IDS).toEqual(Object.keys(en.profileLook.taglines));
    expect(BADGE_IDS).toEqual(Object.keys(en.profileLook.badges));
  });

  it('starts every learner on Mauve, initials, no tagline and no words', () => {
    expect(DEFAULT_LOOK).toEqual({
      theme: 'mauve',
      avatar: 'initials',
      taglineId: null,
      badgeIds: [],
    });
    expect(MAX_BADGES).toBe(3);
  });
});

describe('resolveLook', () => {
  it('gives the default look to a learner who has chosen nothing', () => {
    expect(resolveLook(null)).toEqual(DEFAULT_LOOK);
    expect(resolveLook(undefined)).toEqual(DEFAULT_LOOK);
    expect(resolveLook({})).toEqual(DEFAULT_LOOK);
  });

  it('keeps every known choice', () => {
    expect(
      resolveLook({
        theme: 'ocean',
        avatar: 'icon:rocket',
        taglineId: 'small-steps',
        badgeIds: ['future-engineer', 'loves-maths'],
      }),
    ).toEqual({
      theme: 'ocean',
      avatar: 'icon:rocket',
      taglineId: 'small-steps',
      badgeIds: ['future-engineer', 'loves-maths'],
    });
  });

  // The lists change over time; a stored id that has gone falls back rather than breaking the card.
  it('falls back on any id it doesn’t know', () => {
    expect(
      resolveLook({ theme: 'coral', avatar: 'photo', taglineId: 'gone', badgeIds: ['gone'] }),
    ).toEqual(DEFAULT_LOOK);
    expect(resolveLook({ avatar: 'icon:nothing' }).avatar).toBe('initials');
    expect(resolveLook({ avatar: 'pattern:waves' }).avatar).toBe('pattern:waves');
  });

  it('keeps each word once, and at most three, in the order chosen', () => {
    expect(
      resolveLook({
        badgeIds: ['night-owl', 'night-owl', 'bookworm', 'gone', 'loves-maths', 'early-bird'],
      }).badgeIds,
    ).toEqual(['night-owl', 'bookworm', 'loves-maths']);
  });
});

describe('initials', () => {
  it('has none without a name, so the avatar shows an icon', () => {
    expect(initials(null)).toBeNull();
    expect(initials('')).toBeNull();
    expect(initials('   ')).toBeNull();
  });

  it('takes the first letter of the first and last names, in capitals', () => {
    expect(initials('Thando')).toBe('T');
    expect(initials('thando mokoena')).toBe('TM');
    expect(initials('  Thando  Lerato   Mokoena ')).toBe('TM');
  });

  it('keeps letters beyond A to Z whole', () => {
    expect(initials('émile')).toBe('É');
    // A decomposed é (e and a combining accent) is still one letter.
    expect(initials('émile')).toBe('É');
    expect(initials('李 小龙')).toBe('李小');
    expect(initials('𝒜da')).toBe('𝒜');
  });
});
