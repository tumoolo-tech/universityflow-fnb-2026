/**
 * `en.profileLook`: the About me card and its "Make it yours" picker
 * (docs/design/profile-look-proposal.md). The keys are the ids stored on the profile
 * (`packages/ui` profile-look.ts takes its lists from them), so a word can be reworded without a
 * data migration, but a key must never be renamed. Fixed words only, never free text, and one set
 * for everyone (the owner's D2, D3). Owed the owner's wording review (D8).
 */
export const profileLook = {
  hello: 'Hello',
  im: 'I’m',
  myWords: 'My words',
  /** The card's heading before the learner has given a name. */
  noName: 'Your card',
  title: 'Make it yours',
  lead: 'Choose how your card looks. Only you can see it.',
  open: 'Make it yours',
  theme: 'Theme',
  avatar: 'Picture',
  avatarKinds: { initials: 'Initials', icons: 'Icons', patterns: 'Patterns' },
  initialsLabel: 'My initials',
  tagline: 'Tagline',
  taglineNone: 'No tagline',
  words: 'My words',
  wordsHint: 'Choose up to 3.',
  wordsChosen: (chosen: number, max: number) => `${chosen} of ${max} chosen`,
  wordsFull: (max: number) => `You can choose ${max}. Untick one to choose another.`,
  save: 'Save',
  cancel: 'Cancel',
  saved: 'Saved.',
  /** Theme ids are `tokens.profileThemes`' keys. */
  themes: {
    mauve: 'Mauve',
    ocean: 'Ocean',
    fynbos: 'Fynbos',
    sunrise: 'Sunrise',
    protea: 'Protea',
    jacaranda: 'Jacaranda',
    mono: 'Black and white',
  },
  /** Objects and South African plants: nothing gendered, no faces, no skin tones. */
  icons: {
    rocket: 'Rocket',
    book: 'Book',
    compass: 'Compass',
    telescope: 'Telescope',
    beaker: 'Science beaker',
    paintbrush: 'Paintbrush',
    headphones: 'Headphones',
    ball: 'Ball',
    protea: 'Protea flower',
    baobab: 'Baobab tree',
    mountain: 'Mountain',
    star: 'Star',
  },
  patterns: {
    dots: 'Dots',
    stripes: 'Stripes',
    waves: 'Waves',
    grid: 'Grid',
    rays: 'Rays',
    rings: 'Rings',
  },
  taglines: {
    'small-steps': 'Small steps, big future.',
    'one-day': 'One day at a time.',
    'dream-plan-do': 'Dream it. Plan it. Do it.',
    'my-pace': 'Learning at my own pace.',
    'keep-going': 'Keep going.',
    'how-far': 'Proud of how far I’ve come.',
    'ask-for-help': 'It’s okay to ask for help.',
    'future-me': 'Doing this for future me.',
    curious: 'Curious about everything.',
    'in-progress': 'Work in progress.',
    'open-doors': 'Keeping my doors open.',
    'hard-things': 'I can do hard things.',
  },
  /** The words around the avatar: goals, then habits, then what matters to the learner. */
  badges: {
    'future-engineer': 'Future engineer',
    'future-doctor': 'Future doctor',
    'future-nurse': 'Future nurse',
    'future-teacher': 'Future teacher',
    'future-lawyer': 'Future lawyer',
    'future-accountant': 'Future accountant',
    'future-scientist': 'Future scientist',
    'future-designer': 'Future designer',
    'future-coder': 'Future coder',
    'future-farmer': 'Future farmer',
    'future-business-owner': 'Future business owner',
    'still-deciding': 'Still deciding',
    'early-bird': 'Early bird',
    'night-owl': 'Night owl',
    'loves-maths': 'Loves maths',
    'loves-science': 'Loves science',
    'loves-languages': 'Loves languages',
    bookworm: 'Bookworm',
    'loves-art': 'Loves art',
    'music-lover': 'Music lover',
    'into-sport': 'Into sport',
    'team-player': 'Team player',
    'asks-questions': 'Asks questions',
    'first-in-family': 'First in my family to go',
    'proud-of-my-school': 'Proud of my school',
    'likes-helping': 'Likes helping people',
    'never-gives-up': 'Never gives up',
    curious: 'Curious',
  },
  /**
   * The app's poster said in one stop after the name (A2-35): the grade sticker and the words are
   * drawn around the figure, above the name, so a screen reader hears them here instead. Empty
   * when there is neither.
   */
  posterSummary: (grade: string | null, words: readonly string[]) =>
    [grade ? `${grade}.` : null, words.length > 0 ? `My words: ${words.join(', ')}.` : null]
      .filter(Boolean)
      .join(' '),
} as const;
