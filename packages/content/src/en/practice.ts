/** `en.practice`. */
export const practice = {
  title: 'Free practice',
  lead: {
    asked: 'Free practice and textbooks for the subject you asked about.',
    goal: (programme: string) =>
      `Free practice for the subjects that matter most for ${programme}.`,
    weakest: 'Free practice for the subjects where your confirmed marks are lowest.',
    none: 'Set a goal or confirm your marks, and we’ll suggest free practice for the subjects that matter most.',
  },
  reasons: {
    asked: 'You asked about this one',
    'goal-to-raise': 'This mark needs to rise for your goal',
    'goal-requires': 'Your goal course asks for this subject',
    weakest: 'One of your lowest marks',
  },
  kinds: {
    textbook: 'Free textbook',
    practice: 'Practice questions',
    'past-papers': 'Past papers',
  },
  access: {
    free: 'Free, no sign-up',
    'free-with-account': 'Free, with a free account',
  },
  grades: (grades: string) => `Grade ${grades}`,
  noneYet:
    'We don’t have free practice for this subject yet. Ask your teacher what they recommend.',
  signUpNote:
    'Siyavula is free for learners. To practise you sign up on their site; if you’re under 18, they ask for a parent’s or guardian’s OK first.',
  openApp: (title: string) => `Open ${title} on Siyavula`,
  whatINeed: 'See the marks to aim for',
} as const;
